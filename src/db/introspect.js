import { query } from "../config/database.js";

/**
 * Tables in the public schema.
 * Reads pg_catalog rather than information_schema, because
 * information_schema hides tables the connected user has no rights on.
 */
export async function listTables() {
  const { rows } = await query(
    `SELECT c.relname AS table_name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`
  );
  return rows.map((r) => r.table_name);
}

/** Columns of one table: name, type, nullable, default. */
export async function getColumns(table) {
  const { rows } = await query(
    `SELECT a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
            pg_get_expr(d.adbin, d.adrelid) AS column_default
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [table]
  );
  return rows;
}

/**
 * Find which of several possible names an existing table uses
 * (e.g. "brands" or "brand"), so we work with what is already there.
 */
export async function resolveTable(candidates) {
  const existing = await listTables();
  const lower = new Map(existing.map((t) => [t.toLowerCase(), t]));
  for (const candidate of candidates) {
    const hit = lower.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return null;
}
