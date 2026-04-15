"use client";

import { isTargetingAimActive } from "@shared/aim-selection";

export type TargetAimType = "outcome" | "leap";
export type PriorityLevel = "H" | "M" | "L";
export type LevelMode = "auto" | "override";

export type TargetAim = {
  id?: string;
  type?: string;
  label?: string;
  level?: "High" | "Medium" | "Low" | null;
  computedLevel?: PriorityLevel | null;
  overrideLevel?: PriorityLevel | null;
  levelMode?: LevelMode;
  [key: string]: any;
};

export type TargetingScenario = {
  key: string;
  type: TargetAimType;
  label: string;
  intended: boolean;
  realized: boolean;
  computedLevel: PriorityLevel | null;
  resolvedLevel: PriorityLevel | null;
  levelMode: LevelMode;
  overrideLevel: PriorityLevel | null;
  realizationCount: number;
  realizedBy: string[];
  sourcePriorities?: { name: string; priority: PriorityLevel }[];
};

export function normTargetKey(type: TargetAimType, label: unknown): string {
  return `${type}:${String(label ?? "").trim().toLowerCase()}`;
}

export function levelToPriority(level: unknown): PriorityLevel {
  if (level === "High" || level === "H") return "H";
  if (level === "Low" || level === "L") return "L";
  return "M";
}

export function priorityToLevel(priority: PriorityLevel | null | undefined): "High" | "Medium" | "Low" | null {
  if (!priority) return null;
  if (priority === "H") return "High";
  if (priority === "L") return "Low";
  return "Medium";
}

function rank(priority: PriorityLevel): number {
  return priority === "H" ? 5 : priority === "M" ? 3 : 1;
}

function fromScore(score: number): PriorityLevel {
  if (score >= 4) return "H";
  if (score >= 2) return "M";
  return "L";
}

function downgrade(level: PriorityLevel): PriorityLevel {
  if (level === "H") return "M";
  if (level === "M") return "L";
  return "L";
}

function upgrade(level: PriorityLevel): PriorityLevel {
  if (level === "L") return "M";
  if (level === "M") return "H";
  return "H";
}

function listAimsByType(aims: unknown, type: TargetAimType): TargetAim[] {
  const list = Array.isArray(aims) ? aims : [];
  return list.filter((a: any) => {
    if (a?.type !== type || String(a?.label || "").trim().length === 0) return false;
    if (type === "leap") return isTargetingAimActive(a);
    return true;
  }) as TargetAim[];
}

function mapByKey(aims: TargetAim[], type: TargetAimType): Map<string, TargetAim> {
  const out = new Map<string, TargetAim>();
  for (const a of aims) {
    const label = String(a.label || "").trim();
    if (!label) continue;
    const key = normTargetKey(type, label);
    if (!out.has(key)) out.set(key, a);
  }
  return out;
}

export function rollupRingFromSubcomponents(
  subcomponents: unknown,
  type: TargetAimType,
): Map<string, { label: string; level: PriorityLevel; realizedBy: string[]; sourcePriorities: { name: string; priority: PriorityLevel }[] }> {
  const out = new Map<string, { label: string; level: PriorityLevel; realizedBy: string[]; sourcePriorities: { name: string; priority: PriorityLevel }[] }>();
  const subs = Array.isArray(subcomponents) ? subcomponents : [];
  for (const sub of subs) {
    const subName = String((sub as any)?.name || "Subcomponent").trim() || "Subcomponent";
    const aims = listAimsByType((sub as any)?.aims, type);
    for (const a of aims) {
      const label = String(a.label || "").trim();
      if (!label) continue;
      const key = normTargetKey(type, label);
      const lvl = levelToPriority(a.level);
      const cur = out.get(key);
      if (!cur) {
        out.set(key, { label, level: lvl, realizedBy: [subName], sourcePriorities: [{ name: subName, priority: lvl }] });
      } else {
        const maxLevel = rank(lvl) > rank(cur.level) ? lvl : cur.level;
        const names = cur.realizedBy.includes(subName) ? cur.realizedBy : [...cur.realizedBy, subName];
        const existing = cur.sourcePriorities.find((s) => s.name === subName);
        const nextSources = existing
          ? cur.sourcePriorities.map((s) =>
              s.name === subName ? { ...s, priority: rank(lvl) > rank(s.priority) ? lvl : s.priority } : s,
            )
          : [...cur.sourcePriorities, { name: subName, priority: lvl }];
        out.set(key, { label, level: maxLevel, realizedBy: names, sourcePriorities: nextSources });
      }
    }
  }
  return out;
}

export function computeCenterAutoLevelFromRings(levels: PriorityLevel[]): PriorityLevel | null {
  if (levels.length < 2) return null;
  const avg = levels.reduce((s, l) => s + rank(l), 0) / levels.length;
  const base = fromScore(avg);
  if (levels.length === 2) return downgrade(base);
  if (levels.length === 3) return base;
  return upgrade(base);
}

