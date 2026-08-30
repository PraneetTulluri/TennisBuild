// Async team-vs-team PvP: two accounts each field a team of 3 saved
// builds; a challenger's team is matched against a defender's team (see
// server/src/routes/pvp.js for how an opponent is actually picked - this
// module only knows how to resolve one tie once both teams are given).
// Elo/win-loss are account-level, not per-build - builds are just the
// lineup a given tie happens to use.
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
 * One set, simulated game-by-game (not one clean roll) so the client can
 * play the score back point-by-point-ish instead of just revealing a final
 * number. Same win-probability roll every game (no separate per-game
 * model) - a set is just "how many games does the same underlying
 * matchup produce before someone reaches 6 with a 2-game lead." The 7th
 * game (7-5 or the 7-6 case) is treated as the decisive one rather than
 * simulating an actual tiebreak point-by-point - consistent with the rest
 * of the engine's level of abstraction.
 */
function simulateSet(probabilityA) {
  let gamesA = 0;
  let gamesB = 0;
  const games = [];
  for (;;) {
    const aWinsGame = Math.random() < probabilityA;
    if (aWinsGame) gamesA++;
    else gamesB++;
    games.push(aWinsGame ? "A" : "B");
    if ((gamesA >= 6 || gamesB >= 6) && Math.abs(gamesA - gamesB) >= 2) break;
    if (gamesA === 7 || gamesB === 7) break;
  }
  return { games, gamesA, gamesB, winner: gamesA > gamesB ? "A" : "B" };
}

/**
 * One best-of-5-sets match between two builds' attributes on a surface,
 * each set built up game-by-game via simulateSet(). The full breakdown
 * (every set, every game in it) is returned so the UI can play it back at
 * a watchable pace instead of only showing the final score - the tie is
 * still fully resolved server-side the instant it's requested (see the
 * module doc above); this detail is just what gets revealed, and when.
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
  const sets = [];
  while (setsA < 3 && setsB < 3) {
    const set = simulateSet(probabilityA);
    sets.push(set);
    if (set.winner === "A") setsA++;
    else setsB++;
  }

  return { sets, setsA, setsB, winner: setsA > setsB ? "A" : "B" };
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
// Standard Elo. Rating lives on the account (User), not the individual
// build, so a tie's 3 individual matches don't each get their own rating
// event - the caller (server/src/routes/pvp.js) applies this once per
// whole tie, using the fraction of the 3 matches each side won as a
// continuous score (0, 1/3, 2/3, or 1) rather than a strict binary
// win/loss. K=32 is a conventional default for a casual ladder, not
// something tuned against real match data yet.
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
