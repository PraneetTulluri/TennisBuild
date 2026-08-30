import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