export function buildRingScenarios(input: { topAims: unknown; subcomponents: unknown; type: TargetAimType }): TargetingScenario[] {
  const top = mapByKey(listAimsByType(input.topAims, input.type), input.type);
  const realized = rollupRingFromSubcomponents(input.subcomponents, input.type);
  const keys = new Set<string>([...Array.from(top.keys()), ...Array.from(realized.keys())]);
  const rows: TargetingScenario[] = [];
  for (const key of Array.from(keys)) {
    const topAim = top.get(key);
    const r = realized.get(key);
    const label = String(topAim?.label || r?.label || "").trim();
    if (!label) continue;
    const intended = !!topAim;
    const realizedFlag = !!r;
    // Ring-level priority is realized from subcomponents only.
    // If not realized yet, keep priority unset.
    const computed = r?.level || null;
    const mode: LevelMode = topAim?.levelMode === "override" ? "override" : "auto";
    const override = topAim?.overrideLevel === "H" || topAim?.overrideLevel === "M" || topAim?.overrideLevel === "L" ? topAim.overrideLevel : null;
    rows.push({
      key,
      type: input.type,
      label,
      intended,
      realized: realizedFlag,
      computedLevel: computed,
      resolvedLevel: mode === "override" ? override : computed,
      levelMode: mode,
      overrideLevel: override,
      realizationCount: Array.isArray(r?.realizedBy) ? r!.realizedBy.length : 0,
      realizedBy: Array.isArray(r?.realizedBy) ? r!.realizedBy : [],
      sourcePriorities: Array.isArray((r as any)?.sourcePriorities) ? (r as any).sourcePriorities : [],
    });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

export function buildCenterScenarios(input: { centerTopAims: unknown; ringComponents: any[]; type: TargetAimType }): TargetingScenario[] {
  const centerTop = mapByKey(listAimsByType(input.centerTopAims, input.type), input.type);
  const ringByKey = new Map<string, { label: string; levels: PriorityLevel[]; realizedBy: string[]; sourcePriorities: { name: string; priority: PriorityLevel }[] }>();

  for (const comp of Array.isArray(input.ringComponents) ? input.ringComponents : []) {
    const nodeId = String((comp as any)?.nodeId || (comp as any)?.node_id || "");
    if (!nodeId || nodeId === "overall") continue;
    const title = String((comp as any)?.title || nodeId);
    const aims = listAimsByType((comp as any)?.designedExperienceData?.keyDesignElements?.aims, input.type);
    const seen = new Set<string>();
    for (const a of aims) {
      const label = String(a.label || "").trim();
      if (!label) continue;
      const key = normTargetKey(input.type, label);
      if (seen.has(key)) continue;
      seen.add(key);
      const lvl = levelToPriority(a.level);
      const cur = ringByKey.get(key) || { label, levels: [], realizedBy: [], sourcePriorities: [] as { name: string; priority: PriorityLevel }[] };
      cur.levels.push(lvl);
      if (!cur.realizedBy.includes(title)) cur.realizedBy.push(title);
      const src = cur.sourcePriorities.find((s) => s.name === title);
      if (!src) cur.sourcePriorities.push({ name: title, priority: lvl });
      else if (rank(lvl) > rank(src.priority)) src.priority = lvl;
      ringByKey.set(key, cur);
    }
  }

  const keys = new Set<string>([...Array.from(centerTop.keys()), ...Array.from(ringByKey.keys())]);
  const rows: TargetingScenario[] = [];
  for (const key of Array.from(keys)) {
    const topAim = centerTop.get(key);
    const ring = ringByKey.get(key);
    const label = String(topAim?.label || ring?.label || "").trim();
    if (!label) continue;
    const computed = computeCenterAutoLevelFromRings(ring?.levels || []);
    const mode: LevelMode = topAim?.levelMode === "override" ? "override" : "auto";
    const override = topAim?.overrideLevel === "H" || topAim?.overrideLevel === "M" || topAim?.overrideLevel === "L" ? topAim.overrideLevel : null;
    rows.push({
      key,
      type: input.type,
      label,
      intended: !!topAim,
      realized: !!ring,
      computedLevel: computed,
      resolvedLevel: mode === "override" ? override : computed,
      levelMode: mode,
      overrideLevel: override,
      realizationCount: (ring?.levels || []).length,
      realizedBy: ring?.realizedBy || [],
      sourcePriorities: ring?.sourcePriorities || [],
    });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

export function applyScenarioLevelsToAims(aims: unknown, scenarios: TargetingScenario[], type: TargetAimType): TargetAim[] {
  const list = Array.isArray(aims) ? [...aims] : [];
  const byKey = new Map(scenarios.map((s) => [s.key, s]));
  return list.map((a: any) => {
    if ((a as any)?.type !== type) return a;
    const key = normTargetKey(type, (a as any)?.label);
    const scenario = byKey.get(key);
    if (!scenario) return a;
    return {
      ...a,
      computedLevel: scenario.computedLevel,
      overrideLevel: scenario.overrideLevel,
      levelMode: scenario.levelMode,
      realizationCount: scenario.realizationCount,
      realizedBy: scenario.realizedBy,
      level: priorityToLevel(scenario.resolvedLevel),
    };
  });
}

