import mongoose from "mongoose";
import { ATTRIBUTE_KEYS } from "@tennisbuild/game-engine";

// A saved custom player build. Stores `locked` in the exact shape the
// draft engine produces it (state.locked: each attribute key -> { value,
// fromPlayerName, fromPlayerSlug }) rather than a flat attributes map, so
// a revisited build can still show "via <player>" attribution and so
// overall/archetype/etc. can be recomputed client-side the same way a
// freshly-finished build is - the derived stats are never stored here,
// only the inputs needed to recompute them, which avoids ever having a
// stale cached "derived" blob drift out of sync with the scoring engine.
const lockedEntrySchema = new mongoose.Schema(
  {
    value: { type: Number, required: true, min: 1, max: 105 },
    fromPlayerName: { type: String, required: true },
    fromPlayerSlug: { type: String, required: true },
  },
  { _id: false }
);

const lockedFields = {};
for (const key of ATTRIBUTE_KEYS) {
  lockedFields[key] = { type: lockedEntrySchema, required: true };
}

const buildSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // No auth yet (that's a later phase) - a random id generated once per
    // browser and stored in localStorage is what "my builds" filters by.
    guestSessionId: { type: String, required: true, index: true },
    locked: {
      type: new mongoose.Schema(lockedFields, { _id: false }),
      required: true,
    },
    flavor: {
      handedness: { type: String, enum: ["left", "right"] },
      country: String,
      heightCm: Number,
    },
    // Filled in later via PATCH /api/builds/:id/career once a simulated
    // career (run separately, client-side) reaches retirement - a build
    // can be saved without ever simulating a career.
    career: {
      simulated: { type: Boolean, default: false },
      seasonsPlayed: Number,
      slamTitles: Number,
      masterTitles: Number,
      titles: Number,
      peakRanking: Number,
      retirementAge: Number,
      careerRecordWins: Number,
      careerRecordLosses: Number,
      goatRank: Number,
      goatTotal: Number,
    },
  },
  { timestamps: true }
);

export const Build = mongoose.model("Build", buildSchema);
