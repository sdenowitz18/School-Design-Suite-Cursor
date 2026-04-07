import type { ElementDef, TagDef } from './expert-view-types';

// ─── Classroom-level staffing ─────────────────────────────────────────────────

const TAGS_FAC_CLASSROOM_STAFFING: TagDef[] = [
  { id: 'single-lead-teacher', label: 'Single lead teacher' },
  {
    id: 'team-teaching',
    label: 'Team teaching / multiple lead teachers',
    secondaries: [
      { id: 'station-parallel-coteaching', label: 'Station/parallel co-teaching' },
      { id: 'alt-specialized-coteaching', label: 'Alternative/specialized co-teaching' },
      { id: 'virtual-hybrid-coteaching', label: 'Virtual/hybrid co-teaching' },
    ],
  },
  {
    id: 'primary-secondary-teacher',
    label: 'Primary and secondary teacher',
    secondaries: [
      { id: 'teacher-paraprofessional', label: 'Teacher + paraprofessional/TA' },
      { id: 'resident-associate-teacher', label: 'Resident/associate teacher' },
    ],
  },
  {
    id: 'expanded-adult-supports',
    label: 'Expanded adult supports',
    secondaries: [
      { id: 'one-on-one-aide', label: '1:1 aide' },
      { id: 'push-in-specialists', label: 'Push-in specialists' },
      { id: 'tutors-interventionists', label: 'Tutors/interventionists' },
    ],
  },
];

// ─── Facilitator background & allocation ─────────────────────────────────────

const TAGS_FAC_BACKGROUND: TagDef[] = [
  {
    id: 'nontraditional-staff',
    label: 'Nontraditional staff',
    secondaries: [
      { id: 'industry-experts', label: 'Industry experts' },
      { id: 'college-students', label: 'College students' },
    ],
  },
  { id: 'residents', label: 'Residents' },
  { id: 'university-district-partnerships', label: 'University / district partnerships' },
  { id: 'grow-your-own', label: 'Grow-your-own programs' },
  {
    id: 'same-teacher-multiple-years',
    label: 'Same teacher multiple years',
    secondaries: [
      { id: 'looping', label: 'Looping' },
      { id: 'mentor-groups', label: 'Mentor groups' },
    ],
  },
  {
    id: 'extended-reach-hq-teachers',
    label: 'Extended reach of high-quality teachers',
    secondaries: [
      { id: 'master-teachers', label: 'Master teachers' },
      { id: 'teacher-leaders', label: 'Teacher leaders' },
    ],
  },
  { id: 'every-adult-teaches', label: 'Every adult teaches' },
  { id: 'older-learners-facilitate', label: 'Older learners facilitate younger learners' },
  {
    id: 'critical-demographic-educators',
    label: 'Critical demographic dimension of educators',
    secondaries: [
      { id: 'multilingual-educators', label: 'Multilingual educators' },
      { id: 'educators-from-community', label: 'Educators from the community' },
      { id: 'educators-shared-background', label: 'Educators with shared racial/ethnic background with learners' },
    ],
  },
];

// ─── Exceptional needs staffing ───────────────────────────────────────────────

const TAGS_FAC_EXCEPTIONAL_NEEDS: TagDef[] = [
  { id: 'pull-out-services', label: 'Pull out services' },
  { id: 'inclusion-model', label: 'Inclusion model' },
  { id: 'self-contained', label: 'Self-contained' },
  { id: 'resource-room', label: 'Resource room' },
];

// ─── Other adult roles (adults schema minus educators) ────────────────────────

const TAGS_FAC_OTHER_ROLES: TagDef[] = [
  {
    id: 'caregivers-families',
    label: 'Caregivers / families',
    secondaries: [
      { id: 'primary-caregivers', label: 'Primary caregivers' },
      { id: 'siblings', label: 'Siblings' },
      { id: 'extended-family', label: 'Extended family' },
    ],
  },
  {
    id: 'school-leaders-administrators',
    label: 'School leaders & administrators',
    secondaries: [
      { id: 'principals-heads', label: 'Principal(s) / Head(s) of School' },
      { id: 'aps-deans', label: 'AP(s) / Dean(s)' },
      { id: 'ops-business-manager', label: 'Ops / Business Manager(s)' },
      { id: 'data-assessment-coordinator', label: 'Data or Assessment Coordinator(s)' },
      { id: 'school-design-lead', label: 'School-based design lead or design partner' },
    ],
  },
  {
    id: 'student-support-wellbeing',
    label: 'Student support & wellbeing staff',
    secondaries: [
      { id: 'school-counselors', label: 'School counselor(s)' },
      { id: 'social-workers', label: 'Social worker(s)' },
      { id: 'school-psychologists', label: 'School psychologist(s)' },
      { id: 'nurse-health-coordinator', label: 'Nurse / health coordinator(s)' },
      { id: 'exceptional-needs-coordinators', label: 'Coordinators for learners with exceptional needs' },
    ],
  },
  {
    id: 'school-ops-support-staff',
    label: 'School operations & support staff',
    secondaries: [
      { id: 'family-engagement-coordinator', label: 'Family engagement coordinator(s)' },
      { id: 'community-partnership-manager', label: 'Community partnership manager(s)' },
      { id: 'enrollment-admissions-coordinator', label: 'Enrollment / admissions coordinator(s)' },
      { id: 'office-manager', label: 'Office manager(s) / administrative assistant(s)' },
      { id: 'facilities-custodial', label: 'Facilities / custodial staff' },
      { id: 'food-service-staff', label: 'Food service staff' },
      { id: 'it-tech-specialist', label: 'IT / technology specialist(s)' },
      { id: 'after-school-coordinator', label: 'After-school program coordinator(s)' },
      { id: 'other-ops-staff', label: 'Other' },
    ],
  },
  {
    id: 'district-leaders-staff',
    label: 'District leaders & staff',
    secondaries: [
      { id: 'superintendent', label: 'Superintendent' },
      { id: 'district-cabinet', label: 'District Cabinet member(s)' },
      { id: 'instructional-coaches', label: 'Instructional coach(es)' },
      { id: 'district-design-partner', label: 'District-based design partner(s)' },
      { id: 'other-district-staff', label: 'Other district staff' },
    ],
  },
  {
    id: 'other-adults',
    label: 'Other adults',
    secondaries: [
      { id: 'community-political-leaders', label: 'Local community & political leader(s)' },
      { id: 'school-board-member', label: 'School board member' },
    ],
  },
];

