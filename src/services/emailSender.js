import nodemailer from "nodemailer";
import { query } from "../config/database.js";
import * as messagingRepo from "../repositories/messaging.repository.js";
import { readFile } from "../utils/storage.js";

/**
 * Sends one email for a lead and records the attempt, successful or not,
 * so the lead's Messages tab shows what actually went out.
 */
export async function sendLeadEmail(lead, { messageType, subject, body, attachments = [], userId = null }) {
  const config = await messagingRepo.resolveEmailConfig(lead.brandId, lead.locationId);

  if (!config) {
    await log(lead.id, { messageType, recipient: lead.email, subject, body, status: "failed",
      error: "No email account is configured for this brand or location.", userId });
    throw new Error("No email account is configured. Add one under Configuration → Email.");
  }
  if (!lead.email) {
    await log(lead.id, { messageType, recipient: "", subject, body, status: "failed",
      error: "The customer has no email address.", userId });
    throw new Error("This customer has no email address.");
  }

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure === 1,
    auth: { user: config.smtpUsername, pass: config.smtpPassword },
    connectionTimeout: 15000,
  });

  // Files are read from storage here, so callers only pass paths
  const files = [];
  for (const a of attachments) {
    files.push({ filename: a.filename, content: await readFile(a.path), contentType: "application/pdf" });
  }

  try {
    const info = await transport.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
      replyTo: config.replyToEmail
        ? config.replyToName
          ? `"${config.replyToName}" <${config.replyToEmail}>`
          : config.replyToEmail
        : undefined,
      to: lead.email,
      subject,
      html: body,
      attachments: files,
    });

    await log(lead.id, {
      messageType, recipient: lead.email, subject, body,
      status: "sent", providerRef: info.messageId, userId,
    });
    return { sent: true, to: lead.email };
  } catch (err) {
    await log(lead.id, {
      messageType, recipient: lead.email, subject, body,
      status: "failed", error: err.message, userId,
    });
    throw new Error(`Email failed: ${err.message}`);
  } finally {
    transport.close();
  }
}

/** One row per attempt in lead_messages. */
async function log(leadId, { messageType, recipient, subject, body, status, providerRef = null, error = null, userId }) {
  await query(
    `INSERT INTO lead_messages
       (lead_id, channel, message_type, recipient, subject, body, status, provider_ref, error_message, sent_at, created_by)
     VALUES ($1, 'email', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      leadId, messageType, recipient || "", subject, body, status, providerRef, error,
      status === "sent" ? new Date() : null, userId,
    ]
  );
}