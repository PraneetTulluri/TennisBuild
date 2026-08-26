// All-time GOAT ranking: once a simulated career ends, this places it
// among a curated list of real legends' actual career achievements, so
// "21 career titles and a #9 peak" gets a concrete answer to "so... how
// good is that, really?" instead of sitting alone with no context.
//
// The benchmark stats below are well-known, widely-cited approximations
// (slam counts, Masters 1000 titles, total career titles, career-peak
// ranking) - informed by general knowledge, not pulled from a live
// stats feed, consistent with how the rest of this roster's ratings were
// built (see RATINGS_METHODOLOGY.md). Deliberately limited to players
// whose careers happened in the Masters-1000-series era (roughly the
// 1980s onward) so every entry is scored on a comparable basis - earlier
// legends (Laver, Rosewall, etc.) played under a different, harder-to-
// compare tournament structure and are left out of this specific list.
export const GOAT_BENCHMARKS = [
  {
    name: "Novak Djokovic",
    slamTitles: 24,
    masterTitles: 40,
    titles: 100,
    peakRanking: 1,
    seasonsPlayed: 20,
  },
  {
    name: "Rafael Nadal",
    slamTitles: 22,
    masterTitles: 36,
    titles: 92,
    peakRanking: 1,
    seasonsPlayed: 20,
  },
  {
    name: "Roger Federer",
    slamTitles: 20,
    masterTitles: 28,
    titles: 103,
    peakRanking: 1,
    seasonsPlayed: 22,
  },
  {
    name: "Pete Sampras",
    slamTitles: 14,
    masterTitles: 11,
    titles: 64,
    peakRanking: 1,
    seasonsPlayed: 14,
  },
  {
    name: "Ivan Lendl",
    slamTitles: 8,
    masterTitles: 22,
    titles: 94,
    peakRanking: 1,
    seasonsPlayed: 16,
  },
  {
    name: "Jimmy Connors",
    slamTitles: 8,
    masterTitles: 17,
    titles: 109,
    peakRanking: 1,
    seasonsPlayed: 21,
  },
  {
    name: "Andre Agassi",
    slamTitles: 8,
    masterTitles: 17,
    titles: 60,
    peakRanking: 1,
    seasonsPlayed: 20,
  },
  {
    name: "John McEnroe",
    slamTitles: 7,
    masterTitles: 19,
    titles: 77,
    peakRanking: 1,
    seasonsPlayed: 15,
  },
  {
    name: "Mats Wilander",
    slamTitles: 7,
    masterTitles: 3,
    titles: 33,
    peakRanking: 1,
    seasonsPlayed: 10,
  },
  {
    name: "Boris Becker",
    slamTitles: 6,
    masterTitles: 5,
    titles: 49,
    peakRanking: 1,
    seasonsPlayed: 14,
  },
  {
    name: "Stefan Edberg",
    slamTitles: 6,
    masterTitles: 8,
    titles: 41,
    peakRanking: 1,
    seasonsPlayed: 15,
  },
  {
    name: "Andy Murray",
    slamTitles: 3,
    masterTitles: 14,
    titles: 46,
    peakRanking: 1,
    seasonsPlayed: 15,
  },
  {
    name: "Stan Wawrinka",
    slamTitles: 3,
    masterTitles: 1,
    titles: 16,
    peakRanking: 3,
    seasonsPlayed: 17,
  },
  {
    name: "Marat Safin",
    slamTitles: 2,
    masterTitles: 4,
    titles: 15,
    peakRanking: 1,
    seasonsPlayed: 12,
  },
  {
    name: "Goran Ivanisevic",
    slamTitles: 1,
    masterTitles: 0,
    titles: 22,
    peakRanking: 2,
    seasonsPlayed: 14,
  },
];

function peakRankingBonus(peakRanking) {
  if (peakRanking === 1) return 150;
  if (peakRanking <= 3) return 80;
  if (peakRanking <= 10) return 30;
  if (peakRanking <= 20) return 10;
  return 0;
}

function longevityBonus(seasonsPlayed) {
  return Math.min(seasonsPlayed, 20) * 3;
}

/**
 * A single composite score from a career's headline numbers - weighted
 * so Grand Slams dominate (they're what "GOAT" conversations are actually
 * about), Masters titles matter a good deal, total career titles and
 * longevity contribute more modestly, and ever reaching (or getting
 * close to) world No. 1 adds a meaningful bonus. Not trying to be a
 * precise, authoritative GOAT formula - just a consistent yardstick to
 * rank a simulated career against real ones on the same terms.
 */
export function computeGoatScore(entry) {
  return (
    entry.slamTitles * 100 +
    entry.masterTitles * 15 +
    entry.titles * 2 +
    peakRankingBonus(entry.peakRanking) +
    longevityBonus(entry.seasonsPlayed)
  );
}

/**
 * Ranks a finished career (from summarizeCareer()) against the benchmark
 * legends, all scored the same way. Returns where it lands, plus who's
 * immediately above/below for a concrete "just ahead of X" comparison.
 */
export function computeGoatRanking(summary) {
  const you = { name: "You", isYou: true, score: computeGoatScore(summary) };
  const all = [
    ...GOAT_BENCHMARKS.map((b) => ({
      name: b.name,
      isYou: false,
      score: computeGoatScore(b),
    })),
    you,
  ];
  all.sort((a, b) => b.score - a.score);

  const index = all.findIndex((entry) => entry.isYou);
  return {
    rank: index + 1,
    total: all.length,
    score: you.score,
    above: index > 0 ? all[index - 1].name : null,
    below: index < all.length - 1 ? all[index + 1].name : null,
  };
}