// ─── Educator competency frameworks ──────────────────────────────────────────

const TAGS_FAC_COMPETENCY_FRAMEWORK: TagDef[] = [
  { id: 'framework-none', label: 'None' },
  { id: 'framework-home-grown', label: 'Home-grown' },
  { id: 'danielson', label: 'Danielson Framework for Teaching' },
  { id: 'marzano', label: 'Marzano Teacher Evaluation Model / Focused Teacher Evaluation Model' },
  { id: 'niet-tap', label: 'NIET TAP / Teaching & Learning Standards Rubric' },
  { id: 'framework-other', label: 'Other' },
];

// ─── FACILITATOR_ELEMENT ─────────────────────────────────────────────────────

export const FACILITATOR_ELEMENT: ElementDef = {
  id: 'facilitator',
  title: 'Facilitator Roles & Configurations',
  shortTitle: 'Facilitator',
  questions: [
    {
      id: 'facilitator-q1',
      section: 'practices',
      question:
        'What facilitators (often adults) facilitate the desired experience, and in what roles, configurations, and facilitator/learner ratios?',
      buckets: [
        {
          id: 'fac-classroom-staffing',
          title: 'Classroom-level staffing',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_FAC_CLASSROOM_STAFFING,
        },
        {
          id: 'fac-background-allocation',
          title: 'Facilitator background and allocation',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_FAC_BACKGROUND,
        },
        {
          id: 'fac-exceptional-needs',
          title: 'Staffing for learners with exceptional needs',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_FAC_EXCEPTIONAL_NEEDS,
        },
        {
          id: 'fac-other-roles',
          title: 'Other roles that can facilitate experiences beyond the core educator faculty',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_FAC_OTHER_ROLES,
        },
        {
          id: 'fac-ratio',
          title: 'Learner / facilitator ratio',
          archetype: 'A3Ratio',
        },
      ],
    },
    {
      id: 'facilitator-q2-adult',
      section: 'practices',
      question:
        '[and only for adult experience] What must be true of role-definition and hiring practices & systems to recruit and select adults that can be successful in their roles?',
      buckets: [
        {
          id: 'fac-role-definition',
          title: 'Approach to role definition',
          archetype: 'A5',
          adultOnly: true,
          placeholder: 'Describe how facilitator roles are defined in this component...',
        },
        {
          id: 'fac-hiring',
          title: 'Approach to hiring',
          archetype: 'A5',
          adultOnly: true,
          placeholder: 'Describe hiring practices and criteria for this component...',
        },
        {
          id: 'fac-onboarding',
          title: 'Approach to onboarding',
          archetype: 'A5',
          adultOnly: true,
          placeholder: 'Describe onboarding practices for facilitators in this component...',
        },
      ],
    },
    {
      id: 'facilitator-q3-adult-tools',
      section: 'tools',
      question:
        '[only for adult experience] What tools & resources drive clarity and action on what facilitator roles entail and what strong performance / competencies look like?',
      buckets: [
        {
          id: 'fac-competency-framework',
          title: 'Educator competency framework',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_FAC_COMPETENCY_FRAMEWORK,
        },
        {
          id: 'fac-skills-knowledge-mindsets',
          title: 'Any additional expectations of facilitator skills, knowledge, & mindsets',
          archetype: 'A5',
          adultOnly: true,
          placeholder: 'Describe additional skills, knowledge, and mindsets expected of facilitators...',
        },
        {
          id: 'fac-role-documentation',
          title: 'Documentation of facilitator role definition & expectations',
          archetype: 'A5',
          adultOnly: true,
          placeholder: 'Describe how facilitator roles and expectations are documented...',
        },
      ],
    },
    {
      id: 'facilitator-q4-adult-tools2',
      section: 'tools',
      question:
        '[only for adult experience] What additional tools & resources support facilitator recruitment, hiring, performance management, and ongoing \u2018HR supports\u2019?',
      buckets: [
        {
          id: 'fac-recruitment-tools',
          title: 'Tools & resources for facilitator recruitment, hiring & onboarding',
          archetype: 'A5',
          adultOnly: true,
          placeholder: 'Describe job postings, rubrics, onboarding guides, and other resources used...',
        },
      ],
    },
  ],
};
