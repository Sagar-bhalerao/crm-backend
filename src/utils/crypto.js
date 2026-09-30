import crypto from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

/**
 * Encryption for stored credentials (SMTP passwords, WhatsApp auth keys).
 *
 * AES-256-GCM with a key from CONFIG_SECRET_KEY (32 random bytes, base64).
 * Stored format: "v1:<iv>:<authTag>:<ciphertext>", all base64.
 *
 * If the key is lost or changed, saved secrets cannot be read back and have
 * to be entered again, so keep CONFIG_SECRET_KEY with the other production secrets.
 */
const ALGORITHM = "aes-256-gcm";
let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const key = env.configSecretKey ? Buffer.from(env.configSecretKey, "base64") : null;
  if (!key || key.length !== 32) {
    throw new ApiError(
      500,
      "Credential encryption is not set up on the server. Set CONFIG_SECRET_KEY to 32 random bytes in base64.",
      null,
      "CONFIG_KEY_MISSING"
    );
  }
  cachedKey = key;
  return key;
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(payload) {
  if (!payload) return null;
  const [version, iv, tag, data] = String(payload).split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Stored secret is in an unknown format.");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** Last 4 characters, shown as "ends in ..." on screen. Nothing for short secrets. */
export function secretHint(plain) {
  const s = String(plain || "");
  return s.length >= 8 ? s.slice(-4) : null;
}
