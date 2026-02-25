import type { RingDesignScoreData } from "./schema";
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
    const overallInstances: any[] = Array.isArray((rsd as any).overallInstances) ? ((rsd as any).overallInstances as any[]) : [];
    const instanceMode = hasAnyInstances(rsd);
    if (overallInstances.length > 0) return effectiveFromInstances(overallInstances as any, filter).score;
    return instanceMode ? null : safeScore(rsd.overallDesignScore);
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

