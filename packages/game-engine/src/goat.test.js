import { describe, it, expect } from "vitest";
import { computeGoatScore, computeGoatRanking, GOAT_BENCHMARKS } from "./goat.js";

describe("computeGoatScore", () => {
  it("rewards more Slam titles over more Masters/tour titles", () => {
    const moreSlams = {
      slamTitles: 5,
      masterTitles: 0,
      titles: 5,
      peakRanking: 50,
      seasonsPlayed: 5,
    };
    const moreMasters = {
      slamTitles: 0,
      masterTitles: 20,
      titles: 20,
      peakRanking: 50,
      seasonsPlayed: 5,
    };
    expect(computeGoatScore(moreSlams)).toBeGreaterThan(computeGoatScore(moreMasters));
  });

  it("rewards reaching world No. 1 over a middling peak ranking", () => {
    const base = { slamTitles: 2, masterTitles: 2, titles: 10, seasonsPlayed: 10 };
    expect(computeGoatScore({ ...base, peakRanking: 1 })).toBeGreaterThan(
      computeGoatScore({ ...base, peakRanking: 50 })
    );
  });
});

describe("computeGoatRanking", () => {
  it("places an all-time-great-caliber career at or near the very top", () => {
    const dominant = {
      slamTitles: 25,
      masterTitles: 45,
      titles: 110,
      peakRanking: 1,
      seasonsPlayed: 20,
    };
    const result = computeGoatRanking(dominant);
    expect(result.rank).toBeLessThanOrEqual(2);
    expect(result.total).toBe(GOAT_BENCHMARKS.length + 1);
  });

  it("places a modest career near the bottom", () => {
    const modest = {
      slamTitles: 0,
      masterTitles: 0,
      titles: 3,
      peakRanking: 300,
      seasonsPlayed: 4,
    };
    const result = computeGoatRanking(modest);
    expect(result.rank).toBe(result.total); // dead last
    expect(result.below).toBeNull();
    expect(result.above).not.toBeNull();
  });

  it("rank and total are always internally consistent", () => {
    const result = computeGoatRanking({
      slamTitles: 3,
      masterTitles: 2,
      titles: 20,
      peakRanking: 12,
      seasonsPlayed: 10,
    });
    expect(result.rank).toBeGreaterThanOrEqual(1);
    expect(result.rank).toBeLessThanOrEqual(result.total);
  });
});
