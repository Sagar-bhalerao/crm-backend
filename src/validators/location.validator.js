import { z } from "zod";
import { idParam, pageQuery, statusBody, statusEnum } from "./common.validator.js";

const name = z
  .string()
  .trim()
  .min(2, "Location name must be at least 2 characters")
  .max(120, "Location name is too long");

export const createLocationSchema = z.object({
  brandId: z.coerce.number().int().positive("Choose a brand"),
  name,
  status: statusEnum.default("1"),
});

export const updateLocationSchema = z
  .object({
    brandId: z.coerce.number().int().positive().optional(),
    name: name.optional(),
    status: statusEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listLocationsSchema = z.object({
  ...pageQuery,
  brandId: z.coerce.number().int().positive().optional(),
  sort: z.string().trim().optional(),
});

export const locationIdParam = idParam;
export const locationStatusSchema = statusBody;