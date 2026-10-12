import { z } from "zod";
import { idParam, optionalText } from "./common.validator.js";

const item = z.object({
  description: z.string().trim().min(2, "Enter a description").max(255),
  qty: z.coerce.number().min(0.01, "Quantity must be more than zero").max(100000),
  rate: z.coerce.number().min(0, "Rate cannot be negative").max(10000000),
});

export const createQuotationSchema = z.object({
  items: z.array(item).min(1, "Add at least one item").max(50),
  discount: z.coerce.number().min(0).max(10000000).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(18),
  validUntil: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.date().nullable()),
  notes: optionalText(2000, "Notes"),
});

export const quotationStatusSchema = z.object({
  status: z.enum(["draft", "shared", "accepted", "rejected"], { message: "Choose a valid status" }),
});

export const quotationIdParam = idParam;
export const leadIdParam = z.object({ leadId: z.coerce.number().int().positive("Invalid lead") });