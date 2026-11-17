import { Router } from "express";
import * as invoiceController from "../controllers/invoice.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  cancelSchema, createInvoiceSchema, invoiceIdParam, paymentSchema, updateInvoiceSchema, listInvoicesSchema
} from "../validators/invoice.validator.js";
import { leadIdParam } from "../validators/quotation.validator.js";


export const invoiceRoutes = Router();

invoiceRoutes.get("/", requirePermission("invoice.view"), validate({ query: listInvoicesSchema }), invoiceController.list);

invoiceRoutes.get("/:id", requirePermission("invoice.view"), validate({ params: invoiceIdParam }), invoiceController.getOne);

invoiceRoutes.put("/:id", requirePermission("invoice.create"), validate({ params: invoiceIdParam, body: updateInvoiceSchema }), invoiceController.update);

invoiceRoutes.get("/:id/pdf", requirePermission("invoice.view"), validate({ params: invoiceIdParam }), invoiceController.downloadPdf);

invoiceRoutes.post("/:id/pdf", requirePermission("invoice.create"), validate({ params: invoiceIdParam }), invoiceController.generatePdf);

invoiceRoutes.post("/:id/send", requirePermission("invoice.create"), validate({ params: invoiceIdParam }), invoiceController.send);

// Recording money received is what unlocks Finalize, so it sits with that permission
invoiceRoutes.post("/:id/payment", requirePermission("lead.finalize"), validate({ params: invoiceIdParam, body: paymentSchema }), invoiceController.recordPayment);

invoiceRoutes.post("/:id/cancel", requirePermission("invoice.create"), validate({ params: invoiceIdParam, body: cancelSchema }), invoiceController.cancel);

/** Mounted under /leads, since an invoice always belongs to one. */
export const leadInvoiceRoutes = Router({ mergeParams: true });

leadInvoiceRoutes.get("/", requirePermission("invoice.view"), validate({ params: leadIdParam }), invoiceController.listForLead);

leadInvoiceRoutes.post("/", requirePermission("invoice.create"), validate({ params: leadIdParam, body: createInvoiceSchema }), invoiceController.create);