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
    // The two players flanking the landed one, when the caller supplies
    // them (see revealPlayer) - what spendSnag swaps revealedPlayer to.
    revealedNeighbors: null, // { left, right } | null
    respinsRemaining: 1,
    snagsRemaining: 1,
    history: [],
  };
}

/**
 * Records the result of a wheel spin: the given player is now revealed,
 * awaiting an attribute pick. The random draw itself (e.g. pickRandom/
 * pickDistinct from wheel.js over the player pool) happens in the caller -
 * this function only records the outcome. `neighbors`, if supplied, are
 * the two players flanking the landed one - what a snag can swap to.
 */
export function revealPlayer(state, player, neighbors = null) {
  if (state.phase !== "idle") {
    throw new Error(
      `Cannot reveal a player while phase is "${state.phase}" (expected "idle")`
    );
  }
  return {
    ...state,
    phase: "revealed",
    revealedPlayer: player,
    revealedNeighbors: neighbors,
  };
}

/**
 * Spends the one-per-build respin: discards the current reveal and drops
 * back to "idle" so the caller can immediately spin again for the same
 * round (the round number doesn't change - a respin re-rolls this round,
 * it doesn't skip it).
 */
export function spendRespin(state) {
  if (state.phase !== "revealed") {
    throw new Error("Cannot respin: no player is currently revealed");
  }
  if (state.respinsRemaining <= 0) {
    throw new Error("No respins remaining");
  }
  return {
    ...state,
    phase: "idle",
    revealedPlayer: null,
    revealedNeighbors: null,
    respinsRemaining: state.respinsRemaining - 1,
  };
}

/**
 * Spends the one-per-build snag: swaps the currently revealed player for
 * whichever flanking neighbor ("left" or "right") was supplied to
 * revealPlayer, so the very next pickAttribute drafts from the snagged
 * player instead. Stays in the "revealed" phase - a snag doesn't cost a
 * round, it just changes who this round's pick comes from.
 */
export function spendSnag(state, side) {
  if (side !== "left" && side !== "right") {
    throw new Error(`Invalid snag side: "${side}" (expected "left" or "right")`);
  }
  if (state.phase !== "revealed") {
    throw new Error("Cannot snag: no player is currently revealed");
  }
  if (state.snagsRemaining <= 0) {
    throw new Error("No snags remaining");
  }
  const neighbor = state.revealedNeighbors?.[side];
  if (!neighbor) {
    throw new Error(`No ${side} neighbor available to snag`);
  }
  return {
    ...state,
    revealedPlayer: neighbor,
    revealedNeighbors: null, // spent - no re-snagging this same reveal
    snagsRemaining: state.snagsRemaining - 1,
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
    revealedNeighbors: null,
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
