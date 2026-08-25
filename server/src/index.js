import "./config/env.js";
import express from "express";
import cors from "cors";
import { connectToDatabase } from "./db/connect.js";
import apiRouter from "./routes/index.js";

const PORT = process.env.PORT || 5000;

async function main() {
  await connectToDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", apiRouter);

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
