import mongoose from "mongoose";
import CeremonyFunction from "../models/Function.js";
import GiftEntry from "../models/Entry.js";

const withOrder = (fields = []) => fields.map((field, index) => ({ ...field, order: index }));

/** Status is derived from the scheduled date unless the caller set it explicitly. */
const deriveStatus = (date, explicit) => {
  if (explicit) return explicit;
  const today = new Date().toISOString().slice(0, 10);
  if (!date) return "Active";
  return date < today ? "Completed" : date === today ? "Active" : "Upcoming";
};

const fail = (res, status, message) => res.status(status).json({ message });

/**
 * The one collection that is currently open for this owner, excluding
 * `excludeId`. This is the lock: a workspace may only collect against one
 * function at a time, so a newly created (upcoming) function cannot be opened
 * while another one is still collecting.
 */
export const findOpenCollection = (owner, excludeId = null) => {
  const filter = { owner, archived: false, collectionOpenAt: { $ne: null } };
  if (excludeId) filter._id = { $ne: excludeId };
  return CeremonyFunction.findOne(filter).select("name").lean();
};

export const openLockMessage = (record) =>
  `Close "${record.name}" before opening another collection. Only one collection can be open at a time.`;

/**
 * The dedup key for functions: one owner may not hold two *active* functions
 * with the same name on the same date. The setup wizard used to be able to
 * fire this handler repeatedly (auto-save effect, double clicks) and every
 * call created a fresh record, so the calendar showed the same celebration
 * dozens of times. Mirrors the partial unique index built in database.js.
 */
const findDuplicateFunction = (owner, body) => {
  const filter = { owner, archived: false, name: String(body.name ?? "").trim() };
  if (body.date) filter.date = body.date;
  return CeremonyFunction.findOne(filter).lean();
};

const duplicatePayload = (record) => ({
  message: "Function already exists",
  function: record,
  duplicate: true,
});

export const listFunctions = async (req, res) => {
  try {
    const filter = { owner: req.user._id };
    if (req.query.workspace) filter.workspace = req.query.workspace;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.archived === "true") filter.archived = true;
    else if (req.query.archived === "false") filter.archived = false;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = req.query.from;
      if (req.query.to) filter.date.$lte = req.query.to;
    }

    const functions = await CeremonyFunction.find(filter).sort({ date: 1, createdAt: -1 }).lean();
    return res.json({ message: "Functions loaded", functions });
  } catch (error) {
    console.error("listFunctions error:", error);
    return res.status(500).json({ message: "Failed to load functions", error: error.message });
  }
};

export const getFunction = async (req, res) => {
  try {
    const record = await CeremonyFunction.findOne({ _id: req.params.id, owner: req.user._id }).lean();
    if (!record) return fail(res, 404, "Function not found");
    return res.json({ message: "Function loaded", function: record });
  } catch (error) {
    console.error("getFunction error:", error);
    return res.status(500).json({ message: "Failed to load function", error: error.message });
  }
};

export const createFunction = async (req, res) => {
  try {
    const body = req.validated ?? req.body;
    // Idempotent create: returning the existing record (200) lets a repeated
    // or racing save resolve to the same function instead of a duplicate row.
    const existing = await findDuplicateFunction(req.user._id, body);
    if (existing) return res.status(200).json(duplicatePayload(existing));

    const created = await CeremonyFunction.create({
      ...body,
      entryFields: withOrder(body.entryFields),
      status: deriveStatus(body.date, body.status),
      owner: req.user._id,
      workspace: req.user.workspace ?? null,
    });
    return res.status(201).json({ message: "Function created", function: created.toObject({ flattenMaps: true }) });
  } catch (error) {
    if (error?.code === 11000) {
      // Two concurrent creates passed the check above; the unique index caught
      // the loser. Answer with the winner so the caller still succeeds.
      try {
        const existing = await findDuplicateFunction(req.user._id, req.validated ?? req.body);
        if (existing) return res.status(200).json(duplicatePayload(existing));
      } catch (lookupError) {
        console.error("createFunction duplicate lookup error:", lookupError);
      }
      return fail(res, 409, "A function with this name and date already exists");
    }
    console.error("createFunction error:", error);
    return res.status(500).json({ message: "Failed to create function", error: error.message });
  }
};

export const updateFunction = async (req, res) => {
  try {
    const body = req.validated ?? req.body;
    const provided = Object.fromEntries(Object.entries(body).filter(([key]) => req.body?.[key] !== undefined));
    const update = { ...provided };
    if (update.entryFields) update.entryFields = withOrder(update.entryFields);
    if (update.date !== undefined) update.status = deriveStatus(update.date, update.status);

    const updated = await CeremonyFunction.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      update,
      { new: true, runValidators: true },
    );
    if (!updated) return fail(res, 404, "Function not found");
    return res.json({ message: "Function updated", function: updated.toObject({ flattenMaps: true }) });
  } catch (error) {
    if (error?.code === 11000) {
      return fail(res, 409, "Another function with this name and date already exists");
    }
    console.error("updateFunction error:", error);
    return res.status(500).json({ message: "Failed to update function", error: error.message });
  }
};

