/**
 * Adult roles taxonomy from "Design tags_updatedv2" — Adults (2) sheet.
 * Column layout: Primary tags (col G) → Secondary tags (H onward).
 * Q2 "other information" rows reference the same A1/A5 patterns as Learners / Facilitator background.
 */

export type AdultSecondaryDef = { id: string; label: string };

export type AdultPrimaryDef = {
  id: string;
  label: string;
  secondaries?: AdultSecondaryDef[];
};

export type AdultBucketDef = {
  id: string;
  title: string;
  primaries: AdultPrimaryDef[];
};

/** One major "set of design choices" — maps to a numbered question in the UI. */
export type AdultSectionDef = {
  id: string;
  title: string;
  setOfDesignChoices: string;
  buckets: AdultBucketDef[];
};

/** UI pattern from the workbook Type column (A-1 special, A1, A5). */
export type AdultInfoUiType = "A1" | "A5" | "A-1";

/** Per-role detail buckets for Q2 (one block per selected role path repeats these). */
export type AdultAdditionalInfoBucketDef = {
  id: string;
  title: string;
  /** Spreadsheet notation */
  uiType: AdultInfoUiType;
  /** Designer / dev notes from the sheet (not shown to end users). */
  devNotes?: string;
  /** Omit from v1 UI (e.g. Name / PII). */
  postMvp?: boolean;
};

