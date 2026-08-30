import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  computeOverall,
  computeArchetype,
} from "@tennisbuild/game-engine";
import { fetchMyBuilds } from "../api/builds.js";
import { FlipCard } from "../components/animate-ui/components/community/flip-card.jsx";

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

/**
 * Lists every build saved from this browser (scoped by the guest session
 * id in localStorage - see utils/guestSession.js, no auth yet). Overall/
 * archetype are recomputed client-side from the saved `locked` map rather
 * than trusting a stored value, same reasoning as SavedBuildPage. Each
 * build renders as a FlipCard (see components/animate-ui/community) -
 * front shows the overall/archetype at a glance, hovering flips to the
 * career result (or a prompt to go simulate one) without leaving the
 * page; clicking anywhere on the card still opens the full build page.
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
        <div className="build-flip-grid">
          {builds.map((build) => {
            const attributes = attributesFromLocked(build.locked);
            const overall = computeOverall(attributes);
            const archetype = computeArchetype(attributes);
            return (
              <Link
                key={build._id}
                to={`/builds/${build._id}`}
                className="build-flip-link"
              >
                <FlipCard
                  overall={overall}
                  eliteValue={overall > 99}
                  name={build.name}
                  archetype={archetype.label}
                  career={
                    build.career?.simulated
                      ? {
                          slamTitles: build.career.slamTitles,
                          peakRanking: build.career.peakRanking,
                          retirementAge: build.career.retirementAge,
                          goatRank: build.career.goatRank,
                          goatIsAllTimeGreat: build.career.goatIsAllTimeGreat,
                        }
                      : null
                  }
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