export const deleteFunction = async (req, res) => {
  try {
    const removed = await CeremonyFunction.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!removed) return fail(res, 404, "Function not found");
    await GiftEntry.deleteMany({ function: removed._id, owner: req.user._id });
    return res.json({ message: "Function deleted" });
  } catch (error) {
    console.error("deleteFunction error:", error);
    return res.status(500).json({ message: "Failed to delete function", error: error.message });
  }
};

export const refreshTotals = async (functionId, owner) => {
  if (!functionId) return { count: 0, total: 0 };
  const [result] = await GiftEntry.aggregate([
    { $match: { function: new mongoose.Types.ObjectId(String(functionId)), owner: new mongoose.Types.ObjectId(String(owner)) } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
  ]);
  await CeremonyFunction.updateOne(
    { _id: functionId, owner },
    { entryCount: result?.count ?? 0, collectedTotal: result?.total ?? 0 },
  );
  return { count: result?.count ?? 0, total: result?.total ?? 0 };
};

/**
 * Marks a function as the open collection session. Refused while another
 * function is already open, which is what stops a freshly scheduled function
 * from swapping into a collection that is in progress.
 */
export const openFunction = async (req, res) => {
  try {
    const record = await CeremonyFunction.findOne({ _id: req.params.id, owner: req.user._id });
    if (!record) return fail(res, 404, "Function not found");
    if (record.archived) return fail(res, 400, "That collection is closed. Reopen it from Completed before starting it again.");
    if (!record.collectionOpenAt) {
      const conflict = await findOpenCollection(req.user._id, record._id);
      if (conflict) return fail(res, 409, openLockMessage(conflict));
    }
    record.collectionOpenAt = record.collectionOpenAt ?? new Date();
    await record.save();
    return res.json({ message: "Collection opened", function: record.toObject({ flattenMaps: true }) });
  } catch (error) {
    console.error("openFunction error:", error);
    return res.status(500).json({ message: "Failed to open the collection", error: error.message });
  }
};

export const closeFunction = async (req, res) => {
  try {
    const record = await CeremonyFunction.findOne({ _id: req.params.id, owner: req.user._id });
    if (!record) return fail(res, 404, "Function not found");
    record.status = "Completed";
    record.archived = true;
    record.closedAt = new Date();
    // Releasing the lock is what allows the next function to be opened.
    record.collectionOpenAt = null;
    await record.save();
    return res.json({ message: "Collection closed", function: record.toObject({ flattenMaps: true }) });
  } catch (error) {
    console.error("closeFunction error:", error);
    return res.status(500).json({ message: "Failed to close function", error: error.message });
  }
};

export const reopenFunction = async (req, res) => {
  try {
    const record = await CeremonyFunction.findOne({ _id: req.params.id, owner: req.user._id });
    if (!record) return fail(res, 404, "Function not found");
    record.status = deriveStatus(record.date);
    record.archived = false;
    record.closedAt = null;
    // Reopening only restores it to the list; it does not start collecting,
    // so the lock stays free until someone opens this function again.
    record.collectionOpenAt = null;
    await record.save();
    return res.json({ message: "Function reopened", function: record.toObject({ flattenMaps: true }) });
  } catch (error) {
    console.error("reopenFunction error:", error);
    return res.status(500).json({ message: "Failed to reopen function", error: error.message });
  }
};

/**
 * Next receipt number for one function.
 *
 * Two bugs fixed here:
 *  - the previous version sorted `receipt` as a *string*, so "R-0999" sorted
 *    above "R-1000" and the sequence went backwards after 999;
 *  - it also fell back to 100 for any function with no entries, which is fine,
 *    but only because uniqueness was global. Uniqueness is now scoped to
 *    (owner, function), so per-function numbering is both correct and safe.
 */
export const nextReceiptNumber = async (functionId, owner) => {
  const match = { owner: new mongoose.Types.ObjectId(String(owner)) };
  if (functionId) match.function = new mongoose.Types.ObjectId(String(functionId));

  const [latest] = await GiftEntry.aggregate([
    { $match: match },
    // Strip the "R-" prefix and compare numerically rather than lexically.
    { $project: { seq: { $toInt: { $substrBytes: [{ $ifNull: ["$receipt", ""] }, 2, 12] } } } },
    { $match: { seq: { $type: "int", $ne: null } } },
    { $sort: { seq: -1 } },
    { $limit: 1 },
  ]);

  const next = (latest?.seq ?? 100) + 1;
  return `R-${String(next).padStart(4, "0")}`;
};

export const recomputeTotals = async (req, res) => {
  try {
    const totals = await refreshTotals(req.params.id, req.user._id);
    return res.json({ message: "Totals refreshed", ...totals });
  } catch (error) {
    console.error("recomputeTotals error:", error);
    return res.status(500).json({ message: "Failed to refresh totals", error: error.message });
  }
};

export default { listFunctions, getFunction, createFunction, updateFunction, deleteFunction, openFunction, closeFunction, reopenFunction, recomputeTotals };