import "./config/env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectToDatabase } from "./db/connect.js";
import { attachUser } from "./middleware/attachUser.js";
import apiRouter from "./routes/index.js";
import { buildShareMeta, injectShareMeta } from "./utils/renderShareMeta.js";

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
    const indexHtmlPath = path.join(clientDist, "index.html");
    app.use(express.static(clientDist));

    // /builds/:id specifically gets its own server-rendered title/
    // description/image (see utils/renderShareMeta.js) before the SPA
    // shell reaches a link-preview crawler, so a shared build link shows
    // that build's own name/stats in Discord/Twitter/iMessage/etc.
    // instead of the generic site preview. Registered ahead of the
    // catch-all below (which would otherwise serve the un-customized
    // shell here too). A real browser gets the exact same HTML either
    // way and hydrates normally - this only changes what a crawler that
    // never runs the JS sees.
    app.get("/builds/:id", async (req, res, next) => {
      try {
        const origin = `${req.protocol}://${req.get("host")}`;
        const meta = await buildShareMeta(req.params.id, origin);
        if (!meta) return next(); // unknown id - just serve the normal shell
        const html = fs.readFileSync(indexHtmlPath, "utf8");
        res.send(injectShareMeta(html, meta));
      } catch (err) {
        console.error("[server] Failed to render share preview:", err);
        next(); // fail open - the normal SPA shell still works fine
      }
    });

    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(indexHtmlPath);
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
