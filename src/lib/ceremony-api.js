import api from "./api";

/**
 * Flattens zod's `fieldErrors` into readable lines. The server replies with a
 * bare "Validation failed" otherwise, which told the user nothing about which
 * field was wrong.
 */
const validationMessage = (data, fallback) => {
  const errors = data?.errors;
  if (!errors || typeof errors !== "object") return data?.message || fallback;
  const parts = Object.entries(errors).flatMap(([field, messages]) =>
    (Array.isArray(messages) ? messages : [messages]).map((text) => `${field}: ${text}`),
  );
  return parts.length ? parts.join(" · ") : data?.message || fallback;
};

const message = (error, fallback) =>
  validationMessage(error?.response?.data, error?.message || fallback);

export const describeError = (error, fallback = "Request failed") => message(error, fallback);

/**
 * Every call here is optional: the app must keep working when the API is down,
 * so callers fall back to local state rather than blocking the UI.
 */
export const isApiAvailable = () => Boolean(tokenStoragePresent());

function tokenStoragePresent() {
  try {
    return Boolean(window.localStorage.getItem("muhurtham-auth-token"));
  } catch {
    return false;
  }
}

const unwrap = (response) => response.data;

export const functionsApi = {
  list: (params = {}) => api.get("/functions", { params }).then(unwrap),
  create: (body) => api.post("/functions", body).then(unwrap),
  update: (id, body) => api.patch(`/functions/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`/functions/${id}`).then(unwrap),
  /** Claims the one open collection slot. 409 while another function holds it. */
  open: (id) => api.post(`/functions/${id}/open`).then(unwrap),
  close: (id) => api.post(`/functions/${id}/close`).then(unwrap),
  reopen: (id) => api.post(`/functions/${id}/reopen`).then(unwrap),
  recompute: (id) => api.post(`/functions/${id}/recompute`).then(unwrap),
  clearEntries: (id) => api.post(`/functions/${id}/clear-entries`).then(unwrap),
};

export const entriesApi = {
  list: (params = {}) => api.get("/entries", { params }).then(unwrap),
  create: (body) => api.post("/entries", body).then(unwrap),
  update: (id, body) => api.patch(`/entries/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`/entries/${id}`).then(unwrap),
};

export const designsApi = {
  list: (params = {}) => api.get("/designs", { params }).then(unwrap),
  create: (body) => api.post("/designs", body).then(unwrap),
  update: (id, body) => api.patch(`/designs/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`/designs/${id}`).then(unwrap),
  makeDefault: (id) => api.post(`/designs/${id}/default`).then(unwrap),
  duplicate: (id) => api.post(`/designs/${id}/duplicate`).then(unwrap),
};

export const whatsappApi = {
  /** Returns { ready, hasQr, qrDataUrl } */
  status: () => api.get("/whatsapp/status").then(unwrap),
  /** Send a text receipt via WhatsApp. phone must be digits only (no + or spaces). */
  sendReceipt: (phone, message) =>
    api.post("/whatsapp/send-receipt", { phone, message }).then(unwrap),
};

export const uploadsApi = {
  info: () => api.get("/uploads/info").then(unwrap),
  upload: (file, folder = "misc") => {
    const form = new FormData();
    form.append("image", file);
    form.append("folder", folder);
    return api
      .post("/uploads", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 45000 })
      .then((response) => response.data.asset);
  },
  remove: (key) => api.delete(`/uploads/${key}`).then(unwrap),
};

/** Relative asset URLs from the backend need the API origin prepended. */
export const resolveAssetUrl = (url) => {
  if (!url) return "";
  if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) return url;
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3005/api").replace(/\/api\/?$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default { functionsApi, entriesApi, designsApi, whatsappApi, uploadsApi, describeError, resolveAssetUrl };