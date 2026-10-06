import { z } from "zod";
import { AUTH_TYPE_KEYS, MESSAGE_TYPE_KEYS } from "../config/messaging.js";
import { idParam, optionalText, statusBody, statusEnum } from "./common.validator.js";

/** Empty location means the whole brand, so blank becomes null. */
const locationId = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable()
);

const brandId = z.coerce.number().int().positive("Choose a brand");

export const providerSchema = z.object({
  brandId,
  locationId,
  provider: z.string().trim().min(2, "Enter the provider name").max(60),
  apiUrl: z.string().trim().url("Enter a full URL starting with https").max(500),
  authType: z.enum(AUTH_TYPE_KEYS, { message: "Choose how the key is sent" }),
  authKey: z.string().trim().min(4, "Enter the auth key").max(2000),
  senderId: optionalText(60, "Sender ID"),
  status: statusEnum.default(1),
});

export const updateProviderSchema = providerSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Nothing to update" }
);

export const messageSchema = z.object({
  brandId,
  locationId,
  providerId: z.coerce.number().int().positive("Choose a provider"),
  messageType: z.enum(MESSAGE_TYPE_KEYS, { message: "Choose a message type" }),
  templateName: optionalText(120, "Template name"),
  templateId: optionalText(120, "Template ID"),
  language: z.string().trim().max(10).default("en"),
  body: z.string().trim().min(5, "Write the message").max(4000, "Message is too long"),
  status: statusEnum.default(1),
});

export const updateMessageSchema = messageSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Nothing to update" }
);

export const emailConfigSchema = z.object({
  brandId,
  locationId,
  smtpHost: z.string().trim().min(3, "Enter the SMTP host").max(255),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.coerce.number().int().min(0).max(1).default(0),
  smtpUsername: z.string().trim().min(1, "Enter the SMTP username").max(255),
  smtpPassword: z.string().min(1, "Enter the SMTP password").max(500),
  fromEmail: z.string().trim().email("Enter a valid from address").max(255),
  fromName: optionalText(120, "From name"),
  replyToEmail: z
    .string()
    .trim()
    .email("Enter a valid reply-to address")
    .max(255)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  replyToName: optionalText(120, "Reply-to name"),
  status: statusEnum.default(1),
});

export const updateEmailConfigSchema = emailConfigSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Nothing to update" }
);

export const testEmailSchema = z.object({
  to: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
});

export const listQuery = z.object({
  brandId: z.coerce.number().int().positive().optional(),
  messageType: z.string().trim().optional(),
});

export const messagingIdParam = idParam;
export const messagingStatusSchema = statusBody;