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
// against injury risk - see the "Sliders" and "Attribute development &
// decline" sections below. The draft is a *potential ceiling*, not a
// starting point - actual attributes start below it (a talented but
// still-developing 18-year-old) and close that gap over the early
// career at a training-driven pace, so a great draft still means real,
// if limited, success young rather than either immediate dominance or
// years of being unremarkable. Decline eventually sets in - not at a
// fixed age, but earlier the more consistently hard training has been
// pushed across the career, later for a more conservative one. Two
// careers from the same build can end up completely different
// depending entirely on how it's managed. Retirement is the player's
// own call every season (see retireNow) rather than a dice roll, with a
// Legacy Score - not just raw totals - deciding the final GOAT ranking:
// retiring while still near your peak locks in a bonus, while grinding
// through a bad decline season costs you. The only *forced* endings are
// a hard age cap and a rare career-ending injury (more likely the harder
// training/schedule has been pushed) - so it's possible to play deep into
// your 40s like a handful of real greats, or flame out at 29. A sparse,
// random pool of life events (see LIFE_EVENTS) adds narrative texture on
// top of all this - most seasons have none, but every so often something
// - good, bad, or just funny - shows up and nudges the season a little.
//
// Injury risk is age-scaled, not just slider-scaled (see
// seasonInjuryChance): the same training/schedule intensity is a much
// safer bet at 19 than at 34, so going all-out young and tapering off
// later is a real, rewarded strategy rather than a uniform risk the whole
// career. Coming back at the same intensity right after an injury carries
// its own surcharge (recoveryRiskBump) - backing sliders off first is
// what the game actually wants you to do. A well-managed, conservative
// career can also push decline onset out to the late 30s (see
// declineOnsetAge), so a genuine late-career prime is a reachable reward
// for good management, not just a rare fluke. simulateFullCareer runs all
// of this unattended with a sensible autopilot, for a "quick sim" straight
// to a final result instead of setting sliders every season by hand.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ---------- Attribute development & decline ----------
//
// The drafted attributes are a *potential ceiling*, not a starting
// point - a player this good doesn't show up fully formed at 18. Actual
// current attributes start noticeably below that ceiling and close the
// gap season by season while developing, so a loaded draft still means
// real (if limited) success early rather than either immediate
// dominance or several years of being nothing special. Training
// intensity controls how fast that gap closes. Once a player crosses
// into decline, the same attributes drift back down from wherever they
// peaked - and *when* decline starts isn't fixed at 30: it moves earlier
// the more consistently hard training has been pushed across the
// career, later for a more conservatively managed one.
const START_POTENTIAL_FRACTION = 0.75;

/** How much of the remaining gap to potential closes this season - training-driven. */
function developmentCloseFraction(trainingIntensity) {
  return 0.15 + (trainingIntensity / 100) * 0.25; // 0.15 - 0.40
}

/**
 * The age decline starts at, given the average training intensity
 * across every season played so far - averaging 100 intensity the whole
 * career pulls decline in years earlier than averaging a light, careful
 * load. Widened at the top end (37, not 34) so a genuinely conservative,
 * well-managed career can stay in its prime deep into its 30s, the way a
 * handful of real greats have - late-career success is meant to be a
 * real, reachable reward for smart management, not just a rare fluke.
 */
function declineOnsetAge(avgTrainingIntensitySoFar) {
  return clamp(31 - (avgTrainingIntensitySoFar - 50) / 7, 24, 37);
}

