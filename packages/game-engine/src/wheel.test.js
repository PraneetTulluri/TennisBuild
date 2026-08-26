import { describe, it, expect } from "vitest";
import { pickRandom, pickDistinct } from "./wheel.js";

describe("pickRandom", () => {
  it("returns an element that is actually a member of the input array", () => {
    const items = ["federer", "nadal", "djokovic"];
    const result = pickRandom(items);
    expect(items).toContain(result);
  });

  it("throws on an empty array instead of silently returning undefined", () => {
    expect(() => pickRandom([])).toThrow();
  });

  it("distributes across all items over many draws (not stuck on one)", () => {
    const items = ["a", "b", "c"];
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      seen.add(pickRandom(items));
    }
    expect(seen.size).toBe(items.length);
  });
});

describe("pickDistinct", () => {
  it("returns the requested number of elements with no duplicates", () => {
    const items = ["a", "b", "c", "d", "e"];
    const result = pickDistinct(items, 3);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    for (const item of result) expect(items).toContain(item);
  });

  it("throws rather than looping forever when count exceeds the pool size", () => {
    expect(() => pickDistinct(["a", "b"], 3)).toThrow();
  });

  it("can pick every item when count equals the pool size", () => {
    const items = ["a", "b", "c"];
    const result = pickDistinct(items, 3);
    expect(new Set(result)).toEqual(new Set(items));
  });
});
