import type { ElementDef, TagDef } from './expert-view-types';

// ─── Physical space tags ─────────────────────────────────────────────────────

const TAGS_PHYSICAL_SPACE: TagDef[] = [
  { id: 'classroom-layout-furniture', label: 'Classroom layout & furniture' },
  { id: 'classroom-ambience-visuals', label: 'Classroom ambience & visuals' },
  { id: 'building-layout-furniture', label: 'Building layout & furniture (outside of classrooms)' },
  { id: 'building-ambience-visuals', label: 'Building ambience & visuals (outside of classrooms)' },
  { id: 'outdoor-recreational-space', label: 'Outdoor recreational space (playgrounds & fields)' },
  {
    id: 'community-as-classroom',
    label: 'Community as classroom',
    secondaries: [
      { id: 'city-as-campus', label: 'City as campus' },
      { id: 'outdoor-education', label: 'Outdoor education' },
      {
        id: 'field-study-fieldwork',
        label: 'Field study / field work (regular outside learning time)',
      },
      {
        id: 'co-located-space',
        label: 'Co-located space/facilities at industry partnership, higher ed institutions, museum, etc.',
      },
    ],
  },
  {
    id: 'special-spaces',
    label: 'Special spaces',
    secondaries: [
      { id: 'maker-space', label: 'Maker space' },
      { id: 'garden', label: 'Garden' },
      { id: 'flexible-learning-spaces', label: 'Flexible learning spaces' },
      {
        id: 'sensory-self-regulation-spaces',
        label: 'Sensory rooms/areas; areas to support self-regulation',
      },
    ],
  },
  {
    id: 'functional-spaces',
    label: 'Functional spaces',
    secondaries: [
      { id: 'bathrooms', label: 'Bathrooms' },
      { id: 'cafeteria', label: 'Cafeteria' },
    ],
  },
  { id: 'accessibility-features', label: 'Accessibility features' },
  { id: 'other-space-facilities', label: 'Other space & facilities features' },
];

// ─── Software tags ────────────────────────────────────────────────────────────

const TAGS_SOFTWARE: TagDef[] = [
  { id: 'software-lms', label: 'Learning Mgmt System (LMS)' },
  { id: 'software-sis', label: 'Student Information System (SIS)' },
  { id: 'software-student-learning', label: 'Student-facing learning software' },
  { id: 'software-staff-facing', label: 'Staff-facing software' },
  { id: 'software-digital-security', label: 'Digital security software' },
  { id: 'software-other', label: 'Other software' },
];

// ─── Space & digital use support tags ────────────────────────────────────────

const TAGS_SPACE_SUPPORT: TagDef[] = [
  {
    id: 'space-onboarding-orientation',
    label: 'Onboarding/orientation to physical space and digital systems',
  },
  { id: 'it-software-help', label: 'IT/software help' },
];

// ─── Operational systems & routines tags ─────────────────────────────────────

const TAGS_OPS_SYSTEMS: TagDef[] = [
  { id: 'ops-enrollment-systems', label: 'Enrollment systems & routines' },
  { id: 'ops-transportation-planning', label: 'Transportation planning' },
  { id: 'ops-food-coordination', label: 'Food-related coordination & planning' },
  { id: 'ops-maintenance-systems', label: 'Maintenance-related systems & routines' },
  { id: 'ops-procurement-systems', label: 'Procurement/supply systems & routines' },
  {
    id: 'ops-tech-infrastructure',
    label: 'Tech-infrastructure and device-health systems & routines',
  },
  { id: 'ops-other-logistical', label: 'Other logistical/operations systems & routines' },
];

// ─── Financial systems & routines tags ───────────────────────────────────────

const TAGS_FINANCIAL_SYSTEMS: TagDef[] = [
  { id: 'financial-zero-base-budgeting', label: 'Zero-base budgeting' },
];

// ─── Hardware tags ────────────────────────────────────────────────────────────

const TAGS_HARDWARE: TagDef[] = [
  {
    id: 'hardware-students',
    label: 'Hardware for students',
    secondaries: [
      { id: 'hardware-students-laptops', label: 'Laptops' },
      { id: 'hardware-students-desktops', label: 'Desktops' },
      { id: 'hardware-students-tablets', label: 'Tablets' },
      { id: 'hardware-students-3d-printers', label: '3D Printers' },
    ],
  },
  {
    id: 'hardware-staff',
    label: 'Hardware for staff',
    secondaries: [
      { id: 'hardware-staff-laptops', label: 'Laptops' },
      { id: 'hardware-staff-desktops', label: 'Desktops' },
      { id: 'hardware-staff-tablets', label: 'Tablets' },
      { id: 'hardware-staff-printers', label: 'Printers' },
    ],
  },
  { id: 'wifi-enablement-access', label: 'Wifi enablement & access' },
];

