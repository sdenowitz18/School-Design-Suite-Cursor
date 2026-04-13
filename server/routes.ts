import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getDbEnvInfo, getPool } from "./db";
import { seedDefaultComponentsIfEmpty } from "./seed-defaults";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/health", async (_req, res) => {
    const info = getDbEnvInfo();
    try {
      const pool = getPool();
      const r = await pool.query("select 1 as ok");
      return res.json({
        ok: true,
        db: { ok: r?.rows?.[0]?.ok === 1, wantsSsl: info.wantsSsl },
        env: info.env,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        db: { ok: false, error: String(err?.message || err), wantsSsl: info.wantsSsl },
        env: info.env,
      });
    }
  });

  app.get("/api/components", async (_req, res) => {
    const components = await storage.getComponents();
    res.json(components);
  });

  app.get("/api/components/:nodeId", async (req, res) => {
    const component = await storage.getComponentByNodeId(req.params.nodeId);
    if (!component) {
      return res.status(404).json({ message: "Component not found" });
    }
    res.json(component);
  });

  app.post("/api/components", async (req, res) => {
    const component = await storage.createComponent(req.body);
    res.status(201).json(component);
  });

  app.patch("/api/components/:nodeId", async (req, res) => {
    const nodeId = req.params.nodeId;
    const body = req.body as Record<string, unknown>;
    let updated = await storage.updateComponent(nodeId, req.body);
    if (!updated) {
      // Create row if missing (e.g. canvas showed fallback nodes before DB seed, or first edit after empty DB).
      const created = await storage.createComponent({
        nodeId,
        title: typeof body.title === "string" ? body.title : nodeId,
        subtitle: typeof body.subtitle === "string" ? body.subtitle : "",
        color: typeof body.color === "string" ? body.color : "bg-emerald-100",
        canvasX: typeof body.canvasX === "number" ? body.canvasX : 600,
        canvasY: typeof body.canvasY === "number" ? body.canvasY : 100,
        snapshotData: (body.snapshotData as object) ?? {},
        designedExperienceData: (body.designedExperienceData as object) ?? {},
        healthData: (body.healthData as object) ?? {},
      });
      return res.status(201).json(created);
    }
    res.json(updated);
  });

  app.delete("/api/components/:nodeId", async (req, res) => {
    const deleted = await storage.deleteComponent(req.params.nodeId);
    if (!deleted) {
      return res.status(404).json({ message: "Component not found" });
    }
    res.json({ success: true });
  });

  app.post("/api/seed", async (_req, res) => {
    try {
      const result = await seedDefaultComponentsIfEmpty();
      res.status(result.message === "Seeded" ? 201 : 200).json(result);
    } catch (err: any) {
      res.status(500).json({ message: String(err?.message || err) });
    }
  });

  return httpServer;
}
