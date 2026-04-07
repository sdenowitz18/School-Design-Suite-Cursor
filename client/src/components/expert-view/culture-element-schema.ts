import type { ElementDef, TagDef } from './expert-view-types';
import { TAGS_ADULT_PROCESSES_TUNING, TAGS_LEARNING_COMMUNITY } from './learning-tags.generated';

/** Behavior management & repair — aligned to workbook primary rows. */
const TAGS_CULTURE_BEHAVIOR_MGMT: TagDef[] = [
  { id: 'pbis', label: 'Positive behavioral interventions and supports (PBIS)' },
  {
    id: 'restorative-practices',
    label: 'Restorative practices / restorative justice',
    secondaries: [
      { id: 'reintegration-protocols', label: 'Reintegration protocols' },
      { id: 'restorative-language-norms', label: 'Restorative language norms' },
    ],
  },
  { id: 'responsive-classroom', label: 'Responsive Classroom' },
  { id: 'love-logic', label: 'Love & Logic' },
  { id: 'trauma-informed', label: 'Trauma-informed / healing-centered practice' },
  {
    id: 'behavior-sel-aligned',
    label: "Behavior systems aligned to the school's social-emotional learning competencies",
  },
  {
    id: 'culturally-responsive-discipline',
    label: 'Culturally responsive discipline',
    secondaries: [{ id: 'identity-safe-classrooms', label: 'Identity-safe classrooms' }],
  },
  {
    id: 'other-approaches-behavior',
    label: 'Other approaches',
    secondaries: [
      { id: 'boys-town', label: 'Boys Town Model' },
      { id: 'assertive-discipline', label: 'Assertive Discipline' },
      { id: 'nurtured-heart', label: 'The Nurtured Heart Approach' },
      { id: 'second-step', label: 'Second Step' },
      { id: 'champs', label: 'CHAMPS' },
      { id: 'discipline-without-stress', label: 'Discipline Without Stress' },
      { id: 'other-behavior-specify', label: 'Other' },
    ],
  },
];

const TAGS_CULTURE_TIER23: TagDef[] = [
  {
    id: 'school-based-mh',
    label: 'School-based mental health services',
    secondaries: [
      { id: 'group-therapy', label: 'Group therapy sessions' },
      { id: 'parent-consultations', label: 'Parent consultations and family support' },
      { id: 'collab-external', label: 'Collaboration with external providers and case management' },
      { id: 'psychoed-assessments', label: 'Psychoeducational assessments' },
    ],
  },
  {
    id: 'behavioral-screening',
    label: 'Behavioral screening',
    secondaries: [{ id: 'behavioral-screening-other', label: 'Other' }],
  },
  { id: 'cico', label: 'Check-in/check-out (CICO) programs' },
  { id: 'small-group-counseling', label: 'Small group counseling' },
  { id: 'crisis-response', label: 'Crisis response systems' },
  { id: 'other-tier23', label: 'Other approaches' },
];

const TAGS_CULTURE_ADULT_COMMUNITY: TagDef[] = [
  { id: 'staff-wellness', label: 'Staff self-care and wellness programs' },
  { id: 'plcs-wellbeing', label: 'Professional Learning Communities (PLCs) for wellbeing' },
  { id: 'adult-staff-circles', label: 'Adult/staff circles' },
  { id: 'eap', label: 'Employee assistance programs (EAPs)' },
  { id: 'other-adult-philosophies', label: 'Other philosophies / approaches' },
];

