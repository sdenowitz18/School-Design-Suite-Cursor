export const config = {
  runtime: "nodejs",
};

function getDbEnvInfo() {
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

async function getPool() {
  const info = getDbEnvInfo();
  if (!info.connectionString) {
    throw new Error("Missing database env var (DATABASE_URL or POSTGRES_URL).");
  }
  const pgMod: any = await import("pg");
  const PoolCtor = pgMod?.Pool;
  if (!PoolCtor) throw new Error("Failed to load pg Pool.");
  return new PoolCtor({
    connectionString: info.connectionString,
    ssl: info.wantsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export default async function handler(req: any, res: any) {
  if (req?.method && String(req.method).toUpperCase() !== "GET") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  const info = getDbEnvInfo();
  try {
    const pool = await getPool();
    const r = await pool.query("select 1 as ok");
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        ok: true,
        db: { ok: r?.rows?.[0]?.ok === 1, wantsSsl: info.wantsSsl },
        env: info.env,
      }),
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        ok: false,
        db: { ok: false, error: String(err?.message || err), wantsSsl: info.wantsSsl },
        env: info.env,
      }),
    );
  }
}

