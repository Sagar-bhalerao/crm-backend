import { query } from "../config/database.js";
import { TABLES } from "../config/tables.js";

/**
 * Global settings, stored as key/value rows so a new setting needs no
 * migration. Values are JSON text.
 */
export async function findAll() {
  const { rows } = await query(`SELECT key, value, updated_date FROM "app_settings"`);
  const out = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return { values: out, updatedAt: rows.reduce((a, r) => (!a || r.updated_date > a ? r.updated_date : a), null) };
}

/** Upserts only the keys given. */
export async function saveMany(entries) {
  for (const [key, value] of Object.entries(entries)) {
    await query(
      `INSERT INTO "${TABLES.settings}" (key, value, updated_date) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()`,
      [key, JSON.stringify(value)]
    );
  }
  return findAll();
}
