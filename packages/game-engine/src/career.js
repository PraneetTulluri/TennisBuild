import { ATTRIBUTE_KEYS } from "./attributes.js";
import { computeOverall, computeSurfaceStrength } from "./scoring.js";
import { pickDistinct } from "./wheel.js";

// Career simulation: takes a finished build's attributes and simulates a
// full career, one season at a time, from age 18 until retirement.
//
// Design (see the career-simulation design discussion for the full
// reasoning): Grand Slams are simulated round-by-round (the player's own
// path through a 7-round bracket, not the whole draw) since that's where
// the dramatic "beat a real legend" moments matter; everything else on
// tour collapses into one aggregate season contribution, no per-match
// detail. Attributes scale over the career via an age curve (rise, peak,
// decline) rather than staying fixed, so careers have a real shape.

// ---------- Age curve ----------

/**
 * Multiplier applied to the build's base attributes for a season played
 * at this age: rises through 18-21, plateaus at peak for 22-29, then
 * gradually declines. Values are a first-pass calibration for a
 * believable career shape, not a precisely modeled sports-science curve.
 */
export function ageFactor(age) {
  if (age <= 21) return 0.78 + ((age - 18) * 0.22) / 3;
  if (age <= 29) return 1.0;
  const yearsPastPeak = age - 29;
  return Math.max(0.45, 1.0 - yearsPastPeak * 0.045);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scaleAttributes(attributes, factor) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) {
    result[key] = clamp(Math.round(attributes[key] * factor), 1, 99);
  }
  return result;
}

/**
 * Whether a career ends after the season played at `age`. Age 38 is a
 * hard cap; from 30 onward, retirement chance grows with age and
 * accelerates once the age curve has meaningfully dropped off peak - so
 * careers end at a believable, somewhat random point rather than an
 * arbitrary fixed length.
 */
export function shouldRetire(age) {
  if (age >= 38) return true;
  if (age < 30) return false;
  const factor = ageFactor(age);
  const baseChance = (age - 30) * 0.05;
  const declineChance = factor < 0.85 ? (1 - factor) * 0.6 : 0;
  return Math.random() < Math.min(0.92, baseChance + declineChance);
}

// ---------- Grand Slams ----------

export const SLAM_CALENDAR = [
  { key: "australianOpen", label: "Australian Open", surface: "hard" },
  { key: "frenchOpen", label: "French Open", surface: "clay" },
  { key: "wimbledon", label: "Wimbledon", surface: "grass" },
  { key: "usOpen", label: "US Open", surface: "hard" },
];

// The player's own path through a 7-round bracket - R128 through the
// Final - not the full draw. Only the last 3 rounds face real players
// from the pool; earlier rounds face generated journeymen, difficulty
// rising with the round.
const SLAM_ROUNDS = ["R128", "R64", "R32", "R16", "QF", "SF", "F"];
const REAL_OPPONENT_ROUNDS = new Set(["QF", "SF", "F"]);
const JOURNEYMAN_BASELINE = { R128: 50, R64: 55, R32: 60, R16: 68 };

export const SLAM_RESULT_POINTS = {
  R128: 10,
  R64: 45,
  R32: 90,
  R16: 180,
  QF: 360,
  SF: 720,
  F: 1200,
  W: 2000,
};

const JOURNEYMAN_FIRST_NAMES = [
  "Marek",
  "Diego",
  "Lars",
  "Yusuke",
  "Tomas",
  "Kwame",
  "Aleksi",
  "Rui",
  "Nikolai",
  "Bram",
];
const JOURNEYMAN_LAST_NAMES = [
  "Vondracek",
  "Ferrante",
  "Bergstrom",
  "Tanaka",
  "Herrera",
  "Owusu",
  "Laine",
  "Costa",
  "Petrov",
  "de Vries",
];

function generateJourneyman(round) {
  const baseline = JOURNEYMAN_BASELINE[round] ?? 50;
  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    const jitter = (Math.random() - 0.5) * 16; // +/- 8
    attributes[key] = clamp(Math.round(baseline + jitter), 20, 90);
  }
  const name = `${JOURNEYMAN_FIRST_NAMES[Math.floor(Math.random() * JOURNEYMAN_FIRST_NAMES.length)]} ${
    JOURNEYMAN_LAST_NAMES[Math.floor(Math.random() * JOURNEYMAN_LAST_NAMES.length)]
  }`;
  return { name, attributes };
}

