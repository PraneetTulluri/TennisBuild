// A default name for a build the player never got around to naming -
// every build auto-saves the instant it's finished (see ResultPage), so
// there's no "type a name or nothing gets saved" moment to force one out
// of them. Two tennis-flavored word lists combined ("Iron Baseliner",
// "Clutch Ace") rather than a generic "Player 4821" - still obviously a
// placeholder, but one that fits the game instead of reading like an
// error state.
const ADJECTIVES = [
  "Iron",
  "Clutch",
  "Golden",
  "Silent",
  "Relentless",
  "Fearless",
  "Rapid",
  "Steel",
  "Wildcard",
  "Prime",
  "Rising",
  "Unstoppable",
  "Flawless",
  "Ruthless",
  "Blazing",
  "Ice-Cold",
];

const NOUNS = [
  "Ace",
  "Baseliner",
  "Volley",
  "Rally",
  "Backhand",
  "Forehand",
  "Serve",
  "Champion",
  "Contender",
  "Rocket",
  "Comeback",
  "Maverick",
  "Legend",
  "Prospect",
  "Underdog",
  "Star",
];

export function randomBuildName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}
