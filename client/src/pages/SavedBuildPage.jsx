import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  computeArchetype,
  computeBestSurface,
  computeOverall,
  computeStrengthsAndWeaknesses,
  nearestPlayerComps,
} from "@tennisbuild/game-engine";
import { fetchPlayers } from "../api/players.js";
import { fetchBuild } from "../api/builds.js";
import BuildResultView from "../components/BuildResultView/BuildResultView.jsx";

/**
 * Revisits a previously-saved build via its durable URL. Only `locked`
 * and `flavor` are ever stored (see server/src/models/Build.js) - overall/
 * archetype/surface/comps are recomputed here through the same engine
 * functions ResultPage uses for a freshly-finished build, so there's no
 * separate "stored derived stats" format that could drift out of sync
 * with the scoring engine over time.
 */
export default function SavedBuildPage() {
  const { id } = useParams();
  const [build, setBuild] = useState(null);
  const [playerPool, setPlayerPool] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchBuild(id), fetchPlayers()])
      .then(([fetchedBuild, players]) => {
        setBuild(fetchedBuild);
        setPlayerPool(players);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="result-page">
        <p className="draft-error">Could not load this build: {error}</p>
        <Link to="/builds">
          <button type="button" className="secondary-button">
            Back to My Builds
          </button>
        </Link>
      </div>
    );
  }

  if (!build || !playerPool) {
    return (
      <div className="result-page">
        <p>Loading…</p>
      </div>
    );
  }

  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) attributes[key] = build.locked[key].value;

  const derived = {
    overall: computeOverall(attributes),
    archetype: computeArchetype(attributes),
    surface: computeBestSurface(attributes),
    ...computeStrengthsAndWeaknesses(attributes, 3),
    comps: nearestPlayerComps(attributes, playerPool, 3),
  };

  return (
    <div className="result-page">
      <p className="result-kicker">{build.name}</p>

      <BuildResultView locked={build.locked} flavor={build.flavor} derived={derived} />

      {build.career?.simulated && (
        <div className="career-summary">
          <div className="goat-block">
            <p className="result-kicker">All-Time Ranking</p>
            <p className="goat-rank">
              #{build.career.goatRank} <span>of {build.career.goatTotal}</span>
            </p>
          </div>
          <h2>Career Totals</h2>
          <div className="career-summary-grid">
            <div>
              <strong>{build.career.slamTitles}</strong>
              <span>Grand Slams</span>
            </div>
            <div>
              <strong>{build.career.masterTitles}</strong>
              <span>Masters Titles</span>
            </div>
            <div>
              <strong>{build.career.titles}</strong>
              <span>Career Titles</span>
            </div>
            <div>
              <strong>#{build.career.peakRanking}</strong>
              <span>Peak Ranking</span>
            </div>
            <div>
              <strong>
                {build.career.careerRecordWins}-{build.career.careerRecordLosses}
              </strong>
              <span>Career Record</span>
            </div>
            <div>
              <strong>{build.career.retirementAge}</strong>
              <span>Retirement Age</span>
            </div>
          </div>
        </div>
      )}

      <div className="result-actions">
        <Link to="/builds">
          <button type="button" className="secondary-button">
            Back to My Builds
          </button>
        </Link>
        <Link to="/draft">
          <button type="button" className="spin-button">
            Build Another
          </button>
        </Link>
      </div>
    </div>
  );
}
