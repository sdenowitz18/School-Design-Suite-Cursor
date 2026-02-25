import type { RingConditionsInstance, RingConditionsScoreData } from "./schema";
import { inSelectedPeriod, normActor } from "./score-instances";
import { parseIsoDate } from "./marking-period";

export const DEFAULT_HML_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };

function hmlValue(v: unknown): number {
  if (v === "H" || v === "M" || v === "L") return DEFAULT_HML_MEANING[v];
  return DEFAULT_HML_MEANING.M;
}

function directionFactor(v: unknown): number {
  return v === "tailwind" ? 1 : v === "headwind" ? -1 : 0;
}

function windValue(v: unknown): number {
  if (v === "H" || v === "M" || v === "L") return DEFAULT_HML_MEANING[v];
  return DEFAULT_HML_MEANING.M;
}

function effectiveWindStrength(instances: RingConditionsInstance[], filter: any): number | null {
  const agg = filter?.aggregation || "singleLatest";
  const list = Array.isArray(instances) ? instances : [];

  const eligible: { actorKey: string; dt: number; strength: number }[] = [];
  for (const inst of list) {
    const d = parseIsoDate(String((inst as any)?.asOfDate || ""));
    if (!d) continue;
    if (!inSelectedPeriod(d, filter)) continue;
    const actorKey = normActor((inst as any)?.actor);
    eligible.push({ actorKey, dt: d.getTime(), strength: windValue((inst as any)?.windStrength) });
  }
  if (eligible.length === 0) return null;

  if (agg === "latestPerActor") {
    const actorKey = normActor(filter?.actorKey);
    if (!actorKey) return null;
    const filtered = eligible.filter((e) => e.actorKey === actorKey);
    if (filtered.length === 0) return null;
    filtered.sort((a, b) => b.dt - a.dt);
    return filtered[0].strength;
  }

  const byActor = new Map<string, { dt: number; strength: number }>();
  for (const e of eligible) {
    const prev = byActor.get(e.actorKey);
    if (!prev || e.dt > prev.dt) byActor.set(e.actorKey, { dt: e.dt, strength: e.strength });
  }
  const values = Array.from(byActor.values());
  if (values.length === 0) return null;
  const avg = values.reduce((s, v) => s + v.strength, 0) / values.length;
  return avg;
}

export function calculateRingConditionsSum(data: RingConditionsScoreData): number | null {
  const conditions = data?.conditions || [];
  if (conditions.length === 0) return null;

  const filter: any = (data as any)?.filter || { mode: "none", aggregation: "singleLatest" };
  let sum = 0;
  let hasAny = false;

  for (const c of conditions) {
    if (!c) continue;
    const instances = Array.isArray((c as any)?.instances) ? ((c as any).instances as RingConditionsInstance[]) : [];
    const wS = instances.length > 0 ? effectiveWindStrength(instances, filter) : windValue((c as any).windStrength);
    if (wS === null) continue;
    const dir = directionFactor((c as any).direction);
    if (dir === 0) continue;
    sum += dir * wS;
    hasAny = true;
  }

  return hasAny ? sum : null;
}

export function mapConditionsSumToScore(sum: number | null): number | null {
  if (sum === null) return null;
  // Rescaled thresholds (stakeholder weighting removed):
  // Each condition contributes Direction × WindStrengthValue where H=4, M=2, L=1.
  if (sum > 5) return 5;
  if (sum >= 2) return 4;
  if (sum >= -1) return 3;
  if (sum >= -5) return 2;
  return 1;
}

export function calculateRingConditionsScoreFromData(data: RingConditionsScoreData): { sum: number | null; score: number | null } {
  const sum = calculateRingConditionsSum(data);
  return { sum, score: mapConditionsSumToScore(sum) };
}

export function calculateRingConditionsScore(component: any): number | null {
  const hd: any = component?.healthData || {};
  const csd: RingConditionsScoreData | null = hd.ringConditionsScoreData || null;
  if (!csd) return null;
  return calculateRingConditionsScoreFromData(csd).score;
}

