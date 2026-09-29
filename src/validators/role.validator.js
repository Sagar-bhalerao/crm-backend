import { z } from "zod";
import { idParam, optionalText, statusBody, statusEnum } from "./common.validator.js";

const name = z.string().trim().min(2, "Role name must be at least 2 characters").max(60, "Role name is too long");
const code = z
  .string()
  .trim()
  .min(2, "Role code must be at least 2 characters")
  .max(40, "Role code is too long")
  .regex(/^[a-z0-9_]+$/, "Role code can only contain lowercase letters, numbers and underscores");

const permissions = z.array(z.string().trim()).max(200).optional().default([]);

export const createRoleSchema = z.object({
  name,
  code,
  description: optionalText(500, "Description"),
  permissions,
  status: statusEnum.default(1),
});

export const updateRoleSchema = z
  .object({
    name: name.optional(),
    code: code.optional(),
    description: optionalText(500, "Description"),
    permissions: z.array(z.string().trim()).max(200).optional(),
    status: statusEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listRolesSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.preprocess((v) => (v === "" || v == null ? undefined : v), statusEnum.optional()),
});

export const roleIdParam = idParam;
export const roleStatusSchema = statusBody;