import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-hero">
        <p className="landing-kicker">🎾 Build-a-Player</p>
        <h1>TennisBuild</h1>
        <p className="landing-tagline">
          Spin the wheel, draft one attribute at a time from real ATP legends and pros,
          and build a custom tennis player of your own.
        </p>
        <Link to="/draft">
          <button type="button" className="spin-button">
            Start Build
          </button>
        </Link>
        <p className="landing-secondary-link">
          <Link to="/builds">View My Builds</Link>
        </p>
      </div>
    </div>
  );
}
