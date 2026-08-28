import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  computeOverall,
  computeArchetype,
} from "@tennisbuild/game-engine";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyBuilds } from "../api/builds.js";
import { fetchPlayers } from "../api/players.js";

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

// Small Fisher-Yates shuffle - used once per page load to pick which real
// player photos fill the showcase columns, so the hero looks a little
// different on repeat visits instead of a fixed lineup baked into the code.
function shuffled(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A single real player photo in the hero's showcase columns - only ever
// shown for players with an actual resolved photo (see
// resolveHeadshots.js), never the illustrated bust fallback, since the
// whole point here is real, recognizable faces filling out the page rather
// than an icon standing in for one.
function ShowcasePortrait({ player, style }) {
  return (
    <div className={`showcase-portrait tier-${player.tier}`} style={style}>
      <img src={player.imageUrl} alt={player.name} loading="lazy" />
      <span className="showcase-portrait-name">{player.name}</span>
    </div>
  );
}

function ShowcaseColumn({ players, side }) {
  if (players.length === 0) return null;
  return (
    <div className={`landing-showcase landing-showcase-${side}`} aria-hidden="true">
      {players.map((player, i) => (
        <ShowcasePortrait key={player.slug} player={player} style={{ "--i": i }} />
      ))}
    </div>
  );
}

function GuestHero() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    fetchPlayers()
      .then(setPlayers)
      .catch(() => setPlayers([]));
  }, []);

  // A mix of legends and current stars with a real resolved photo, split
  // across two flanking columns - fills what used to be a lot of empty
  // gutter on wider screens with the actual roster instead of decoration.
  const { left, right } = useMemo(() => {
    const withPhotos = shuffled(players.filter((p) => p.imageUrl));
    const legends = withPhotos.filter((p) => p.tier === "legend").slice(0, 5);
    const current = withPhotos.filter((p) => p.tier !== "legend").slice(0, 5);
    const mixed = shuffled([...legends, ...current]);
    const half = Math.ceil(mixed.length / 2);
    return { left: mixed.slice(0, half), right: mixed.slice(half) };
  }, [players]);

  return (
    <div className="landing-hero-row">
      <ShowcaseColumn players={left} side="left" />
      <div className="landing-hero">
        <p className="landing-kicker">Build-a-Player</p>
        <h1>TennisBuild</h1>
        <p className="landing-tagline">
          Spin the wheel, draft one attribute at a time from real ATP legends and pros,
          and build a custom tennis player of your own.
        </p>
        <Link to="/guide">
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
      <ShowcaseColumn players={right} side="right" />
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
      <p className="landing-kicker">Welcome back</p>
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
        <Link to="/guide">
          <button type="button" className="spin-button">
            Start New Build
          </button>
        </Link>
        <Link to="/builds">
          <button type="button" className="secondary-button">
            View All Builds
          </button>
        </Link>
        <Link to="/leaderboard">
          <button type="button" className="secondary-button">
            Leaderboard
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
          No builds yet - <Link to="/guide">start your first one</Link>.
        </p>
      )}
    </div>
  );
}

/**
 * The home route: a guest sees the marketing hero - gameplay has never
 * required an account - flanked by real player photo columns on wide
 * screens (see GuestHero/ShowcaseColumn); a logged-in user sees a real
 * dashboard instead, built from their saved builds.
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
