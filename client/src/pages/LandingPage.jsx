import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { pickRandom } from "@tennisbuild/game-engine";
import { fetchPlayers } from "../api/players.js";

/**
 * Phase 1 landing page. Its real job right now is to prove the full
 * round trip works: client -> Express API -> MongoDB (via fetchPlayers),
 * and client -> shared game-engine package (via pickRandom). The actual
 * landing page design/copy is a Phase 4+ concern.
 */
export default function LandingPage() {
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [spotlight, setSpotlight] = useState(null);

  useEffect(() => {
    fetchPlayers()
      .then(setPlayers)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (players.length > 0) {
      // Proves @tennisbuild/game-engine resolves and runs correctly
      // from inside a client component.
      setSpotlight(pickRandom(players));
    }
  }, [players]);

  return (
    <div>
      <h1>TennisBuild</h1>
      <p>Build a custom tennis player from real ATP legends and pros.</p>

      <Link to="/draft">
        <button>Start Build</button>
      </Link>

      <hr />
      <h2>Phase 1 verification</h2>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!error && players.length === 0 && <p>Loading players from the API...</p>}
      {players.length > 0 && (
        <>
          <p>Loaded {players.length} player(s) from the backend:</p>
          <ul>
            {players.map((p) => (
              <li key={p.slug}>{p.name}</li>
            ))}
          </ul>
          {spotlight && (
            <p>
              Game engine spotlight pick (via <code>pickRandom</code>):{" "}
              <strong>{spotlight.name}</strong>
            </p>
          )}
        </>
      )}
    </div>
  );
}
