import { describe, it, expect } from "vitest";
import {
  pointsToRanking,
  createCareerState,
  simulateNextSeason,
  retireNow,
  summarizeCareer,
  SLAM_CALENDAR,
  DEFAULT_SLIDERS,
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

const MAX_SLIDERS = { trainingIntensity: 100, scheduleIntensity: 100 };
const MIN_SLIDERS = { trainingIntensity: 0, scheduleIntensity: 0 };

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
  it("starts at age 18 with currentAttributes exactly equal to the drafted attributes, no seasons, zero legacy", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    expect(state.age).toBe(18);
    expect(state.retired).toBe(false);
    expect(state.seasons).toEqual([]);
    expect(state.currentAttributes).toEqual(STRONG_ATTRIBUTES);
    expect(state.legacyScore).toBe(0);
    expect(state.retirementReason).toBeNull();
  });
});

describe("simulateNextSeason", () => {
  it("produces a season with all 4 Grand Slams, an accurate combined record, and a ranking", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL, MAX_SLIDERS);

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

  it("a fully-loaded schedule (max schedule intensity) produces a realistic number of total matches", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL, MAX_SLIDERS);
    const season = next.seasons[0];
    const totalMatches = season.record.wins + season.record.losses;
    expect(totalMatches).toBeGreaterThanOrEqual(30);
  });

  it("every slam stops advancing at the first loss (or reaches 7 wins if champion)", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL, MAX_SLIDERS);
    for (const slam of next.seasons[0].slams) {
      if (slam.result === "W") {
        expect(slam.wins).toBe(7);
      } else {
        expect(slam.wins).toBeLessThan(7);
      }
    }
  });

  it("season.attributes reflects this season's starting attributes (or an injury-reduced version of them), not a fixed age-curve discount", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    const next = simulateNextSeason(state, FAKE_POOL, MAX_SLIDERS);
    const season = next.seasons[0];
    for (const key of Object.keys(STRONG_ATTRIBUTES)) {
      const full = STRONG_ATTRIBUTES[key];
      const injured = Math.round(full * 0.85);
      expect([full, injured]).toContain(season.attributes[key]);
    }
  });

  it("throws if called on an already-retired career", () => {
    const state = { ...createCareerState(STRONG_ATTRIBUTES), retired: true };
    expect(() => simulateNextSeason(state, FAKE_POOL)).toThrow();
  });

  it("a fuller schedule (higher schedule intensity) plays meaningfully more matches on average than a light one", () => {
    function averageMatches(sliders, trials) {
      let total = 0;
      for (let i = 0; i < trials; i++) {
        const state = createCareerState(STRONG_ATTRIBUTES);
        const next = simulateNextSeason(state, FAKE_POOL, sliders);
        const season = next.seasons[0];
        total += season.record.wins + season.record.losses;
      }
      return total / trials;
    }

    const heavy = averageMatches({ trainingIntensity: 50, scheduleIntensity: 100 }, 40);
    const light = averageMatches({ trainingIntensity: 50, scheduleIntensity: 0 }, 40);
    expect(heavy).toBeGreaterThan(light);
  });

  it("pushing training and schedule intensity to the max causes injuries meaningfully more often than easing off", () => {
    function injuryRate(sliders, trials) {
      let injuries = 0;
      for (let i = 0; i < trials; i++) {
        const state = createCareerState(STRONG_ATTRIBUTES);
        const next = simulateNextSeason(state, FAKE_POOL, sliders);
        if (next.seasons[0].injury) injuries++;
      }
      return injuries / trials;
    }

    const reckless = injuryRate(MAX_SLIDERS, 150);
    const careful = injuryRate(MIN_SLIDERS, 150);
    expect(reckless).toBeGreaterThan(careful);
  });

  it("a young player training hard trends toward higher attributes a few seasons later, on average", () => {
    function averageAfterSeasons(seasons, trials) {
      let total = 0;
      for (let i = 0; i < trials; i++) {
        let state = createCareerState(STRONG_ATTRIBUTES);
        for (let s = 0; s < seasons; s++) {
          if (state.retired) break; // a rare career-ending injury can cut a trial short - that's fine, just stop
          state = simulateNextSeason(state, FAKE_POOL, {
            trainingIntensity: 90,
            scheduleIntensity: 50,
          });
        }
        const values = Object.values(state.currentAttributes);
        total += values.reduce((sum, v) => sum + v, 0) / values.length;
      }
      return total / trials;
    }

    const startingAverage =
      Object.values(STRONG_ATTRIBUTES).reduce((sum, v) => sum + v, 0) / 8;
    const afterThreeSeasons = averageAfterSeasons(3, 30);
    expect(afterThreeSeasons).toBeGreaterThan(startingAverage);
  });
});

describe("retireNow", () => {
  it("grants a Legacy Score bonus and marks retiredOnTop when the last season is still close to the career peak", () => {
    const state = {
      legacyScore: 500,
      seasons: [{ ranking: 20 }, { ranking: 3 }, { ranking: 5 }],
      retired: false,
    };
    const result = retireNow(state);
    expect(result.retired).toBe(true);
    expect(result.retirementReason).toBe("voluntary");
    expect(result.retiredOnTop).toBe(true);
    expect(result.legacyScore).toBe(560);
  });

  it("gives no bonus when the last season is a clear decline off the career peak", () => {
    const state = {
      legacyScore: 500,
      seasons: [{ ranking: 3 }, { ranking: 250 }],
      retired: false,
    };
    const result = retireNow(state);
    expect(result.retiredOnTop).toBe(false);
    expect(result.legacyScore).toBe(500);
  });

  it("throws if called on an already-retired career", () => {
    const state = { legacyScore: 0, seasons: [{ ranking: 10 }], retired: true };
    expect(() => retireNow(state)).toThrow();
  });

  it("throws if called before any season has been played", () => {
    const state = createCareerState(STRONG_ATTRIBUTES);
    expect(() => retireNow(state)).toThrow();
  });
});

