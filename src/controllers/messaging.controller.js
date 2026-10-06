import { AUTH_TYPES, MESSAGE_TYPES, MESSAGE_VARIABLES } from "../config/messaging.js";
import * as messagingService from "../services/messaging.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendCreated, sendOk } from "../utils/response.js";

/** The lists the settings screen needs to build its dropdowns. */
export const options = asyncHandler(async (req, res) => {
  sendOk(res, { messageTypes: MESSAGE_TYPES, authTypes: AUTH_TYPES, variables: MESSAGE_VARIABLES }, "Options loaded");
});

// WhatsApp providers
export const listProviders = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.listProviders(req.query), "Providers loaded");
});

export const getProvider = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.getProvider(req.params.id), "Provider loaded");
});

export const createProvider = asyncHandler(async (req, res) => {
  sendCreated(res, await messagingService.createProvider(req.body), "Credentials saved");
});

export const updateProvider = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.updateProvider(req.params.id, req.body), "Credentials updated");
});

export const setProviderStatus = asyncHandler(async (req, res) => {
  const row = await messagingService.updateProvider(req.params.id, { status: req.body.status });
  sendOk(res, row, row.status === 1 ? "Credentials activated" : "Credentials deactivated");
});

export const removeProvider = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.removeProvider(req.params.id), "Credentials deleted");
});

// WhatsApp messages
export const listMessages = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.listMessages(req.query), "Messages loaded");
});

export const getMessage = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.getMessage(req.params.id), "Message loaded");
});

export const createMessage = asyncHandler(async (req, res) => {
  sendCreated(res, await messagingService.createMessage(req.body), "Message saved");
});

export const updateMessage = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.updateMessage(req.params.id, req.body), "Message updated");
});

export const setMessageStatus = asyncHandler(async (req, res) => {
  const row = await messagingService.updateMessage(req.params.id, { status: req.body.status });
  sendOk(res, row, row.status === 1 ? "Message activated" : "Message deactivated");
});

export const removeMessage = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.removeMessage(req.params.id), "Message deleted");
});

// Email
export const listEmailConfigs = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.listEmailConfigs(req.query), "Email settings loaded");
});

export const getEmailConfig = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.getEmailConfig(req.params.id), "Email settings loaded");
});

export const createEmailConfig = asyncHandler(async (req, res) => {
  sendCreated(res, await messagingService.createEmailConfig(req.body), "Email settings saved");
});

export const updateEmailConfig = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.updateEmailConfig(req.params.id, req.body), "Email settings updated");
});

export const setEmailConfigStatus = asyncHandler(async (req, res) => {
  const row = await messagingService.updateEmailConfig(req.params.id, { status: req.body.status });
  sendOk(res, row, row.status === 1 ? "Email settings activated" : "Email settings deactivated");
});

export const removeEmailConfig = asyncHandler(async (req, res) => {
  sendOk(res, await messagingService.removeEmailConfig(req.params.id), "Email settings deleted");
});

export const testEmailConfig = asyncHandler(async (req, res) => {
  const result = await messagingService.testEmailConfig(req.params.id, req.body.to);
  sendOk(res, result, result.sent ? `Test email sent to ${result.to}` : "SMTP connection works");
});