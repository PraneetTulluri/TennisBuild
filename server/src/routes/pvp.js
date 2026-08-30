import { Router } from "express";
import {
  ATTRIBUTE_KEYS,
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

// GET /api/pvp/team - the logged-in user's current 3-build roster (empty
// array if never set), populated with enough of each build to render a
// picker without a second round trip.
router.get("/team", async (req, res) => {
  if (!requireLogin(req, res)) return;
  try {
    const user = await User.findById(req.userId).populate("pvpTeam").lean();
    res.json({ team: user?.pvpTeam ?? [] });
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
    res.json({ team: user.pvpTeam });
  } catch (err) {
    console.error("[routes/pvp] Failed to set team:", err);
    res.status(500).json({ error: "Failed to set PvP team" });
  }
});

// Fetches every other account's team average Elo, in as few queries as
// possible: one for the candidate users, one for all their builds
// together (not one query per candidate).
async function findEligibleOpponents(excludeUserId) {
  const candidates = await User.find({
    _id: { $ne: excludeUserId },
    pvpTeam: { $size: 3 },
  })
    .select("_id name pvpTeam")
    .lean();
  if (candidates.length === 0) return [];

  const allBuildIds = candidates.flatMap((u) => u.pvpTeam.map((id) => id.toString()));
  const builds = await Build.find({ _id: { $in: allBuildIds } }).lean();
  const buildById = new Map(builds.map((b) => [b._id.toString(), b]));

  return candidates
    .map((user) => {
      const teamBuilds = user.pvpTeam
        .map((id) => buildById.get(id.toString()))
        .filter(Boolean);
      if (teamBuilds.length !== 3) return null; // a build in their team was deleted/missing
      const avgElo =
        teamBuilds.reduce((sum, b) => sum + (b.pvp?.elo ?? 1200), 0) / teamBuilds.length;
      return { userId: user._id, userName: user.name, teamBuilds, avgElo };
    })
    .filter(Boolean);
}

// Widens the Elo band until it finds at least one opponent, rather than
// ever just failing because the very nearest band happened to be empty -
// this project's user base is small enough early on that a tight band
// alone would rarely find a match at all.
const ELO_BANDS = [150, 300, 600, Infinity];

function pickOpponent(candidates, challengerAvgElo) {
  for (const band of ELO_BANDS) {
    const inBand = candidates.filter(
      (c) => Math.abs(c.avgElo - challengerAvgElo) <= band
    );
    if (inBand.length > 0) {
      return inBand[Math.floor(Math.random() * inBand.length)];
    }
  }
  return null;
}

// POST /api/pvp/challenge - the whole flow: find an Elo-banded random
// opponent, roll a surface, resolve all 3 individual matches, update
// both sides' Elo (win/loss record only for the challenger - see
// Build.js's pvp field comment), record the tie, return the full result.
// Fully resolved server-side in one request - no live/real-time
// component, so the opponent doesn't need to be online.
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

    const challengerAvgElo =
      challengerUser.pvpTeam.reduce((sum, b) => sum + (b.pvp?.elo ?? 1200), 0) / 3;
    const opponent = pickOpponent(candidates, challengerAvgElo);

    const surface = randomPvpSurface();
    const challengerEntries = challengerUser.pvpTeam.map((b) => ({
      id: b._id.toString(),
      attributes: attributesFromLocked(b.locked),
    }));
    const defenderEntries = opponent.teamBuilds.map((b) => ({
      id: b._id.toString(),
      attributes: attributesFromLocked(b.locked),
    }));

    const tie = simulatePvpTie(challengerEntries, defenderEntries, surface);

    // Apply Elo/win-loss updates per individual match, collecting them
    // into one bulk write per side instead of 6 separate saves.
    const buildUpdates = new Map(); // buildId -> { $inc: {...} }
    const matchRecords = [];

    const eloBefore = new Map();
    for (const b of [...challengerUser.pvpTeam, ...opponent.teamBuilds]) {
      eloBefore.set(b._id.toString(), b.pvp?.elo ?? 1200);
    }

    for (const match of tie.matches) {
      const challengerWonMatch = match.winner === "A";
      const challengerEloBefore = eloBefore.get(match.aId);
      const defenderEloBefore = eloBefore.get(match.bId);
      const { ratingA, ratingB } = updateEloPair(
        challengerEloBefore,
        defenderEloBefore,
        challengerWonMatch ? 1 : 0
      );
      const challengerDelta = ratingA - challengerEloBefore;
      const defenderDelta = ratingB - defenderEloBefore;

      buildUpdates.set(match.aId, {
        $inc: {
          "pvp.matchesPlayed": 1,
          "pvp.wins": challengerWonMatch ? 1 : 0,
          "pvp.losses": challengerWonMatch ? 0 : 1,
        },
        $set: { "pvp.elo": ratingA },
      });
      buildUpdates.set(match.bId, {
        $inc: { "pvp.matchesPlayed": 1 },
        $set: { "pvp.elo": ratingB },
      });

      matchRecords.push({
        slot: match.slot,
        challengerBuildId: match.aId,
        defenderBuildId: match.bId,
        challengerSets: match.setsA,
        defenderSets: match.setsB,
        winner: challengerWonMatch ? "challenger" : "defender",
        challengerEloDelta: challengerDelta,
        defenderEloDelta: defenderDelta,
      });
    }

    await Promise.all(
      Array.from(buildUpdates.entries()).map(([buildId, update]) =>
        Build.findByIdAndUpdate(buildId, update)
      )
    );

    const tieWinnerIsChallenger = tie.winner === "A";
    const savedTie = await PvpTie.create({
      challengerUserId: req.userId,
      defenderUserId: opponent.userId,
      surface,
      matches: matchRecords,
      challengerScore: tie.scoreA,
      defenderScore: tie.scoreB,
      winner: tieWinnerIsChallenger ? "challenger" : "defender",
    });

    res.status(201).json({
      tie: savedTie,
      opponentName: opponent.userName,
      challengerTeam: challengerUser.pvpTeam.map((b) => ({ _id: b._id, name: b.name })),
      defenderTeam: opponent.teamBuilds.map((b) => ({ _id: b._id, name: b.name })),
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
