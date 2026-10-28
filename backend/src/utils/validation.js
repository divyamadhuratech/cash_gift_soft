import { z } from "zod";

/**
 * Parses req.body against `schema`. On success the parsed (and defaulted) value
 * is exposed as `req.validated` so handlers never read the raw body.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    // Logged because the client only receives "Validation failed" and there is
    // no other way to tell which field the wizard sent wrongly.
    console.warn("[validation]", req.method, req.originalUrl, JSON.stringify(fields));
    return res.status(400).json({
      message: "Validation failed",
      errors: fields,
    });
  }
  req.validated = result.data;
  return next();
};

export const registerSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().max(100).optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

/** The `credential` JWT Google Identity Services returns to the browser. */
export const googleLoginSchema = z.object({
  credential: z.string().min(20, "That Google sign-in response was not valid").max(8192),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const entryFieldSchema = z.object({
  // Camel case is legitimate and in use: `giftType` is a real Entry field and
  // lives in builtinEntryKeys on the client. Lower-casing here would have
  // silently broken the field key.
  key: z.string().min(1).max(48).regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Use letters, digits and _"),
  label: z.string().min(1).max(60),
  tamil: z.string().max(80).optional().default(""),
  type: z.enum(["text", "longtext", "number", "date", "select"]).optional().default("text"),
  options: z.array(z.string().max(60)).max(30).optional().default([]),
  required: z.boolean().optional().default(false),
  removable: z.boolean().optional().default(true),
  builtin: z.boolean().optional().default(false),
});

export const functionStatus = z.enum(["Active", "Upcoming", "Completed"]);

/**
 * Raw shapes carry no `.default()`.
 *
 * zod 4 keeps defaults through `.partial()`, so building an update schema from
 * a defaulted shape meant every PATCH silently rewrote the fields it did not
 * mention — editing an entry's amount was resetting its payment mode, city,
 * giftType, custom values and payment details. Create schemas add the defaults;
 * update schemas never do.
 */
const makePartial = (shape) => Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, value.optional()]));

const functionShape = {
  name: z.string().min(1, "Function name is required").max(120),
  tamil: z.string().max(120).optional(),
  type: z.enum(["Wedding", "Engagement", "Birthday", "Housewarming", "Temple", "Anniversary", "Custom"]).optional(),
  category: z.enum(["Family celebration", "Religious function", "Community event", "Other"]).optional(),
  venue: z.string().max(200).optional(),
  date: isoDate.optional(),
  organizer: z.string().max(120).optional(),
  targetCollection: z.number().min(0).optional(),
  language: z.enum(["English", "Tamil", "Both"]).optional(),
  status: functionStatus.optional(),
  entryFields: z.array(entryFieldSchema).max(20).optional(),
  inviteeGroups: z.array(z.string().max(60)).max(30).optional(),
};

export const createFunctionSchema = z.object({
  ...functionShape,
  tamil: functionShape.tamil.default(""),
  type: functionShape.type.default("Custom"),
  category: functionShape.category.default("Family celebration"),
  venue: functionShape.venue.default(""),
  date: functionShape.date.default(""),
  organizer: functionShape.organizer.default(""),
  targetCollection: functionShape.targetCollection.default(0),
  language: functionShape.language.default("Both"),
  entryFields: functionShape.entryFields.default([]),
  inviteeGroups: functionShape.inviteeGroups.default([]),
});

export const updateFunctionSchema = z.object(makePartial(functionShape));

const entryShape = {
  name: z.string().min(1, "Guest name is required").max(120),
  amount: z.number().min(0).max(10000000),
  mode: z.enum(["Cash", "UPI", "Card", "Other"]).optional(),
  city: z.string().max(120).optional(),
  relation: z.string().max(120).optional(),
  giftType: z.string().max(120).optional(),
  time: z.string().max(20).optional(),
  date: isoDate.optional(),
  receipt: z.string().min(1).max(40).optional(),
  message: z.string().max(500).optional(),
  function: z.string().nullable().optional(),
  custom: z.record(z.string(), z.string().max(500)).optional(),
  /** Manual UPI / card / other references captured on the collection form. */
  paymentDetails: z.record(z.string(), z.string().max(200)).optional(),
};

export const createEntrySchema = z.object({
  ...entryShape,
  mode: entryShape.mode.default("Cash"),
  city: entryShape.city.default(""),
  relation: entryShape.relation.default(""),
  giftType: entryShape.giftType.default(""),
  time: entryShape.time.default(""),
  date: entryShape.date.default(""),
  message: entryShape.message.default(""),
  custom: entryShape.custom.default({}),
  paymentDetails: entryShape.paymentDetails.default({}),
});

export const updateEntrySchema = z.object(makePartial(entryShape));

const elementSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
  kind: z.enum(["text", "divider", "image", "spacer"]).optional().default("text"),
  english: z.string().max(400).optional().default(""),
  tamil: z.string().max(400).optional().default(""),
  visible: z.boolean().optional().default(true),
  textColor: z.string().max(24).optional().default(""),
  /** Per-layer overrides of the design-wide alignment and weight. */
  align: z.enum(["", "left", "center", "right", "justify"]).optional().default(""),
  weight: z.enum(["", "bold", "normal"]).optional().default(""),
  letterSpacing: z.number().min(-2).max(12).optional().default(0),
  spacing: z.number().min(-24).max(96).optional().default(0),
  height: z.number().min(0).max(160).optional().default(16),
  variant: z.enum(["line", "ornamental"]).optional().default("line"),
  borderStyle: z.string().max(24).optional().default(""),
  borderColor: z.string().max(24).optional().default(""),
  borderWidth: z.number().min(0).max(12).optional().default(1),
  order: z.number().optional().default(0),
});

export const designElementList = z.array(elementSchema).max(40);

const borderStyle = z.enum([
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
]);

/**
 * The printed entries list. Deliberately its own object so the entries layout
 * and the receipt layout never mix on the same record.
 */
const entriesDesignShape = {
  sheet: z.string().max(40).optional(),
  tableStyle: z.string().max(60).optional(),
  rowHeight: z.enum(["Compact", "Standard", "Roomy"]).optional(),
  columns: z.array(z.string().max(40)).max(20).optional(),
  showSerial: z.boolean().optional(),
  showTotals: z.boolean().optional(),
  showSummary: z.boolean().optional(),
  showHeading: z.boolean().optional(),
  centreOnPage: z.boolean().optional(),
  backgroundUrl: z.string().max(500).optional(),
  logoUrl: z.string().max(500).optional(),
  logoPosition: z.enum(["Left", "Center", "Right"]).optional(),
  borderStyle: borderStyle.optional(),
  borderColor: z.string().max(24).optional(),
  borderWidth: z.number().min(0).max(10).optional(),
  headingFontSize: z.number().min(10).max(48).optional(),
  bodyFontSize: z.number().min(7).max(20).optional(),
};

const entriesDesignDefaults = {
  sheet: "Plain A4",
  tableStyle: "Clean table",
  rowHeight: "Standard",
  showSerial: true,
  showTotals: true,
  showSummary: true,
  showHeading: true,
  centreOnPage: true,
  backgroundUrl: "",
  logoUrl: "",
  logoPosition: "Center",
  borderStyle: "solid",
  borderColor: "#c9a24b",
  borderWidth: 2,
  headingFontSize: 22,
  bodyFontSize: 11,
};

const entriesDesignSchema = z.object(entriesDesignShape);

const designShape = {
  name: z.string().min(1, "Design name is required").max(80),
  template: z.enum(["Classic", "Modern", "Traditional", "Minimal", "Temple", "Floral", "Ledger", "Executive"]).optional(),
  theme: z.enum(["Classic", "Modern", "Traditional"]).optional(),
  paper: z.enum(["A6", "80mm thermal", "58mm thermal"]).optional(),
  elements: designElementList.optional(),
  fontSize: z.number().min(8).max(32).optional(),
  lineHeight: z.number().min(0.8).max(3).optional(),
  padding: z.number().min(0).max(80).optional(),
  alignment: z.enum(["left", "center", "right", "justify"]).optional(),
  language: z.enum(["English", "Tamil", "Both"]).optional(),
  border: borderStyle.optional(),
  borderColor: z.string().max(24).optional(),
  borderWidth: z.number().min(0).max(12).optional(),
  accent: z.string().max(24).optional(),
  logoUrl: z.string().max(500).optional(),
  logoPosition: z.enum(["Left", "Center", "Right"]).optional(),
  backgroundUrl: z.string().max(500).optional(),
  watermarkUrl: z.string().max(500).optional(),
  entriesPageDesign: z.string().max(60).optional(),
  entriesDesign: entriesDesignSchema.optional(),
  isDefault: z.boolean().optional(),
  function: z.string().nullable().optional(),
};

const designDefaults = {
  template: "Classic",
  theme: "Classic",
  paper: "A6",
  elements: [],
  fontSize: 16,
  lineHeight: 1.5,
  padding: 20,
  alignment: "center",
  language: "Both",
  border: "double",
  borderColor: "",
  borderWidth: 2,
  accent: "#b28e3e",
  logoUrl: "",
  logoPosition: "Center",
  backgroundUrl: "",
  watermarkUrl: "",
  entriesPageDesign: "Clean table",
  isDefault: false,
};

export const createDesignSchema = z.object({
  ...designShape,
  ...Object.fromEntries(Object.entries(designDefaults).map(([key, value]) => [key, designShape[key].default(value)])),
  // Defaults for the nested entries layout are applied on create only.
  entriesDesign: entriesDesignSchema.partial().transform((value) => (value ? { ...entriesDesignDefaults, ...value } : undefined)).optional(),
});

export const updateDesignSchema = z.object(makePartial(designShape));