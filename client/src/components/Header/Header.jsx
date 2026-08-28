import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * App-wide top nav: always visible so a logged-in user can reach their
 * dashboard/builds from anywhere, and a guest always has Login/Sign Up
 * one click away without it gating any of the actual gameplay.
 */
export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        🎾 TennisBuild
      </Link>
      <nav className="site-header-nav">
        <Link to="/draft">Build</Link>
        <Link to="/guide">How to Play</Link>
        <Link to="/builds">My Builds</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        {!loading && user && (
          <>
            <span className="site-header-user">Hi, {user.name}</span>
            <button
              type="button"
              className="site-header-link-button"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </>
        )}
        {!loading && !user && (
          <>
            <Link to="/login">Log In</Link>
            <Link to="/register" className="site-header-cta">
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
