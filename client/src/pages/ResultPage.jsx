import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  computeArchetype,
  computeBestSurface,
  computeOverall,
  computeStrengthsAndWeaknesses,
  nearestPlayerComps,
} from "@tennisbuild/game-engine";
import PlayerCard from "../components/Wheel/PlayerCard.jsx";

/**
 * The finished build's result card. Reads the completed draft's data from
 * router state (passed by DraftPage's navigate() call on completion) -
 * there's no backend persistence yet (that's Phase 6), so this only works
 * as the very next screen after finishing a draft, not a durable URL.
 */
export default function ResultPage() {
  const location = useLocation();
  const { locked, history, playerPool } = location.state ?? {};

  const attributes = useMemo(() => {
    if (!locked) return null;
    const result = {};
    for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
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
      <div className="result-overall-block">
        <span className="result-overall">{derived.overall}</span>
        <span className="result-archetype">{derived.archetype.label}</span>
      </div>

      {basePlayer && (
        <p className="result-flavor">
          {basePlayer.handedness === "left" ? "Left-handed" : "Right-handed"} ·{" "}
          {basePlayer.country} · {basePlayer.heightCm}cm
        </p>
      )}
      <p className="result-surface">
        Best surface: <strong>{derived.surface.label}</strong>
      </p>

      <div className="result-columns">
        <div className="result-panel">
          <h2>Attributes</h2>
          <ul className="result-attr-list">
            {ATTRIBUTE_KEYS.map((key) => (
              <li key={key}>
                <span className="result-attr-label">{ATTRIBUTE_LABELS[key]}</span>
                <strong>{attributes[key]}</strong>
                <em>via {locked[key].fromPlayerName}</em>
              </li>
            ))}
          </ul>
        </div>

        <div className="result-panel">
          <h2>Strengths</h2>
          <ul className="result-tag-list strengths">
            {derived.strengths.map((s) => (
              <li key={s.key}>
                {ATTRIBUTE_LABELS[s.key]} <strong>{s.value}</strong>
              </li>
            ))}
          </ul>
          <h2>Weaknesses</h2>
          <ul className="result-tag-list weaknesses">
            {derived.weaknesses.map((w) => (
              <li key={w.key}>
                {ATTRIBUTE_LABELS[w.key]} <strong>{w.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2>Plays Like</h2>
      <div className="result-comps">
        {derived.comps.map((player) => (
          <PlayerCard key={player.slug} player={player} />
        ))}
      </div>

      <Link to="/draft">
        <button type="button" className="spin-button">
          Build Another
        </button>
      </Link>
    </div>
  );
}
