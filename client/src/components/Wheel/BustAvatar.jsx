// Illustrated fallback avatar for the ~23 of 50 players with no real ESPN
// headshot available (see the Phase 3 plan doc for which ones and why).
// Deliberately a generic, non-representational bust silhouette - not an
// attempt to depict the real person - with its fill color deterministically
// varied per player so the fallback cards aren't all visually identical.

const PALETTE = [
  "#c8ff4d", // tennis-ball chartreuse
  "#ff8c42", // clay orange
  "#4dd0e1", // court blue
  "#8bc34a", // grass green
  "#ffb74d", // warm amber
  "#7986cb", // dusk indigo
];

// Small deterministic string hash so the same slug always maps to the same
// color (stable across re-renders and reloads) without needing to store a
// color choice anywhere.
function colorForSlug(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export default function BustAvatar({ slug }) {
  const color = colorForSlug(slug ?? "");
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className="bust-avatar">
      <circle cx="50" cy="38" r="20" fill={color} />
      <path
        d="M14 92 C14 66 30 54 50 54 C70 54 86 66 86 92 Z"
        fill={color}
        opacity="0.85"
      />
    </svg>
  );
}
