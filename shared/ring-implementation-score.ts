import type { RingImplementationScoreData } from "./schema";

const WEIGHT_MEANING: Record<"H" | "M" | "L", number> = { H: 4, M: 2, L: 1 };

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

  if ((data as any).implementationScoringMode === "overall") {
    return safeScore((data as any).overallImplementationScore);
  }

  const dims: { score: number; weight: number }[] = [];
  for (const key of ["quality", "fidelity", "scale", "learnerDemand"] as const) {
    const dim: any = (data as any).dimensions?.[key] || {};
    const score = safeScore(dim.score);
    if (score === null) continue; // blank scores are excluded
    const weightLabel = safeWeightLabel(dim.weight);
    const w = WEIGHT_MEANING[weightLabel] || 1;
    dims.push({ score, weight: w });
  }

  if (dims.length === 0) return null;

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  if (totalWeight <= 0) return null;

  const weighted = dims.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight;
  return clampInt1to5(weighted);
}

