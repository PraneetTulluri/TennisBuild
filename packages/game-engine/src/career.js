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
// Season-to-season shape is player-driven, not a fixed age curve: each
// season the player sets a training-intensity and schedule-intensity
// slider (0-100), which trade attribute growth and title opportunities
// against injury risk - see the "Sliders" and "Attribute drift" sections
// below. Attributes start at exactly what the draft produced (no
// automatic discount for being young) and drift up or down afterward
// based on age, those slider choices, how the season actually went, and
// injuries - so two careers from the same build can end up completely
// different depending on how it's managed. Retirement is the player's
// own call every season (see retireNow) rather than a dice roll, with a
// Legacy Score - not just raw totals - deciding the final GOAT ranking:
// retiring while still near your peak locks in a bonus, while grinding
// through a bad decline season costs you. The only *forced* endings are
// a hard age cap and a rare career-ending injury (more likely the harder
// training/schedule has been pushed) - so it's possible to play deep into
// your 40s like a handful of real greats, or flame out at 29.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ---------- Attribute drift ----------
//
// How a season nudges the player's *actual* attributes going into the
// next one - additive, not a multiplier, and applied uniformly across
// all 8 attributes for simplicity. This is what replaces the old fixed
// age-curve: a young player still trends upward by default, a player in
// their 30s trends downward by default, but training intensity, how the
// season actually went, and injuries all shift that up or down - a
// well-managed veteran can keep growing well past a real player's
// typical peak, and a recklessly pushed young player can start
// declining early.

/** The age-driven default trend, before training/outcome/injury adjust it. */
function ageDriftBias(age) {
  if (age <= 21) return 2.0;
  if (age <= 24) return 1.0;
  if (age <= 27) return 0;
  if (age <= 30) return -0.5;
  if (age <= 33) return -1.5;
  if (age <= 36) return -2.5;
  return -4.0;
}

/** Harder training pushes growth higher, but undertraining lets sharpness slip. */
function trainingDriftBonus(trainingIntensity) {
  return (trainingIntensity / 100) * 2.8 - 1.2;
}

/** A strong season builds confidence/form; a real decline off a prior peak erodes it. */
function outcomeDriftBonus(ranking, priorPeakRanking) {
  if (priorPeakRanking === null) return 0;
  if (ranking <= 10) return 1.2;
  if (ranking <= 30) return 0.5;
  if (ranking > priorPeakRanking * 2.5 || ranking > 150) return -1.5;
  if (ranking > priorPeakRanking * 1.5 || ranking > 80) return -0.5;
  return 0;
}

function computeAttributeDrift({
  age,
  trainingIntensity,
  ranking,
  priorPeakRanking,
  injured,
}) {
  const noise = (Math.random() - 0.5) * 2; // +/- 1, keeps outcomes from feeling too formulaic
  const total =
    ageDriftBias(age) +
    trainingDriftBonus(trainingIntensity) +
    outcomeDriftBonus(ranking, priorPeakRanking) +
    (injured ? -4 : 0) +
    noise;
  return Math.round(total);
}

/** Applies a flat drift amount to every attribute, clamped to the roster's real range (1-110). */
function applyDrift(attributes, drift) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) {
    result[key] = clamp(attributes[key] + drift, 1, 110);
  }
  return result;
}

/** A one-season dip from playing hurt - temporary, doesn't affect the attributes carried into next season. */
function applyInjuryImpact(attributes, multiplier) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) {
    result[key] = clamp(Math.round(attributes[key] * multiplier), 1, 110);
  }
  return result;
}

// ---------- Sliders ----------
//
// The two levers the player sets before each season - both 0-100.
// Training intensity trades attribute growth against injury risk;
// schedule intensity trades how many events get entered (more Slams
// aren't affected, but Masters/tour depth is) against fatigue. Both are
// meant to be re-set every season, not locked in once - the whole point
// is being able to train lighter and play a lighter schedule once age
// starts working against you.
export const DEFAULT_SLIDERS = { trainingIntensity: 50, scheduleIntensity: 50 };

function eventCountsForSchedule(scheduleIntensity) {
  return {
    masters: Math.round(3 + (scheduleIntensity / 100) * 6), // 3-9, real ATP calendar tops out at 9
    tour: Math.round(4 + (scheduleIntensity / 100) * 8), // 4-12
  };
}

function seasonInjuryChance({ attributes, trainingIntensity, scheduleIntensity, age }) {
  const physicalIntensity = (attributes.power + attributes.movement) / 2;
  const base = 0.03 + (physicalIntensity / 99) * 0.05;
  const trainingRisk = Math.pow(trainingIntensity / 100, 1.5) * 0.12;
  const scheduleRisk = Math.pow(scheduleIntensity / 100, 1.5) * 0.1;
  const ageRisk = Math.max(0, (age - 30) * 0.008);
  return clamp(base + trainingRisk + scheduleRisk + ageRisk, 0.02, 0.55);
}

