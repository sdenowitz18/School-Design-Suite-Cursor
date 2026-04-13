/**
 * Adult experience module library — role bucket + experience bullets (drag targets).
 * Duplicate titles under different roles are separate catalog rows (distinct keys).
 */

export type AdultCatalogPick = {
  key: string;
  bucketId: string;
  primaryId: string;
  secondaryId: string;
  title: string;
  subtitle: string;
};

type RoleDef = { id: string; label: string; items: { id: string; title: string }[] };

const ADULT_EXPERIENCE_ROLES: RoleDef[] = [
  {
    id: "educator_exp",
    label: "Educator Experiences",
    items: [
      { id: "fac_stud_learn", title: "Facilitating student learning & development" },
      { id: "learn_design_prep", title: "Learning design & preparation routines" },
      { id: "assess_feedback", title: "Assessing & feedback routines" },
      { id: "stud_support_coord", title: "Student support & coordination routines" },
      { id: "prof_learn_improve", title: "Professional learning & improvement of practice routines" },
      { id: "family_comm_partner", title: "Family communication & partnership routines" },
      { id: "ops_culture", title: "Operational and culture routines" },
    ],
  },
  {
    id: "caregiver_exp",
    label: "Caregiver Experiences",
    items: [
      { id: "support_home", title: "Supporting learning at home" },
      { id: "school_home_comm", title: "School-home communication & coordination" },
      { id: "participation_comm", title: "Participation & community engagement" },
    ],
  },
  {
    id: "school_leaders_admin",
    label: "School Leaders & Administrators",
    items: [
      { id: "direct_learners", title: "Direct interactions with learners" },
      { id: "coach_educators", title: "Coaching & supporting educators" },
      { id: "lead_improve_design", title: "Leading school improvement & design" },
      { id: "sustain_adult_comm", title: "Building and sustaining adult community" },
      { id: "ops_systems", title: "Operations & systems management" },
      { id: "family_ext_lead", title: "Family, community, & external partnership leadership" },
    ],
  },
  {
    id: "student_support_wellbeing",
    label: "Student Support & Wellbeing Staff",
    items: [
      { id: "fac_stud_learn", title: "Facilitating student learning & development" },
      { id: "learn_design_prep", title: "Learning design & preparation routines" },
      { id: "assess_feedback", title: "Assessing & feedback routines" },
      { id: "stud_support_coord", title: "Student support & coordination routines" },
      { id: "prof_learn_improve", title: "Professional learning & improvement of practice routines" },
      { id: "family_comm_partner", title: "Family communication & partnership routines" },
      { id: "ops_culture", title: "Operational and culture routines" },
      { id: "coach_educators", title: "Coaching & supporting educators" },
    ],
  },
  {
    id: "school_ops_support",
    label: "School Operations & Support Staff",
    items: [
      { id: "stud_support_coord", title: "Student support & coordination routines" },
      { id: "prof_learn_improve", title: "Professional learning & improvement of practice routines" },
      { id: "ops_culture", title: "Operational and culture routines" },
    ],
  },
  {
    id: "district_leadership",
    label: "District Leadership & Staff",
    items: [
      { id: "direct_learners", title: "Direct interactions with learners" },
      {
        id: "coach_school_staff",
        title: "Coaching & supporting school-level administrators, educators, and staff",
      },
      { id: "lead_improve_design", title: "Leading school improvement & design" },
      { id: "sustain_adult_comm", title: "Building and sustaining adult community" },
      { id: "ops_systems", title: "Operations & systems management" },
      { id: "family_ext_lead", title: "Family, community, & external partnership leadership" },
    ],
  },
];

const BUCKET_ID = "adult_experience";

function picksForRole(role: RoleDef): AdultCatalogPick[] {
  return role.items.map((item) => ({
    key: `adult::${role.id}::${item.id}`,
    bucketId: BUCKET_ID,
    primaryId: role.id,
    secondaryId: item.id,
    title: item.title,
    subtitle: role.label,
  }));
}

/** Flat list of all adult picks (for maps / bulk add). */
export const ADULT_EXPERIENCE_PICKS: AdultCatalogPick[] = ADULT_EXPERIENCE_ROLES.flatMap(picksForRole);

export const ADULT_EXPERIENCE_ROLE_OPTIONS = ADULT_EXPERIENCE_ROLES.map((r) => ({ id: r.id, label: r.label }));

export function adultPicksForRoleId(roleId: string): AdultCatalogPick[] {
  const role = ADULT_EXPERIENCE_ROLES.find((r) => r.id === roleId);
  return role ? picksForRole(role) : [];
}

export function getAdultCatalogPickByKey(key: string): AdultCatalogPick | undefined {
  return ADULT_EXPERIENCE_PICKS.find((p) => p.key === key);
}
