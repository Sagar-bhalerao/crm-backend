import { z } from "zod";
import { idParam, statusBody } from "./common.validator.js";
import { configListQuery, httpUrl, locationId, optionalText, secretInput, statusEnum } from "./configShared.validator.js";

export const AUTH_TYPES = ["bearer", "api_key", "basic", "none"];

const apiProvider = z.string().trim().min(2, "Enter the API provider").max(60, "API provider is too long");
const apiUrl = httpUrl("API URL");
const authType = z.enum(AUTH_TYPES, { message: "Choose an auth type" });
const authHeader = optionalText(60, "Header name").refine((v) => v == null || /^[A-Za-z0-9_-]+$/.test(v), {
  message: "Header name can only contain letters, numbers, hyphens and underscores",
});
const authUsername = optionalText(150, "Username");
const messageBody = z.string().trim().min(1, "Enter the message text").max(4096, "Message is too long for WhatsApp (4096 characters)");

/**
 * Which extra fields each auth type needs (header name, username, key) is
 * checked in the service, because on update it depends on what is already saved.
 */
export const createWhatsappConfigSchema = z.object({
  locationId,
  apiProvider,
  apiUrl,
  authType,
  authHeader,
  authUsername,
  authKey: secretInput("Auth key").optional(),
  messageBody,
  status: statusEnum.default(1),
});

export const updateWhatsappConfigSchema = z
  .object({
    locationId: locationId.optional(),
    apiProvider: apiProvider.optional(),
    apiUrl: apiUrl.optional(),
    authType: authType.optional(),
    authHeader: authHeader.optional(),
    authUsername: authUsername.optional(),
    authKey: secretInput("Auth key").optional(),
    messageBody: messageBody.optional(),
    status: statusEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listWhatsappConfigsSchema = z.object(configListQuery);

export const whatsappConfigIdParam = idParam;
export const whatsappConfigStatusSchema = statusBody;
