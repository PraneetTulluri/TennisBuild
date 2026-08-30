import mongoose from "mongoose";

// One resolved async PvP tie: a challenger's team of 3 builds against a
// defender's team of 3, on one randomly-rolled surface, fully simulated
// server-side the instant the challenge is made (see routes/pvp.js) - no
// live/real-time component, so this document *is* the complete record of
// what happened, not a snapshot of an in-progress match. The full
// game-by-game breakdown is stored (not just final scores) so the client
// can play a past tie back the same way it played the live one, not just
// show a flat number.
const setSchema = new mongoose.Schema(
  {
    // "A"/"B" per game, "A" always meaning the challenger's build for
    // that match slot - matches the engine's own A/B convention.
    games: { type: [String], required: true },
    challengerGames: { type: Number, required: true },
    defenderGames: { type: Number, required: true },
    winner: { type: String, enum: ["challenger", "defender"], required: true },
  },
  { _id: false }
);

const individualMatchSchema = new mongoose.Schema(
  {
    slot: { type: Number, required: true }, // 0 = each side's top build, 1 = middle, 2 = bottom
    challengerBuildId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Build",
      required: true,
    },
    defenderBuildId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Build",
      required: true,
    },
    sets: { type: [setSchema], required: true },
    challengerSets: { type: Number, required: true },
    defenderSets: { type: Number, required: true },
    winner: { type: String, enum: ["challenger", "defender"], required: true },
  },
  { _id: false }
);

const pvpTieSchema = new mongoose.Schema(
  {
    challengerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    defenderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    surface: { type: String, enum: ["hard", "clay", "grass"], required: true },
    matches: { type: [individualMatchSchema], required: true },
    // Tie-level score (0-3 individual match wins each) and winner - the
    // challenger's own win/loss record only moves based on this, not the
    // defender's (see User.js's pvp.wins/losses comment).
    challengerScore: { type: Number, required: true },
    defenderScore: { type: Number, required: true },
    winner: { type: String, enum: ["challenger", "defender"], required: true },
    // Elo is an account rating, so it moves once per tie (not once per
    // individual match) - before/after for both sides is enough for a
    // history view to show a delta without recomputing anything.
    challengerEloBefore: { type: Number, required: true },
    challengerEloAfter: { type: Number, required: true },
    defenderEloBefore: { type: Number, required: true },
    defenderEloAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

export const PvpTie = mongoose.model("PvpTie", pvpTieSchema);
