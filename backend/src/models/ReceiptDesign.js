import mongoose from "mongoose";

const elementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ["text", "divider", "image", "spacer"], default: "text" },
    english: { type: String, default: "" },
    tamil: { type: String, default: "" },
    visible: { type: Boolean, default: true },
    textColor: { type: String, default: "" },
    /** Per-layer overrides of the design-wide alignment and weight. */
    align: { type: String, enum: ["", "left", "center", "right", "justify"], default: "" },
    weight: { type: String, enum: ["", "bold", "normal"], default: "" },
    letterSpacing: { type: Number, default: 0, min: -2, max: 12 },
    /** Space above the layer, in pixels. */
    spacing: { type: Number, default: 0, min: -24, max: 96 },
    /** Spacer height, in pixels. */
    height: { type: Number, default: 16, min: 0, max: 160 },
    /** Divider-only extras. */
    variant: { type: String, enum: ["line", "ornamental"], default: "line" },
    borderStyle: { type: String, default: "" },
    borderColor: { type: String, default: "" },
    borderWidth: { type: Number, default: 1, min: 0, max: 12 },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const receiptDesignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    template: {
      type: String,
      enum: ["Classic", "Modern", "Traditional", "Minimal", "Temple", "Floral", "Ledger", "Executive"],
      default: "Classic",
    },
    theme: {
      type: String,
      enum: ["Classic", "Modern", "Traditional"],
      default: "Classic",
    },
    paper: { type: String, enum: ["A6", "80mm thermal", "58mm thermal"], default: "A6" },
    elements: { type: [elementSchema], default: [] },
    fontSize: { type: Number, default: 16, min: 8, max: 32 },
    lineHeight: { type: Number, default: 1.5, min: 0.8, max: 3 },
    padding: { type: Number, default: 20, min: 0, max: 80 },
    alignment: {
      type: String,
      enum: ["left", "center", "right", "justify"],
      default: "center",
    },
    language: { type: String, enum: ["English", "Tamil", "Both"], default: "Both" },
    border: {
      type: String,
      enum: [
        "none",
        "solid",
        "double",
        "dashed",
        "dotted",
        "thick",
        "groove",
        "ridge",
        "inset",
        "outset",
        "decorative",
      ],
      default: "double",
    },
    /** Overrides the accent colour for the receipt frame only. */
    borderColor: { type: String, default: "" },
    borderWidth: { type: Number, default: 2, min: 0, max: 12 },
    accent: { type: String, default: "#b28e3e" },
    logoUrl: { type: String, default: "" },
    logoPosition: { type: String, enum: ["Left", "Center", "Right"], default: "Center" },
    backgroundUrl: { type: String, default: "" },
    watermarkUrl: { type: String, default: "" },
    entriesPageDesign: { type: String, default: "Clean table" },
    /**
     * The printed entries list handed to the host family. Kept in its own
     * object so entries layout and receipt layout never mix.
     */
    entriesDesign: {
      sheet: { type: String, default: "Plain A4" },
      tableStyle: { type: String, default: "Clean table" },
      rowHeight: { type: String, default: "Standard" },
      columns: { type: [String], default: ["serial", "name", "relation", "mode", "amount", "receipt"] },
      showSerial: { type: Boolean, default: true },
      showTotals: { type: Boolean, default: true },
      showSummary: { type: Boolean, default: true },
      showHeading: { type: Boolean, default: true },
      centreOnPage: { type: Boolean, default: true },
      backgroundUrl: { type: String, default: "" },
      logoUrl: { type: String, default: "" },
      logoPosition: { type: String, enum: ["Left", "Center", "Right"], default: "Center" },
      borderStyle: { type: String, default: "solid" },
      borderColor: { type: String, default: "#c9a24b" },
      borderWidth: { type: Number, default: 2, min: 0, max: 10 },
      headingFontSize: { type: Number, default: 22, min: 10, max: 48 },
      bodyFontSize: { type: Number, default: 11, min: 7, max: 20 },
    },
    isDefault: { type: Boolean, default: false },

    function: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Function",
      default: null,
      index: true,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
  },
  { timestamps: true },
);

receiptDesignSchema.index({ owner: 1, function: 1, name: 1 });

const ReceiptDesign = mongoose.model("ReceiptDesign", receiptDesignSchema);
export default ReceiptDesign;