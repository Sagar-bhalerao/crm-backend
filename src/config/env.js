import "dotenv/config";

const required = ["DB_NAME", "DB_USER"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const bool = (v, fallback = false) => (v == null ? fallback : ["1", "true", "yes"].includes(String(v).toLowerCase()));

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 5000),
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    ssl: bool(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
  },
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
  autoMigrate: bool(process.env.AUTO_MIGRATE, true),
};
