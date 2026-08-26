import { ATTRIBUTE_KEYS } from "./attributes.js";

// Pure state-transition functions for the 8-round wheel-and-draft loop.
// Deliberately framework-agnostic (no React) so "what happens when you
// pick an attribute" is testable and correct on its own, independent of
// any UI - the client only needs to call these and re-render on the
// result. Every function returns a *new* state object rather than
// mutating its input, which is what lets React treat each result as a
// fresh value to re-render from.

/**
 * Starts a new draft: every attribute unlocked, round 1, no player
 * revealed yet.
 */
export function createDraftState(attributeKeys = ATTRIBUTE_KEYS) {
  const locked = {};
  for (const key of attributeKeys) {
    locked[key] = null;
  }
  return {
    round: 1,
    totalRounds: attributeKeys.length,
    phase: "idle", // "idle" -> "revealed" -> "idle" (repeat) -> "complete"
    locked,
    revealedPlayer: null,
    history: [],
  };
}

/**
 * Records the result of a wheel spin: the given player is now revealed,
 * awaiting an attribute pick. The random draw itself (e.g. pickRandom from
 * wheel.js over the player pool) happens in the caller - this function
 * only records the outcome.
 */
export function revealPlayer(state, player) {
  if (state.phase !== "idle") {
    throw new Error(
      `Cannot reveal a player while phase is "${state.phase}" (expected "idle")`
    );
  }
  return {
    ...state,
    phase: "revealed",
    revealedPlayer: player,
  };
}

/**
 * Locks in the revealed player's value for attributeKey, advances the
 * round, and clears the revealed player. Throws on invalid transitions
 * (no player revealed, attribute already locked, unknown key) instead of
 * silently corrupting state - these are all bugs in the caller, not
 * situations to degrade gracefully from.
 */
export function pickAttribute(state, attributeKey) {
  if (state.phase !== "revealed" || !state.revealedPlayer) {
    throw new Error("Cannot pick an attribute: no player is currently revealed");
  }
  if (!(attributeKey in state.locked)) {
    throw new Error(`Unknown attribute key: "${attributeKey}"`);
  }
  if (state.locked[attributeKey] !== null) {
    throw new Error(`Attribute "${attributeKey}" is already locked`);
  }

  const player = state.revealedPlayer;
  const value = player.attributes[attributeKey];

  const nextRound = state.round + 1;
  const nextPhase = nextRound > state.totalRounds ? "complete" : "idle";

  return {
    ...state,
    round: nextRound,
    phase: nextPhase,
    revealedPlayer: null,
    locked: {
      ...state.locked,
      [attributeKey]: { value, fromPlayerName: player.name, fromPlayerSlug: player.slug },
    },
    history: [
      ...state.history,
      {
        round: state.round,
        attributeKey,
        value,
        player: { name: player.name, slug: player.slug },
      },
    ],
  };
}

/** Attribute keys that haven't been locked in yet. */
export function getUnlockedAttributeKeys(state) {
  return Object.keys(state.locked).filter((key) => state.locked[key] === null);
}

export function isDraftComplete(state) {
  return state.phase === "complete";
}
