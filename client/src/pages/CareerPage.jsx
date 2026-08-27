import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  createCareerState,
  simulateNextSeason,
  summarizeCareer,
  computeGoatRanking,
  pickCareerDecision,
  resolveDecisionChoice,
  SLAM_CALENDAR,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
} from "@tennisbuild/game-engine";
import { saveCareerToBuild } from "../api/builds.js";
import { playClick } from "../utils/sound.js";

// Not every offseason needs to be a fork in the road - a decision is only
// offered some of the time, so the ones that do show up feel like real
// moments rather than a mandatory click every single season.
const DECISION_CHANCE = 0.6;

function rollPendingDecision(excludePreviousId = null) {
  return Math.random() < DECISION_CHANCE ? pickCareerDecision(excludePreviousId) : null;
}

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
      {season.decisionChoice && (
        <p className="season-decision-line">📋 {season.decisionChoice}</p>
      )}
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
      {season.injury && <p className="season-injury">🩹 {season.injury.description}</p>}
    </div>
  );
}

// A career decision offered before each season - see CAREER_DECISIONS in
// career.js for the pool and each option's real numeric tradeoffs. Picking
// one is what triggers that season's simulation (see handleChooseOption).
function DecisionPrompt({ decision, onChoose }) {
  return (
    <div className="decision-card">
      <p className="result-kicker">Career Decision</p>
      <h2 className="decision-prompt">{decision.prompt}</h2>
      <div className="decision-options">
        {decision.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="decision-option"
            onClick={() => onChoose(option)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// A brief, purely-for-feel pause between picking a decision and seeing its
// season play out (the simulation itself is instant) - matches the same
// "let the moment breathe" reasoning behind the draft wheel's spin delay.
function SimulatingIndicator({ age }) {
  return (
    <div className="simulating-indicator">
      <span className="simulating-ball">🎾</span>
      <p>Simulating age {age}…</p>
    </div>
  );
}

// The season this one didn't roll a decision (see DECISION_CHANCE) - a
// quieter beat between the ones that do, still requiring a click to move
// on rather than auto-advancing.
function NoDecisionPrompt({ age, onContinue }) {
  return (
    <div className="decision-card no-decision-card">
      <p className="result-kicker">Offseason</p>
      <h2 className="decision-prompt">A quiet offseason - nothing notable to report.</h2>
      <button type="button" className="spin-button" onClick={onContinue}>
        Play Season (Age {age})
      </button>
    </div>
  );
}

// A live view of the build's actual attributes as the career has aged
// them - the age curve, injuries, and career decisions all show up here,
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
 * Unlike a growing list of past-season boxes, the career unfolds inside a
 * single `.career-stage` panel that swaps between three views - a
 * decision prompt, a brief "simulating" beat, then that season's result -
 * with each swap re-triggering a small entrance animation (see the
 * `key` on .career-stage). The trophy case above it is the one thing that
 * stays constant across all of that, ticking up as majors are won.
 */
export default function CareerPage() {
  const location = useLocation();
  const { attributes, playerPool, buildId } = location.state ?? {};

  const [careerState, setCareerState] = useState(() =>
    attributes ? createCareerState(attributes) : null
  );
  const [stage, setStage] = useState("decision"); // decision | simulating | result | retired
  const [pendingDecision, setPendingDecision] = useState(() => rollPendingDecision());
  const [lastDecisionId, setLastDecisionId] = useState(null);
  const [careerSaveStatus, setCareerSaveStatus] = useState("idle"); // idle | saving | saved | error

  const summary = careerState ? summarizeCareer(careerState) : null;
  const goat = careerState?.retired && summary ? computeGoatRanking(summary) : null;

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

  // `option` is omitted when this season didn't roll a decision at all
  // (see NoDecisionPrompt) - simulateNextSeason's third argument is
  // already designed to be optional for exactly that case.
  function handlePlaySeason(option) {
    const resolved =
      pendingDecision && option ? resolveDecisionChoice(pendingDecision, option) : null;
    playClick();
    setStage("simulating");
    window.setTimeout(() => {
      const next = simulateNextSeason(careerState, playerPool, resolved);
      setCareerState(next);
      if (resolved) setLastDecisionId(pendingDecision.id);
      setStage(next.retired ? "retired" : "result");
    }, 900);
  }

  function handleContinue() {
    playClick();
    setPendingDecision(rollPendingDecision(lastDecisionId));
    setStage("decision");
  }

  const latestSeason = careerState.seasons[careerState.seasons.length - 1] ?? null;
  const priorSeason = careerState.seasons[careerState.seasons.length - 2] ?? null;
  const currentAttributes = latestSeason
    ? latestSeason.attributes
    : careerState.baseAttributes;
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

      <TrophyCase slamTitlesByKey={summary.slamTitlesByKey} />

      <div className="career-stage" key={`${stage}-${careerState.seasons.length}`}>
        {stage === "decision" && pendingDecision && (
          <DecisionPrompt decision={pendingDecision} onChoose={handlePlaySeason} />
        )}
        {stage === "decision" && !pendingDecision && (
          <NoDecisionPrompt age={careerState.age} onContinue={() => handlePlaySeason()} />
        )}
        {stage === "simulating" && <SimulatingIndicator age={careerState.age} />}
        {(stage === "result" || stage === "retired") && latestSeason && (
          <>
            <SeasonCard season={latestSeason} />
            {stage === "result" && (
              <button type="button" className="spin-button" onClick={handleContinue}>
                Continue to Next Season
              </button>
            )}
          </>
        )}
      </div>

      <AttributePanel current={currentAttributes} previous={previousAttributes} />

      {stage === "retired" && goat && (
        <div className="career-summary">
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
