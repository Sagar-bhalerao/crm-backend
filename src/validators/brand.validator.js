import { z } from "zod";
import { idParam, optionalText, pageQuery, statusBody, statusEnum } from "./common.validator.js";

const name = z.string().trim().min(2, "Brand name must be at least 2 characters").max(120, "Brand name is too long");
const code = z
  .string()
  .trim()
  .min(2, "Brand code must be at least 2 characters")
  .max(20, "Brand code is too long")
  .regex(/^[A-Za-z0-9-]+$/, "Brand code can only contain letters, numbers and hyphens")
  .transform((v) => v.toUpperCase());

export const createBrandSchema = z.object({
  name,
  code,
  description: optionalText(1000, "Description"),
  logoUrl: optionalText(500, "Logo URL"),
  status: statusEnum.default(1),
});

/** Update allows sending only the fields that changed. */
export const updateBrandSchema = z
  .object({
    name: name.optional(),
    code: code.optional(),
    description: optionalText(1000, "Description"),
    logoUrl: optionalText(500, "Logo URL"),
    status: statusEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listBrandsSchema = z.object({
  ...pageQuery,
  sort: z.string().trim().optional(),
});

export const brandIdParam = idParam;
export const brandStatusSchema = statusBody;
