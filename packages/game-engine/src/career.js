import { ATTRIBUTE_KEYS } from "./attributes.js";
import { computeSurfaceStrength } from "./scoring.js";

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
export function shouldRetire(age, retirementChanceDelta = 0) {
  if (age >= 38) return true;
  if (age < 30) return false;
  const factor = ageFactor(age);
  const baseChance = (age - 30) * 0.05;
  const declineChance = factor < 0.85 ? (1 - factor) * 0.6 : 0;
  const chance = Math.max(
    0,
    Math.min(0.92, baseChance + declineChance + retirementChanceDelta)
  );
  return Math.random() < chance;
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

/** A player's overall strength for seeding purposes - plain average across all 8 attributes. */
function strengthOf(player) {
  return (
    ATTRIBUTE_KEYS.reduce((sum, key) => sum + player.attributes[key], 0) /
    ATTRIBUTE_KEYS.length
  );
}

// How much of the active pool a real opponent can be drawn from, by round -
// shrinking to a narrower band of the pool's *strongest* players as the
// rounds get later. This is the fix for a build coasting to Slam titles it
// has no business winning: the active pool is ~45 players deep so wheel
// spins stay varied, but most of that depth is current-tour filler, not
// major contenders. Without this, a QF/SF/F opponent was drawn uniformly
// from the whole pool, so a mediocre build could easily draw (and beat) a
// filler pro in a Slam final instead of someone actually elite. A real
// Wimbledon final opponent is never a bottom-of-the-pool journeyman.
const REAL_OPPONENT_POOL_FRACTION = { QF: 0.4, SF: 0.18, F: 0.08 };
const REAL_OPPONENT_POOL_MIN = 3;

/** Draws one real, not-yet-used-this-slam opponent from the strength band appropriate to `round`. */
function pickRealOpponent(sortedActivePool, round, usedSlugs) {
  const bandSize = Math.max(
    REAL_OPPONENT_POOL_MIN,
    Math.round(sortedActivePool.length * REAL_OPPONENT_POOL_FRACTION[round])
  );
  const available = sortedActivePool.filter((p) => !usedSlugs.has(p.slug));
  const band = available.slice(0, bandSize);
  const candidates = band.length > 0 ? band : available;
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  usedSlugs.add(choice.slug);
  return choice;
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
  const sortedActive = [...activePlayers(playerPool)].sort(
    (a, b) => strengthOf(b) - strengthOf(a)
  );
  const usedSlugs = new Set();
  let wins = 0;

  for (const round of SLAM_ROUNDS) {
    const opponentAttributes = REAL_OPPONENT_ROUNDS.has(round)
      ? pickRealOpponent(sortedActive, round, usedSlugs).attributes
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
 * season's effective attributes take a mild hit. `injuryChanceDelta`
 * (from a career decision - see CAREER_DECISIONS below) shifts the odds
 * up or down, clamped so a decision alone can never guarantee or rule out
 * an injury outright.
 */
function maybeInjury(attributes, injuryChanceDelta = 0) {
  const intensity = (attributes.power + attributes.movement) / 2;
  const injuryChance = clamp(
    0.04 + (intensity / 99) * 0.08 + injuryChanceDelta,
    0.01,
    0.6
  );
  if (Math.random() < injuryChance) {
    return {
      description: "A mid-season injury forced time away from the tour.",
      impactMultiplier: 0.85,
    };
  }
  return null;
}

// ---------- Career decisions ----------
//
// A small, varied pool of offseason/preseason decisions offered before
// each simulated season - each a binary choice with a real, numeric
// tradeoff (a small attribute nudge for that season, and/or a shift in
// this season's injury odds or the next age check's retirement odds),
// not just flavor text. Only one is offered per season (see
// pickCareerDecision), so a career of several seasons naturally sees a
// different mix each time without needing an exhaustive catalog. Several
// options are deliberately framed as "specialize further" vs. "stay
// balanced" - a nod to the same specialist-vs-generalist tradeoff the
// archetype scoring model (see scoring.js/archetypes.js) already builds
// the whole game around.
export const CAREER_DECISIONS = [
  {
    id: "preseasonTraining",
    prompt: "Preseason: how do you want to prepare?",
    options: [
      {
        id: "grind",
        label: "Grind through a punishing fitness block",
        description: "+3 Power, +2 Movement this season - but a real injury risk.",
        attributeDelta: { power: 3, movement: 2 },
        injuryChanceDelta: 0.05,
      },
      {
        id: "measured",
        label: "Build up gradually and stay healthy",
        description: "+1 Power, +1 Movement - smaller gains, safer season.",
        attributeDelta: { power: 1, movement: 1 },
        injuryChanceDelta: -0.03,
      },
    ],
  },
  {
    id: "technicalOverhaul",
    prompt: "Offseason: what does the coaching team retool?",
    options: [
      {
        id: "groundstrokes",
        label: "Rebuild the forehand and backhand from scratch",
        description: "+3 Forehand, +3 Backhand - but -1 Serve while it beds in.",
        attributeDelta: { forehand: 3, backhand: 3, serve: -1 },
      },
      {
        id: "serve",
        label: "Leave the strokes alone, sharpen the serve",
        description: "+3 Serve, no downside - but a smaller total upgrade.",
        attributeDelta: { serve: 3 },
      },
    ],
  },
  {
    id: "newCoach",
    prompt: "A high-profile coach wants in. Do you make the change?",
    options: [
      {
        id: "hire",
        label: "Hire the demanding, high-intensity coach",
        description: "+2 Power, +2 Mental Toughness - but a tougher, riskier program.",
        attributeDelta: { power: 2, mentalToughness: 2 },
        injuryChanceDelta: 0.03,
      },
      {
        id: "stay",
        label: "Stick with your longtime team",
        description: "No stat change, but the stability lowers retirement risk.",
        attributeDelta: {},
        retirementChanceDelta: -0.02,
      },
    ],
  },
  {
    id: "sportsPsychologist",
    prompt: "Your team suggests bringing on a sports psychologist.",
    options: [
      {
        id: "hire",
        label: "Work with a sports psychologist",
        description: "+4 Mental Toughness this season.",
        attributeDelta: { mentalToughness: 4 },
      },
      {
        id: "skip",
        label: "Skip it, trust your instincts",
        description: "-1 Mental Toughness - old habits, for better or worse.",
        attributeDelta: { mentalToughness: -1 },
      },
    ],
  },
  {
    id: "schedulePhilosophy",
    prompt: "How aggressive should this season's schedule be?",
    options: [
      {
        id: "packed",
        label: "Play a packed schedule to stay sharp",
        description: "+2 Movement from match toughness - but real fatigue risk.",
        attributeDelta: { movement: 2 },
        injuryChanceDelta: 0.06,
      },
      {
        id: "light",
        label: "Prioritize rest between events",
        description: "-1 Movement, but noticeably lower injury risk.",
        attributeDelta: { movement: -1 },
        injuryChanceDelta: -0.05,
      },
    ],
  },
  {
    id: "recoveryRegimen",
    prompt: "Preseason: commit to an overhauled recovery regimen?",
    options: [
      {
        id: "commit",
        label: "Commit to a strict recovery regimen",
        description: "+1 Power, +1 Movement, and meaningfully lower injury risk.",
        attributeDelta: { power: 1, movement: 1 },
        injuryChanceDelta: -0.04,
      },
      {
        id: "asIs",
        label: "Keep doing what's always worked",
        description: "No change, no risk either way.",
        attributeDelta: {},
      },
    ],
  },
  {
    id: "altitudeCamp",
    prompt: "An altitude training camp opens up this offseason. Go?",
    options: [
      {
        id: "go",
        label: "Train at altitude for a fitness edge",
        description: "+3 Power, +3 Movement - but a demanding block, injury risk up.",
        attributeDelta: { power: 3, movement: 3 },
        injuryChanceDelta: 0.06,
      },
      {
        id: "skip",
        label: "Train at sea level, stay steady",
        description: "+1 Power - modest, low-risk.",
        attributeDelta: { power: 1 },
      },
    ],
  },
  {
    id: "netGameClinic",
    prompt: "Preseason: specialize further, or round out the game?",
    options: [
      {
        id: "specialize",
        label: "Spend the block on return and volley drills",
        description: "+3 Return, +3 Volley - but -1 Serve from the reduced reps.",
        attributeDelta: { return: 3, volley: 3, serve: -1 },
      },
      {
        id: "balanced",
        label: "Keep every part of the game sharp",
        description: "+1 to every attribute - smaller, but nothing left behind.",
        attributeDelta: {
          forehand: 1,
          backhand: 1,
          serve: 1,
          return: 1,
          volley: 1,
          movement: 1,
          power: 1,
          mentalToughness: 1,
        },
      },
    ],
  },
];

/**
 * Randomly offers one decision from the pool, avoiding an immediate
 * repeat of the previous season's decision (by id) so back-to-back
 * seasons don't feel identical when the pool happens to land on the same
 * one twice in a row.
 */
export function pickCareerDecision(excludePreviousId = null) {
  const pool = excludePreviousId
    ? CAREER_DECISIONS.filter((decision) => decision.id !== excludePreviousId)
    : CAREER_DECISIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Bundles a chosen option with its parent decision's prompt text, in the
 * shape simulateNextSeason expects as its third argument - keeps that
 * shape defined in one place rather than every caller re-assembling it.
 */
export function resolveDecisionChoice(decision, option) {
  return { ...option, decisionPrompt: decision.prompt };
}

/** Applies a decision's attribute nudges on top of a season's effective attributes. */
function applyAttributeDelta(attributes, delta) {
  if (!delta) return attributes;
  const result = { ...attributes };
  for (const key of ATTRIBUTE_KEYS) {
    if (delta[key]) {
      result[key] = clamp(Math.round(result[key] + delta[key]), 1, 99);
    }
  }
  return result;
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
 *
 * `decisionOption` is optional - one of a CAREER_DECISIONS option objects
 * (see above), typically whichever one the player picked via
 * pickCareerDecision. When present, its attributeDelta/injuryChanceDelta/
 * retirementChanceDelta nudge this season (and the retirement roll after
 * it); when omitted the season plays out exactly as before.
 */
export function simulateNextSeason(state, playerPool, decisionOption = null) {
  if (state.retired) {
    throw new Error(
      "Cannot simulate a season: this career has already ended in retirement"
    );
  }

  const age = state.age;
  const factor = ageFactor(age);
  let baseEffective = scaleAttributes(state.baseAttributes, factor);
  if (decisionOption?.attributeDelta) {
    baseEffective = applyAttributeDelta(baseEffective, decisionOption.attributeDelta);
  }
  const injury = maybeInjury(baseEffective, decisionOption?.injuryChanceDelta ?? 0);
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
    decisionPrompt: decisionOption ? decisionOption.decisionPrompt : null,
    decisionChoice: decisionOption ? decisionOption.label : null,
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
    retired: shouldRetire(nextAge, decisionOption?.retirementChanceDelta ?? 0),
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
  // Per-tournament Slam win counts (e.g. how many Wimbledons), for a
  // trophy-case style display - not just the combined Slam total.
  const slamTitlesByKey = Object.fromEntries(SLAM_CALENDAR.map((slam) => [slam.key, 0]));

  for (const season of state.seasons) {
    slamTitles += season.slamTitles;
    masterTitles += season.masterTitles;
    tourTitles += season.tourTitles;
    wins += season.record.wins;
    losses += season.record.losses;
    if (peakRanking === null || season.ranking < peakRanking) {
      peakRanking = season.ranking;
    }
    for (const slam of season.slams) {
      if (slam.result === "W") slamTitlesByKey[slam.key]++;
    }
  }

  const lastSeason = state.seasons[state.seasons.length - 1] ?? null;

  return {
    seasonsPlayed: state.seasons.length,
    titles: slamTitles + masterTitles + tourTitles,
    slamTitles,
    slamTitlesByKey,
    masterTitles,
    tourTitles,
    careerRecord: { wins, losses },
    peakRanking,
    retired: state.retired,
    retirementAge: state.retired && lastSeason ? lastSeason.age : null,
  };
}
