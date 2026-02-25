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

async function readJsonBody(req: any): Promise<any> {
  const method = String(req?.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
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

export default async function handler(req: any, res: any) {
  const method = String(req?.method || "GET").toUpperCase();

  try {
    if (method === "GET") {
      const pool = await getPool();
      const r = await pool.query("select * from components");
      const components = r.rows || [];
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(components));
    }

    if (method === "POST") {
      const body = await readJsonBody(req);
      const pool = await getPool();
      const row = body || {};
      const q =
        "insert into components (node_id,title,subtitle,color,canvas_x,canvas_y,snapshot_data,designed_experience_data,health_data) " +
        "values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb) returning *";
      const values = [
        String(row.nodeId || ""),
        String(row.title || ""),
        String(row.subtitle || ""),
        String(row.color || "bg-emerald-100"),
        Number(row.canvasX || 0),
        Number(row.canvasY || 0),
        JSON.stringify(row.snapshotData || {}),
        JSON.stringify(row.designedExperienceData || {}),
        JSON.stringify(row.healthData || {}),
      ];
      const created = await pool.query(q, values);
      const component = created.rows?.[0];
      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(component));
    }

    res.statusCode = 405;
    return res.end("Method Not Allowed");
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: err?.message || "Internal Server Error" }));
  }
}

