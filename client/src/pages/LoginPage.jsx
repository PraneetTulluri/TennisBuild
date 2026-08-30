import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { BubbleBackground } from "../components/animate-ui/components/backgrounds/bubble.jsx";
import { AUTH_BUBBLE_COLORS } from "../utils/authBubbleColors.js";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <BubbleBackground
        interactive={false}
        colors={AUTH_BUBBLE_COLORS}
        className="auth-page-bubble-bg"
      />
      <div className="auth-page-content">
        <p className="result-kicker">Welcome Back</p>
        <h1>Log In</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="draft-error">{error}</p>}
          <button type="submit" className="spin-button" disabled={submitting}>
            {submitting ? "Logging in…" : "Log In"}
          </button>
        </form>
        <p className="auth-switch">
          No account yet? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
