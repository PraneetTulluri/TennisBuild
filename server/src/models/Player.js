import mongoose from "mongoose";
import { ATTRIBUTE_KEYS } from "@tennisbuild/game-engine";

// ATTRIBUTE_KEYS now comes from the shared game-engine package rather than
// being hardcoded here - the client's draft UI needs the exact same list
// (for labels, lock-state tracking, etc.), and keeping two copies in sync
// by hand was exactly the kind of drift risk a shared source of truth
// exists to avoid.

// Build the attributes sub-schema programmatically from ATTRIBUTE_KEYS
// instead of writing out 8 near-identical field definitions by hand -
// this also means adding/removing an attribute later is a one-line change
// in ATTRIBUTE_KEYS rather than an easy-to-miss edit in multiple places.
// The scale is 1-99 for almost everyone, but a small handful of the most
// iconic legends have one signature attribute pushed past the normal
// ceiling (up to 105) - representing a skill so exceptional that even a
// "perfect 99" undersells it (see RATINGS_METHODOLOGY.md). This is
// deliberately rare - most players still cap at 99.
const attributeFields = {};
for (const key of ATTRIBUTE_KEYS) {
  attributeFields[key] = {
    type: Number,
    required: true,
    min: 1,
    max: 105,
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
    // Wrapping attributeFields in its own Schema (rather than passing the
    // plain object directly as `type`) lets us turn off the auto-generated
    // _id Mongoose otherwise adds to every nested subdocument - we don't
    // need to address an individual attribute set by its own id, and a
    // stray _id here was leaking into every /api/players response.
    attributes: {
      type: new mongoose.Schema(attributeFields, { _id: false }),
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
