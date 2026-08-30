import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ATTRIBUTE_LABELS, isDraftComplete } from "@tennisbuild/game-engine";
import { fetchPlayers } from "../api/players.js";
import { useDraftState } from "../state/draftState.js";
import Wheel from "../components/Wheel/Wheel.jsx";
import AttributeCard from "../components/AttributeCard/AttributeCard.jsx";
import PlayerModel from "../components/PlayerModel/PlayerModel.jsx";
import { LiquidButton } from "../components/animate-ui/components/buttons/liquid.jsx";

export default function DraftPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlayers()
      .then(setPlayers)
      .catch((err) => setError(err.message));
  }, []);

  const {
    state,
    spinning,
    targetPlayer,
    targetNeighbors,
    spin,
    handleSpinComplete,
    pick,
    respin,
    snag,
  } = useDraftState(players);

  const complete = isDraftComplete(state);
  const revealed = state.phase === "revealed" && state.revealedPlayer;
  const canSpin = !spinning && state.phase === "idle" && !complete && players.length > 0;
  const canRespin = !spinning && revealed && state.respinsRemaining > 0;

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
        <div className="draft-charges">
          <span>🔄 Respin ×{state.respinsRemaining}</span>
          <span>🤝 Snag ×{state.snagsRemaining}</span>
        </div>
      </div>

      {players.length === 0 && !error && <p>Loading players…</p>}

      {players.length > 0 && (
        <>
          <Wheel
            players={players}
            targetPlayer={targetPlayer}
            targetNeighbors={targetNeighbors}
            spinning={spinning}
            onSpinComplete={handleSpinComplete}
          />

          <div className="draft-actions">
            <LiquidButton variant="tennis" size="lg" disabled={!canSpin} onClick={spin}>
              {complete ? "Draft Complete" : spinning ? "Spinning…" : "SPIN"}
            </LiquidButton>
            <button
              type="button"
              className="secondary-button"
              disabled={!canRespin}
              onClick={respin}
            >
              Respin ({state.respinsRemaining} left)
            </button>
          </div>

          {revealed && (
            <AttributeCard
              player={state.revealedPlayer}
              locked={state.locked}
              onPick={pick}
              neighbors={state.revealedNeighbors}
              snagsRemaining={state.snagsRemaining}
              onSnag={snag}
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
              <button
                type="button"
                className="spin-button"
                onClick={() =>
                  navigate("/result", {
                    state: {
                      locked: state.locked,
                      history: state.history,
                      playerPool: players,
                    },
                  })
                }
              >
                See Full Result
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
