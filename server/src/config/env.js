// Loads the repo-root .env file regardless of the process's current working
// directory. This matters because `npm run seed -w server` (and similar
// workspace-scoped scripts) run with cwd set to server/, so plain
// `import "dotenv/config"` would look for server/.env and silently miss the
// real .env sitting at the repo root. Importing *this* module first (instead
// of "dotenv/config" directly) fixes that by resolving the path relative to
// this file's own location rather than the process cwd.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, "../../../.env");

dotenv.config({ path: rootEnvPath });
