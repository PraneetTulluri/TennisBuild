// credentials: "include" on every call - the auth session lives in an
// httpOnly cookie the server sets, so the browser needs to be told to
// send/accept cookies even though the Vite dev proxy keeps everything
// same-origin (fetch doesn't send cookies by default without this).

export async function registerAccount({ email, password, name }) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, name }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Registration failed");
  return data.user;
}

export async function loginAccount({ email, password }) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Login failed");
  return data.user;
}

export async function logoutAccount() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok) return null;
  const data = await response.json();
  return data.user;
}

export async function claimGuestBuilds(guestSessionId) {
  const response = await fetch("/api/auth/claim-guest-builds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ guestSessionId }),
  });
  if (!response.ok) return { claimed: 0 };
  return response.json();
}
