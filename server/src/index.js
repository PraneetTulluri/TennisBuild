import "./config/env.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectToDatabase } from "./db/connect.js";
import { attachUser } from "./middleware/attachUser.js";
import apiRouter from "./routes/index.js";

const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // In production this same process also serves the built client (see
  // root package.json's "build" script, which runs `vite build` into
  // client/dist) - one deployed service, one origin, so the auth cookie
  // just works with no CORS/cross-site cookie configuration needed. The
  // catch-all excludes /api so a bad API route still 404s as JSON instead
  // of silently returning the SPA's index.html; everything else falls
  // through to index.html so React Router can handle client-side routes
  // like /draft or /builds/:id on a hard refresh.
  if (process.env.NODE_ENV === "production") {
    const clientDist = path.resolve(__dirname, "../../client/dist");
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
