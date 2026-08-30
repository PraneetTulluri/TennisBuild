// Async team-vs-team PvP: two saved builds' owners each field a team of
// 3 builds; a challenger's team is matched against a defender's team (see
// server/src/routes/pvp.js for how an opponent is actually picked - this
// module only knows how to resolve one tie once both teams are given).
//
// Design: no live/real-time component at all - a "tie" is fully resolved
// server-side the instant a challenge is made, using the exact same
// win-probability model (matchWinProbability, in match.js) the career
// simulation already uses for every match. Each side's team is
// automatically sorted strongest-to-weakest by Overall and paired 1v1,
// 2v2, 3v3 - no manual lineup strategy to build/expose, which keeps a
// tie unambiguous and avoids needing to reveal a defender's team to the
// challenger ahead of time. One surface is rolled for the whole tie (not
// per individual match) - closer to how a real tie is played at one
// event, and makes a team's surface balance actually matter.
import { computeOverall, computeSurfaceStrength } from "./scoring.js";
import { matchWinProbability } from "./match.js";

export const PVP_SURFACES = ["hard", "clay", "grass"];

export function randomPvpSurface() {
  return PVP_SURFACES[Math.floor(Math.random() * PVP_SURFACES.length)];
}

/**
 * One best-of-5-sets match between two builds' attributes on a surface.
 * Each set is a single probability roll (not point-by-point) - consistent
 * with how the rest of the engine treats "how likely is X to beat Y" as
 * one clean roll per unit of play, since there's no live input from
 * either side to simulate at a finer grain anyway.
 */
export function simulatePvpMatch(attributesA, attributesB, surface) {
  const strengthA = computeSurfaceStrength(attributesA, surface);
  const strengthB = computeSurfaceStrength(attributesB, surface);
  const probabilityA = matchWinProbability(
    strengthA,
    strengthB,
    attributesA.mentalToughness,
    attributesB.mentalToughness
  );

  let setsA = 0;
  let setsB = 0;
  const setResults = [];
  while (setsA < 3 && setsB < 3) {
    const aWinsSet = Math.random() < probabilityA;
    if (aWinsSet) setsA++;
    else setsB++;
    setResults.push(aWinsSet ? "A" : "B");
  }

  return { setsA, setsB, setResults, winner: setsA > setsB ? "A" : "B" };
}

/**
 * Resolves a full 3-build tie. `teamA`/`teamB` are each an array of
 * exactly 3 `{ id, attributes }` entries (in any order - both get sorted
 * by Overall here). Returns each individual match's result plus the
 * overall tie score/winner ("A" or "B", never a draw since 3 is odd).
 */
export function simulatePvpTie(teamA, teamB, surface) {
  const sortedA = [...teamA].sort(
    (a, b) => computeOverall(b.attributes) - computeOverall(a.attributes)
  );
  const sortedB = [...teamB].sort(
    (a, b) => computeOverall(b.attributes) - computeOverall(a.attributes)
  );

  const matches = sortedA.map((entryA, slot) => {
    const entryB = sortedB[slot];
    const result = simulatePvpMatch(entryA.attributes, entryB.attributes, surface);
    return { slot, aId: entryA.id, bId: entryB.id, ...result };
  });

  const scoreA = matches.filter((m) => m.winner === "A").length;
  const scoreB = matches.length - scoreA;

  return {
    surface,
    matches,
    scoreA,
    scoreB,
    winner: scoreA > scoreB ? "A" : "B",
  };
}

// ---------- Elo ----------
//
// Standard Elo, applied per individual build-vs-build match (not once per
// whole tie) - each of the 3 matches has its own clear winner/loser build,
// so each one is its own rating event. K=32 is a conventional default for
// a casual ladder, not something tuned against real match data yet.
const ELO_K_FACTOR = 32;
export const ELO_STARTING_RATING = 1200;

function expectedScore(ratingSelf, ratingOpponent) {
  return 1 / (1 + Math.pow(10, (ratingOpponent - ratingSelf) / 400));
}

/** Returns the two updated ratings after one match - `scoreA` is 1 if A won, 0 if A lost. */
export function updateEloPair(ratingA, ratingB, scoreA) {
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;
  const scoreB = 1 - scoreA;
  return {
    ratingA: Math.round(ratingA + ELO_K_FACTOR * (scoreA - expectedA)),
    ratingB: Math.round(ratingB + ELO_K_FACTOR * (scoreB - expectedB)),
  };
}