export const CULTURE_ELEMENT: ElementDef = {
  id: 'culture',
  title: 'Systems & Practices for School Culture',
  shortTitle: 'Culture',
  questions: [
    {
      id: 'culture-q1',
      section: 'practices',
      question:
        'What culture-&-community-focused activities do learners and/or adults engage in - beyond the core curricular and instructional focus - to foster healthy community & culture among learners, among adults, and/or between learners and adults?',
      buckets: [
        {
          id: 'culture-behavior-mgmt',
          title: 'Approaches focused on behavior management and repair',
          archetype: 'A1',
          customAllowed: true,
          ringSchoolWideChoice: true,
          tags: TAGS_CULTURE_BEHAVIOR_MGMT,
        },
        {
          id: 'culture-community-health',
          title: 'Community and health building activities',
          archetype: 'A1',
          customAllowed: true,
          contextNote:
            'Same tag set as Learning\u2019s \u201cCommunity and health building activities\u201d bucket (e.g. circles, community rituals).',
          tags: TAGS_LEARNING_COMMUNITY,
        },
        {
          id: 'culture-tier23',
          title: 'Approaches focused on supporting Tier 2/3 student mental health & wellbeing',
          archetype: 'A1',
          customAllowed: true,
          ringSchoolWideChoice: true,
          tags: TAGS_CULTURE_TIER23,
        },
        {
          id: 'culture-adult-community',
          title: 'Approaches especially focused on adult community & culture',
          archetype: 'A1',
          customAllowed: true,
          ringSchoolWideChoice: true,
          tags: TAGS_CULTURE_ADULT_COMMUNITY,
        },
      ],
    },
    {
      id: 'culture-q2',
      section: 'practices',
      question:
        'What facilitator practices are utilized in facilitating culture-&-community-focused activities?',
      buckets: [
        {
          id: 'culture-facilitator-practices',
          title: 'Facilitator practices for culture & community (placeholder)',
          archetype: 'A5',
          placeholder:
            'Describe facilitator practices for culture- and community-focused work. Detailed tag list to be finalized.',
        },
      ],
    },
    {
      id: 'culture-q3-adult',
      section: 'practices',
      question:
        '[and only for adult experience] What behind-the-scenes processes (e.g., PD, activity internalization routines, planning routines, etc.) help adults to play their roles in everything above?',
      buckets: [
        {
          id: 'culture-adult-processes-tuning',
          title: 'Processes for supporting & tuning facilitation of culture & community activities',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          syncedBucketId: 'adult-processes-tuning',
          tags: TAGS_ADULT_PROCESSES_TUNING,
        },
      ],
    },
    {
      id: 'culture-q4-tools',
      section: 'tools',
      question:
        'What materials & protocols are utilized in culture-focused activities and in helping facilitators to prepare for and execute fostering healthy community & culture?',
      buckets: [
        {
          id: 'touchstones-core-values',
          title: 'Touchstones — Core values',
          archetype: 'A5',
          placeholder: 'Optional: describe core values that anchor school culture in this component...',
        },
        {
          id: 'touchstones-core-commitments',
          title: 'Touchstones — Core commitments',
          archetype: 'A5',
          placeholder: 'Optional: describe core commitments...',
        },
        {
          id: 'touchstones-cherished-norms',
          title: 'Touchstones — Cherished norms or traditions',
          archetype: 'A5',
          placeholder: 'Optional: describe cherished norms or traditions...',
        },
        {
          id: 'touchstones-other',
          title: 'Touchstones — Other touchstones',
          archetype: 'A5',
          placeholder: 'Optional: describe any other cultural touchstones...',
        },
        {
          id: 'culture-tools-placeholder',
          title: 'Additional culture materials & protocols (placeholder)',
          archetype: 'A5',
          placeholder:
            'Space for further culture tools & resources once the workbook section is finalized.',
        },
      ],
    },
    {
      id: 'culture-q5-adult-tools',
      section: 'tools',
      question:
        '[and only for adult experience] What additional adult-facing materials (e.g., ??, etc.) help adults to play their roles in everything above?',
      buckets: [
        {
          id: 'culture-adult-facing-materials',
          title: 'Additional adult-facing materials & protocols',
          archetype: 'A5',
          adultOnly: true,
          placeholder:
            'Describe handbooks, facilitator guides, culture protocols, and other materials adults use (placeholder until finalized).',
        },
      ],
    },
  ],
};
