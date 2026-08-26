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
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
