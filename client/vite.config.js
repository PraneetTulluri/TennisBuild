import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/..." resolves to client/src/... - matches the import paths used
    // by animate-ui's components (see client/src/components/animate-ui/),
    // so their source can be dropped in with unmodified import paths.
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Forwards any client-side fetch("/api/...") call to the Express
    // server during development, so the browser only ever talks to one
    // origin (the Vite dev server) and we never have to deal with CORS
    // in dev. In production, client and server would sit behind a real
    // reverse proxy doing the same job.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
