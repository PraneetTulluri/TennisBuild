import { ATTRIBUTE_KEYS } from "./attributes.js";
import { computeSurfaceStrength } from "./scoring.js";
import { pickDistinct } from "./wheel.js";

// Career simulation: takes a finished build's attributes and simulates a
// full career, one season at a time, from age 18 until retirement.
//
// Design: Grand Slams are simulated round-by-round (the player's own path
// through a 7-round bracket, not the whole draw), with the quarterfinal
// round onward played against real *currently active* players from the
// pool - not retired legends, since this is a simulation of the current
// tour. Individual opponents are never named in the output, though -
// naming a specific real player as "beaten" every year across a decade+
// career would imply they're frozen in time rather than aging themselves,
// which the simulation has no way to model. Masters 1000s and the rest of
// the regular tour are also simulated bracket-by-bracket (against generated
// opposition, not named real players) purely so season win/loss totals
// and title counts are accurate, without adding narrative clutter.
//
// Attributes scale over the career via an age curve (rise, peak, decline)
// rather than staying fixed, so careers have a real shape.

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

// ---------- Shared match model ----------

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

function rollMatch(attributes, opponentAttributes, surface) {
  const playerStrength = computeSurfaceStrength(attributes, surface);
  const opponentStrength = computeSurfaceStrength(opponentAttributes, surface);
  const probability = matchWinProbability(
    playerStrength,
    opponentStrength,
    attributes.mentalToughness,
    opponentAttributes.mentalToughness
  );
  return Math.random() < probability;
}

/** A generated opponent's attributes, jittered around a baseline strength - no name, since none is ever shown. */
function generateOpponentAttributes(baseline) {
  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    const jitter = (Math.random() - 0.5) * 16; // +/- 8
    attributes[key] = clamp(Math.round(baseline + jitter), 20, 90);
  }
  return attributes;
}

/** Currently active players only - this is a simulation of today's tour, not a mix of eras. */
function activePlayers(pool) {
  const active = pool.filter((p) => p.careerStatus === "active");
  return active.length >= 3 ? active : pool; // fallback for a small/test pool
}

// ---------- Grand Slams ----------

export const SLAM_CALENDAR = [
  { key: "australianOpen", label: "Australian Open", surface: "hard" },
  { key: "frenchOpen", label: "French Open", surface: "clay" },
  { key: "wimbledon", label: "Wimbledon", surface: "grass" },
  { key: "usOpen", label: "US Open", surface: "hard" },
];

// The player's own path through a 7-round bracket - R128 through the
// Final - not the full draw. Only the last 3 rounds face real, currently
// active players from the pool; earlier rounds face generated opponents,
// difficulty rising with the round.
const SLAM_ROUNDS = ["R128", "R64", "R32", "R16", "QF", "SF", "F"];
const REAL_OPPONENT_ROUNDS = new Set(["QF", "SF", "F"]);
const SLAM_JOURNEYMAN_BASELINE = { R128: 50, R64: 55, R32: 60, R16: 68 };

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

function simulateSlam(attributes, slam, playerPool) {
  const realOpponents = pickDistinct(activePlayers(playerPool), 3);
  let realOpponentIndex = 0;
  let wins = 0;

  for (const round of SLAM_ROUNDS) {
    const opponentAttributes = REAL_OPPONENT_ROUNDS.has(round)
      ? realOpponents[realOpponentIndex++].attributes
      : generateOpponentAttributes(SLAM_JOURNEYMAN_BASELINE[round]);

    if (!rollMatch(attributes, opponentAttributes, slam.surface)) {
      return {
        key: slam.key,
        label: slam.label,
        surface: slam.surface,
        result: round,
        wins,
      };
    }
    wins++;
  }

  return { key: slam.key, label: slam.label, surface: slam.surface, result: "W", wins };
}

// ---------- Masters 1000s and the rest of the tour ----------
//
// Simulated bracket-by-bracket like the Slams (so win/loss totals and
// title counts are grounded in the same per-round probability model,
// not a rough formula), but against generated opposition throughout -
// no real players, no per-event detail surfaced to the UI, since this
// is meant to represent the bulk of a season, not individual stories.

const MASTERS_ROUNDS = ["R64", "R32", "R16", "QF", "SF", "F"];
const MASTERS_BASELINE = { R64: 62, R32: 68, R16: 74, QF: 80, SF: 85, F: 88 };
const MASTERS_EVENTS_PER_SEASON = 9; // matches the real ATP Masters 1000 calendar

