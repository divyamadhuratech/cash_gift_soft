import multer from "multer";
import env from "../config/env.js";
import { isAllowedMime } from "../services/storage/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(env.UPLOAD_MAX_BYTES), files: 6 },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedMime(file.mimetype)) {
      const error = new Error(`Unsupported image type: ${file.mimetype}`);
      error.status = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});

export const uploadImage = upload.single("image");
export const uploadImages = upload.array("images", 6);
export default upload;