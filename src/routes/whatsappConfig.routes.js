import { Router } from "express";
import * as whatsappConfigController from "../controllers/whatsappConfig.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createWhatsappConfigSchema,
  listWhatsappConfigsSchema,
  updateWhatsappConfigSchema,
  whatsappConfigIdParam,
  whatsappConfigStatusSchema,
} from "../validators/whatsappConfig.validator.js";

/** Uses the same permissions as the Configuration page: settings.view and settings.manage. */
export const whatsappConfigRoutes = Router();

whatsappConfigRoutes.get(
  "/",
  requirePermission("settings.view"),
  validate({ query: listWhatsappConfigsSchema }),
  whatsappConfigController.list
);

whatsappConfigRoutes.get(
  "/:id",
  requirePermission("settings.view"),
  validate({ params: whatsappConfigIdParam }),
  whatsappConfigController.getOne
);

whatsappConfigRoutes.post(
  "/",
  requirePermission("settings.manage"),
  validate({ body: createWhatsappConfigSchema }),
  whatsappConfigController.create
);

whatsappConfigRoutes.put(
  "/:id",
  requirePermission("settings.manage"),
  validate({ params: whatsappConfigIdParam, body: updateWhatsappConfigSchema }),
  whatsappConfigController.update
);

whatsappConfigRoutes.patch(
  "/:id/status",
  requirePermission("settings.manage"),
  validate({ params: whatsappConfigIdParam, body: whatsappConfigStatusSchema }),
  whatsappConfigController.setStatus
);

whatsappConfigRoutes.delete(
  "/:id",
  requirePermission("settings.manage"),
  validate({ params: whatsappConfigIdParam }),
  whatsappConfigController.remove
);
