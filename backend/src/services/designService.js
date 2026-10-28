import ReceiptDesign from "../models/ReceiptDesign.js";

const fail = (res, status, message) => res.status(status).json({ message });

const withOrder = (elements = []) => elements.map((element, index) => ({ ...element, order: index }));

export const listDesigns = async (req, res) => {
  try {
    const filter = { owner: req.user._id };
    if (req.query.function) filter.function = req.query.function;
    if (req.query.template) filter.template = req.query.template;

    const designs = await ReceiptDesign.find(filter).sort({ isDefault: -1, updatedAt: -1 }).lean();
    return res.json({ message: "Designs loaded", designs });
  } catch (error) {
    console.error("listDesigns error:", error);
    return res.status(500).json({ message: "Failed to load designs", error: error.message });
  }
};

export const getDesign = async (req, res) => {
  try {
    const design = await ReceiptDesign.findOne({ _id: req.params.id, owner: req.user._id }).lean();
    if (!design) return fail(res, 404, "Design not found");
    return res.json({ message: "Design loaded", design });
  } catch (error) {
    console.error("getDesign error:", error);
    return res.status(500).json({ message: "Failed to load design", error: error.message });
  }
};

const clearOtherDefaults = async (functionId, owner, keepId) =>
  ReceiptDesign.updateMany(
    { owner, function: functionId ?? null, _id: { $ne: keepId } },
    { isDefault: false },
  );

export const createDesign = async (req, res) => {
  try {
    const body = req.validated ?? req.body;
    const created = await ReceiptDesign.create({
      ...body,
      elements: withOrder(body.elements),
      function: body.function ?? null,
      owner: req.user._id,
      workspace: req.user.workspace ?? null,
    });
    if (created.isDefault) await clearOtherDefaults(created.function, req.user._id, created._id);
    return res.status(201).json({ message: "Design created", design: created.toObject({ flattenMaps: true }) });
  } catch (error) {
    console.error("createDesign error:", error);
    return res.status(500).json({ message: "Failed to create design", error: error.message });
  }
};

export const updateDesign = async (req, res) => {
  try {
    const body = req.validated ?? req.body;
    const update = { ...body };
    if (update.elements) update.elements = withOrder(update.elements);

    const updated = await ReceiptDesign.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!updated) return fail(res, 404, "Design not found");
    if (updated.isDefault) await clearOtherDefaults(updated.function, req.user._id, updated._id);
    return res.json({ message: "Design updated", design: updated.toObject({ flattenMaps: true }) });
  } catch (error) {
    console.error("updateDesign error:", error);
    return res.status(500).json({ message: "Failed to update design", error: error.message });
  }
};

export const deleteDesign = async (req, res) => {
  try {
    const removed = await ReceiptDesign.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!removed) return fail(res, 404, "Design not found");
    return res.json({ message: "Design deleted" });
  } catch (error) {
    console.error("deleteDesign error:", error);
    return res.status(500).json({ message: "Failed to delete design", error: error.message });
  }
};

export const setDefaultDesign = async (req, res) => {
  try {
    const design = await ReceiptDesign.findOne({ _id: req.params.id, owner: req.user._id });
    if (!design) return fail(res, 404, "Design not found");
    design.isDefault = true;
    await design.save();
    await clearOtherDefaults(design.function, req.user._id, design._id);
    return res.json({ message: "Default design set", design: design.toObject({ flattenMaps: true }) });
  } catch (error) {
    console.error("setDefaultDesign error:", error);
    return res.status(500).json({ message: "Failed to set default design", error: error.message });
  }
};

/** Duplicates a saved design so users can branch without losing the original. */
export const duplicateDesign = async (req, res) => {
  try {
    const source = await ReceiptDesign.findOne({ _id: req.params.id, owner: req.user._id }).lean();
    if (!source) return fail(res, 404, "Design not found");
    const { _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
    const copy = await ReceiptDesign.create({ ...rest, name: `${rest.name} copy`.slice(0, 80), isDefault: false });
    return res.status(201).json({ message: "Design duplicated", design: copy.toObject({ flattenMaps: true }) });
  } catch (error) {
    console.error("duplicateDesign error:", error);
    return res.status(500).json({ message: "Failed to duplicate design", error: error.message });
  }
};

export default { listDesigns, getDesign, createDesign, updateDesign, deleteDesign, setDefaultDesign, duplicateDesign };