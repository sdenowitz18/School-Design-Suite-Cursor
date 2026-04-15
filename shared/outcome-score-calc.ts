import type { OutcomeMeasure, OutcomePeriodSnapshot, ScoreFilter, ScoreInstance } from "./schema";
import type { OutcomeSubDimL1 } from "./outcome-subdimension-tree";
import { computeMeasureWeightNumeric, OUTCOME_WEIGHT_VALUES, effectiveFromInstances, effectiveInstanceBreakdown } from "./score-instances";

const W = OUTCOME_WEIGHT_VALUES;

function measureWeightNum(importance: string | undefined, confidence: string | undefined): number {
  const imp = importance === "H" || importance === "M" || importance === "L" ? importance : "M";
  const conf = confidence === "H" || confidence === "M" || confidence === "L" ? confidence : "M";
  return computeMeasureWeightNumeric(imp, conf);
}

function hmlToNum(label: "H" | "M" | "L"): number {
  return W[label] ?? 3;
}

function clamp1to5(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v)));
}

function survivingInstances(
  measure: OutcomeMeasure,
  filter: ScoreFilter | any,
): { score: number; weight: number }[] {
  const result = effectiveFromInstances(measure.instances ?? [], filter);
  if (result.score === null) return [];
  const mw = measureWeightNum((measure as any).importance, (measure as any).confidence);
  return [{ score: result.score, weight: mw }];
}

/**
 * Weighted average of scored items. Returns null when pool is empty.
 */
export function normalizedWeightedAvg(
  items: { score: number; weight: number }[],
): number | null {
  if (items.length === 0) return null;
  let totalW = 0;
  let total = 0;
  for (const item of items) {
    totalW += item.weight;
    total += item.score * item.weight;
  }
  if (totalW === 0) return null;
  return clamp1to5(total / totalW);
}

/**
 * Compute score for a single L2 sub-dimension.
 * Pools filtered instances from all measures tagged to this L2.
 * Excludes measures marked crossOutcome=true (those contribute at dimension level only).
 */
export function calcL2Score(
  l2Id: string,
  measures: OutcomeMeasure[],
  filter: ScoreFilter | any,
): number | null {
  const tagged = measures.filter((m) =>
    !(m as any).crossOutcome &&
    Array.isArray(m.subDimensionIds) && m.subDimensionIds.includes(l2Id),
  );
  const pool: { score: number; weight: number }[] = [];
  for (const m of tagged) {
    pool.push(...survivingInstances(m, filter));
  }
  return normalizedWeightedAvg(pool);
}

/**
 * Compute score for a single L1 dimension.
 * Pool = L2 sub-dimension scores (weighted by subDimensionWeights) +
 *        filtered instances from overallMeasures.
 */
export function calcL1Score(
  l1: OutcomeSubDimL1,
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
): number | null {
  const pool: { score: number; weight: number }[] = [];

  const taggedOverall = overallMeasures.filter(
    (m) => Array.isArray(m.subDimensionIds) && m.subDimensionIds.length > 0,
  );
  const allMeasures = taggedOverall.length > 0 ? [...measures, ...taggedOverall] : measures;

  for (const l2 of l1.children) {
    const score = calcL2Score(l2.id, allMeasures, filter);
    if (score !== null) {
      const w = hmlToNum(subDimensionWeights[l2.id] || "M");
      pool.push({ score, weight: w });
    }
  }

  return normalizedWeightedAvg(pool);
}

/**
 * Compute the overall Outcome score across all L2 subdimensions directly.
 * L1 dimensions are display-only rollups and carry no weight of their own.
 * Untagged overall measures ("All Outcomes") contribute directly here.
 */
