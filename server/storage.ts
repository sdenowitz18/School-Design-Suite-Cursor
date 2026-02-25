import { type Component, type InsertComponent, components } from "../shared/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getComponents(): Promise<Component[]>;
  getComponentByNodeId(nodeId: string): Promise<Component | undefined>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(nodeId: string, data: Partial<InsertComponent>): Promise<Component | undefined>;
  deleteComponent(nodeId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getComponents(): Promise<Component[]> {
    const db = getDb();
    return await db.select().from(components);
  }

  async getComponentByNodeId(nodeId: string): Promise<Component | undefined> {
    const db = getDb();
    const [component] = await db.select().from(components).where(eq(components.nodeId, nodeId));
    return component;
  }

  async createComponent(component: InsertComponent): Promise<Component> {
    const db = getDb();
    const [created] = await db.insert(components).values(component).returning();
    return created;
  }

  async updateComponent(nodeId: string, data: Partial<InsertComponent>): Promise<Component | undefined> {
    const db = getDb();
    const [updated] = await db
      .update(components)
      .set(data)
      .where(eq(components.nodeId, nodeId))
      .returning();
    return updated;
  }

  async deleteComponent(nodeId: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(components).where(eq(components.nodeId, nodeId)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
