import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
