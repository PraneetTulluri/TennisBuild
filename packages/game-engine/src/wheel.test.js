import { describe, it, expect } from "vitest";
import { pickRandom } from "./wheel.js";

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
