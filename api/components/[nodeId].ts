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
  const nodeId = String(req?.query?.nodeId || req?.query?.["nodeId"] || "").trim();

  if (!nodeId) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: "Missing nodeId" }));
  }

  try {
    if (method === "GET") {
      const pool = await getPool();
      const r = await pool.query("select * from components where node_id = $1 limit 1", [nodeId]);
      const component = r.rows?.[0];
      if (!component) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ message: "Component not found" }));
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(component));
    }

    if (method === "PATCH") {
      const body = (await readJsonBody(req)) || {};
      const data = body || {};
      const pool = await getPool();

      const sets: string[] = [];
      const values: any[] = [];
      let idx = 1;

      const setText = (col: string, val: any) => {
        sets.push(`${col} = $${idx++}`);
        values.push(val);
      };
      const setJsonb = (col: string, val: any) => {
        sets.push(`${col} = $${idx++}::jsonb`);
        values.push(JSON.stringify(val ?? {}));
      };
      const setInt = (col: string, val: any) => {
        sets.push(`${col} = $${idx++}`);
        values.push(Number(val ?? 0));
      };

      if ("title" in data) setText("title", String(data.title ?? ""));
      if ("subtitle" in data) setText("subtitle", String(data.subtitle ?? ""));
      if ("color" in data) setText("color", String(data.color ?? ""));
      if ("canvasX" in data) setInt("canvas_x", data.canvasX);
      if ("canvasY" in data) setInt("canvas_y", data.canvasY);
      if ("snapshotData" in data) setJsonb("snapshot_data", data.snapshotData);
      if ("designedExperienceData" in data) setJsonb("designed_experience_data", data.designedExperienceData);
      if ("healthData" in data) setJsonb("health_data", data.healthData);

      if (sets.length === 0) {
        // no-op update, return current row
        const r0 = await pool.query("select * from components where node_id = $1 limit 1", [nodeId]);
        const current = r0.rows?.[0];
        if (!current) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ message: "Component not found" }));
        }
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify(current));
      }

      values.push(nodeId);
      const q = `update components set ${sets.join(", ")} where node_id = $${idx} returning *`;
      const updatedRow = await pool.query(q, values);
      const updated = updatedRow.rows?.[0];
      if (!updated) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ message: "Component not found" }));
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(updated));
    }

    if (method === "DELETE") {
      const pool = await getPool();
      const r = await pool.query("delete from components where node_id = $1 returning node_id", [nodeId]);
      const deleted = (r.rows || []).length > 0;
      if (!deleted) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ message: "Component not found" }));
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ success: true }));
    }

    res.statusCode = 405;
    return res.end("Method Not Allowed");
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: err?.message || "Internal Server Error" }));
  }
}

