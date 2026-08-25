// Barrel file: the single public entry point for @tennisbuild/game-engine.
// Both client and server import from here (e.g. `import { pickRandom } from
// "@tennisbuild/game-engine"`) rather than reaching into individual files,
// so internal reorganization of this package never breaks its consumers.

export { pickRandom } from "./wheel.js";
