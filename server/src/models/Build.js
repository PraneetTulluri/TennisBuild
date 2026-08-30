import mongoose from "mongoose";
import { ATTRIBUTE_KEYS, ELO_STARTING_RATING } from "@tennisbuild/game-engine";

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
    value: { type: Number, required: true, min: 1, max: 110 },
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
    // Always set (the guest session id generated once per browser and
    // stored in localStorage - see client/src/utils/guestSession.js),
    // kept even after a build is claimed by an account so its origin
    // stays on record. `userId` is only set once someone is logged in
    // when the build is saved, or if it's claimed afterward via
    // POST /api/auth/claim-guest-builds.
    guestSessionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
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
      goatIsAllTimeGreat: Boolean,
      legacyScore: Number,
      retirementReason: String,
    },
    // PvP ladder standing for this specific build (see routes/pvp.js) -
    // tracked per-build, not per-user, since a "team" is just 3 builds
    // and the site's whole mental model is already build-centric (the
    // main Leaderboard, GOAT ranking, etc. all rank builds, not
    // accounts). `wins`/`losses` only increment when this build is on
    // the *challenging* side of a tie - a defending build's elo still
    // moves from ties it's pulled into (a defense that's never tested
    // shouldn't out-rank one that keeps winning), but its win/loss
    // record doesn't, since it didn't choose to fight.
    pvp: {
      elo: { type: Number, default: ELO_STARTING_RATING },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Build = mongoose.model("Build", buildSchema);
