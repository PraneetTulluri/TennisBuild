import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  computeArchetype,
  computeBestSurface,
  computeOverall,
  computeStrengthsAndWeaknesses,
  nearestPlayerComps,
} from "@tennisbuild/game-engine";
import BuildResultView from "../components/BuildResultView/BuildResultView.jsx";
import { saveBuild } from "../api/builds.js";

/**
 * The finished build's result card. Reads the completed draft's data from
 * router state (passed by DraftPage's navigate() call on completion) -
 * this only works as the very next screen after finishing a draft. To
 * revisit a build later (after saving it), see SavedBuildPage.jsx.
 */
export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locked, history, playerPool } = location.state ?? {};

  const [buildName, setBuildName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedBuild, setSavedBuild] = useState(null);

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

  async function handleSave() {
    if (!buildName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const build = await saveBuild({ name: buildName.trim(), locked, flavor });
      setSavedBuild(build);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
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

  return (
    <div className="result-page">
      <p className="result-kicker">Your Custom Player</p>

      <BuildResultView locked={locked} flavor={flavor} derived={derived} />

      <div className="save-block">
        {!savedBuild ? (
          <>
            <input
              type="text"
              className="save-name-input"
              placeholder="Name your player"
              value={buildName}
              onChange={(e) => setBuildName(e.target.value)}
              maxLength={40}
            />
            <button
              type="button"
              className="secondary-button"
              disabled={!buildName.trim() || saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save Build"}
            </button>
            {saveError && <p className="draft-error">Could not save: {saveError}</p>}
          </>
        ) : (
          <p className="save-confirmation">
            ✅ Saved as <strong>{savedBuild.name}</strong> ·{" "}
            <Link to="/builds">View My Builds</Link>
          </p>
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
