import { z } from "zod";

const percent = z.coerce.number().min(0, "Cannot be negative").max(100, "Cannot be more than 100");

export const updateSettingsSchema = z
  .object({
    taxRate: percent.optional(),
    advancePercent: percent.optional(),
    quotationValidDays: z.coerce.number().int().min(1, "Must be at least 1 day").max(365, "Too long").optional(),
    pageSize: z.coerce.number().int().min(5, "Minimum is 5").max(100, "Maximum is 100").optional(),
    currency: z.enum(["INR"], { message: "Only INR is supported today" }).optional(),
    leadResponseHours: z.coerce.number().int().min(1, "Must be at least 1 hour").max(72, "Too long").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
