import { Router } from "express";
import * as settingsController from "../controllers/settings.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { updateSettingsSchema } from "../validators/settings.validator.js";

export const settingsRoutes = Router();

settingsRoutes.get("/", requirePermission("settings.view"), settingsController.get);

settingsRoutes.put("/", requirePermission("settings.manage"), validate({ body: updateSettingsSchema }), settingsController.update);

settingsRoutes.post("/reset", requirePermission("settings.manage"), settingsController.reset);
