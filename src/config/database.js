import pg from "pg";
import { env } from "./env.js";

/** One shared connection pool for the whole app. */
export const pool = new pg.Pool({ ...env.db, max: 10, idleTimeoutMillis: 30000 });

pool.on("error", (err) => console.error("Unexpected PostgreSQL pool error:", err.message));

/** Run a parameterised query. Always pass values as parameters, never string concatenation. */
export const query = (text, params) => pool.query(text, params);

/** Run several statements in one transaction. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function checkConnection() {
  const { rows } = await query("SELECT current_database() AS db, version() AS version");
  return rows[0];
}

export const closePool = () => pool.end();
