import { describe, it, expect } from "vitest";
import {
  computeArchetype,
  computeBestSurface,
  computeOverall,
  computeStrengthsAndWeaknesses,
  nearestPlayerComps,
} from "./scoring.js";

const BIG_SERVER_BUILD = {
  forehand: 68,
  backhand: 62,
  serve: 99,
  return: 45,
  volley: 70,
  movement: 45,
  power: 80,
  mentalToughness: 68,
};

const BALANCED_BUILD = {
  forehand: 80,
  backhand: 80,
  serve: 80,
  return: 80,
  volley: 80,
  movement: 80,
  power: 80,
  mentalToughness: 80,
};

describe("computeArchetype", () => {
  it("assigns a serve-and-power-heavy build to Big Server, not a movement-heavy archetype", () => {
    const result = computeArchetype(BIG_SERVER_BUILD);
    expect(result.key).toBe("bigServer");
  });

  it("assigns a perfectly balanced build to Complete Player", () => {
    const result = computeArchetype(BALANCED_BUILD);
    expect(result.key).toBe("completePlayer");
  });
});

describe("computeOverall", () => {
  it("returns a whole number derived from the best archetype's score", () => {
    const overall = computeOverall(BALANCED_BUILD);
    expect(Number.isInteger(overall)).toBe(true);
    expect(overall).toBeGreaterThan(0);
  });

  it("a perfectly balanced 80-everywhere build scores exactly 80 overall", () => {
    // Every weight in every template applies to the same value (80), so
    // the weighted average collapses to 80 regardless of which weights
    // "win" - a good sanity check that the formula doesn't silently
    // inflate or deflate a neutral build.
    expect(computeOverall(BALANCED_BUILD)).toBe(80);
  });
});

describe("computeBestSurface", () => {
  it("a big-serve, weak-movement build favors a fast surface over clay", () => {
    const result = computeBestSurface(BIG_SERVER_BUILD);
    expect(result.key).not.toBe("clay");
  });
});

describe("computeStrengthsAndWeaknesses", () => {
  it("ranks the highest and lowest attributes correctly", () => {
    // Uses its own fixture (rather than BIG_SERVER_BUILD, whose return and
    // movement are tied at 45) so the expected order isn't ambiguous.
    const build = { ...BIG_SERVER_BUILD, movement: 40, return: 50 };
    const { strengths, weaknesses } = computeStrengthsAndWeaknesses(build, 2);
    expect(strengths.map((s) => s.key)).toEqual(["serve", "power"]);
    expect(weaknesses.map((w) => w.key)).toEqual(["movement", "return"]);
  });
});

describe("nearestPlayerComps", () => {
  it("returns the closest players by full attribute-vector distance, nearest first", () => {
    const pool = [
      { slug: "identical", attributes: BIG_SERVER_BUILD },
      { slug: "opposite", attributes: BALANCED_BUILD },
    ];
    const comps = nearestPlayerComps(BIG_SERVER_BUILD, pool, 2);
    expect(comps[0].slug).toBe("identical");
    expect(comps[1].slug).toBe("opposite");
  });
});
