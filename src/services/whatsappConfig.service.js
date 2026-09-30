import * as whatsappConfigRepo from "../repositories/whatsappConfig.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { decryptSecret, encryptSecret, secretHint } from "../utils/crypto.js";
import { assertUsableLocation } from "./configLocation.service.js";

export const list = (query) => whatsappConfigRepo.findAll(query);

export async function getById(id) {
  const config = await whatsappConfigRepo.findById(id);
  if (!config) throw ApiError.notFound("That WhatsApp configuration does not exist.");
  return config;
}

async function assertLocationFree(locationId, excludeId = null) {
  const clash = await whatsappConfigRepo.findByLocation(locationId, excludeId);
  if (clash) {
    const message = `${clash.brandName} ${clash.locationName} already has a WhatsApp configuration. Edit that one instead.`;
    throw ApiError.conflict(message, [{ field: "locationId", message }]);
  }
}

/**
 * Works out the auth columns for the chosen auth type and checks the fields
 * that type needs. Fields another type would use are cleared, so switching
 * from Basic to Bearer does not leave an old username behind.
 */
function buildAuth(record, { newKey, hasSavedKey }) {
  const type = record.authType;
  const errors = [];

  const authHeader = type === "api_key" ? record.authHeader || null : null;
  const authUsername = type === "basic" ? record.authUsername || null : null;

  if (type === "api_key" && !authHeader) {
    errors.push({ field: "authHeader", message: "Enter the header name the provider expects, like Api-Key" });
  }
  if (type === "basic" && !authUsername) {
    errors.push({ field: "authUsername", message: "Enter the username" });
  }
  if (type !== "none" && !newKey && !hasSavedKey) {
    errors.push({ field: "authKey", message: "Enter the auth key" });
  }
  if (errors.length) throw ApiError.badRequest(errors[0].message, errors);

  const auth = { authHeader, authUsername };
  if (type === "none") {
    auth.authSecretEnc = null;
    auth.authSecretHint = null;
  } else if (newKey) {
    auth.authSecretEnc = encryptSecret(newKey);
    auth.authSecretHint = secretHint(newKey);
  }
  return auth;
}

export async function create(input) {
  const { authKey, ...fields } = input;
  await assertUsableLocation(fields.locationId);
  await assertLocationFree(fields.locationId);

  const auth = buildAuth(fields, { newKey: authKey, hasSavedKey: false });
  return whatsappConfigRepo.insert({ ...fields, ...auth });
}

/** An empty or missing authKey keeps the saved key. */
export async function update(id, changes) {
  const existing = await getById(id);
  const { authKey, ...fields } = changes;

  const locationChanged = fields.locationId !== undefined && fields.locationId !== existing.locationId;
  if (locationChanged) {
    await assertUsableLocation(fields.locationId);
    await assertLocationFree(fields.locationId, id);
  } else if (fields.status === 1 && existing.status !== 1) {
    await assertUsableLocation(existing.locationId);
  }

  const authTouched = Boolean(authKey) || ["authType", "authHeader", "authUsername"].some((k) => k in fields);
  const auth = authTouched
    ? buildAuth({ ...existing, ...fields }, { newKey: authKey, hasSavedKey: existing.authKeySet })
    : {};

  // The existing record is only read for checks; only the submitted fields are written.
  return whatsappConfigRepo.update(id, { ...fields, ...auth });
}

export async function setStatus(id, status) {
  const config = await getById(id);
  if (config.status === status) return config;
  if (status === 1) await assertUsableLocation(config.locationId);
  return whatsappConfigRepo.update(id, { status });
}

/** Nothing else points at a configuration, so it can always be deleted. */
export async function remove(id) {
  await getById(id);
  await whatsappConfigRepo.remove(id);
  return { id, deleted: true };
}

/**
 * For the code that sends WhatsApp messages. Returns the active configuration
 * for a location with the key decrypted, or null when there is none (or its
 * location or brand is inactive). Never return this from an API endpoint.
 */
export async function getSendingConfig(locationId) {
  const config = await whatsappConfigRepo.findActiveForSending(locationId);
  if (!config || config.locationStatus !== 1 || config.brandStatus !== 1) return null;
  const { authSecretEnc, ...rest } = config;
  return { ...rest, authKey: decryptSecret(authSecretEnc) };
}

/** HTTP headers for a config returned by getSendingConfig. */
export function authHeadersFor(config) {
  switch (config.authType) {
    case "bearer":
      return { Authorization: `Bearer ${config.authKey}` };
    case "api_key":
      return { [config.authHeader]: config.authKey };
    case "basic":
      return { Authorization: `Basic ${Buffer.from(`${config.authUsername}:${config.authKey}`).toString("base64")}` };
    default:
      return {};
  }
}
