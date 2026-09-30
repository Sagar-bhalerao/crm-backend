/**
 * Creates the WhatsApp and mail configuration tables.
 *
 *   npm run db:migrate:config
 *
 * Safe to run repeatedly: everything is "create if missing". It never drops or
 * changes existing tables or rows, and it does not touch brand or location.
 *
 * This is separate from db:migrate on purpose: migrate.js was written for a
 * "brands"/"locations" schema with columns like name and created_at, and
 * running it against this database would add unused duplicate columns.
 */
import { closePool, query } from "../config/database.js";
import { env } from "../config/env.js";

const log = [];
const note = (msg) => { log.push(msg); console.log(`  ${msg}`); };

async function tableExists(name) {
  const { rows } = await query(`SELECT to_regclass($1) AS t`, [`public.${name}`]);
  return rows[0].t !== null;
}

async function constraintExists(name) {
  const { rows } = await query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [name]);
  return rows.length > 0;
}

/**
 * Link a config table to location. If deleting a location, its configs go
 * with it: a WhatsApp or mail setup for an outlet that no longer exists is
 * meaningless. Needs location.id to be a primary key; if it is not, the
 * tables still work and the reason is printed.
 */
async function linkToLocation(table) {
  const name = `${table}_location_id_fkey`;
  if (await constraintExists(name)) return;
  try {
    await query(
      `ALTER TABLE ${table}
         ADD CONSTRAINT ${name} FOREIGN KEY (location_id) REFERENCES "location" (id) ON DELETE CASCADE`
    );
    note(`linked ${table}.location_id to location.id`);
  } catch (err) {
    note(`WARNING: could not link ${table}.location_id to location.id (${err.message}). The app still checks locations itself.`);
  }
}

export async function runConfigMigrations() {
  console.log("Checking configuration tables...");

  if (!(await tableExists("whatsapp_config"))) {
    await query(`
      CREATE TABLE whatsapp_config (
        id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        location_id      INTEGER      NOT NULL,
        api_provider     VARCHAR(60)  NOT NULL,
        api_url          VARCHAR(500) NOT NULL,
        auth_type        VARCHAR(20)  NOT NULL DEFAULT 'bearer',
        auth_header      VARCHAR(60),
        auth_username    VARCHAR(150),
        auth_secret_enc  TEXT,
        auth_secret_hint VARCHAR(8),
        message_body     TEXT         NOT NULL,
        status           SMALLINT     NOT NULL DEFAULT 1,
        created_date     TIMESTAMP    NOT NULL DEFAULT now(),
        updated_date     TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT whatsapp_config_auth_type_check CHECK (auth_type IN ('bearer', 'api_key', 'basic', 'none')),
        CONSTRAINT whatsapp_config_secret_check CHECK (auth_type = 'none' OR auth_secret_enc IS NOT NULL),
        CONSTRAINT whatsapp_config_status_check CHECK (status IN (0, 1))
      )`);
    note("created table whatsapp_config");
  }
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_config_location_unique_idx ON whatsapp_config (location_id)`);
  await linkToLocation("whatsapp_config");

  if (!(await tableExists("mail_config"))) {
    await query(`
      CREATE TABLE mail_config (
        id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        location_id        INTEGER      NOT NULL,
        smtp_host          VARCHAR(255) NOT NULL,
        smtp_port          INTEGER      NOT NULL,
        smtp_username      VARCHAR(255) NOT NULL,
        smtp_password_enc  TEXT         NOT NULL,
        smtp_password_hint VARCHAR(8),
        smtp_security      VARCHAR(10)  NOT NULL DEFAULT 'starttls',
        from_email         VARCHAR(150) NOT NULL,
        from_name          VARCHAR(120) NOT NULL,
        reply_to_email     VARCHAR(150),
        reply_to_name      VARCHAR(120),
        subject            VARCHAR(255) NOT NULL,
        body               TEXT         NOT NULL,
        status             SMALLINT     NOT NULL DEFAULT 1,
        created_date       TIMESTAMP    NOT NULL DEFAULT now(),
        updated_date       TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT mail_config_port_check CHECK (smtp_port BETWEEN 1 AND 65535),
        CONSTRAINT mail_config_security_check CHECK (smtp_security IN ('ssl', 'starttls', 'none')),
        CONSTRAINT mail_config_status_check CHECK (status IN (0, 1))
      )`);
    note("created table mail_config");
  }
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS mail_config_location_unique_idx ON mail_config (location_id)`);
  await linkToLocation("mail_config");

  // The Configuration page now holds these two modules, so the permission
  // labels on the Roles screen should say so. Keys stay the same.
  const { rowCount } = await query(
    `UPDATE permissions SET label = CASE key
        WHEN 'settings.view' THEN 'View WhatsApp and mail configuration'
        WHEN 'settings.manage' THEN 'Manage WhatsApp and mail configuration'
      END
      WHERE key IN ('settings.view', 'settings.manage')
        AND label NOT IN ('View WhatsApp and mail configuration', 'Manage WhatsApp and mail configuration')`
  );
  if (rowCount) note(`relabelled ${rowCount} configuration permission(s)`);

  if (log.length === 0) console.log("  Configuration tables are already up to date.");
  return log;
}

// Allow running this file directly: node src/db/migrate-config.js
if (process.argv[1] && process.argv[1].endsWith("migrate-config.js")) {
  try {
    console.log(`Database: ${env.db.database} on ${env.db.host}:${env.db.port}`);
    await runConfigMigrations();
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
