import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  computeOverall,
  computeArchetype,
} from "@tennisbuild/game-engine";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyBuilds } from "../api/builds.js";

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

function GuestHero() {
  return (
    <div className="landing-hero">
      <p className="landing-kicker">🎾 Build-a-Player</p>
      <h1>TennisBuild</h1>
      <p className="landing-tagline">
        Spin the wheel, draft one attribute at a time from real ATP legends and pros, and
        build a custom tennis player of your own.
      </p>
      <Link to="/draft">
        <button type="button" className="spin-button">
          Start Build
        </button>
      </Link>
      <p className="landing-secondary-link">
        <Link to="/builds">View My Builds</Link>
      </p>
      <p className="landing-secondary-link">
        Have an account? <Link to="/login">Log in</Link> to save your progress across
        devices.
      </p>
    </div>
  );
}

function Dashboard({ user, builds }) {
  const buildsWithStats = builds.map((build) => {
    const attributes = attributesFromLocked(build.locked);
    return {
      build,
      overall: computeOverall(attributes),
      archetype: computeArchetype(attributes),
    };
  });
  const bestBuild = buildsWithStats.reduce(
    (best, current) => (!best || current.overall > best.overall ? current : best),
    null
  );
  const totalSlams = builds.reduce((sum, b) => sum + (b.career?.slamTitles ?? 0), 0);
  const careersSimulated = builds.filter((b) => b.career?.simulated).length;
  const recent = buildsWithStats.slice(0, 4);

  return (
    <div className="dashboard-page">
      <p className="landing-kicker">🎾 Welcome back</p>
      <h1>{user.name}</h1>

      <div className="dashboard-stats">
        <div>
          <strong>{builds.length}</strong>
          <span>Builds Saved</span>
        </div>
        <div>
          <strong className={bestBuild && bestBuild.overall > 99 ? "elite-value" : ""}>
            {bestBuild ? bestBuild.overall : "–"}
          </strong>
          <span>Best Overall</span>
        </div>
        <div>
          <strong>{totalSlams}</strong>
          <span>Total Slams Won</span>
        </div>
        <div>
          <strong>{careersSimulated}</strong>
          <span>Careers Simulated</span>
        </div>
      </div>

      <div className="dashboard-actions">
        <Link to="/draft">
          <button type="button" className="spin-button">
            Start New Build
          </button>
        </Link>
        <Link to="/builds">
          <button type="button" className="secondary-button">
            View All Builds
          </button>
        </Link>
      </div>

      {recent.length > 0 && (
        <div className="dashboard-recent">
          <h2>Recent Builds</h2>
          <div className="builds-list">
            {recent.map(({ build, overall, archetype }) => (
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
            ))}
          </div>
        </div>
      )}

      {builds.length === 0 && (
        <p>
          No builds yet - <Link to="/draft">start your first one</Link>.
        </p>
      )}
    </div>
  );
}

/**
 * The home route: a guest sees the marketing hero (unchanged from before
 * auth existed - gameplay has never required an account); a logged-in
 * user sees a real dashboard instead, built from their saved builds.
 */
export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [builds, setBuilds] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchMyBuilds()
      .then(setBuilds)
      .catch(() => setBuilds([]));
  }, [authLoading, user]);

  if (authLoading || (user && builds === null)) {
    return <div className="landing-page" />;
  }

  return (
    <div className="landing-page">
      {user ? <Dashboard user={user} builds={builds} /> : <GuestHero />}
    </div>
  );
}
