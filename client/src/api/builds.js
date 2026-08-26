import { getGuestSessionId } from "../utils/guestSession.js";

export async function saveBuild({ name, locked, flavor }) {
  const response = await fetch("/api/builds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, locked, flavor, guestSessionId: getGuestSessionId() }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save build: ${response.status}`);
  }
  return response.json();
}

export async function fetchMyBuilds() {
  const response = await fetch(`/api/builds?sessionId=${getGuestSessionId()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch builds: ${response.status}`);
  }
  return response.json();
}

export async function fetchBuild(id) {
  const response = await fetch(`/api/builds/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch build: ${response.status}`);
  }
  return response.json();
}

export async function saveCareerToBuild(id, careerData) {
  const response = await fetch(`/api/builds/${id}/career`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(careerData),
  });
  if (!response.ok) {
    throw new Error(`Failed to save career result: ${response.status}`);
  }
  return response.json();
}
