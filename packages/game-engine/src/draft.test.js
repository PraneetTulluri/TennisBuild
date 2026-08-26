import { describe, it, expect } from "vitest";
import {
  createDraftState,
  revealPlayer,
  pickAttribute,
  spendRespin,
  spendSnag,
  getUnlockedAttributeKeys,
  isDraftComplete,
} from "./draft.js";

const TEST_ATTRIBUTES = ["forehand", "serve"];

function samplePlayer(overrides = {}) {
  return {
    name: "Test Player",
    slug: "test-player",
    attributes: { forehand: 80, serve: 70 },
    ...overrides,
  };
}

describe("createDraftState", () => {
  it("starts at round 1, idle, with every attribute unlocked", () => {
    const state = createDraftState(TEST_ATTRIBUTES);
    expect(state.round).toBe(1);
    expect(state.phase).toBe("idle");
    expect(state.locked).toEqual({ forehand: null, serve: null });
    expect(state.revealedPlayer).toBeNull();
  });
});

describe("revealPlayer", () => {
  it("moves phase from idle to revealed and stores the player", () => {
    const state = createDraftState(TEST_ATTRIBUTES);
    const player = samplePlayer();
    const next = revealPlayer(state, player);
    expect(next.phase).toBe("revealed");
    expect(next.revealedPlayer).toBe(player);
  });

  it("throws if a player is already revealed", () => {
    const state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer());
    expect(() => revealPlayer(state, samplePlayer())).toThrow();
  });
});

describe("pickAttribute", () => {
  it("locks in the revealed player's value and advances the round", () => {
    const revealed = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer());
    const next = pickAttribute(revealed, "forehand");
    expect(next.locked.forehand).toEqual({
      value: 80,
      fromPlayerName: "Test Player",
      fromPlayerSlug: "test-player",
    });
    expect(next.round).toBe(2);
    expect(next.phase).toBe("idle");
    expect(next.revealedPlayer).toBeNull();
    expect(next.history).toHaveLength(1);
  });

  it("throws when no player is revealed", () => {
    const state = createDraftState(TEST_ATTRIBUTES);
    expect(() => pickAttribute(state, "forehand")).toThrow();
  });

  it("throws when picking an already-locked attribute", () => {
    let state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer());
    state = pickAttribute(state, "forehand");
    state = revealPlayer(state, samplePlayer());
    expect(() => pickAttribute(state, "forehand")).toThrow();
  });

  it("throws on an unknown attribute key", () => {
    const state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer());
    expect(() => pickAttribute(state, "notARealAttribute")).toThrow();
  });

  it("reaches phase complete exactly after the final round", () => {
    let state = createDraftState(TEST_ATTRIBUTES);
    state = pickAttribute(revealPlayer(state, samplePlayer()), "forehand");
    expect(isDraftComplete(state)).toBe(false);
    state = pickAttribute(revealPlayer(state, samplePlayer()), "serve");
    expect(isDraftComplete(state)).toBe(true);
    expect(state.round).toBe(3);
  });
});

describe("spendRespin", () => {
  it("discards the reveal, returns to idle, and spends the charge", () => {
    const state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer());
    const next = spendRespin(state);
    expect(next.phase).toBe("idle");
    expect(next.revealedPlayer).toBeNull();
    expect(next.respinsRemaining).toBe(0);
    expect(next.round).toBe(1); // respinning doesn't advance the round
  });

  it("throws when no respins remain", () => {
    let state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer());
    state = spendRespin(state);
    state = revealPlayer(state, samplePlayer());
    expect(() => spendRespin(state)).toThrow();
  });

  it("throws when no player is revealed", () => {
    expect(() => spendRespin(createDraftState(TEST_ATTRIBUTES))).toThrow();
  });
});

describe("spendSnag", () => {
  const left = samplePlayer({ name: "Left Neighbor", slug: "left-neighbor" });
  const right = samplePlayer({ name: "Right Neighbor", slug: "right-neighbor" });

  it("swaps the revealed player to the chosen neighbor and spends the charge", () => {
    const state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer(), {
      left,
      right,
    });
    const next = spendSnag(state, "right");
    expect(next.revealedPlayer).toBe(right);
    expect(next.phase).toBe("revealed"); // snagging doesn't cost a round either
    expect(next.snagsRemaining).toBe(0);
    expect(next.revealedNeighbors).toBeNull();
  });

  it("throws when no snags remain", () => {
    let state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer(), {
      left,
      right,
    });
    state = spendSnag(state, "left");
    state = { ...state, revealedNeighbors: { left, right } }; // simulate a later reveal with neighbors
    expect(() => spendSnag(state, "right")).toThrow();
  });

  it("throws when the requested side has no neighbor", () => {
    const state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer(), {
      left,
      right: null,
    });
    expect(() => spendSnag(state, "right")).toThrow();
  });

  it("throws on an invalid side", () => {
    const state = revealPlayer(createDraftState(TEST_ATTRIBUTES), samplePlayer(), {
      left,
      right,
    });
    expect(() => spendSnag(state, "up")).toThrow();
  });
});

describe("getUnlockedAttributeKeys", () => {
  it("shrinks as attributes get locked", () => {
    let state = createDraftState(TEST_ATTRIBUTES);
    expect(getUnlockedAttributeKeys(state)).toEqual(["forehand", "serve"]);
    state = pickAttribute(revealPlayer(state, samplePlayer()), "forehand");
    expect(getUnlockedAttributeKeys(state)).toEqual(["serve"]);
  });
});
