import { Router } from "express";
import { Build } from "../models/Build.js";

const router = Router();

// POST /api/builds - save a finished draft build. No auth yet, so the
// guestSessionId (a random id the client generates once and keeps in
// localStorage) is what scopes "my builds" - see client/src/utils/guestSession.js.
router.post("/", async (req, res) => {
  try {
    const { name, guestSessionId, locked, flavor } = req.body;
    if (!name || !guestSessionId || !locked) {
      return res
        .status(400)
        .json({ error: "name, guestSessionId, and locked are required" });
    }
    const build = await Build.create({ name, guestSessionId, locked, flavor });
    res.status(201).json(build);
  } catch (err) {
    console.error("[routes/builds] Failed to save build:", err);
    res.status(500).json({ error: "Failed to save build" });
  }
});

// GET /api/builds?sessionId=... - list the builds saved from one guest session, newest first.
router.get("/", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId query param is required" });
    }
    const builds = await Build.find({ guestSessionId: sessionId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(builds);
  } catch (err) {
    console.error("[routes/builds] Failed to list builds:", err);
    res.status(500).json({ error: "Failed to list builds" });
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
