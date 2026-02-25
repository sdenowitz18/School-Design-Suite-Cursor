"use client";

export function normOutcomeKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export type OutcomeOriginComponent = { nodeId: string; title: string };
export type OutcomeOriginSubcomponent = { id: string; name: string; priority: "H" | "M" | "L" };

function levelToPriority(level: unknown): "H" | "M" | "L" {
  if (level === "High") return "H";
  if (level === "Low") return "L";
  return "M";
}

export function listTopLevelOutcomeLabels(component: any): string[] {
  const aims: any[] = component?.designedExperienceData?.keyDesignElements?.aims || [];
  const out: string[] = [];
  for (const a of Array.isArray(aims) ? aims : []) {
    if (a?.type !== "outcome") continue;
    const label = String(a?.label ?? "").trim();
    if (!label) continue;
    out.push(label);
  }
  return out;
}

export function buildOutcomeUsageIndexFromComponents(components: any[]): Map<string, { label: string; components: OutcomeOriginComponent[] }> {
  const byKey = new Map<string, { label: string; componentsByNodeId: Map<string, OutcomeOriginComponent> }>();

  for (const comp of Array.isArray(components) ? components : []) {
    const nodeId = String(comp?.nodeId || comp?.node_id || comp?.id || "");
    if (!nodeId) continue;
    const title = String(comp?.title || comp?.name || nodeId || "Untitled");
    for (const label of listTopLevelOutcomeLabels(comp)) {
      const key = normOutcomeKey(label);
      if (!key) continue;
      const cur = byKey.get(key) || { label, componentsByNodeId: new Map<string, OutcomeOriginComponent>() };
      cur.label = label; // keep most recent clean label
      cur.componentsByNodeId.set(nodeId, { nodeId, title });
      byKey.set(key, cur);
    }
  }

  const out = new Map<string, { label: string; components: OutcomeOriginComponent[] }>();
  for (const [k, v] of Array.from(byKey.entries())) {
    const list = Array.from(v.componentsByNodeId.values()) as OutcomeOriginComponent[];
    list.sort((a, b) => a.title.localeCompare(b.title));
    out.set(k, { label: v.label, components: list });
  }
  return out;
}

export function buildSubcomponentOutcomeIndex(
  subcomponents: any[],
): Map<string, { label: string; subcomponents: OutcomeOriginSubcomponent[] }> {
  const byKey = new Map<string, { label: string; subsById: Map<string, OutcomeOriginSubcomponent> }>();
  for (const sub of Array.isArray(subcomponents) ? subcomponents : []) {
    const subId = String(sub?.id || "");
    const name = String(sub?.name || subId || "Subcomponent");
    const aims: any[] = sub?.aims || [];
    for (const a of Array.isArray(aims) ? aims : []) {
      if (a?.type !== "outcome") continue;
      const label = String(a?.label ?? "").trim();
      if (!label) continue;
      const key = normOutcomeKey(label);
      if (!key) continue;
      const cur = byKey.get(key) || { label, subsById: new Map<string, OutcomeOriginSubcomponent>() };
      cur.label = label;
      if (subId) cur.subsById.set(subId, { id: subId, name, priority: levelToPriority((a as any)?.level) });
      byKey.set(key, cur);
    }
  }

  const out = new Map<string, { label: string; subcomponents: OutcomeOriginSubcomponent[] }>();
  for (const [k, v] of Array.from(byKey.entries())) {
    const list = Array.from(v.subsById.values()) as OutcomeOriginSubcomponent[];
    list.sort((a, b) => a.name.localeCompare(b.name));
    out.set(k, { label: v.label, subcomponents: list });
  }
  return out;
}

