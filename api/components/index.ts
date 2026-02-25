import { storage } from "../../server/storage";

export default async function handler(req: any, res: any) {
  const method = String(req?.method || "GET").toUpperCase();

  try {
    if (method === "GET") {
      const components = await storage.getComponents();
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(components));
    }

    if (method === "POST") {
      const component = await storage.createComponent(req.body);
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

