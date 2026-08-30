import { Link } from "react-router-dom";

// One card per major system - icon, title, and a couple sentences. Kept
// deliberately short (see the file-level comment below) - this used to
// be a much denser page with bullet lists per section; cut down after
// user feedback that it should convey the same points, just faster to
// actually read before a first build.
function GuideSection({ icon, title, children }) {
  return (
    <div className="guide-card">
      <div className="guide-card-icon">{icon}</div>
      <h2>{title}</h2>
      <div className="guide-card-body">{children}</div>
    </div>
  );
}

/**
 * A quick, skimmable rundown of every system before a new build starts -
 * intentionally short. Reached from the landing page's and dashboard's
 * "Start Build" buttons instead of going straight to /draft.
 */
export default function GuidePage() {
  return (
    <div className="guide-page">
      <p className="result-kicker">How To Play</p>
      <h1>Build a Legend</h1>
      <p className="guide-intro">
        Draft a custom pro from real ATP legends and stars, then simulate their whole
        career. Here&rsquo;s the 60-second version.
      </p>

      <div className="guide-sections">
        <GuideSection icon="🎡" title="Spin & Draft">
          <p>
            8 rounds, 8 attributes. Each spin reveals a real player&rsquo;s full stat card
            - pick <strong>one</strong> number to lock in; that category is set for good.
            A legend&rsquo;s signature skill can go past the normal 99 cap, all the way to
            110. You also get <strong>1 free Respin</strong> and{" "}
            <strong>1 free Snag</strong> (grab a neighboring card instead) - save them for
            a round that actually needs it.
          </p>
        </GuideSection>

        <GuideSection icon="📊" title="Overall & Archetype">
          <p>
            Overall isn&rsquo;t a flat average - it&rsquo;s scored against whichever
            archetype (Big Server, Baseline Grinder, Counterpuncher, and more) fits your
            build best, so a specialist and an all-rounder both get a fair shot. Best
            Surface works the same way for clay, grass, and hard courts.
          </p>
        </GuideSection>

        <GuideSection icon="💾" title="Save & Compete">
          <p>
            Every build saves itself the moment it&rsquo;s finished - no extra step - and
            lands on the <strong>Leaderboard</strong> right away, guest or logged in.
            Rename it whenever you want. Sign up to keep your builds forever and reach
            them from any device.
          </p>
        </GuideSection>

        <GuideSection icon="🎾" title="Simulate a Career">
          <p>
            Play it a season at a time: set Training and Schedule intensity each season -
            higher means faster growth and more titles, but more injury risk, especially
            as your player ages. Retire on your own terms whenever you want, or hit{" "}
            <strong>Quick Sim</strong> to auto-play the rest instantly. Your{" "}
            <strong>Legacy Score</strong> - not just raw stats - decides your spot on the
            all-time GOAT ranking, and retiring on top protects it.
          </p>
        </GuideSection>
      </div>

      <Link to="/draft">
        <button type="button" className="spin-button guide-cta">
          Start My Build →
        </button>
      </Link>
    </div>
  );
}
