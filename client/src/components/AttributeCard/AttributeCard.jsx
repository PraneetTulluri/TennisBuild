import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "@tennisbuild/game-engine";
import PlayerCard from "../Wheel/PlayerCard.jsx";

/**
 * Shown after a spin lands: the drawn player's full card plus all 8
 * attributes with their values. Attributes already locked (by an earlier
 * round, possibly from a different player) are shown greyed and
 * unclickable; unlocked ones call onPick(key) when clicked.
 *
 * If the build still has its one-per-build snag available and this spin
 * landed with visible neighbors, a "snag a neighbor" option is offered
 * alongside the main card - picking one swaps who the attribute list
 * (and the eventual pick) comes from, via onSnag(side).
 */
export default function AttributeCard({
  player,
  locked,
  onPick,
  neighbors,
  snagsRemaining,
  onSnag,
}) {
  const canSnag = snagsRemaining > 0 && neighbors;

  return (
    <div className="attribute-card">
      <PlayerCard player={player} highlighted />
      <ul className="attribute-list">
        {ATTRIBUTE_KEYS.map((key) => {
          const isLocked = locked[key] !== null;
          return (
            <li key={key} className={isLocked ? "attribute-row locked" : "attribute-row"}>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onPick(key)}
                className="attribute-pick-button"
              >
                <span className="attribute-label">{ATTRIBUTE_LABELS[key]}</span>
                <span className="attribute-value">{player.attributes[key]}</span>
                {isLocked && <span className="attribute-taken-badge">taken</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {canSnag && (
        <div className="snag-panel">
          <p className="snag-panel-label">
            Not feeling it? Snag a neighbor instead (1 left):
          </p>
          <div className="snag-options">
            <button type="button" className="snag-option" onClick={() => onSnag("left")}>
              <PlayerCard player={neighbors.left} />
              <span>Snag Left</span>
            </button>
            <button type="button" className="snag-option" onClick={() => onSnag("right")}>
              <PlayerCard player={neighbors.right} />
              <span>Snag Right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
