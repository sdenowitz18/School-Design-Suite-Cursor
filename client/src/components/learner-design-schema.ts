import type { TagDef } from "./expert-view/expert-view-types";

/**
 * Learner design taxonomy from "Design tags_updatedv2" — Learners sheet.
 * Columns: Set of design choices → Choice buckets → Primary tags → Secondary tags.
 * Two top-level questions:
 *   1) Learning attributes that affect what makes rest of design a strong fit
 *      Buckets: Demographic & situational factors, Grade Band, Incoming skills knowledge & mindsets
 *   2) Ways of selection-gating learners in parts of the experience
 *      Buckets: Selection Gating
 */

export type LearnerSecondaryDef = { id: string; label: string };

export type LearnerPrimaryDef = {
  id: string;
  label: string;
  secondaries?: LearnerSecondaryDef[];
};

export type LearnerBucketDef = {
  id: string;
  title: string;
  primaries: LearnerPrimaryDef[];
};

/** One major "set of design choices" — maps to a numbered question in the UI. */
export type LearnerSectionDef = {
  id: string;
  /** Shown as the main heading for this block */
  title: string;
  /**
   * The "set of design choices to make" — what the team is answering in this block.
   * Plain language + structured tags below map to this question.
   */
  setOfDesignChoices: string;
  buckets: LearnerBucketDef[];
};

/** Full hierarchy: two top-level questions, each with one or more choice buckets. */
export const LEARNER_SECTIONS: LearnerSectionDef[] = [
  {
    id: "learning_attributes",
    title: "Learning attributes that affect what makes rest of design a strong fit",
    setOfDesignChoices:
      "Learning attributes that affect what makes rest of design a strong fit",
    buckets: [
      {
        id: "demographic_situational",
        title: "Demographic & situational factors",
        primaries: [
          { id: "age_developmental", label: "Age / developmental stage" },
          { id: "gender", label: "Gender" },
          { id: "race_ethnicity", label: "Race / ethnicity" },
          { id: "tribal_indigenous", label: "Tribal / Indigenous identity" },
          { id: "sogi", label: "Sexual orientation and gender identity" },
          { id: "religious_cultural", label: "Religious or cultural background" },
          {
            id: "geography",
            label: "Geography",
            secondaries: [
              { id: "rural", label: "Rural" },
              { id: "urban", label: "Urban" },
              { id: "suburban", label: "Suburban" },
              { id: "silicon_valley", label: "In Silicon Valley (e.g.)" },
            ],
          },
          { id: "immigration_newcomer", label: "Immigration / newcomer / refugee status" },
          { id: "home_language", label: "Home language / multilingual learner status" },
          { id: "disability_neurodivergence", label: "Disability status / neurodivergence / learning differences" },
          { id: "socioeconomic", label: "Socioeconomic context" },
          { id: "family_education", label: "Family education background" },
          {
            id: "housing_mobility",
            label: "Housing stability / mobility",
            secondaries: [{ id: "transient", label: "Transient" }],
          },
          { id: "access_tech_transport", label: "Access to technology / internet / transportation" },
          { id: "family_structure", label: "Family structure and caregiving responsibilities" },
          { id: "systems_involvement", label: "Involvement with systems such as foster care or juvenile justice" },
        ],
      },
      {
        id: "grade_band",
        title: "Grade Band",
        primaries: [
          {
            id: "grade_preschool",
            label: "Preschool",
            secondaries: [
              { id: "preschool_3", label: "3-year-olds (PK3)" },
              { id: "preschool_4", label: "4-year-olds (PK4)" },
            ],
          },
          { id: "grade_kindergarten", label: "Kindergarten" },
          {
            id: "grade_elementary_school",
            label: "Elementary school",
            secondaries: [
              { id: "grade_1", label: "1st grade" },
              { id: "grade_2", label: "2nd grade" },
              { id: "grade_3", label: "3rd grade" },
              { id: "grade_4", label: "4th grade" },
              { id: "grade_5", label: "5th grade" },
            ],
          },
          {
            id: "grade_middle_school",
            label: "Middle school",
            secondaries: [
              { id: "grade_6", label: "6th grade" },
              { id: "grade_7", label: "7th grade" },
              { id: "grade_8", label: "8th grade" },
            ],
          },
          {
            id: "grade_high_school",
            label: "High school",
            secondaries: [
              { id: "grade_9", label: "9th grade" },
              { id: "grade_10", label: "10th grade" },
              { id: "grade_11", label: "11th grade" },
              { id: "grade_12", label: "12th grade" },
            ],
          },
        ],
      },
      {
        id: "incoming_skills_bucket",
        title: "Incoming skills, knowledge, and mindsets",
        primaries: [
          { id: "prior_knowledge", label: "Current skill level and prior knowledge" },
          { id: "interests_motivations", label: "Interests and motivations" },
          { id: "prior_experience_bias", label: "Prior experiences with success, failure, and bias" },
        ],
      },
    ],
  },
  {
    id: "selection_gating",
    title: "Ways of selection-gating learners in parts of the experience",
    setOfDesignChoices:
      "Ways of selection-gating learners in parts of the experience",
    buckets: [
      {
        id: "selection_gating_bucket",
        title: "Selection Gating",
        primaries: [
          { id: "mandatory_all", label: "Mandatory for all (for applic. grade levels)" },
          { id: "open_opt_in", label: "Open opt-in" },
          { id: "course_prerequisites", label: "Course prerequisites" },
          { id: "high_perf_invite", label: "High-performance-based invitation / honors" },
          { id: "low_perf_invite", label: "Low-performance-based invitation / remediation" },
          { id: "specific_populations", label: "For specific populations (ELLs, SPED, etc.)" },
        ],
      },
    ],
  },
];

