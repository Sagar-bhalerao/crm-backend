import { Router } from "express";
import * as leadController from "../controllers/lead.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  assignSchema, createLeadSchema, followupSchema, leadIdParam,
  listLeadsSchema, publicLeadSchema, statusSchema, updateLeadSchema,
} from "../validators/lead.validator.js";
import { leadQuotationRoutes } from "./quotation.routes.js";

export const leadRoutes = Router();

leadRoutes.get("/options", requirePermission("lead.view"), leadController.options);
leadRoutes.get("/summary", requirePermission("lead.view"), leadController.summary);

leadRoutes.get("/", requirePermission("lead.view"), validate({ query: listLeadsSchema }), leadController.list);

leadRoutes.get("/:id", requirePermission("lead.view"), validate({ params: leadIdParam }), leadController.getOne);

leadRoutes.post("/", requirePermission("lead.create"), validate({ body: createLeadSchema }), leadController.create);

leadRoutes.put("/:id", requirePermission("lead.update"), validate({ params: leadIdParam, body: updateLeadSchema }), leadController.update);

leadRoutes.patch("/:id/status", requirePermission("lead.update"), validate({ params: leadIdParam, body: statusSchema }), leadController.changeStatus);

leadRoutes.patch("/:id/assign", requirePermission("lead.assign"), validate({ params: leadIdParam, body: assignSchema }), leadController.assign);

leadRoutes.post("/:id/followups", requirePermission("followup.create"), validate({ params: leadIdParam, body: followupSchema }), leadController.addFollowup);

leadRoutes.delete("/:id", requirePermission("lead.delete"), validate({ params: leadIdParam }), leadController.remove);

leadRoutes.use("/:leadId/quotations", leadQuotationRoutes);

/** The website enquiry form. Mounted outside the token check. */
export const publicLeadRoutes = Router();
publicLeadRoutes.post("/enquiries", validate({ body: publicLeadSchema }), leadController.createPublic);