import { Router } from "express";
import {
  ATTRIBUTE_KEYS,
  ELO_STARTING_RATING,
  randomPvpSurface,
  simulatePvpTie,
  updateEloPair,
} from "@tennisbuild/game-engine";
import { Build } from "../models/Build.js";
import { User } from "../models/User.js";
import { PvpTie } from "../models/PvpTie.js";

const router = Router();

function attributesFromLocked(locked) {
  const result = {};
  for (const key of ATTRIBUTE_KEYS) result[key] = locked[key].value;
  return result;
}

function requireLogin(req, res) {
  if (!req.userId) {
    res.status(401).json({ error: "Log in to use PvP" });
    return false;
  }
  return true;
}

// `.lean()` reads never apply schema defaults for a field that was never
// actually persisted (only real Mongoose document hydration does that),
// so any account created before the `pvp` field existed reads back as
// `undefined` here rather than the schema's default - fall back explicitly
// everywhere a stored user doc's pvp block is read.
function pvpOf(user) {
  return {
    elo: user.pvp?.elo ?? ELO_STARTING_RATING,
    wins: user.pvp?.wins ?? 0,
    losses: user.pvp?.losses ?? 0,
    matchesPlayed: user.pvp?.matchesPlayed ?? 0,
  };
}

// GET /api/pvp/team - the logged-in user's current 3-build roster (empty
// array if never set) plus their account-level PvP rating, populated with
// enough of each build to render a picker without a second round trip.
router.get("/team", async (req, res) => {
  if (!requireLogin(req, res)) return;
  try {
    const user = await User.findById(req.userId).populate("pvpTeam").lean();
    res.json({ team: user?.pvpTeam ?? [], pvp: pvpOf(user ?? {}) });
  } catch (err) {
    console.error("[routes/pvp] Failed to load team:", err);
    res.status(500).json({ error: "Failed to load PvP team" });
  }
});

// PUT /api/pvp/team - set/replace the active roster. Exactly 3 distinct
// builds, all owned by this account - checked here rather than at the
// schema level, since a schema-level length check can't also verify
// ownership and both need the same real query anyway.
router.put("/team", async (req, res) => {
  if (!requireLogin(req, res)) return;
  try {
    const { buildIds } = req.body;
    if (!Array.isArray(buildIds) || new Set(buildIds).size !== 3) {
      return res.status(400).json({ error: "buildIds must be exactly 3 distinct ids" });
    }
    const owned = await Build.countDocuments({
      _id: { $in: buildIds },
      userId: req.userId,
    });
    if (owned !== 3) {
      return res.status(400).json({ error: "All 3 builds must belong to your account" });
    }
    await User.findByIdAndUpdate(req.userId, { pvpTeam: buildIds });
    const user = await User.findById(req.userId).populate("pvpTeam").lean();
    res.json({ team: user.pvpTeam, pvp: pvpOf(user) });
  } catch (err) {
    console.error("[routes/pvp] Failed to set team:", err);
    res.status(500).json({ error: "Failed to set PvP team" });
  }
});

// Every other account with a full 3-build team, along with their PvP
// rating - one query, no per-candidate build lookups needed, since Elo
// now lives directly on the account rather than being averaged from
// builds. A candidate's actual team is only fetched once an opponent is
// picked (see below).
async function findEligibleOpponents(excludeUserId) {
  const candidates = await User.find({
    _id: { $ne: excludeUserId },
    pvpTeam: { $size: 3 },
  })
    .select("_id name pvp")
    .lean();
  return candidates.map((user) => ({
    userId: user._id,
    userName: user.name,
    elo: pvpOf(user).elo,
  }));
}

// Widens the Elo band until it finds at least one opponent, rather than
// ever just failing because the very nearest band happened to be empty -
// this project's user base is small enough early on that a tight band
// alone would rarely find a match at all.
const ELO_BANDS = [150, 300, 600, Infinity];

function pickOpponent(candidates, challengerElo) {
  for (const band of ELO_BANDS) {
    const inBand = candidates.filter((c) => Math.abs(c.elo - challengerElo) <= band);
    if (inBand.length > 0) {
      return inBand[Math.floor(Math.random() * inBand.length)];
    }
  }
  return null;
}

