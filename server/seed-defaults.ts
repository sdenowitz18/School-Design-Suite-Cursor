import type { Component, InsertComponent } from "../shared/schema";
import { storage } from "./storage";

/**
 * Default canvas when the DB has no rows (same as POST /api/seed).
 * Only the school (overall) node — ring components are added via the module library / API.
 */
export const DEFAULT_COMPONENT_SEEDS: InsertComponent[] = [
  {
    nodeId: "overall",
    title: "Overall School",
    subtitle: "Key Levers",
    color: "bg-white",
    canvasX: 600,
    canvasY: 300,
    snapshotData: {},
    designedExperienceData: {},
    healthData: {},
  },
];

export async function seedDefaultComponentsIfEmpty(): Promise<{
  message: string;
  components: Component[];
}> {
  const existing = await storage.getComponents();
  if (existing.length > 0) {
    return { message: "Already seeded", components: existing };
  }
  const created: Component[] = [];
  for (const row of DEFAULT_COMPONENT_SEEDS) {
    created.push(await storage.createComponent(row));
  }
  return { message: "Seeded", components: created };
}
