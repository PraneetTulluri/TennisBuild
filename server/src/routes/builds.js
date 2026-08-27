import { Router } from "express";
import { Build } from "../models/Build.js";

const router = Router();

// POST /api/builds - save a finished draft build. Always tagged with the
// guest session id; also tagged with the logged-in user's id when
// req.userId is set (see middleware/attachUser.js), so a build saved
// while logged in belongs to the account right away rather than needing
// a separate claim step.
router.post("/", async (req, res) => {
  try {
    const { name, guestSessionId, locked, flavor } = req.body;
    if (!name || !guestSessionId || !locked) {
      return res
        .status(400)
        .json({ error: "name, guestSessionId, and locked are required" });
    }
    const build = await Build.create({
      name,
      guestSessionId,
      locked,
      flavor,
      userId: req.userId ?? undefined,
    });
    res.status(201).json(build);
  } catch (err) {
    console.error("[routes/builds] Failed to save build:", err);
    res.status(500).json({ error: "Failed to save build" });
  }
});

// GET /api/builds?sessionId=... - list saved builds, newest first. When
// logged in, lists every build tied to the account (across any browser/
// guest session it was saved from); when not, falls back to the guest
// session id query param, same as before auth existed.
router.get("/", async (req, res) => {
  try {
    const filter = req.userId
      ? { userId: req.userId }
      : { guestSessionId: req.query.sessionId };
    if (!req.userId && !req.query.sessionId) {
      return res.status(400).json({ error: "sessionId query param is required" });
    }
    const builds = await Build.find(filter).sort({ createdAt: -1 }).lean();
    res.json(builds);
  } catch (err) {
    console.error("[routes/builds] Failed to list builds:", err);
    res.status(500).json({ error: "Failed to list builds" });
  }
});

// GET /api/builds/leaderboard - every saved build (guest and account alike),
// for browsing/sorting across *all* players, not just your own. Registered
// ahead of GET /:id so "leaderboard" isn't swallowed as a build id.
// `userId` is populated down to just its `name` (never email/passwordHash)
// so a card can credit "by <name>" without leaking anything private; a
// guest-saved build simply has a null userId, shown as "Guest" client-side.
// Capped at a generous limit as a sanity guardrail, not an expected ceiling
// for this project's scale.
router.get("/leaderboard", async (req, res) => {
  try {
    const builds = await Build.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("userId", "name")
      .lean();
    res.json(builds);
  } catch (err) {
    console.error("[routes/builds] Failed to load leaderboard:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// GET /api/builds/:id - fetch one build (revisiting a saved result/career).
router.get("/:id", async (req, res) => {
  try {
    const build = await Build.findById(req.params.id).lean();
    if (!build) {
      return res.status(404).json({ error: "Build not found" });
    }
    res.json(build);
  } catch (err) {
    console.error("[routes/builds] Failed to fetch build:", err);
    res.status(404).json({ error: "Build not found" });
  }
});

// PATCH /api/builds/:id/career - attach a simulated career's result once
// it reaches retirement. A build can be saved without ever doing this.
router.patch("/:id/career", async (req, res) => {
  try {
    const build = await Build.findByIdAndUpdate(
      req.params.id,
      { career: { simulated: true, ...req.body } },
      { new: true, runValidators: true }
    );
    if (!build) {
      return res.status(404).json({ error: "Build not found" });
    }
    res.json(build);
  } catch (err) {
    console.error("[routes/builds] Failed to save career result:", err);
    res.status(500).json({ error: "Failed to save career result" });
  }
});

export default router;