/** Question 1 — which adult roles to design for (A-1 special in the workbook). */
export const ADULT_ROLE_SECTIONS: AdultSectionDef[] = [
  {
    id: "adult_roles",
    title: "Adult roles",
    setOfDesignChoices: "What adult roles do you want to design experiences for?",
    buckets: [
      {
        id: "adult_roles_bucket",
        title: "Adult Roles",
        primaries: [
          {
            id: "educators",
            label: "Educators",
            secondaries: [
              { id: "educators_core_courses", label: "Educators for core courses" },
              { id: "educators_other_learner_experiences", label: "Educators for other learner experiences" },
            ],
          },
          {
            id: "caregivers_families",
            label: "Caregivers / families",
            secondaries: [
              { id: "primary_caregivers", label: "Primary caregivers" },
              { id: "siblings", label: "Siblings" },
              { id: "extended_family", label: "Extended family" },
            ],
          },
          {
            id: "school_leaders_administrators",
            label: "School leaders & administrators",
            secondaries: [
              { id: "principal_head_of_school", label: "Principal(s) / Head(s) of School" },
              { id: "ap_dean_school", label: "AP(s) / Dean(s) School" },
              { id: "ops_business_managers", label: "Ops / Business Manager(s)" },
              { id: "data_assessment_coordinators", label: "Data or Assessment Coordinator(s)" },
              { id: "school_based_design_lead", label: "School-based design lead or design partner" },
            ],
          },
          {
            id: "student_support_wellbeing_staff",
            label: "Student support & wellbeing staff",
            secondaries: [
              { id: "school_counselors", label: "School counselor(s)" },
              { id: "social_workers", label: "Social worker(s)" },
              { id: "school_psychologists", label: "School psychologist(s)" },
              { id: "nurse_health_coordinators", label: "Nurse / health coordinator(s)" },
              {
                id: "coordinators_exceptional_needs",
                label: "Coordinators for learners with exceptional needs (IEPs, ELL, G&T, etc.)",
              },
            ],
          },
          {
            id: "school_operations_support_staff",
            label: "School operations & support staff",
            secondaries: [
              { id: "family_engagement_coordinators", label: "Family engagement coordinator(s)" },
              { id: "community_partnership_managers", label: "Community partnership manager(s)" },
              { id: "enrollment_admissions_coordinators", label: "Enrollment / admissions coordinator(s)" },
              { id: "office_managers_admin_assistants", label: "Office manager(s) / administrative assistant(s)" },
              { id: "facilities_custodial_staff", label: "Facilities / custodial staff" },
              { id: "food_service_staff", label: "Food service staff" },
              { id: "it_technology_specialists", label: "IT / technology specialist(s)" },
              { id: "after_school_program_coordinators", label: "After-school program coordinator(s)" },
              { id: "school_operations_other", label: "Other" },
            ],
          },
          {
            id: "district_leaders_staff",
            label: "District leaders & staff",
            secondaries: [
              { id: "superintendent", label: "Superintendent" },
              { id: "district_cabinet_members", label: "District Cabinet member(s)" },
              { id: "instructional_coaches", label: "Instructional coach(es)" },
              { id: "district_based_design_partners", label: "District-based design partner(s)" },
              { id: "other_district_staff", label: "Other district staff" },
            ],
          },
          {
            id: "other_adults",
            label: "Other adults",
            secondaries: [
              { id: "local_community_political_leaders", label: "Local community & political leader(s)" },
              { id: "school_board_members", label: "School board member(s)" },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * Question 2 — information to specify per selected role (sheet rows 10–14).
 * Demographics reuse the learner demographic & situational schema in the UI (A1).
 * Adult background uses the facilitator background tag tree, stored separately on adultsProfile.
 */
export const ADULT_ADDITIONAL_INFO_BUCKETS: AdultAdditionalInfoBucketDef[] = [
  {
    id: "demographic_situational",
    title: "Demographic & situational factors",
    uiType: "A1",
    devNotes: "[same schema as learner demographic & situational factors]",
  },
  {
    id: "incoming_skills_knowledge_mindsets",
    title: "Incoming skills, knowledge, & mindsets",
    uiType: "A5",
    devNotes: "Leave as free text for now until we get the new schema",
  },
  {
    id: "adult_background",
    title: "Adult Background",
    uiType: "A-1",
    devNotes: "Use facilitator background schema from facilitator roles & configurations element; clone tags under adultsProfile.",
  },
  {
    id: "approach_to_staffing",
    title: "Approach to Staffing",
    uiType: "A5",
  },
  {
    id: "name",
    title: "Names",
    uiType: "A5",
  },
];

export const ADULT_ADDITIONAL_INFO_BUCKETS_V1 = ADULT_ADDITIONAL_INFO_BUCKETS.filter((b) => !b.postMvp);

export function findAdultPrimary(primaryId: string): AdultPrimaryDef | undefined {
  for (const sec of ADULT_ROLE_SECTIONS) {
    for (const b of sec.buckets) {
      const p = b.primaries.find((x) => x.id === primaryId);
      if (p) return p;
    }
  }
  return undefined;
}

/**
 * One detail block per top-level primary role, regardless of which secondaries were
 * selected. Secondaries remain useful for Q1 role-refinement display but the Q2
 * "define in more detail" section always operates at the primary level.
 */
export function adultSliceKeysFromSelections(
  selections: { primaryId: string; secondaryIds?: string[] }[] | null | undefined,
): string[] {
  if (!Array.isArray(selections)) return [];
  const seen = new Set<string>();
  for (const sel of selections) {
    if (!findAdultPrimary(sel.primaryId)) continue;
    seen.add(sel.primaryId);
  }
  return Array.from(seen);
}

/** Heading for a Q2 per-role block. */
export function formatAdultSliceTitle(sliceKey: string): string {
  if (!sliceKey.includes("::")) {
    return adultPrimaryLabel(sliceKey);
  }
  const [pid, sid] = sliceKey.split("::");
  const p = findAdultPrimary(pid);
  if (!p) return sliceKey;
  const sl = p.secondaries?.find((s) => s.id === sid)?.label ?? sid;
  return `${p.label}: ${sl}`;
}

/** Resolve display label for a primary tag id. */
export function adultPrimaryLabel(primaryId: string): string {
  for (const sec of ADULT_ROLE_SECTIONS) {
    for (const b of sec.buckets) {
      const p = b.primaries.find((x) => x.id === primaryId);
      if (p) return p.label;
    }
  }
  return primaryId.replace(/_/g, " ");
}

/** True if this selection should show as “key” in summaries: secondary keys when refinements exist, else primary `isKey`. */
export function adultSelectionIsKey(sel: {
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

/**
 * One chip per top-level primary role.
 * Secondary selections are intentionally ignored — all display and detail
 * is now at the primary level only.
 */
export function adultLeafChipsFromSelections(selections: {
  primaryId: string;
  secondaryIds?: string[];
  isKey?: boolean;
  secondaryKeys?: Record<string, boolean>;
}[] | null | undefined): { key: string; label: string; isKey: boolean }[] {
  if (!Array.isArray(selections)) return [];
  const seen = new Set<string>();
  const chips: { key: string; label: string; isKey: boolean }[] = [];
  for (const sel of selections) {
    if (seen.has(sel.primaryId)) continue;
    const p = findAdultPrimary(sel.primaryId);
    if (!p) continue;
    seen.add(sel.primaryId);
    chips.push({
      key: sel.primaryId,
      label: p.label,
      isKey: !!sel.isKey,
    });
  }
  return chips;
}

/** Short preview string for chips (primary + optional secondaries). */
export function formatAdultSelectionPreview(sel: { primaryId: string; secondaryIds?: string[] }): string {
  for (const sec of ADULT_ROLE_SECTIONS) {
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
