import type { OutcomeMeasure, ScoreFilter } from "./schema";
import {
  IMPLEMENTATION_SUBDIMENSION_TREE,
  type ImplementationTopDimension,
} from "./implementation-subdimension-tree";
import { effectiveFromInstances } from "./score-instances";
import {
  normalizedWeightedAvg,
  previousMeasureVersion,
  type DeltaDirection,
} from "./outcome-score-calc";

function deltaFromScores(current: number | null, previous: number | null): DeltaDirection | null {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff >= 1) return "up";
  if (diff <= -1) return "down";
  return "same";
}

export const IMPLEMENTATION_MEASURE_WEIGHT_VALUES: Record<"H" | "M" | "L", number> = { H: 5, M: 3, L: 1 };

function safeHml(v: unknown): "H" | "M" | "L" {
  return v === "H" || v === "M" || v === "L" ? v : "M";
}

/** Single priority (importance) →5/3/1 measure weight for implementation scoring. */
export function implementationMeasureWeightNumeric(measure: OutcomeMeasure): number {
  return IMPLEMENTATION_MEASURE_WEIGHT_VALUES[safeHml((measure as any).importance)];
}

function implSurvivingInstances(
  measure: OutcomeMeasure,
  filter: ScoreFilter | any,
): { score: number; weight: number }[] {
  const result = effectiveFromInstances(measure.instances ?? [], filter);
  if (result.score === null) return [];
  return [{ score: result.score, weight: implementationMeasureWeightNumeric(measure) }];
}

/**
 * Score for a leaf node: only measures tagged to this id (excluding crossOutcome).
 */
export function calcImplementationLeafScore(
  nodeId: string,
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  filter: ScoreFilter | any,
): number | null {
  const taggedOverall = overallMeasures.filter(
    (m) => Array.isArray(m.subDimensionIds) && m.subDimensionIds.length > 0,
  );
  const allMeasures = taggedOverall.length > 0 ? [...measures, ...taggedOverall] : measures;
  const pool: { score: number; weight: number }[] = [];
  for (const m of allMeasures) {
    if ((m as any).crossOutcome) continue;
    if (!Array.isArray(m.subDimensionIds) || !m.subDimensionIds.includes(nodeId)) continue;
    pool.push(...implSurvivingInstances(m, filter));
  }
  return normalizedWeightedAvg(pool);
}

/**
 * Score for one top-level dimension: measures tagged to the top id + weighted child leaf scores.
 */
export function calcImplementationTopDimensionScore(
  top: ImplementationTopDimension,
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
): number | null {
  const taggedOverall = overallMeasures.filter(
    (m) => Array.isArray(m.subDimensionIds) && m.subDimensionIds.length > 0,
  );
  const allMeasures = taggedOverall.length > 0 ? [...measures, ...taggedOverall] : measures;
  const pool: { score: number; weight: number }[] = [];

  for (const m of allMeasures) {
    if ((m as any).crossOutcome) continue;
    if (!Array.isArray(m.subDimensionIds) || !m.subDimensionIds.includes(top.id)) continue;
    pool.push(...implSurvivingInstances(m, filter));
  }

  for (const c of top.children) {
    const s = calcImplementationLeafScore(c.id, measures, overallMeasures, filter);
    if (s !== null) {
      const w = IMPLEMENTATION_MEASURE_WEIGHT_VALUES[safeHml(subDimensionWeights[c.id])];
      pool.push({ score: s, weight: w });
    }
  }

  return normalizedWeightedAvg(pool);
}

/**
 * Overall implementation score: weighted rollup across the 7 top-level dimension scores
 * plus untagged overall measures.
 */
export function calcFinalImplementationScore(
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
): number | null {
  const pool: { score: number; weight: number }[] = [];

  for (const top of IMPLEMENTATION_SUBDIMENSION_TREE) {
    const score = calcImplementationTopDimensionScore(top, measures, overallMeasures, subDimensionWeights, filter);
    if (score !== null) {
      const w = IMPLEMENTATION_MEASURE_WEIGHT_VALUES[safeHml(subDimensionWeights[top.id])];
      pool.push({ score, weight: w });
    }
  }

  const untaggedOverall = overallMeasures.filter(
    (m) => !Array.isArray(m.subDimensionIds) || m.subDimensionIds.length === 0,
  );
  for (const m of untaggedOverall) {
    pool.push(...implSurvivingInstances(m, filter));
  }

  return normalizedWeightedAvg(pool);
}

export function implementationLeafDelta(
  leafId: string,
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  filter: ScoreFilter | any,
): DeltaDirection | null {
  const tagged = measures.filter(
    (m) =>
      !(m as any).crossOutcome &&
      Array.isArray(m.subDimensionIds) &&
      m.subDimensionIds.includes(leafId),
  );
  const om = overallMeasures.filter(
    (m) =>
      !(m as any).crossOutcome &&
      Array.isArray(m.subDimensionIds) &&
      m.subDimensionIds.includes(leafId),
  );
  const allTagged = [...tagged, ...om];
  const hasPrevious = allTagged.some((m) => {
    const h: unknown[] = Array.isArray((m as any).periodHistory) ? (m as any).periodHistory : [];
    return h.length > 0;
  });
  if (!hasPrevious) return null;
  const currentScore = calcImplementationLeafScore(leafId, measures, overallMeasures, filter);
  const prevMeasures = measures.map((m) => previousMeasureVersion(m) ?? m);
  const prevOverall = overallMeasures.map((m) => previousMeasureVersion(m) ?? m);
  const prevScore = calcImplementationLeafScore(leafId, prevMeasures, prevOverall, filter);
  return deltaFromScores(currentScore, prevScore);
}

export function implementationTopDelta(
  top: ImplementationTopDimension,
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
): DeltaDirection | null {
  const idsToMatch = new Set([top.id, ...top.children.map((c) => c.id)]);
  const relevant = measures.filter(
    (m) => Array.isArray(m.subDimensionIds) && m.subDimensionIds.some((id) => idsToMatch.has(id)),
  );
  const allRelevant = [...relevant, ...overallMeasures];
  const hasPrevious = allRelevant.some((m) => {
    const h: unknown[] = Array.isArray((m as any).periodHistory) ? (m as any).periodHistory : [];
    return h.length > 0;
  });
  if (!hasPrevious) return null;
  const currentScore = calcImplementationTopDimensionScore(top, measures, overallMeasures, subDimensionWeights, filter);
  const prevMeasures = measures.map((m) => previousMeasureVersion(m) ?? m);
  const prevOverall = overallMeasures.map((m) => previousMeasureVersion(m) ?? m);
  const prevScore = calcImplementationTopDimensionScore(top, prevMeasures, prevOverall, subDimensionWeights, filter);
  return deltaFromScores(currentScore, prevScore);
}
