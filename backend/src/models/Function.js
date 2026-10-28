import mongoose from "mongoose";

/**
 * A single configurable input on the collection form.
 * `key` is the stable storage key (also the custom-data key on Entry.custom).
 * Not lower-cased: `giftType` must survive round-tripping to match
 * Entry.giftType and the client's builtinEntryKeys set.
 * `order` is materialised on save so reads never have to sort client-side.
 */
const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    tamil: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["text", "longtext", "number", "date", "select"],
      default: "text",
    },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    removable: { type: Boolean, default: true },
    builtin: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const functionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tamil: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["Wedding", "Engagement", "Birthday", "Housewarming", "Temple", "Anniversary", "Custom"],
      default: "Custom",
    },
    category: {
      type: String,
      enum: ["Family celebration", "Religious function", "Community event", "Other"],
      default: "Family celebration",
    },
    venue: { type: String, trim: true, default: "" },
    /** ISO calendar day, YYYY-MM-DD. Kept as a string so the client can round-trip it verbatim. */
    date: { type: String, default: "", index: true },
    organizer: { type: String, trim: true, default: "" },
    targetCollection: { type: Number, default: 0 },
    language: { type: String, enum: ["English", "Tamil", "Both"], default: "Both" },

    /** Ordered, user-editable inputs shown on the collection form. */
    entryFields: { type: [fieldSchema], default: [] },
    /** Ordered guest-side groups (groom side / bride side / friends ...). */
    inviteeGroups: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["Active", "Upcoming", "Completed"],
      default: "Active",
      index: true,
    },
    archived: { type: Boolean, default: false, index: true },
    closedAt: { type: Date, default: null },
    /**
     * Set while this function is the open collection session. At most one
     * non-archived function per owner may have a value here — opening a second
     * one is refused until this is closed, so a newly scheduled function can
     * never take over a collection that is already in progress.
     */
    collectionOpenAt: { type: Date, default: null, index: true },
    /** Denormalised snapshot so list views never need an aggregation. */
    entryCount: { type: Number, default: 0 },
    collectedTotal: { type: Number, default: 0 },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
  },
  { timestamps: true },
);

functionSchema.index({ owner: 1, date: 1 });

const CeremonyFunction = mongoose.model("Function", functionSchema);
export default CeremonyFunction;