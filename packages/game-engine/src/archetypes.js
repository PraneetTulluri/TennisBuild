// Archetype and surface templates: each is a weight vector over the 8 MVP
// attributes. Scoring a build against a template is a weighted average -
// see scoring.js - so a template's weights say "how much this attribute
// matters for this identity", not an absolute cap. Weights are centered
// around 1.0 (neutral); above 1 rewards the attribute more, below 1
// rewards it less. These numbers are a first-pass calibration, not a
// precisely tuned formula - reasonable to revisit once real builds get
// played and something clearly always wins or never gets picked.

const NEUTRAL = {
  forehand: 1,
  backhand: 1,
  serve: 1,
  return: 1,
  volley: 1,
  movement: 1,
  power: 1,
  mentalToughness: 1,
};

export const ARCHETYPES = [
  {
    key: "bigServer",
    label: "Big Server",
    weights: { ...NEUTRAL, serve: 1.4, power: 1.2, return: 0.8, movement: 0.8 },
  },
  {
    key: "baselineGrinder",
    label: "Baseline Grinder",
    weights: {
      ...NEUTRAL,
      movement: 1.3,
      mentalToughness: 1.3,
      forehand: 1.2,
      backhand: 1.2,
      serve: 0.8,
    },
  },
  {
    key: "aggressiveBaseliner",
    label: "Aggressive Baseliner",
    weights: { ...NEUTRAL, forehand: 1.4, power: 1.3, mentalToughness: 1.1 },
  },
  {
    key: "counterpuncher",
    label: "Counterpuncher",
    weights: { ...NEUTRAL, movement: 1.4, mentalToughness: 1.3, return: 1.2, power: 0.7 },
  },
  {
    key: "serveAndVolley",
    label: "Serve-and-Volley",
    weights: { ...NEUTRAL, serve: 1.3, volley: 1.5, movement: 1.1, backhand: 0.8 },
  },
  {
    key: "completePlayer",
    label: "Complete Player",
    // Deliberately close to neutral (rewards balance across the board)
    // rather than spiking any single attribute, so a well-rounded build
    // that isn't the best at any one thing can still win this template.
    weights: {
      forehand: 1.1,
      backhand: 1.1,
      serve: 1.1,
      return: 1.1,
      volley: 1.1,
      movement: 1.1,
      power: 1.1,
      mentalToughness: 1.1,
    },
  },
];

export const SURFACES = [
  {
    key: "clay",
    label: "Clay",
    weights: {
      ...NEUTRAL,
      movement: 1.3,
      mentalToughness: 1.2,
      forehand: 1.1,
      backhand: 1.1,
      serve: 0.8,
      power: 0.9,
    },
  },
  {
    key: "grass",
    label: "Grass",
    weights: { ...NEUTRAL, serve: 1.3, volley: 1.3, power: 1.1, movement: 0.9 },
  },
  {
    key: "hard",
    label: "Hard",
    // Roughly neutral - hard courts are tennis's "no strong surface bias"
    // baseline, sitting between clay's grinding and grass's speed.
    weights: { ...NEUTRAL, serve: 1.05, power: 1.05 },
  },
];
