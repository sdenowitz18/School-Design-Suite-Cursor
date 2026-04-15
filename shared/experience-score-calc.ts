import type { OutcomeMeasure, ScoreFilter } from "./schema";
import type { ImplementationTopDimension } from "./implementation-subdimension-tree";
import {
  IMPLEMENTATION_MEASURE_WEIGHT_VALUES,
  implementationMeasureWeightNumeric,
  calcImplementationTopDimensionScore,
} from "./implementation-score-calc";
import { normalizedWeightedAvg } from "./outcome-score-calc";
import { effectiveFromInstances } from "./score-instances";
import { experienceSubdimensionIdForAim } from "./experience-subdimension-tree";
import { isLeapAimActive } from "./aim-selection";

function safeHml(v: unknown): "H" | "M" | "L" {
  return v === "H" || v === "M" || v === "L" ? v : "M";
}

function expSurvivingInstances(
  measure: OutcomeMeasure,
  filter: ScoreFilter | any,
): { score: number; weight: number }[] {
  const result = effectiveFromInstances(measure.instances ?? [], filter);
  if (result.score === null) return [];
  return [{ score: result.score, weight: implementationMeasureWeightNumeric(measure) }];
}

/**
 * Experience score: weighted rollup across dynamic subdimensions (Leaps + design principles)
 * plus untagged overall measures, same pattern as design score.
 */
export function calcFinalExperienceScore(
  measures: OutcomeMeasure[],
  overallMeasures: OutcomeMeasure[],
  subDimensionWeights: Record<string, "H" | "M" | "L">,
  filter: ScoreFilter | any,
  tops: ImplementationTopDimension[],
): number | null {
  const pool: { score: number; weight: number }[] = [];

  for (const top of tops) {
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
    pool.push(...expSurvivingInstances(m, filter));
  }

  return normalizedWeightedAvg(pool);
}

/** Migrate legacy `experienceScoreData` into design-like measures + weights. */
export function migrateLegacyExperienceScoreData(esd: any, deAims: any[]): {
  measures: OutcomeMeasure[];
  overallMeasures: OutcomeMeasure[];
  subDimensionWeights: Record<string, "H" | "M" | "L">;
} {
  const empty = {
    measures: [] as OutcomeMeasure[],
    overallMeasures: [] as OutcomeMeasure[],
    subDimensionWeights: {} as Record<string, "H" | "M" | "L">,
  };
  if (!esd || typeof esd !== "object") return empty;

  // New flat shape: always honor `measures` when present (including []), so we do not re-parse legacy.
  if (Array.isArray(esd.measures)) {
    return {
      measures: esd.measures as OutcomeMeasure[],
      overallMeasures: Array.isArray(esd.overallMeasures) ? (esd.overallMeasures as OutcomeMeasure[]) : [],
      subDimensionWeights:
        esd.subDimensionWeights && typeof esd.subDimensionWeights === "object"
          ? { ...(esd.subDimensionWeights as Record<string, "H" | "M" | "L">) }
          : {},
    };
  }

  const measures: OutcomeMeasure[] = [];
  const leapItems: any[] = Array.isArray(esd.leapItems) ? esd.leapItems : [];
  for (const li of leapItems) {
    const label = String(li?.label || "").trim();
    const sid = String(li?.id || "").trim() || `legacy-${String(li?.label || "leap")}`;
    const tagId = label
      ? experienceSubdimensionIdForAim({ label })
      : sid.startsWith("exp-")
        ? sid
        : `exp-aim-${sid}`;
    for (const m of Array.isArray(li?.measures) ? li.measures : []) {
      measures.push({
        ...(m as OutcomeMeasure),
        subDimensionIds: [tagId],
      });
    }
  }
  const legacyLeaps = esd?.leaps?.measures || [];
  for (const m of Array.isArray(legacyLeaps) ? legacyLeaps : []) {
    measures.push(m as OutcomeMeasure);
  }

  const overallMeasures: OutcomeMeasure[] = Array.isArray(esd.overallMeasures)
    ? [...(esd.overallMeasures as OutcomeMeasure[])]
    : [];
  for (const m of Array.isArray(esd?.health?.measures) ? esd.health.measures : []) {
    overallMeasures.push({ ...(m as OutcomeMeasure), subDimensionIds: [] });
  }
  for (const m of Array.isArray(esd?.behavior?.measures) ? esd.behavior.measures : []) {
    overallMeasures.push({ ...(m as OutcomeMeasure), subDimensionIds: [] });
  }

  const subDimensionWeights: Record<string, "H" | "M" | "L"> = {};
  for (const li of leapItems) {
    const label = String(li?.label || "").trim();
    const sid = String(li?.id || "").trim();
    const tagId = label
      ? experienceSubdimensionIdForAim({ label })
      : sid.startsWith("exp-")
        ? sid
        : `exp-aim-${sid}`;
    const w = li?.weight === "H" || li?.weight === "M" || li?.weight === "L" ? li.weight : "M";
    subDimensionWeights[tagId] = w;
  }
  for (const a of Array.isArray(deAims) ? deAims : []) {
    if (String(a?.type || "") !== "leap" || typeof a?.label !== "string" || !isLeapAimActive(a)) continue;
    const id = experienceSubdimensionIdForAim({ id: a.id, label: a.label });
    const ol = a?.overrideLevel;
    if (ol === "H" || ol === "M" || ol === "L") subDimensionWeights[id] = ol;
    else if (!subDimensionWeights[id]) subDimensionWeights[id] = "M";
  }

  return { measures, overallMeasures, subDimensionWeights };
}
