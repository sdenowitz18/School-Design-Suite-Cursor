/**
 * Adult experience module library.
 *
 * Three-level structure (mirrors the Learner library):
 *   Role tab  →  Primary filter (formerly the role's items)  →  Draggable octagon modules
 *
 * Each draggable module corresponds to one AdultCatalogPick. Dragging it onto the
 * blueprint creates a ring component; dragging it onto a ring's working panel creates
 * an adult subcomponent. (Routing handled in `lib/learner-module-drop.ts`.)
 */

export type AdultCatalogPick = {
  key: string;
  bucketId: string;
  /** The role's primary item id — e.g. "fac_stud_learn". Used as the "Primary" filter value. */
  primaryId: string;
  /** The module id within a primary — unique draggable. */
  secondaryId: string;
  /** Module title shown on the octagon and used as the new component / subcomponent name. */
  title: string;
  /** Subtitle shown beneath the octagon title (we use the parent primary label). */
  subtitle: string;
  /** Role tab this module lives under. */
  roleId: string;
  /** Convenience: the parent primary item's display label (same as `subtitle`). */
  primaryLabel: string;
};

type ModuleDef = { id: string; title: string };
type ItemDef = { id: string; title: string; modules: ModuleDef[] };
type RoleDef = { id: string; label: string; items: ItemDef[] };

