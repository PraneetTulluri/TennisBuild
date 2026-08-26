import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// The cookie the client's browser holds the session in - httpOnly so
// client-side JS (and therefore any XSS payload) can never read it, unlike
// the guestSessionId in localStorage. sameSite: "lax" is enough for this
// app's same-origin-via-dev-proxy setup without needing cross-site cookie
// config.
export const AUTH_COOKIE_NAME = "tennisbuild_token";
const TOKEN_TTL = "30d";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to .env (see .env.example).");
  }
  return secret;
}

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 12);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function signUserToken(userId) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

/** Returns the userId encoded in a token, or null if missing/invalid/expired. */
export function verifyUserToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    return payload.userId;
  } catch {
    return null;
  }
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, matching TOKEN_TTL
  };
}
