/**
 * Picks a random element from an array using a uniform distribution.
 *
 * This is a small building block for the wheel-spin mechanic (Phase 3 will
 * build the full weighted spin resolver, attribute-lock rules, etc. on top
 * of this package). For Phase 1 it exists to prove the game-engine package
 * is a real, importable, testable module before any UI or API is wired to it.
 *
 * @param {Array} items - a non-empty array to pick from
 * @returns {*} one randomly chosen element from items
 */
export function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("pickRandom requires a non-empty array");
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}