const TOUR_ROUNDS = ["R32", "R16", "QF", "SF", "F"];
const TOUR_BASELINE = { R32: 55, R16: 62, QF: 68, SF: 74, F: 78 };
const TOUR_EVENTS_PER_SEASON = 12; // a rough count of 250/500-level events a healthy full season includes

// Rough, simplified surface mix for non-Slam events (real ATP tour skews
// hard-court-heavy with clay and grass swings) - not an authentic
// calendar, just enough variety that surface-strong builds still get
// some benefit outside the Slams.
const EVENT_SURFACES = ["hard", "hard", "hard", "clay", "clay", "grass"];
function randomEventSurface() {
  return EVENT_SURFACES[Math.floor(Math.random() * EVENT_SURFACES.length)];
}

function simulateBracketEvent(attributes, rounds, baselineByRound) {
  const surface = randomEventSurface();
  let wins = 0;
  for (const round of rounds) {
    const opponentAttributes = generateOpponentAttributes(baselineByRound[round]);
    if (!rollMatch(attributes, opponentAttributes, surface)) {
      return { wins, champion: false };
    }
    wins++;
  }
  return { wins, champion: true };
}

function simulateNonSlamSeason(attributes) {
  let masterTitles = 0;
  let tourTitles = 0;
  let wins = 0;
  let losses = 0;
  let points = 0;

  for (let i = 0; i < MASTERS_EVENTS_PER_SEASON; i++) {
    const { wins: eventWins, champion } = simulateBracketEvent(
      attributes,
      MASTERS_ROUNDS,
      MASTERS_BASELINE
    );
    wins += eventWins;
    points += eventWins * 15 + (champion ? 400 : 0);
    if (champion) masterTitles++;
    else losses++;
  }

  for (let i = 0; i < TOUR_EVENTS_PER_SEASON; i++) {
    const { wins: eventWins, champion } = simulateBracketEvent(
      attributes,
      TOUR_ROUNDS,
      TOUR_BASELINE
    );
    wins += eventWins;
    points += eventWins * 8 + (champion ? 150 : 0);
    if (champion) tourTitles++;
    else losses++;
  }

  return { masterTitles, tourTitles, wins, losses, points };
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
 * the Masters/tour bracket sweep, combines everything into one accurate
 * season win/loss record and points total, derives a ranking, then rolls
 * whether next season happens at all.
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
  const nonSlam = simulateNonSlamSeason(seasonAttributes);

  const slamWins = slams.reduce((sum, slam) => sum + slam.wins, 0);
  const slamLosses = slams.reduce((sum, slam) => sum + (slam.result === "W" ? 0 : 1), 0);
  const slamTitles = slams.filter((slam) => slam.result === "W").length;
  const slamPoints = slams.reduce(
    (sum, slam) => sum + SLAM_RESULT_POINTS[slam.result],
    0
  );

  const seasonPoints = slamPoints + nonSlam.points;
  const ranking = pointsToRanking(seasonPoints);

  const season = {
    year: state.seasons.length + 1,
    age,
    ageFactor: factor,
    injury,
    slams,
    slamTitles,
    masterTitles: nonSlam.masterTitles,
    tourTitles: nonSlam.tourTitles,
    record: { wins: slamWins + nonSlam.wins, losses: slamLosses + nonSlam.losses },
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
  let slamTitles = 0;
  let masterTitles = 0;
  let tourTitles = 0;
  let wins = 0;
  let losses = 0;
  let peakRanking = null;

  for (const season of state.seasons) {
    slamTitles += season.slamTitles;
    masterTitles += season.masterTitles;
    tourTitles += season.tourTitles;
    wins += season.record.wins;
    losses += season.record.losses;
    if (peakRanking === null || season.ranking < peakRanking) {
      peakRanking = season.ranking;
    }
  }

  const lastSeason = state.seasons[state.seasons.length - 1] ?? null;

  return {
    seasonsPlayed: state.seasons.length,
    titles: slamTitles + masterTitles + tourTitles,
    slamTitles,
    masterTitles,
    tourTitles,
    careerRecord: { wins, losses },
    peakRanking,
    retired: state.retired,
    retirementAge: state.retired && lastSeason ? lastSeason.age : null,
  };
}
