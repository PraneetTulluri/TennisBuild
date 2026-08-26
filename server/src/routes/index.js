import { Router } from "express";
import playersRouter from "./players.js";
import buildsRouter from "./builds.js";
import authRouter from "./auth.js";

const router = Router();

// Simple liveness check - useful during Phase 1 to verify the server is up
// and reachable before any database or frontend wiring is trusted.
router.get("/health", (req, res) => {
  res.json({ ok: true });
});

router.use("/players", playersRouter);
router.use("/builds", buildsRouter);
router.use("/auth", authRouter);

export default router;
