import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * App-wide top nav: always visible so a logged-in user can reach their
 * dashboard/builds from anywhere, and a guest always has Login/Sign Up
 * one click away without it gating any of the actual gameplay.
 *
 * Below the .site-header-menu-toggle breakpoint (see index.css), the full
 * link list doesn't fit on one line, so it collapses behind a hamburger
 * toggle into a dropdown panel instead - `menuOpen` is local state here
 * rather than a route/URL concern since it's purely a small-screen
 * presentation detail. Every link and the logout button close the menu
 * on click so a tap doesn't leave it open over whatever page it navigated
 * to (Header itself doesn't unmount on route changes, so nothing else
 * would close it automatically).
 */
export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate("/");
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand" onClick={closeMenu}>
        🎾 TennisBuild
      </Link>
      <button
        type="button"
        className="site-header-menu-toggle"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav className={`site-header-nav${menuOpen ? " open" : ""}`}>
        <Link to="/draft" onClick={closeMenu}>
          Build
        </Link>
        <Link to="/guide" onClick={closeMenu}>
          How to Play
        </Link>
        <Link to="/builds" onClick={closeMenu}>
          My Builds
        </Link>
        <Link to="/leaderboard" onClick={closeMenu}>
          Leaderboard
        </Link>
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
            <Link to="/login" onClick={closeMenu}>
              Log In
            </Link>
            <Link to="/register" className="site-header-cta" onClick={closeMenu}>
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
