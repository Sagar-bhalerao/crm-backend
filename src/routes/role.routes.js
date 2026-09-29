import { Router } from "express";
import * as roleController from "../controllers/role.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createRoleSchema, listRolesSchema, roleIdParam,
  roleStatusSchema, updateRoleSchema,
} from "../validators/role.validator.js";

export const roleRoutes = Router();

roleRoutes.get("/", requirePermission("role.view"), validate({ query: listRolesSchema }), roleController.list);

roleRoutes.get("/:id", requirePermission("role.view"), validate({ params: roleIdParam }), roleController.getOne);

roleRoutes.post("/", requirePermission("role.create"), validate({ body: createRoleSchema }), roleController.create);

roleRoutes.put(
  "/:id",
  requirePermission("role.update"),
  validate({ params: roleIdParam, body: updateRoleSchema }),
  roleController.update
);

roleRoutes.patch(
  "/:id/status",
  requirePermission("role.update"),
  validate({ params: roleIdParam, body: roleStatusSchema }),
  roleController.setStatus
);

roleRoutes.delete("/:id", requirePermission("role.delete"), validate({ params: roleIdParam }), roleController.remove);

/** The permission catalogue, mounted separately at /api/v1/permissions */
export const permissionRoutes = Router();
permissionRoutes.get("/", requirePermission("role.view"), roleController.listPermissions);