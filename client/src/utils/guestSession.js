// No auth yet (that's a later phase) - a random id generated once per
// browser and kept in localStorage is what scopes "my builds" without
// needing an account. crypto.randomUUID() is available in every modern
// browser this app targets.
const STORAGE_KEY = "tennisbuild-guest-session-id";

export function getGuestSessionId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