const ADULT_EXPERIENCE_ROLES: RoleDef[] = [
  {
    id: "educator_exp",
    label: "Educator Experiences",
    items: [
      {
        id: "fac_stud_learn",
        title: "Facilitating student learning & development",
        modules: [
          { id: "direct_instruction_block", title: "Direct instruction block" },
          { id: "small_group_rotation", title: "Small-group rotation" },
          { id: "project_studio_time", title: "Project-based studio time" },
        ],
      },
      {
        id: "learn_design_prep",
        title: "Learning design & preparation routines",
        modules: [
          { id: "weekly_unit_planning", title: "Weekly unit planning session" },
          { id: "lesson_co_planning", title: "Lesson co-planning block" },
        ],
      },
      {
        id: "assess_feedback",
        title: "Assessing & feedback routines",
        modules: [
          { id: "formative_check_in", title: "Formative check-in cycle" },
          { id: "work_conferencing", title: "Conferencing on student work" },
          { id: "grading_reports", title: "Grading & report comments" },
        ],
      },
      {
        id: "stud_support_coord",
        title: "Student support & coordination routines",
        modules: [
          { id: "tier2_intervention", title: "Tier-2 intervention block" },
          { id: "case_management_huddle", title: "Case management huddle" },
        ],
      },
      {
        id: "prof_learn_improve",
        title: "Professional learning & improvement of practice routines",
        modules: [
          { id: "plc_inquiry_cycle", title: "PLC inquiry cycle" },
          { id: "coaching_observation", title: "Coaching observation debrief" },
          { id: "practice_lab_rehearsal", title: "Practice lab rehearsal" },
        ],
      },
      {
        id: "family_comm_partner",
        title: "Family communication & partnership routines",
        modules: [
          { id: "weekly_family_update", title: "Weekly family update" },
          { id: "conference_week", title: "Conference week meetings" },
        ],
      },
      {
        id: "ops_culture",
        title: "Operational and culture routines",
        modules: [
          { id: "morning_meeting", title: "Morning meeting routine" },
          { id: "transition_coverage", title: "Hallway transition coverage" },
        ],
      },
    ],
  },
  {
    id: "caregiver_exp",
    label: "Caregiver Experiences",
    items: [
      {
        id: "support_home",
        title: "Supporting learning at home",
        modules: [
          { id: "reading_at_home", title: "Reading at home routine" },
          { id: "homework_window", title: "Homework support window" },
        ],
      },
      {
        id: "school_home_comm",
        title: "School-home communication & coordination",
        modules: [
          { id: "weekly_update_review", title: "Weekly update review" },
          { id: "two_way_messaging", title: "Two-way messaging check" },
        ],
      },
      {
        id: "participation_comm",
        title: "Participation & community engagement",
        modules: [
          { id: "campus_volunteer_day", title: "Volunteer day on campus" },
          { id: "family_event_attend", title: "Family event attendance" },
        ],
      },
    ],
  },
  {
    id: "school_leaders_admin",
    label: "School Leaders & Administrators",
    items: [
      {
        id: "direct_learners",
        title: "Direct interactions with learners",
        modules: [
          { id: "classroom_walkthrough", title: "Classroom walkthrough" },
          { id: "restorative_conversation", title: "Restorative conversation" },
        ],
      },
      {
        id: "coach_educators",
        title: "Coaching & supporting educators",
        modules: [
          { id: "one_on_one_coaching", title: "1:1 coaching meeting" },
          { id: "observation_feedback", title: "Observation feedback cycle" },
        ],
      },
      {
        id: "lead_improve_design",
        title: "Leading school improvement & design",
        modules: [
          { id: "strategic_planning_session", title: "Strategic planning session" },
          { id: "design_sprint_facilitation", title: "Design sprint facilitation" },
        ],
      },
      {
        id: "sustain_adult_comm",
        title: "Building and sustaining adult community",
        modules: [
          { id: "all_staff_meeting", title: "All-staff meeting" },
          { id: "onboarding_cohort", title: "Onboarding cohort" },
        ],
      },
      {
        id: "ops_systems",
        title: "Operations & systems management",
        modules: [
          { id: "master_schedule_review", title: "Master schedule review" },
          { id: "budget_staffing_planning", title: "Budget & staffing planning" },
        ],
      },
      {
        id: "family_ext_lead",
        title: "Family, community, & external partnership leadership",
        modules: [
          { id: "community_advisory", title: "Community advisory meeting" },
          { id: "partner_org_check_in", title: "Partner org check-in" },
        ],
      },
    ],
  },
  {
    id: "student_support_wellbeing",
    label: "Student Support & Wellbeing Staff",
    items: [
      {
        id: "fac_stud_learn",
        title: "Facilitating student learning & development",
        modules: [
          { id: "counseling_group_session", title: "Counseling group session" },
          { id: "skill_building_workshop", title: "Skill-building workshop" },
        ],
      },
      {
        id: "learn_design_prep",
        title: "Learning design & preparation routines",
        modules: [
          { id: "service_planning_block", title: "Service planning block" },
          { id: "iep_504_prep", title: "IEP / 504 prep" },
        ],
      },
      {
        id: "assess_feedback",
        title: "Assessing & feedback routines",
        modules: [
          { id: "wellbeing_screening", title: "Wellbeing screening" },
          { id: "progress_monitoring_review", title: "Progress monitoring review" },
        ],
      },
      {
        id: "stud_support_coord",
        title: "Student support & coordination routines",
        modules: [
          { id: "crisis_response_protocol", title: "Crisis response protocol" },
          { id: "case_coordination_meeting", title: "Case coordination meeting" },
        ],
      },
      {
        id: "prof_learn_improve",
        title: "Professional learning & improvement of practice routines",
        modules: [
          { id: "clinical_supervision", title: "Clinical supervision" },
          { id: "cross_discipline_case_study", title: "Cross-discipline case study" },
        ],
      },
      {
        id: "family_comm_partner",
        title: "Family communication & partnership routines",
        modules: [
          { id: "family_wraparound_meeting", title: "Family wraparound meeting" },
          { id: "outreach_call_cycle", title: "Outreach call cycle" },
        ],
      },
      {
        id: "ops_culture",
        title: "Operational and culture routines",
        modules: [
          { id: "drop_in_office_hours", title: "Drop-in office hours" },
          { id: "lunchtime_mentoring", title: "Lunchtime mentoring" },
        ],
      },
      {
        id: "coach_educators",
        title: "Coaching & supporting educators",
        modules: [
          { id: "trauma_informed_consult", title: "Trauma-informed practice consult" },
          { id: "behavior_support_coaching", title: "Behavior support coaching" },
        ],
      },
    ],
  },
  {
    id: "school_ops_support",
    label: "School Operations & Support Staff",
    items: [
      {
        id: "stud_support_coord",
        title: "Student support & coordination routines",
        modules: [
          { id: "front_office_check_in", title: "Front office check-in" },
          { id: "attendance_follow_up", title: "Attendance follow-up" },
        ],
      },
      {
        id: "prof_learn_improve",
        title: "Professional learning & improvement of practice routines",
        modules: [
          { id: "operations_training", title: "Operations training session" },
          { id: "compliance_refresher", title: "Compliance refresher" },
        ],
      },
      {
        id: "ops_culture",
        title: "Operational and culture routines",
        modules: [
          { id: "arrival_dismissal_flow", title: "Arrival & dismissal flow" },
          { id: "lunchroom_supervision", title: "Lunchroom supervision" },
        ],
      },
    ],
  },
  {
    id: "district_leadership",
    label: "District Leadership & Staff",
    items: [
      {
        id: "direct_learners",
        title: "Direct interactions with learners",
        modules: [
          { id: "student_listening_session", title: "Student listening session" },
          { id: "school_site_visit", title: "School-site classroom visit" },
        ],
      },
      {
        id: "coach_school_staff",
        title: "Coaching & supporting school-level administrators, educators, and staff",
        modules: [
          { id: "principal_coaching_cycle", title: "Principal coaching cycle" },
          { id: "network_learning_walk", title: "Network learning walk" },
        ],
      },
      {
        id: "lead_improve_design",
        title: "Leading school improvement & design",
        modules: [
          { id: "strategic_plan_refresh", title: "Strategic plan refresh" },
          { id: "portfolio_review", title: "Portfolio review" },
        ],
      },
      {
        id: "sustain_adult_comm",
        title: "Building and sustaining adult community",
        modules: [
          { id: "cabinet_weekly_meeting", title: "Cabinet weekly meeting" },
          { id: "cross_functional_retreat", title: "Cross-functional retreat" },
        ],
      },
      {
        id: "ops_systems",
        title: "Operations & systems management",
        modules: [
          { id: "data_dashboard_review", title: "Data dashboard review" },
          { id: "procurement_contracts", title: "Procurement & contracts" },
        ],
      },
      {
        id: "family_ext_lead",
        title: "Family, community, & external partnership leadership",
        modules: [
          { id: "board_community_update", title: "Board & community update" },
          { id: "partner_philanthropy_meeting", title: "Partner / philanthropy meeting" },
        ],
      },
    ],
  },
];

