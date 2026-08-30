// The one win-probability model shared by career-sim matches (career.js)
// and PvP ties (pvp.js) - pulled out on its own so both stay on exactly
// the same math rather than risking two copies drifting apart over time.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Win probability for one match, from each side's surface-specific
 * strength. A logistic curve on the strength gap means a big favorite is
 * still not a certainty (upsets stay possible - floor/ceiling of
 * 3%/97%), and a small mental-toughness edge nudges close matches (the
 * "clutch factor" called for in the Phase 0 design doc).
 */
export function matchWinProbability(
  playerStrength,
  opponentStrength,
  playerMental,
  opponentMental
) {
  const diff = playerStrength - opponentStrength;
  const base = 1 / (1 + Math.exp(-diff / 12));
  const clutch = (playerMental - opponentMental) / 400;
  return clamp(base + clutch, 0.03, 0.97);
}
