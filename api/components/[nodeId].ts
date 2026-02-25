import { storage } from "../../server/storage";

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
      const component = await storage.getComponentByNodeId(nodeId);
      if (!component) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ message: "Component not found" }));
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(component));
    }

    if (method === "PATCH") {
      const updated = await storage.updateComponent(nodeId, req.body);
      if (!updated) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ message: "Component not found" }));
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(updated));
    }

    if (method === "DELETE") {
      const deleted = await storage.deleteComponent(nodeId);
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

