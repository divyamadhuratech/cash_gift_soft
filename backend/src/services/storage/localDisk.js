import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import env from "../../config/env.js";

const root = path.resolve(env.UPLOAD_DIR);
const publicPrefix = env.UPLOAD_PUBLIC_PATH;

const allowedMime = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

const extensionFor = (mime) => ({
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
}[mime] ?? "");

export const isAllowedMime = (mime) => allowedMime.has(mime);

/**
 * Disk driver. Works with zero external setup; swap STORAGE_DRIVER to an S3
 * implementation later without touching any route or service code.
 */
export async function saveBuffer({ buffer, mime, folder = "misc" }) {
  if (!isAllowedMime(mime)) {
    const error = new Error(`Unsupported image type: ${mime}`);
    error.status = 415;
    throw error;
  }
  if (buffer.length > Number(env.UPLOAD_MAX_BYTES)) {
    const error = new Error(`Image exceeds ${Math.round(Number(env.UPLOAD_MAX_BYTES) / 1024 / 1024)}MB limit`);
    error.status = 413;
    throw error;
  }

  const directory = path.join(root, folder);
  await fs.mkdir(directory, { recursive: true });

  const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}${extensionFor(mime)}`;
  await fs.writeFile(path.join(directory, name), buffer);

  return {
    key: `${folder}/${name}`,
    url: `${publicPrefix}/${folder}/${name}`,
    size: buffer.length,
    mime,
    driver: "local",
  };
}

export async function removeKey(key) {
  if (!key || key.includes("..")) return false;
  const target = path.join(root, key);
  if (!target.startsWith(root)) return false;
  await fs.rm(target, { force: true });
  return true;
}

export const storageRoot = root;