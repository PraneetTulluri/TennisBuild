import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  createCareerState,
  simulateNextSeason,
  retireNow,
  summarizeCareer,
  computeGoatRanking,
  DEFAULT_SLIDERS,
  SLAM_CALENDAR,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
} from "@tennisbuild/game-engine";
import { saveCareerToBuild } from "../api/builds.js";
import { playClick } from "../utils/sound.js";

const SLAM_SHORT_LABEL = {
  australianOpen: "Australian Open",
  frenchOpen: "French Open",
  wimbledon: "Wimbledon",
  usOpen: "US Open",
};

const RESULT_LABEL = {
  R128: "1st Round",
  R64: "2nd Round",
  R32: "3rd Round",
  R16: "4th Round",
  QF: "Quarterfinal",
  SF: "Semifinal",
  F: "Finalist",
  W: "Champion",
};

// Which surface-color class each Slam's trophy gets - the two hard-court
// majors deliberately share a color, same as they share a surface.
const SLAM_TROPHY_SURFACE_CLASS = {
  australianOpen: "trophy-hard",
  frenchOpen: "trophy-clay",
  wimbledon: "trophy-grass",
  usOpen: "trophy-hard",
};

// Why the career ended, in plain language - the whole point of a Legacy
// Score is that *how* a career ended matters, not just the final totals.
const RETIREMENT_NARRATIVE = {
  voluntary: (retiredOnTop) =>
    retiredOnTop
      ? "Retired on your own terms, still right around your career peak - a smart exit that protects the legacy."
      : "Called it a career after a rough stretch - the Legacy Score already took the hit for hanging on this long.",
  "career-ending-injury": () =>
    "A career-ending injury cut this career short - a real risk of pushing training and the schedule hard.",
  "age-limit": () => "Played it out to the very end of a long, full career.",
};

// A persistent, always-visible trophy case for the 4 majors - stays put
// across the whole career instead of scrolling away inside a growing list
// of past seasons, and its counts tick up live as seasons are simulated.
// Keying each count by its own value forces React to remount that one
// number whenever it changes, which is what replays the "pop" animation
// (see .trophy-count in index.css) exactly when a title is actually won.
function TrophyCase({ slamTitlesByKey }) {
  return (
    <div className="trophy-case">
      {SLAM_CALENDAR.map((slam) => (
        <div key={slam.key} className={`trophy ${SLAM_TROPHY_SURFACE_CLASS[slam.key]}`}>
          <span className="trophy-icon">🏆</span>
          <span className="trophy-count" key={`${slam.key}-${slamTitlesByKey[slam.key]}`}>
            {slamTitlesByKey[slam.key]}
          </span>
          <span className="trophy-name">{SLAM_SHORT_LABEL[slam.key]}</span>
        </div>
      ))}
    </div>
  );
}

// A persistent, always-visible running total - not just a number shown
// once at retirement. Keyed by its own rounded value so React remounts
// it (and replays the pop animation) every time it actually changes,
// same trick as the trophy counts above.
function LegacyScoreBadge({ legacyScore }) {
  return (
    <div className="legacy-badge">
      <span className="legacy-badge-label">Legacy Score</span>
      <span className="legacy-badge-value" key={legacyScore}>
        {legacyScore}
      </span>
    </div>
  );
}

