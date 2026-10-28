import GiftEntry from "../models/Entry.js";
import CeremonyFunction from "../models/Function.js";
import { currentTime, todayISO } from "../utils/time.js";
import { findOpenCollection, nextReceiptNumber, openLockMessage, refreshTotals } from "./functionService.js";

const fail = (res, status, message) => res.status(status).json({ message });

const syncTotals = (functionId, owner) => refreshTotals(functionId, owner);

/**
 * Keeps only keys the client actually sent. The zod update schema is already
 * default-free, but a stray `undefined` would still be written by `$set`.
 */
const onlyProvided = (validated, raw) => {
  if (!raw || typeof raw !== "object") return validated;
  return Object.fromEntries(Object.entries(validated).filter(([key]) => raw[key] !== undefined));
};

export const listEntries = async (req, res) => {
  try {
    const filter = { owner: req.user._id };
    if (req.query.function) filter.function = req.query.function;
    if (req.query.mode) filter.mode = req.query.mode;

    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const [entries, total] = await Promise.all([
      GiftEntry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      GiftEntry.countDocuments(filter),
    ]);

    return res.json({ message: "Entries loaded", entries, total });
  } catch (error) {
    console.error("listEntries error:", error);
    return res.status(500).json({ message: "Failed to load entries", error: error.message });
  }
};

export const getEntry = async (req, res) => {
  try {
    const entry = await GiftEntry.findOne({ _id: req.params.id, owner: req.user._id }).lean();
    if (!entry) return fail(res, 404, "Entry not found");
    return res.json({ message: "Entry loaded", entry });
  } catch (error) {
    console.error("getEntry error:", error);
    return res.status(500).json({ message: "Failed to load entry", error: error.message });
  }
};

export const createEntry = async (req, res) => {
  try {
    const body = req.validated ?? req.body;
    const functionId = body.function || null;

    /**
     * The collection lock, enforced where it cannot be bypassed: a gift may
     * only be recorded against a function that is open, and only one function
     * per owner may be open at a time. The first gift also starts the session,
     * so collecting never requires an extra "start" click.
     */
    if (functionId) {
      if (!/^[a-f\d]{24}$/i.test(functionId)) return fail(res, 400, "That function has not finished saving yet.");
      const target = await CeremonyFunction.findOne({ _id: functionId, owner: req.user._id });
      if (!target) return fail(res, 400, "That function no longer exists.");
      if (target.archived) return fail(res, 400, "That collection is closed. Reopen it before recording gifts.");
      if (!target.collectionOpenAt) {
        const conflict = await findOpenCollection(req.user._id, target._id);
        if (conflict) return fail(res, 409, openLockMessage(conflict));
        target.collectionOpenAt = new Date();
        await target.save();
      }
    }

    const receipt = body.receipt || (functionId ? await nextReceiptNumber(functionId, req.user._id) : `R-${Date.now().toString(36).toUpperCase()}`);

    const created = await GiftEntry.create({
      ...body,
      receipt,
      time: body.time || currentTime(),
      date: body.date || todayISO(),
      function: functionId,
      owner: req.user._id,
      workspace: req.user.workspace ?? null,
    });

    if (functionId) await syncTotals(functionId, req.user._id);
    return res.status(201).json({ message: "Entry created", entry: created.toObject({ flattenMaps: true }) });
  } catch (error) {
    if (error?.code === 11000) return fail(res, 409, "Receipt number already used");
    console.error("createEntry error:", error);
    return res.status(500).json({ message: "Failed to create entry", error: error.message });
  }
};

export const updateEntry = async (req, res) => {
  try {
    const body = onlyProvided(req.validated ?? req.body, req.body);
    const existing = await GiftEntry.findOne({ _id: req.params.id, owner: req.user._id });
    if (!existing) return fail(res, 404, "Entry not found");

    const updated = await GiftEntry.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $set: body },
      { new: true, runValidators: true },
    );

    if (existing.function) await syncTotals(existing.function, req.user._id);
    if (updated.function && String(updated.function) !== String(existing.function)) {
      await syncTotals(updated.function, req.user._id);
    }
    return res.json({ message: "Entry updated", entry: updated.toObject({ flattenMaps: true }) });
  } catch (error) {
    if (error?.code === 11000) return fail(res, 409, "Receipt number already used");
    console.error("updateEntry error:", error);
    return res.status(500).json({ message: "Failed to update entry", error: error.message });
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const removed = await GiftEntry.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!removed) return fail(res, 404, "Entry not found");
    if (removed.function) await syncTotals(removed.function, req.user._id);
    return res.json({ message: "Entry deleted" });
  } catch (error) {
    console.error("deleteEntry error:", error);
    return res.status(500).json({ message: "Failed to delete entry", error: error.message });
  }
};

/** Purges live entries for an archived function while keeping the function record + report. */
export const purgeFunctionEntries = async (req, res) => {
  try {
    const functionId = req.params.id;
    const record = await CeremonyFunction.findOne({ _id: functionId, owner: req.user._id });
    if (!record) return fail(res, 404, "Function not found");
    if (!record.archived) return fail(res, 400, "Close the collection before clearing entries");

    const snapshot = await GiftEntry.find({ function: functionId, owner: req.user._id }).lean();
    record.entryCount = snapshot.length;
    record.collectedTotal = snapshot.reduce((sum, entry) => sum + entry.amount, 0);
    await record.save();
    await GiftEntry.deleteMany({ function: functionId, owner: req.user._id });

    return res.json({
      message: "Entries cleared",
      cleared: snapshot.length,
      total: record.collectedTotal,
      entries: snapshot,
      function: record.toObject({ flattenMaps: true }),
    });
  } catch (error) {
    console.error("purgeFunctionEntries error:", error);
    return res.status(500).json({ message: "Failed to clear entries", error: error.message });
  }
};

export default { listEntries, getEntry, createEntry, updateEntry, deleteEntry, purgeFunctionEntries };