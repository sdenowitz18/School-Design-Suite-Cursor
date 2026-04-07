import type { ElementDef, TagDef } from './expert-view-types';

// ─── Community partnerships ─────────────────────────────────────────────────

const TAGS_COMMUNITY_PARTNERSHIPS: TagDef[] = [
  {
    id: 'employer-career-partnerships',
    label: 'Partnerships with employers / career-connected opportunities & expertise',
  },
  {
    id: 'college-continuing-ed-partnerships',
    label: 'Partnerships with colleges / continuing-education institutions',
  },
  {
    id: 'service-provider-partnerships',
    label: 'Partnerships with service providers',
    secondaries: [
      { id: 'mental-health-counseling-partnerships', label: 'Mental health / counseling provider partnerships' },
      { id: 'school-improvement-partnerships', label: 'School improvement provider partnerships' },
    ],
  },
  { id: 'other-community-partnerships', label: 'Other community partnerships' },
];

// ─── Family partnerships & communications ───────────────────────────────────

const TAGS_FAMILY_PARTNERSHIPS: TagDef[] = [
  { id: 'family-communication-channels', label: 'Channels for communication with families (one- or two-way)' },
  { id: 'family-school-governance', label: 'Family involvement in school leadership / governance' },
  { id: 'family-conferencing', label: 'Conferencing with caregivers' },
  { id: 'family-events', label: 'Family events' },
  { id: 'family-home-visits', label: 'Home visits' },
  { id: 'family-roles-in-learning', label: 'Family roles in student learning experiences' },
  { id: 'family-translation', label: 'Translation practices' },
  { id: 'family-open-classrooms', label: 'Open classrooms' },
  { id: 'family-caregiver-supports', label: 'Family/caregiver-centered supports' },
  { id: 'other-family-partnerships', label: 'Other family partnerships & communications' },
];

// ─── Broader communications ─────────────────────────────────────────────────

const TAGS_BROADER_COMMUNICATIONS: TagDef[] = [
  { id: 'comms-website', label: 'Website' },
  { id: 'comms-social-media', label: 'Social media activity' },
  { id: 'comms-traditional-media', label: 'Traditional media activity' },
  { id: 'comms-alumni', label: 'Communication with alumni' },
  { id: 'comms-other', label: 'Other communication' },
];

// ─── Systems & routines (adult-only) ────────────────────────────────────────

const TAGS_PARTNERSHIP_SYSTEMS: TagDef[] = [
  {
    id: 'community-school-governance',
    label: 'Community involvement in school leadership / governance',
    secondaries: [
      { id: 'community-leadership-teams', label: 'School-community leadership teams / steering committees' },
      {
        id: 'district-director-partnerships',
        label: 'District-level director of partnerships or office of community schools',
      },
    ],
  },
  {
    id: 'community-input-routines',
    label: 'Routines for community input',
    secondaries: [
      { id: 'community-advisory-council', label: 'Community advisory council(s)' },
      {
        id: 'listening-sessions-townhalls',
        label: 'Regular "listening sessions," town halls, open houses',
      },
      {
        id: 'other-community-input',
        label: 'Other processes for community input in school priorities / strategic plan',
      },
    ],
  },
  {
    id: 'forging-maintaining-partnerships',
    label: 'Systems & routines for forging & maintaining community partnerships',
  },
  { id: 'other-community-systems', label: 'Other community partnership systems & processes' },
];

// ─── Tools: family & community facing ───────────────────────────────────────

const TAGS_FAMILY_COMMUNITY_TOOLS: TagDef[] = [
  { id: 'family-handbook', label: 'Family handbook' },
];

// ─── Tools: back-end communications ─────────────────────────────────────────

const TAGS_BACKEND_COMMS_TOOLS: TagDef[] = [
  { id: 'brand-style-guidance', label: 'Brand & style guidance' },
  { id: 'comms-cadence-calendar', label: 'Communications cadence / calendar' },
];

// ─── Element definition ──────────────────────────────────────────────────────

export const PARTNERSHIPS_ELEMENT: ElementDef = {
  id: 'partnerships',
  title: 'Community & Family Partnerships',
  shortTitle: 'Partnerships',
  questions: [
    {
      id: 'partnerships-q1',
      section: 'practices',
      question:
        'What partnerships & communication \u2013 between the learning environment and people outside of the learning environment (caregivers, employers, community members, experts, etc.) \u2013 help shape what occurs in learner and adult experiences?',
      buckets: [
        {
          id: 'partnerships-community',
          title: 'Community partnerships',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_COMMUNITY_PARTNERSHIPS,
        },
        {
          id: 'partnerships-family',
          title: 'Family partnerships & communications',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_FAMILY_PARTNERSHIPS,
        },
        {
          id: 'partnerships-broader-comms',
          title: 'Broader communications',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_BROADER_COMMUNICATIONS,
        },
      ],
    },
    {
      id: 'partnerships-q2-adult',
      section: 'practices',
      question:
        '[and only for adult experience] What coordination systems & routines enable partnerships & communications to occur as desired?',
      buckets: [
        {
          id: 'partnerships-systems-routines',
          title: 'Systems & routines',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_PARTNERSHIP_SYSTEMS,
        },
        {
          id: 'partnerships-staffing',
          title: 'Approach to staffing',
          archetype: 'A5',
          adultOnly: true,
          placeholder:
            'Describe the approach to staffing community & family partnerships (e.g., operations & support staff roles). This will eventually port over from Adults info.',
        },
      ],
    },
    {
      id: 'partnerships-q3-adult-tools',
      section: 'tools',
      question:
        '[and only for adult experience] What partnership & communications tools & resources are utilized to help people in the learning environment and people outside of it to engage in desired partnership?',
      buckets: [
        {
          id: 'partnerships-family-community-tools',
          title: 'Family and community facing tools & resources',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_FAMILY_COMMUNITY_TOOLS,
        },
        {
          id: 'partnerships-backend-tools',
          title: 'Back-end communications & partnership planning tools & resources',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_BACKEND_COMMS_TOOLS,
        },
      ],
    },
  ],
};