// What just moved the Legacy Score, and by how much - a ticker rather
// than just a single before/after number, so a season that swung it up
// or down is legible in the moment instead of only showing up in a final
// total at retirement. Each line staggers in slightly after the last for
// a bit of "adding it up" motion.
function LegacyTicker({ breakdown, delta }) {
  return (
    <div className="legacy-ticker">
      <p className="legacy-ticker-title">Legacy Score this season</p>
      <ul className="legacy-ticker-list">
        {breakdown.map((entry, i) => (
          <li
            key={entry.label}
            className={`legacy-ticker-line${entry.amount > 0 ? " up" : " down"}`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <span>{entry.label}</span>
            <span>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</span>
          </li>
        ))}
      </ul>
      <p className={`legacy-ticker-total${delta >= 0 ? " up" : " down"}`}>
        Net: {delta > 0 ? `+${delta}` : delta}
      </p>
    </div>
  );
}

// No opponent is ever named here - a Slam result is shown as just the
// round reached. Naming a specific real player as "beaten" every year
// across a decade-plus simulated career would imply they're frozen in
// time rather than aging themselves, which the simulation has no way to
// represent - see career.js's design notes.
function SlamBadge({ slam }) {
  return (
    <div className={`slam-badge result-${slam.result}`}>
      <span className="slam-badge-name">{SLAM_SHORT_LABEL[slam.key]}</span>
      <span className="slam-badge-result">{RESULT_LABEL[slam.result]}</span>
    </div>
  );
}

function SeasonCard({ season }) {
  return (
    <div className="season-card">
      <div className="season-header">
        <span>Year {season.year}</span>
        <span>Age {season.age}</span>
        <span>Rank #{season.ranking}</span>
      </div>
      <p className="season-sliders-line">
        🏋️ Training {season.trainingIntensity} · 🗓️ Schedule {season.scheduleIntensity}
      </p>
      <div className="slam-grid">
        {season.slams.map((slam) => (
          <SlamBadge key={slam.key} slam={slam} />
        ))}
      </div>
      <p className="season-tour-line">
        {season.masterTitles} Masters · {season.tourTitles} tour title
        {season.tourTitles === 1 ? "" : "s"} · Record: {season.record.wins}-
        {season.record.losses}
      </p>
      {season.injury && (
        <p className="season-injury">
          🩹{" "}
          {season.injury.careerEnding
            ? "A career-ending injury cut the season short."
            : season.injury.description}
        </p>
      )}
    </div>
  );
}

// The two levers set before every season - training intensity trades
// attribute growth for injury risk, schedule intensity trades how many
// events get entered (more title chances, more ranking points) for
// fatigue. Both persist between seasons rather than resetting, so easing
// off as the player ages is a deliberate choice, not busywork.
function SlidersPanel({ sliders, onChange, onSimulate, age }) {
  return (
    <div className="decision-card">
      <p className="result-kicker">Season Plan - Age {age}</p>
      <div className="slider-row">
        <div className="slider-label-row">
          <span>Training Intensity</span>
          <span className="slider-value">{sliders.trainingIntensity}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliders.trainingIntensity}
          onChange={(event) =>
            onChange({ ...sliders, trainingIntensity: Number(event.target.value) })
          }
        />
        <p className="slider-hint">
          Higher pushes attribute growth further this season - but raises injury risk.
        </p>
      </div>
      <div className="slider-row">
        <div className="slider-label-row">
          <span>Schedule Intensity</span>
          <span className="slider-value">{sliders.scheduleIntensity}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliders.scheduleIntensity}
          onChange={(event) =>
            onChange({ ...sliders, scheduleIntensity: Number(event.target.value) })
          }
        />
        <p className="slider-hint">
          Higher enters more events - more chances at titles and ranking points, more
          fatigue.
        </p>
      </div>
      <button type="button" className="spin-button" onClick={onSimulate}>
        Simulate Season
      </button>
    </div>
  );
}

// A brief, purely-for-feel pause between setting the season plan and
// seeing it play out (the simulation itself is instant) - matches the
// same "let the moment breathe" reasoning behind the draft wheel's spin
// delay.
function SimulatingIndicator({ age }) {
  return (
    <div className="simulating-indicator">
      <span className="simulating-ball">🎾</span>
      <p>Simulating age {age}…</p>
    </div>
  );
}

