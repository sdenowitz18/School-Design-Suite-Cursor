import { getDbEnvInfo, getPool } from "./_db";

export default async function handler(req: any, res: any) {
  if (req?.method && String(req.method).toUpperCase() !== "GET") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  const info = getDbEnvInfo();
  try {
    const pool = getPool();
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

