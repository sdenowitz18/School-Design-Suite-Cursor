import { OUTCOME_SCHEMA } from "@/components/designed-experience-schemas";
import { normOutcomeKey } from "@/components/outcomes-utils";

export type OutcomeHealthBucketKey = "learningAdvancementOutcomeScoreData" | "wellbeingConductOutcomeScoreData";

/** Maps a designed-experience outcome label (L2 or L3 in `OUTCOME_SCHEMA`) to the healthData bucket that stores its score data. */
export function outcomeHealthBucketForLabel(label: string): OutcomeHealthBucketKey {
  const n = normOutcomeKey(label);
  for (const [l1, l2map] of Object.entries(OUTCOME_SCHEMA)) {
    const isWb = l1 === "Wellbeing" || l1 === "Conduct & Engagement";
    for (const [l2, l3s] of Object.entries(l2map)) {
      if (normOutcomeKey(l2) === n) return isWb ? "wellbeingConductOutcomeScoreData" : "learningAdvancementOutcomeScoreData";
      for (const l3 of l3s) {
        if (normOutcomeKey(l3) === n) return isWb ? "wellbeingConductOutcomeScoreData" : "learningAdvancementOutcomeScoreData";
      }
    }
  }
  return "learningAdvancementOutcomeScoreData";
}
