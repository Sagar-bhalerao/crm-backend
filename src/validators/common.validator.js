import { z } from "zod";

export const idParam = z.object({
  id: z.coerce.number({ message: "Invalid id" }).int("Invalid id").positive("Invalid id"),
});
export const statusEnum = z.enum(["active", "inactive"], { message: "Status must be active or inactive" });
export const statusBody = z.object({ status: statusEnum });

/** Trimmed string that treats "" as "not provided". */
export const optionalText = (max, label = "Value") =>
  z.string().trim().max(max, `${label} is too long`).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const pageQuery = {
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  status: statusEnum.optional().or(z.literal("")).transform((v) => v || undefined),
};
