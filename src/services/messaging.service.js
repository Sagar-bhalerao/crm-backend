import nodemailer from "nodemailer";
import { MESSAGE_TYPES } from "../config/messaging.js";
import * as repo from "../repositories/messaging.repository.js";
import { ApiError } from "../utils/ApiError.js";

const scopeLabel = (row) => (row.locationName ? row.locationName : "all locations");

// ── WhatsApp providers ────────────────────────────────────────────────────

export const listProviders = (query) => repo.listProviders(query);

export async function getProvider(id) {
  const row = await repo.findProvider(id);
  if (!row) throw ApiError.notFound("Those provider credentials do not exist.");
  return row;
}

async function checkProviderScope(input, excludeId = null) {
  const clash = await repo.findByScope("whatsapp_providers", {
    brandId: input.brandId,
    locationId: input.locationId,
    excludeId,
  });
  if (clash) {
    throw ApiError.conflict(
      "Credentials already exist for that brand and location. Edit them instead of adding a second set."
    );
  }
}

export async function createProvider(input) {
  await checkProviderScope(input);
  return repo.insertProvider(input);
}

export async function updateProvider(id, changes) {
  const current = await getProvider(id);
  if (changes.brandId || "locationId" in changes) {
    await checkProviderScope(
      { brandId: changes.brandId ?? current.brandId, locationId: changes.locationId ?? current.locationId },
      id
    );
  }
  return repo.updateProvider(id, changes);
}

export async function removeProvider(id) {
  await getProvider(id);
  await repo.removeProvider(id);
  return { id, deleted: true };
}

// ── WhatsApp messages ─────────────────────────────────────────────────────

export const listMessages = (query) => repo.listMessages(query);

export async function getMessage(id) {
  const row = await repo.findMessage(id);
  if (!row) throw ApiError.notFound("That message does not exist.");
  return row;
}

async function checkMessageScope(input, excludeId = null) {
  const clash = await repo.findMessageByScope({ ...input, excludeId });
  if (clash) {
    const type = MESSAGE_TYPES.find((t) => t.key === input.messageType);
    throw ApiError.conflict(
      `A "${type?.label || input.messageType}" message already exists for that brand and ${input.locationId ? "location" : "all locations"}.`
    );
  }
}

export async function createMessage(input) {
  await checkMessageScope(input);
  return repo.insertMessage(input);
}

export async function updateMessage(id, changes) {
  const current = await getMessage(id);
  if (changes.brandId || changes.messageType || "locationId" in changes) {
    await checkMessageScope(
      {
        brandId: changes.brandId ?? current.brandId,
        locationId: changes.locationId ?? current.locationId,
        messageType: changes.messageType ?? current.messageType,
      },
      id
    );
  }
  return repo.updateMessage(id, changes);
}

export async function removeMessage(id) {
  await getMessage(id);
  await repo.removeMessage(id);
  return { id, deleted: true };
}

// ── Email configs ─────────────────────────────────────────────────────────

export const listEmailConfigs = (query) => repo.listEmailConfigs(query);

export async function getEmailConfig(id) {
  const row = await repo.findEmailConfig(id);
  if (!row) throw ApiError.notFound("That email configuration does not exist.");
  return row;
}

async function checkEmailScope(input, excludeId = null) {
  const clash = await repo.findByScope("email_configs", {
    brandId: input.brandId,
    locationId: input.locationId,
    excludeId,
  });
  if (clash) {
    throw ApiError.conflict(
      "An email configuration already exists for that brand and location. Edit it instead of adding a second one."
    );
  }
}

export async function createEmailConfig(input) {
  await checkEmailScope(input);
  return repo.insertEmailConfig(input);
}

export async function updateEmailConfig(id, changes) {
  const current = await getEmailConfig(id);
  if (changes.brandId || "locationId" in changes) {
    await checkEmailScope(
      { brandId: changes.brandId ?? current.brandId, locationId: changes.locationId ?? current.locationId },
      id
    );
  }
  return repo.updateEmailConfig(id, changes);
}

export async function removeEmailConfig(id) {
  await getEmailConfig(id);
  await repo.removeEmailConfig(id);
  return { id, deleted: true };
}

/**
 * Opens a real SMTP connection and, if an address is given, sends a test
 * message. This is the only way to know the credentials actually work.
 */
export async function testEmailConfig(id, to) {
  const config = await getEmailConfig(id);

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure === 1,
    auth: { user: config.smtpUsername, pass: config.smtpPassword },
    connectionTimeout: 10000,
  });

  try {
    await transport.verify();
  } catch (err) {
    throw ApiError.badRequest(`SMTP connection failed: ${err.message}`);
  }

  if (!to) return { verified: true, sent: false };

  try {
    await transport.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
      replyTo: config.replyToEmail || undefined,
      to,
      subject: `Test email from ${config.brandName}`,
      text: `This is a test from the CRM for ${config.brandName} (${scopeLabel(config)}). If you received it, sending works.`,
    });
  } catch (err) {
    throw ApiError.badRequest(`Connected, but sending failed: ${err.message}`);
  }

  return { verified: true, sent: true, to };
}

/**
 * What the lead module will call when it needs to send something.
 * Returns the credentials and the message for a brand/location, or explains
 * what is missing.
 */
export async function resolveForSend(brandId, locationId, messageType) {
  const [provider, message, email] = await Promise.all([
    repo.resolveProvider(brandId, locationId),
    messageType ? repo.resolveMessage(brandId, locationId, messageType) : Promise.resolve(null),
    repo.resolveEmailConfig(brandId, locationId),
  ]);
  return {
    whatsapp: provider ? { provider, message } : null,
    email,
    missing: [
      !provider && "WhatsApp credentials",
      messageType && !message && `WhatsApp message for ${messageType}`,
      !email && "Email configuration",
    ].filter(Boolean),
  };
}