/**
 * Computes and mutates the same `final*Score` fields the client autosaves
 * (canvas Key Drivers, octagon footers, ring dimension headers).
 * Use after building measures/weights; uses `filter: { mode: "none" }` so all
 * seeded instance dates are included in rollups.
 */

import { calcFinalDesignScore } from "../../shared/design-score-calc";
import { calcFinalImplementationScore } from "../../shared/implementation-score-calc";
import { calcFinalExperienceScore } from "../../shared/experience-score-calc";
import { calcOverallOutcomeScore } from "../../shared/outcome-score-calc";
import { LEARNING_ADVANCEMENT_OUTCOME_TREE, WELLBEING_CONDUCT_OUTCOME_TREE } from "../../shared/outcome-subdimension-tree";
import { experienceHealthSubdimensions } from "../../shared/experience-subdimension-tree";
import { calculateRingConditionsScoreFromData } from "../../shared/ring-conditions-score";
import type { OutcomeMeasure } from "../../shared/schema";

const SEED_FILTER: Record<string, unknown> = { mode: "none" };

function round1to5(n: number | null): number | null {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/**
 * Mutates `health` in place, adding:
 *   designScoreData: finalDesignScore, filter
 *   implementationScoreData: finalImplementationScore, filter
 *   learningAdvancementOutcomeScoreData: finalOutcomeScore, filter
 *   wellbeingConductOutcomeScoreData: finalOutcomeScore, filter
 *   experienceScoreData: finalExperienceScore, filter
 *   ringConditionsScoreData (if present, with non-empty conditions): finalConditionsScore, conditionsSum, filter
 */
export function attachFinalScores(health: Record<string, unknown>, allComponents: unknown): void {
  if (health.designScoreData) {
    const d = health.designScoreData as Record<string, any>;
    d.filter = SEED_FILTER;
    d.finalDesignScore = round1to5(
      calcFinalDesignScore(
        (d.measures as OutcomeMeasure[]) || [],
        (d.overallMeasures as OutcomeMeasure[]) || [],
        d.subDimensionWeights || {},
        SEED_FILTER,
      ),
    );
  }

  if (health.implementationScoreData) {
    const d = health.implementationScoreData as Record<string, any>;
    d.filter = SEED_FILTER;
    d.finalImplementationScore = round1to5(
      calcFinalImplementationScore(
        (d.measures as OutcomeMeasure[]) || [],
        (d.overallMeasures as OutcomeMeasure[]) || [],
        d.subDimensionWeights || {},
        SEED_FILTER,
      ),
    );
  }

  if (health.learningAdvancementOutcomeScoreData) {
    const d = health.learningAdvancementOutcomeScoreData as Record<string, any>;
    d.filter = SEED_FILTER;
    d.finalOutcomeScore = round1to5(
      calcOverallOutcomeScore(
        (d.measures as OutcomeMeasure[]) || [],
        (d.overallMeasures as OutcomeMeasure[]) || [],
        d.subDimensionWeights || {},
        SEED_FILTER,
        LEARNING_ADVANCEMENT_OUTCOME_TREE,
      ),
    );
  }

  if (health.wellbeingConductOutcomeScoreData) {
    const d = health.wellbeingConductOutcomeScoreData as Record<string, any>;
    d.filter = SEED_FILTER;
    d.finalOutcomeScore = round1to5(
      calcOverallOutcomeScore(
        (d.measures as OutcomeMeasure[]) || [],
        (d.overallMeasures as OutcomeMeasure[]) || [],
        d.subDimensionWeights || {},
        SEED_FILTER,
        WELLBEING_CONDUCT_OUTCOME_TREE,
      ),
    );
  }

  if (health.experienceScoreData) {
    const d = health.experienceScoreData as Record<string, any>;
    d.filter = SEED_FILTER;
    const tops = experienceHealthSubdimensions(allComponents);
    d.finalExperienceScore = round1to5(
      calcFinalExperienceScore(
        (d.measures as OutcomeMeasure[]) || [],
        (d.overallMeasures as OutcomeMeasure[]) || [],
        d.subDimensionWeights || {},
        SEED_FILTER,
        tops,
      ),
    );
  }

  if (health.ringConditionsScoreData) {
    const c = health.ringConditionsScoreData as Record<string, any>;
    if (Array.isArray(c.conditions) && c.conditions.length > 0) {
      c.filter =
        c.filter && typeof c.filter === "object" && (c.filter as any).mode
          ? c.filter
          : { mode: "none", aggregation: "singleLatest" };
      const { sum, score } = calculateRingConditionsScoreFromData(c);
      c.finalConditionsScore = round1to5(score);
      c.conditionsSum = sum;
    }
  }
}
