import mongoose from "mongoose";

/**
 * Connects to MongoDB using the URI from the environment.
 *
 * This is called once at server startup (see src/index.js), before the
 * Express app starts listening for requests. If MONGODB_URI is missing or
 * the connection fails, we log a clear error and exit rather than letting
 * the server boot into a broken state where every DB-backed route would
 * fail with a confusing error later.
 */
export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and fill in a connection string."
    );
  }

  await mongoose.connect(uri);
  console.log("[db] Connected to MongoDB");
}
