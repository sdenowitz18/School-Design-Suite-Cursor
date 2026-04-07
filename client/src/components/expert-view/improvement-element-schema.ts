import type { ElementDef, TagDef } from './expert-view-types';
import { TAGS_ADULT_PROCESSES_TUNING } from './learning-tags.generated';

// ─── People and teams driving improvement & design ───────────────────────────

const TAGS_IMPROVEMENT_PEOPLE: TagDef[] = [
  { id: 'ci-design-partner', label: 'Design partner' },
  { id: 'ci-school-design-lead', label: 'School-based design lead' },
  { id: 'ci-planning-teams', label: 'Planning team(s)' },
  { id: 'ci-design-teams', label: 'Design team(s)' },
  { id: 'ci-executive-sponsors', label: 'Executive sponsor(s)' },
  { id: 'ci-people-others', label: 'Others' },
];

// ─── Broader set of community contributors ───────────────────────────────────

const TAGS_COMMUNITY_CONTRIBUTORS: TagDef[] = [
  {
    id: 'ci-input-givers',
    label: 'Input givers',
    secondaries: [
      { id: 'ci-input-students', label: 'Students' },
      { id: 'ci-input-families', label: 'Families' },
      { id: 'ci-input-staff', label: 'Staff' },
      { id: 'ci-input-district-board', label: 'District / Board' },
    ],
  },
  {
    id: 'ci-testers',
    label: 'Testers',
    secondaries: [
      { id: 'ci-testers-students', label: 'Students' },
      { id: 'ci-testers-families', label: 'Families' },
      { id: 'ci-testers-staff', label: 'Staff' },
      { id: 'ci-testers-district-board', label: 'District / Board' },
    ],
  },
  { id: 'ci-approvers', label: 'Approvers' },
  { id: 'ci-contributors-others', label: 'Others' },
];

// ─── Practices to support & tune current design ──────────────────────────────

const TAGS_TUNING_PRACTICES: TagDef[] = [
  {
    id: 'ci-cross-classroom-priority-setting',
    label: 'Cross-classroom priority setting',
    secondaries: [
      { id: 'ci-annual-priorities', label: 'Annual priorities' },
      { id: 'ci-quarterly-priorities', label: 'Quarterly priorities' },
      { id: 'ci-needs-assessment', label: 'Needs assessment' },
      { id: 'ci-strategic-planning-tuning', label: 'Strategic planning' },
    ],
  },
  {
    id: 'ci-additional-perspective-collection',
    label: 'Additional collection of student, staff, & family perspectives',
    secondaries: [
      { id: 'ci-student-surveys', label: 'Student surveys' },
      { id: 'ci-student-interviews', label: 'Student interviews' },
      { id: 'ci-staff-surveys', label: 'Staff surveys' },
      { id: 'ci-staff-interviews', label: 'Staff interviews' },
    ],
  },
];

// ─── Practices to make bigger changes ────────────────────────────────────────

const TAGS_BIGGER_CHANGE_PRACTICES: TagDef[] = [
  {
    id: 'ci-vision-teaching-learning',
    label: 'Vision for teaching & learning at this school',
    secondaries: [
      { id: 'ci-school-blueprint', label: 'School blueprint' },
    ],
  },
  {
    id: 'ci-periodic-stepbacks',
    label: 'Periodic (e.g., annual) stepbacks on school performance & vision/design, to identify larger change priorities',
    secondaries: [
      {
        id: 'ci-strategic-planning-bigger',
        label: 'Strategic planning to identify bigger change priorities',
      },
    ],
  },
  { id: 'ci-design-teams-practice', label: 'Design teams' },
  { id: 'ci-piloting-systems', label: 'Systems & routines for piloting' },
  {
    id: 'ci-exposure-inspiration',
    label: 'Activities to increase exposure & inspiration',
    secondaries: [
      { id: 'ci-inspiration-visits', label: 'Inspiration visits' },
    ],
  },
  {
    id: 'ci-community-voice-activities',
    label: 'Activities to hear from students, families, & staff regarding desired changes to school',
    secondaries: [
      { id: 'ci-student-shadowing', label: 'Student shadowing' },
      { id: 'ci-community-student-interviews', label: 'Student interviews' },
      { id: 'ci-community-family-interviews', label: 'Family interviews' },
      { id: 'ci-community-student-surveys', label: 'Student surveys' },
    ],
  },
  { id: 'ci-other-bigger-change-practices', label: 'Other practices to make bigger changes to the current design' },
];

// ─── Tools & resources for school design ─────────────────────────────────────

const TAGS_DESIGN_TOOLS: TagDef[] = [
  { id: 'ci-design-blueprints', label: 'Design blueprints' },
  { id: 'ci-design-journey-improvement-plans', label: 'Design journey / improvement plans' },
];

// ─── Element definition ───────────────────────────────────────────────────────

export const IMPROVEMENT_ELEMENT: ElementDef = {
  id: 'improvement',
  title: 'Continuous Improvement & Design',
  shortTitle: 'Improvement',
  questions: [
    {
      id: 'ci-q1',
      section: 'practices',
      question:
        'Who contributes to improvements to & design of the learning environment, and using what systems & processes?',
      buckets: [
        {
          id: 'ci-people-teams',
          title: 'People and teams driving improvement & design',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_IMPROVEMENT_PEOPLE,
        },
        {
          id: 'ci-community-contributors',
          title: 'Broader set of community contributors',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_COMMUNITY_CONTRIBUTORS,
        },
        {
          id: 'ci-tuning-practices',
          title: 'Practices to support & tune implementation of the current design',
          archetype: 'A1',
          customAllowed: true,
          syncedBucketId: 'adult-processes-tuning',
          contextNote:
            'Selections here are shared with \u2014 and from \u2014 the \u201cProcesses for supporting & tuning facilitation\u201d bucket in Learning Activities and Culture. Adding a selection in one place adds it in all.',
          tags: [...TAGS_TUNING_PRACTICES, ...TAGS_ADULT_PROCESSES_TUNING],
        },
        {
          id: 'ci-bigger-change-practices',
          title: 'Practices to make bigger changes to the current design',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_BIGGER_CHANGE_PRACTICES,
        },
      ],
    },
    {
      id: 'ci-q2-tools',
      section: 'tools',
      question:
        'What tools & resources enable improvement & design to occur as desired?',
      buckets: [
        {
          id: 'ci-design-tools',
          title: 'Tools & resources for school design',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_DESIGN_TOOLS,
        },
      ],
    },
  ],
};
