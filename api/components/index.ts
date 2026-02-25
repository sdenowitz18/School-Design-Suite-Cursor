import { getPool, readJsonBody } from "../_db";

export default async function handler(req: any, res: any) {
  const method = String(req?.method || "GET").toUpperCase();

  try {
    if (method === "GET") {
      const pool = getPool();
      const r = await pool.query("select * from components");
      const components = r.rows || [];
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(components));
    }

    if (method === "POST") {
      const body = await readJsonBody(req);
      const pool = getPool();
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

