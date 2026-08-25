import { Router } from "express";
import { Player } from "../models/Player.js";

const router = Router();

// GET /api/players - returns the full reference pool of real players the
// wheel can draw from. No pagination/filtering yet (MVP pool is only
// ~40-60 players, Phase 2's job to seed); add query params here later if
// the pool grows or game modes need filtering (e.g. ?tier=legend).
router.get("/", async (req, res) => {
  try {
    const players = await Player.find().lean();
    res.json(players);
  } catch (err) {
    console.error("[routes/players] Failed to fetch players:", err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

export default router;
