import { getColumns, resolveTable } from "../db/introspect.js";

/**
 * Which physical tables this API reads and writes.
 *
 * The database was created before this API existed, so the table may be
 * called "brands" or "brand". We look it up once at startup and every
 * repository uses the resolved name from here.
 */
export const TABLES = { brands: "brands", locations: "locations", settings: "app_settings" };

/** Canonical columns. Anything missing is added by the migration. */
export const COLUMNS = {
  brands: ["id", "name", "code", "description", "logo_url", "status", "created_at", "updated_at"],
  locations: [
    "id", "brand_id", "name", "code", "city", "state", "address",
    "pincode", "contact_number", "email", "status", "created_at", "updated_at",
  ],
};

/** Resolve the real table names. Called once when the server boots. */
export async function initTables() {
  TABLES.brands = (await resolveTable(["brands", "brand"])) || "brands";
  TABLES.locations = (await resolveTable(["locations", "location"])) || "locations";
  TABLES.settings = (await resolveTable(["app_settings", "settings"])) || "app_settings";
  return TABLES;
}

/**
 * Columns the table has that we do not write to and that would block an
 * INSERT (NOT NULL with no default). Reported at startup so the mismatch is
 * visible instead of failing on the first create.
 */
export async function findBlockingColumns(key) {
  const cols = await getColumns(TABLES[key]);
  return cols
    .filter((c) => !COLUMNS[key].includes(c.column_name) && c.is_nullable === "NO" && !c.column_default)
    .map((c) => c.column_name);
}
