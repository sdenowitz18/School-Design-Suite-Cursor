export default async function handler(_req: any, res: any) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({ ok: true, pong: true, ts: Date.now() }));
}