export function calcOverallOutcomeScore(
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
  tree: OutcomeSubDimL1[],
): number | null {
  const pool: { score: number; weight: number }[] = [];

  const taggedOverall = overallMeasures.filter(
    (m) => Array.isArray(m.subDimensionIds) && m.subDimensionIds.length > 0,
  );
  const allMeasures = taggedOverall.length > 0 ? [...measures, ...taggedOverall] : measures;

  for (const l1 of tree) {
    for (const l2 of l1.children) {
      const score = calcL2Score(l2.id, allMeasures, filter);
      if (score !== null) {
        const w = hmlToNum(subDimensionWeights[l2.id] || "M");
        pool.push({ score, weight: w });
      }
    }
  }

  const untaggedOverall = overallMeasures.filter(
    (m) => !Array.isArray(m.subDimensionIds) || m.subDimensionIds.length === 0,
  );
  for (const m of untaggedOverall) {
    pool.push(...survivingInstances(m, filter));
  }

  return normalizedWeightedAvg(pool);
}

/**
 * Compute score for a specific measure using its instances + filter.
 */
export function calcMeasureScore(
  measure: OutcomeMeasure,
  filter: ScoreFilter | any,
): number | null {
  const result = effectiveFromInstances(measure.instances ?? [], filter);
  return result.score;
}

// ─── Delta helpers ─────────────────────────────────────────────────────

export type DeltaDirection = "up" | "down" | "same";

function deltaFromScores(current: number | null, previous: number | null): DeltaDirection | null {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff >= 1) return "up";
  if (diff <= -1) return "down";
  return "same";
}

export function previousMeasureVersion(m: OutcomeMeasure): OutcomeMeasure | null {
  const history: OutcomePeriodSnapshot[] = Array.isArray((m as any).periodHistory) ? (m as any).periodHistory : [];
  if (history.length === 0) return null;
  const prev = history[history.length - 1];
  return {
    ...m,
    instances: prev.instances ?? [],
    importance: (prev.importance as any) ?? "M",
    confidence: (prev.confidence as any) ?? "M",
    markingPeriod: prev.markingPeriod as any,
  } as OutcomeMeasure;
}

export function measureDelta(
  measure: OutcomeMeasure,
  filter: ScoreFilter | any,
): DeltaDirection | null {
  const prev = previousMeasureVersion(measure);
  if (!prev) return null;
  const currentScore = calcMeasureScore(measure, filter);
  const prevScore = calcMeasureScore(prev, filter);
  return deltaFromScores(currentScore, prevScore);
}

export function l2Delta(
  l2Id: string,
  measures: OutcomeMeasure[],
  filter: ScoreFilter | any,
): DeltaDirection | null {
  const tagged = measures.filter((m) =>
    Array.isArray(m.subDimensionIds) && m.subDimensionIds.includes(l2Id),
  );
  const hasPrevious = tagged.some((m) => {
    const h: any[] = Array.isArray((m as any).periodHistory) ? (m as any).periodHistory : [];
    return h.length > 0;
  });
  if (!hasPrevious) return null;

  const currentScore = calcL2Score(l2Id, measures, filter);
  const prevMeasures = tagged.map((m) => previousMeasureVersion(m) ?? m);
  const prevScore = calcL2Score(l2Id, prevMeasures, filter);
  return deltaFromScores(currentScore, prevScore);
}

export function l1Delta(
  l1: OutcomeSubDimL1,
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
): DeltaDirection | null {
  const l2Ids = new Set(l1.children.map((c) => c.id));
  const relevant = measures.filter((m) =>
    Array.isArray(m.subDimensionIds) && m.subDimensionIds.some((id) => l2Ids.has(id)),
  );
  const allRelevant = [...relevant, ...overallMeasures];
  const hasPrevious = allRelevant.some((m) => {
    const h: any[] = Array.isArray((m as any).periodHistory) ? (m as any).periodHistory : [];
    return h.length > 0;
  });
  if (!hasPrevious) return null;

  const currentScore = calcL1Score(l1, measures, overallMeasures, subDimensionWeights, filter);
  const prevMeasures = measures.map((m) => previousMeasureVersion(m) ?? m);
  const prevOverall = overallMeasures.map((m) => previousMeasureVersion(m) ?? m);
  const prevScore = calcL1Score(l1, prevMeasures, prevOverall, subDimensionWeights, filter);
  return deltaFromScores(currentScore, prevScore);
}

// ─── Period resolution ─────────────────────────────────────────────────

/**
 * Given a markingPeriod object and a filter mode, returns the period key
 * that the measure belongs to under that filter mode.
 */
