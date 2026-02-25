import type { ScoreFilter, ScoreInstance } from "./schema";
import { getSchoolYearKey, getSemesterKey, parseIsoDate } from "./marking-period";

const WEIGHT_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };

export const UNKNOWN_ACTOR_KEY = "__unknown__";

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

export function normActor(value: unknown): string {
  const clean = String(value ?? "").trim();
  if (!clean) return UNKNOWN_ACTOR_KEY;
  return clean.toLowerCase();
}

export function inSelectedPeriod(date: Date, filter: ScoreFilter | any): boolean {
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

export function effectiveFromInstances(
  instances: ScoreInstance[],
  filter: ScoreFilter | any,
): { score: number | null; weight: number | null } {
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

  // Latest by actor (selected actor key)
  if (agg === "latestPerActor") {
    const wanted = normActor(filter?.actorKey);
    const filtered = eligible.filter((e) => e.actorKey === wanted);
    if (filtered.length === 0) return { score: null, weight: null };
    filtered.sort((a, b) => b.dt - a.dt);
    return { score: filtered[0].score, weight: filtered[0].weight };
  }

  // Latest (across actors): latest per actor, then weighted average across actors.
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

