"use client";

import * as React from "react";
import { easeOut, motion } from "motion/react";

// Adapted from animate-ui's registry (registry/components/community/flip-card) -
// the original is a static social-profile teaser (avatar/bio/follower
// counts/a Follow button, no separate destination to navigate to), which
// doesn't fit a build card that's also a link to a full detail page. Kept
// the actual hard part - the 3D rotateY flip with backface-hidden faces -
// and rebuilt the content around a saved build's overall/archetype (front)
// and career result (back) instead. Only flips on hover (pointer devices);
// touch devices skip the flip and just navigate on tap, since the full
// detail is one tap away regardless and a tap-to-flip step would only
// get in the way of that.
export function FlipCard({ overall, name, archetype, career, eliteValue = false }) {
  const [isFlipped, setIsFlipped] = React.useState(false);
  const isTouchDevice =
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

  function handleMouseEnter() {
    if (!isTouchDevice) setIsFlipped(true);
  }

  function handleMouseLeave() {
    if (!isTouchDevice) setIsFlipped(false);
  }

  const cardVariants = {
    front: { rotateY: 0, transition: { duration: 0.45, ease: easeOut } },
    back: { rotateY: 180, transition: { duration: 0.45, ease: easeOut } },
  };

  return (
    <div
      className="build-flip-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* FRONT: overall + name + archetype */}
      <motion.div
        className="build-flip-face build-flip-front"
        animate={isFlipped ? "back" : "front"}
        variants={cardVariants}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className={`build-flip-overall${eliteValue ? " elite-value" : ""}`}>
          {overall}
        </div>
        <strong className="build-flip-name">{name}</strong>
        <span className="build-flip-archetype">{archetype}</span>
      </motion.div>

      {/* BACK: career result, or a prompt to go simulate one */}
      <motion.div
        className="build-flip-face build-flip-back"
        initial={{ rotateY: 180 }}
        animate={isFlipped ? "front" : "back"}
        variants={cardVariants}
        style={{ transformStyle: "preserve-3d", rotateY: 180 }}
      >
        {career ? (
          <>
            <p className="build-flip-back-kicker">Career Result</p>
            <div className="build-flip-stats">
              <div>
                <p className="build-flip-stat-value">{career.slamTitles}</p>
                <p className="build-flip-stat-label">Slams</p>
              </div>
              <div>
                <p className="build-flip-stat-value">#{career.peakRanking}</p>
                <p className="build-flip-stat-label">Peak</p>
              </div>
              <div>
                <p className="build-flip-stat-value">{career.retirementAge}</p>
                <p className="build-flip-stat-label">Retired</p>
              </div>
            </div>
            {career.goatIsAllTimeGreat && (
              <p className="build-flip-goat">🐐 GOAT #{career.goatRank}</p>
            )}
          </>
        ) : (
          <>
            <p className="build-flip-back-kicker">No Career Yet</p>
            <p className="build-flip-empty-hint">Simulate a career to see it here.</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
