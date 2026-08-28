// Barrel file: the single public entry point for @tennisbuild/game-engine.
// Both client and server import from here (e.g. `import { pickRandom } from
// "@tennisbuild/game-engine"`) rather than reaching into individual files,
// so internal reorganization of this package never breaks its consumers.

export { pickRandom, pickDistinct } from "./wheel.js";
export { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "./attributes.js";
export {
  createDraftState,
  revealPlayer,
  pickAttribute,
  spendRespin,
  spendSnag,
  getUnlockedAttributeKeys,
  isDraftComplete,
} from "./draft.js";
export { ARCHETYPES, SURFACES } from "./archetypes.js";
export {
  computeArchetype,
  computeBestSurface,
  computeSurfaceStrength,
  computeOverall,
  computeStrengthsAndWeaknesses,
  nearestPlayerComps,
} from "./scoring.js";
export {
  SLAM_CALENDAR,
  SLAM_RESULT_POINTS,
  DEFAULT_SLIDERS,
  LIFE_EVENTS,
  pointsToRanking,
  createCareerState,
  simulateNextSeason,
  retireNow,
  summarizeCareer,
  pickLifeEvent,
  shouldOfferLifeEvent,
  resolveLifeEventChoice,
} from "./career.js";
export { GOAT_BENCHMARKS, computeGoatScore, computeGoatRanking } from "./goat.js";
