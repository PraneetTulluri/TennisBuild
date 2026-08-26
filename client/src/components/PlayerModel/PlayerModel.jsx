import { ATTRIBUTE_LABELS } from "@tennisbuild/game-engine";
import TennisSilhouette from "./TennisSilhouette.jsx";

// Where each attribute is "mapped" on the body for flavor - re-interpreting
// the reference screenshot's basketball body-mapping gimmick for tennis
// (e.g. Serve at the shoulder/service motion, Forehand at the dominant
// wrist, Return at the eyes for reading the incoming ball). Purely a
// presentation detail, not game logic, which is why it lives here in the
// client rather than in the shared engine package.
const LEFT_ATTRIBUTES = [
  { key: "mentalToughness", bodyPart: "Head" },
  { key: "backhand", bodyPart: "Off Hip" },
  { key: "power", bodyPart: "Core" },
  { key: "movement", bodyPart: "Legs" },
];
const RIGHT_ATTRIBUTES = [
  { key: "return", bodyPart: "Eyes" },
  { key: "serve", bodyPart: "Shoulder" },
  { key: "volley", bodyPart: "Racquet Hand" },
  { key: "forehand", bodyPart: "Wrist" },
];

function AttributeChip({ attrKey, bodyPart, locked, canPick, onPick }) {
  const entry = locked[attrKey];
  const isLocked = entry !== null;
  return (
    <button
      type="button"
      className={`model-chip${isLocked ? " locked" : ""}${canPick ? " pickable" : ""}`}
      disabled={!canPick}
      onClick={() => onPick(attrKey)}
    >
      <span className="model-chip-label">{ATTRIBUTE_LABELS[attrKey]}</span>
      <span className="model-chip-sub">{bodyPart}</span>
      <span className="model-chip-value">{isLocked ? entry.value : "–"}</span>
    </button>
  );
}

/**
 * The persistent "build so far" tennis silhouette: 8 attribute chips
 * wired to body-part positions. Locked chips display their value
 * permanently; unlocked chips become clickable (same onPick handler as
 * AttributeCard's list) only while a player is currently revealed.
 */
export default function PlayerModel({ locked, revealedPlayer, onPick }) {
  const canPickAny = Boolean(revealedPlayer);

  function canPickAttr(key) {
    return canPickAny && locked[key] === null;
  }

  return (
    <div className="player-model">
      <div className="model-column left">
        {LEFT_ATTRIBUTES.map(({ key, bodyPart }) => (
          <AttributeChip
            key={key}
            attrKey={key}
            bodyPart={bodyPart}
            locked={locked}
            canPick={canPickAttr(key)}
            onPick={onPick}
          />
        ))}
      </div>
      <div className="model-figure">
        <TennisSilhouette />
      </div>
      <div className="model-column right">
        {RIGHT_ATTRIBUTES.map(({ key, bodyPart }) => (
          <AttributeChip
            key={key}
            attrKey={key}
            bodyPart={bodyPart}
            locked={locked}
            canPick={canPickAttr(key)}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
