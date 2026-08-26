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
  it("total is always the size of the benchmark list (25), not benchmarks+1", () => {
    const result = computeGoatRanking({
      slamTitles: 3,
      masterTitles: 2,
      titles: 20,
      peakRanking: 12,
      seasonsPlayed: 10,
    });
    expect(result.total).toBe(GOAT_BENCHMARKS.length);
    expect(GOAT_BENCHMARKS.length).toBe(25);
  });

  it("places an all-time-great-caliber career at or near the very top", () => {
    const dominant = {
      slamTitles: 25,
      masterTitles: 45,
      titles: 110,
      peakRanking: 1,
      seasonsPlayed: 20,
    };
    const result = computeGoatRanking(dominant);
    expect(result.isAllTimeGreat).toBe(true);
    expect(result.rank).toBeLessThanOrEqual(2);
  });

  it("a career that barely edges out the single weakest benchmark still cracks the top 25", () => {
    // The weakest benchmark scores 233 (Richard Krajicek) - a career just
    // above that, but below everything else, lands at exactly #25.
    const barelyQualifies = {
      slamTitles: 1,
      masterTitles: 1,
      titles: 25,
      peakRanking: 4,
      seasonsPlayed: 13,
    };
    const result = computeGoatRanking(barelyQualifies);
    expect(result.isAllTimeGreat).toBe(true);
    expect(result.rank).toBe(25);
    expect(result.below).toBe("Richard Krajicek");
  });

  it("a career weaker than every benchmark is reported as not an all-time great, not a fake rank", () => {
    const modest = {
      slamTitles: 0,
      masterTitles: 0,
      titles: 3,
      peakRanking: 300,
      seasonsPlayed: 4,
    };
    const result = computeGoatRanking(modest);
    expect(result.isAllTimeGreat).toBe(false);
    expect(result.below).toBeNull();
  });

  it("rank never exceeds total when it is an all-time great", () => {
    const result = computeGoatRanking({
      slamTitles: 3,
      masterTitles: 2,
      titles: 20,
      peakRanking: 12,
      seasonsPlayed: 10,
    });
    expect(result.isAllTimeGreat).toBe(true);
    expect(result.rank).toBeGreaterThanOrEqual(1);
    expect(result.rank).toBeLessThanOrEqual(result.total);
  });
});
