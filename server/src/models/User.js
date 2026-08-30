import mongoose from "mongoose";
import { ELO_STARTING_RATING } from "@tennisbuild/game-engine";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Never store or return the plain password - only the bcrypt hash.
    // See src/utils/auth.js for hashing/verification.
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // The account's active PvP roster (see routes/pvp.js) - exactly 3
    // of this user's own builds when set, enforced at the route level
    // rather than here (a schema-level array-length validator can't also
    // check ownership, so both need the same real check anyway). Empty
    // until the user sets a team.
    pvpTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: "Build" }],
    // PvP ladder standing - tracked per-account, not per-build: the
    // rating represents the player's own management/matchmaking history,
    // not any one lineup, and a team's 3 builds can be swapped freely
    // without resetting it. `wins`/`losses` only increment when this
    // account is on the *challenging* side of a tie - a defender's elo
    // still moves from ties they're pulled into (a defense that's never
    // tested shouldn't out-rank one that keeps winning), but their
    // win/loss record doesn't, since they didn't choose to fight.
    pvp: {
      elo: { type: Number, default: ELO_STARTING_RATING },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      matchesPlayed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
