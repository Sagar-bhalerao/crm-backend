import { z } from "zod";
import { optionalText, pageQuery, statusEnum } from "./common.validator.js";

/**
 * Pieces shared by the WhatsApp and mail configuration validators.
 *
 * Update schemas wrap every field in .optional() so a field that is not sent
 * stays out of the parsed body. (optionalText on its own turns a missing
 * field into null, which would wipe it on a partial update.)
 */

/** "" from a cleared filter means "no filter". */
const optionalId = z
  .literal("")
  .or(z.coerce.number().int().positive())
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const configListQuery = {
  ...pageQuery,
  brandId: optionalId,
  locationId: optionalId,
  sort: z.string().trim().optional(),
};

export const locationId = z.coerce
  .number({ message: "Choose a location" })
  .int("Choose a location")
  .positive("Choose a location");

export const httpUrl = (label, max = 500) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .regex(/^https?:\/\/\S+$/i, `Enter the full ${label}, starting with https://`);

/** A secret as typed. On update, empty means "keep the saved one". */
export const secretInput = (label, max = 2000) => z.string().trim().max(max, `${label} is too long`);

export { optionalText, statusEnum };
