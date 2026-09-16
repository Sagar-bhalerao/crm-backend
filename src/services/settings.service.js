import * as settingsRepo from "../repositories/settings.repository.js";

/**
 * Defaults live here, so the API always returns a complete set even before
 * anything has been saved. A stored value overrides the default.
 */
export const DEFAULTS = {
  taxRate: 18,
  advancePercent: 50,
  quotationValidDays: 7,
  pageSize: 10,
  currency: "INR",
  leadResponseHours: 2,
};

export async function get() {
  const { values, updatedAt } = await settingsRepo.findAll();
  return { values: { ...DEFAULTS, ...values }, defaults: DEFAULTS, updatedAt };
}

export async function update(changes) {
  // Only keys we know about are stored, so a typo cannot create a stray row.
  const allowed = Object.fromEntries(Object.entries(changes).filter(([k]) => k in DEFAULTS));
  await settingsRepo.saveMany(allowed);
  return get();
}

/** Puts every value back to its default by clearing the saved ones. */
export async function reset() {
  await settingsRepo.saveMany(DEFAULTS);
  return get();
}
