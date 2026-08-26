import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "@tennisbuild/game-engine";
import PlayerCard from "../Wheel/PlayerCard.jsx";

/**
 * The result-card display for a build: overall/archetype, flavor, best
 * surface, attribute breakdown, strengths/weaknesses, and nearest comps.
 * Purely presentational - all it needs is already-computed data, so it's
 * shared between ResultPage (a build that was just finished, computed
 * from router state) and SavedBuildPage (a build fetched back from the
 * backend later) rather than duplicating this JSX in both places.
 */
export default function BuildResultView({ locked, flavor, derived }) {
  return (
    <>
      <div className="result-overall-block">
        <span className={`result-overall${derived.overall > 99 ? " elite-value" : ""}`}>
          {derived.overall}
        </span>
        <span className="result-archetype">{derived.archetype.label}</span>
      </div>

      {flavor && (
        <p className="result-flavor">
          {flavor.handedness === "left" ? "Left-handed" : "Right-handed"} ·{" "}
          {flavor.country} · {flavor.heightCm}cm
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
                <strong className={locked[key].value > 99 ? "elite-value" : ""}>
                  {locked[key].value}
                </strong>
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
                {ATTRIBUTE_LABELS[s.key]}{" "}
                <strong className={s.value > 99 ? "elite-value" : ""}>{s.value}</strong>
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
    </>
  );
}