// A live view of the build's actual attributes as the career has aged
// them - training, schedule, injuries, and age itself all show up here,
// not just in the season-by-season results above. `previous` is the
// season before this one (or, for the very first season played, the
// original draft attributes), which is what produces the up/down deltas.
function AttributePanel({ current, previous }) {
  return (
    <div className="career-attributes">
      <p className="result-kicker">Attributes This Season</p>
      <div className="career-attributes-grid">
        {ATTRIBUTE_KEYS.map((key) => {
          const value = current[key];
          const delta = previous ? value - previous[key] : 0;
          return (
            <div key={key} className="career-attribute-row">
              <span className="career-attribute-label">{ATTRIBUTE_LABELS[key]}</span>
              <span
                className={`career-attribute-value${value > 99 ? " elite-value" : ""}`}
              >
                {value}
              </span>
              <span
                className={`career-attribute-delta${delta > 0 ? " up" : delta < 0 ? " down" : ""}`}
              >
                {delta > 0 ? `+${delta}` : delta < 0 ? delta : "–"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Simulates the finished build's career, one season at a time, via the
 * game-engine's createCareerState/simulateNextSeason pure state machine
 * (see career.js) - this component just holds that state in React and
 * renders it, same pattern as useDraftState for the draft itself.
 *
 * Each season the player sets two sliders (training/schedule intensity)
 * before simulating, then either continues (back to the slider panel for
 * the next season) or retires voluntarily via retireNow - the only
 * *forced* endings are a hard age cap and a rare career-ending injury.
 * The whole thing unfolds inside a single `.career-stage` panel that
 * swaps between three views - the slider panel, a brief "simulating"
 * beat, then that season's result - instead of an ever-growing list of
 * past seasons. The trophy case above it is the one thing that stays
 * constant across all of that, ticking up as majors are won.
 */
export default function CareerPage() {
  const location = useLocation();
  const { attributes, playerPool, buildId } = location.state ?? {};

  const [careerState, setCareerState] = useState(() =>
    attributes ? createCareerState(attributes) : null
  );
  const [stage, setStage] = useState("sliders"); // sliders | simulating | result | retired
  const [sliders, setSliders] = useState(DEFAULT_SLIDERS);
  const [careerSaveStatus, setCareerSaveStatus] = useState("idle"); // idle | saving | saved | error

  const summary = careerState ? summarizeCareer(careerState) : null;
  const goat =
    careerState?.retired && summary ? computeGoatRanking(summary.legacyScore) : null;

  // Once the career ends, automatically attach its result to the saved
  // build (if this career was launched from one - see ResultPage's Save
  // Build flow). Runs once per completed career: the [careerState.retired]
  // dependency only flips false -> true a single time for a given career.
  useEffect(() => {
    if (!careerState?.retired || !buildId || !goat || careerSaveStatus !== "idle") return;
    setCareerSaveStatus("saving");
    saveCareerToBuild(buildId, {
      seasonsPlayed: summary.seasonsPlayed,
      slamTitles: summary.slamTitles,
      masterTitles: summary.masterTitles,
      titles: summary.titles,
      peakRanking: summary.peakRanking,
      retirementAge: summary.retirementAge,
      careerRecordWins: summary.careerRecord.wins,
      careerRecordLosses: summary.careerRecord.losses,
      goatRank: goat.rank,
      goatTotal: goat.total,
      goatIsAllTimeGreat: goat.isAllTimeGreat,
      legacyScore: summary.legacyScore,
      retirementReason: summary.retirementReason,
    })
      .then(() => setCareerSaveStatus("saved"))
      .catch(() => setCareerSaveStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerState?.retired]);

  if (!attributes || !playerPool || !careerState) {
    return (
      <div className="career-page">
        <p>No build to simulate a career for yet.</p>
        <Link to="/draft">
          <button type="button" className="spin-button">
            Start a Build
          </button>
        </Link>
      </div>
    );
  }

  function handleSimulate() {
    playClick();
    setStage("simulating");
    window.setTimeout(() => {
      const next = simulateNextSeason(careerState, playerPool, sliders);
      setCareerState(next);
      setStage(next.retired ? "retired" : "result");
    }, 900);
  }

  function handleContinue() {
    playClick();
    setStage("sliders");
  }

  function handleRetire() {
    playClick();
    setCareerState((prev) => retireNow(prev));
    setStage("retired");
  }

  const latestSeason = careerState.seasons[careerState.seasons.length - 1] ?? null;
  const priorSeason = careerState.seasons[careerState.seasons.length - 2] ?? null;
  const currentAttributes = latestSeason
    ? latestSeason.attributes
    : careerState.currentAttributes;
  const previousAttributes = latestSeason
    ? priorSeason
      ? priorSeason.attributes
      : careerState.baseAttributes
    : null;

  return (
    <div className="career-page">
      <p className="result-kicker">Career Simulation</p>
      <h1 className="career-title">
        {careerState.retired ? "Career Complete" : `Age ${careerState.age}`}
      </h1>

      <div className="career-top-widgets">
        <TrophyCase slamTitlesByKey={summary.slamTitlesByKey} />
        <LegacyScoreBadge legacyScore={summary.legacyScore} />
      </div>

      <div className="career-stage" key={`${stage}-${careerState.seasons.length}`}>
        {stage === "sliders" && (
          <SlidersPanel
            sliders={sliders}
            onChange={setSliders}
            onSimulate={handleSimulate}
            age={careerState.age}
          />
        )}
        {stage === "simulating" && <SimulatingIndicator age={careerState.age} />}
        {(stage === "result" || stage === "retired") && latestSeason && (
          <>
            <SeasonCard season={latestSeason} />
            <LegacyTicker
              breakdown={latestSeason.legacyBreakdown}
              delta={latestSeason.legacyDelta}
            />
            {stage === "result" && (
              <div className="career-stage-actions">
                <button type="button" className="spin-button" onClick={handleContinue}>
                  Continue to Next Season
                </button>
                <button type="button" className="secondary-button" onClick={handleRetire}>
                  Retire Now
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AttributePanel current={currentAttributes} previous={previousAttributes} />

      {stage === "retired" && goat && (
        <div className="career-summary">
          <p className="retirement-narrative">
            {RETIREMENT_NARRATIVE[summary.retirementReason]?.(summary.retiredOnTop) ?? ""}
          </p>

          <div className="goat-block">
            <p className="result-kicker">All-Time Ranking</p>
            {goat.isAllTimeGreat ? (
              <>
                <p className="goat-rank">
                  #{goat.rank} <span>of {goat.total}</span>
                </p>
                {goat.above && (
                  <p className="goat-context">
                    Just behind <strong>{goat.above}</strong>
                    {goat.below ? `, just ahead of ${goat.below}` : ""}
                  </p>
                )}
                {!goat.above && goat.below && (
                  <p className="goat-context">
                    The greatest of all time - ahead of <strong>{goat.below}</strong>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="goat-rank not-great">Not an All-Time Great</p>
                {goat.above && (
                  <p className="goat-context">
                    Did not crack the top {goat.total} - closest was{" "}
                    <strong>{goat.above}</strong>
                  </p>
                )}
              </>
            )}
          </div>

          <h2>Career Totals</h2>
          <div className="career-summary-grid">
            <div>
              <strong>{summary.slamTitles}</strong>
              <span>Grand Slams</span>
            </div>
            <div>
              <strong>{summary.masterTitles}</strong>
              <span>Masters Titles</span>
            </div>
            <div>
              <strong>{summary.titles}</strong>
              <span>Career Titles</span>
            </div>
            <div>
              <strong>#{summary.peakRanking}</strong>
              <span>Peak Ranking</span>
            </div>
            <div>
              <strong>
                {summary.careerRecord.wins}-{summary.careerRecord.losses}
              </strong>
              <span>Career Record</span>
            </div>
            <div>
              <strong>{summary.retirementAge}</strong>
              <span>Retirement Age</span>
            </div>
            <div>
              <strong>{summary.legacyScore}</strong>
              <span>Legacy Score</span>
            </div>
          </div>

          {buildId && (
            <p className="save-confirmation">
              {careerSaveStatus === "saving" && "Saving career to your build…"}
              {careerSaveStatus === "saved" && (
                <>
                  ✅ Career saved · <Link to="/builds">View My Builds</Link>
                </>
              )}
              {careerSaveStatus === "error" && "Could not save the career result."}
            </p>
          )}

          <Link to="/draft">
            <button type="button" className="secondary-button">
              Build Another Player
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
