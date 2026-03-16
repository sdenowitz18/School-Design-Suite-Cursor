import type { Measure, RingImplementationInstance, RingImplementationMeasureBased, RingImplementationScoreData, ScoreFilter } from "./schema";
import { effectiveFromInstances as effectiveFromScoreInstances } from "./score-instances";
import { deriveTreeOverallScore } from "./score-rollups";

const WEIGHT_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };
const ITEM_PRIORITY_WEIGHT: Record<"H" | "M" | "L", number> = { H: 6, M: 3, L: 1 };

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

function itemPriorityWeight(label: unknown): number {
  const l = safeWeightLabel(label);
  return ITEM_PRIORITY_WEIGHT[l] ?? 1;
}

function effectiveFromInstances(instances: RingImplementationInstance[], filter: any): { score: number | null; weight: number | null } {
  return effectiveFromScoreInstances(instances as any, filter as any);
}

function periodRankFromFilter(filter: ScoreFilter | any): number | null {
  const mode = String(filter?.mode || "none");
  if (mode === "year") {
    const y = Number(String(filter?.yearKey || ""));
    return Number.isFinite(y) ? y * 10 : null;
  }
  if (mode === "semester") {
    const key = String(filter?.semesterKey || "");
    const [yRaw, semRaw] = key.split("-");
    const y = Number(yRaw);
    if (!Number.isFinite(y)) return null;
    const sem = semRaw === "Fall" ? 1 : semRaw === "Spring" ? 2 : null;
    return sem ? y * 10 + sem : null;
  }
  if (mode === "quarter") {
    const key = String(filter?.quarterKey || "");
    const [yRaw, qRaw] = key.split("-");
    const y = Number(yRaw);
    if (!Number.isFinite(y)) return null;
    const q = qRaw === "Q1" ? 1 : qRaw === "Q2" ? 2 : qRaw === "Q3" ? 3 : qRaw === "Q4" ? 4 : null;
    return q ? y * 10 + q : null;
  }
  return null;
}

function periodRankFromMeasure(measure: Measure): number | null {
  const mp: any = (measure as any)?.markingPeriod;
  if (!mp) return null;
  const mode = String(mp?.mode || "");
  if (mode === "year") {
    const y = Number(String(mp?.yearKey || ""));
    return Number.isFinite(y) ? y * 10 : null;
  }
  if (mode === "semester") {
    const key = String(mp?.semesterKey || "");
    const [yRaw, semRaw] = key.split("-");
    const y = Number(yRaw);
    if (!Number.isFinite(y)) return null;
    const sem = semRaw === "Fall" ? 1 : semRaw === "Spring" ? 2 : null;
    return sem ? y * 10 + sem : null;
  }
  if (mode === "quarter") {
    const key = String(mp?.quarterKey || "");
    const [yRaw, qRaw] = key.split("-");
    const y = Number(yRaw);
    if (!Number.isFinite(y)) return null;
    const q = qRaw === "Q1" ? 1 : qRaw === "Q2" ? 2 : qRaw === "Q3" ? 3 : qRaw === "Q4" ? 4 : null;
    return q ? y * 10 + q : null;
  }
  return null;
}

function measuresForSelectedPeriod(measures: Measure[], filter: ScoreFilter | any): Measure[] {
  const mode = String(filter?.mode || "none");
  if (mode === "none") return measures;
  const selected = periodRankFromFilter(filter);
  if (selected === null) return measures;
  const withRanks = measures
    .map((m) => ({ measure: m, rank: periodRankFromMeasure(m) }))
    .filter((x) => x.rank !== null && (x.rank as number) <= selected);
  if (withRanks.length === 0) return [];
  const target = Math.max(...withRanks.map((x) => x.rank as number));
  return withRanks.filter((x) => x.rank === target).map((x) => x.measure);
}

function scoreFromMeasures(measures: Measure[], filter: ScoreFilter | any): number | null {
  const selected = measuresForSelectedPeriod(measures, filter);
  if (selected.length === 0) return null;
  const rows: { score: number; weight: number }[] = [];
  for (const m of selected) {
    const score = effectiveFromScoreInstances(((m as any)?.instances || []) as any, filter as any).score;
    if (score === null) continue;
    rows.push({ score, weight: itemPriorityWeight((m as any)?.priority || "M") });
  }
  if (rows.length === 0) return null;
  const totalW = rows.reduce((s, r) => s + r.weight, 0);
  if (totalW <= 0) return null;
  return clampInt1to5(rows.reduce((s, r) => s + r.score * r.weight, 0) / totalW);
}

export type RingImplementationMeasureDimensionScores = {
  studentsEnrollmentScore: number | null;
  feasibilitySustainabilityScore: number | null;
  fidelityDesignedExperienceScore: number | null;
  skillfulnessInstructionFacilitationScore: number | null;
  measurementAdministrationQualityScore: number | null;
  skillfulnessChildren: {
    classroomManagementDeliveryOutcomesScore: number | null;
    inspireMotivateEngagementScore: number | null;
  };
};