/** How much attributes fall this season once past decline onset - training still helps meaningfully, but risk lives in the injury odds instead. */
function declineAmount(age, onsetAge, trainingIntensity) {
  const yearsPast = age - onsetAge;
  const base = -(1.1 + yearsPast * 0.24);
  const trainingOffset = ((trainingIntensity / 100) * 2.8 - 1.0) * 0.45;
  return base + trainingOffset;
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

/**
 * Computes next season's currentAttributes directly (not a flat delta -
 * each attribute closes its own gap to its own potential at its own
 * pace). `potentialAttributes` is the drafted build (the ceiling);
 * `currentAttributes` is where the player actually is right now.
 */
function developAttributes({
  currentAttributes,
  potentialAttributes,
  age,
  trainingIntensity,
  ranking,
  priorPeakRanking,
  injured,
  avgTrainingIntensitySoFar,
}) {
  const onsetAge = declineOnsetAge(avgTrainingIntensitySoFar);
  const developing = age < onsetAge;
  const outcome = outcomeDriftBonus(ranking, priorPeakRanking);

  const result = {};
  for (const key of ATTRIBUTE_KEYS) {
    const noise = (Math.random() - 0.5) * 1.5;
    if (developing) {
      if (injured) {
        result[key] = clamp(Math.round(currentAttributes[key] + noise - 1), 1, 110);
        continue;
      }
      const gap = potentialAttributes[key] - currentAttributes[key];
      const progress = gap * developmentCloseFraction(trainingIntensity);
      result[key] = clamp(
        Math.round(currentAttributes[key] + progress + outcome * 0.5 + noise),
        1,
        110
      );
    } else {
      const decline = declineAmount(age, onsetAge, trainingIntensity);
      result[key] = clamp(
        Math.round(
          currentAttributes[key] + decline + outcome * 0.3 + (injured ? -1.5 : 0) + noise
        ),
        1,
        110
      );
    }
  }
  return { attributes: result, onsetAge, developing };
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

/**
 * How much an injury the *previous* season should still weigh on this
 * season's risk. Coming back at the same intensity you got hurt at is
 * genuinely riskier; backing both sliders off meaningfully first - the
 * "adjust it lower coming off an injury" the sliders are meant to model -
 * removes the surcharge almost entirely, and backing off a lot is treated
 * as a smart, careful return.
 */
function recoveryRiskBump(lastSeason, trainingIntensity, scheduleIntensity) {
  if (!lastSeason?.injury) return 0;
  const easedBy =
    Math.max(0, lastSeason.trainingIntensity - trainingIntensity) +
    Math.max(0, lastSeason.scheduleIntensity - scheduleIntensity);
  if (easedBy >= 25) return -0.02;
  if (easedBy >= 10) return 0.01;
  return 0.06;
}

/**
 * Injury odds scale with age, not just the sliders - a teenager training
 * and playing flat-out carries real but modest risk, the same intensity
 * in your mid-30s is a genuinely different bet. This is what makes "go
 * hard while young, dial it back once age works against you" an actual
 * lever rather than flavor text: the same slider settings mean different
 * things depending on when you use them.
 */
function seasonInjuryChance({
  attributes,
  trainingIntensity,
  scheduleIntensity,
  age,
  lastSeason,
}) {
  const physicalIntensity = (attributes.power + attributes.movement) / 2;
  const base = 0.02 + (physicalIntensity / 99) * 0.03;
  const ageRiskMultiplier = clamp(0.55 + (age - 18) * 0.035, 0.55, 1.5);
  const trainingRisk = Math.pow(trainingIntensity / 100, 1.5) * 0.08 * ageRiskMultiplier;
  const scheduleRisk = Math.pow(scheduleIntensity / 100, 1.5) * 0.065 * ageRiskMultiplier;
  const ageRisk = Math.max(0, (age - 32) * 0.006);
  const recovery = recoveryRiskBump(lastSeason, trainingIntensity, scheduleIntensity);
  return clamp(base + trainingRisk + scheduleRisk + ageRisk + recovery, 0.015, 0.4);
}

/**
 * The odds that *this season's* injury turns out to be career-ending -
 * only rolled when an injury has already happened. Rises with how many
 * injuries have already piled up and with how hard training/schedule
 * have been pushed, which is what makes "flame out young" a real,
 * chosen-into outcome rather than pure bad luck - but stays rare enough
 * overall that most injuries are just a rough season, not the end.
 */
function catastrophicInjuryChance({
  injuryCountSoFar,
  trainingIntensity,
  scheduleIntensity,
}) {
  return Math.min(
    0.2,
    injuryCountSoFar * 0.02 +
      (trainingIntensity / 100) * 0.045 +
      (scheduleIntensity / 100) * 0.035
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

/** A real decline off the career's established peak - not just a merely-okay season. */
function declinePenalty(ranking, priorPeakRanking) {
  if (priorPeakRanking === null) return 0;
  if (ranking > priorPeakRanking * 3 || ranking > 200) return 40;
  if (ranking > priorPeakRanking * 1.8 || ranking > 100) return 15;
  return 0;
}

/**
 * Builds this season's Legacy Score change as a labeled breakdown, not
 * just a single number - the UI shows this as a live ticker so a season
 * that swings Legacy up or down is legible in the moment, not just a
 * final total at retirement. Every entry with a nonzero amount is
 * included; the season's net `legacyDelta` is just their sum.
 */
function buildLegacyBreakdown(season, priorPeakRanking) {
  const entries = [];
  if (season.slamTitles > 0) {
    entries.push({ label: "Grand Slam Titles", amount: season.slamTitles * 102 });
  }
  if (season.masterTitles > 0) {
    entries.push({ label: "Masters Titles", amount: season.masterTitles * 17 });
  }
  if (season.tourTitles > 0) {
    entries.push({ label: "Tour Titles", amount: season.tourTitles * 2 });
  }
  const rankingBonus = Math.round(peakRankingBonus(season.ranking) / 5);
  if (rankingBonus > 0) {
    entries.push({ label: "Ranking Bonus", amount: rankingBonus });
  }
  entries.push({ label: "Season Played", amount: 3 });
  const decline = declinePenalty(season.ranking, priorPeakRanking);
  if (decline > 0) {
    entries.push({ label: "Decline Off Peak", amount: -decline });
  }
  if (season.injury?.careerEnding) {
    entries.push({ label: "Career-Ending Injury", amount: -80 });
  }
  return entries;
}

// ---------- Life events ----------
//
// A sparse, random pool of off-court narrative moments - not a strategic
// lever like the sliders, just texture that makes one simulated career
// feel different from the next. Only offered some of the time (see
// LIFE_EVENT_CHANCE, checked by the UI before calling pickLifeEvent) and
// each is a binary choice with a small, real effect - a modest attribute
// nudge and/or a direct Legacy Score adjustment - never anything as
// large as a Slam title's worth of Legacy. Deliberately a mix of
// wholesome, dramatic, and funny, the way an actual life spent mostly on
// an airplane between tournaments would be.
export const LIFE_EVENTS = [
  {
    id: "breakup",
    prompt: "A long relationship ends mid-season, blindsided by the travel schedule.",
    options: [
      {
        id: "bury",
        label: "Bury yourself in training to cope",
        description: "+3 Power, +2 Movement - but -5 Mental Toughness this season.",
        attributeDelta: { power: 3, movement: 2, mentalToughness: -5 },
      },
      {
        id: "process",
        label: "Take real time to process it",
        description: "-2 Mental Toughness now, but a small Legacy bump for the growth.",
        attributeDelta: { mentalToughness: -2 },
        legacyDelta: 8,
      },
    ],
  },
  {
    id: "newRelationship",
    prompt: "A new relationship starts, and it is going well.",
    options: [
      {
        id: "balance",
        label: "Let it steady you",
        description: "+5 Mental Toughness from the stability.",
        attributeDelta: { mentalToughness: 5 },
      },
      {
        id: "distracted",
        label: "Admit the travel makes it complicated",
        description: "+2 Mental Toughness, smaller but no downside.",
        attributeDelta: { mentalToughness: 2 },
      },
    ],
  },
  {
    id: "newborn",
    prompt: "You and your partner welcome a first child this offseason.",
    options: [
      {
        id: "home",
        label: "Cut the offseason short to be home",
        description:
          "+5 Mental Toughness from the perspective shift - but -2 Power, -2 Movement from lost training time.",
        attributeDelta: { mentalToughness: 5, power: -2, movement: -2 },
      },
      {
        id: "grind",
        label: "Stick to the training block, video-call every night",
        description: "No stat change - but a Legacy hit for missing the moment.",
        attributeDelta: {},
        legacyDelta: -15,
      },
    ],
  },
  {
    id: "kidsOnTour",
    prompt: "Your kids join the tour for the summer swing.",
    options: [
      {
        id: "present",
        label: "Make every free hour about them",
        description: "+5 Mental Toughness - but -2 Power from the lighter training load.",
        attributeDelta: { mentalToughness: 5, power: -2 },
      },
      {
        id: "focused",
        label: "Keep the routine tight, family time in the margins",
        description: "+2 Power, +2 Movement - but -2 Mental Toughness.",
        attributeDelta: { power: 2, movement: 2, mentalToughness: -2 },
      },
    ],
  },
  {
    id: "viralMoment",
    prompt: "A trick shot from your last match goes viral overnight.",
    options: [
      {
        id: "lean-in",
        label: "Lean into the spotlight",
        description:
          "+3 Mental Toughness from the confidence boost - small Legacy bump too.",
        attributeDelta: { mentalToughness: 3 },
        legacyDelta: 8,
      },
      {
        id: "ignore",
        label: "Mute the notifications and get back to work",
        description: "+2 Power, +2 Movement from the extra focus.",
        attributeDelta: { power: 2, movement: 2 },
      },
    ],
  },
  {
    id: "rivalFeud",
    prompt: "A public war of words breaks out with a rival on tour.",
    options: [
      {
        id: "fuel",
        label: "Use it as motivation",
        description: "+3 Mental Toughness, +2 Power.",
        attributeDelta: { mentalToughness: 3, power: 2 },
      },
      {
        id: "rise-above",
        label: "Refuse to engage publicly",
        description: "+5 Mental Toughness from the composure - a modest Legacy bump.",
        attributeDelta: { mentalToughness: 5 },
        legacyDelta: 8,
      },
    ],
  },
  {
    id: "codeViolation",
    prompt: "A blown call sparks a heated code-violation controversy.",
    options: [
      {
        id: "blow-up",
        label: "Let it all out on camera",
        description:
          "-5 Mental Toughness this season - and a Legacy hit for the headlines.",
        attributeDelta: { mentalToughness: -5 },
        legacyDelta: -12,
      },
      {
        id: "cold",
        label: "Stay ice-cold and let the racquet do the talking",
        description: "+5 Mental Toughness.",
        attributeDelta: { mentalToughness: 5 },
      },
    ],
  },
  {
    id: "sponsorWindfall",
    prompt: "A major new sponsor comes in with a life-changing deal.",
    options: [
      {
        id: "reinvest",
        label: "Reinvest it all into your training team",
        description: "+3 Power, +3 Movement.",
        attributeDelta: { power: 3, movement: 3 },
      },
      {
        id: "enjoy",
        label: "Actually enjoy some of it for once",
        description: "+3 Mental Toughness from the peace of mind.",
        attributeDelta: { mentalToughness: 3 },
      },
    ],
  },
  {
    id: "sponsorDrop",
    prompt: "A sponsor quietly drops you after a rough stretch of results.",
    options: [
      {
        id: "chip",
        label: "Let it put a chip on your shoulder",
        description: "+3 Mental Toughness, +2 Power - proving them wrong.",
        attributeDelta: { mentalToughness: 3, power: 2 },
      },
      {
        id: "sting",
        label: "Admit it stings more than expected",
        description: "-3 Mental Toughness this season.",
        attributeDelta: { mentalToughness: -3 },
      },
    ],
  },
  {
    id: "documentaryCrew",
    prompt: "A documentary crew starts following you for a season-long feature.",
    options: [
      {
        id: "open",
        label: "Let them in completely",
        description:
          "+3 Mental Toughness from the accountability - a Legacy bump for the story it tells.",
        attributeDelta: { mentalToughness: 3 },
        legacyDelta: 12,
      },
      {
        id: "guarded",
        label: "Keep them at arm's length",
        description: "No stat change, no risk either way.",
        attributeDelta: {},
      },
    ],
  },
  {
    id: "mentorYoungster",
    prompt: "A teenage prospect asks you to be an informal mentor.",
    options: [
      {
        id: "yes",
        label: "Take them under your wing",
        description:
          "+3 Mental Toughness from the perspective - a Legacy bump for giving back.",
        attributeDelta: { mentalToughness: 3 },
        legacyDelta: 15,
      },
      {
        id: "no",
        label: "Stay focused on your own career for now",
        description: "+2 Power, +2 Movement from the undivided focus.",
        attributeDelta: { power: 2, movement: 2 },
      },
    ],
  },
  {
    id: "familyHealthScare",
    prompt: "A health scare in the family pulls your focus away from the tour.",
    options: [
      {
        id: "go-home",
        label: "Drop everything and go home",
        description:
          "-3 Power, -3 Movement this season from the lost training time - a Legacy bump for the choice.",
        attributeDelta: { power: -3, movement: -3 },
        legacyDelta: 9,
      },
      {
        id: "stay",
        label: "Stay on tour, support from a distance",
        description: "-3 Mental Toughness from the guilt.",
        attributeDelta: { mentalToughness: -3 },
      },
    ],
  },
  {
    id: "newCoachChemistry",
    prompt:
      "A new coach brings a completely different philosophy - and real early friction.",
    options: [
      {
        id: "trust",
        label: "Trust the process anyway",
        description:
          "+3 Forehand, +3 Backhand - but -2 Mental Toughness through the adjustment.",
        attributeDelta: { forehand: 3, backhand: 3, mentalToughness: -2 },
      },
      {
        id: "part-ways",
        label: "Part ways before it goes further",
        description: "No stat change, no risk either way.",
        attributeDelta: {},
      },
    ],
  },
  {
    id: "equipmentSwitch",
    prompt: "A boutique racquet brand offers a wildly lucrative equipment deal.",
    options: [
      {
        id: "switch",
        label: "Make the switch",
        description: "+5 Power - but -3 Forehand, -3 Backhand while adjusting.",
        attributeDelta: { power: 5, forehand: -3, backhand: -3 },
      },
      {
        id: "loyal",
        label: "Stay loyal to what has always worked",
        description: "No stat change, no risk either way.",
        attributeDelta: {},
      },
    ],
  },
  {
    id: "hometownParade",
    prompt: "Your hometown throws a parade after your best season yet.",
    options: [
      {
        id: "soak-in",
        label: "Soak it all in",
        description:
          "+5 Mental Toughness - and a real Legacy bump for what it means back home.",
        attributeDelta: { mentalToughness: 5 },
        legacyDelta: 15,
      },
      {
        id: "back-to-work",
        label: "Thank everyone briefly and get back to training",
        description: "+2 Power, +2 Movement from staying locked in.",
        attributeDelta: { power: 2, movement: 2 },
      },
    ],
  },
  {
    id: "bettingRumor",
    prompt:
      "An anonymous, unfounded match-fixing rumor spreads online before quickly being debunked.",
    options: [
      {
        id: "shake-off",
        label: "Shake it off and stay focused",
        description: "+3 Mental Toughness from the resilience.",
        attributeDelta: { mentalToughness: 3 },
      },
      {
        id: "rattled",
        label: "Admit it got under your skin more than it should have",
        description: "-3 Mental Toughness this season.",
        attributeDelta: { mentalToughness: -3 },
      },
    ],
  },
  {
    id: "fashionIcon",
    prompt: "A bold on-court outfit choice makes you a minor fashion moment.",
    options: [
      {
        id: "embrace",
        label: "Embrace the new persona",
        description: "+3 Mental Toughness from the confidence - a small Legacy bump.",
        attributeDelta: { mentalToughness: 3 },
        legacyDelta: 6,
      },
      {
        id: "tennis-first",
        label: "Keep the focus strictly on tennis",
        description: "+2 Power, +2 Movement.",
        attributeDelta: { power: 2, movement: 2 },
      },
    ],
  },
  {
    id: "charityExhibition",
    prompt:
      "You organize a charity exhibition that raises real money for a cause you care about.",
    options: [
      {
        id: "host",
        label: "Make it an annual tradition",
        description: "A real Legacy bump for the impact - +2 Mental Toughness.",
        attributeDelta: { mentalToughness: 2 },
        legacyDelta: 20,
      },
      {
        id: "one-off",
        label: "Keep it a one-time thing this year",
        description: "A modest Legacy bump, no stat change.",
        attributeDelta: {},
        legacyDelta: 9,
      },
    ],
  },
  {
    id: "languageImmersion",
    prompt: "An offseason spent immersed in a new language opens doors internationally.",
    options: [
      {
        id: "commit",
        label: "Commit to full immersion",
        description:
          "+3 Mental Toughness from the discipline - a Legacy bump for the global reach.",
        attributeDelta: { mentalToughness: 3 },
        legacyDelta: 9,
      },
      {
        id: "casual",
        label: "Keep it casual, focus stays on tennis",
        description: "+2 Power, +2 Movement from the extra training time.",
        attributeDelta: { power: 2, movement: 2 },
      },
    ],
  },
  {
    id: "retirementScare",
    prompt:
      "A scary-looking fall in practice turns out to be a minor scare, nothing more.",
    options: [
      {
        id: "grateful",
        label: "Let the relief refocus you",
        description: "+3 Mental Toughness, +2 Movement.",
        attributeDelta: { mentalToughness: 3, movement: 2 },
      },
      {
        id: "shaken",
        label: "Admit it shook your confidence a little",
        description: "-3 Mental Toughness this season.",
        attributeDelta: { mentalToughness: -3 },
      },
    ],
  },
];

const LIFE_EVENT_CHANCE = 0.22;

/**
 * Randomly offers one life event from the pool, avoiding an immediate
 * repeat of the previous one (by id) so back-to-back events don't feel
 * identical. Call is gated by LIFE_EVENT_CHANCE - most seasons should
 * have no event at all.
 */
export function pickLifeEvent(excludePreviousId = null) {
  const pool = excludePreviousId
    ? LIFE_EVENTS.filter((event) => event.id !== excludePreviousId)
    : LIFE_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Whether a life event should even be offered this season - most seasons should not have one. */
export function shouldOfferLifeEvent() {
  return Math.random() < LIFE_EVENT_CHANCE;
}

/**
 * Bundles a chosen option with its parent event's prompt text, in the
 * shape simulateNextSeason expects as its `lifeEvent` argument.
 */
export function resolveLifeEventChoice(event, option) {
  return { ...option, eventPrompt: event.prompt };
}

/** Applies a life event's attribute nudges on top of a season's effective attributes. */
function applyLifeEventAttributeDelta(attributes, delta) {
  if (!delta) return attributes;
  const result = { ...attributes };
  for (const key of ATTRIBUTE_KEYS) {
    if (delta[key]) {
      result[key] = clamp(Math.round(result[key] + delta[key]), 1, 110);
    }
  }
  return result;
}

// ---------- Career state (mirrors draft.js's pure-state-machine pattern) ----------

/**
 * Starts a new career at age 18. `baseAttributes` (the draft) is kept as
 * the player's *potential* - currentAttributes starts at a fraction of
 * it (see START_POTENTIAL_FRACTION), representing a talented but still-
 * developing 18-year-old, and closes that gap over the early career (see
 * developAttributes).
 */
export function createCareerState(baseAttributes) {
  const currentAttributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    currentAttributes[key] = clamp(
      Math.round(baseAttributes[key] * START_POTENTIAL_FRACTION),
      1,
      99
    );
  }
  return {
    baseAttributes,
    currentAttributes,
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
 * `lifeEvent` is optional - one of LIFE_EVENTS' chosen options (see
 * resolveLifeEventChoice), whose small attributeDelta/legacyDelta apply
 * on top of everything else this season.
 *
 * The career only ends here two ways: a hard age cap (44) or a rare
 * career-ending injury, whose odds rise with accumulated injuries and
 * how hard training/schedule have been pushed. Otherwise the season just
 * plays out and `retired` stays false - ending the career the rest of
 * the time is the player's own call (see retireNow).
 */
export function simulateNextSeason(
  state,
  playerPool,
  sliders = DEFAULT_SLIDERS,
  lifeEvent = null
) {
  if (state.retired) {
    throw new Error(
      "Cannot simulate a season: this career has already ended in retirement"
    );
  }

  const age = state.age;
  const { trainingIntensity, scheduleIntensity } = sliders;

  const attributesAfterLifeEvent = lifeEvent?.attributeDelta
    ? applyLifeEventAttributeDelta(state.currentAttributes, lifeEvent.attributeDelta)
    : state.currentAttributes;

  const lastSeason = state.seasons[state.seasons.length - 1] ?? null;
  const injuryChance = seasonInjuryChance({
    attributes: attributesAfterLifeEvent,
    trainingIntensity,
    scheduleIntensity,
    age,
    lastSeason,
  });
  const injured = Math.random() < injuryChance;
  const injury = injured
    ? {
        description: "A mid-season injury forced time away from the tour.",
        careerEnding: false,
      }
    : null;
  const seasonAttributes = injured
    ? applyInjuryImpact(attributesAfterLifeEvent, 0.9)
    : attributesAfterLifeEvent;

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
    lifeEventPrompt: lifeEvent ? lifeEvent.eventPrompt : null,
    lifeEventChoice: lifeEvent ? lifeEvent.label : null,
    slams,
    slamTitles,
    masterTitles: nonSlam.masterTitles,
    tourTitles: nonSlam.tourTitles,
    record: { wins: slamWins + nonSlam.wins, losses: slamLosses + nonSlam.losses },
    seasonPoints,
    ranking,
  };

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
      // A real cost, not just a neutral early stop - unfulfilled
      // potential is part of what makes recklessness a genuine risk
      // rather than a strictly-dominant "grow fast, worst case is just
      // stopping early" strategy. Folded into the breakdown below via
      // season.injury.careerEnding, so the live ticker shows it too.
      season.injury.careerEnding = true;
    }
  }

  if (!forcedRetired && nextAge >= HARD_AGE_CAP) {
    forcedRetired = true;
    retirementReason = "age-limit";
  }

  const legacyBreakdown = buildLegacyBreakdown(season, priorPeakRanking);
  if (lifeEvent?.legacyDelta) {
    legacyBreakdown.push({ label: lifeEvent.label, amount: lifeEvent.legacyDelta });
  }
  const legacyDelta = legacyBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
  season.legacyDelta = legacyDelta;
  season.legacyBreakdown = legacyBreakdown;

  const nextLegacyScore = state.legacyScore + legacyDelta;

  const priorTrainingIntensities = state.seasons.map((s) => s.trainingIntensity);
  const avgTrainingIntensitySoFar =
    [...priorTrainingIntensities, trainingIntensity].reduce((sum, v) => sum + v, 0) /
    (priorTrainingIntensities.length + 1);

  const { attributes: nextCurrentAttributes } = developAttributes({
    currentAttributes: attributesAfterLifeEvent,
    potentialAttributes: state.baseAttributes,
    age,
    trainingIntensity,
    ranking,
    priorPeakRanking,
    injured,
    avgTrainingIntensitySoFar,
  });

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

// ---------- Quick Sim (autopilot) ----------
//
// Runs the rest of a career unattended, straight to a final result -
// for when the point is seeing how a build's career turns out, not
// setting two sliders every single season by hand. Uses a simple
// age-aware autopilot: train and schedule hard while young (when the
// same intensity carries less injury risk - see seasonInjuryChance),
// taper down through the decline years, and back off further right
// after an injury, mirroring the exact "ease up coming off an injury"
// behavior the sliders reward when played by hand. Life events, when
// offered, get a random pick between the two options rather than a
// fixed one, so quick-simmed careers stay as varied as manually-played
// ones. Retirement is a heuristic, not a dice roll: keep playing while
// still competitive, retire voluntarily - locking in the on-top Legacy
// bonus - once a real decline has held for more than one season, rather
// than grinding all the way to the forced age cap.

/** The autopilot's slider choice for the season about to be played. */
function quickSimAutopilotSliders(state) {
  const age = state.age;
  const lastSeason = state.seasons[state.seasons.length - 1] ?? null;

  let trainingIntensity = 55;
  let scheduleIntensity = 50;
  if (age < 24) {
    trainingIntensity = 85;
    scheduleIntensity = 80;
  } else if (age < 28) {
    trainingIntensity = 70;
    scheduleIntensity = 68;
  } else if (age < 32) {
    trainingIntensity = 55;
    scheduleIntensity = 52;
  } else if (age < 36) {
    trainingIntensity = 40;
    scheduleIntensity = 38;
  } else {
    trainingIntensity = 25;
    scheduleIntensity = 25;
  }

  if (lastSeason?.injury) {
    trainingIntensity = Math.max(15, trainingIntensity - 25);
    scheduleIntensity = Math.max(15, scheduleIntensity - 20);
  }

  return {
    trainingIntensity: clamp(trainingIntensity, 10, 100),
    scheduleIntensity: clamp(scheduleIntensity, 10, 100),
  };
}

/** Whether the autopilot should retire this career now rather than play on. */
function quickSimShouldRetire(state) {
  if (state.seasons.length < 4) return false;
  const seasons = state.seasons;
  const peakRanking = Math.min(...seasons.map((s) => s.ranking));
  const threshold = Math.max(20, peakRanking * 2.2);
  const lastTwo = seasons.slice(-2);
  const decliningBothSeasons = lastTwo.every((s) => s.ranking > threshold);
  return decliningBothSeasons && state.age >= 30;
}

/**
 * Simulates every remaining season of a career unattended, using the
 * autopilot above for sliders, retirement, and life-event choices, and
 * returns the final (always-retired) state. Safe to call at any point in
 * a career - including right at age 18, before a single season has been
 * played by hand - not just partway through one.
 */
export function simulateFullCareer(state, playerPool) {
  let current = state;
  let lastEventId = null;
  const maxIterations = HARD_AGE_CAP - 18 + 2; // safety bound past the hard age cap

  for (let i = 0; i < maxIterations && !current.retired; i++) {
    const sliders = quickSimAutopilotSliders(current);

    let lifeEvent = null;
    if (shouldOfferLifeEvent()) {
      const event = pickLifeEvent(lastEventId);
      const option = event.options[Math.floor(Math.random() * event.options.length)];
      lifeEvent = resolveLifeEventChoice(event, option);
      lastEventId = event.id;
    }

    current = simulateNextSeason(current, playerPool, sliders, lifeEvent);
    if (!current.retired && quickSimShouldRetire(current)) {
      current = retireNow(current);
    }
  }

  return current;
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