// ─── Budgeting tools tags ─────────────────────────────────────────────────────

const TAGS_BUDGETING_TOOLS: TagDef[] = [
  { id: 'budgeting-economic-model', label: 'Economic model' },
  { id: 'budgeting-tools', label: 'Budgeting tools' },
  { id: 'budgeting-other', label: 'Other' },
];

// ─── Element definition ───────────────────────────────────────────────────────

export const OPS_ELEMENT: ElementDef = {
  id: 'ops',
  title: 'Operations, Budget & Infrastructure',
  shortTitle: 'Ops & Budget',
  questions: [
    {
      id: 'ops-q1',
      section: 'practices',
      question:
        'What approaches to the use of physical and digital space help shape what occurs in learner & adult experiences?',
      buckets: [
        {
          id: 'ops-physical-space',
          title: 'Approach to physical space',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_PHYSICAL_SPACE,
        },
        {
          id: 'ops-software',
          title: 'Software utilized',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_SOFTWARE,
        },
        {
          id: 'ops-space-support',
          title: 'Supporting students & adults with appropriate use of physical & digital space',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_SPACE_SUPPORT,
        },
      ],
    },
    {
      id: 'ops-q2',
      section: 'practices',
      question:
        'What approaches to transportation & logistics in the learning environment help shape what occurs in learner & adult experiences?',
      buckets: [
        {
          id: 'ops-transportation',
          title: 'Transportation',
          archetype: 'A5',
          placeholder: 'Describe transportation approaches for learners and adults in this component...',
        },
        {
          id: 'ops-arrival-dismissal',
          title: 'Arrival, dismissal, and transitions',
          archetype: 'A5',
          placeholder: 'Describe arrival, dismissal, and transition routines and approaches...',
        },
        {
          id: 'ops-food',
          title: 'Food',
          archetype: 'A5',
          placeholder: 'Describe food and nutrition approaches (meal programs, snacks, etc.)...',
        },
      ],
    },
    {
      id: 'ops-q3',
      section: 'practices',
      question:
        'How much does it cost to enable everything desired in the learner & adult experiences as designed, and how is that cost covered / paid for?',
      buckets: [
        {
          id: 'ops-cost',
          title: 'Cost',
          archetype: 'A5',
          placeholder: 'Describe the overall cost to deliver the designed experience...',
        },
        {
          id: 'ops-funding',
          title: 'Funding',
          archetype: 'A5',
          placeholder: 'Describe how the experience is funded (per-pupil revenue, fundraising, grants, etc.)...',
        },
      ],
    },
    {
      id: 'ops-q4-adult',
      section: 'practices',
      question:
        '[and only for adult experience] What operational & financial systems & routines enable everything above to occur as desired?',
      buckets: [
        {
          id: 'ops-systems-routines',
          title: 'Operational systems & routines',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_OPS_SYSTEMS,
        },
        {
          id: 'ops-financial-systems',
          title: 'Financial systems & routines',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_FINANCIAL_SYSTEMS,
        },
        {
          id: 'ops-staffing',
          title: 'Approach to staffing',
          archetype: 'A5',
          adultOnly: true,
          placeholder:
            'Describe the approach to operations & support staffing. This will eventually port over from Adults info (School operations & support staff).',
        },
      ],
    },
    {
      id: 'ops-q5-tools',
      section: 'tools',
      question:
        'What tools & materials (from wall art to furniture to laptops) shape the physical and digital space that learners and adults interact with?',
      buckets: [
        {
          id: 'ops-physical-tools',
          title: 'Tools & materials shaping the physical space',
          archetype: 'A5',
          placeholder:
            'Describe furnishings, displays, signage, and other physical materials that shape the learning environment...',
        },
        {
          id: 'ops-hardware',
          title: 'Hardware / tech devices',
          archetype: 'A1',
          customAllowed: true,
          groupedSecondaryDisplay: true,
          tags: TAGS_HARDWARE,
        },
      ],
    },
    {
      id: 'ops-q6-adult-tools',
      section: 'tools',
      question:
        '[and only for adult experience] What behind-the-scenes tools & resources enable operational & financial systems & routines to occur as desired?',
      buckets: [
        {
          id: 'ops-budgeting-tools',
          title: 'Budgeting tools & resources',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_BUDGETING_TOOLS,
        },
      ],
    },
  ],
};
