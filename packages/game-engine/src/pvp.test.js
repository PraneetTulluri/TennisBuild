import { describe, it, expect } from "vitest";
import {
  PVP_SURFACES,
  ELO_STARTING_RATING,
  randomPvpSurface,
  simulatePvpMatch,
  simulatePvpTie,
  updateEloPair,
} from "./pvp.js";
import { matchWinProbability } from "./match.js";

const STRONG = {
  forehand: 92,
  backhand: 90,
  serve: 93,
  return: 88,
  volley: 85,
  movement: 91,
  power: 89,
  mentalToughness: 93,
};

const WEAK = {
  forehand: 65,
  backhand: 65,
  serve: 65,
  return: 65,
  volley: 65,
  movement: 65,
  power: 65,
  mentalToughness: 65,
};

describe("matchWinProbability", () => {
  it("returns ~0.5 for equal strength and mental toughness", () => {
    expect(matchWinProbability(80, 80, 80, 80)).toBeCloseTo(0.5, 1);
  });

  it("favors the stronger side, but never certainty in either direction", () => {
    const favored = matchWinProbability(95, 65, 90, 90);
    const underdog = matchWinProbability(65, 95, 90, 90);
    expect(favored).toBeGreaterThan(0.9);
    expect(favored).toBeLessThan(0.97);
    expect(underdog).toBeLessThan(0.1);
    expect(underdog).toBeGreaterThan(0.03);
  });
});

describe("randomPvpSurface", () => {
  it("always returns one of the three real surfaces", () => {
    for (let i = 0; i < 30; i++) {
      expect(PVP_SURFACES).toContain(randomPvpSurface());
    }
  });
});

describe("simulatePvpMatch", () => {
  it("always resolves best-of-5: exactly one side reaches 3 sets, the other has 0-2", () => {
    for (let i = 0; i < 30; i++) {
      const result = simulatePvpMatch(STRONG, WEAK, "hard");
      const winnerSets = result.winner === "A" ? result.setsA : result.setsB;
      const loserSets = result.winner === "A" ? result.setsB : result.setsA;
      expect(winnerSets).toBe(3);
      expect(loserSets).toBeLessThanOrEqual(2);
      expect(result.setResults.length).toBe(result.setsA + result.setsB);
    }
  });

  it("a much stronger build wins the match far more often than not", () => {
    let strongWins = 0;
    const trials = 60;
    for (let i = 0; i < trials; i++) {
      const result = simulatePvpMatch(STRONG, WEAK, "hard");
      if (result.winner === "A") strongWins++;
    }
    expect(strongWins).toBeGreaterThan(trials * 0.75);
  });
});

describe("simulatePvpTie", () => {
  const strongTeam = [
    { id: "a1", attributes: STRONG },
    { id: "a2", attributes: STRONG },
    { id: "a3", attributes: STRONG },
  ];
  const weakTeam = [
    { id: "b1", attributes: WEAK },
    { id: "b2", attributes: WEAK },
    { id: "b3", attributes: WEAK },
  ];

  it("always plays exactly 3 matches with a score that sums to 3 and no draw", () => {
    const tie = simulatePvpTie(strongTeam, weakTeam, "clay");
    expect(tie.matches.length).toBe(3);
    expect(tie.scoreA + tie.scoreB).toBe(3);
    expect(tie.scoreA).not.toBe(tie.scoreB);
    expect(["A", "B"]).toContain(tie.winner);
  });

  it("sorts each team by Overall before pairing, regardless of input order", () => {
    const mixedStrengthTeam = [
      { id: "weakest", attributes: { ...WEAK, forehand: 50 } },
      { id: "strongest", attributes: STRONG },
      { id: "middle", attributes: { ...WEAK, forehand: 80 } },
    ];
    const tie = simulatePvpTie(mixedStrengthTeam, weakTeam, "grass");
    // Slot 0 (the top pairing) should be the strongest build regardless
    // of its position in the input array.
    expect(tie.matches[0].aId).toBe("strongest");
  });

  it("a clearly stronger team wins the tie far more often than not", () => {
    let strongTeamWins = 0;
    const trials = 40;
    for (let i = 0; i < trials; i++) {
      const tie = simulatePvpTie(strongTeam, weakTeam, "hard");
      if (tie.winner === "A") strongTeamWins++;
    }
    expect(strongTeamWins).toBeGreaterThan(trials * 0.8);
  });
});

describe("updateEloPair", () => {
  it("starting rating constant is a believable default", () => {
    expect(ELO_STARTING_RATING).toBe(1200);
  });

  it("equal ratings: the winner gains exactly what the loser loses", () => {
    const { ratingA, ratingB } = updateEloPair(1200, 1200, 1);
    expect(ratingA - 1200).toBe(1200 - ratingB);
    expect(ratingA).toBeGreaterThan(1200);
    expect(ratingB).toBeLessThan(1200);
  });

  it("an upset (lower-rated side wins) moves ratings more than a expected result", () => {
    const upset = updateEloPair(1000, 1400, 1); // massive underdog wins
    const expectedWin = updateEloPair(1400, 1000, 1); // heavy favorite wins
    const upsetGain = upset.ratingA - 1000;
    const expectedGain = expectedWin.ratingA - 1400;
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it("losing never increases a rating and winning never decreases it", () => {
    for (const [ratingA, ratingB] of [
      [1200, 1200],
      [1500, 900],
      [900, 1500],
    ]) {
      const winResult = updateEloPair(ratingA, ratingB, 1);
      const lossResult = updateEloPair(ratingA, ratingB, 0);
      expect(winResult.ratingA).toBeGreaterThanOrEqual(ratingA);
      expect(lossResult.ratingA).toBeLessThanOrEqual(ratingA);
    }
  });
});
