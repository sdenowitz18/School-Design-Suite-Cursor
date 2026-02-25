import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.NEON_DATABASE_URL ||
  process.env.DRIZZLE_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Database connection string must be set (DATABASE_URL or POSTGRES_URL). Did you forget to configure Vercel/Neon env vars?",
  );
}

const sslMode = process.env.PGSSLMODE || process.env.POSTGRES_SSLMODE;
const wantsSsl =
  String(sslMode || "").toLowerCase() === "require" ||
  String(sslMode || "").toLowerCase() === "prefer" ||
  /sslmode=/i.test(connectionString) ||
  /neon\.tech/i.test(connectionString);

const globalForPg = globalThis as unknown as { __pgPool?: Pool };
export const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString,
    ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
  });
globalForPg.__pgPool = pool;
export const db = drizzle(pool, { schema });
