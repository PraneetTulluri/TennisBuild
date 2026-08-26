import { useCallback, useState } from "react";
import {
  createDraftState,
  revealPlayer,
  pickAttribute,
  spendRespin,
  spendSnag,
  pickRandom,
  pickDistinct,
} from "@tennisbuild/game-engine";

/**
 * Draws a spin's target player plus its two flanking "snag" neighbors, all
 * distinct. Falls back to a plain pickRandom with no neighbors if the pool
 * is too small for three distinct picks (defensive - the real 50-player
 * pool never hits this, but a test or a future smaller game mode might).
 */
function drawSpin(players) {
  if (players.length < 3) {
    return { target: pickRandom(players), neighbors: null };
  }
  const [target, left, right] = pickDistinct(players, 3);
  return { target, neighbors: { left, right } };
}

/**
 * Thin React wrapper around the game-engine's draft state machine. Holds
 * no game logic of its own - every state transition is delegated to
 * @tennisbuild/game-engine functions, so "what happens when you pick an
 * attribute" stays defined (and tested) in one place, not duplicated here.
 *
 * `spinning`/`targetPlayer`/`targetNeighbors` track the in-progress spin
 * animation, which is a UI-only concern (the engine's `state.phase` only
 * knows "idle" vs. "revealed" vs. "complete" - it doesn't know or care
 * that a visual animation is playing in between).
 */
export function useDraftState(players) {
  const [state, setState] = useState(() => createDraftState());
  const [spinning, setSpinning] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState(null);
  const [targetNeighbors, setTargetNeighbors] = useState(null);

  const spin = useCallback(() => {
    if (spinning || state.phase !== "idle" || players.length === 0) return;
    const { target, neighbors } = drawSpin(players);
    setTargetPlayer(target);
    setTargetNeighbors(neighbors);
    setSpinning(true);
  }, [spinning, state.phase, players]);

  const handleSpinComplete = useCallback(() => {
    setSpinning(false);
    setState((prev) =>
      targetPlayer ? revealPlayer(prev, targetPlayer, targetNeighbors) : prev
    );
  }, [targetPlayer, targetNeighbors]);

  const pick = useCallback((attributeKey) => {
    setState((prev) => pickAttribute(prev, attributeKey));
    setTargetPlayer(null);
    setTargetNeighbors(null);
  }, []);

  // Respin: spend the charge (discarding the current reveal) and
  // immediately draw + start a fresh spin for the same round.
  const respin = useCallback(() => {
    if (spinning || state.phase !== "revealed" || state.respinsRemaining <= 0) return;
    setState((prev) => spendRespin(prev));
    const { target, neighbors } = drawSpin(players);
    setTargetPlayer(target);
    setTargetNeighbors(neighbors);
    setSpinning(true);
  }, [spinning, state.phase, state.respinsRemaining, players]);

  // Snag: swap the revealed player to a flanking neighbor - no spin
  // animation needed, it's an instant substitution.
  const snag = useCallback((side) => {
    setState((prev) => spendSnag(prev, side));
  }, []);

  return {
    state,
    spinning,
    targetPlayer,
    targetNeighbors,
    spin,
    handleSpinComplete,
    pick,
    respin,
    snag,
  };
}