export function calculateRingImplementationMeasureDimensionScores(
  data: RingImplementationScoreData,
): RingImplementationMeasureDimensionScores {
  const filter: any = (data as any).filter || { mode: "none", aggregation: "singleLatest" };
  const mb = (data as any).measureBasedImplementation as RingImplementationMeasureBased | undefined;
  const dims: any = mb?.dimensions || {};
  const studentsEnrollmentScore = scoreFromMeasures((dims?.studentsEnrollment?.measures || []) as Measure[], filter);
  const feasibilitySustainabilityScore = scoreFromMeasures((dims?.feasibilitySustainability?.measures || []) as Measure[], filter);
  const fidelityDesignedExperienceScore = scoreFromMeasures((dims?.fidelityDesignedExperience?.measures || []) as Measure[], filter);
  const measurementAdministrationQualityScore = scoreFromMeasures((dims?.measurementAdministrationQuality?.measures || []) as Measure[], filter);
  const skillA = scoreFromMeasures((dims?.skillfulnessInstructionFacilitation?.classroomManagementDeliveryOutcomes?.measures || []) as Measure[], filter);
  const skillB = scoreFromMeasures((dims?.skillfulnessInstructionFacilitation?.inspireMotivateEngagement?.measures || []) as Measure[], filter);
  const cw = dims?.skillfulnessInstructionFacilitation?.childWeights || {};
  const childRows = [
    { score: skillA, weight: weightValue(cw?.classroomManagementDeliveryOutcomesWeight ?? "M") },
    { score: skillB, weight: weightValue(cw?.inspireMotivateEngagementWeight ?? "M") },
  ].filter((x): x is { score: number; weight: number } => x.score !== null);
  const skillfulnessInstructionFacilitationScore =
    childRows.length > 0
      ? clampInt1to5(childRows.reduce((s, r) => s + r.score * r.weight, 0) / Math.max(1, childRows.reduce((s, r) => s + r.weight, 0)))
      : null;
  return {
    studentsEnrollmentScore,
    feasibilitySustainabilityScore,
    fidelityDesignedExperienceScore,
    skillfulnessInstructionFacilitationScore,
    measurementAdministrationQualityScore,
    skillfulnessChildren: {
      classroomManagementDeliveryOutcomesScore: skillA,
      inspireMotivateEngagementScore: skillB,
    },
  };
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
  const canonicalTree = Array.isArray((data as any).canonicalTree?.nodes) ? ((data as any).canonicalTree.nodes as any[]) : [];

  if ((data as any).implementationScoringMode === "overall") {
    const overallMeasures = Array.isArray((data as any).overallMeasures) ? ((data as any).overallMeasures as Measure[]) : [];
    if (overallMeasures.length > 0) {
      return scoreFromMeasures(overallMeasures, filter);
    }
    const overallInstances = ((data as any).overallInstances || []) as RingImplementationInstance[];
    if (Array.isArray(overallInstances) && overallInstances.length > 0) {
      const eff = effectiveFromInstances(overallInstances, filter);
      return eff.score;
    }
    return safeScore((data as any).overallImplementationScore);
  }

  if (canonicalTree.length > 0) {
    const derived = deriveTreeOverallScore(canonicalTree as any, filter);
    if (derived !== null) return derived;
  }

  const mb = (data as any).measureBasedImplementation as RingImplementationMeasureBased | undefined;
  if (mb) {
    const d = calculateRingImplementationMeasureDimensionScores(data);
    const w = mb.weights || ({} as any);
    const rows = [
      { score: d.studentsEnrollmentScore, weight: weightValue((w as any).studentsEnrollmentWeight ?? "M") },
      { score: d.feasibilitySustainabilityScore, weight: weightValue((w as any).feasibilitySustainabilityWeight ?? "M") },
      { score: d.fidelityDesignedExperienceScore, weight: weightValue((w as any).fidelityDesignedExperienceWeight ?? "M") },
      { score: d.skillfulnessInstructionFacilitationScore, weight: weightValue((w as any).skillfulnessInstructionFacilitationWeight ?? "M") },
      { score: d.measurementAdministrationQualityScore, weight: weightValue((w as any).measurementAdministrationQualityWeight ?? "M") },
    ].filter((x): x is { score: number; weight: number } => x.score !== null);
    if (rows.length > 0) {
      const totalW = rows.reduce((s, r) => s + r.weight, 0);
      if (totalW > 0) return clampInt1to5(rows.reduce((s, r) => s + r.score * r.weight, 0) / totalW);
    }
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

    const itemScores: { score: number; weight: number }[] = [];
    const items = Array.isArray(dim.items) ? dim.items : [];
    for (const item of items) {
      const itemInstances = (item?.instances || []) as RingImplementationInstance[];
      if (!Array.isArray(itemInstances) || itemInstances.length === 0) continue;
      const eff = effectiveFromInstances(itemInstances, filter);
      if (eff.score === null) continue;
      itemScores.push({ score: eff.score, weight: itemPriorityWeight((item as any)?.priority) });
    }
    if (itemScores.length > 0) {
      const itemTotalWeight = itemScores.reduce((s, d) => s + d.weight, 0);
      if (itemTotalWeight > 0) {
        const itemWeighted = itemScores.reduce((s, d) => s + d.score * d.weight, 0) / itemTotalWeight;
        dims.push({ score: clampInt1to5(itemWeighted), weight: weightValue(dim.weight) });
        continue;
      }
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

