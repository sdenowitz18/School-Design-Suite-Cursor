import type { Measure, RingDesignMeasureBased, RingDesignScoreData, ScoreFilter } from "./schema";
import { effectiveFromInstances } from "./score-instances";

const DEFAULT_WEIGHT_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };

function clampInt1to5(value: number): number {
  const rounded = Math.round(value);
  return Math.max(1, Math.min(5, rounded));
}

function safeWeight(value: unknown): number {
  if (value === "H" || value === "M" || value === "L") return DEFAULT_WEIGHT_MEANING[value];
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  const i = Math.round(n);
  return i >= 1 ? i : 1;
}

function safeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function weightedAverage(scored: { score: number; weight: unknown }[]): number | null {
  let totalWeight = 0;
  let total = 0;
  for (const item of scored) {
    const w = safeWeight(item.weight);
    if (w <= 0) continue;
    totalWeight += w;
    total += item.score * w;
  }
  if (totalWeight <= 0) return null;
  return total / totalWeight;
}

function maybeRoundedScore(value: number | null): number | null {
  if (value === null) return null;
  return clampInt1to5(value);
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
  const selectedMeasures = measuresForSelectedPeriod(measures, filter);
  if (selectedMeasures.length === 0) return null;
  const scored: { score: number; weight: unknown }[] = [];
  for (const m of selectedMeasures) {
    const score = effectiveFromInstances((m as any)?.instances || [], filter).score;
    if (score === null) continue;
    scored.push({ score, weight: (m as any)?.priority || "M" });
  }
  const avg = weightedAverage(scored);
  return maybeRoundedScore(avg);
}

export type RingDesignMeasureDimensionScores = {
  aimsScore: number | null;
  completenessDesignedExperienceScore: number | null;
  qualityCompletenessSrrScore: number | null;
  coherenceDesignedExperienceScore: number | null;
  alignmentDesignedExperienceScore: number | null;
  coherenceChildren: {
    qualityOfMaterialsScore: number | null;
    qualityOfMaterialsCompilationScore: number | null;
  };
};

export function calculateRingDesignMeasureDimensionScores(rsd: RingDesignScoreData): RingDesignMeasureDimensionScores {
  const filter: any = (rsd as any).filter || { mode: "none", aggregation: "singleLatest" };
  const mb = (rsd as any).measureBasedDesign as RingDesignMeasureBased | undefined;
  const dims: any = mb?.dimensions || {};
  const aimsScore = scoreFromMeasures((dims?.aims?.measures || []) as Measure[], filter);
  const completenessDesignedExperienceScore = scoreFromMeasures((dims?.completenessDesignedExperience?.measures || []) as Measure[], filter);
  const qualityCompletenessSrrScore = scoreFromMeasures((dims?.qualityCompletenessSrr?.measures || []) as Measure[], filter);
  const alignmentDesignedExperienceScore = scoreFromMeasures((dims?.alignmentDesignedExperience?.measures || []) as Measure[], filter);

  const coherenceQualityScore = scoreFromMeasures((dims?.coherenceDesignedExperience?.qualityOfMaterials?.measures || []) as Measure[], filter);
  const coherenceCompilationScore = scoreFromMeasures((dims?.coherenceDesignedExperience?.qualityOfMaterialsCompilation?.measures || []) as Measure[], filter);
  const childWeights = dims?.coherenceDesignedExperience?.childWeights || {};
  const coherenceAvg = weightedAverage(
    [
      { score: coherenceQualityScore ?? NaN, weight: childWeights?.qualityOfMaterialsWeight ?? "M" },
      { score: coherenceCompilationScore ?? NaN, weight: childWeights?.qualityOfMaterialsCompilationWeight ?? "M" },
    ].filter((x) => Number.isFinite(x.score)) as { score: number; weight: unknown }[],
  );

  return {
    aimsScore,
    completenessDesignedExperienceScore,
    qualityCompletenessSrrScore,
    coherenceDesignedExperienceScore: maybeRoundedScore(coherenceAvg),
    alignmentDesignedExperienceScore,
    coherenceChildren: {
      qualityOfMaterialsScore: coherenceQualityScore,
      qualityOfMaterialsCompilationScore: coherenceCompilationScore,
    },
  };
}