/**
 * Win probability for one match, from each side's surface-specific
 * strength. A logistic curve on the strength gap means a big favorite is
 * still not a certainty (upsets stay possible - floor/ceiling of
 * 3%/97%), and a small mental-toughness edge nudges close matches
 * (the "clutch factor" called for in the Phase 0 design doc).
 */
function matchWinProbability(
  playerStrength,
  opponentStrength,
  playerMental,
  opponentMental
) {
  const diff = playerStrength - opponentStrength;
  const base = 1 / (1 + Math.exp(-diff / 12));
  const clutch = (playerMental - opponentMental) / 400;
  return clamp(base + clutch, 0.03, 0.97);
}

const SET_SCORES = ["6-2", "6-3", "6-4", "7-5", "7-6"];

/**
 * A plausible-looking set-score line for a match - flavor text only, not
 * a simulated point-by-point match. Closer matches (win probability near
 * 50%) are more likely to go 3 sets and include a tight set; lopsided
 * ones read as straightforward two-set wins.
 */
function generateScoreLine(closeness) {
  const setCount = closeness > 0.6 && Math.random() < 0.5 ? 3 : 2;
  const sets = [];
  for (let i = 0; i < setCount; i++) {
    const set = SET_SCORES[Math.floor(Math.random() * SET_SCORES.length)];
    const droppedByWinner = Math.random() < closeness * 0.35;
    sets.push(droppedByWinner ? set.split("-").reverse().join("-") : set);
  }
  return sets.join(", ");
}

function simulateSlam(attributes, slam, playerPool) {
  const realOpponents = pickDistinct(playerPool, 3);
  let realOpponentIndex = 0;
  const matches = [];

  for (const round of SLAM_ROUNDS) {
    const opponent = REAL_OPPONENT_ROUNDS.has(round)
      ? realOpponents[realOpponentIndex++]
      : generateJourneyman(round);

    const playerStrength = computeSurfaceStrength(attributes, slam.surface);
    const opponentStrength = computeSurfaceStrength(opponent.attributes, slam.surface);
    const winProbability = matchWinProbability(
      playerStrength,
      opponentStrength,
      attributes.mentalToughness,
      opponent.attributes.mentalToughness
    );
    const won = Math.random() < winProbability;
    const closeness = 1 - Math.abs(winProbability - 0.5) * 2;

    matches.push({
      round,
      opponentName: opponent.name,
      won,
      score: generateScoreLine(closeness),
    });

    if (!won) break;
  }

  const lastMatch = matches[matches.length - 1];
  const result = lastMatch.won ? "W" : lastMatch.round;

  return { key: slam.key, label: slam.label, surface: slam.surface, matches, result };
}

// ---------- Rest of tour (aggregate, no per-match detail) ----------

function simulateTourAggregate(overall) {
  const titleProbabilityPerEvent = clamp((overall - 60) / 120, 0.02, 0.35);
  const eventsEntered = 18; // rough count of non-Slam events entered in a season
  let titles = 0;
  for (let i = 0; i < eventsEntered; i++) {
    if (Math.random() < titleProbabilityPerEvent) titles++;
  }

  const matchesPlayed = 35 + Math.round(Math.random() * 15);
  const winRate = clamp(0.35 + (overall - 65) / 90, 0.15, 0.85);
  const wins = Math.round(matchesPlayed * winRate);
  const losses = Math.max(0, matchesPlayed - wins);

  return { titles, wins, losses };
}

function tourAggregatePoints(tourResult) {
  return tourResult.titles * 300 + tourResult.wins * 8;
}

// ---------- Ranking model ----------

// Rough, flavor-calibrated points-to-ranking curve (not real ATP data) -
// enough breakpoints that interpolation between them feels reasonable at
// a glance, without needing an authentic points table.
const RANKING_BREAKPOINTS = [
  { rank: 1, points: 11000 },
  { rank: 5, points: 6500 },
  { rank: 10, points: 4200 },
  { rank: 20, points: 2600 },
  { rank: 50, points: 1200 },
  { rank: 100, points: 600 },
  { rank: 200, points: 300 },
  { rank: 300, points: 150 },
  { rank: 500, points: 50 },
  { rank: 1000, points: 0 },
];

