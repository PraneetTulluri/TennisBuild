import { useEffect, useRef, useState } from "react";
import PlayerCard from "./PlayerCard.jsx";

// Must match the card width + gap set in index.css (.wheel-card) - the
// landing-position math below depends on it being accurate.
const CARD_WIDTH = 156;
// How many full shuffled passes through the pool to scroll through before
// landing - enough to feel like a real spin without dragging on.
const LOOPS = 4;

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The horizontal "spin the wheel" strip. Doesn't decide *who* gets drawn -
 * the caller already knows that (via pickRandom over the pool) and passes
 * it in as targetPlayer; this component's only job is to animate a
 * convincing spin that lands on it, then report back when settled.
 */
export default function Wheel({ players, targetPlayer, spinning, onSpinComplete }) {
  const containerRef = useRef(null);
  const [strip, setStrip] = useState(() => players.slice(0, 10));
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!spinning || !targetPlayer) return;

    const built = [];
    for (let i = 0; i < LOOPS; i++) built.push(...shuffled(players));
    built.push(targetPlayer);

    setStrip(built);
    setAnimate(false);
    setOffset(0);

    const containerWidth = containerRef.current?.offsetWidth ?? 600;
    const landingIndex = built.length - 1;
    const targetOffset = landingIndex * CARD_WIDTH - containerWidth / 2 + CARD_WIDTH / 2;

    // A short delay (rather than requestAnimationFrame, which browsers can
    // throttle heavily - even down to a full stop - in backgrounded or
    // inactive tabs) lets the browser paint the reset frame (offset 0, no
    // transition) before the animated move is applied. Without this gap
    // the reset and the move can collapse into a single frame and the CSS
    // transition never visibly plays.
    const startTimer = setTimeout(() => {
      setAnimate(true);
      setOffset(targetOffset);
    }, 30);

    const settleTimer = setTimeout(() => {
      onSpinComplete?.();
    }, 2300);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, targetPlayer]);

  return (
    <div className="wheel" ref={containerRef}>
      <div className="wheel-pointer" aria-hidden="true" />
      <div
        className={`wheel-track${animate ? " animate" : ""}`}
        style={{ transform: `translateX(-${offset}px)` }}
      >
        {strip.map((player, i) => (
          <div className="wheel-card" key={`${player.slug}-${i}`}>
            <PlayerCard player={player} />
          </div>
        ))}
      </div>
    </div>
  );
}
