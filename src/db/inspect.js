/**
 * Prints the current database structure. Run this before migrating:
 *   npm run db:inspect
 */
import { checkConnection, closePool } from "../config/database.js";
import { getColumns, listTables } from "./introspect.js";

const info = await checkConnection();
console.log(`Connected to "${info.db}"\n${info.version.split(",")[0]}\n`);

const tables = await listTables();
if (tables.length === 0) {
  console.log("No tables yet in schema 'public'.");
} else {
  for (const table of tables) {
    console.log(`\n${table}`);
    for (const c of await getColumns(table)) {
      const nullable = c.is_nullable === "YES" ? "null" : "not null";
      const def = c.column_default ? `, default ${c.column_default}` : "";
      console.log(`  ${c.column_name.padEnd(20)} ${c.data_type} (${nullable}${def})`);
    }
  }
}
await closePool();
