import {
  ATTRIBUTE_KEYS,
  computeOverall,
  computeArchetype,
} from "@tennisbuild/game-engine";
import { Build } from "../models/Build.js";

// Escapes the handful of characters that matter inside an HTML attribute
// or text node. Build names are free-text, user-supplied (up to 40 chars,
// see the client's save-name-input) and get interpolated straight into
// server-rendered HTML below - without this, a build named e.g.
// `</title><script>...` would be a real stored-XSS vector against
// anyone who opens a shared link, not just a cosmetic issue.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Computes the share-preview title/description/url/image for one saved
 * build, or null if it doesn't exist (caller falls back to the normal
 * SPA shell in that case, rather than a broken/empty preview).
 */
export async function buildShareMeta(buildId, origin) {
  const build = await Build.findById(buildId)
    .lean()
    .catch(() => null);
  if (!build) return null;

  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) attributes[key] = build.locked[key].value;
  const overall = computeOverall(attributes);
  const archetype = computeArchetype(attributes);

  let description = `A ${overall} OVR ${archetype.label} built from real ATP legends.`;
  if (build.career?.simulated) {
    const slamCount = build.career.slamTitles ?? 0;
    description += ` ${slamCount} Grand Slam${slamCount === 1 ? "" : "s"}, peak ranking #${build.career.peakRanking}.`;
  }
  description += " Build your own on TennisBuild.";

  return {
    title: `${build.name} - ${overall} OVR ${archetype.label} | TennisBuild`,
    description,
    url: `${origin}/builds/${buildId}`,
    image: `${origin}/og-image.png`,
  };
}

const SHARE_META_BLOCK_RE = /<!-- SHARE_META_START -->[\s\S]*?<!-- SHARE_META_END -->/;

/**
 * Swaps the default SHARE_META_START/END block in the built index.html
 * (see client/index.html) for one build's own title/description/image/
 * url - the whole block is replaced at once rather than patching
 * individual tags, so this stays correct even if the default markup
 * inside those markers changes later.
 */
export function injectShareMeta(html, meta) {
  const block = `<!-- SHARE_META_START -->
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="TennisBuild" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${escapeHtml(meta.image)}" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />
    <!-- SHARE_META_END -->`;
  return html.replace(SHARE_META_BLOCK_RE, block);
}
