import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: "" },
    relation: { type: String, trim: true, default: "" },
    giftType: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 0 },
    mode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Other"],
      default: "Cash",
    },
    time: { type: String, default: "" },
    date: { type: String, default: "" },
    /**
     * Sequence number within a single function. Uniqueness is enforced by the
     * compound index below rather than here: a global unique index meant the
     * second function ever created could never record its first gift, because
     * every function starts counting at R-0101.
     */
    receipt: { type: String, required: true, trim: true },
    /** Real relation to Function — the previous String held only the display name. */
    function: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Function",
      default: null,
      index: true,
    },
    /** Values for any custom fields added in Function setup. */
    custom: { type: Map, of: String, default: {} },
    /**
     * Manually entered details for non-cash gifts, e.g. { upiId, upiRef } for
     * UPI or { cardLast4, cardAuth } for Card. Free-form so new modes do not
     * need a migration.
     */
    paymentDetails: { type: Map, of: String, default: {} },
    message: { type: String, trim: true, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
  },
  { timestamps: true },
);

entrySchema.index({ owner: 1, function: 1, receipt: 1 }, { unique: true });
entrySchema.index({ owner: 1, function: 1, createdAt: -1 });

const GiftEntry = mongoose.model("Entry", entrySchema);
export default GiftEntry;