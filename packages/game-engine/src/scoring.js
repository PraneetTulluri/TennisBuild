import { ATTRIBUTE_KEYS } from "./attributes.js";
import { ARCHETYPES, SURFACES } from "./archetypes.js";

/**
 * Weighted average of a build's attributes against a template's weight
 * vector, normalized back to the same 1-99 scale the inputs are on. This
 * is the core trick that makes archetype/surface scoring meaningfully
 * different from a flat average: an attribute the template cares about a
 * lot pulls the score toward its value more than one the template barely
 * cares about, so a specialist build only scores well against a template
 * that actually rewards its specialty.
 */
function weightedScore(attributes, weights) {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const weight = weights[key] ?? 1;
    weightedSum += attributes[key] * weight;
    weightTotal += weight;
  }
  return weightedSum / weightTotal;
}

/**
 * Scores a build against every template in `templates` and returns the
 * best match plus its score. Shared by archetype and surface scoring -
 * they're the same "best fit against a set of weighted profiles"
 * computation, just with different template sets.
 */
function bestMatch(attributes, templates) {
  let best = null;
  for (const template of templates) {
    const score = weightedScore(attributes, template.weights);
    if (!best || score > best.score) {
      best = { key: template.key, label: template.label, score };
    }
  }
  return best;
}

/** Which of the 6 archetypes this build fits best, and its score. */
export function computeArchetype(attributes) {
  return bestMatch(attributes, ARCHETYPES);
}

/** Which of the 3 surfaces this build is best suited to, and its score. */
export function computeBestSurface(attributes) {
  return bestMatch(attributes, SURFACES);
}

/**
 * Overall rating: the score of the build's best-fitting archetype,
 * rounded to a whole number. A specialist and a generalist build with the
 * same raw attribute sum can land on different overalls here, because
 * they're each measured against the template they fit best - which is
 * the point (see the Phase 0 design doc's scoring-model rationale).
 */
export function computeOverall(attributes) {
  return Math.round(computeArchetype(attributes).score);
}

/**
 * Top/bottom attributes by raw value, for a "strengths & weaknesses"
 * summary. `count` controls how many of each to return.
 */
export function computeStrengthsAndWeaknesses(attributes, count = 3) {
  const sorted = [...ATTRIBUTE_KEYS].sort((a, b) => attributes[b] - attributes[a]);
  return {
    strengths: sorted.slice(0, count).map((key) => ({ key, value: attributes[key] })),
    weaknesses: sorted
      .slice(-count)
      .reverse()
      .map((key) => ({ key, value: attributes[key] })),
  };
}

/** Straight-line distance between two attribute vectors - smaller means more similar builds. */
function attributeDistance(a, b) {
  let sumSquares = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const diff = a[key] - b[key];
    sumSquares += diff * diff;
  }
  return Math.sqrt(sumSquares);
}

/**
 * The `count` real players (from `pool`) whose attribute profile is
 * closest to this build's, for a "you play like..." comparison. Distance
 * is computed across all 8 attributes at once, so a comp has to be
 * similar in overall shape, not just share one standout stat.
 */
export function nearestPlayerComps(attributes, pool, count = 3) {
  return [...pool]
    .map((player) => ({
      player,
      distance: attributeDistance(attributes, player.attributes),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ player }) => player);
}
