import { getGuestSessionId } from "../utils/guestSession.js";

// credentials: "include" on every call - when logged in, the server uses
// the auth cookie to scope/tag builds by account instead of just guest
// session id (see server/src/routes/builds.js).

export async function saveBuild({ name, locked, flavor }) {
  const response = await fetch("/api/builds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, locked, flavor, guestSessionId: getGuestSessionId() }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save build: ${response.status}`);
  }
  return response.json();
}

export async function fetchMyBuilds() {
  const response = await fetch(`/api/builds?sessionId=${getGuestSessionId()}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch builds: ${response.status}`);
  }
  return response.json();
}

export async function fetchLeaderboard() {
  const response = await fetch("/api/builds/leaderboard", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status}`);
  }
  return response.json();
}

export async function fetchBuild(id) {
  const response = await fetch(`/api/builds/${id}`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch build: ${response.status}`);
  }
  return response.json();
}

export async function renameBuild(id, name) {
  const response = await fetch(`/api/builds/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`Failed to rename build: ${response.status}`);
  }
  return response.json();
}

export async function saveCareerToBuild(id, careerData) {
  const response = await fetch(`/api/builds/${id}/career`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(careerData),
  });
  if (!response.ok) {
    throw new Error(`Failed to save career result: ${response.status}`);
  }
  return response.json();
}
