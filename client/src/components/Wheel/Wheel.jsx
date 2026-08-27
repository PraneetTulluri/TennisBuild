import { useEffect, useRef, useState } from "react";
import PlayerCard from "./PlayerCard.jsx";
import { playTick } from "../../utils/sound.js";

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
 * the caller already knows that (via pickDistinct over the pool) and
 * passes it in as targetPlayer plus its two flanking neighbors; this
 * component's only job is to animate a convincing spin that lands with
 * the target centered between those neighbors, then report back when
 * settled. The neighbors are what a "snag" can swap the pick to (see
 * AttributeCard.jsx) - showing them physically adjacent in the strip is
 * what makes "you landed between two players" a real, visible thing
 * rather than just a hidden data structure.
 */
export default function Wheel({
  players,
  targetPlayer,
  targetNeighbors,
  spinning,
  onSpinComplete,
}) {
  const containerRef = useRef(null);
  const [strip, setStrip] = useState(() => players.slice(0, 10));
  const [landingIndex, setLandingIndex] = useState(-1);
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!spinning || !targetPlayer) return;

    const built = [];
    for (let i = 0; i < LOOPS; i++) built.push(...shuffled(players));

    // Land with the target flanked by its two neighbors when we have them,
    // so the spin visibly stops "in between" two other players - what the
    // snag option lets you grab instead.
    if (targetNeighbors) {
      built.push(targetNeighbors.left, targetPlayer, targetNeighbors.right);
    } else {
      built.push(targetPlayer);
    }
    const newLandingIndex = targetNeighbors ? built.length - 2 : built.length - 1;

    setStrip(built);
    setLandingIndex(newLandingIndex);
    setAnimate(false);
    setOffset(0);

    const containerWidth = containerRef.current?.offsetWidth ?? 600;
    const targetOffset =
      newLandingIndex * CARD_WIDTH - containerWidth / 2 + CARD_WIDTH / 2;

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
  }, [spinning, targetPlayer, targetNeighbors]);

  // A decelerating tick, like a real wheel-of-fortune slowing down as it
  // approaches landing - not synced to individual card positions (the CSS
  // transition is a single eased move, not a discrete card-by-card
  // scroll), just a rhythm that starts fast and stretches out to roughly
  // match the spin's own ease-out feel.
  useEffect(() => {
    if (!animate) return undefined;
    let cancelled = false;
    let timeoutId;
    let delay = 70;
    const startedAt = Date.now();
    const spinDurationMs = 2200;

    function tick() {
      if (cancelled) return;
      playTick();
      delay = Math.min(280, delay * 1.15);
      if (Date.now() - startedAt + delay < spinDurationMs) {
        timeoutId = setTimeout(tick, delay);
      }
    }
    timeoutId = setTimeout(tick, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [animate]);

  return (
    <div className="wheel" ref={containerRef}>
      <div className="wheel-pointer" aria-hidden="true" />
      <div
        className={`wheel-track${animate ? " animate" : ""}`}
        style={{ transform: `translateX(-${offset}px)` }}
      >
        {strip.map((player, i) => {
          const isLanded = i === landingIndex;
          const isNeighbor = i === landingIndex - 1 || i === landingIndex + 1;
          return (
            <div
              className={`wheel-card${isLanded ? " landed" : ""}${isNeighbor ? " neighbor" : ""}`}
              key={`${player.slug}-${i}`}
            >
              <PlayerCard player={player} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
