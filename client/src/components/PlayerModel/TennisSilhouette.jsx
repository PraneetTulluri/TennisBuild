// A simple, original standing tennis-player silhouette (head, torso, arms,
// legs, holding a racquet) - not based on any real person or licensed
// asset. Deliberately minimal flat-shape illustration, matching the
// stylized-not-photorealistic treatment used for the fallback avatars.
export default function TennisSilhouette() {
  return (
    <svg viewBox="0 0 200 420" role="img" aria-label="Tennis player silhouette">
      {/* head */}
      <circle cx="100" cy="40" r="26" className="silhouette-fill" />
      {/* torso */}
      <path
        d="M70 66 C70 66 60 110 62 170 L138 170 C140 110 130 66 130 66 Z"
        className="silhouette-fill"
      />
      {/* left arm (racquet-free side) */}
      <path d="M70 80 C50 100 42 130 46 160" className="silhouette-stroke" />
      {/* right arm, raised, holding a racquet */}
      <path d="M130 80 C155 90 168 70 176 48" className="silhouette-stroke" />
      {/* racquet */}
      <ellipse
        cx="182"
        cy="34"
        rx="16"
        ry="22"
        transform="rotate(25 182 34)"
        className="silhouette-outline"
      />
      <line x1="178" y1="54" x2="170" y2="70" className="silhouette-stroke" />
      {/* legs */}
      <path d="M70 170 L58 260 L50 340" className="silhouette-stroke thick" />
      <path d="M130 170 L138 260 L146 340" className="silhouette-stroke thick" />
      {/* feet */}
      <ellipse cx="46" cy="346" rx="14" ry="7" className="silhouette-fill" />
      <ellipse cx="150" cy="346" rx="14" ry="7" className="silhouette-fill" />
    </svg>
  );
}
