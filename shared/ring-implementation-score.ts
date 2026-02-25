import type { RingImplementationInstance, RingImplementationScoreData } from "./schema";
import { getSchoolYearKey, getSemesterKey, parseIsoDate } from "./marking-period";

const WEIGHT_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };
const PRIORITY_WEIGHT: Record<"H" | "M" | "L", number> = { H: 6, M: 3, L: 1 };
const UNKNOWN_ACTOR_KEY = "__unknown__";

function clampInt1to5(value: number): number {
  const rounded = Math.round(value);
  return Math.max(1, Math.min(5, rounded));
}

function safeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function safeWeightLabel(value: unknown): "H" | "M" | "L" {
  if (value === "H" || value === "M" || value === "L") return value;
  return "M";
}

function weightValue(label: unknown): number {
  const l = safeWeightLabel(label);
  return WEIGHT_MEANING[l] ?? 1;
}

function priorityValue(label: unknown): number {
  const l = safeWeightLabel(label);
  return PRIORITY_WEIGHT[l] ?? 1;
}

function normActor(value: unknown): string {
  const clean = String(value ?? "").trim();
  if (!clean) return UNKNOWN_ACTOR_KEY;
  return clean.toLowerCase();
}

function inSelectedPeriod(date: Date, filter: any): boolean {
  const mode = filter?.mode || "none";
  if (mode === "none") return true;
  if (mode === "year") {
    const key = String(filter?.yearKey || "");
    if (!key) return true;
    return getSchoolYearKey(date) === key;
  }
  if (mode === "semester") {
    const key = String(filter?.semesterKey || "");
    if (!key) return true;
    return getSemesterKey(date) === key;
  }
  return true;
}

function effectiveFromInstances(instances: RingImplementationInstance[], filter: any): { score: number | null; weight: number | null } {
  const agg = filter?.aggregation || "singleLatest";
  const list = Array.isArray(instances) ? instances : [];

  const eligible: { actorKey: string; dt: number; score: number; weight: number }[] = [];
  for (const inst of list) {
    const d = parseIsoDate(String((inst as any)?.asOfDate || ""));
    if (!d) continue;
    if (!inSelectedPeriod(d, filter)) continue;
    const score = safeScore((inst as any)?.score);
    if (score === null) continue;
    const actorKey = normActor((inst as any)?.actor);
    eligible.push({ actorKey, dt: d.getTime(), score, weight: weightValue((inst as any)?.weight) });
  }
  if (eligible.length === 0) return { score: null, weight: null };

  // Latest by Actor (selected actor key)
  if (agg === "latestPerActor") {
    const wanted = normActor(filter?.actorKey);
    const filtered = eligible.filter((e) => e.actorKey === wanted);
    if (filtered.length === 0) return { score: null, weight: null };
    filtered.sort((a, b) => b.dt - a.dt);
    return { score: filtered[0].score, weight: filtered[0].weight };
  }

  // Single Latest (default): latest per actor, then weighted average across actors.
  const byActor = new Map<string, { dt: number; score: number; weight: number }>();
  for (const e of eligible) {
    const prev = byActor.get(e.actorKey);
    if (!prev || e.dt > prev.dt) byActor.set(e.actorKey, { dt: e.dt, score: e.score, weight: e.weight });
  }
  const values = Array.from(byActor.values());
  if (values.length === 0) return { score: null, weight: null };

  let totalW = 0;
  let total = 0;
  for (const v of values) {
    const w = v.weight;
    if (w <= 0) continue;
    totalW += w;
    total += v.score * w;
  }
  if (totalW <= 0) return { score: null, weight: null };
  return { score: clampInt1to5(total / totalW), weight: totalW };
}

function effectiveFromItems(items: any[], filter: any): number | null {
  const list = Array.isArray(items) ? items : [];
  let totalWeight = 0;
  let total = 0;
  for (const it of list) {
    const instances = Array.isArray((it as any)?.instances) ? ((it as any).instances as RingImplementationInstance[]) : [];
    const score = instances.length > 0 ? effectiveFromInstances(instances, filter).score : null;
    if (score === null) continue;
    const w = priorityValue((it as any)?.priority);
    if (w <= 0) continue;
    totalWeight += w;
    total += score * w;
  }
  if (totalWeight <= 0) return null;
  return clampInt1to5(total / totalWeight);
}

export function calculateRingImplementationScore(
  ringComponent:
    | {
        healthData?: {
          ringImplementationScoreData?: RingImplementationScoreData;
        };
      }
    | null
    | undefined,
): number | null {
  const data = ringComponent?.healthData?.ringImplementationScoreData;
  if (!data) return null;

  const filter: any = (data as any).filter || { mode: "none", aggregation: "singleLatest" };

  if ((data as any).implementationScoringMode === "overall") {
    const overallInstances = ((data as any).overallInstances || []) as RingImplementationInstance[];
    if (Array.isArray(overallInstances) && overallInstances.length > 0) {
      const eff = effectiveFromInstances(overallInstances, filter);
      return eff.score;
    }
    return safeScore((data as any).overallImplementationScore);
  }

  const dims: { score: number; weight: number }[] = [];
  const legacyMap: Record<string, string> = {
    studentsEnrollment: "scale",
    feasibilitySustainability: "learnerDemand",
    fidelityDesignedExperience: "fidelity",
    qualityDelivery: "quality",
  };

  for (const key of [
    "studentsEnrollment",
    "feasibilitySustainability",
    "fidelityDesignedExperience",
    "qualityDelivery",
    "measurementAdministrationQuality",
  ] as const) {
    const dimsObj: any = (data as any).dimensions || {};
    const legacyKey = legacyMap[key];
    const dim: any = dimsObj?.[key] || (legacyKey ? dimsObj?.[legacyKey] : {}) || {};

    // New: itemized scoring mode
    if ((dim as any)?.scoringMode === "items") {
      const score = effectiveFromItems((dim as any)?.items || [], filter);
      if (score === null) continue;
      dims.push({ score, weight: weightValue((dim as any)?.weight) });
      continue;
    }

    const instances = (dim.instances || []) as RingImplementationInstance[];
    if (Array.isArray(instances) && instances.length > 0) {
      const eff = effectiveFromInstances(instances, filter);
      if (eff.score === null || eff.weight === null) continue;
      dims.push({ score: eff.score, weight: eff.weight });
      continue;
    }
  }

  if (dims.length === 0) return null;

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  if (totalWeight <= 0) return null;

  const weighted = dims.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight;
  return clampInt1to5(weighted);
}

