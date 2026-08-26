import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  fetchCurrentUser,
  loginAccount,
  registerAccount,
  logoutAccount,
  claimGuestBuilds,
} from "../api/auth.js";
import { getGuestSessionId } from "../utils/guestSession.js";

const AuthContext = createContext(null);

/**
 * Holds the logged-in user (or null for a guest) app-wide, so any
 * component can read auth state or trigger login/register/logout without
 * prop drilling. Checks /api/auth/me once on mount to restore a session
 * from the httpOnly cookie the server set on a previous visit.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  // Runs right after a successful login/register: adopts any builds saved
  // while this browser was still a guest into the now-logged-in account.
  // Non-destructive and always safe to attempt, so it's automatic rather
  // than something the user has to opt into.
  const claimGuestBuildsQuietly = useCallback(async () => {
    try {
      await claimGuestBuilds(getGuestSessionId());
    } catch {
      // Non-critical - the guest builds simply stay unclaimed if this fails.
    }
  }, []);

  const login = useCallback(
    async (credentials) => {
      const loggedInUser = await loginAccount(credentials);
      setUser(loggedInUser);
      await claimGuestBuildsQuietly();
      return loggedInUser;
    },
    [claimGuestBuildsQuietly]
  );

  const register = useCallback(
    async (details) => {
      const newUser = await registerAccount(details);
      setUser(newUser);
      await claimGuestBuildsQuietly();
      return newUser;
    },
    [claimGuestBuildsQuietly]
  );

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
