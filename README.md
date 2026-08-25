# TennisBuild

A tennis-themed "build a custom player" game: spin a wheel of real ATP
players, draft one attribute per round from the revealed player's stat
sheet, and get a scored, archetyped custom player at the end.

## Project structure

npm workspaces monorepo with three packages:

- `client/` — React + Vite frontend
- `server/` — Express API + MongoDB (via Mongoose)
- `packages/game-engine/` — framework-agnostic game logic (wheel resolution,
  scoring, archetypes), imported by both client and server as
  `@tennisbuild/game-engine`

## Getting started

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI
npm run seed            # populate MongoDB with placeholder player data
npm run dev              # runs client (http://localhost:5173) and server (http://localhost:5000) together
```

## Scripts (run from repo root)

- `npm run dev` — client + server, concurrently
- `npm run test` — game-engine unit tests (Vitest)
- `npm run lint` / `npm run format` — ESLint / Prettier across the whole repo
- `npm run seed` — reseed MongoDB with placeholder player data

See `.claude` plan docs (or ask) for the full product design and phased
roadmap — this repo currently reflects Phase 1 (project scaffolding) only.
