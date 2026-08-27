import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  computeOverall,
  computeArchetype,
} from "@tennisbuild/game-engine";
import { fetchLeaderboard } from "../api/builds.js";

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

// Each sort mode is just a comparator over the enriched build (build +
// computed overall/archetype). Builds missing the relevant stat (no
// simulated career, or a career that never cracked the all-time list) sort
// to the bottom rather than being hidden - a leaderboard should still show
// you the whole field, just ordered sensibly.
const SORT_MODES = {
  overall: {
    label: "Overall Rating",
    compare: (a, b) => b.overall - a.overall,
  },
  slams: {
    label: "Grand Slam Titles",
    compare: (a, b) =>
      (b.build.career?.slamTitles ?? 0) - (a.build.career?.slamTitles ?? 0) ||
      b.overall - a.overall,
  },
  goat: {
    label: "GOAT Rank",
    compare: (a, b) => {
      const aRank = a.build.career?.goatIsAllTimeGreat
        ? a.build.career.goatRank
        : Infinity;
      const bRank = b.build.career?.goatIsAllTimeGreat
        ? b.build.career.goatRank
        : Infinity;
      return aRank - bRank || b.overall - a.overall;
    },
  },
  peak: {
    label: "Peak Ranking",
    compare: (a, b) => {
      const aPeak = a.build.career?.simulated
        ? (a.build.career.peakRanking ?? Infinity)
        : Infinity;
      const bPeak = b.build.career?.simulated
        ? (b.build.career.peakRanking ?? Infinity)
        : Infinity;
      return aPeak - bPeak || b.overall - a.overall;
    },
  },
  newest: {
    label: "Newest",
    compare: (a, b) => new Date(b.build.createdAt) - new Date(a.build.createdAt),
  },
};

function rankBadgeClass(position) {
  if (position === 1) return "leaderboard-rank leaderboard-rank-gold";
  if (position === 2) return "leaderboard-rank leaderboard-rank-silver";
  if (position === 3) return "leaderboard-rank leaderboard-rank-bronze";
  return "leaderboard-rank";
}

/**
 * Every saved build (guest and account alike), browsable and sortable -
 * not just the builds saved from this browser/account (that's My Builds).
 * Overall/archetype are recomputed client-side from each build's `locked`
 * map, same reasoning as My Builds and the saved-build page: the score is
 * never trusted from a stored value, so it can't drift from the engine.
 */
export default function LeaderboardPage() {
  const [builds, setBuilds] = useState(null);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState("overall");

  useEffect(() => {
    fetchLeaderboard()
      .then(setBuilds)
      .catch((err) => setError(err.message));
  }, []);

  const ranked = useMemo(() => {
    if (!builds) return [];
    const enriched = builds.map((build) => {
      const attributes = attributesFromLocked(build.locked);
      return {
        build,
        overall: computeOverall(attributes),
        archetype: computeArchetype(attributes),
      };
    });
    return enriched.sort(SORT_MODES[sortMode].compare);
  }, [builds, sortMode]);

  return (
    <div className="builds-page leaderboard-page">
      <p className="result-kicker">Leaderboard</p>
      <h1>Every Build</h1>

      {error && <p className="draft-error">Could not load the leaderboard: {error}</p>}
      {!error && !builds && <p>Loading builds…</p>}
      {builds && builds.length === 0 && (
        <p>
          No builds saved yet. <Link to="/draft">Start a build</Link> to be the first.
        </p>
      )}

      {builds && builds.length > 0 && (
        <>
          <div className="leaderboard-controls">
            <label htmlFor="leaderboard-sort">Sort by</label>
            <select
              id="leaderboard-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              {Object.entries(SORT_MODES).map(([key, mode]) => (
                <option key={key} value={key}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>

          <div className="builds-list">
            {ranked.map(({ build, overall, archetype }, index) => {
              const creatorName = build.userId?.name ?? "Guest";
              return (
                <Link
                  key={build._id}
                  to={`/builds/${build._id}`}
                  className="build-list-card leaderboard-card"
                >
                  <span className={rankBadgeClass(index + 1)}>{index + 1}</span>
                  <div
                    className={`build-list-overall${overall > 99 ? " elite-value" : ""}`}
                  >
                    {overall}
                  </div>
                  <div className="build-list-info">
                    <strong>{build.name}</strong>
                    <span>
                      {archetype.label} · by {creatorName}
                    </span>
                    {build.career?.simulated && (
                      <span className="build-list-career">
                        🏆 {build.career.slamTitles} Slams · Peak #
                        {build.career.peakRanking}
                        {build.career.goatIsAllTimeGreat &&
                          ` · GOAT #${build.career.goatRank}`}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
