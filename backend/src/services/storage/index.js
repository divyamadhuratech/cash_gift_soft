import env from "../../config/env.js";
import * as localDisk from "./localDisk.js";

/**
 * Single indirection point for binary storage. To move to S3/Cloudinary, add a
 * module here exposing { isAllowedMime, saveBuffer, removeKey } and switch on
 * env.STORAGE_DRIVER. No route or service changes are required.
 */
const drivers = {
  local: localDisk,
};

export const driverName = env.STORAGE_DRIVER;
export const driver = drivers[driverName] ?? localDisk;

export const isAllowedMime = (mime) => driver.isAllowedMime(mime);
export const saveBuffer = (input) => driver.saveBuffer(input);
export const removeKey = (key) => driver.removeKey(key);
export const storageRoot = driver.storageRoot;