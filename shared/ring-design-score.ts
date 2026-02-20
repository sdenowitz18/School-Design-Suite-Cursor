import type { RingDesignScoreData } from "./schema";

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

export function calculateRingDesignDimensionScores(
  rsd: RingDesignScoreData,
): { aimsScore: number | null; experienceScore: number | null; resourcesScore: number | null } {
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
  const leapsScore = safeScore(aims.leapsScore);
  if (leapsScore !== null) aimsItems.push({ score: leapsScore, weight: "M" });
  const outcomesScore = safeScore(aims.outcomesScore);
  if (outcomesScore !== null) aimsItems.push({ score: outcomesScore, weight: "M" });
  const aimsAvg = weightedAverage(aimsItems);

  // Student experience: Thoroughness (default L, changeable), Leapiness (H locked), Coherence (default L, changeable)
  const se = sub.studentExperience || {};
  const seItems: { score: number; weight: unknown }[] = [];
  const thoroughnessScore = safeScore(se.thoroughnessScore);
  if (thoroughnessScore !== null) seItems.push({ score: thoroughnessScore, weight: se.thoroughnessWeight ?? "L" });
  const leapinessScore = safeScore(se.leapinessScore);
  if (leapinessScore !== null) seItems.push({ score: leapinessScore, weight: "H" });
  const coherenceScore = safeScore(se.coherenceScore);
  if (coherenceScore !== null) seItems.push({ score: coherenceScore, weight: se.coherenceWeight ?? "L" });
  const seAvg = weightedAverage(seItems);

  // Supporting resources: Thoroughness/Quality/Coherence (default M, changeable)
  const sr = sub.supportingResources || {};
  const srItems: { score: number; weight: unknown }[] = [];
  const srThoroughnessScore = safeScore(sr.thoroughnessScore);
  if (srThoroughnessScore !== null) srItems.push({ score: srThoroughnessScore, weight: sr.thoroughnessWeight ?? "M" });
  const qualityScore = safeScore(sr.qualityScore);
  if (qualityScore !== null) srItems.push({ score: qualityScore, weight: sr.qualityWeight ?? "M" });
  const srCoherenceScore = safeScore(sr.coherenceScore);
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
    return safeScore(rsd.overallDesignScore);
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