/** Primaries under “Demographic & situational factors” — reuse for Adults Q2 (independent state). */
export const LEARNER_DEMOGRAPHIC_PRIMARIES: LearnerPrimaryDef[] =
  LEARNER_SECTIONS[0]?.buckets.find((b) => b.id === "demographic_situational")?.primaries ?? [];

/** Same taxonomy as `LEARNER_DEMOGRAPHIC_PRIMARIES` for A1-style buckets (custom tags, notes). */
export function learnerDemographicPrimariesAsTagDefs(): TagDef[] {
  return LEARNER_DEMOGRAPHIC_PRIMARIES.map((p) => ({
    id: p.id,
    label: p.label,
    secondaries: p.secondaries?.map((s) => ({ id: s.id, label: s.label })),
  }));
}

/** Resolve display label for a primary tag id (used in summaries). */
export function learnerPrimaryLabel(primaryId: string): string {
  for (const sec of LEARNER_SECTIONS) {
    for (const b of sec.buckets) {
      const p = b.primaries.find((x) => x.id === primaryId);
      if (p) return p.label;
    }
  }
  return primaryId.replace(/_/g, " ");
}

/** True if this selection should show as “key” in summaries: secondary keys when refinements exist, else primary `isKey`. */
export function learnerSelectionIsKey(sel: {
  secondaryIds?: string[];
  isKey?: boolean;
  secondaryKeys?: Record<string, boolean>;
}): boolean {
  const secIds = sel.secondaryIds ?? [];
  if (secIds.length > 0) {
    const sk = sel.secondaryKeys ?? {};
    return secIds.some((id) => sk[id]);
  }
  return !!sel.isKey;
}

/** Short preview string for chips (primary + optional secondaries). */
export function formatLearnerSelectionPreview(sel: { primaryId: string; secondaryIds?: string[] }): string {
  for (const sec of LEARNER_SECTIONS) {
    for (const b of sec.buckets) {
      const p = b.primaries.find((x) => x.id === sel.primaryId);
      if (!p) continue;
      const base = p.label;
      if (!p.secondaries?.length || !sel.secondaryIds?.length) return base;
      const labels = sel.secondaryIds
        .map((sid) => p.secondaries!.find((s) => s.id === sid)?.label)
        .filter(Boolean) as string[];
      return labels.length ? `${base}: ${labels.join(", ")}` : base;
    }
  }
  return sel.primaryId;
}
