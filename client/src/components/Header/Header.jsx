import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../../context/AuthContext.jsx";

const NAV_LINKS = [
  { to: "/draft", label: "Build" },
  { to: "/guide", label: "How to Play" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/pvp", label: "PvP" },
  { to: "/builds", label: "My Builds" },
];

/**
 * App-wide top nav: a single compact bar (brand + one "Menu" trigger) at
 * every screen width, not just a mobile fallback - clicking the trigger
 * drops an animated panel down with every link plus the account section.
 * Kept minimal at rest on purpose, so the header stays out of the way of
 * whatever page it's sitting on top of until someone actually wants it.
 */
export default function Header() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const headerRef = useRef(null);

  // Close on navigation - Header persists across route changes (it's not
  // remounted per page), so nothing else would close an open panel once
  // a link inside it has already been followed.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on an outside click - checked against the whole header (bar +
  // panel) so clicking the trigger itself never gets misread as "outside"
  // and instantly re-closes what it just opened.
  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/");
  }

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header-bar">
        <Link to="/" className="site-header-brand">
          🎾 TennisBuild
        </Link>
        <button
          type="button"
          className="site-header-menu-trigger"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          Menu
          <span
            className={`site-header-menu-caret${open ? " open" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.nav
            className="site-header-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="site-header-panel-inner">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`site-header-panel-link${
                    location.pathname === link.to ? " active" : ""
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <div className="site-header-panel-divider" />

              {!loading && user && (
                <div className="site-header-panel-account">
                  <span className="site-header-user">Hi, {user.name}</span>
                  <button
                    type="button"
                    className="site-header-link-button"
                    onClick={handleLogout}
                  >
                    Log Out
                  </button>
                </div>
              )}
              {!loading && !user && (
                <div className="site-header-panel-account">
                  <div className="site-header-panel-account-links">
                    <Link to="/login">Log In</Link>
                  </div>
                  <Link to="/register" className="site-header-cta">
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
