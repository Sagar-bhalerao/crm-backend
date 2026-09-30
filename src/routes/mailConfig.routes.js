import { Router } from "express";
import * as mailConfigController from "../controllers/mailConfig.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createMailConfigSchema,
  listMailConfigsSchema,
  mailConfigIdParam,
  mailConfigStatusSchema,
  updateMailConfigSchema,
} from "../validators/mailConfig.validator.js";

/** Uses the same permissions as the Configuration page: settings.view and settings.manage. */
export const mailConfigRoutes = Router();

mailConfigRoutes.get(
  "/",
  requirePermission("settings.view"),
  validate({ query: listMailConfigsSchema }),
  mailConfigController.list
);

mailConfigRoutes.get(
  "/:id",
  requirePermission("settings.view"),
  validate({ params: mailConfigIdParam }),
  mailConfigController.getOne
);

mailConfigRoutes.post(
  "/",
  requirePermission("settings.manage"),
  validate({ body: createMailConfigSchema }),
  mailConfigController.create
);

mailConfigRoutes.put(
  "/:id",
  requirePermission("settings.manage"),
  validate({ params: mailConfigIdParam, body: updateMailConfigSchema }),
  mailConfigController.update
);

mailConfigRoutes.patch(
  "/:id/status",
  requirePermission("settings.manage"),
  validate({ params: mailConfigIdParam, body: mailConfigStatusSchema }),
  mailConfigController.setStatus
);

mailConfigRoutes.delete(
  "/:id",
  requirePermission("settings.manage"),
  validate({ params: mailConfigIdParam }),
  mailConfigController.remove
);
