import { useCallback, useState } from "react";
import {
  createDraftState,
  revealPlayer,
  pickAttribute,
  pickRandom,
} from "@tennisbuild/game-engine";

/**
 * Thin React wrapper around the game-engine's draft state machine. Holds
 * no game logic of its own - every state transition is delegated to
 * @tennisbuild/game-engine functions, so "what happens when you pick an
 * attribute" stays defined (and tested) in one place, not duplicated here.
 *
 * `spinning`/`targetPlayer` track the in-progress spin animation, which is
 * a UI-only concern (the engine's `state.phase` only knows "idle" vs.
 * "revealed" vs. "complete" - it doesn't know or care that a visual
 * animation is playing in between).
 */
export function useDraftState(players) {
  const [state, setState] = useState(() => createDraftState());
  const [spinning, setSpinning] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState(null);

  const spin = useCallback(() => {
    if (spinning || state.phase !== "idle" || players.length === 0) return;
    setTargetPlayer(pickRandom(players));
    setSpinning(true);
  }, [spinning, state.phase, players]);

  const handleSpinComplete = useCallback(() => {
    setSpinning(false);
    setState((prev) => (targetPlayer ? revealPlayer(prev, targetPlayer) : prev));
  }, [targetPlayer]);

  const pick = useCallback((attributeKey) => {
    setState((prev) => pickAttribute(prev, attributeKey));
    setTargetPlayer(null);
  }, []);

  return { state, spinning, targetPlayer, spin, handleSpinComplete, pick };
}
