import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  createCareerState,
  simulateNextSeason,
  summarizeCareer,
} from "@tennisbuild/game-engine";

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

function SlamBadge({ slam }) {
  const notableWins = slam.matches.filter(
    (m) => m.won && (m.round === "QF" || m.round === "SF" || m.round === "F")
  );
  return (
    <div className={`slam-badge result-${slam.result}`}>
      <span className="slam-badge-name">{SLAM_SHORT_LABEL[slam.key]}</span>
      <span className="slam-badge-result">{RESULT_LABEL[slam.result]}</span>
      {notableWins.length > 0 && (
        <span className="slam-badge-wins">
          def. {notableWins.map((m) => m.opponentName).join(", ")}
        </span>
      )}
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
        Tour: {season.tour.titles} title{season.tour.titles === 1 ? "" : "s"} ·{" "}
        {season.tour.wins}-{season.tour.losses}
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
  const { attributes, playerPool } = location.state ?? {};

  const [careerState, setCareerState] = useState(() =>
    attributes ? createCareerState(attributes) : null
  );

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

  const summary = summarizeCareer(careerState);

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

      {careerState.retired && (
        <div className="career-summary">
          <h2>Career Totals</h2>
          <div className="career-summary-grid">
            <div>
              <strong>{summary.titles}</strong>
              <span>Career Titles</span>
            </div>
            <div>
              <strong>{summary.slamTitles}</strong>
              <span>Grand Slams</span>
            </div>
            <div>
              <strong>#{summary.peakRanking}</strong>
              <span>Peak Ranking</span>
            </div>
            <div>
              <strong>{summary.seasonsPlayed}</strong>
              <span>Seasons Played</span>
            </div>
            <div>
              <strong>{summary.retirementAge}</strong>
              <span>Retirement Age</span>
            </div>
          </div>
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
