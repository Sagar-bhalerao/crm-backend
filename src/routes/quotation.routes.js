import { Router } from "express";
import * as quotationController from "../controllers/quotation.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createQuotationSchema, leadIdParam, quotationIdParam, quotationStatusSchema,
} from "../validators/quotation.validator.js";

export const quotationRoutes = Router();

quotationRoutes.get("/:id", requirePermission("quotation.view"), validate({ params: quotationIdParam }), quotationController.getOne);

quotationRoutes.get("/:id/pdf", requirePermission("quotation.view"), validate({ params: quotationIdParam }), quotationController.downloadPdf);

quotationRoutes.post("/:id/pdf", requirePermission("quotation.create"), validate({ params: quotationIdParam }), quotationController.generatePdf);

quotationRoutes.post("/:id/share", requirePermission("quotation.create"), validate({ params: quotationIdParam }), quotationController.share);

quotationRoutes.patch("/:id/status", requirePermission("quotation.create"), validate({ params: quotationIdParam, body: quotationStatusSchema }), quotationController.setStatus);

/** Mounted under /leads, since a quotation always belongs to one. */
export const leadQuotationRoutes = Router({ mergeParams: true });

leadQuotationRoutes.get("/", requirePermission("quotation.view"), validate({ params: leadIdParam }), quotationController.listForLead);

leadQuotationRoutes.post("/", requirePermission("quotation.create"), validate({ params: leadIdParam, body: createQuotationSchema }), quotationController.create);