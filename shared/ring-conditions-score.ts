import type { RingConditionsScoreData, RingConditionsStakeholderWeights } from "./schema";

export const DEFAULT_HML_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };

function hmlValue(v: unknown): number {
  if (v === "H" || v === "M" || v === "L") return DEFAULT_HML_MEANING[v];
  return DEFAULT_HML_MEANING.M;
}

function directionFactor(v: unknown): number {
  return v === "tailwind" ? 1 : v === "headwind" ? -1 : 0;
}

function getStakeholderWeight(weights: RingConditionsStakeholderWeights, group: any): number {
  const label = (weights as any)?.[group];
  return hmlValue(label);
}

export function calculateRingConditionsSum(data: RingConditionsScoreData): number | null {
  const conditions = data?.conditions || [];
  if (conditions.length === 0) return null;

  const weights = data?.stakeholderWeights as RingConditionsStakeholderWeights;
  let sum = 0;
  let hasAny = false;

  for (const c of conditions) {
    if (!c) continue;
    const sW = getStakeholderWeight(weights, (c as any).stakeholderGroup);
    const wS = hmlValue((c as any).windStrength);
    const dir = directionFactor((c as any).direction);
    if (dir === 0) continue;
    sum += dir * sW * wS;
    hasAny = true;
  }

  return hasAny ? sum : null;
}

export function mapConditionsSumToScore(sum: number | null): number | null {
  if (sum === null) return null;
  if (sum > 20) return 5;
  if (sum >= 8) return 4;
  if (sum >= -7) return 3;
  if (sum >= -20) return 2;
  return 1;
}

export function calculateRingConditionsScoreFromData(data: RingConditionsScoreData): { sum: number | null; score: number | null } {
  const sum = calculateRingConditionsSum(data);
  return { sum, score: mapConditionsSumToScore(sum) };
}

export function calculateRingConditionsScore(component: any): number | null {
  const hd: any = component?.healthData || {};
  const csd: RingConditionsScoreData | null = hd.ringConditionsScoreData || null;
  if (!csd) return null;
  return calculateRingConditionsScoreFromData(csd).score;
}

