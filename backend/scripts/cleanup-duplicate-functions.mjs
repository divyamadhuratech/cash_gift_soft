import mongoose from "mongoose";
import env from "../src/config/env.js";
import CeremonyFunction from "../src/models/Function.js";
import { migrateFunctionDuplicates } from "../src/config/database.js";

/**
 * Standalone runner for the Function-dedup migration (same one that runs
 * automatically on backend startup).
 *
 *   node scripts/cleanup-duplicate-functions.mjs
 *
 * Collapses duplicate functions (same owner + name + date), re-points their
 * entries and receipt designs to the surviving record, rebuilds the counters
 * and installs the partial unique index that makes duplicates impossible.
 * Safe to run any number of times; it does nothing when there are no dups.
 */

await mongoose.connect(env.MONGO_URI);
console.log(`Connected (${mongoose.connection.host})`);

const before = await CeremonyFunction.aggregate([
  { $match: { name: { $gt: "" } } },
  { $group: { _id: { owner: "$owner", name: "$name", date: "$date", archived: "$archived" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
]);
console.log(`Duplicate groups found: ${before.length}`);
for (const group of before) {
  console.log(`  - "${group._id.name}" on ${group._id.date || "(no date)"} × ${group.count} (${group._id.archived ? "archived" : "active"})`);
}

const removed = await migrateFunctionDuplicates();
console.log(removed > 0 ? `Removed ${removed} duplicate record(s).` : "No duplicates to remove.");

const total = await CeremonyFunction.countDocuments({});
console.log(`Functions remaining: ${total}`);
await mongoose.disconnect();
