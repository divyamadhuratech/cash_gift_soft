import mongoose from "mongoose";
import env from "../config/env.js";
import GiftEntry from "../models/Entry.js";

let cached = null;

/**
 * One-off index migration.
 *
 * `Entry.receipt` used to carry a *global* unique index, which makes the second
 * function in the whole database unable to record a gift because every function
 * starts at R-0101. Uniqueness now lives on { owner, function, receipt }.
 * Mongo will not convert the old index on its own, so it is dropped explicitly.
 */
async function migrateEntryIndexes() {
  const existing = await GiftEntry.collection.indexes();
  const stale = existing.find((ix) => ix.name === "receipt_1");
  if (!stale || !stale.unique) return false;
  await GiftEntry.collection.dropIndex("receipt_1");
  await GiftEntry.syncIndexes();
  console.log("Migrated Entry indexes: receipt uniqueness is now per (owner, function)");
  return true;
}

export async function connectDB() {
  if (cached) return cached;
  try {
    cached = await mongoose.connect(env.MONGO_URI);
    console.log(`MongoDB connected (${mongoose.connection.host})`);
    await migrateEntryIndexes();
    return cached;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

export function disconnectDB() {
  if (cached) return mongoose.disconnect();
}

export default mongoose;