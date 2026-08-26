// One-off utility, not part of the app's runtime: resolves a real ESPN
// headshot photo URL for each player in players.data.js, where one exists.
//
// How it works: ESPN's public search API (site.web.api.espn.com) returns a
// tennis athlete's profile link when one matches by name; the numeric
// athlete ID in that link maps to a predictable CDN path
// (a.espncdn.com/i/headshots/tennis/players/full/<id>.png). Not every
// player has a photo at that path even when they have a profile (notably a
// few current players ESPN hasn't uploaded one for), and pre-1990s legends
// mostly aren't in ESPN's digital archive at all - so each candidate URL is
// verified with a HEAD request before being accepted, rather than assumed.
//
// We hotlink these URLs directly from the client (<img src="...">) rather
// than downloading/redistributing copies - this only fetches metadata to
// discover the right URLs once, as a content-authoring step.
//
// Run with: node src/seed/resolveHeadshots.js
// Prints a slug -> imageUrl map; the results were hand-merged into each
// player's imageUrl field in players.data.js. Re-run and re-merge if the
// roster grows.
import { playersSeedData } from "./players.data.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveOne(name) {
  const query = encodeURIComponent(name);
  const res = await fetch(
    `https://site.web.api.espn.com/apis/search/v2?query=${query}&limit=5`,
    { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }
  );
  const json = await res.json();
  const playerGroup = (json.results || []).find((r) => r.type === "player");
  const match = playerGroup && playerGroup.contents.find((c) => c.sport === "tennis");
  if (!match) return null;

  const idMatch = match.link.web.match(/\/id\/(\d+)\//);
  if (!idMatch) return null;

  const url = `https://a.espncdn.com/i/headshots/tennis/players/full/${idMatch[1]}.png`;
  const headRes = await fetch(url, { method: "HEAD" });
  return headRes.status === 200 ? url : null;
}

async function main() {
  const resolved = {};
  for (const player of playersSeedData) {
    let url = null;
    for (let attempt = 0; attempt < 2 && !url; attempt++) {
      try {
        url = await resolveOne(player.name);
      } catch {
        // transient network error - fall through to retry
      }
      if (!url) await sleep(300);
    }
    resolved[player.slug] = url;
    await sleep(250); // stay well under any rate limit
  }

  const found = Object.entries(resolved).filter(([, url]) => url);
  console.log(`Resolved ${found.length} / ${playersSeedData.length} real headshots:\n`);
  console.log(JSON.stringify(resolved, null, 2));
}

main();
