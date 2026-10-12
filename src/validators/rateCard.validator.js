import { z } from "zod";
import { RATE_CATEGORY_KEYS, RATE_UNIT_KEYS } from "../config/rateCards.js";
import { LEAD_TYPE_KEYS } from "../config/leads.js";
import { idParam, optionalText, statusBody, statusEnum } from "./common.validator.js";

const optionalInt = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.coerce.number().int().min(0).max(100000).nullable()
);
const optionalDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.date().nullable()
);
export const createRateCardSchema = z.object({
  locationId: z.coerce.number().int().positive("Choose a location"),
  name: z.string().trim().min(2, "Enter a name").max(150),
  code: optionalText(40, "Code"),
  // Empty means it applies to every lead type
  leadType: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(LEAD_TYPE_KEYS).nullable()),
  category: z.enum(RATE_CATEGORY_KEYS, { message: "Choose a category" }).default("package"),
  unit: z.enum(RATE_UNIT_KEYS, { message: "Choose a unit" }).default("per_guest"),
  rate: z.coerce.number().min(0, "Rate cannot be negative").max(10000000),
  minQty: optionalInt,
  description: optionalText(500, "Description"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  status: statusEnum.default(1),
    visitFrom: optionalDate,
  visitTo: optionalDate,
  bookingFrom: optionalDate,
  bookingTo: optionalDate,
  // 1 = Mon ... 7 = Sun. Empty means every day.
  days: z.array(z.coerce.number().int().min(1).max(7)).max(7).optional().default([]),
  ruleType: z.enum(["price", "blackout"]).default("price"),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  
});

export const updateRateCardSchema = createRateCardSchema
  .partial()
  .omit({ locationId: true })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listRateCardsSchema = z.object({
  locationId: z.coerce.number().int().positive().optional(),
  leadType: z.preprocess((v) => v || undefined, z.enum(LEAD_TYPE_KEYS).optional()),
  category: z.preprocess((v) => v || undefined, z.enum(RATE_CATEGORY_KEYS).optional()),
  status: z.preprocess((v) => (v === "" || v == null ? undefined : v), statusEnum.optional()),
  search: z.string().trim().max(100).optional(),
});

export const copySchema = z.object({
  fromLocationId: z.coerce.number().int().positive("Choose the location to copy from"),
  toLocationId: z.coerce.number().int().positive("Choose the location to copy to"),
});

export const rateCardIdParam = idParam;
export const rateCardStatusSchema = statusBody;