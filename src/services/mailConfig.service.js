import * as mailConfigRepo from "../repositories/mailConfig.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { decryptSecret, encryptSecret, secretHint } from "../utils/crypto.js";
import { assertUsableLocation } from "./configLocation.service.js";

export const list = (query) => mailConfigRepo.findAll(query);

export async function getById(id) {
  const config = await mailConfigRepo.findById(id);
  if (!config) throw ApiError.notFound("That mail configuration does not exist.");
  return config;
}

async function assertLocationFree(locationId, excludeId = null) {
  const clash = await mailConfigRepo.findByLocation(locationId, excludeId);
  if (clash) {
    const message = `${clash.brandName} ${clash.locationName} already has a mail configuration. Edit that one instead.`;
    throw ApiError.conflict(message, [{ field: "locationId", message }]);
  }
}

const passwordColumns = (password) => ({
  smtpPasswordEnc: encryptSecret(password),
  smtpPasswordHint: secretHint(password),
});

export async function create(input) {
  const { smtpPassword, ...fields } = input;
  await assertUsableLocation(fields.locationId);
  await assertLocationFree(fields.locationId);
  return mailConfigRepo.insert({ ...fields, ...passwordColumns(smtpPassword) });
}

/** An empty or missing smtpPassword keeps the saved password. */
export async function update(id, changes) {
  const existing = await getById(id);
  const { smtpPassword, ...fields } = changes;

  const locationChanged = fields.locationId !== undefined && fields.locationId !== existing.locationId;
  if (locationChanged) {
    await assertUsableLocation(fields.locationId);
    await assertLocationFree(fields.locationId, id);
  } else if (fields.status === 1 && existing.status !== 1) {
    await assertUsableLocation(existing.locationId);
  }

  const password = smtpPassword ? passwordColumns(smtpPassword) : {};
  return mailConfigRepo.update(id, { ...fields, ...password });
}

export async function setStatus(id, status) {
  const config = await getById(id);
  if (config.status === status) return config;
  if (status === 1) await assertUsableLocation(config.locationId);
  return mailConfigRepo.update(id, { status });
}

/** Nothing else points at a configuration, so it can always be deleted. */
export async function remove(id) {
  await getById(id);
  await mailConfigRepo.remove(id);
  return { id, deleted: true };
}

/**
 * For the code that sends email. Returns the active configuration for a
 * location with the password decrypted, or null when there is none (or its
 * location or brand is inactive). Only active configurations are ever used.
 * Never return this from an API endpoint.
 */
export async function getSendingConfig(locationId) {
  const config = await mailConfigRepo.findActiveForSending(locationId);
  if (!config || config.locationStatus !== 1 || config.brandStatus !== 1) return null;
  const { smtpPasswordEnc, ...rest } = config;
  return { ...rest, smtpPassword: decryptSecret(smtpPasswordEnc) };
}
