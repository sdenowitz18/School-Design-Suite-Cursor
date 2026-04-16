import { DEFAULT_COMPONENT_SEEDS } from "../server/seed-defaults";

export const config = {
  runtime: "nodejs",
};

async function getPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    process.env.DRIZZLE_DATABASE_URL;
  if (!connectionString) throw new Error("Missing database env var (DATABASE_URL or POSTGRES_URL).");
  const sslMode = process.env.PGSSLMODE || process.env.POSTGRES_SSLMODE;
  const wantsSsl =
    String(sslMode || "").toLowerCase() === "require" ||
    String(sslMode || "").toLowerCase() === "prefer" ||
    /sslmode=/i.test(connectionString) ||
    /neon\.tech/i.test(connectionString);
  const pgMod: any = await import("pg");
  const PoolCtor = pgMod?.Pool;
  if (!PoolCtor) throw new Error("Failed to load pg Pool.");
  return new PoolCtor({
    connectionString,
    ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export default async function handler(req: any, res: any) {
  const method = String(req?.method || "POST").toUpperCase();
  if (method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  try {
    const pool = await getPool();
    const existing = await pool.query("select node_id from components limit 1");
    if ((existing.rows || []).length > 0) {
      res.setHeader("Content-Type", "application/json");
      const all = await pool.query("select * from components");
      return res.end(JSON.stringify({ message: "Already seeded", components: all.rows || [] }));
    }

    const created = [];
    for (const comp of DEFAULT_COMPONENT_SEEDS) {
      const q =
        "insert into components (node_id,title,subtitle,color,canvas_x,canvas_y,snapshot_data,designed_experience_data,health_data) " +
        "values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb) returning *";
      const values = [
        String((comp as any).nodeId),
        String((comp as any).title),
        String((comp as any).subtitle || ""),
        String((comp as any).color || "bg-emerald-100"),
        Number((comp as any).canvasX || 0),
        Number((comp as any).canvasY || 0),
        JSON.stringify((comp as any).snapshotData || {}),
        JSON.stringify((comp as any).designedExperienceData || {}),
        JSON.stringify((comp as any).healthData || {}),
      ];
      const r = await pool.query(q, values);
      created.push(r.rows?.[0]);
    }

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: "Seeded", components: created }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: err?.message || "Internal Server Error" }));
  }
}

