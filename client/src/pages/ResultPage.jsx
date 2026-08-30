import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  computeArchetype,
  computeBestSurface,
  computeOverall,
  computeStrengthsAndWeaknesses,
  nearestPlayerComps,
} from "@tennisbuild/game-engine";
import BuildResultView from "../components/BuildResultView/BuildResultView.jsx";
import ShareButton from "../components/ShareButton/ShareButton.jsx";
import { saveBuild, renameBuild } from "../api/builds.js";
import { randomBuildName } from "../utils/randomBuildName.js";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * The finished build's result card. Reads the completed draft's data from
 * router state (passed by DraftPage's navigate() call on completion) -
 * this only works as the very next screen after finishing a draft. To
 * revisit a build later (after saving it), see SavedBuildPage.jsx.
 */
export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { locked, history, playerPool } = location.state ?? {};

  const [buildName, setBuildName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedBuild, setSavedBuild] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const autoSaveStarted = useRef(false);

  const attributes = useMemo(() => {
    if (!locked) return null;
    const result = {};
    for (const key of Object.keys(locked)) result[key] = locked[key].value;
    return result;
  }, [locked]);

  const derived = useMemo(() => {
    if (!attributes || !playerPool) return null;
    return {
      overall: computeOverall(attributes),
      archetype: computeArchetype(attributes),
      surface: computeBestSurface(attributes),
      ...computeStrengthsAndWeaknesses(attributes, 3),
      comps: nearestPlayerComps(attributes, playerPool, 3),
    };
  }, [attributes, playerPool]);

  // Flavor (handedness/country/height) is inherited from whoever was
  // drafted in round 1, per the Phase 0 design doc - keeps the bio
  // internally consistent instead of mixing traits from multiple players.
  const basePlayer = useMemo(() => {
    if (!history?.length || !playerPool) return null;
    const firstPickSlug = history[0].player.slug;
    return playerPool.find((p) => p.slug === firstPickSlug) ?? null;
  }, [history, playerPool]);

  const flavor = basePlayer
    ? {
        handedness: basePlayer.handedness,
        country: basePlayer.country,
        heightCm: basePlayer.heightCm,
      }
    : null;

  // Every finished build saves itself the instant it's ready - no button
  // to remember to click. If the player hasn't typed a name yet, a random
  // tennis-flavored one fills in instead of leaving the build nameless;
  // the name field right below stays fully editable afterward either way.
  // Guarded by a ref (not just the savedBuild state) since React 19 dev
  // mode double-invokes effects - state alone can't stop a second save
  // from firing before the first one's response has come back.
  useEffect(() => {
    if (autoSaveStarted.current || !locked || !attributes) return;
    autoSaveStarted.current = true;

    const initialName = buildName.trim() || randomBuildName();
    setBuildName(initialName);
    setSaving(true);
    saveBuild({ name: initialName, locked, flavor })
      .then(setSavedBuild)
      .catch((err) => setSaveError(err.message))
      .finally(() => setSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, attributes]);

  async function handleRename() {
    const trimmed = buildName.trim();
    if (!trimmed || !savedBuild || trimmed === savedBuild.name) return;
    setRenaming(true);
    setSaveError(null);
    try {
      const updated = await renameBuild(savedBuild._id, trimmed);
      setSavedBuild(updated);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setRenaming(false);
    }
  }

  if (!attributes || !derived) {
    return (
      <div className="result-page">
        <p>No finished build to show yet.</p>
        <Link to="/draft">
          <button type="button" className="spin-button">
            Start a Build
          </button>
        </Link>
      </div>
    );
  }

  const nameChanged =
    savedBuild && buildName.trim() && buildName.trim() !== savedBuild.name;

  return (
    <div className="result-page">
      <p className="result-kicker">Your Custom Player</p>

      <BuildResultView locked={locked} flavor={flavor} derived={derived} />

      <div className="save-block">
        <label className="save-name-label" htmlFor="build-name">
          {savedBuild ? "Saved as" : "Saving as"}
        </label>
        <div className="save-name-row">
          <input
            id="build-name"
            type="text"
            className="save-name-input"
            placeholder="Name your player"
            value={buildName}
            onChange={(e) => setBuildName(e.target.value)}
            maxLength={40}
          />
          {nameChanged && (
            <button
              type="button"
              className="secondary-button"
              disabled={renaming}
              onClick={handleRename}
            >
              {renaming ? "Renaming…" : "Rename"}
            </button>
          )}
        </div>
        {saving && <p className="save-confirmation">Saving…</p>}
        {saveError && <p className="draft-error">Could not save: {saveError}</p>}
        {savedBuild && user && (
          <p className="save-confirmation">
            ✅ On the <Link to="/leaderboard">leaderboard</Link> ·{" "}
            <Link to="/builds">View My Builds</Link>
          </p>
        )}
        {savedBuild && !user && (
          <p className="save-confirmation">
            ✅ Saved to <Link to="/builds">My Builds</Link> on this browser
          </p>
        )}
        {savedBuild && <ShareButton buildId={savedBuild._id} name={savedBuild.name} />}
        {savedBuild && !user && (
          <div className="save-signup-nudge">
            <p>
              Guest builds don&rsquo;t show up on the <strong>Leaderboard</strong> - sign
              up to add this one and keep it saved for good, on any device.
            </p>
            <Link to="/register">
              <button type="button" className="secondary-button">
                Sign Up Free
              </button>
            </Link>
          </div>
        )}
      </div>

      <div className="result-actions">
        <button
          type="button"
          className="spin-button"
          onClick={() =>
            navigate("/career", {
              state: { attributes, playerPool, buildId: savedBuild?._id ?? null },
            })
          }
        >
          Simulate Career
        </button>
        <Link to="/draft">
          <button type="button" className="secondary-button">
            Build Another
          </button>
        </Link>
      </div>
    </div>
  );
}
