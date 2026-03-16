import type { ScoreFilter, ScoreInstance } from "./schema";
import { getQuarterKey, getSchoolYearKey, getSemesterKey, parseIsoDate, getPeriodEndDate } from "./marking-period";

const WEIGHT_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };

const IMP_CONF_RANK: Record<"H" | "M" | "L", number> = { H: 2, M: 1, L: 0 };

/**
 * Numeric measure weight from importance × confidence.
 * LL=1, LM=2, MM=3, MH=4, HH=5
 */
export function computeMeasureWeightNumeric(importance: "H" | "M" | "L", confidence: "H" | "M" | "L"): number {
  return IMP_CONF_RANK[importance] + IMP_CONF_RANK[confidence] + 1;
}

export function computeMeasureWeight(importance: "H" | "M" | "L", confidence: "H" | "M" | "L"): "H" | "M" | "L" {
  const n = computeMeasureWeightNumeric(importance, confidence);
  if (n >= 4) return "H";
  if (n >= 2) return "M";
  return "L";
}

export function computeMeasureWeightDisplay(importance: "H" | "M" | "L", confidence: "H" | "M" | "L"): string {
  return String(computeMeasureWeightNumeric(importance, confidence));
}

export const OUTCOME_WEIGHT_VALUES: Record<"H" | "M" | "L", number> = { H: 5, M: 3, L: 1 };

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

/**
 * Returns the period end date string (ISO) from a filter, or null if no period is selected.
 */
export function getPeriodEndFromFilter(filter: ScoreFilter | any): string | null {
  const mode = (filter?.mode || "none") as string;
  if (mode === "none") return null;
  const key =
    mode === "year"
      ? String(filter?.yearKey || "")
      : mode === "semester"
        ? String(filter?.semesterKey || "")
        : String(filter?.quarterKey || "");
  if (!key) return null;
  return getPeriodEndDate(mode as "year" | "semester" | "quarter", key);
}

/**
 * Checks if a date falls within the selected period window (date ≤ period end).
 * Returns true when no period is selected (mode === "none").
 * Kept for backward-compatibility with ring-conditions scoring.
 */
export function inSelectedPeriod(date: Date, filter: ScoreFilter | any): boolean {
  const periodEnd = getPeriodEndFromFilter(filter);
  if (!periodEnd) return true;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return iso <= periodEnd;
}

/**
 * Kept for backward compatibility. Use getPeriodEndFromFilter instead.
 * @deprecated
 */
export function selectEffectivePeriodRank(instances: ScoreInstance[], filter: ScoreFilter | any): number | null {
  return null;
}

/**
 * Returns all surviving instances (respecting period & actor filters,
 * and excluding retired instances) without collapsing into a weighted average.
 * All non-retired, within-period instances are included (no per-actor deduplication).
 */
export function effectiveInstanceBreakdown(
  instances: ScoreInstance[],
  filter: ScoreFilter | any,
): { actor: string; score: number }[] {
  const list = Array.isArray(instances) ? instances : [];
  const periodEnd = getPeriodEndFromFilter(filter);
  const actorFilter =
    filter?.actorKey && filter.actorKey !== UNKNOWN_ACTOR_KEY ? normActor(filter.actorKey) : null;

  const rows: { actor: string; score: number }[] = [];
  for (const inst of list) {
    if ((inst as any)?.retired) continue;
    const d = parseIsoDate(String((inst as any)?.asOfDate || ""));
    if (!d) continue;
    const score = safeScore((inst as any)?.score);
    if (score === null) continue;
    const asOfDate = String((inst as any)?.asOfDate || "");
    if (periodEnd && asOfDate > periodEnd) continue;
    const actorKey = normActor((inst as any)?.actor);
    if (actorFilter && actorKey !== actorFilter) continue;
    const actorName = String((inst as any)?.actor || "").trim() || "Unknown";
    rows.push({ actor: actorName, score });
  }
  return rows;
}

/**
 * Returns the weighted average score from a set of instances, respecting:
 * - retired instances (excluded)
 * - period end filter (instances after period end are excluded)
 * - actor filter (if actorKey is set, only that actor's instances are included)
 * All non-retired, within-period instances are included (no per-actor deduplication).
 */
export function effectiveFromInstances(
  instances: ScoreInstance[],
  filter: ScoreFilter | any,
): { score: number | null; weight: number | null } {
  const list = Array.isArray(instances) ? instances : [];
  const periodEnd = getPeriodEndFromFilter(filter);
  const actorFilter =
    filter?.actorKey && filter.actorKey !== UNKNOWN_ACTOR_KEY ? normActor(filter.actorKey) : null;

  const rows: { score: number; weight: number }[] = [];
  for (const inst of list) {
    if ((inst as any)?.retired) continue;
    const d = parseIsoDate(String((inst as any)?.asOfDate || ""));
    if (!d) continue;
    const score = safeScore((inst as any)?.score);
    if (score === null) continue;
    const asOfDate = String((inst as any)?.asOfDate || "");
    if (periodEnd && asOfDate > periodEnd) continue;
    const actorKey = normActor((inst as any)?.actor);
    if (actorFilter && actorKey !== actorFilter) continue;

    const instImp = (inst as any)?.importance;
    const instConf = (inst as any)?.confidence;
    const instWeight =
      instImp && instConf
        ? computeMeasureWeightNumeric(
            instImp === "H" || instImp === "M" || instImp === "L" ? instImp : "M",
            instConf === "H" || instConf === "M" || instConf === "L" ? instConf : "M",
          )
        : weightValue((inst as any)?.weight);

    rows.push({ score, weight: instWeight });
  }
  if (rows.length === 0) return { score: null, weight: null };

  // Single instance — return directly
  if (rows.length === 1) {
    return { score: rows[0].score, weight: rows[0].weight };
  }

  // Weighted average across all contributing instances
  let totalW = 0;
  let total = 0;
  for (const v of rows) {
    const w = v.weight;
    if (w <= 0) continue;
    totalW += w;
    total += v.score * w;
  }
  if (totalW <= 0) return { score: null, weight: null };
  return { score: clampInt1to5(total / totalW), weight: totalW };
}

/**
 * Returns the Set of instance IDs that are counted in the score given the current filter.
 * Excludes retired and out-of-period instances. All remaining instances are effective
 * (no per-actor deduplication).
 */
export function getEffectiveInstanceIds(
  instances: ScoreInstance[],
  filter: ScoreFilter | any,
): Set<string> {
  const list = Array.isArray(instances) ? instances : [];
  const periodEnd = getPeriodEndFromFilter(filter);
  const actorFilter =
    filter?.actorKey && filter.actorKey !== UNKNOWN_ACTOR_KEY ? normActor(filter.actorKey) : null;

  const ids = new Set<string>();
  for (const inst of list) {
    const id = String((inst as any)?.id || "");
    if ((inst as any)?.retired) continue;
    const d = parseIsoDate(String((inst as any)?.asOfDate || ""));
    if (!d) continue;
    const score = safeScore((inst as any)?.score);
    if (score === null) continue;
    const asOfDate = String((inst as any)?.asOfDate || "");
    if (periodEnd && asOfDate > periodEnd) continue;
    const actorKey = normActor((inst as any)?.actor);
    if (actorFilter && actorKey !== actorFilter) continue;
    ids.add(id);
  }
  return ids;
}
