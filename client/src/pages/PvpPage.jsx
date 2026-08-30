import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATTRIBUTE_KEYS,
  PVP_SURFACES,
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
import { playTick } from "../utils/sound.js";

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

const SURFACE_LABEL = { hard: "Hard Court", clay: "Clay Court", grass: "Grass Court" };

function buildNameMap(challengerTeam, defenderTeam) {
  return new Map([...challengerTeam, ...defenderTeam].map((b) => [b._id, b.name]));
}

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
          return (
            <div key={build._id} className="pvp-roster-card">
              <span className={`pvp-roster-overall${overall > 99 ? " elite-value" : ""}`}>
                {overall}
              </span>
              <strong>{build.name}</strong>
              <span className="pvp-roster-archetype">{archetype.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The account's ladder standing - lives on the user, not any one build
// (see server/src/models/User.js), so it's shown once here rather than
// repeated per build the way overall/archetype are.
function RatingBadge({ pvp }) {
  return (
    <div className="pvp-rating-badge">
      <div className="pvp-rating-elo">
        <strong>{pvp.elo}</strong>
        <span>Elo Rating</span>
      </div>
      <div className="pvp-rating-record">
        <strong>
          {pvp.wins}-{pvp.losses}
        </strong>
        <span>{pvp.matchesPlayed} Ties Played</span>
      </div>
    </div>
  );
}

// A short spin over the 3 real surfaces (same "reel eases to a stop under
// a fixed pointer" trick as the draft page's Wheel) landing on the
// surface the server already rolled for this tie - purely a reveal of an
// already-decided outcome, same reasoning as the match playback below.
const SURFACE_SPIN_MS = 1600;
const REEL_LENGTH = 27;

function buildSurfaceReel(finalSurface) {
  const reel = [];
  for (let i = 0; i < REEL_LENGTH - 1; i++) {
    reel.push(PVP_SURFACES[i % PVP_SURFACES.length]);
  }
  reel.push(finalSurface);
  return reel;
}

function SurfaceWheel({ finalSurface, onLanded }) {
  const reel = useMemo(() => buildSurfaceReel(finalSurface), [finalSurface]);
  const [animate, setAnimate] = useState(false);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;

  useEffect(() => {
    // Same reset-then-animate gap as Wheel.jsx: let the browser paint the
    // strip at rest before flipping the transition on, or the two frames
    // can collapse and the spin never visibly plays.
    const startTimer = setTimeout(() => setAnimate(true), 30);
    const settleTimer = setTimeout(() => onLandedRef.current(), SURFACE_SPIN_MS + 150);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(settleTimer);
    };
  }, []);

  useEffect(() => {
    if (!animate) return undefined;
    let cancelled = false;
    let timeoutId;
    let delay = 60;
    const startedAt = Date.now();
    function tick() {
      if (cancelled) return;
      playTick();
      delay = Math.min(240, delay * 1.2);
      if (Date.now() - startedAt + delay < SURFACE_SPIN_MS) {
        timeoutId = setTimeout(tick, delay);
      }
    }
    timeoutId = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [animate]);

  return (
    <div className="pvp-surface-wheel">
      <p className="pvp-picker-hint">Rolling the surface for this tie…</p>
      <div className="pvp-surface-wheel-viewport">
        <div className="pvp-surface-wheel-pointer" aria-hidden="true" />
        <div
          className={`pvp-surface-wheel-strip${animate ? " animate" : ""}`}
          style={{
            transform: animate ? `translateX(-${(reel.length - 1) * 180}px)` : "none",
          }}
        >
          {reel.map((surface, i) => (
            <div key={i} className={`pvp-surface-tile pvp-surface-${surface}`}>
              {SURFACE_LABEL[surface]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Match playback ----------
//
// Precomputes one "reveal state" per game in the match (index 0 = nothing
// shown yet) so the live player just looks up snapshots[revealedCount] -
// the actual pacing/animation is a plain timer advancing that index, kept
// completely separate from the score-tallying logic.
function buildMatchSnapshots(sets) {
  const snapshots = [];
  const boundaries = []; // boundaries[gameIndex] = true if that game ended its set
  const setStates = sets.map(() => ({
    challengerGames: 0,
    defenderGames: 0,
    complete: false,
    winner: null,
  }));
  let challengerSetsWon = 0;
  let defenderSetsWon = 0;

  function snapshot() {
    return {
      sets: setStates.map((s) => ({ ...s })),
      challengerSetsWon,
      defenderSetsWon,
    };
  }

  snapshots.push(snapshot());

  sets.forEach((set, setIndex) => {
    set.games.forEach((side, gameIndexInSet) => {
      const s = setStates[setIndex];
      if (side === "A") s.challengerGames++;
      else s.defenderGames++;
      snapshots.push(snapshot());
      boundaries.push(gameIndexInSet === set.games.length - 1);
    });
    setStates[setIndex].complete = true;
    setStates[setIndex].winner = set.winner;
    if (set.winner === "challenger") challengerSetsWon++;
    else defenderSetsWon++;
    // Overwrite the snapshot for the game that just ended the set so the
    // "set won" tally updates on that exact game, not one tick later.
    snapshots[snapshots.length - 1] = snapshot();
  });

  return { snapshots, boundaries };
}

const GAME_TICK_MS = 380;
const SET_PAUSE_MS = 700;

function MatchPlayer({ match, challengerName, defenderName, onComplete }) {
  const { snapshots, boundaries } = useMemo(
    () => buildMatchSnapshots(match.sets),
    [match]
  );
  const totalGames = snapshots.length - 1;
  const [revealed, setRevealed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (skipped) {
      setRevealed(totalGames);
      return undefined;
    }
    if (revealed >= totalGames) return undefined;
    const justFinishedSet = revealed > 0 && boundaries[revealed - 1];
    const delay = justFinishedSet ? SET_PAUSE_MS : GAME_TICK_MS;
    const timer = setTimeout(() => {
      playTick();
      setRevealed((r) => r + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [revealed, skipped, totalGames, boundaries]);

  const done = revealed >= totalGames;

  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => onCompleteRef.current(), 400);
    return () => clearTimeout(timer);
  }, [done]);

  const snap = snapshots[revealed];

  return (
    <div className="pvp-match-player">
      <div className="pvp-match-player-header">
        <span>{challengerName}</span>
        <span className="pvp-match-player-sets">
          {snap.challengerSetsWon} – {snap.defenderSetsWon}
        </span>
        <span>{defenderName}</span>
      </div>
      <div className="pvp-match-player-sets-row">
        {snap.sets.map((s, i) => (
          <span
            key={i}
            className={`pvp-set-pill${s.complete ? " complete" : ""}${
              !s.complete && (s.challengerGames > 0 || s.defenderGames > 0) ? " live" : ""
            }`}
          >
            {s.challengerGames}-{s.defenderGames}
          </span>
        ))}
      </div>
      {!done && (
        <button
          type="button"
          className="secondary-button pvp-skip-button"
          onClick={() => setSkipped(true)}
        >
          Skip to Result
        </button>
      )}
      {done && (
        <p className="pvp-match-player-result">
          {match.winner === "challenger" ? challengerName : defenderName} wins{" "}
          {match.challengerSets}-{match.defenderSets}
        </p>
      )}
    </div>
  );
}

function ChallengeReveal({ result }) {
  const { tie, opponentName, challengerTeam, defenderTeam } = result;
  const challengerWon = tie.winner === "challenger";
  const nameById = buildNameMap(challengerTeam, defenderTeam);
  const eloDelta = tie.challengerEloAfter - tie.challengerEloBefore;

  return (
    <div className={`pvp-reveal${challengerWon ? " win" : " loss"}`}>
      <p className="pvp-reveal-headline">{challengerWon ? "Tie Won! 🏆" : "Tie Lost"}</p>
      <p className="pvp-reveal-sub">
        {tie.challengerScore}-{tie.defenderScore} vs {opponentName} on{" "}
        {SURFACE_LABEL[tie.surface]}
      </p>
      <p className={`pvp-reveal-elo-total${eloDelta >= 0 ? " up" : " down"}`}>
        {eloDelta >= 0 ? "+" : ""}
        {eloDelta} Elo → {tie.challengerEloAfter}
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
        const eloDelta = wasChallenger
          ? tie.challengerEloAfter - tie.challengerEloBefore
          : tie.defenderEloAfter - tie.defenderEloBefore;
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
            <span className={`pvp-history-elo${eloDelta >= 0 ? " up" : " down"}`}>
              {eloDelta >= 0 ? "+" : ""}
              {eloDelta} Elo
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
 * random Elo-banded opponent, and watch the tie play out - the opponent
 * never needs to be online, since the whole tie is fully resolved
 * server-side the instant you challenge (see server/src/routes/pvp.js and
 * the engine's simulatePvpTie/simulatePvpMatch). What plays out on screen
 * (surface wheel, then each match game-by-game) is purely a client-side
 * reveal of that already-decided result, one piece at a time, not a
 * second live simulation - refreshing mid-animation would just show the
 * same ending sooner. Requires an account, same reasoning as the
 * Leaderboard - a persistent Elo/record needs a persistent identity.
 */
export default function PvpPage() {
  const { user, loading: authLoading } = useAuth();
  const [myBuilds, setMyBuilds] = useState(null);
  const [team, setTeam] = useState(null);
  const [pvpStats, setPvpStats] = useState(null);
  const [editingTeam, setEditingTeam] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState(null);

  const [challenging, setChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState(null);
  const [challengeError, setChallengeError] = useState(null);
  // null | "surface" | 0 | 1 | 2 | "summary"
  const [revealStage, setRevealStage] = useState(null);
  const [matchAdvanceReady, setMatchAdvanceReady] = useState(false);

  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchMyBuilds()
      .then(setMyBuilds)
      .catch(() => setMyBuilds([]));
    fetchPvpTeam()
      .then((data) => {
        setTeam(data.team);
        setPvpStats(data.pvp);
      })
      .catch(() => {
        setTeam([]);
        setPvpStats({ elo: 1200, wins: 0, losses: 0, matchesPlayed: 0 });
      });
    fetchPvpHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [user]);

  const hasFullTeam = team && team.length === 3;
  const revealInProgress = revealStage !== null && revealStage !== "summary";

  async function handleSaveTeam(buildIds) {
    setSavingTeam(true);
    setTeamError(null);
    try {
      const data = await setPvpTeam(buildIds);
      setTeam(data.team);
      setPvpStats(data.pvp);
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
    setRevealStage(null);
    setMatchAdvanceReady(false);
    try {
      const result = await challengePvpOpponent();
      setChallengeResult(result);
      setRevealStage("surface");
    } catch (err) {
      setChallengeError(err.message);
    } finally {
      setChallenging(false);
    }
  }

  function finishReveal() {
    setRevealStage("summary");
    setPvpStats(challengeResult.pvp);
    fetchPvpHistory()
      .then(setHistory)
      .catch(() => {});
  }

  function handleNextMatch() {
    if (revealStage < 2) {
      setRevealStage(revealStage + 1);
      setMatchAdvanceReady(false);
    } else {
      finishReveal();
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

  if (!myBuilds || !team || !history || !pvpStats) {
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

  const nameById =
    challengeResult &&
    buildNameMap(challengeResult.challengerTeam, challengeResult.defenderTeam);

  return (
    <div className="pvp-page">
      <p className="result-kicker">PvP Ladder</p>
      <h1>Team Battles</h1>
      <p className="pvp-intro">
        3 builds a side, auto-paired strongest-to-strongest, one random surface for the
        whole tie. Your opponent doesn&rsquo;t need to be online - the result is instant.
      </p>

      <RatingBadge pvp={pvpStats} />

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
            disabled={challenging || revealInProgress}
            onClick={handleChallenge}
          >
            {challenging ? "Finding Opponent…" : "Find Match"}
          </button>
          {challengeError && <p className="draft-error">{challengeError}</p>}
        </div>
      )}

      {revealStage === "surface" && challengeResult && (
        <SurfaceWheel
          finalSurface={challengeResult.tie.surface}
          onLanded={() => setRevealStage(0)}
        />
      )}

      {typeof revealStage === "number" && challengeResult && (
        <div className="pvp-match-stage">
          <p className="pvp-match-stage-label">
            Match {revealStage + 1} of 3 · {SURFACE_LABEL[challengeResult.tie.surface]}
          </p>
          <MatchPlayer
            key={revealStage}
            match={challengeResult.tie.matches[revealStage]}
            challengerName={nameById.get(
              challengeResult.tie.matches[revealStage].challengerBuildId
            )}
            defenderName={nameById.get(
              challengeResult.tie.matches[revealStage].defenderBuildId
            )}
            onComplete={() => setMatchAdvanceReady(true)}
          />
          {matchAdvanceReady && (
            <button type="button" className="spin-button" onClick={handleNextMatch}>
              {revealStage < 2 ? "Next Match" : "See Final Result"}
            </button>
          )}
        </div>
      )}

      {revealStage === "summary" && challengeResult && (
        <ChallengeReveal result={challengeResult} />
      )}

      <div className="pvp-history-section">
        <p className="result-kicker">Match History</p>
        <MatchHistory ties={history} userId={user.id} />
      </div>
    </div>
  );
}
