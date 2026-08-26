import { describe, it, expect } from "vitest";
import {
  ageFactor,
  shouldRetire,
  pointsToRanking,
  createCareerState,
  simulateNextSeason,
  summarizeCareer,
  SLAM_CALENDAR,
} from "./career.js";

const STRONG_ATTRIBUTES = {
  forehand: 90,
  backhand: 88,
  serve: 92,
  return: 85,
  volley: 80,
  movement: 88,
  power: 87,
  mentalToughness: 90,
};

function fakePlayer(overrides = {}) {
  return {
    name: "Fake Player",
    slug: `fake-${Math.random()}`,
    attributes: {
      forehand: 70,
      backhand: 70,
      serve: 70,
      return: 70,
      volley: 70,
      movement: 70,
      power: 70,
      mentalToughness: 70,
    },
    ...overrides,
  };
}

// pickDistinct needs at least 3 players to draw QF/SF/F opponents from.
const FAKE_POOL = [fakePlayer(), fakePlayer(), fakePlayer(), fakePlayer(), fakePlayer()];

describe("ageFactor", () => {
  it("rises through the early 20s, plateaus at peak, then declines", () => {
    expect(ageFactor(18)).toBeLessThan(ageFactor(21));
    expect(ageFactor(21)).toBeLessThanOrEqual(ageFactor(25));
    expect(ageFactor(25)).toBe(ageFactor(29)); // flat peak plateau
    expect(ageFactor(29)).toBeGreaterThan(ageFactor(34));
    expect(ageFactor(34)).toBeGreaterThan(ageFactor(38));
  });

  it("never goes below its floor even very late in a career", () => {
    expect(ageFactor(50)).toBeGreaterThanOrEqual(0.45);
  });
});

describe("shouldRetire", () => {
  it("never retires before 30", () => {
    for (let age = 18; age < 30; age++) {
      expect(shouldRetire(age)).toBe(false);
    }
  });

  it("always retires at the hard cap", () => {
    expect(shouldRetire(38)).toBe(true);
    expect(shouldRetire(40)).toBe(true);
  });
});

describe("pointsToRanking", () => {
  it("returns rank 1 for points at or above the top breakpoint", () => {
    expect(pointsToRanking(11000)).toBe(1);
    expect(pointsToRanking(20000)).toBe(1);
  });

  it("is monotonic: more points never means a worse (higher) rank", () => {
    const points = [0, 50, 300, 600, 1200, 2600, 4200, 6500, 11000];
    const ranks = points.map(pointsToRanking);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
    }
  });
});

describe("createCareerState", () => {
  it("starts at age 18 with no seasons and not retired", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    expect(state.age).toBe(18);
    expect(state.retired).toBe(false);
    expect(state.seasons).toEqual([]);
  });
});

describe("simulateNextSeason", () => {
  it("produces a season with all 4 Grand Slams, a tour result, and a ranking", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL);

    expect(next.seasons).toHaveLength(1);
    const season = next.seasons[0];
    expect(season.slams).toHaveLength(SLAM_CALENDAR.length);
    expect(season.slams.map((s) => s.key)).toEqual(SLAM_CALENDAR.map((s) => s.key));
    expect(typeof season.tour.titles).toBe("number");
    expect(season.ranking).toBeGreaterThanOrEqual(1);
    expect(next.age).toBe(19);
  });

  it("every slam's match list stops at the first loss (or goes all 7 rounds if champion)", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL);
    for (const slam of next.seasons[0].slams) {
      const lastMatch = slam.matches[slam.matches.length - 1];
      if (slam.result === "W") {
        expect(slam.matches).toHaveLength(7);
        expect(lastMatch.won).toBe(true);
      } else {
        expect(lastMatch.won).toBe(false);
        expect(lastMatch.round).toBe(slam.result);
      }
    }
  });

  it("throws if called on an already-retired career", () => {
    const state = { ...createCareerState(STRONG_ATTRIBUTES), retired: true };
    expect(() => simulateNextSeason(state, FAKE_POOL)).toThrow();
  });
});

describe("summarizeCareer", () => {
  it("sums titles (tour + Slam wins) and tracks peak (lowest) ranking across seasons", () => {
    const state = {
      baseAttributes: STRONG_ATTRIBUTES,
      age: 25,
      retired: true,
      seasons: [
        {
          year: 1,
          age: 20,
          tour: { titles: 1, wins: 30, losses: 10 },
          slams: [
            { key: "australianOpen", result: "QF" },
            { key: "frenchOpen", result: "W" },
            { key: "wimbledon", result: "R32" },
            { key: "usOpen", result: "SF" },
          ],
          ranking: 12,
        },
        {
          year: 2,
          age: 21,
          tour: { titles: 2, wins: 35, losses: 8 },
          slams: [
            { key: "australianOpen", result: "F" },
            { key: "frenchOpen", result: "W" },
            { key: "wimbledon", result: "QF" },
            { key: "usOpen", result: "R16" },
          ],
          ranking: 3,
        },
      ],
    };

    const summary = summarizeCareer(state);
    expect(summary.seasonsPlayed).toBe(2);
    expect(summary.titles).toBe(1 + 2 + 2); // tour titles (1+2) + 2 Slam wins
    expect(summary.slamTitles).toBe(2);
    expect(summary.peakRanking).toBe(3);
    expect(summary.retirementAge).toBe(21); // age of the last season played
  });

  it("reports null peak ranking and retirement age for a career with no seasons played", () => {
    const summary = summarizeCareer(createCareerState(STRONG_ATTRIBUTES));
    expect(summary.peakRanking).toBeNull();
    expect(summary.retirementAge).toBeNull();
  });
});
