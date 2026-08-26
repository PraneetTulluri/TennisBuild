import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  computeOverall,
  computeArchetype,
} from "@tennisbuild/game-engine";
import { fetchMyBuilds } from "../api/builds.js";

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

/**
 * Lists every build saved from this browser (scoped by the guest session
 * id in localStorage - see utils/guestSession.js, no auth yet). Overall/
 * archetype are recomputed client-side from the saved `locked` map rather
 * than trusting a stored value, same reasoning as SavedBuildPage.
 */
export default function MyBuildsPage() {
  const [builds, setBuilds] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMyBuilds()
      .then(setBuilds)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="builds-page">
      <p className="result-kicker">My Builds</p>
      <h1>Saved Players</h1>

      {error && <p className="draft-error">Could not load builds: {error}</p>}
      {!error && !builds && <p>Loading your builds…</p>}
      {builds && builds.length === 0 && (
        <p>
          No builds saved yet. <Link to="/draft">Start a build</Link> and save it from the
          result page.
        </p>
      )}

      {builds && builds.length > 0 && (
        <div className="builds-list">
          {builds.map((build) => {
            const attributes = attributesFromLocked(build.locked);
            const overall = computeOverall(attributes);
            const archetype = computeArchetype(attributes);
            return (
              <Link
                key={build._id}
                to={`/builds/${build._id}`}
                className="build-list-card"
              >
                <div
                  className={`build-list-overall${overall > 99 ? " elite-value" : ""}`}
                >
                  {overall}
                </div>
                <div className="build-list-info">
                  <strong>{build.name}</strong>
                  <span>{archetype.label}</span>
                  {build.career?.simulated && (
                    <span className="build-list-career">
                      🏆 {build.career.slamTitles} Slams · Peak #
                      {build.career.peakRanking}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