function hasAnyInstances(rsd: RingDesignScoreData): boolean {
  const overall: any[] = Array.isArray((rsd as any).overallInstances) ? ((rsd as any).overallInstances as any[]) : [];
  if (overall.length > 0) return true;

  const sub: any = (rsd as any).subDimensions || {};
  const aims: any = sub.aims || {};
  const se: any = sub.studentExperience || {};
  const sr: any = sub.supportingResources || {};

  const lists: any[] = [
    aims.leapsInstances,
    aims.outcomesInstances,
    se.thoroughnessInstances,
    se.leapinessInstances,
    se.coherenceInstances,
    sr.thoroughnessInstances,
    sr.qualityInstances,
    sr.coherenceInstances,
  ];
  return lists.some((x) => Array.isArray(x) && x.length > 0);
}

function scoreFromInstancesOrLegacy(args: {
  instances: unknown;
  legacyScore: unknown;
  filter: any;
  instanceMode: boolean;
}): number | null {
  const { instances, legacyScore, filter, instanceMode } = args;
  if (Array.isArray(instances)) {
    const eff = effectiveFromInstances(instances as any, filter).score;
    if (eff !== null) return eff;
    return instanceMode ? null : safeScore(legacyScore);
  }
  return safeScore(legacyScore);
}

export function calculateRingDesignDimensionScores(
  rsd: RingDesignScoreData,
): { aimsScore: number | null; experienceScore: number | null; resourcesScore: number | null } {
  const filter: any = (rsd as any).filter || { mode: "none", aggregation: "singleLatest" };
  const instanceMode = hasAnyInstances(rsd);
  const sub = (rsd as any).subDimensions;
  if (!sub) {
    const aimsScore = safeScore((rsd as any).designDimensions?.aimsScore);
    const experienceScore = safeScore((rsd as any).designDimensions?.experienceScore);
    const resourcesScore = safeScore((rsd as any).designDimensions?.resourcesScore);
    return { aimsScore, experienceScore, resourcesScore };
  }

  // Aims: Leaps (M locked), Outcomes (M locked)
  const aims = sub.aims || {};
  const aimsItems: { score: number; weight: unknown }[] = [];
  const leapsScore = scoreFromInstancesOrLegacy({
    instances: (aims as any).leapsInstances,
    legacyScore: (aims as any).leapsScore,
    filter,
    instanceMode,
  });
  if (leapsScore !== null) aimsItems.push({ score: leapsScore, weight: "M" });
  const outcomesScore = scoreFromInstancesOrLegacy({
    instances: (aims as any).outcomesInstances,
    legacyScore: (aims as any).outcomesScore,
    filter,
    instanceMode,
  });
  if (outcomesScore !== null) aimsItems.push({ score: outcomesScore, weight: "M" });
  const aimsAvg = weightedAverage(aimsItems);

  // Student experience: Thoroughness (default L, changeable), Leapiness (H locked), Coherence (default L, changeable)
  const se = sub.studentExperience || {};
  const seItems: { score: number; weight: unknown }[] = [];
  const thoroughnessScore = scoreFromInstancesOrLegacy({
    instances: (se as any).thoroughnessInstances,
    legacyScore: (se as any).thoroughnessScore,
    filter,
    instanceMode,
  });
  if (thoroughnessScore !== null) seItems.push({ score: thoroughnessScore, weight: se.thoroughnessWeight ?? "L" });
  const leapinessScore = scoreFromInstancesOrLegacy({
    instances: (se as any).leapinessInstances,
    legacyScore: (se as any).leapinessScore,
    filter,
    instanceMode,
  });
  if (leapinessScore !== null) seItems.push({ score: leapinessScore, weight: "H" });
  const coherenceScore = scoreFromInstancesOrLegacy({
    instances: (se as any).coherenceInstances,
    legacyScore: (se as any).coherenceScore,
    filter,
    instanceMode,
  });
  if (coherenceScore !== null) seItems.push({ score: coherenceScore, weight: se.coherenceWeight ?? "L" });
  const seAvg = weightedAverage(seItems);

  // Supporting resources: Thoroughness/Quality/Coherence (default M, changeable)
  const sr = sub.supportingResources || {};
  const srItems: { score: number; weight: unknown }[] = [];
  const srThoroughnessScore = scoreFromInstancesOrLegacy({
    instances: (sr as any).thoroughnessInstances,
    legacyScore: (sr as any).thoroughnessScore,
    filter,
    instanceMode,
  });
  if (srThoroughnessScore !== null) srItems.push({ score: srThoroughnessScore, weight: sr.thoroughnessWeight ?? "M" });
  const qualityScore = scoreFromInstancesOrLegacy({
    instances: (sr as any).qualityInstances,
    legacyScore: (sr as any).qualityScore,
    filter,
    instanceMode,
  });
  if (qualityScore !== null) srItems.push({ score: qualityScore, weight: sr.qualityWeight ?? "M" });
  const srCoherenceScore = scoreFromInstancesOrLegacy({
    instances: (sr as any).coherenceInstances,
    legacyScore: (sr as any).coherenceScore,
    filter,
    instanceMode,
  });
  if (srCoherenceScore !== null) srItems.push({ score: srCoherenceScore, weight: sr.coherenceWeight ?? "M" });
  const srAvg = weightedAverage(srItems);

  return {
    aimsScore: maybeRoundedScore(aimsAvg),
    experienceScore: maybeRoundedScore(seAvg),
    resourcesScore: maybeRoundedScore(srAvg),
  };
}