describe("Slam opponent seeding", () => {
  it("keeps Slam titles rare for a modest build across many independent seasons against a pool that's mostly elite active players", () => {
    // Regression guard for a real bug: Slam QF/SF/F opponents used to be
    // drawn uniformly from the whole active pool, so a merely-good build
    // could easily draw (and beat) tour filler in a Slam final instead of
    // someone actually elite - letting a 75-ish OVR build rack up several
    // Slam titles a career, which makes no sense. Opponents are now drawn
    // from a narrowing band of the pool's *strongest* players as rounds
    // get later, so a modest build should almost never string together a
    // QF/SF/F run. Each trial is an independent single season (rather
    // than one long compounding career) specifically to isolate this
    // fix from the separate attribute-drift system - a modest build that
    // trains well over many *real* seasons is now supposed to eventually
    // grow into a contender (see the drift test above); this test is
    // only about whether a build that's *still* modest right now gets
    // seeded a realistic Slam field.
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

    let slamTitles = 0;
    const TRIALS = 40;
    for (let i = 0; i < TRIALS; i++) {
      const state = createCareerState(MODEST_ATTRIBUTES);
      const next = simulateNextSeason(state, MIXED_STRENGTH_POOL, DEFAULT_SLIDERS);
      slamTitles += next.seasons[0].slamTitles;
    }

    expect(slamTitles).toBeLessThan(6);
  });
});

describe("Masters/tour title realism", () => {
  it("keeps total career titles proportional to Slam success over a realistic career length, instead of ballooning independently of it", () => {
    // Regression guard for a real bug: a build that only won a handful of
    // Slams (a very good, not all-time-great career - think Wawrinka's 3
    // Slams and 16 career titles) was coming out of a full career with
    // 100+ total titles, wildly outside anything a real player with that
    // few Slams has ever done. A build tuned to land a modest handful of
    // Slams should land its average total title count well under legend
    // territory (the real all-time record, Connors' 109, is the rough
    // ceiling) over a realistic career length (~16 seasons - retirement
    // is the player's own call now, so this simulates someone playing a
    // normal-length career rather than either retiring immediately or
    // grinding all the way to the 44-year-old hard cap). The starting
    // rating here is lower than a "Wawrinka-comparable" draft would be
    // rated at debut - attributes now grow over a real career (see the
    // drift test above) at default (moderate) sliders, so a build this
    // age-and-training-adjusted still lands in that same real-world
    // territory by mid-career rather than starting there.
    const UPPER_MID_ATTRIBUTES = {
      forehand: 76,
      backhand: 75,
      serve: 77,
      return: 74,
      volley: 73,
      movement: 76,
      power: 75,
      mentalToughness: 77,
    };

    const CAREERS_TO_SIMULATE = 40;
    const SEASONS_PER_CAREER = 16;
    let totalSlams = 0;
    let totalTitles = 0;
    for (let i = 0; i < CAREERS_TO_SIMULATE; i++) {
      let state = createCareerState(UPPER_MID_ATTRIBUTES);
      for (let s = 0; s < SEASONS_PER_CAREER; s++) {
        if (state.retired) break; // a rare career-ending injury can cut a trial short
        state = simulateNextSeason(state, MIXED_STRENGTH_POOL, DEFAULT_SLIDERS);
      }
      const summary = summarizeCareer(state);
      totalSlams += summary.slamTitles;
      totalTitles += summary.titles;
    }

    const avgSlams = totalSlams / CAREERS_TO_SIMULATE;
    const avgTitles = totalTitles / CAREERS_TO_SIMULATE;

    expect(avgSlams).toBeLessThan(10);
    expect(avgTitles).toBeLessThan(60);
  });
});

describe("summarizeCareer", () => {
  it("sums Slam/Masters/tour titles separately and tracks career record, peak ranking, and Legacy Score", () => {
    const state = {
      baseAttributes: STRONG_ATTRIBUTES,
      currentAttributes: STRONG_ATTRIBUTES,
      age: 22,
      retired: true,
      retirementReason: "voluntary",
      retiredOnTop: true,
      legacyScore: 342.7,
      seasons: [
        {
          year: 1,
          age: 20,
          slamTitles: 1,
          masterTitles: 2,
          tourTitles: 3,
          record: { wins: 60, losses: 20 },
          ranking: 12,
          slams: [
            { key: "australianOpen", result: "SF" },
            { key: "frenchOpen", result: "QF" },
            { key: "wimbledon", result: "W" },
            { key: "usOpen", result: "R16" },
          ],
        },
        {
          year: 2,
          age: 21,
          slamTitles: 2,
          masterTitles: 3,
          tourTitles: 1,
          record: { wins: 68, losses: 15 },
          ranking: 3,
          slams: [
            { key: "australianOpen", result: "W" },
            { key: "frenchOpen", result: "SF" },
            { key: "wimbledon", result: "F" },
            { key: "usOpen", result: "W" },
          ],
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
    expect(summary.retirementReason).toBe("voluntary");
    expect(summary.retiredOnTop).toBe(true);
    expect(summary.legacyScore).toBe(343); // rounded
    expect(summary.slamTitlesByKey).toEqual({
      australianOpen: 1,
      frenchOpen: 0,
      wimbledon: 1,
      usOpen: 1,
    });
  });

  it("reports null peak ranking and retirement age for a career with no seasons played", () => {
    const summary = summarizeCareer(createCareerState(STRONG_ATTRIBUTES));
    expect(summary.peakRanking).toBeNull();
    expect(summary.retirementAge).toBeNull();
  });
});
