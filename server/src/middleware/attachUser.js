import { User } from "../models/User.js";
import { verifyUserToken, AUTH_COOKIE_NAME } from "../utils/auth.js";

/**
 * Non-blocking: reads the auth cookie if present and sets req.userId (or
 * null). Never rejects the request - most routes in this app work fine
 * for guests, so "are you logged in" is just extra context a route can
 * check, not a gate every route has to pass. Routes that do require a
 * logged-in user check `req.userId` themselves and respond 401 if it's
 * null.
 *
 * Confirms the user the token names still actually exists before trusting
 * it - a cryptographically valid token for a since-deleted account (the
 * cookie outlives the account unless /logout explicitly cleared it, e.g.
 * an account removed by some other means while a browser still holds an
 * old session) must not silently attribute requests to a phantom user id.
 * User.exists() is a lightweight existence check, not a full document
 * fetch, so this stays cheap on the common case.
 */
export async function attachUser(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  const candidateUserId = verifyUserToken(token);

  if (!candidateUserId) {
    req.userId = null;
    return next();
  }

  try {
    req.userId = (await User.exists({ _id: candidateUserId })) ? candidateUserId : null;
  } catch (err) {
    // A DB hiccup here shouldn't take down an otherwise-guest-usable
    // request - fail closed (treat as logged out) rather than crash it.
    console.error("[attachUser] Failed to verify user existence:", err);
    req.userId = null;
  }
  next();
}
