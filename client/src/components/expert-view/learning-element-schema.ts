import type { ElementDef, TensionPairDef } from './expert-view-types';
import {
  CORE_CURRICULA_ELA_TAGS,
  CORE_CURRICULA_MATH_TAGS,
  SUPPLEMENTAL_ELA_TAGS,
  SUPPLEMENTAL_MATH_TAGS,
} from './curriculum-discipline-tags';
import {
  TAGS_LEARNING_EXPOSURE,
  TAGS_LEARNING_PRACTICE,
  TAGS_LEARNING_COMMUNITY,
  TAGS_LEARNING_PEDAGOGICAL,
  TAGS_LEARNING_GROUPING,
  TAGS_ADULT_PROCESSES_TUNING,
  TAGS_ADULT_PROFESSIONAL_LEARNING,
  TAGS_TOOLS_CURRICULUM_TYPE,
  TAGS_TOOLS_ASSESSMENT_TYPES,
  TAGS_TOOLS_SPECIFIC_ASSESSMENTS,
} from './learning-tags.generated';

/** A-2 (Unique): facilitation philosophy tensions — one section, two options each. */
export const LEARNING_PHILOSOPHY_TENSIONS: TensionPairDef[] = [
  {
    id: 'tension-coverage-mastery',
    question: 'Coverage & grade-level pace vs. mastery & depth',
    leftLabel: 'More weight on coverage & grade-level pace',
    rightLabel: 'More weight on mastery & depth',
  },
  {
    id: 'tension-speed-reasoning',
    question: 'Speed & accuracy vs. reasoning & transfer',
    leftLabel: 'More weight on speed & accuracy',
    rightLabel: 'More weight on reasoning & transfer',
  },
  {
    id: 'tension-script-resource',
    question: 'Curriculum as script vs. curriculum as resource',
    leftLabel: 'Curriculum as script',
    rightLabel: 'Curriculum as resource',
  },
  {
    id: 'tension-inclusion-pullout',
    question: 'Inclusion vs. pull-out for students with Tier 2/3 needs',
    leftLabel: 'Inclusion',
    rightLabel: 'Pull-out',
  },
];

export const LEARNING_ELEMENT: ElementDef = {
  id: 'learning',
  title: 'Learning Activities, Instructional Practices, Curriculum & Assessment',
  shortTitle: 'Learning',
  questions: [
    {
      id: 'learning-q1',
      section: 'practices',
      question:
        'What learning activities do learners engage in (often with adults\u2019 support)?',
      buckets: [
        {
          id: 'learning-exposure',
          title: 'Core teaching & learning activities — exposure to new learning',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_LEARNING_EXPOSURE,
        },
        {
          id: 'learning-practice',
          title: 'Core teaching & learning activities — learner practice, demonstration, feedback, & reflection',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_LEARNING_PRACTICE,
        },
        {
          id: 'learning-experiential',
          title: 'Experiential learning & enrichment activities',
          archetype: 'A5',
          placeholder: 'Describe experiential learning and enrichment opportunities for learners in this component...',
        },
        {
          id: 'learning-community',
          title: 'Community and health building activities',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_LEARNING_COMMUNITY,
        },
        {
          id: 'learning-individual-planning',
          title: 'Individual planning & support activities',
          archetype: 'A5',
          placeholder: 'Describe individual planning, advising, and support activities...',
        },
      ],
    },
    {
      id: 'learning-q2',
      section: 'practices',
      question:
        'What facilitator practices, pedagogical approaches, and learner grouping approaches & modalities are utilized in delivering learning activities?',
      buckets: [
        {
          id: 'learning-pedagogical',
          title: 'Pedagogical approaches & facilitator practices',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_LEARNING_PEDAGOGICAL,
        },
        {
          id: 'learning-grouping',
          title: 'Learner grouping approaches & modalities',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_LEARNING_GROUPING,
        },
      ],
    },
    {
      id: 'learning-q3-adult',
      section: 'practices',
      question:
        '[and only for adult experience] What behind-the-scenes processes (e.g., PD, curriculum internalization routines, planning routines, assessment calibration routines, etc.) help adults to play their roles in everything above?',
      buckets: [
        {
          id: 'adult-processes-tuning',
          title: 'Processes for supporting & tuning facilitation of learning activities',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          syncedBucketId: 'adult-processes-tuning',
          tags: TAGS_ADULT_PROCESSES_TUNING,
        },
        {
          id: 'adult-professional-learning',
          title: 'Professional learning processes beyond supporting & tuning facilitation',
          archetype: 'A1',
          customAllowed: true,
          adultOnly: true,
          tags: TAGS_ADULT_PROFESSIONAL_LEARNING,
        },
        {
          id: 'learning-philosophy-tensions',
          title: 'Philosophies & approaches to common tensions related to facilitation of learning activities',
          archetype: 'A2Tension',
          contextNote: 'A-2 (Unique): choose an emphasis for each tension.',
          tensions: LEARNING_PHILOSOPHY_TENSIONS,
        },
      ],
    },
    {
      id: 'learning-q4-tools',
      section: 'tools',
      question:
        'What curricular & assessment materials & protocols are utilized in learning activities and in helping facilitators to prepare for and execute facilitating learning?',
      buckets: [
        {
          id: 'tools-curriculum-type',
          title: 'Type of curriculum used',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_TOOLS_CURRICULUM_TYPE,
        },
        {
          id: 'tools-core-curricula',
          title: 'Specific core curricula used',
          archetype: 'A1',
          customAllowed: true,
          disciplineGroups: [
            { id: 'core-ela', label: 'English Language Arts', tags: CORE_CURRICULA_ELA_TAGS },
            { id: 'core-math', label: 'Mathematics', tags: CORE_CURRICULA_MATH_TAGS },
          ],
        },
        {
          id: 'tools-supplemental',
          title: 'Specific supplemental curricula used',
          archetype: 'A1',
          customAllowed: true,
          disciplineGroups: [
            { id: 'supp-ela', label: 'English Language Arts', tags: SUPPLEMENTAL_ELA_TAGS },
            { id: 'supp-math', label: 'Mathematics', tags: SUPPLEMENTAL_MATH_TAGS },
          ],
        },
        {
          id: 'tools-assessment-types',
          title: 'Types of assessments used',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_TOOLS_ASSESSMENT_TYPES,
        },
        {
          id: 'tools-specific-assessments',
          title: 'Specific assessments used',
          archetype: 'A1',
          customAllowed: true,
          tags: TAGS_TOOLS_SPECIFIC_ASSESSMENTS,
        },
      ],
    },
    {
      id: 'learning-q5-adult-tools',
      section: 'tools',
      question:
        '[and only for adult experience] What additional adult-facing materials (e.g., documented instructional philosophy, assessment guides, etc.) help adults to play their roles in everything above?',
      buckets: [
        {
          id: 'adult-facing-materials',
          title: 'Additional adult-facing materials & protocols',
          archetype: 'A5',
          adultOnly: true,
          placeholder:
            'Describe documented instructional philosophies, assessment guides, facilitator resources, and other materials adults use...',
        },
      ],
    },
  ],
};
