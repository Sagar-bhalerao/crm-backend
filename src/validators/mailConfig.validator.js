import { z } from "zod";
import { idParam, statusBody } from "./common.validator.js";
import { configListQuery, locationId, optionalText, secretInput, statusEnum } from "./configShared.validator.js";

export const SMTP_SECURITY = ["ssl", "starttls", "none"];

const smtpHost = z
  .string()
  .trim()
  .min(3, "Enter the SMTP host")
  .max(255, "SMTP host is too long")
  .regex(/^[A-Za-z0-9.-]+$/, "Enter a host name only, like smtp.gmail.com");
const smtpPort = z.coerce
  .number({ message: "Enter the SMTP port" })
  .int("Enter a whole number")
  .min(1, "Port must be between 1 and 65535")
  .max(65535, "Port must be between 1 and 65535");
const smtpUsername = z.string().trim().min(1, "Enter the SMTP username").max(255, "SMTP username is too long");
const smtpSecurity = z.enum(SMTP_SECURITY, { message: "Choose the encryption type" });
const email = (label) => z.string().trim().max(150, `${label} is too long`).email(`Enter a valid ${label.toLowerCase()}`);
const fromName = z.string().trim().min(1, "Enter the sender name").max(120, "Sender name is too long");
const replyToEmail = z
  .literal("")
  .or(email("Reply-to email"))
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));
const replyToName = optionalText(120, "Reply-to name");
const subject = z.string().trim().min(1, "Enter the email subject").max(255, "Subject is too long");
const body = z.string().trim().min(1, "Enter the email text").max(20000, "Email text is too long");

export const createMailConfigSchema = z.object({
  locationId,
  smtpHost,
  smtpPort,
  smtpUsername,
  smtpPassword: secretInput("SMTP password", 500).min(1, "Enter the SMTP password"),
  smtpSecurity: smtpSecurity.default("starttls"),
  fromEmail: email("From email"),
  fromName,
  replyToEmail,
  replyToName,
  subject,
  body,
  status: statusEnum.default(1),
});

/** An empty smtpPassword on update keeps the saved password. */
export const updateMailConfigSchema = z
  .object({
    locationId: locationId.optional(),
    smtpHost: smtpHost.optional(),
    smtpPort: smtpPort.optional(),
    smtpUsername: smtpUsername.optional(),
    smtpPassword: secretInput("SMTP password", 500).optional(),
    smtpSecurity: smtpSecurity.optional(),
    fromEmail: email("From email").optional(),
    fromName: fromName.optional(),
    replyToEmail: replyToEmail.optional(),
    replyToName: replyToName.optional(),
    subject: subject.optional(),
    body: body.optional(),
    status: statusEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const listMailConfigsSchema = z.object(configListQuery);

export const mailConfigIdParam = idParam;
export const mailConfigStatusSchema = statusBody;