export function calculateRingDesignScore(
  ringComponent:
    | {
        healthData?: {
          ringDesignScoreData?: RingDesignScoreData;
        };
      }
    | null
    | undefined,
): number | null {
  const rsd = ringComponent?.healthData?.ringDesignScoreData;
  if (!rsd) return null;

  if (rsd.designScoringMode === "overall") {
    const filter: any = (rsd as any).filter || { mode: "none", aggregation: "singleLatest" };
    const overallMeasures: Measure[] = Array.isArray((rsd as any).overallMeasures) ? (((rsd as any).overallMeasures as unknown[]) as Measure[]) : [];
    if (overallMeasures.length > 0) {
      return scoreFromMeasures(overallMeasures, filter);
    }
    const overallInstances: any[] = Array.isArray((rsd as any).overallInstances) ? ((rsd as any).overallInstances as any[]) : [];
    const instanceMode = hasAnyInstances(rsd);
    if (overallInstances.length > 0) return effectiveFromInstances(overallInstances as any, filter).score;
    return instanceMode ? null : safeScore(rsd.overallDesignScore);
  }

  const mb = (rsd as any).measureBasedDesign as RingDesignMeasureBased | undefined;
  if (mb) {
    const scores = calculateRingDesignMeasureDimensionScores(rsd);
    const w = mb.weights || ({} as any);
    const rows = [
      { score: scores.aimsScore, weight: (w as any).aimsWeight ?? "M" },
      { score: scores.completenessDesignedExperienceScore, weight: (w as any).completenessDesignedExperienceWeight ?? "M" },
      { score: scores.qualityCompletenessSrrScore, weight: (w as any).qualityCompletenessSrrWeight ?? "M" },
      { score: scores.coherenceDesignedExperienceScore, weight: (w as any).coherenceDesignedExperienceWeight ?? "M" },
      { score: scores.alignmentDesignedExperienceScore, weight: (w as any).alignmentDesignedExperienceWeight ?? "M" },
    ].filter((r): r is { score: number; weight: unknown } => r.score !== null);
    if (rows.length === 0) return null;
    const avg = weightedAverage(rows);
    return avg === null ? null : clampInt1to5(avg);
  }

  const dimScores = calculateRingDesignDimensionScores(rsd);
  const aimsScore = dimScores.aimsScore;
  const experienceScore = dimScores.experienceScore;
  const resourcesScore = dimScores.resourcesScore;

  const aimsWeight = safeWeight(rsd.designWeights?.aimsWeight);
  const experienceWeight = safeWeight(rsd.designWeights?.experienceWeight);
  const resourcesWeight = safeWeight(rsd.designWeights?.resourcesWeight);

  const dims: { score: number; weight: number }[] = [];
  if (aimsScore !== null) dims.push({ score: aimsScore, weight: aimsWeight });
  if (experienceScore !== null) dims.push({ score: experienceScore, weight: experienceWeight });
  if (resourcesScore !== null) dims.push({ score: resourcesScore, weight: resourcesWeight });
  if (dims.length === 0) return null;

  const avg = weightedAverage(dims.map((d) => ({ score: d.score, weight: d.weight })));
  if (avg === null) return null;
  return clampInt1to5(avg);
}

