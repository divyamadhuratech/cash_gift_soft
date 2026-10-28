import { saveBuffer, removeKey, driverName } from "./storage/index.js";

const folderFor = (req) => {
  const requested = String(req.body?.folder ?? "misc").replace(/[^a-z0-9_-]/gi, "").slice(0, 24);
  return requested || "misc";
};

export const uploadOne = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image provided. Send multipart/form-data with an `image` field." });
    }
    const asset = await saveBuffer({
      buffer: req.file.buffer,
      mime: req.file.mimetype,
      folder: folderFor(req),
    });
    return res.status(201).json({ message: "Image uploaded", asset });
  } catch (error) {
    const status = error?.status ?? 500;
    console.error("uploadOne error:", error);
    return res.status(status).json({ message: error?.message ?? "Upload failed" });
  }
};

export const uploadMany = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ message: "No images provided" });
    const assets = await Promise.all(files.map((file) => saveBuffer({ buffer: file.buffer, mime: file.mimetype, folder: folderFor(req) })));
    return res.status(201).json({ message: "Images uploaded", assets });
  } catch (error) {
    const status = error?.status ?? 500;
    console.error("uploadMany error:", error);
    return res.status(status).json({ message: error?.message ?? "Upload failed" });
  }
};

export const deleteUpload = async (req, res) => {
  try {
    const removed = await removeKey(req.params.key);
    if (!removed) return res.status(404).json({ message: "Asset not found" });
    return res.json({ message: "Asset deleted" });
  } catch (error) {
    console.error("deleteUpload error:", error);
    return res.status(500).json({ message: "Failed to delete asset", error: error.message });
  }
};

export const storageInfo = async (_req, res) =>
  res.json({ message: "Storage info", driver: driverName });

export default { uploadOne, uploadMany, deleteUpload, storageInfo };