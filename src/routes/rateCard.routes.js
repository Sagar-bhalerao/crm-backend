import { Router } from "express";
import * as rateCardController from "../controllers/rateCard.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  copySchema, createRateCardSchema, listRateCardsSchema,
  rateCardIdParam, rateCardStatusSchema, updateRateCardSchema,
} from "../validators/rateCard.validator.js";

export const rateCardRoutes = Router();

rateCardRoutes.get("/options", requirePermission("settings.view"), rateCardController.options);

rateCardRoutes.get("/", requirePermission("settings.view"), validate({ query: listRateCardsSchema }), rateCardController.list);

// The quotation builder needs this, so it goes with quotations, not settings
rateCardRoutes.get("/for-lead/:leadId", requirePermission("quotation.create"), rateCardController.forLead);

rateCardRoutes.get("/:id", requirePermission("settings.view"), validate({ params: rateCardIdParam }), rateCardController.getOne);

rateCardRoutes.post("/", requirePermission("settings.manage"), validate({ body: createRateCardSchema }), rateCardController.create);

rateCardRoutes.post("/copy", requirePermission("settings.manage"), validate({ body: copySchema }), rateCardController.copy);

rateCardRoutes.put("/:id", requirePermission("settings.manage"), validate({ params: rateCardIdParam, body: updateRateCardSchema }), rateCardController.update);

rateCardRoutes.patch("/:id/status", requirePermission("settings.manage"), validate({ params: rateCardIdParam, body: rateCardStatusSchema }), rateCardController.setStatus);

rateCardRoutes.delete("/:id", requirePermission("settings.manage"), validate({ params: rateCardIdParam }), rateCardController.remove);