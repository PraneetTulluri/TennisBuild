import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  computeOverall,
  computeArchetype,
} from "@tennisbuild/game-engine";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyBuilds } from "../api/builds.js";
import {
  fetchPvpTeam,
  setPvpTeam,
  challengePvpOpponent,
  fetchPvpHistory,
} from "../api/pvp.js";

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

const SURFACE_LABEL = { hard: "Hard Court", clay: "Clay Court", grass: "Grass Court" };

// Picking a team is just choosing 3 of your own saved builds - no
// pairing/ordering to configure, since ties always auto-pair each side's
// strongest build against the other's strongest (see the engine's
// simulatePvpTie), so there's nothing else to decide here.
function TeamPicker({ builds, onSave, saving, error }) {
  const [selectedIds, setSelectedIds] = useState([]);

  function toggle(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="pvp-team-picker">
      <p className="pvp-picker-hint">
        Pick exactly 3 of your saved builds ({selectedIds.length}/3 selected).
      </p>
      <div className="pvp-picker-grid">
        {builds.map((build) => {
          const attributes = attributesFromLocked(build.locked);
          const overall = computeOverall(attributes);
          const selected = selectedIds.includes(build._id);
          return (
            <button
              type="button"
              key={build._id}
              className={`pvp-picker-card${selected ? " selected" : ""}`}
              onClick={() => toggle(build._id)}
            >
              <span className={`pvp-picker-overall${overall > 99 ? " elite-value" : ""}`}>
                {overall}
              </span>
              <span className="pvp-picker-name">{build.name}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="draft-error">{error}</p>}
      <button
        type="button"
        className="spin-button"
        disabled={selectedIds.length !== 3 || saving}
        onClick={() => onSave(selectedIds)}
      >
        {saving ? "Saving Team…" : "Save Team"}
      </button>
    </div>
  );
}

function TeamRoster({ team, onEdit }) {
  return (
    <div className="pvp-roster">
      <div className="pvp-roster-header">
        <p className="result-kicker">Your Team</p>
        <button type="button" className="secondary-button" onClick={onEdit}>
          Change Team
        </button>
      </div>
      <div className="pvp-roster-grid">
        {team.map((build) => {
          const attributes = attributesFromLocked(build.locked);
          const overall = computeOverall(attributes);
          const archetype = computeArchetype(attributes);
          const pvp = build.pvp ?? { elo: 1200, wins: 0, losses: 0 };
          return (
            <div key={build._id} className="pvp-roster-card">
              <span className={`pvp-roster-overall${overall > 99 ? " elite-value" : ""}`}>
                {overall}
              </span>
              <strong>{build.name}</strong>
              <span className="pvp-roster-archetype">{archetype.label}</span>
              <span className="pvp-roster-elo">{pvp.elo} Elo</span>
              <span className="pvp-roster-record">
                {pvp.wins}-{pvp.losses}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChallengeReveal({ result }) {
  const { tie, opponentName, challengerTeam, defenderTeam } = result;
  const challengerWon = tie.winner === "challenger";
  const nameById = new Map(
    [...challengerTeam, ...defenderTeam].map((b) => [b._id, b.name])
  );

  return (
    <div className={`pvp-reveal${challengerWon ? " win" : " loss"}`}>
      <p className="pvp-reveal-headline">{challengerWon ? "Tie Won! 🏆" : "Tie Lost"}</p>
      <p className="pvp-reveal-sub">
        {tie.challengerScore}-{tie.defenderScore} vs {opponentName} on{" "}
        {SURFACE_LABEL[tie.surface]}
      </p>
      <div className="pvp-reveal-matches">
        {tie.matches.map((match, i) => {
          const matchWon = match.winner === "challenger";
          return (
            <div
              key={match.slot}
              className={`pvp-reveal-match${matchWon ? " win" : " loss"}`}
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <span className="pvp-reveal-slot">Match {i + 1}</span>
              <span className="pvp-reveal-names">
                {nameById.get(match.challengerBuildId)} vs{" "}
                {nameById.get(match.defenderBuildId)}
              </span>
              <span className="pvp-reveal-score">
                {match.challengerSets}-{match.defenderSets}
              </span>
              <span
                className={`pvp-reveal-elo${match.challengerEloDelta >= 0 ? " up" : " down"}`}
              >
                {match.challengerEloDelta >= 0 ? "+" : ""}
                {match.challengerEloDelta} Elo
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchHistory({ ties, userId }) {
  if (!ties || ties.length === 0) {
    return <p className="pvp-history-empty">No matches played yet.</p>;
  }

  return (
    <div className="pvp-history-list">
      {ties.map((tie) => {
        const wasChallenger = tie.challengerUserId?._id === userId;
        const opponentName = wasChallenger
          ? tie.defenderUserId?.name
          : tie.challengerUserId?.name;
        const myScore = wasChallenger ? tie.challengerScore : tie.defenderScore;
        const theirScore = wasChallenger ? tie.defenderScore : tie.challengerScore;
        const outcome = wasChallenger
          ? tie.winner === "challenger"
            ? "win"
            : "loss"
          : "watched"; // a defender's own record doesn't move either way
        return (
          <div key={tie._id} className={`pvp-history-row ${outcome}`}>
            <span className="pvp-history-role">
              {wasChallenger ? "Challenged" : "Defended vs"}
            </span>
            <span className="pvp-history-opponent">{opponentName ?? "Unknown"}</span>
            <span className="pvp-history-surface">{SURFACE_LABEL[tie.surface]}</span>
            <span className="pvp-history-score">
              {myScore}-{theirScore}
            </span>
            <span className="pvp-history-outcome">
              {wasChallenger ? (outcome === "win" ? "Won" : "Lost") : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Async team-vs-team PvP: pick 3 saved builds as your team, challenge a
 * random Elo-banded opponent, get an instant result - the opponent never
 * needs to be online, since a tie is fully resolved server-side the
 * moment you challenge (see server/src/routes/pvp.js and the engine's
 * simulatePvpTie). Requires an account, same reasoning as the Leaderboard
 * - a persistent Elo/record needs a persistent identity.
 */
export default function PvpPage() {
  const { user, loading: authLoading } = useAuth();
  const [myBuilds, setMyBuilds] = useState(null);
  const [team, setTeam] = useState(null);
  const [editingTeam, setEditingTeam] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState(null);

  const [challenging, setChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState(null);
  const [challengeError, setChallengeError] = useState(null);

  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchMyBuilds()
      .then(setMyBuilds)
      .catch(() => setMyBuilds([]));
    fetchPvpTeam()
      .then((data) => setTeam(data.team))
      .catch(() => setTeam([]));
    fetchPvpHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [user]);

  const hasFullTeam = team && team.length === 3;

  async function refreshTeamAndHistory() {
    const [teamData, historyData] = await Promise.all([
      fetchPvpTeam(),
      fetchPvpHistory(),
    ]);
    setTeam(teamData.team);
    setHistory(historyData);
  }

  async function handleSaveTeam(buildIds) {
    setSavingTeam(true);
    setTeamError(null);
    try {
      const data = await setPvpTeam(buildIds);
      setTeam(data.team);
      setEditingTeam(false);
    } catch (err) {
      setTeamError(err.message);
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleChallenge() {
    setChallenging(true);
    setChallengeError(null);
    setChallengeResult(null);
    try {
      const result = await challengePvpOpponent();
      setChallengeResult(result);
      await refreshTeamAndHistory();
    } catch (err) {
      setChallengeError(err.message);
    } finally {
      setChallenging(false);
    }
  }

  if (authLoading) {
    return <div className="pvp-page" />;
  }

  if (!user) {
    return (
      <div className="pvp-page">
        <p className="result-kicker">PvP Ladder</p>
        <h1>Team Battles</h1>
        <p>
          Build a 3-player team, challenge random opponents, and climb the Elo ladder.
          Requires an account, since your team and rating need to persist between visits.
        </p>
        <Link to="/register">
          <button type="button" className="spin-button">
            Sign Up Free
          </button>
        </Link>
      </div>
    );
  }

  if (!myBuilds || !team || !history) {
    return (
      <div className="pvp-page">
        <p>Loading…</p>
      </div>
    );
  }

  if (myBuilds.length < 3) {
    return (
      <div className="pvp-page">
        <p className="result-kicker">PvP Ladder</p>
        <h1>Team Battles</h1>
        <p>
          You need at least 3 saved builds to field a team - you have {myBuilds.length} so
          far. <Link to="/draft">Build another</Link> to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="pvp-page">
      <p className="result-kicker">PvP Ladder</p>
      <h1>Team Battles</h1>
      <p className="pvp-intro">
        3 builds a side, auto-paired strongest-to-strongest, one random surface for the
        whole tie. Your opponent doesn&rsquo;t need to be online - the result is instant.
      </p>

      {hasFullTeam && !editingTeam ? (
        <TeamRoster team={team} onEdit={() => setEditingTeam(true)} />
      ) : (
        <TeamPicker
          builds={myBuilds}
          onSave={handleSaveTeam}
          saving={savingTeam}
          error={teamError}
        />
      )}

      {hasFullTeam && !editingTeam && (
        <div className="pvp-challenge-block">
          <button
            type="button"
            className="spin-button"
            disabled={challenging}
            onClick={handleChallenge}
          >
            {challenging ? "Finding Opponent…" : "Find Match"}
          </button>
          {challengeError && <p className="draft-error">{challengeError}</p>}
        </div>
      )}

      {challengeResult && <ChallengeReveal result={challengeResult} />}

      <div className="pvp-history-section">
        <p className="result-kicker">Match History</p>
        <MatchHistory ties={history} userId={user.id} />
      </div>
    </div>
  );
}
