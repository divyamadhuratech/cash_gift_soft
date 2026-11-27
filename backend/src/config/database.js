import mongoose from "mongoose";
import env from "../config/env.js";
import GiftEntry from "../models/Entry.js";
import CeremonyFunction from "../models/Function.js";
import ReceiptDesign from "../models/ReceiptDesign.js";

let cached = null;
let functionMigrationDone = false;

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

/**
 * Function (ceremony/event) dedup migration.
 *
 * A bug in the setup wizard created the same function repeatedly (the same
 * "madhu&ramesh" row rendered dozens of times on the calendar), and the
 * database accepted every one because Function had no uniqueness rule at all.
 * This migration:
 *
 *  1. collapses duplicates — records sharing owner + name + date (compared
 *     within the same archived state), keeping the earliest created;
 *  2. re-points each duplicate's gift entries and receipt designs to the
 *     keeper, bumping a receipt number only when the keeper already has it,
 *     so nothing is lost and no unique index trips;
 *  3. rebuilds the denormalised entryCount / collectedTotal on the keeper;
 *  4. creates a partial unique index { owner, name, date } on non-archived
 *     documents, so duplicates are impossible at the storage layer even if a
 *     client misbehaves again. createFunction mirrors this rule.
 *
 * Runs once per process, is idempotent, and only touches actual duplicates.
 */
async function migrateFunctionDuplicates() {
  const duplicates = await CeremonyFunction.aggregate([
    { $match: { name: { $gt: "" } } },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: { owner: "$owner", name: "$name", date: "$date", archived: "$archived" },
        ids: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let removed = 0;
  const touchedKeepers = new Set();

  for (const duplicate of duplicates) {
    const [keeperId, ...staleIds] = duplicate.ids;
    touchedKeepers.add(String(keeperId));

    for (const staleId of staleIds) {
      // Entries move one by one so a receipt number the keeper already uses
      // (both sides could have started at R-0101) is suffixed, never lost.
      const keeperReceipts = new Set(
        (await GiftEntry.find({ function: keeperId }).select("receipt").lean()).map((entry) => entry.receipt),
      );
      const staleEntries = await GiftEntry.find({ function: staleId }).select("receipt").lean();
      for (const entry of staleEntries) {
        let receipt = entry.receipt;
        let suffix = 1;
        while (keeperReceipts.has(receipt)) receipt = `${entry.receipt}-${suffix++}`;
        keeperReceipts.add(receipt);
        await GiftEntry.updateOne({ _id: entry._id }, { $set: { function: keeperId, receipt } });
      }
      // Designs have no unique constraint, so they can move in one call.
      await ReceiptDesign.updateMany({ function: staleId }, { $set: { function: keeperId } });
    }

    const deletion = await CeremonyFunction.deleteMany({ _id: { $in: staleIds } });
    removed += deletion.deletedCount ?? 0;
  }

  for (const keeperId of touchedKeepers) {
    const [result] = await GiftEntry.aggregate([
      { $match: { function: new mongoose.Types.ObjectId(keeperId) } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]);
    await CeremonyFunction.updateOne(
      { _id: keeperId },
      { entryCount: result?.count ?? 0, collectedTotal: result?.total ?? 0 },
    );
  }

  // The index only becomes available once the duplicates are gone, which is
  // why it is created here instead of being declared on the schema (mongoose
  // auto-indexing would race the dedup on a dirty database).
  await CeremonyFunction.collection.createIndex(
    { owner: 1, name: 1, date: 1 },
    { unique: true, partialFilterExpression: { archived: false } },
  );

  if (removed > 0) console.log(`Migrated Functions: merged ${removed} duplicate record(s) into their originals`);
  return removed;
}

export { migrateFunctionDuplicates };

export async function connectDB() {
  if (cached) return cached;
  try {
    cached = await mongoose.connect(env.MONGO_URI);
    console.log(`MongoDB connected (${mongoose.connection.host})`);
    await migrateEntryIndexes();
    if (!functionMigrationDone) {
      await migrateFunctionDuplicates();
      functionMigrationDone = true;
    }
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