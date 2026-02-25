import { Pool } from "pg";

type DbEnvInfo = {
  connectionString?: string;
  wantsSsl: boolean;
  env: Record<string, unknown>;
};

export function getDbEnvInfo(): DbEnvInfo {
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

const globalForPg = globalThis as unknown as { __vercelPgPool?: Pool; __vercelPgPoolKey?: string };

export function getPool(): Pool {
  const info = getDbEnvInfo();
  if (!info.connectionString) {
    throw new Error(
      "Missing database env var. Set DATABASE_URL or POSTGRES_URL in Vercel Project → Settings → Environment Variables.",
    );
  }

  const key = `${info.connectionString}::ssl=${info.wantsSsl ? "1" : "0"}`;
  if (!globalForPg.__vercelPgPool || globalForPg.__vercelPgPoolKey !== key) {
    globalForPg.__vercelPgPool = new Pool({
      connectionString: info.connectionString,
      ssl: info.wantsSsl ? { rejectUnauthorized: false } : undefined,
    });
    globalForPg.__vercelPgPoolKey = key;
  }
  return globalForPg.__vercelPgPool;
}

export async function readJsonBody(req: any): Promise<any> {
  const method = String(req?.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  // Vercel does not guarantee req.body is parsed for Node functions.
  if (req?.body && typeof req.body === "object") return req.body;

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve());
    req.on("error", (e: any) => reject(e));
  });
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

