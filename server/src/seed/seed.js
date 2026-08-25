// Run with `npm run seed -w server` (or `npm run seed` from the root).
// Connects to MongoDB, wipes the Player collection, and inserts the
// placeholder dataset from players.data.js. Safe to re-run any time during
// development - it always leaves the collection in the same known state.
import "../config/env.js";
import mongoose from "mongoose";
import { connectToDatabase } from "../db/connect.js";
import { Player } from "../models/Player.js";
import { playersSeedData } from "./players.data.js";

async function run() {
  await connectToDatabase();

  const deleted = await Player.deleteMany({});
  console.log(`[seed] Cleared ${deleted.deletedCount} existing player(s)`);

  const inserted = await Player.insertMany(playersSeedData);
  console.log(`[seed] Inserted ${inserted.length} player(s)`);

  await mongoose.disconnect();
  console.log("[seed] Done.");
}

run().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
