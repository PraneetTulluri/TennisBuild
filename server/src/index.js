import "./config/env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectToDatabase } from "./db/connect.js";
import { attachUser } from "./middleware/attachUser.js";
import apiRouter from "./routes/index.js";

const PORT = process.env.PORT || 5000;

async function main() {
  await connectToDatabase();

  const app = express();
  // Same-origin in dev thanks to Vite's /api proxy, so plain cors() is
  // fine - if this API is ever served from a different origin than the
  // client, this would need { origin: "<client origin>", credentials: true }
  // for the auth cookie to still be sent cross-origin.
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(attachUser);
  app.use("/api", apiRouter);

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