/**
 * The odds that *this season's* injury turns out to be career-ending -
 * only rolled when an injury has already happened. Rises with how many
 * injuries have already piled up and with how hard training/schedule
 * have been pushed, which is what makes "flame out young" a real,
 * chosen-into outcome rather than pure bad luck.
 */
function catastrophicInjuryChance({
  injuryCountSoFar,
  trainingIntensity,
  scheduleIntensity,
}) {
  return Math.min(
    0.28,
    injuryCountSoFar * 0.03 +
      (trainingIntensity / 100) * 0.06 +
      (scheduleIntensity / 100) * 0.045
  );
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
// How many of each get entered now comes from the schedule-intensity
// slider (see eventCountsForSchedule) instead of a fixed count.

const MASTERS_ROUNDS = ["R64", "R32", "R16", "QF", "SF", "F"];
const MASTERS_BASELINE = { R64: 70, R32: 76, R16: 82, QF: 87, SF: 91, F: 94 };

const TOUR_ROUNDS = ["R32", "R16", "QF", "SF", "F"];
const TOUR_BASELINE = { R32: 62, R16: 70, QF: 76, SF: 82, F: 86 };

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

function simulateNonSlamSeason(attributes, eventCounts) {
  let masterTitles = 0;
  let tourTitles = 0;
  let wins = 0;
  let losses = 0;
  let points = 0;

  for (let i = 0; i < eventCounts.masters; i++) {
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

  for (let i = 0; i < eventCounts.tour; i++) {
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

// ---------- Legacy score ----------
//
// What actually decides the final GOAT ranking (see goat.js) - not just
// raw career totals. Accrues every season (mirroring the same per-title/
// per-peak-ranking weights goat.js uses for the real-legend benchmarks,
// so simulated careers and real ones are being measured on the same
// scale), but a season that clearly craters relative to the career's
// established peak costs Legacy - hanging on too long into a bad decline
// tarnishes it. Retiring voluntarily while still near that peak (see
// retireNow) locks in a bonus instead.

function peakRankingBonus(ranking) {
  if (ranking === 1) return 150;
  if (ranking <= 3) return 80;
  if (ranking <= 10) return 30;
  if (ranking <= 20) return 10;
  return 0;
}

function seasonLegacyGain(season) {
  const titleWeight =
    season.slamTitles * 100 +
    season.masterTitles * 15 +
    (season.slamTitles + season.masterTitles + season.tourTitles) * 2;
  return titleWeight + peakRankingBonus(season.ranking) / 5 + 3;
}

/** A real decline off the career's established peak - not just a merely-okay season. */
function declinePenalty(ranking, priorPeakRanking) {
  if (priorPeakRanking === null) return 0;
  if (ranking > priorPeakRanking * 3 || ranking > 200) return 40;
  if (ranking > priorPeakRanking * 1.8 || ranking > 100) return 15;
  return 0;
}

// ---------- Career state (mirrors draft.js's pure-state-machine pattern) ----------

/** Starts a new career at age 18 with exactly the drafted attributes - no automatic "too young" discount. */
export function createCareerState(baseAttributes) {
  return {
    baseAttributes,
    currentAttributes: { ...baseAttributes },
    age: 18,
    retired: false,
    retirementReason: null, // null | "voluntary" | "career-ending-injury" | "age-limit"
    retiredOnTop: false,
    legacyScore: 0,
    seasons: [],
  };
}

const HARD_AGE_CAP = 44;

/**
 * Simulates one more season and appends it to the career, using the
 * player's *current* attributes (not a fixed age-curve recalculation of
 * the original draft) as this season's baseline strength. `sliders`
 * (training/schedule intensity, both 0-100) are set fresh for this call -
 * the UI is expected to let the player adjust them before every season.
 *
 * The career only ends here two ways: a hard age cap (44) or a rare
 * career-ending injury, whose odds rise with accumulated injuries and
 * how hard training/schedule have been pushed. Otherwise the season just
 * plays out and `retired` stays false - ending the career the rest of
 * the time is the player's own call (see retireNow).
 */
export function simulateNextSeason(state, playerPool, sliders = DEFAULT_SLIDERS) {
  if (state.retired) {
    throw new Error(
      "Cannot simulate a season: this career has already ended in retirement"
    );
  }

  const age = state.age;
  const { trainingIntensity, scheduleIntensity } = sliders;

  const injuryChance = seasonInjuryChance({
    attributes: state.currentAttributes,
    trainingIntensity,
    scheduleIntensity,
    age,
  });
  const injured = Math.random() < injuryChance;
  const injury = injured
    ? {
        description: "A mid-season injury forced time away from the tour.",
        careerEnding: false,
      }
    : null;
  const seasonAttributes = injured
    ? applyInjuryImpact(state.currentAttributes, 0.85)
    : state.currentAttributes;

  const slams = SLAM_CALENDAR.map((slam) =>
    simulateSlam(seasonAttributes, slam, playerPool)
  );
  const eventCounts = eventCountsForSchedule(scheduleIntensity);
  const nonSlam = simulateNonSlamSeason(seasonAttributes, eventCounts);

  const slamWins = slams.reduce((sum, slam) => sum + slam.wins, 0);
  const slamLosses = slams.reduce((sum, slam) => sum + (slam.result === "W" ? 0 : 1), 0);
  const slamTitles = slams.filter((slam) => slam.result === "W").length;
  const slamPoints = slams.reduce(
    (sum, slam) => sum + SLAM_RESULT_POINTS[slam.result],
    0
  );

  const seasonPoints = slamPoints + nonSlam.points;
  const ranking = pointsToRanking(seasonPoints);

  const priorPeakRanking =
    state.seasons.length > 0 ? Math.min(...state.seasons.map((s) => s.ranking)) : null;

  const season = {
    year: state.seasons.length + 1,
    age,
    attributes: seasonAttributes,
    trainingIntensity,
    scheduleIntensity,
    injury,
    slams,
    slamTitles,
    masterTitles: nonSlam.masterTitles,
    tourTitles: nonSlam.tourTitles,
    record: { wins: slamWins + nonSlam.wins, losses: slamLosses + nonSlam.losses },
    seasonPoints,
    ranking,
  };

  let legacyGain = seasonLegacyGain(season) - declinePenalty(ranking, priorPeakRanking);

  const nextAge = age + 1;
  let forcedRetired = false;
  let retirementReason = null;

  if (injured) {
    const injuryCountSoFar = state.seasons.filter((s) => s.injury).length;
    const catastrophicChance = catastrophicInjuryChance({
      injuryCountSoFar,
      trainingIntensity,
      scheduleIntensity,
    });
    if (Math.random() < catastrophicChance) {
      forcedRetired = true;
      retirementReason = "career-ending-injury";
      season.injury.careerEnding = true;
      // A real cost, not just a neutral early stop - unfulfilled
      // potential is part of what makes recklessness a genuine risk
      // rather than a strictly-dominant "grow fast, worst case is just
      // stopping early" strategy.
      legacyGain -= 80;
    }
  }

  if (!forcedRetired && nextAge >= HARD_AGE_CAP) {
    forcedRetired = true;
    retirementReason = "age-limit";
  }

  const nextLegacyScore = state.legacyScore + legacyGain;

  const drift = computeAttributeDrift({
    age,
    trainingIntensity,
    ranking,
    priorPeakRanking,
    injured,
  });
  const nextCurrentAttributes = applyDrift(state.currentAttributes, drift);

  return {
    ...state,
    age: nextAge,
    currentAttributes: nextCurrentAttributes,
    retired: forcedRetired,
    retirementReason: forcedRetired ? retirementReason : state.retirementReason,
    legacyScore: nextLegacyScore,
    seasons: [...state.seasons, season],
  };
}

/**
 * Ends the career on the player's own terms. Retiring while this
 * season's ranking is still close to the career's best-ever ranking so
 * far counts as "retiring on top" - a Legacy Score bonus that a forced
 * ending (age cap, injury) never gets, rewarding the judgment call of
 * walking away before a real decline sets in rather than chasing one
 * season too many.
 */
export function retireNow(state) {
  if (state.retired) {
    throw new Error("This career has already ended in retirement");
  }
  if (state.seasons.length === 0) {
    throw new Error("Cannot retire before playing at least one season");
  }

  const lastSeason = state.seasons[state.seasons.length - 1];
  const peakRanking = Math.min(...state.seasons.map((s) => s.ranking));
  const retiredOnTop = lastSeason.ranking <= Math.max(10, peakRanking * 1.5);
  const bonus = retiredOnTop ? 60 : 0;

  return {
    ...state,
    retired: true,
    retirementReason: "voluntary",
    retiredOnTop,
    legacyScore: state.legacyScore + bonus,
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
    retirementReason: state.retirementReason,
    retiredOnTop: state.retiredOnTop,
    legacyScore: Math.max(0, Math.round(state.legacyScore)),
  };
}
