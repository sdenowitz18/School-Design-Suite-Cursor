import type { OutcomeMeasure, ScoreFilter } from "./schema";
import { DESIGN_SUBDIMENSION_TREE } from "./design-subdimension-tree";
import type { ImplementationTopDimension } from "./implementation-subdimension-tree";
import { effectiveFromInstances } from "./score-instances";
import {
  IMPLEMENTATION_MEASURE_WEIGHT_VALUES,
  implementationMeasureWeightNumeric,
  calcImplementationTopDimensionScore,
  implementationTopDelta,
} from "./implementation-score-calc";
import { normalizedWeightedAvg } from "./outcome-score-calc";

/** Delta for a design dimension tile (same logic as implementation top). */
export const designTopDelta = implementationTopDelta;

function safeHml(v: unknown): "H" | "M" | "L" {
  return v === "H" || v === "M" || v === "L" ? v : "M";
}

function designSurvivingInstances(
  measure: OutcomeMeasure,
  filter: ScoreFilter | any,
): { score: number; weight: number }[] {
  const result = effectiveFromInstances(measure.instances ?? [], filter);
  if (result.score === null) return [];
  return [{ score: result.score, weight: implementationMeasureWeightNumeric(measure) }];
}

export function calcDesignDimensionScore(
  top: ImplementationTopDimension,
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
): number | null {
  return calcImplementationTopDimensionScore(top, measures, overallMeasures, subDimensionWeights, filter);
}

export function calcFinalDesignScore(
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
): number | null {
  const pool: { score: number; weight: number }[] = [];

  for (const top of DESIGN_SUBDIMENSION_TREE) {
    const score = calcImplementationTopDimensionScore(
      top as ImplementationTopDimension,
      measures,
      overallMeasures,
      subDimensionWeights,
      filter,
    );
    if (score !== null) {
      const w = IMPLEMENTATION_MEASURE_WEIGHT_VALUES[safeHml(subDimensionWeights[top.id])];
      pool.push({ score, weight: w });
    }
  }

  const untaggedOverall = overallMeasures.filter(
    (m) => !Array.isArray(m.subDimensionIds) || m.subDimensionIds.length === 0,
  );
  for (const m of untaggedOverall) {
    pool.push(...designSurvivingInstances(m, filter));
  }

  return normalizedWeightedAvg(pool);
}
