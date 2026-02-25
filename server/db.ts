import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export function getDbEnvInfo() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    process.env.DRIZZLE_DATABASE_URL;

  const sslMode = process.env.PGSSLMODE || process.env.POSTGRES_SSLMODE;
  const wantsSsl =
    String(sslMode || "").toLowerCase() === "require" ||
    String(sslMode || "").toLowerCase() === "prefer" ||
    (connectionString ? /sslmode=/i.test(connectionString) : false) ||
    (connectionString ? /neon\.tech/i.test(connectionString) : false);

  return {
    connectionString,
    wantsSsl,
    env: {
      VERCEL: !!process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV || "",
      HAS_DATABASE_URL: !!process.env.DATABASE_URL,
      HAS_POSTGRES_URL: !!process.env.POSTGRES_URL,
      HAS_POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
      HAS_NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL,
      HAS_DRIZZLE_DATABASE_URL: !!process.env.DRIZZLE_DATABASE_URL,
      PGSSLMODE: process.env.PGSSLMODE || process.env.POSTGRES_SSLMODE || "",
    },
  };
}

const globalForPg = globalThis as unknown as { __pgPool?: Pool; __pgPoolConnKey?: string };

export function getPool(): Pool {
  const info = getDbEnvInfo();
  if (!info.connectionString) {
    throw new Error(
      "Missing database connection string env var (DATABASE_URL or POSTGRES_URL). Configure it in Vercel Project → Settings → Environment Variables.",
    );
  }

  const connKey = `${info.connectionString}::ssl=${info.wantsSsl ? "1" : "0"}`;
  if (!globalForPg.__pgPool || globalForPg.__pgPoolConnKey !== connKey) {
    globalForPg.__pgPool = new Pool({
      connectionString: info.connectionString,
      ssl: info.wantsSsl ? { rejectUnauthorized: false } : undefined,
    });
    globalForPg.__pgPoolConnKey = connKey;
  }
  return globalForPg.__pgPool;
}

export function getDb() {
  const pool = getPool();
  return drizzle(pool, { schema });
}
