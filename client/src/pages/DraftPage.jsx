import { useEffect, useState } from "react";
import { ATTRIBUTE_LABELS, isDraftComplete } from "@tennisbuild/game-engine";
import { fetchPlayers } from "../api/players.js";
import { useDraftState } from "../state/draftState.js";
import Wheel from "../components/Wheel/Wheel.jsx";
import AttributeCard from "../components/AttributeCard/AttributeCard.jsx";
import PlayerModel from "../components/PlayerModel/PlayerModel.jsx";

export default function DraftPage() {
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlayers()
      .then(setPlayers)
      .catch((err) => setError(err.message));
  }, []);

  const { state, spinning, targetPlayer, spin, handleSpinComplete, pick } =
    useDraftState(players);

  const complete = isDraftComplete(state);
  const canSpin = !spinning && state.phase === "idle" && !complete && players.length > 0;

  if (error) {
    return (
      <div className="draft-page">
        <p className="draft-error">Could not load players: {error}</p>
      </div>
    );
  }

  return (
    <div className="draft-page">
      <div className="draft-progress">
        <span>
          Round {Math.min(state.round, state.totalRounds)} of {state.totalRounds}
        </span>
        <div className="draft-progress-dots">
          {Array.from({ length: state.totalRounds }, (_, i) => (
            <span
              key={i}
              className={`progress-dot${i < state.round - 1 ? " filled" : ""}`}
            />
          ))}
        </div>
      </div>

      {players.length === 0 && !error && <p>Loading players…</p>}

      {players.length > 0 && (
        <>
          <Wheel
            players={players}
            targetPlayer={targetPlayer}
            spinning={spinning}
            onSpinComplete={handleSpinComplete}
          />

          <button
            type="button"
            className="spin-button"
            disabled={!canSpin}
            onClick={spin}
          >
            {complete ? "Draft Complete" : spinning ? "Spinning…" : "SPIN"}
          </button>

          {state.phase === "revealed" && state.revealedPlayer && (
            <AttributeCard
              player={state.revealedPlayer}
              locked={state.locked}
              onPick={pick}
            />
          )}

          <PlayerModel
            locked={state.locked}
            revealedPlayer={state.revealedPlayer}
            onPick={pick}
          />

          {complete && (
            <div className="draft-summary">
              <h2>Your Build</h2>
              <ul className="draft-summary-list">
                {Object.entries(state.locked).map(([key, entry]) => (
                  <li key={key}>
                    <span>{ATTRIBUTE_LABELS[key]}</span>
                    <strong>{entry.value}</strong>
                    <em>from {entry.fromPlayerName}</em>
                  </li>
                ))}
              </ul>
              <p className="draft-summary-note">
                Full rated result page (overall, archetype, strengths &amp; weaknesses)
                coming in Phase 5.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
