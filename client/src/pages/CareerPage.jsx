import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  createCareerState,
  simulateNextSeason,
  summarizeCareer,
  computeGoatRanking,
} from "@tennisbuild/game-engine";
import { saveCareerToBuild } from "../api/builds.js";

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

/**
 * Simulates the finished build's career, one season at a time, via the
 * game-engine's createCareerState/simulateNextSeason pure state machine
 * (see career.js) - this component just holds that state in React and
 * renders it, same pattern as useDraftState for the draft itself.
 */
export default function CareerPage() {
  const location = useLocation();
  const { attributes, playerPool, buildId } = location.state ?? {};

  const [careerState, setCareerState] = useState(() =>
    attributes ? createCareerState(attributes) : null
  );
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

  return (
    <div className="career-page">
      <p className="result-kicker">Career Simulation</p>
      <h1 className="career-title">
        {careerState.retired ? "Career Complete" : `Age ${careerState.age}`}
      </h1>

      <div className="career-log">
        {careerState.seasons.map((season) => (
          <SeasonCard key={season.year} season={season} />
        ))}
      </div>

      {!careerState.retired && (
        <button
          type="button"
          className="spin-button"
          onClick={() => setCareerState((prev) => simulateNextSeason(prev, playerPool))}
        >
          Simulate Next Season
        </button>
      )}

      {careerState.retired && goat && (
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