export function measurePeriodKeyForFilter(mp: any, filterMode: string): string | null {
  if (!mp) return null;
  if (filterMode === "year") {
    if (mp.yearKey) return mp.yearKey;
    if (mp.semesterKey) return mp.semesterKey.split("-")[0];
    if (mp.quarterKey) return mp.quarterKey.split("-")[0];
    return null;
  }
  if (filterMode === "semester") return mp.semesterKey || null;
  if (filterMode === "quarter") return mp.quarterKey || null;
  return null;
}

export function periodKeyRank(key: string, mode: string): number {
  if (mode === "year") return parseInt(key, 10) || 0;
  const [yStr, part] = key.split("-");
  const y = parseInt(yStr, 10) || 0;
  if (mode === "semester") return y * 2 + (part === "Spring" ? 1 : 0);
  const qi = part === "Q2" ? 1 : part === "Q3" ? 2 : part === "Q4" ? 3 : 0;
  return y * 4 + qi;
}

/**
 * Resolves a measure to the correct snapshot for the given filter period.
 * Checks the measure's current period and its periodHistory for an exact
 * match or the most recent prior snapshot (carry-forward).
 * Returns null if the measure has no data at or before the requested period.
 */
export function resolveMeasureForPeriod(
  m: OutcomeMeasure,
  filter: ScoreFilter,
): OutcomeMeasure | null {
  if (filter.mode === "none") return m;
  const filterKey =
    filter.mode === "year" ? (filter as any).yearKey
    : filter.mode === "semester" ? (filter as any).semesterKey
    : (filter as any).quarterKey;
  if (!filterKey) return m;

  const filterRank = periodKeyRank(filterKey, filter.mode);

  type Candidate = { key: string; rank: number; snap: any | null };
  const candidates: Candidate[] = [];

  const currentKey = measurePeriodKeyForFilter((m as any).markingPeriod, filter.mode);
  if (currentKey) {
    candidates.push({ key: currentKey, rank: periodKeyRank(currentKey, filter.mode), snap: null });
  }

  const history: any[] = Array.isArray((m as any).periodHistory) ? (m as any).periodHistory : [];
  for (const snap of history) {
    const snapKey = measurePeriodKeyForFilter(snap.markingPeriod, filter.mode);
    if (snapKey) {
      candidates.push({ key: snapKey, rank: periodKeyRank(snapKey, filter.mode), snap });
    }
  }

  if (candidates.length === 0) return null;

  // Exact match first
  const exact = candidates.find((c) => c.key === filterKey);
  if (exact) {
    if (!exact.snap) return m;
    return {
      ...m,
      markingPeriod: exact.snap.markingPeriod,
      instances: exact.snap.instances ?? [],
      importance: exact.snap.importance ?? "M",
      confidence: exact.snap.confidence ?? "M",
    } as OutcomeMeasure;
  }

  // Carry-forward: most recent candidate at or before the filter period
  let best: Candidate | null = null;
  for (const c of candidates) {
    if (c.rank <= filterRank && (!best || c.rank > best.rank)) {
      best = c;
    }
  }
  if (!best) return null;

  if (!best.snap) return m;
  return {
    ...m,
    markingPeriod: best.snap.markingPeriod,
    instances: best.snap.instances ?? [],
    importance: best.snap.importance ?? "M",
    confidence: best.snap.confidence ?? "M",
  } as OutcomeMeasure;
}

/**
 * Collect per-actor surviving instance scores from a set of measures.
 * Used to feed the ScoreFlags component with individual instance-level items.
 */
export function collectInstanceFlagItems(
  measures: OutcomeMeasure[],
  filter: ScoreFilter | any,
): { key: string; label: string; score: number | null }[] {
  const items: { key: string; label: string; score: number | null }[] = [];
  for (const m of measures) {
    const breakdown = effectiveInstanceBreakdown(m.instances ?? [], filter);
    for (const entry of breakdown) {
      items.push({
        key: `${m.id}-${entry.actor}`,
        label: `${entry.actor} — ${m.name || "Untitled"}`,
        score: entry.score,
      });
    }
  }
  return items;
}
