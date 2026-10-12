import { z } from "zod";
import {
  FOLLOWUP_CHANNELS, FOLLOWUP_OUTCOMES, LEAD_SOURCES,
  LEAD_STATUS_KEYS, LEAD_TYPE_KEYS,
} from "../config/leads.js";
import { idParam, optionalText } from "./common.validator.js";

const mobile = z.string().trim().regex(/^[0-9+\- ]{10,20}$/, "Enter a valid mobile number");

const email = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(255)
  .optional()
  .or(z.literal(""))
  .transform((v) => v || null);

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.coerce.number().int().min(0).max(10000).nullable()
);

const optionalDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.date().nullable()
);

export const createLeadSchema = z.object({
  locationId: z.coerce.number().int().positive("Choose a location"),
  firstName: z.string().trim().min(2, "Enter the customer's first name").max(150),
  lastName: optionalText(150, "Last name"),
  mobile,
  email,
  leadType: z.enum(LEAD_TYPE_KEYS, { message: "Choose a lead type" }),
  source: z.enum(LEAD_SOURCES).default("phone"),
  eventDate: optionalDate,
  eventTimeSlot: optionalText(40, "Time slot"),
  guests: optionalNumber,
  kids: optionalNumber,
  requirements: optionalText(1000, "Requirements"),
  remarks: optionalText(1000, "Remarks"),
  companyName: optionalText(200, "Company name"),
  companyGstin: optionalText(20, "GSTIN"),
  assignedTo: z.coerce.number().int().positive().optional().nullable(),
});

/** The website form: no assignment, and the source is fixed. */
export const publicLeadSchema = createLeadSchema.omit({ assignedTo: true, source: true });

export const updateLeadSchema = createLeadSchema
  .partial()
  .omit({ assignedTo: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listLeadsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  status: z.preprocess((v) => v || undefined, z.enum(LEAD_STATUS_KEYS).optional()),
  leadType: z.preprocess((v) => v || undefined, z.enum(LEAD_TYPE_KEYS).optional()),
  locationId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  assignedTo: z.coerce.number().int().positive().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  sort: z.string().trim().optional(),
});

export const statusSchema = z.object({
  status: z.enum(LEAD_STATUS_KEYS, { message: "Choose a valid status" }),
  reason: optionalText(200, "Reason"),
});

export const assignSchema = z.object({
  assignedTo: z.coerce.number().int().positive("Choose a Sales POC"),
});

export const followupSchema = z.object({
  channel: z.enum(FOLLOWUP_CHANNELS, { message: "Choose how you contacted them" }),
  outcome: z.enum(FOLLOWUP_OUTCOMES, { message: "Choose the outcome" }),
  note: optionalText(1000, "Note"),
  nextAt: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.date().nullable()),
});

export const leadIdParam = idParam;