// POST /api/pvp/challenge - the whole flow: find an Elo-banded random
// opponent, roll a surface, resolve all 3 individual matches (each
// simulated game-by-game, not just set-by-set, so the client can play the
// score back), update both accounts' Elo once for the whole tie (win/loss
// record only for the challenger - see User.js's pvp field comment),
// record the tie, return the full result including every set's game log.
// Fully resolved server-side in one request - no live/real-time
// component, so the opponent doesn't need to be online; the client's
// game-by-game/surface-wheel animation is purely a reveal of an outcome
// that already happened, not something waited on here.
router.post("/challenge", async (req, res) => {
  if (!requireLogin(req, res)) return;
  try {
    const challengerUser = await User.findById(req.userId).populate("pvpTeam").lean();
    if (!challengerUser?.pvpTeam || challengerUser.pvpTeam.length !== 3) {
      return res.status(400).json({ error: "Set your 3-build PvP team first" });
    }

    const candidates = await findEligibleOpponents(req.userId);
    if (candidates.length === 0) {
      return res.status(404).json({
        error: "No opponents available yet - check back once other players set up a team",
      });
    }

    const challengerPvp = pvpOf(challengerUser);
    const opponentCandidate = pickOpponent(candidates, challengerPvp.elo);
    const defenderUser = await User.findById(opponentCandidate.userId)
      .populate("pvpTeam")
      .lean();
    if (!defenderUser?.pvpTeam || defenderUser.pvpTeam.length !== 3) {
      // Their team changed/broke between the matchmaking query and now -
      // vanishingly rare, but fail cleanly rather than simulate a
      // mismatched tie.
      return res
        .status(409)
        .json({ error: "Matched opponent's team changed - try finding a match again" });
    }
    const defenderPvp = pvpOf(defenderUser);

    const surface = randomPvpSurface();
    const challengerEntries = challengerUser.pvpTeam.map((b) => ({
      id: b._id.toString(),
      attributes: attributesFromLocked(b.locked),
    }));
    const defenderEntries = defenderUser.pvpTeam.map((b) => ({
      id: b._id.toString(),
      attributes: attributesFromLocked(b.locked),
    }));

    const tie = simulatePvpTie(challengerEntries, defenderEntries, surface);
    const tieWinnerIsChallenger = tie.winner === "A";

    // One Elo event for the whole tie, not one per individual match - the
    // fraction of the 3 matches the challenger won (0, 1/3, 2/3, or 1)
    // stands in for a normal binary win/loss score.
    const { ratingA: challengerEloAfter, ratingB: defenderEloAfter } = updateEloPair(
      challengerPvp.elo,
      defenderPvp.elo,
      tie.scoreA / 3
    );

    const matchRecords = tie.matches.map((match) => ({
      slot: match.slot,
      challengerBuildId: match.aId,
      defenderBuildId: match.bId,
      sets: match.sets.map((set) => ({
        games: set.games,
        challengerGames: set.gamesA,
        defenderGames: set.gamesB,
        winner: set.winner === "A" ? "challenger" : "defender",
      })),
      challengerSets: match.setsA,
      defenderSets: match.setsB,
      winner: match.winner === "A" ? "challenger" : "defender",
    }));

    const [savedTie] = await Promise.all([
      PvpTie.create({
        challengerUserId: req.userId,
        defenderUserId: defenderUser._id,
        surface,
        matches: matchRecords,
        challengerScore: tie.scoreA,
        defenderScore: tie.scoreB,
        winner: tieWinnerIsChallenger ? "challenger" : "defender",
        challengerEloBefore: challengerPvp.elo,
        challengerEloAfter,
        defenderEloBefore: defenderPvp.elo,
        defenderEloAfter,
      }),
      User.findByIdAndUpdate(req.userId, {
        $set: { "pvp.elo": challengerEloAfter },
        $inc: {
          "pvp.matchesPlayed": 1,
          "pvp.wins": tieWinnerIsChallenger ? 1 : 0,
          "pvp.losses": tieWinnerIsChallenger ? 0 : 1,
        },
      }),
      User.findByIdAndUpdate(defenderUser._id, {
        $set: { "pvp.elo": defenderEloAfter },
        $inc: { "pvp.matchesPlayed": 1 },
      }),
    ]);

    res.status(201).json({
      tie: savedTie,
      opponentName: defenderUser.name,
      challengerTeam: challengerUser.pvpTeam.map((b) => ({ _id: b._id, name: b.name })),
      defenderTeam: defenderUser.pvpTeam.map((b) => ({ _id: b._id, name: b.name })),
      pvp: {
        elo: challengerEloAfter,
        wins: challengerPvp.wins + (tieWinnerIsChallenger ? 1 : 0),
        losses: challengerPvp.losses + (tieWinnerIsChallenger ? 0 : 1),
        matchesPlayed: challengerPvp.matchesPlayed + 1,
      },
    });
  } catch (err) {
    console.error("[routes/pvp] Failed to resolve challenge:", err);
    res.status(500).json({ error: "Failed to resolve challenge" });
  }
});

// GET /api/pvp/history - every tie this account has been part of, either
// as challenger or defender (a defender can't act on it, but can still
// see when their team was tested), newest first.
router.get("/history", async (req, res) => {
  if (!requireLogin(req, res)) return;
  try {
    const ties = await PvpTie.find({
      $or: [{ challengerUserId: req.userId }, { defenderUserId: req.userId }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("challengerUserId", "name")
      .populate("defenderUserId", "name")
      .populate("matches.challengerBuildId", "name")
      .populate("matches.defenderBuildId", "name")
      .lean();
    res.json(ties);
  } catch (err) {
    console.error("[routes/pvp] Failed to load history:", err);
    res.status(500).json({ error: "Failed to load PvP history" });
  }
});

export default router;
