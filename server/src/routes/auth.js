import { Router } from "express";
import { User } from "../models/User.js";
import { Build } from "../models/Build.js";
import {
  hashPassword,
  verifyPassword,
  signUserToken,
  authCookieOptions,
  AUTH_COOKIE_NAME,
} from "../utils/auth.js";

const router = Router();

function publicUser(user) {
  return { id: user._id, email: user.email, name: user.name };
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password, and name are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ email, passwordHash, name });

    const token = signUserToken(user._id.toString());
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error("[routes/auth] Registration failed:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Same generic error whether the email doesn't exist or the password
    // is wrong - don't let a login form reveal which emails are registered.
    const validPassword = user && (await verifyPassword(password, user.passwordHash));
    if (!user || !validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signUserToken(user._id.toString());
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("[routes/auth] Login failed:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
  res.json({ ok: true });
});

// GET /api/auth/me - always 200s, { user: null } when not logged in, so
// the client can treat "checking auth status" as a normal load rather
// than needing to handle 401 as a non-error case.
router.get("/me", async (req, res) => {
  if (!req.userId) {
    return res.json({ user: null });
  }
  try {
    const user = await User.findById(req.userId).lean();
    res.json({ user: user ? publicUser(user) : null });
  } catch (err) {
    console.error("[routes/auth] Failed to load current user:", err);
    res.json({ user: null });
  }
});

// POST /api/auth/claim-guest-builds - re-associates any builds saved
// under a guest session id with the now-logged-in account. Called
// automatically right after a successful login/register on the client
// (see AuthContext) whenever a guest session id is present - non-
// destructive, so there's no reason to make the user opt in explicitly.
router.post("/claim-guest-builds", async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const { guestSessionId } = req.body;
  if (!guestSessionId) {
    return res.status(400).json({ error: "guestSessionId is required" });
  }
  try {
    const result = await Build.updateMany(
      { guestSessionId, userId: { $exists: false } },
      { $set: { userId: req.userId } }
    );
    res.json({ claimed: result.modifiedCount });
  } catch (err) {
    console.error("[routes/auth] Failed to claim guest builds:", err);
    res.status(500).json({ error: "Failed to claim guest builds" });
  }
});

export default router;
