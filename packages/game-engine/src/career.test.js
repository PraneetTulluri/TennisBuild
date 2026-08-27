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
    careerStatus: "active",
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

// At least 3 active players are needed to draw Slam QF/SF/F opponents from.
const FAKE_POOL = [fakePlayer(), fakePlayer(), fakePlayer(), fakePlayer(), fakePlayer()];

const ELITE_ATTRIBUTES = {
  forehand: 92,
  backhand: 90,
  serve: 93,
  return: 88,
  volley: 85,
  movement: 91,
  power: 89,
  mentalToughness: 93,
};

// A pool shaped like the real roster: mostly true Slam-contender-tier
// players plus a handful of much weaker tour filler kept around for wheel
// variety, not major wins.
const MIXED_STRENGTH_POOL = [
  ...Array.from({ length: 15 }, () => fakePlayer({ attributes: ELITE_ATTRIBUTES })),
  ...Array.from({ length: 10 }, () => fakePlayer()),
];

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
  it("produces a season with all 4 Grand Slams, an accurate combined record, and a ranking", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL);

    expect(next.seasons).toHaveLength(1);
    const season = next.seasons[0];
    expect(season.slams).toHaveLength(SLAM_CALENDAR.length);
    expect(season.slams.map((s) => s.key)).toEqual(SLAM_CALENDAR.map((s) => s.key));
    expect(typeof season.masterTitles).toBe("number");
    expect(typeof season.tourTitles).toBe("number");
    expect(season.record.wins).toBeGreaterThan(0);
    expect(season.record.losses).toBeGreaterThan(0);
    expect(season.ranking).toBeGreaterThanOrEqual(1);
    expect(next.age).toBe(19);
  });

  it("a full healthy season produces a realistic number of total matches (not a handful)", () => {
    // With 9 Masters + 12 tour events + up to 4 Slam runs all contributing
    // real per-round win/loss rolls, a season's total matches should land
    // well above the old flat ~35-50 formula this replaced - real tour
    // pros playing a full healthy season are typically in the 50-90 match
    // range.
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL);
    const season = next.seasons[0];
    const totalMatches = season.record.wins + season.record.losses;
    expect(totalMatches).toBeGreaterThanOrEqual(30);
  });

  it("every slam stops advancing at the first loss (or reaches 7 wins if champion)", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL);
    for (const slam of next.seasons[0].slams) {
      if (slam.result === "W") {
        expect(slam.wins).toBe(7);
      } else {
        expect(slam.wins).toBeLessThan(7);
      }
    }
  });

  it("throws if called on an already-retired career", () => {
    const state = { ...createCareerState(STRONG_ATTRIBUTES), retired: true };
    expect(() => simulateNextSeason(state, FAKE_POOL)).toThrow();
  });
});

describe("summarizeCareer", () => {
  it("sums Slam/Masters/tour titles separately and tracks career record and peak ranking", () => {
    const state = {
      baseAttributes: STRONG_ATTRIBUTES,
      age: 22,
      retired: true,
      seasons: [
        {
          year: 1,
          age: 20,
          slamTitles: 1,
          masterTitles: 2,
          tourTitles: 3,
          record: { wins: 60, losses: 20 },
          ranking: 12,
        },
        {
          year: 2,
          age: 21,
          slamTitles: 2,
          masterTitles: 3,
          tourTitles: 1,
          record: { wins: 68, losses: 15 },
          ranking: 3,
        },
      ],
    };

    const summary = summarizeCareer(state);
    expect(summary.seasonsPlayed).toBe(2);
    expect(summary.slamTitles).toBe(3);
    expect(summary.masterTitles).toBe(5);
    expect(summary.tourTitles).toBe(4);
    expect(summary.titles).toBe(3 + 5 + 4);
    expect(summary.careerRecord).toEqual({ wins: 128, losses: 35 });
    expect(summary.peakRanking).toBe(3);
    expect(summary.retirementAge).toBe(21); // age of the last season played
  });

  it("reports null peak ranking and retirement age for a career with no seasons played", () => {
    const summary = summarizeCareer(createCareerState(STRONG_ATTRIBUTES));
    expect(summary.peakRanking).toBeNull();
    expect(summary.retirementAge).toBeNull();
  });
});

describe("Slam opponent seeding", () => {
  it("keeps Slam titles rare for a modest build, even across many seasons against a pool that's mostly elite active players", () => {
    // Regression guard for a real bug: Slam QF/SF/F opponents used to be
    // drawn uniformly from the whole active pool, so a merely-good build
    // could easily draw (and beat) tour filler in a Slam final instead of
    // someone actually elite - letting a 75-ish OVR build rack up several
    // Slam titles a career, which makes no sense. Opponents are now drawn
    // from a narrowing band of the pool's *strongest* players as rounds
    // get later, so a modest build should almost never string together a
    // QF/SF/F run, no matter how many seasons it gets to try.
    const MODEST_ATTRIBUTES = {
      forehand: 75,
      backhand: 74,
      serve: 76,
      return: 73,
      volley: 72,
      movement: 75,
      power: 74,
      mentalToughness: 76,
    };

    let state = createCareerState(MODEST_ATTRIBUTES);
    let slamTitles = 0;
    const SEASONS_TO_SIMULATE = 40;
    for (let i = 0; i < SEASONS_TO_SIMULATE; i++) {
      state = { ...state, retired: false }; // force-continue past natural retirement rolls
      state = simulateNextSeason(state, MIXED_STRENGTH_POOL);
      slamTitles += state.seasons[state.seasons.length - 1].slamTitles;
    }

    expect(slamTitles).toBeLessThan(6);
  });
});
