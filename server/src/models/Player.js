import mongoose from "mongoose";

// The 8 MVP attribute categories (see Phase 0 design doc). Every Player
// document must have a rating for each of these, 1-99, since a round can
// land on any player and reveal their full card.
const ATTRIBUTE_KEYS = [
  "forehand",
  "backhand",
  "serve",
  "return",
  "volley",
  "movement",
  "power",
  "mentalToughness",
];

// Build the attributes sub-schema programmatically from ATTRIBUTE_KEYS
// instead of writing out 8 near-identical field definitions by hand -
// this also means adding/removing an attribute later is a one-line change
// in ATTRIBUTE_KEYS rather than an easy-to-miss edit in multiple places.
const attributeFields = {};
for (const key of ATTRIBUTE_KEYS) {
  attributeFields[key] = {
    type: Number,
    required: true,
    min: 1,
    max: 99,
  };
}

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    country: { type: String, required: true },
    handedness: { type: String, enum: ["left", "right"], required: true },
    heightCm: { type: Number, required: true },
    careerStatus: {
      type: String,
      enum: ["active", "retired", "legend"],
      required: true,
    },
    // Not used by any game logic yet - reserved for a future rarity/game-mode
    // mechanic (see Phase 10) so we don't have to migrate the schema later.
    tier: {
      type: String,
      enum: ["legend", "current", "journeyman"],
      required: true,
    },
    attributes: {
      type: attributeFields,
      required: true,
    },
    flavorText: {
      type: Map,
      of: String,
      default: {},
    },
    bio: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Player = mongoose.model("Player", playerSchema);
export { ATTRIBUTE_KEYS };
