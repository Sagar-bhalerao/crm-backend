import { z } from "zod";

// Forms send "" for an empty field; store that as null, not an empty string
const emptyToNull = (schema) => z.preprocess((v) => (v === "" ? null : v), schema);

const optionalText = (max) => emptyToNull(z.string().trim().max(max).nullable().optional());

// 2-digit state code, PAN, entity number, Z, checksum
const gstin = emptyToNull(
  z.string().trim().toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN")
    .nullable()
    .optional()
);

export const PAYMENT_MODES = ["upi", "card", "bank_transfer", "cash", "cheque"];

export const invoiceIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const itemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required").max(500),
  qty: z.coerce.number().positive("Quantity must be more than 0"),
  rate: z.coerce.number().min(0, "Rate can't be negative"),
});

export const createInvoiceSchema = z.object({
  // Optional: the service uses the lead's current quotation when not given
  quotationId: z.coerce.number().int().positive().optional(),
  // Optional: defaults to the lead's company name, or the customer's name
  billingName: emptyToNull(z.string().trim().min(1).max(200).nullable().optional()),
  billingGstin: gstin,
  billingAddress: optionalText(1000),
  advanceDue: z.coerce.number().min(0, "Advance can't be negative").optional(),
  notes: optionalText(2000),
});

export const updateInvoiceSchema = z
  .object({
    billingName: z.string().trim().min(1, "Billing name is required").max(200).optional(),
    billingGstin: gstin,
    billingAddress: optionalText(1000),
    advanceDue: z.coerce.number().min(0, "Advance can't be negative").optional(),
    notes: optionalText(2000),
    items: z.array(itemSchema).min(1, "Add at least one item").optional(),
    discount: z.coerce.number().min(0).optional(),
    discountType: z.enum(["rupees", "percentage"]).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((d) => !(d.discountType === "percentage" && d.discount > 100), {
    message: "A percentage discount can't be more than 100",
    path: ["discount"],
  });

export const paymentSchema = z.object({
  advancePaid: z.coerce.number().positive("Enter the amount received"),
  paidAt: z.coerce.date().optional(),
  paymentMode: z.enum(PAYMENT_MODES),
  paymentReference: optionalText(100),
});

export const cancelSchema = z.object({
  // Cancelled invoices stay on record, so the reason is required
  reason: z.string().trim().min(3, "Give a reason for cancelling").max(500),
});

export const listInvoicesSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "sent", "paid", "cancelled", "superseded"]).optional(),
  locationId: z.coerce.number().int().positive().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});