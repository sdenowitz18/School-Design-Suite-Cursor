import type { ElementDef } from './expert-view-types';
import { CULTURE_ELEMENT } from './culture-element-schema';
import { FACILITATOR_ELEMENT } from './facilitator-element-schema';
import { LEARNING_ELEMENT } from './learning-element-schema';
import { IMPROVEMENT_ELEMENT } from './improvement-element-schema';
import { OPS_ELEMENT } from './ops-element-schema';
import { PARTNERSHIPS_ELEMENT } from './partnerships-element-schema';

export const SCHEDULE_ELEMENT: ElementDef = {
  id: 'schedule',
  title: 'Schedule & Use of Time',
  shortTitle: 'Schedule',
  questions: [
    {
      id: 'schedule-q1',
      section: 'practices' as const,
      question:
        "Into what blocks of time is the experience divided, and for each block: how long is it, what\u2019s its general purpose, and when in a day/week/year does it occur?",
      buckets: [
        {
          id: 'formats-of-time-blocks',
          title: 'Formats of scheduled blocks of time',
          archetype: 'A1',
          customAllowed: true,
          ringOnly: true,
          contextNote: 'Configured at the ring / subcomponent level — center shows an aggregated view',
          tags: [
            { id: 'core-course', label: 'Core course' },
            { id: 'elective-special', label: 'Elective/special course' },
            { id: 'course-pathway', label: 'Course pathway/progression' },
            { id: 'advisory-block', label: 'Advisory block' },
            { id: 'community-gathering', label: 'Community gathering' },
            { id: 'capstone-experience', label: 'Capstone experience' },
            { id: 'club-extracurricular', label: 'Club or extracurricular' },
            { id: 'special-event', label: 'Special event' },
            { id: 'flex-block', label: 'Flex block' },
            { id: 'integrated-block', label: 'Integrated into a time block mostly defined elsewhere' },
            { id: 'other-time-block', label: 'Other time block' },
          ],
        },
        {
          id: 'number-of-classrooms-and-students',
          title: 'Number of classrooms and students',
          archetype: 'A5',
          hideAtCenter: true,
          placeholder:
            'Describe the number of classrooms and students for this component…',
        },
        {
          id: 'general-purpose',
          title: 'General purpose of a time block',
          archetype: 'A2',
          customAllowed: true,
          ringOnly: true,
          contextNote: 'Not filled out at the center component level — populated from ring/subcomponent entries',
          tags: [
            { id: 'tier-1-core', label: 'Tier 1 core' },
            { id: 'tier-1-enrichment', label: 'Tier 1 enrichment' },
            { id: 'tier-2-3-intervention', label: 'Tier 2/3 intervention' },
          ],
        },
        {
          id: 'duration',
          title: 'Duration',
          archetype: 'A3',
          customAllowed: false,
          hideAtCenter: true,
          units: ['min', 'hrs', 'days'],
        },
        {
          id: 'frequency',
          title: 'Frequency',
          archetype: 'A3',
          customAllowed: false,
          hideAtCenter: true,
          units: ['per day', 'per week', 'per month', 'per quarter', 'per year', 'overall student experience'],
        },
        {
          id: 'specific-times',
          title: 'Specific times',
          archetype: 'A4',
          customAllowed: true,
          hideAtCenter: true,
        },
        {
          id: 'sequencing',
          title: 'Sequencing',
          archetype: 'A1',
          customAllowed: true,
          hideAtCenter: true,
          tags: [
            { id: 'multiyear-sequence', label: 'Multiyear sequence of experiences' },
            { id: 'standalone', label: 'Standalone experience' },
            { id: 'standalone-prereqs', label: 'Prerequisites to the experience' },
          ],
        },
        {
          id: 'special-containers',
          title: 'Special containers',
          archetype: 'A1',
          customAllowed: true,
          tags: [
            {
              id: 'mini-terms',
              label: 'Mini-terms / sessions',
              secondaries: [
                { id: 'intersession', label: 'Intersession' },
                { id: 'senior-week', label: 'Senior week' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'schedule-q2',
      section: 'practices' as const,
      question:
        'What must be true of how the school day, week, and year are laid out (when they start and end, when there are breaks or transitions, etc.) in order to enable the time blocks above to occur in their designed duration, frequency, and timing?',
      buckets: [
        {
          id: 'school-day-week-year-layout',
          title: 'School day, week, and year layout',
          archetype: 'A1',
          customAllowed: true,
          centerOnly: true,
          contextNote: 'Center component only',
          tags: [
            { id: 'traditional-school-day', label: 'Traditional school day & week' },
            {
              id: 'early-delayed-start',
              label: 'Early or delayed start',
              secondaries: [
                { id: 'early-start', label: 'Early start' },
                { id: 'delayed-start', label: 'Delayed start' },
              ],
            },
            {
              id: 'shortened-extended-day',
              label: 'Shortened or extended school day',
              secondaries: [
                { id: 'shortened-school-day', label: 'Shortened school day' },
                { id: 'extended-school-day', label: 'Extended school day' },
              ],
            },
            {
              id: 'shortened-extended-week',
              label: 'Shortened or extended school week',
              secondaries: [
                { id: 'shortened-school-week', label: 'Shortened school week' },
                { id: 'extended-school-week', label: 'Extended school week' },
              ],
            },
            {
              id: 'shortened-extended-year',
              label: 'Shortened or extended school year',
              secondaries: [
                { id: 'shortened-school-year', label: 'Shortened school year' },
                { id: 'extended-school-year', label: 'Extended school year' },
              ],
            },
            {
              id: 'block-alternating-schedules',
              label: 'Block and/or alternating schedules',
              secondaries: [
                { id: 'block-scheduling', label: 'Block scheduling' },
                { id: 'alternating-scheduling', label: 'Alternating scheduling' },
              ],
            },
            {
              id: 'flexible-self-paced',
              label: 'Flexible, individualized, or self-paced schedules',
              secondaries: [
                { id: 'choice-blocks-days', label: 'Choice blocks/days' },
                { id: 'flexible-older-students', label: 'Flexible scheduling for older students' },
              ],
            },
            { id: 'other-layout', label: 'Other' },
          ],
        },
      ],
    },
    {
      id: 'schedule-q3',
      section: 'practices' as const,
      question:
        'What must be true of scheduling systems & routines to make all of this possible?',
      buckets: [
        {
          id: 'master-scheduling-systems',
          title: 'Master scheduling systems',
          archetype: 'A5',
          placeholder:
            'Describe the master scheduling systems and routines used to enable the above time blocks...',
        },
      ],
    },
    {
      id: 'schedule-q4',
      section: 'tools' as const,
      question:
        'What scheduling tools & resources are utilized to help all participants in the learning community - learners and adults - to be assigned to experiences, know where to go & when, and make adjustments as needed?',
      buckets: [
        {
          id: 'scheduling-tools-resources',
          title: 'Scheduling tools & resources',
          archetype: 'A5',
          placeholder:
            'Describe the scheduling tools and resources used by learners, educators, and administrators...',
        },
      ],
    },
  ],
};

export const ALL_ELEMENTS: ElementDef[] = [SCHEDULE_ELEMENT, LEARNING_ELEMENT, CULTURE_ELEMENT, FACILITATOR_ELEMENT, PARTNERSHIPS_ELEMENT, OPS_ELEMENT, IMPROVEMENT_ELEMENT];
