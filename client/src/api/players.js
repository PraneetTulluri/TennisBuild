// Thin fetch wrapper around the backend's player endpoint. Kept in its own
// module (rather than calling fetch() directly inside components) so pages
// don't need to know the URL shape or error-handling details - they just
// call fetchPlayers() and get back an array or a thrown error.
export async function fetchPlayers() {
  const response = await fetch("/api/players");

  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.status}`);
  }

  return response.json();
}
