import type { TagDef } from "./expert-view/expert-view-types";

/**
 * Learner design taxonomy from "Design tags_updatedv2" — Learners sheet.
 * Columns: Set of design choices → Choice buckets → Primary tags → Secondary tags.
 * "Incoming skills…" is a separate top-level block from "Learning attributes…" (not nested).
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

/** Full hierarchy: separate sections (each is its own design-choice question). */
export const LEARNER_SECTIONS: LearnerSectionDef[] = [
  {
    id: "learning_attributes",
    title: "Learning attributes & context",
    setOfDesignChoices:
      "Which learning attributes and situational factors should this component account for so the rest of the design is a strong fit for the young people you serve?",
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
    ],
  },
  {
    id: "incoming_skills",
    title: "Incoming skills, knowledge, and mindsets",
    setOfDesignChoices:
      "What are learners bringing into this experience in terms of prior knowledge, interests, and past experiences — including success, failure, and bias?",
    buckets: [
      {
        id: "incoming_skills_bucket",
        title: "Skills, knowledge & mindsets",
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
    title: "Selection & gating",
    setOfDesignChoices:
      "How are learners selected or gated into parts of this experience — who must participate, who can opt in, and how?",
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
