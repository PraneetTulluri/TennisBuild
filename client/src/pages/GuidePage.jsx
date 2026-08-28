import { Link } from "react-router-dom";

// One card per major system - icon, title, and a short explanation of
// what it does and how it actually affects your build. `children` lets
// a section include a bullet list on top of the intro paragraph for the
// denser topics (career sim, Legacy Score) without every section needing
// the same rigid shape.
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
 * A single page explaining every system in the game before a new build
 * starts - the draft/wheel mechanic, scoring, saving/leaderboard, and
 * the career simulation's sliders/retirement/Legacy Score in enough
 * depth that none of it is a surprise once a career is actually running.
 * Reached from the landing page's and dashboard's "Start Build" buttons
 * instead of going straight to /draft.
 */
export default function GuidePage() {
  return (
    <div className="guide-page">
      <p className="result-kicker">How To Play</p>
      <h1>Build a Legend</h1>
      <p className="guide-intro">
        Draft a custom pro from real ATP legends and current stars, then simulate a whole
        career - one season, one decision at a time. Here is what every piece actually
        does.
      </p>

      <div className="guide-sections">
        <GuideSection icon="🎡" title="Spin the Wheel">
          <p>
            A build has 8 rounds - one per attribute category. Each spin reveals one
            random real player, legend or current pro, with their full 8-attribute card.
            Pick <strong>one</strong> attribute from that card to lock into the build -
            that category is locked for good, and the real player&rsquo;s number becomes
            your number.
          </p>
          <p>
            Every build also gets <strong>1 Respin</strong> (re-roll the same round for a
            different player) and <strong>1 Snag</strong> (grab a flanking
            neighbor&rsquo;s card instead of the one landed on) - save them for a round
            where the attribute actually needed is weak.
          </p>
        </GuideSection>

        <GuideSection icon="⭐" title="Elite Signature Skills">
          <p>
            Most attributes cap at 99. But a legend&rsquo;s (or, rarely, one of
            today&rsquo;s very best active stars&rsquo;) single most iconic skill can go
            past that ceiling, all the way up to <strong>110</strong> - Nadal&rsquo;s
            mental toughness, Djokovic&rsquo;s return, Sampras&rsquo;s serve. Landing on
            one of these is a real edge: a skill so exceptional that even a perfect 99
            would undersell it.
          </p>
        </GuideSection>

        <GuideSection icon="📊" title="Overall, Archetype & Surface">
          <p>
            Overall is not a flat average of the 8 attributes - it is the score of
            whichever <strong>archetype</strong> (Big Server, Baseline Grinder, Aggressive
            Baseliner, Counterpuncher, Serve-and-Volley, Complete Player) fits the build
            best, each weighting the 8 attributes differently. A specialist build and a
            balanced build with the same raw total can end up with very different
            Overalls, since each is measured against a different template.
          </p>
          <p>
            Best Surface works the same way against clay, grass, and hard-court weightings
            - it is the surface a build&rsquo;s specific attribute mix is actually suited
            to.
          </p>
        </GuideSection>

        <GuideSection icon="💾" title="Save, Compare & Compete">
          <p>
            Save a build as a guest, or log in to keep every build across devices and
            browsers. Every saved build - guest or account - shows up on the{" "}
            <strong>Leaderboard</strong>, sortable by Overall, Grand Slam Titles, GOAT
            Rank, or Peak Ranking, so it is easy to see how a build stacks up against
            everyone else&rsquo;s.
          </p>
        </GuideSection>

        <GuideSection icon="🎾" title="Career Simulation">
          <p>
            Attributes start at <strong>exactly</strong> what the draft produced - no
            discount for being young. From there, every season two sliders get set before
            simulating:
          </p>
          <ul className="guide-list">
            <li>
              <strong>Training Intensity</strong> - higher pushes attribute growth further
              this season, but raises injury risk.
            </li>
            <li>
              <strong>Schedule Intensity</strong> - higher enters more Masters/tour
              events, meaning more chances at titles and ranking points (Slams are always
              all 4, unaffected either way) - but raises fatigue and injury risk.
            </li>
          </ul>
          <p>
            Attributes drift up or down each season based on age, those two sliders, how
            the season actually went, and injuries - so the same draft can turn into a
            genuine GOAT or a burnout, depending entirely on how it is managed.
          </p>
          <p>
            Retirement is a choice made every season - Continue to Next Season, or Retire
            Now. The only <em>forced</em> endings are a hard age cap (44, so playing deep
            into the 40s like a handful of real greats is possible) and a rare
            career-ending injury, whose odds climb the harder training and schedule have
            been pushed. Training and schedule can, and should, change season to season -
            push hard while young, then ease off once age starts working against the
            build.
          </p>
        </GuideSection>

        <GuideSection icon="🏆" title="Legacy Score & GOAT Ranking">
          <p>
            <strong>Legacy Score is what actually decides the All-Time ranking</strong> -
            not just raw career totals. It is live throughout the whole career (watch the
            badge next to the trophy case), and every season a ticker shows exactly what
            moved it:
          </p>
          <ul className="guide-list">
            <li>
              <span className="guide-list-up">+</span> Grand Slam, Masters, and tour
              titles, a ranking bonus for reaching the very top, and a small trickle just
              for playing the season.
            </li>
            <li>
              <span className="guide-list-down">−</span> <strong>Decline Off Peak</strong>{" "}
              - a season that clearly falls off the career-best ranking costs Legacy.
              Grinding through a rough decline year tarnishes the legacy even if the stats
              stay respectable.
            </li>
            <li>
              <span className="guide-list-down">−</span> A career-ending injury costs
              Legacy on top of ending the career itself - real risk for reckless training
              and schedule choices.
            </li>
          </ul>
          <p>
            Retiring voluntarily while still near the career peak locks in a{" "}
            <strong>bonus</strong> instead - a smart, well-timed exit protects the legacy
            in a way stats alone never show. The final Legacy Score is compared against 25
            real legends&rsquo; careers to produce the GOAT ranking.
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
