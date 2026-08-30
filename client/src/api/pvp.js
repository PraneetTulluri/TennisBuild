// credentials: "include" on every call - PvP requires an account (unlike
// guest-friendly builds/leaderboard), so every one of these routes 401s
// without the auth cookie.

export async function fetchPvpTeam() {
  const response = await fetch("/api/pvp/team", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch PvP team: ${response.status}`);
  }
  return response.json();
}

export async function setPvpTeam(buildIds) {
  const response = await fetch("/api/pvp/team", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ buildIds }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to set PvP team: ${response.status}`);
  }
  return data;
}

export async function challengePvpOpponent() {
  const response = await fetch("/api/pvp/challenge", {
    method: "POST",
    credentials: "include",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to find a match: ${response.status}`);
  }
  return data;
}

export async function fetchPvpHistory() {
  const response = await fetch("/api/pvp/history", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch PvP history: ${response.status}`);
  }
  return response.json();
}
