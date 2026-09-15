import { z } from "zod";
import { idParam, optionalText, pageQuery, statusBody, statusEnum } from "./common.validator.js";

const name = z.string().trim().min(2, "Location name must be at least 2 characters").max(120, "Location name is too long");
const code = z
  .string()
  .trim()
  .min(2, "Location code must be at least 2 characters")
  .max(30, "Location code is too long")
  .regex(/^[A-Za-z0-9-]+$/, "Location code can only contain letters, numbers and hyphens")
  .transform((v) => v.toUpperCase());

const pincode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Pincode must be 6 digits")
  .optional()
  .or(z.literal(""))
  .transform((v) => v || null);

const contactNumber = z
  .string()
  .trim()
  .regex(/^[0-9+\- ]{6,20}$/, "Enter a valid contact number")
  .optional()
  .or(z.literal(""))
  .transform((v) => v || null);

const email = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(150)
  .optional()
  .or(z.literal(""))
  .transform((v) => v || null);

export const createLocationSchema = z.object({
  brandId: z.coerce.number().int().positive("Choose a brand"),
  name,
  code,
  city: optionalText(80, "City"),
  state: optionalText(80, "State"),
  address: optionalText(500, "Address"),
  pincode,
  contactNumber,
  email,
  status: statusEnum.default("active"),
});

export const updateLocationSchema = z
  .object({
    brandId: z.coerce.number().int().positive().optional(),
    name: name.optional(),
    code: code.optional(),
    city: optionalText(80, "City"),
    state: optionalText(80, "State"),
    address: optionalText(500, "Address"),
    pincode,
    contactNumber,
    email,
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
