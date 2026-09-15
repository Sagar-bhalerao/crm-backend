import { app } from "./app.js";
import { checkConnection, closePool } from "./config/database.js";
import { env } from "./config/env.js";
import { findBlockingColumns, initTables, TABLES } from "./config/tables.js";
import { runMigrations } from "./db/migrate.js";

async function start() {
  try {
    const info = await checkConnection();
    console.log(`PostgreSQL connected: ${info.db} on ${env.db.host}:${env.db.port}`);
  } catch (err) {
    console.error(`Cannot connect to PostgreSQL (${env.db.host}:${env.db.port}/${env.db.database}): ${err.message}`);
    console.error("Check the DB_* values in your .env file and that the PostgreSQL service is running.");
    process.exit(1);
  }

  if (env.autoMigrate) await runMigrations();
  else await initTables();

  // Warn instead of failing on the first insert if the existing tables have
  // extra required columns this API does not know about.
  for (const key of ["brands", "locations"]) {
    const blocking = await findBlockingColumns(key);
    if (blocking.length) {
      console.warn(
        `Warning: "${TABLES[key]}" has required column(s) this API does not set: ${blocking.join(", ")}.\n` +
          "         Give them a default in pgAdmin, or make them nullable, otherwise inserts will fail."
      );
    }
  }

  const server = app.listen(env.port, () => {
    console.log(`API ready on http://localhost:${env.port}/api/v1 (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
