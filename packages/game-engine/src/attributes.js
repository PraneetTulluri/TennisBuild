// Single source of truth for the 8 MVP attribute categories. Both the
// server (Player schema validation) and the client (draft UI labels, body
// diagram) import this rather than each keeping their own copy - previously
// server/src/models/Player.js hardcoded its own duplicate array, which is
// exactly the kind of drift risk a shared package exists to prevent.
export const ATTRIBUTE_KEYS = [
  "forehand",
  "backhand",
  "serve",
  "return",
  "volley",
  "movement",
  "power",
  "mentalToughness",
];

// Human-readable labels for UI display (e.g. attribute chips, the revealed
// player's card). Keyed by the same strings as ATTRIBUTE_KEYS.
export const ATTRIBUTE_LABELS = {
  forehand: "Forehand",
  backhand: "Backhand",
  serve: "Serve",
  return: "Return",
  volley: "Volley",
  movement: "Movement",
  power: "Power",
  mentalToughness: "Mental Toughness",
};