const BUCKET_ID = "adult_experience";

function picksForRole(role: RoleDef): AdultCatalogPick[] {
  const out: AdultCatalogPick[] = [];
  for (const item of role.items) {
    for (const mod of item.modules) {
      out.push({
        key: `adult::${role.id}::${item.id}::${mod.id}`,
        bucketId: BUCKET_ID,
        primaryId: item.id,
        secondaryId: mod.id,
        title: mod.title,
        subtitle: item.title,
        roleId: role.id,
        primaryLabel: item.title,
      });
    }
  }
  return out;
}

/** Flat list of every adult module pick across roles. */
export const ADULT_EXPERIENCE_PICKS: AdultCatalogPick[] = ADULT_EXPERIENCE_ROLES.flatMap(picksForRole);

/** Tab options for the role-level Tabs in the module library strip. Educator default = first entry. */
export const ADULT_EXPERIENCE_ROLE_OPTIONS = ADULT_EXPERIENCE_ROLES.map((r) => ({ id: r.id, label: r.label }));

/** Primary-filter options for a role tab — derived from the role's items list. */
export type AdultPrimaryOption = { id: string; label: string };
export function adultPrimariesForRoleId(roleId: string): AdultPrimaryOption[] {
  const role = ADULT_EXPERIENCE_ROLES.find((r) => r.id === roleId);
  return role ? role.items.map((it) => ({ id: it.id, label: it.title })) : [];
}

/** All draggable module picks for a given role (across primaries). */
export function adultPicksForRoleId(roleId: string): AdultCatalogPick[] {
  const role = ADULT_EXPERIENCE_ROLES.find((r) => r.id === roleId);
  return role ? picksForRole(role) : [];
}

/** Module picks for a role, optionally filtered by a single primary id. `"all"` = no filter. */
export function adultPicksForRoleAndPrimary(roleId: string, primaryId: string | "all"): AdultCatalogPick[] {
  const all = adultPicksForRoleId(roleId);
  if (primaryId === "all") return all;
  return all.filter((p) => p.primaryId === primaryId);
}

export function getAdultCatalogPickByKey(key: string): AdultCatalogPick | undefined {
  return ADULT_EXPERIENCE_PICKS.find((p) => p.key === key);
}
