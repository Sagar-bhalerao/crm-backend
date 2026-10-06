import { Router } from "express";
import * as c from "../controllers/messaging.controller.js";
import { requirePermission } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  emailConfigSchema, listQuery, messageSchema, messagingIdParam, messagingStatusSchema,
  providerSchema, testEmailSchema, updateEmailConfigSchema, updateMessageSchema, updateProviderSchema,
} from "../validators/messaging.validator.js";

/** Messaging is part of Configuration, so it uses the settings permissions. */
const canView = requirePermission("settings.view");
const canManage = requirePermission("settings.manage");

export const messagingRoutes = Router();

messagingRoutes.get("/options", canView, c.options);

// WhatsApp credentials
messagingRoutes.get("/whatsapp/providers", canView, validate({ query: listQuery }), c.listProviders);
messagingRoutes.get("/whatsapp/providers/:id", canView, validate({ params: messagingIdParam }), c.getProvider);
messagingRoutes.post("/whatsapp/providers", canManage, validate({ body: providerSchema }), c.createProvider);
messagingRoutes.put("/whatsapp/providers/:id", canManage, validate({ params: messagingIdParam, body: updateProviderSchema }), c.updateProvider);
messagingRoutes.patch("/whatsapp/providers/:id/status", canManage, validate({ params: messagingIdParam, body: messagingStatusSchema }), c.setProviderStatus);
messagingRoutes.delete("/whatsapp/providers/:id", canManage, validate({ params: messagingIdParam }), c.removeProvider);

// WhatsApp messages
messagingRoutes.get("/whatsapp/messages", canView, validate({ query: listQuery }), c.listMessages);
messagingRoutes.get("/whatsapp/messages/:id", canView, validate({ params: messagingIdParam }), c.getMessage);
messagingRoutes.post("/whatsapp/messages", canManage, validate({ body: messageSchema }), c.createMessage);
messagingRoutes.put("/whatsapp/messages/:id", canManage, validate({ params: messagingIdParam, body: updateMessageSchema }), c.updateMessage);
messagingRoutes.patch("/whatsapp/messages/:id/status", canManage, validate({ params: messagingIdParam, body: messagingStatusSchema }), c.setMessageStatus);
messagingRoutes.delete("/whatsapp/messages/:id", canManage, validate({ params: messagingIdParam }), c.removeMessage);

// Email
messagingRoutes.get("/email/configs", canView, validate({ query: listQuery }), c.listEmailConfigs);
messagingRoutes.get("/email/configs/:id", canView, validate({ params: messagingIdParam }), c.getEmailConfig);
messagingRoutes.post("/email/configs", canManage, validate({ body: emailConfigSchema }), c.createEmailConfig);
messagingRoutes.put("/email/configs/:id", canManage, validate({ params: messagingIdParam, body: updateEmailConfigSchema }), c.updateEmailConfig);
messagingRoutes.patch("/email/configs/:id/status", canManage, validate({ params: messagingIdParam, body: messagingStatusSchema }), c.setEmailConfigStatus);
messagingRoutes.delete("/email/configs/:id", canManage, validate({ params: messagingIdParam }), c.removeEmailConfig);
messagingRoutes.post("/email/configs/:id/test", canManage, validate({ params: messagingIdParam, body: testEmailSchema }), c.testEmailConfig);