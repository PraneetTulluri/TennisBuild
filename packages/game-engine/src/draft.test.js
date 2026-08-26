import { describe, it, expect } from "vitest";
import {
  createDraftState,
  revealPlayer,
  pickAttribute,
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

describe("getUnlockedAttributeKeys", () => {
  it("shrinks as attributes get locked", () => {
    let state = createDraftState(TEST_ATTRIBUTES);
    expect(getUnlockedAttributeKeys(state)).toEqual(["forehand", "serve"]);
    state = pickAttribute(revealPlayer(state, samplePlayer()), "forehand");
    expect(getUnlockedAttributeKeys(state)).toEqual(["serve"]);
  });
});
