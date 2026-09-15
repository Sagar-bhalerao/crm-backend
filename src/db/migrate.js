/**
 * Brings the database up to what the API needs, without touching data.
 *
 *   npm run db:migrate
 *
 * It is safe to run repeatedly: everything is "create if missing" or
 * "add column if missing". It never drops a table, column or row.
 */
import { closePool, query } from "../config/database.js";
import { env } from "../config/env.js";
import { initTables, TABLES } from "../config/tables.js";
import { getColumns, resolveTable } from "./introspect.js";

const log = [];
const note = (msg) => { log.push(msg); console.log(`  ${msg}`); };

const BRAND_COLUMNS = [
  ["name", "VARCHAR(120)"],
  ["code", "VARCHAR(20)"],
  ["description", "TEXT"],
  ["logo_url", "TEXT"],
  ["status", "VARCHAR(20) NOT NULL DEFAULT 'active'"],
  ["created_at", "TIMESTAMPTZ NOT NULL DEFAULT now()"],
  ["updated_at", "TIMESTAMPTZ NOT NULL DEFAULT now()"],
];

const LOCATION_COLUMNS = [
  ["brand_id", "INTEGER"],
  ["name", "VARCHAR(120)"],
  ["code", "VARCHAR(30)"],
  ["city", "VARCHAR(80)"],
  ["state", "VARCHAR(80)"],
  ["address", "TEXT"],
  ["pincode", "VARCHAR(10)"],
  ["contact_number", "VARCHAR(20)"],
  ["email", "VARCHAR(150)"],
  ["status", "VARCHAR(20) NOT NULL DEFAULT 'active'"],
  ["created_at", "TIMESTAMPTZ NOT NULL DEFAULT now()"],
  ["updated_at", "TIMESTAMPTZ NOT NULL DEFAULT now()"],
];

async function addMissingColumns(table, columns) {
  const existing = new Set((await getColumns(table)).map((c) => c.column_name));
  for (const [name, type] of columns) {
    if (!existing.has(name)) {
      await query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${name} ${type}`);
      note(`${table}: added column ${name}`);
    }
  }
  return existing;
}

/** If the table already had an is_active flag, mirror it into status once. */
async function backfillStatus(table, hadColumns) {
  if (hadColumns.has("status") || !hadColumns.has("is_active")) return;
  await query(`UPDATE "${table}" SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END`);
  note(`${table}: filled status from the existing is_active column`);
}

async function ensureIndex(name, sql) {
  const { rows } = await query(`SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`, [name]);
  if (rows.length === 0) {
    await query(sql);
    note(`created index ${name}`);
  }
}

export async function runMigrations() {
  console.log("Checking database schema...");
  await initTables();

  // ---- brands -----------------------------------------------------------
  const brandsExisted = await resolveTable(["brands", "brand"]);
  if (!brandsExisted) {
    await query(`
      CREATE TABLE brands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        code VARCHAR(20) NOT NULL,
        description TEXT,
        logo_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    note("created table brands");
  } else {
    const had = await addMissingColumns(TABLES.brands, BRAND_COLUMNS);
    await backfillStatus(TABLES.brands, had);
  }
  await ensureIndex("brands_code_unique_idx", `CREATE UNIQUE INDEX brands_code_unique_idx ON "${TABLES.brands}" (UPPER(code))`);

  // ---- locations --------------------------------------------------------
  const locationsExisted = await resolveTable(["locations", "location"]);
  if (!locationsExisted) {
    await query(`
      CREATE TABLE locations (
        id SERIAL PRIMARY KEY,
        brand_id INTEGER NOT NULL REFERENCES "${TABLES.brands}" (id),
        name VARCHAR(120) NOT NULL,
        code VARCHAR(30) NOT NULL,
        city VARCHAR(80),
        state VARCHAR(80),
        address TEXT,
        pincode VARCHAR(10),
        contact_number VARCHAR(20),
        email VARCHAR(150),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    note("created table locations");
  } else {
    const had = await addMissingColumns(TABLES.locations, LOCATION_COLUMNS);
    await backfillStatus(TABLES.locations, had);
  }
  await ensureIndex("locations_code_unique_idx", `CREATE UNIQUE INDEX locations_code_unique_idx ON "${TABLES.locations}" (UPPER(code))`);
  await ensureIndex("locations_brand_id_idx", `CREATE INDEX locations_brand_id_idx ON "${TABLES.locations}" (brand_id)`);

  // ---- relationship ------------------------------------------------------
  const { rows: fks } = await query(
    `SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = $1 AND constraint_type = 'FOREIGN KEY'`,
    [TABLES.locations]
  );
  if (fks.length === 0) {
    const { rows: orphans } = await query(
      `SELECT count(*)::int AS n FROM "${TABLES.locations}" l
        WHERE l.brand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "${TABLES.brands}" b WHERE b.id = l.brand_id)`
    );
    if (orphans[0].n > 0) {
      note(`skipped the brand_id foreign key: ${orphans[0].n} location row(s) point at a brand that does not exist`);
    } else {
      await query(
        `ALTER TABLE "${TABLES.locations}"
           ADD CONSTRAINT locations_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES "${TABLES.brands}" (id)`
      );
      note("linked locations.brand_id to brands.id");
    }
  }

  if (log.length === 0) console.log("  Schema is already up to date.");
  console.log(`Using tables: ${TABLES.brands}, ${TABLES.locations}\n`);
  return log;
}

// Allow running this file directly: node src/db/migrate.js
if (process.argv[1] && process.argv[1].endsWith("migrate.js")) {
  try {
    console.log(`Database: ${env.db.database} on ${env.db.host}:${env.db.port}`);
    await runMigrations();
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