export function pointsToRanking(points) {
  if (points >= RANKING_BREAKPOINTS[0].points) return 1;
  for (let i = 0; i < RANKING_BREAKPOINTS.length - 1; i++) {
    const hi = RANKING_BREAKPOINTS[i];
    const lo = RANKING_BREAKPOINTS[i + 1];
    if (points <= hi.points && points >= lo.points) {
      const t = (points - lo.points) / (hi.points - lo.points);
      return Math.max(1, Math.round(lo.rank - t * (lo.rank - hi.rank)));
    }
  }
  return RANKING_BREAKPOINTS[RANKING_BREAKPOINTS.length - 1].rank;
}

// ---------- Injuries ----------

/**
 * A small per-season chance of an injury, loosely more likely for
 * high-Power/high-Movement builds (a physically taxing playing style) -
 * a flavor mechanic, not a precise medical model. When it happens, this
 * season's effective attributes take a mild hit.
 */
function maybeInjury(attributes) {
  const intensity = (attributes.power + attributes.movement) / 2;
  const injuryChance = 0.04 + (intensity / 99) * 0.08;
  if (Math.random() < injuryChance) {
    return {
      description: "A mid-season injury forced time away from the tour.",
      impactMultiplier: 0.85,
    };
  }
  return null;
}

// ---------- Career state (mirrors draft.js's pure-state-machine pattern) ----------

/** Starts a new career at age 18, no seasons played yet. */
export function createCareerState(baseAttributes) {
  return {
    baseAttributes,
    age: 18,
    retired: false,
    seasons: [],
  };
}

/**
 * Simulates one more season and appends it to the career. Applies this
 * season's age factor (and any injury) to the build's base attributes to
 * get that season's effective strength, plays out all 4 Grand Slams plus
 * an aggregate tour result, derives a season-ending ranking from the
 * points earned, then rolls whether next season happens at all.
 */
export function simulateNextSeason(state, playerPool) {
  if (state.retired) {
    throw new Error(
      "Cannot simulate a season: this career has already ended in retirement"
    );
  }

  const age = state.age;
  const factor = ageFactor(age);
  const baseEffective = scaleAttributes(state.baseAttributes, factor);
  const injury = maybeInjury(baseEffective);
  const seasonAttributes = injury
    ? scaleAttributes(baseEffective, injury.impactMultiplier)
    : baseEffective;

  const slams = SLAM_CALENDAR.map((slam) =>
    simulateSlam(seasonAttributes, slam, playerPool)
  );
  const tour = simulateTourAggregate(computeOverall(seasonAttributes));

  const seasonPoints =
    slams.reduce((sum, slam) => sum + SLAM_RESULT_POINTS[slam.result], 0) +
    tourAggregatePoints(tour);
  const ranking = pointsToRanking(seasonPoints);

  const season = {
    year: state.seasons.length + 1,
    age,
    ageFactor: factor,
    injury,
    slams,
    tour,
    seasonPoints,
    ranking,
  };

  const nextAge = age + 1;

  return {
    ...state,
    age: nextAge,
    retired: shouldRetire(nextAge),
    seasons: [...state.seasons, season],
  };
}

/** Aggregate career totals derived from the seasons played so far. */
export function summarizeCareer(state) {
  let titles = 0;
  let slamTitles = 0;
  let peakRanking = null;

  for (const season of state.seasons) {
    titles += season.tour.titles;
    for (const slam of season.slams) {
      if (slam.result === "W") {
        titles++;
        slamTitles++;
      }
    }
    if (peakRanking === null || season.ranking < peakRanking) {
      peakRanking = season.ranking;
    }
  }

  const lastSeason = state.seasons[state.seasons.length - 1] ?? null;

  return {
    seasonsPlayed: state.seasons.length,
    titles,
    slamTitles,
    peakRanking,
    retired: state.retired,
    retirementAge: state.retired && lastSeason ? lastSeason.age : null,
  };
}
