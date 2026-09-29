import { z } from "zod";
import { idParam, optionalText, pageQuery, statusBody, statusEnum } from "./common.validator.js";

const name = (label) => z.string().trim().min(2, `${label} must be at least 2 characters`).max(150, `${label} is too long`);
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(255);
const mobile = z.string().trim().regex(/^[0-9+\- ]{6,20}$/, "Enter a valid mobile number");
const password = z.string().min(8, "Password must be at least 8 characters").max(100);
const locationIds = z.array(z.coerce.number().int().positive()).max(50).optional().default([]);

export const createUserSchema = z.object({
  firstName: name("First name"),
  lastName: optionalText(255, "Last name"),
  email,
  mobile,
  password,
  brandId: z.coerce.number().int().positive("Choose a brand"),
  roleId: z.coerce.number().int().positive("Choose a role"),
  locationIds,
  status: statusEnum.default(1),
});

export const updateUserSchema = z
  .object({
    firstName: name("First name").optional(),
    lastName: optionalText(255, "Last name"),
    email: email.optional(),
    mobile: mobile.optional(),
    brandId: z.coerce.number().int().positive().optional(),
    roleId: z.coerce.number().int().positive().optional(),
    locationIds,
    status: statusEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listUsersSchema = z.object({
  ...pageQuery,
  roleId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  sort: z.string().trim().optional(),
});

export const passwordSchema = z.object({ password });
export const userIdParam = idParam;
export const userStatusSchema = statusBody;