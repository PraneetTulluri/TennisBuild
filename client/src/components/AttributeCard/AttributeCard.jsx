import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "@tennisbuild/game-engine";
import PlayerCard from "../Wheel/PlayerCard.jsx";

/**
 * Shown after a spin lands: the drawn player's full card plus all 8
 * attributes with their values. Attributes already locked (by an earlier
 * round, possibly from a different player) are shown greyed and
 * unclickable; unlocked ones call onPick(key) when clicked.
 */
export default function AttributeCard({ player, locked, onPick }) {
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
    </div>
  );
}
