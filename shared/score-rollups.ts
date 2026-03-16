import { effectiveFromInstances } from "./score-instances";
import type { Measure, ScoreFilter, ScoringNode, ScoringNodeWeight } from "./schema";

const HML_WEIGHT: Record<ScoringNodeWeight, number> = { H: 4, M: 2, L: 1 };

function clampInt1to5(value: number): number {
  const rounded = Math.round(value);
  return Math.max(1, Math.min(5, rounded));
}

function safeHmlWeight(weight: unknown): number {
  if (weight === "H" || weight === "M" || weight === "L") return HML_WEIGHT[weight];
  return 1;
}

function weightedAverage(values: { score: number; weight: number }[]): number | null {
  let total = 0;
  let totalWeight = 0;
  for (const row of values) {
    if (!Number.isFinite(row.score) || !Number.isFinite(row.weight) || row.weight <= 0) continue;
    total += row.score * row.weight;
    totalWeight += row.weight;
  }
  if (totalWeight <= 0) return null;
  return total / totalWeight;
}

export function deriveMeasureScore(measure: Measure, filter: ScoreFilter | any): number | null {
  const instances = Array.isArray((measure as any)?.instances) ? ((measure as any).instances as any[]) : [];
  if (instances.length === 0) return null;
  return effectiveFromInstances(instances, filter).score;
}

function deriveLeafNodeScore(node: ScoringNode, filter: ScoreFilter | any): number | null {
  const measures = Array.isArray(node.measures) ? node.measures : [];
  const scored = measures
    .map((m: Measure) => {
      const score = deriveMeasureScore(m, filter);
      if (score === null) return null;
      const weight = safeHmlWeight((m as any)?.priority);
      return { score, weight };
    })
    .filter((x: { score: number; weight: number } | null): x is { score: number; weight: number } => !!x);
  if (scored.length === 0) return typeof node.score === "number" ? clampInt1to5(node.score) : null;
  const avg = weightedAverage(scored);
  return avg === null ? null : clampInt1to5(avg);
}

export function deriveNodeScore(node: ScoringNode, filter: ScoreFilter | any): number | null {
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length === 0) return deriveLeafNodeScore(node, filter);

  const childScored = children
    .map((child: ScoringNode) => {
      const score = deriveNodeScore(child, filter);
      if (score === null) return null;
      return { score, weight: safeHmlWeight(child.weight) };
    })
    .filter((x: { score: number; weight: number } | null): x is { score: number; weight: number } => !!x);

  if (childScored.length === 0) return typeof node.score === "number" ? clampInt1to5(node.score) : null;
  const avg = weightedAverage(childScored);
  return avg === null ? null : clampInt1to5(avg);
}

export function deriveTreeOverallScore(nodes: ScoringNode[], filter: ScoreFilter | any): number | null {
  const list = Array.isArray(nodes) ? nodes : [];
  const scored = list
    .map((node) => {
      const score = deriveNodeScore(node, filter);
      if (score === null) return null;
      return { score, weight: safeHmlWeight(node.weight) };
    })
    .filter((x): x is { score: number; weight: number } => !!x);

  if (scored.length === 0) return null;
  const avg = weightedAverage(scored);
  return avg === null ? null : clampInt1to5(avg);
}
