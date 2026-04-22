/**
 * Seed Algebra, Teach to One Math, Extra Curriculars, College Exposure
 *
 * Run with:
 *   node --env-file=.env --import tsx/esm scripts/seed-batch-3.ts
 */

import { storage } from "../../server/storage.ts";

// ── ID helpers ────────────────────────────────────────────────────────────────

let _counter = 0;
function genId(): string {
  return `de_${Date.now()}_${++_counter}`;
}

// ── Aim builders ──────────────────────────────────────────────────────────────

function leap(label: string, priority: "H" | "M" | "L", notes: string): Record<string, unknown> {
  return {
    id: genId(),
    type: "leap",
    label,
    overrideLevel: priority,
    levelMode: "override",
    level: priority === "H" ? "High" : priority === "M" ? "Medium" : "Low",
    notes,
    selected: true,
  };
}

function outcome(
  l2Label: string,
  priority: "H" | "M" | "L",
  notes: string,
  opts: {
    subSelections?: string[];
    subPriorities?: Record<string, "H" | "M" | "L">;
    subPrimaries?: Record<string, boolean>;
    isPrimary?: boolean;
  } = {},
): Record<string, unknown> {
  const now = Date.now();
  const subPrimaryTimestamps: Record<string, number> = {};
  if (opts.subPrimaries) {
    let ts = now;
    for (const [k, v] of Object.entries(opts.subPrimaries)) {
      if (v) subPrimaryTimestamps[k] = ts++;
    }
  }
  return {
    id: genId(),
    type: "outcome",
    label: l2Label,
    overrideLevel: priority,
    levelMode: "override",
    level: priority === "H" ? "High" : priority === "M" ? "Medium" : "Low",
    notes,
    selected: true,
    ...(opts.subSelections ? { subSelections: opts.subSelections } : {}),
    ...(opts.subPriorities ? { subPriorities: opts.subPriorities } : {}),
    ...(opts.subPrimaries ? { subPrimaries: opts.subPrimaries } : {}),
    ...(Object.keys(subPrimaryTimestamps).length ? { subPrimaryTimestamps } : {}),
    ...(opts.isPrimary !== undefined ? { isPrimary: opts.isPrimary } : {}),
    primarySelectedAt: opts.isPrimary ? now : undefined,
  };
}

// ── Expert data value builders ────────────────────────────────────────────────

function a1Tag(
  tagId: string,
  opts: { isKey?: boolean; notes?: string; secondaries?: string[] } = {},
): Record<string, unknown> {
  return {
    tagId,
    isKey: opts.isKey ?? false,
    notes: opts.notes ?? "",
    selectedSecondaries: (opts.secondaries ?? []).map((s) => ({ tagId: s, isKey: false, notes: "" })),
  };
}

function a1Val(tags: ReturnType<typeof a1Tag>[]): Record<string, unknown> {
  return { archetypeA1: { selections: tags } };
}

function a3Val(value: number, unit: string, description: string, isKey = false): Record<string, unknown> {
  return { archetypeA3: { value, unit, description, isKey } };
}

function a3PairVal(first: number, second: number, isKey = false): Record<string, unknown> {
  return { archetypeA3Pair: { first, second, isKey } };
}

function a5Val(text: string, isKey = false): Record<string, unknown> {
  return { archetypeA5: { text, inheritFromSchool: false, isKey } };
}

// ── Sub builder (no subcomponents within subcomponents) ───────────────────────

function subcomponent(
  name: string,
  description: string,
  expertData: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  return {
    id: genId(),
    name,
    description,
    elementsExpertData: expertData,
    aims: [],
    learnersProfile: {},
    adultsProfile: {},
  };
}

// ── Learners / adults profile builders ────────────────────────────────────────

function learnersProfile(
  primaryId: string,
  secondaryIds: string[],
  description: string,
): Record<string, unknown> {
  return {
    selections: [{ isKey: false, primaryId, description, secondaryIds }],
  };
}

function adultsProfile(
  selections: Array<{ primaryId: string; secondaryIds: string[]; description: string }>,
  q1PlainText = "",
): Record<string, unknown> {
  return {
    selections: selections.map((s) => ({
      isKey: false,
      primaryId: s.primaryId,
      description: s.description,
      secondaryIds: s.secondaryIds,
    })),
    q1PlainText,
    q2PlainText: "",
    sliceDetail: Object.fromEntries(
      selections.map((s) => [
        s.primaryId,
        {
          name: { text: s.description || s.primaryId },
        },
      ]),
    ),
  };
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

function snapshotData(opts: {
  primaryOutcome1?: string;
  primaryOutcome2?: string;
  classroomsStudents?: string;
  durationFrequency?: string;
  whyItMatters?: string;
  craftStage?: string;
  craftMonth?: number;
  craftTotal?: number;
}): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  if (opts.primaryOutcome1) snap.primaryOutcome1 = opts.primaryOutcome1;
  if (opts.primaryOutcome2) snap.primaryOutcome2 = opts.primaryOutcome2;
  if (opts.classroomsStudents) snap.classroomsStudents = opts.classroomsStudents;
  if (opts.durationFrequency) snap.durationFrequency = opts.durationFrequency;
  if (opts.whyItMatters) snap.whyItMatters = opts.whyItMatters;
  if (opts.craftStage) snap.craftStage = opts.craftStage;
  if (opts.craftMonth !== undefined) snap.craftMonth = opts.craftMonth;
  if (opts.craftTotal !== undefined) snap.craftTotal = opts.craftTotal;
  return snap;
}

// ════════════════════════════════════════════════════════════════════════════
// ALGEBRA
// ════════════════════════════════════════════════════════════════════════════

function algebraData() {
  const aims = [
    leap(
      "High expectations with rigorous learning",
      "H",
      "All algebra students engage with grade-level or above content daily. Challenge is paired with structured scaffolds so every learner can access complex problem solving and mathematical reasoning.",
    ),
    leap(
      "Agency",
      "H",
      "Students set individual math goals, track their progress on mastery objectives, and have regular opportunities to choose between problem-solving approaches and project formats.",
    ),
    leap(
      "Whole-child focus",
      "M",
      "Math anxiety is treated as a real barrier. Teachers build a psychologically safe classroom culture where mistakes are part of learning, and students' identities as mathematical thinkers are affirmed.",
    ),
    leap(
      "Relevance",
      "M",
      "Algebra concepts are grounded in real-world contexts students recognize — financial planning, sports analytics, social data — so that abstract structures connect to lived experience.",
    ),
    outcome("Mathematics", "H", "Algebra is the foundational math course. Deep algebraic proficiency is the primary academic goal for all enrolled students.", {
      subSelections: ["Algebraic knowledge & skills", "Math habits"],
      subPriorities: { "Algebraic knowledge & skills": "H", "Math habits": "M" },
      subPrimaries: { "Algebraic knowledge & skills": true },
      isPrimary: true,
    }),
    outcome(
      "Higher order thinking skills",
      "M",
      "Mathematical problem-solving is one of the richest contexts for developing critical and systems thinking. Algebra instruction deliberately surfaces multiple-step reasoning as a transferable skill.",
      {
        subSelections: ["Critical thinking"],
        subPriorities: { "Critical thinking": "M" },
        subPrimaries: { "Critical thinking": true },
        isPrimary: false,
      },
    ),
  ];

  const expert: Record<string, Record<string, unknown>> = {
    schedule: {
      "schedule-q1__formats-of-time-blocks": a1Val([
        a1Tag("core-course", { isKey: true, notes: "Algebra runs as a required core course for all students in grades 8–9, meeting daily." }),
        a1Tag("flex-block", { notes: "Weekly 30-minute flex block allows students who need additional practice or extension work to get targeted support." }),
      ]),
      "schedule-q1__number-of-classrooms-and-students": a3PairVal(8, 220, true),
      "schedule-q1__general-purpose": a1Val([
        a1Tag("tier-1-core", { isKey: true, notes: "All Algebra sessions are Tier 1 core instruction serving the full grade cohort." }),
      ]),
      "schedule-q1__duration": a3Val(55, "min", "55-minute class periods, five days per week", true),
      "schedule-q1__frequency": a3Val(5, "days/week", "Daily instruction throughout the full academic year", true),
      "schedule-q1__sequencing": a1Val([
        a1Tag("multiyear-sequence", { isKey: true, notes: "Algebra is the gateway course in a multiyear math sequence: Pre-Algebra → Algebra → Geometry → Algebra II → Pre-Calculus." }),
      ]),
      "schedule-q3__master-scheduling-systems": a5Val(
        "Algebra is scheduled as a required course in the master schedule. Students are placed based on prior-year performance and diagnostic assessment data. Sections are heterogeneous by design to avoid ability-tracking stigma, with differentiation handled through flexible grouping within the classroom rather than separate tracks.",
        true,
      ),
    },

    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", {
          isKey: true,
          notes: "Each class begins with a 10–15 min focused mini-lesson introducing or extending a concept using precise mathematical language and worked examples.",
        }),
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
          isKey: true,
          notes: "Students regularly encounter 'launch' problems that require them to reason through new territory before formal instruction confirms or extends their thinking.",
          secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-problem-based-learning"],
        }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-discourse", {
          isKey: true,
          notes: "Daily partner and small-group discussions around problem approaches build mathematical argumentation skills. 'Number talks' are used three times per week.",
        }),
        a1Tag("learning-practice-fluency-practice", {
          isKey: true,
          notes: "5-minute fluency routines at the start of each class target arithmetic automaticity and foundational algebraic manipulations.",
        }),
        a1Tag("learning-practice-formative-assessment", {
          isKey: true,
          notes: "Exit tickets tied to daily learning objectives allow teachers to sort student work and plan differentiated follow-up for the next session.",
          secondaries: ["learning-practice-formative-assessment-exit-tickets"],
        }),
        a1Tag("learning-practice-summative-assessment", {
          notes: "End-of-unit assessments combine procedural fluency items with open-ended performance tasks requiring students to model and justify solutions.",
          secondaries: ["learning-practice-summative-assessment-performance-assessment"],
        }),
      ]),
      "learning-q1__learning-community": a1Val([
        a1Tag("learning-community-circles", {
          notes: "Monthly community circles address math identity and normalize productive struggle, helping students reframe challenges as growth opportunities.",
        }),
      ]),
      "learning-q2__learning-pedagogical": a1Val([
        a1Tag("learning-pedagogical-whole-child-supportive-teacher-tone", {
          isKey: true,
          notes: "Teachers consistently communicate high expectations while validating effort over innate ability. Explicit messaging counters fixed mindset narratives about 'math people.'",
        }),
        a1Tag("learning-pedagogical-differentiation-practices-select-all-that-apply", {
          isKey: false,
          notes: "Tasks are designed with multiple entry points; students who finish early extend to challenge problems while those needing support access scaffolded versions of the same core task.",
        }),
      ]),
      "learning-q2__learning-grouping": a1Val([
        a1Tag("learning-grouping-small-group", {
          isKey: true,
          notes: "Flexible small groups (3–4 students) shift weekly based on formative data, ensuring no student is permanently sorted into a 'low' group.",
        }),
        a1Tag("learning-grouping-partner", {
          isKey: true,
          notes: "Partner work is used for problem-solving tasks; intentional pairing rotates to build cross-peer relationships and expose students to multiple approaches.",
        }),
        a1Tag("learning-grouping-whole-group", {
          notes: "Whole-group is used for launch problems and class-wide math discussions to share and compare solution strategies.",
        }),
      ]),
      "learning-q3-adult__adult-processes-tuning": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", {
          isKey: true,
          notes: "The math department meets weekly to analyze student work, calibrate common assessments, and plan differentiated instructional moves.",
          secondaries: ["adult-processes-tuning-collaborative-teams-departmental"],
        }),
        a1Tag("adult-processes-tuning-instructional-coaching", {
          isKey: false,
          notes: "An instructional coach provides bi-weekly classroom observations and debrief cycles focused on discourse facilitation and formative assessment use.",
        }),
      ]),
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-hqim", {
          isKey: true,
          notes: "Illustrative Mathematics (IM) Algebra I curriculum is the core instructional resource, selected for its problem-based design and rigorous conceptual development.",
        }),
      ]),
      "learning-q4-tools__tools-assessment-types": a1Val([
        a1Tag("tools-assessment-types-formative-assessment", {
          isKey: true,
          notes: "Daily exit tickets and weekly check-for-understanding tasks inform instructional adjustments.",
          secondaries: ["tools-assessment-types-formative-assessment-exit-tickets"],
        }),
        a1Tag("tools-assessment-types-summative-assessment", {
          isKey: true,
          notes: "End-of-unit assessments include both procedural and conceptual problem types; performance tasks are scored with shared rubrics.",
          secondaries: ["tools-assessment-types-summative-assessment-performance-assessment"],
        }),
        a1Tag("tools-assessment-types-diagnostic-screening", {
          notes: "Beginning-of-year diagnostic (NWEA MAP) used to identify gaps and plan differentiated support.",
        }),
      ]),
    },

    culture: {
      "culture-q1__culture-behavior-mgmt": a1Val([
        a1Tag("restorative-practices", {
          isKey: true,
          notes: "Restorative circles are used when students disengage or experience conflict, refocusing on belonging and mutual accountability rather than punitive consequences.",
        }),
      ]),
      "culture-q2__culture-facilitator-practices": a5Val(
        "Teachers model mathematical thinking out loud, including uncertainty and revision, to normalize productive struggle. Classroom walls display student solution strategies — not just correct answers — to communicate that process matters as much as outcome. Teachers explicitly address math anxiety at the start of each semester and revisit growth mindset framing monthly.",
        true,
      ),
      "culture-q4-tools__touchstones-core-values": a5Val(
        "Every student is a mathematician · Struggle is how we grow · Multiple approaches are valued · We build each other up",
        true,
      ),
      "culture-q4-tools__touchstones-core-commitments": a5Val(
        "We show our thinking, not just our answers. We give our peers time to reason before sharing solutions. We ask 'why?' as often as we ask 'what?'",
      ),
    },

    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", {
          isKey: true,
          notes: "Each Algebra section has a single lead teacher, a certified math educator with content-specific training in algebraic reasoning and IM curriculum facilitation.",
        }),
        a1Tag("co-teaching", {
          notes: "Select sections have co-teachers to support students with IEPs, providing in-class differentiation without pull-out disruption.",
          secondaries: ["push-in-specialists"],
        }),
      ]),
      "facilitator-q1__fac-ratio": { archetypeA3Ratio: { learners: 25, facilitators: 1, isKey: false } },
      "facilitator-q2-adult__fac-role-definition": a5Val(
        "Algebra teachers are responsible for delivering rigorous, student-centered math instruction aligned to the IM curriculum sequence. Key responsibilities include: facilitating daily number talks and problem launches, using exit ticket data to plan next-day instruction, running weekly flexible small-group sessions, and participating in bi-weekly collaborative planning meetings. Teachers are also expected to cultivate positive math identity in all students.",
        true,
      ),
      "facilitator-q3-adult-tools__fac-competency-framework": a1Val([
        a1Tag("danielson", {
          isKey: true,
          notes: "Danielson framework for formal observation, with supplemental math-specific competencies from the Teaching for Robust Understanding (TRU) framework.",
        }),
      ]),
    },

    partnerships: {
      "partnerships-q1__partnerships-family": a1Val([
        a1Tag("family-workshops-presentations", {
          isKey: true,
          notes: "Annual 'Math Night' for families introduces IM problem-based learning methods and provides families with strategies to support homework completion without doing the work for students.",
        }),
        a1Tag("regular-progress-communication", {
          notes: "Bi-weekly progress updates are sent home highlighting specific skills mastered and areas of focus.",
        }),
      ]),
    },

    improvement: {
      "improvement-ci-q1__ci-people-teams": a1Val([
        a1Tag("teacher-led-improvement-team", {
          isKey: true,
          notes: "A teacher-led math improvement team meets quarterly to review course-level data, identify systemic gaps, and propose curriculum or instructional adjustments.",
        }),
      ]),
      "improvement-ci-q1__ci-tuning-practices": a1Val([
        a1Tag("data-review-cycles", {
          isKey: true,
          notes: "Quarterly data review sessions use common assessment results to identify which students are not yet on track and plan targeted instructional responses.",
        }),
      ]),
    },
  };

  return {
    designedExperienceData: {
      keyDesignElements: { aims },
      subcomponents: [],
      adultSubcomponents: [],
      learnersProfile: learnersProfile("grade_high_school", ["grade_8", "grade_9"], "Grade 8–9 students enrolled in the core Algebra sequence. Heterogeneous sections by design."),
      adultsProfile: adultsProfile([
        { primaryId: "educators", secondaryIds: ["math-teachers"], description: "Certified mathematics teachers trained in Illustrative Mathematics facilitation." },
        { primaryId: "instructional_coaches", secondaryIds: [], description: "Math instructional coaches providing bi-weekly observation and coaching cycles." },
      ]),
      elementsExpertData: expert,
    },
    snapshotData: snapshotData({
      primaryOutcome1: "Algebraic knowledge & skills",
      primaryOutcome2: "Critical thinking",
      classroomsStudents: "8 classrooms, ~220 students",
      durationFrequency: "55 min/day, 5 days/week",
      whyItMatters: "Algebra is the gateway to all higher mathematics. Building deep algebraic fluency — alongside a positive math identity — opens post-secondary pathways in STEM, business, and beyond. We prioritize rigorous, problem-based instruction so that every student, regardless of prior performance, leaves with both the skills and the confidence to go further.",
      craftStage: "Designing",
      craftMonth: 2,
      craftTotal: 6,
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TEACH TO ONE MATH
// ════════════════════════════════════════════════════════════════════════════

function teachToOneData() {
  const aims = [
    leap(
      "Customization",
      "H",
      "Teach to One Math is built on the premise that no two students are at the same place in their math learning. Each student receives a personalized daily lesson aligned to their exact point of need, drawn from a pool of skill objectives that span multiple grade bands.",
    ),
    leap(
      "Agency",
      "H",
      "Students engage in goal-setting, track their own mastery of skill objectives, and have visible dashboards showing their learning trajectory. This transparency builds ownership over learning pace and direction.",
    ),
    leap(
      "Whole-child focus",
      "M",
      "Beyond academic skill, the program creates daily touchpoints for students to connect with adults and peers through collaborative modalities. Teachers are freed from lecture to spend more time conferring and building relationships.",
    ),
    outcome("Mathematics", "H", "The entire program is dedicated to accelerating math proficiency through personalized skill sequencing and multi-modal instruction.", {
      subSelections: ["Algebraic knowledge & skills", "Math identity", "Math habits"],
      subPriorities: { "Algebraic knowledge & skills": "H", "Math identity": "M", "Math habits": "H" },
      subPrimaries: { "Algebraic knowledge & skills": true },
      isPrimary: true,
    }),
    outcome(
      "Learning strategies & habits",
      "M",
      "T2O Math develops metacognitive habits — tracking progress, identifying gaps, adjusting approach — that transfer beyond math class.",
      {
        subSelections: ["Goal-setting"],
        subPriorities: { "Goal-setting": "M" },
        subPrimaries: { "Goal-setting": true },
        isPrimary: false,
      },
    ),
  ];

  const expert: Record<string, Record<string, unknown>> = {
    schedule: {
      "schedule-q1__formats-of-time-blocks": a1Val([
        a1Tag("core-course", { isKey: true, notes: "T2O Math is a core required math course running daily, replacing the traditional single-teacher math class with a multi-modal adaptive environment." }),
        a1Tag("flex-block", { notes: "Students who complete their objective early can access extended challenge work or switch to a support station." }),
      ]),
      "schedule-q1__number-of-classrooms-and-students": a3PairVal(3, 90, true),
      "schedule-q1__general-purpose": a1Val([
        a1Tag("tier-1-core", { isKey: true, notes: "Tier 1 core math instruction delivered at each student's exact point of proficiency." }),
      ]),
      "schedule-q1__duration": a3Val(70, "min", "70-minute extended periods to allow full rotation through multiple learning modalities each day", true),
      "schedule-q1__frequency": a3Val(5, "days/week", "Daily, five days per week", true),
      "schedule-q3__master-scheduling-systems": a5Val(
        "Teach to One requires dedicated scheduling of a large common space (or connected classrooms) to run simultaneous learning modalities. The T2O scheduling algorithm generates each student's daily lesson the prior evening, pulling from a bank of 200+ skill objectives. Teachers receive aggregate data on which students will be in which modality each day, allowing proactive small-group preparation.",
        true,
      ),
    },

    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", {
          isKey: true,
          notes: "Live direct instruction modality delivers 15-min focused mini-lessons to small groups of 8–12 students sharing the same skill objective on a given day.",
        }),
        a1Tag("learning-exposure-technology-adaptive-platform", {
          isKey: true,
          notes: "Adaptive software (T2O platform) delivers personalized practice problems, adjusting difficulty in real time based on accuracy and response patterns. Students spend 20–25 min per session.",
        }),
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
          isKey: false,
          notes: "Collaborative reasoning modality pairs students on shared complex tasks requiring them to construct understanding jointly before receiving feedback.",
          secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-collaborative-reasoning"],
        }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-fluency-practice", {
          isKey: true,
          notes: "Skill-specific fluency practice embedded into the adaptive platform and teacher-led modalities reinforces automaticity for each objective.",
        }),
        a1Tag("learning-practice-formative-assessment", {
          isKey: true,
          notes: "Daily skill checks built into the T2O platform provide mastery signals that determine the next day's objective. Teachers receive a nightly report.",
          secondaries: ["learning-practice-formative-assessment-exit-tickets"],
        }),
        a1Tag("learning-practice-discourse", {
          notes: "Collaborative modality sessions include structured peer discussion requiring students to explain solution strategies.",
        }),
      ]),
      "learning-q2__learning-pedagogical": a1Val([
        a1Tag("learning-pedagogical-differentiation-practices-select-all-that-apply", {
          isKey: true,
          notes: "Full personalization: every student works on a unique, algorithm-assigned objective appropriate for their current skill level — no lockstep instruction.",
        }),
        a1Tag("learning-pedagogical-data-driven-instruction", {
          isKey: true,
          notes: "Nightly algorithm output and weekly data reviews with T2O coaches drive teacher decisions about intervention, grouping, and pacing.",
        }),
      ]),
      "learning-q2__learning-grouping": a1Val([
        a1Tag("learning-grouping-small-group", {
          isKey: true,
          notes: "Daily algorithm-generated small groups (skill-alike, 8–12 students) receive targeted live instruction from the teacher or a co-facilitator.",
        }),
        a1Tag("learning-grouping-station-rotation", {
          isKey: true,
          notes: "Students rotate through 3–4 modality stations each period: Live Investigation, Collaborative Reasoning, Independent Practice (software), and Teacher-Led Small Group.",
        }),
        a1Tag("learning-grouping-independent", {
          notes: "Independent work at the software station is a core daily modality, building student self-direction and adaptive practice habits.",
        }),
      ]),
      "learning-q3-adult__adult-processes-tuning": a1Val([
        a1Tag("adult-processes-tuning-data-review", {
          isKey: true,
          notes: "Weekly 45-minute T2O data meetings with the school T2O coach review student mastery signals, modality effectiveness data, and algorithm scheduling patterns.",
        }),
        a1Tag("adult-processes-tuning-instructional-coaching", {
          isKey: true,
          notes: "Dedicated T2O implementation coaches provide real-time classroom support during multi-modal sessions and lead monthly structured coaching conversations.",
        }),
      ]),
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-adaptive-platform", {
          isKey: true,
          notes: "The Teach to One: Redesign proprietary platform serves as both curriculum sequencer and adaptive practice engine, delivering daily personalized lesson plans.",
        }),
      ]),
      "learning-q4-tools__tools-assessment-types": a1Val([
        a1Tag("tools-assessment-types-formative-assessment", {
          isKey: true,
          notes: "Daily in-platform skill checks provide mastery signals for algorithm-driven placement.",
          secondaries: ["tools-assessment-types-formative-assessment-exit-tickets"],
        }),
        a1Tag("tools-assessment-types-diagnostic-screening", {
          isKey: true,
          notes: "Beginning-of-year diagnostic places students into their individualized learning trajectory; mid-year diagnostic recalibrates placement.",
        }),
        a1Tag("tools-assessment-types-competency-based-assessment", {
          notes: "Skill objective mastery model allows students to earn 'proficient' status on individual skills non-linearly rather than waiting for end-of-unit assessments.",
          secondaries: ["tools-assessment-types-competency-based-assessment-mastery-based-assessment"],
        }),
      ]),
    },

    culture: {
      "culture-q1__culture-community-health": a1Val([
        a1Tag("learning-community-circles", {
          isKey: true,
          notes: "Weekly community circles in the T2O space surface student experience of the model, address frustrations with pacing, and celebrate individual goal progress.",
        }),
      ]),
      "culture-q2__culture-facilitator-practices": a5Val(
        "In a multi-modal environment, teacher presence is distributed across stations. Teachers are trained to circulate with intention — pausing to confer with individuals at the software station, facilitating collaborative discussions, and running high-quality live mini-lessons simultaneously. Building trust with students about the 'algorithm' and being transparent about how placement decisions are made are key cultural norms.",
        true,
      ),
      "culture-q4-tools__touchstones-core-values": a5Val(
        "Your path is yours · Data is feedback, not judgment · Progress over perfection · Every student moves forward",
        true,
      ),
    },

    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", {
          isKey: true,
          notes: "A lead math teacher anchors each T2O session, responsible for the live instruction modality and overall classroom management.",
        }),
        a1Tag("expanded-adult-supports", {
          isKey: true,
          notes: "One to two additional facilitators (para-educators or co-teachers) circulate through software and collaborative modalities to support students during independent work.",
          secondaries: ["push-in-specialists", "para-educators"],
        }),
      ]),
      "facilitator-q1__fac-ratio": { archetypeA3Ratio: { learners: 20, facilitators: 2, isKey: false } },
      "facilitator-q2-adult__fac-role-definition": a5Val(
        "T2O teachers must shift from a traditional 'stand-and-deliver' role to a distributed facilitation model. On any given day, the teacher may lead 2–3 different live mini-lessons to different skill groups, while also circulating to confer with software-station students. Key responsibilities include: reviewing nightly algorithm output and preparing next-day mini-lesson content, facilitating collaborative problem-solving discussions, and leading weekly data meetings with T2O coaches.",
        true,
      ),
      "facilitator-q3-adult-tools__fac-competency-framework": a1Val([
        a1Tag("danielson", {
          isKey: true,
          notes: "Danielson framework augmented with T2O-specific facilitation competencies focused on multi-modal classroom management and data-driven micro-teaching.",
        }),
      ]),
    },

    ops: {
      "ops-q1__ops-physical-space": a1Val([
        a1Tag("flexible-space", {
          isKey: true,
          notes: "T2O Math runs in a large open or semi-open space — 2–3 connected classrooms or a reconfigured common area — with movable furniture to support simultaneous modality stations.",
        }),
      ]),
      "ops-q1__ops-software": a1Val([
        a1Tag("adaptive-learning-platform", {
          isKey: true,
          notes: "Teach to One proprietary adaptive platform is the primary software. Students use individual devices (Chromebooks or tablets) for daily software station work.",
        }),
      ]),
    },

    improvement: {
      "improvement-ci-q1__ci-people-teams": a1Val([
        a1Tag("external-partner-team", {
          isKey: true,
          notes: "New Classrooms (T2O developers) provides an implementation coach who visits monthly and participates in weekly data review calls with the school team.",
        }),
      ]),
      "improvement-ci-q1__ci-tuning-practices": a1Val([
        a1Tag("data-review-cycles", {
          isKey: true,
          notes: "Weekly algorithm data review cycles with the T2O coach examine student placement accuracy, modality engagement rates, and skill mastery velocity.",
        }),
      ]),
    },
  };

  return {
    designedExperienceData: {
      keyDesignElements: { aims },
      subcomponents: [],
      adultSubcomponents: [],
      learnersProfile: learnersProfile("grade_middle_school", ["grade_6", "grade_7", "grade_8"], "Grades 6–8 students enrolled in the personalized math program. Serves the full grade cohort with heterogeneous skill levels."),
      adultsProfile: adultsProfile([
        { primaryId: "educators", secondaryIds: [], description: "Lead math teachers trained in T2O multi-modal facilitation and nightly data review routines." },
        { primaryId: "instructional_coaches", secondaryIds: [], description: "Dedicated T2O implementation coaches from New Classrooms providing weekly data support and monthly site visits." },
        { primaryId: "paraprofessionals", secondaryIds: [], description: "Para-educators supporting student navigation of modality stations during daily sessions." },
      ]),
      elementsExpertData: expert,
    },
    snapshotData: snapshotData({
      primaryOutcome1: "Algebraic knowledge & skills",
      primaryOutcome2: "Goal-setting",
      classroomsStudents: "3 connected spaces, ~90 students",
      durationFrequency: "70 min/day, 5 days/week",
      whyItMatters: "Teach to One Math ensures no student is held back or pushed ahead of their actual learning edge. By personalizing every student's daily lesson through adaptive algorithms and multiple modalities, we meet learners where they are and accelerate their growth toward grade-level proficiency and beyond.",
      craftStage: "Implementing",
      craftMonth: 4,
      craftTotal: 6,
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EXTRA CURRICULARS
// ════════════════════════════════════════════════════════════════════════════

function extraCurricularsData() {
  const aims = [
    leap(
      "Whole-child focus",
      "H",
      "Extra-curricular programs are one of the school's most powerful tools for whole-child development. Athletics, arts, service, and interest clubs address social, emotional, physical, and identity dimensions of students' lives that academic coursework alone cannot reach.",
    ),
    leap(
      "Connection & community",
      "H",
      "Shared participation in activities students love is one of the fastest pathways to belonging. Clubs and sports create cross-grade and cross-identity relationships and give students a community where they genuinely want to show up.",
    ),
    leap(
      "Agency",
      "M",
      "Students choose their extra-curricular activities based on genuine interest and are increasingly invited to help design, lead, and govern them. Student-led clubs and student advisory roles in athletic programs build authentic leadership capacity.",
    ),
    outcome(
      "Relationship skills",
      "H",
      "Extra-curriculars are the school's primary setting for developing collaboration, communication, and leadership in authentic, low-stakes contexts.",
      {
        subSelections: ["Collaboration", "Communication", "Leadership & followership"],
        subPriorities: { Collaboration: "H", Communication: "M", "Leadership & followership": "H" },
        subPrimaries: { Collaboration: true },
        isPrimary: true,
      },
    ),
    outcome(
      "Productive mindsets & purpose",
      "H",
      "Extra-curricular participation helps students develop a stronger sense of identity, purpose, and self-efficacy — particularly for students who don't see themselves as 'school people' in academic settings.",
      {
        subSelections: ["Identity & purpose", "Mindsets & self-regulation"],
        subPriorities: { "Identity & purpose": "H", "Mindsets & self-regulation": "M" },
        subPrimaries: { "Identity & purpose": true },
        isPrimary: false,
      },
    ),
    outcome(
      "Productive engagement & satisfaction",
      "M",
      "Students who are active in extra-curricular programs show higher school engagement, attendance, and satisfaction scores. These programs are a key lever for keeping students connected to school.",
      {
        subSelections: ["Participation", "Engagement profiles", "Social engagement", "Satisfaction"],
        subPriorities: { Participation: "H", "Social engagement": "M", Satisfaction: "M", "Engagement profiles": "L" },
        subPrimaries: { Participation: true },
        isPrimary: false,
      },
    ),
  ];

  const expert: Record<string, Record<string, unknown>> = {
    schedule: {
      "schedule-q1__formats-of-time-blocks": a1Val([
        a1Tag("club-extracurricular", { isKey: true, notes: "Extra-curriculars include student clubs, competitive athletics, performing arts productions, and community service organizations." }),
        a1Tag("special-event", { isKey: true, notes: "Seasonal events (athletic competitions, performances, exhibitions, club fairs) anchor the extra-curricular calendar across the year." }),
        a1Tag("capstone-experience", { notes: "Senior-year capstone options include leading a club or service initiative as their culminating experience." }),
      ]),
      "schedule-q1__number-of-classrooms-and-students": a3PairVal(12, 340, false),
      "schedule-q1__general-purpose": a1Val([
        a1Tag("tier-1-enrichment", { isKey: true, notes: "All extra-curriculars are Tier 1 enrichment — open-access programming designed to expand student engagement and identity beyond academics." }),
      ]),
      "schedule-q1__frequency": a3Val(2, "days/week", "Most activities meet 2–3 times per week; competitive athletics may meet daily during season", false),
      "schedule-q1__special-containers": a1Val([
        a1Tag("mini-terms", {
          isKey: false,
          notes: "Seasonal clubs run in concentrated 6-week mini-terms, allowing students to sample multiple activities throughout the year rather than committing to a single year-long program.",
        }),
      ]),
      "schedule-q1__sequencing": a1Val([
        a1Tag("standalone", { isKey: true, notes: "Most extra-curricular offerings are standalone — students self-select annually or by season based on interest." }),
      ]),
    },

    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
          isKey: true,
          notes: "Student-led clubs operate through inquiry and self-directed exploration — faculty advisors coach from the sideline rather than directing content.",
          secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-experiential-learning"],
        }),
        a1Tag("learning-exposure-direct-instruction", {
          notes: "Athletic coaches and performing arts directors provide skill-focused direct instruction in sport-specific or craft-specific techniques.",
        }),
        a1Tag("learning-exposure-project-based-learning", {
          isKey: true,
          notes: "Service and design clubs operate as project-based experiences with real-world deliverables (community gardens, school murals, fundraising campaigns).",
        }),
        a1Tag("learning-exposure-visits-and-fairs", {
          notes: "Club fair each semester gives students a structured discovery opportunity. Athletic and performance programs host community-facing showcases and competitions.",
        }),
      ]),
      "learning-q1__learning-community": a1Val([
        a1Tag("learning-community-circles", {
          isKey: true,
          notes: "Team and club check-ins at the start of each session create a low-stakes space for students to share how they are doing and build community norms together.",
        }),
        a1Tag("learning-community-student-onboarding-transition-experiences", {
          notes: "New student orientation to extra-curriculars includes a structured peer-buddy program pairing newcomers with experienced participants.",
          secondaries: ["learning-community-student-onboarding-transition-experiences-new-student-family-welcome"],
        }),
      ]),
      "learning-q2__learning-pedagogical": a1Val([
        a1Tag("learning-pedagogical-whole-child-supportive-teacher-tone", {
          isKey: true,
          notes: "Coaches and advisors are explicitly trained to prioritize belonging and enjoyment over performance outcomes — particularly in the first year of a student's participation.",
        }),
        a1Tag("learning-pedagogical-student-voice-and-choice", {
          isKey: true,
          notes: "Students co-design club activities, choose their own project foci, and increasingly lead program governance (student athletic board, club council).",
        }),
      ]),
      "learning-q2__learning-grouping": a1Val([
        a1Tag("learning-grouping-small-group", {
          isKey: true,
          notes: "Most extra-curriculars naturally run as small groups (8–20 students), creating the intimacy necessary for strong peer relationships and adult-student connection.",
        }),
        a1Tag("learning-grouping-mixed-age", {
          isKey: true,
          notes: "Cross-grade participation is actively encouraged — older students mentor younger ones, creating vertical relationships rare in the academic setting.",
        }),
      ]),
      "learning-q3-adult__adult-processes-tuning": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", {
          isKey: false,
          notes: "Extra-curricular advisors and coaches meet once per semester to share practices, troubleshoot participation barriers, and plan school-wide extra-curricular events.",
          secondaries: ["adult-processes-tuning-collaborative-teams-whole-school"],
        }),
      ]),
    },

    culture: {
      "culture-q1__culture-community-health": a1Val([
        a1Tag("student-affinity-groups", {
          isKey: true,
          notes: "Affinity-based clubs (identity, interest, cultural) are formally supported and receive faculty advisors, ensuring students from every background find a community that reflects them.",
        }),
        a1Tag("learning-community-circles", {
          notes: "Season-opening community circles in each program establish shared norms, aspirations, and ground rules for how the group will operate together.",
        }),
      ]),
      "culture-q2__culture-facilitator-practices": a5Val(
        "Extra-curricular coaches and advisors are trained to hold a 'joy-first' posture — celebrating effort and participation before achievement. Adults actively recruit students who are most disconnected from school into activities aligned to their interests. Faculty advisors model genuine enthusiasm for the activity, and do not treat their role as a burden. Cross-program celebrations (all-club showcase, athletic banquet) build school-wide pride.",
        true,
      ),
      "culture-q4-tools__touchstones-core-values": a5Val(
        "Show up for each other · Passion is a gift — feed it · Everyone belongs somewhere · Pursue growth over trophies",
        true,
      ),
    },

    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", {
          isKey: true,
          notes: "Each program has a primary faculty advisor or coach responsible for planning, logistics, and culture of the group.",
        }),
        a1Tag("community-partners", {
          isKey: true,
          notes: "Community coaches and partner organization staff co-facilitate select programs (arts, athletics, service) bringing expertise and community connection beyond the school staff.",
        }),
      ]),
      "facilitator-q1__fac-ratio": { archetypeA3Ratio: { learners: 18, facilitators: 1, isKey: false } },
      "facilitator-q2-adult__fac-role-definition": a5Val(
        "Extra-curricular advisors and coaches are responsible for: maintaining a welcoming, high-participation culture; planning engaging sessions aligned to student interests; connecting program outcomes to broader school learning principles (whole-child, agency, community); and advocating for student participation when academic pressures arise. Advisors are not expected to be formal instructors — they are mentors, facilitators, and champions.",
        true,
      ),
    },

    partnerships: {
      "partnerships-q1__partnerships-community": a1Val([
        a1Tag("community-organization-partnerships", {
          isKey: true,
          notes: "Community organizations co-sponsor programs (local sports leagues, arts nonprofits, service organizations) and provide venues, coaches, and resources that expand the school's extra-curricular footprint.",
        }),
        a1Tag("university-partnerships", {
          notes: "Partner university provides facilities access (gyms, studio space) and college mentors who work with student clubs on college-readiness programming.",
        }),
      ]),
      "partnerships-q1__partnerships-family": a1Val([
        a1Tag("family-events-showcases", {
          isKey: true,
          notes: "Seasonal showcases, performances, and competitions invite families into the school community as active participants, not just spectators.",
        }),
        a1Tag("parent-volunteer-coordination", {
          notes: "Parent volunteer roles in event logistics (transportation, concessions, event setup) create meaningful family involvement pathways.",
        }),
      ]),
    },
  };

  return {
    designedExperienceData: {
      keyDesignElements: { aims },
      subcomponents: [],
      adultSubcomponents: [],
      learnersProfile: learnersProfile("grade_high_school", ["grade_9", "grade_10", "grade_11", "grade_12"], "All high school students grades 9–12; participation is voluntary and choice-driven. Priority outreach to students not yet connected to any school activity."),
      adultsProfile: adultsProfile([
        { primaryId: "educators", secondaryIds: [], description: "Faculty advisors who voluntarily run clubs and serve as coaches across academic year." },
        { primaryId: "community_partners", secondaryIds: [], description: "Community coaches and partner organization staff co-facilitating athletics, arts, and service programs." },
      ]),
      elementsExpertData: expert,
    },
    snapshotData: snapshotData({
      primaryOutcome1: "Collaboration",
      primaryOutcome2: "Identity & purpose",
      classroomsStudents: "12+ venues, ~340 students participating",
      durationFrequency: "2–3x/week per activity",
      whyItMatters: "Extra-curricular programs are where students find belonging, discover passions, and develop as people — not just learners. By investing in a rich and inclusive extra-curricular ecosystem, we give every student a community that cares about them and an activity that makes school worth showing up for.",
      craftStage: "Implementing",
      craftMonth: 3,
      craftTotal: 6,
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// COLLEGE EXPOSURE
// ════════════════════════════════════════════════════════════════════════════

function collegeExposureData(existing: any) {
  const existingDe = (existing.designedExperienceData as any) ?? {};
  const existingExpert = existingDe.elementsExpertData ?? {};
  const existingLearners = existingDe.learnersProfile ?? {};
  const existingAdults = existingDe.adultsProfile ?? {};

  // Clean, canonical aims — drop garbage entries from prior testing
  const aims = [
    leap(
      "Relevance",
      "H",
      "Students see college and career exploration as directly connected to who they are and where they want to go. College Exposure programming grounds abstract post-secondary concepts in students' own aspirations, cultural backgrounds, and lived experience.",
    ),
    leap(
      "Whole-child focus",
      "H",
      "Preparing for post-secondary life means more than academic credentials. The program attends to students' financial literacy, social support networks, emotional readiness, and sense of self as they navigate one of the most consequential transitions of their lives.",
    ),
    leap(
      "Connection & community",
      "M",
      "Peer networks and near-peer mentors (college students, recent alumni) are central to College Exposure. Students build relationships with others navigating similar paths and feel less alone in the college process.",
    ),
    leap(
      "Agency",
      "M",
      "Students drive their own college exploration — choosing campuses to research, setting application timelines, and selecting essay topics that authentically represent them. The advisor's role is to open doors, not choose destinations.",
    ),
    outcome(
      "Assets for continuing education, career, and life",
      "H",
      "The core mission of College Exposure is building the tangible and relational assets students need to successfully transition to post-secondary education.",
      {
        subSelections: [
          "Social network",
          "Logged experience and work artifacts",
          "Educator relationships & recommendations",
          "Early college coursework",
        ],
        subPriorities: {
          "Social network": "H",
          "Logged experience and work artifacts": "H",
          "Educator relationships & recommendations": "M",
          "Early college coursework": "M",
        },
        subPrimaries: { "Social network": true },
        isPrimary: true,
      },
    ),
    outcome(
      "Career & continuing-education navigation knowledge & skills",
      "H",
      "Students develop the practical knowledge to navigate the college application process, financial aid, and career pathways with confidence and autonomy.",
      {
        subSelections: [],
        subPriorities: {},
        subPrimaries: {},
        isPrimary: false,
      },
    ),
    outcome(
      "Productive mindsets & purpose",
      "M",
      "College Exposure cultivates an aspirational identity — students come to see higher education as genuinely for them, not just for others. Identity and purpose work helps them articulate why college matters in their own terms.",
      {
        subSelections: ["Identity & purpose"],
        subPriorities: { "Identity & purpose": "M" },
        subPrimaries: { "Identity & purpose": true },
        isPrimary: false,
      },
    ),
  ];

  // Subcomponents for College Exposure: College Visits & Admissions + Essay Writing & Applications
  const collegeVisitsSub = subcomponent(
    "College Visits & Admissions",
    "Structured campus visits, virtual tours, college panel events, and direct engagement with admissions officers. Students build a realistic picture of different types of higher education institutions and what each offers.",
    {
      learning: {
        "learning-q1__learning-exposure": a1Val([
          a1Tag("learning-exposure-visits-and-fairs", {
            isKey: true,
            notes: "In-person campus visits (2–3 per year) and virtual tours for students unable to travel. Annual college fair on campus brings 30+ institutions for direct student interaction.",
          }),
          a1Tag("learning-exposure-direct-instruction", {
            notes: "Structured admissions information sessions teach students how to read college profiles, understand acceptance rates, and evaluate fit criteria.",
          }),
        ]),
        "learning-q1__learning-community": a1Val([
          a1Tag("learning-community-student-onboarding-transition-experiences", {
            isKey: true,
            notes: "Recent alumni return as near-peer mentors for college visit debriefs, sharing honest perspectives on campus culture, dorm life, and academic expectations.",
          }),
        ]),
      },
      partnerships: {
        "partnerships-q1__partnerships-community": a1Val([
          a1Tag("university-partnerships", {
            isKey: true,
            notes: "Partner universities provide campus visit hosting, virtual Q&A sessions, and early application program access for qualified students.",
          }),
        ]),
      },
    },
  );

  const essayWritingSub = subcomponent(
    "Essay Writing & Applications",
    "Structured support for drafting, revising, and submitting college applications and financial aid materials. Students develop authentic personal narratives and navigate the Common App, FAFSA, and scholarship applications with coaching.",
    {
      learning: {
        "learning-q1__learning-exposure": a1Val([
          a1Tag("learning-exposure-direct-instruction", {
            isKey: true,
            notes: "Workshop sessions teach college essay structure, voice, and topic selection. Common App and FAFSA completion walkthroughs are provided in small groups.",
          }),
          a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
            isKey: true,
            notes: "Reflective inquiry activities help students surface their own stories, values, and experiences as essay material — moving from 'what happened' to 'what it means.'",
            secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-experiential-learning"],
          }),
        ]),
        "learning-q1__learning-practice": a1Val([
          a1Tag("learning-practice-discourse", {
            isKey: true,
            notes: "Peer essay feedback protocols allow students to workshop drafts with classmates, building revision skills and a sense of the reader's perspective.",
          }),
          a1Tag("learning-practice-summative-assessment", {
            notes: "Completed college applications and scholarship essays serve as the primary summative work product for this sub-program.",
            secondaries: ["learning-practice-summative-assessment-portfolio-assessment"],
          }),
        ]),
      },
    },
  );

  // Merge new schedule expert data on top of existing
  const newSchedule: Record<string, unknown> = {
    "schedule-q1__formats-of-time-blocks": a1Val([
      a1Tag("advisory-block", { isKey: true, notes: "College Exposure runs during dedicated advisory blocks — ensuring all seniors engage with programming regardless of academic scheduling conflicts." }),
      a1Tag("special-event", { isKey: true, notes: "College fairs, application workshops, and campus visit days are structured as special events on the school calendar." }),
    ]),
    "schedule-q1__sequencing": a1Val([
      a1Tag("multiyear-sequence", { isKey: true, notes: "College awareness starts in grade 9 (aspirational exposure), deepens in grades 10–11 (exploration and research), and becomes intensive application support in grade 12." }),
    ]),
    "schedule-q1__special-containers": a1Val([
      a1Tag("capstone-experience", {
        isKey: true,
        notes: "Senior capstone week in October is dedicated entirely to college application completion — structured around daily essay workshops, financial aid support, and one-on-one college counseling sessions.",
      }),
    ]),
    "schedule-q3__master-scheduling-systems": a5Val(
      "College Exposure programming is scheduled as a dedicated advisory block for all juniors and seniors. Freshmen and sophomores receive lighter-touch awareness programming via homeroom and school-wide events. The capstone application week is a protected time block in October for all seniors.",
      true,
    ),
    // Preserve existing schedule buckets (duration, frequency, general-purpose, number-of-classrooms-and-students)
    ...(existingExpert.schedule ?? {}),
  };

  const newExpert: Record<string, Record<string, unknown>> = {
    schedule: newSchedule,

    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", {
          isKey: true,
          notes: "Information sessions on college types, admission processes, financial aid, and career paths give students a knowledge foundation for exploration.",
        }),
        a1Tag("learning-exposure-visits-and-fairs", {
          isKey: true,
          notes: "Campus visits, virtual tours, and the annual on-campus college fair are the cornerstone experiences of College Exposure.",
        }),
        a1Tag("learning-exposure-project-based-learning", {
          isKey: false,
          notes: "Students complete a 'college research project' in junior year — selecting 6 institutions, evaluating fit, and presenting their findings to an advisory panel.",
        }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-discourse", {
          isKey: true,
          notes: "Group discussions and near-peer panels create space for students to process emotions, share information, and challenge assumptions about who goes to college and why.",
        }),
        a1Tag("learning-practice-summative-assessment", {
          isKey: true,
          notes: "Completed college applications, scholarship essays, and financial aid materials serve as the culminating work products of the program.",
          secondaries: ["learning-practice-summative-assessment-portfolio-assessment"],
        }),
      ]),
      "learning-q1__learning-individual-planning": a5Val(
        "Each junior and senior has a dedicated college counselor meeting schedule (minimum 3 individual sessions per year) to discuss college list, application strategy, essay review, and financial aid planning. Students maintain a College Planning Portfolio tracking visited schools, essay drafts, deadline calendars, and scholarship applications.",
        true,
      ),
      "learning-q2__learning-pedagogical": a1Val([
        a1Tag("learning-pedagogical-whole-child-supportive-teacher-tone", {
          isKey: true,
          notes: "College counselors are trained to affirm the validity of all post-secondary paths — including community college, trade programs, and gap years — while still supporting students' stated aspirations for four-year institutions.",
        }),
      ]),
      "learning-q3-adult__adult-processes-tuning": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", {
          isKey: true,
          notes: "College counselors and advisory teachers meet bi-weekly to identify students at risk of disengaging from the college process and plan targeted outreach.",
          secondaries: ["adult-processes-tuning-collaborative-teams-cross-functional"],
        }),
      ]),
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-oer", {
          isKey: true,
          notes: "College Advisor Pro, Common App, and FAFSA resources anchor the curriculum, supplemented by school-developed advisory lesson sequences for each grade level.",
        }),
      ]),
    },

    culture: {
      "culture-q1__culture-community-health": a1Val([
        a1Tag("learning-community-circles", {
          isKey: true,
          notes: "Monthly college cohort circles for juniors and seniors create a supportive peer community around the college process — normalizing stress and celebrating milestones (first acceptance, scholarship award).",
        }),
        a1Tag("student-affinity-groups", {
          notes: "First-generation college student group provides a dedicated peer community with near-peer alumni mentors who are themselves first-generation college students.",
        }),
      ]),
      "culture-q2__culture-facilitator-practices": a5Val(
        "College counselors and advisory teachers explicitly counter deficit narratives about which students 'deserve' to go to college. Programming starts from the assumption that every student has a post-secondary path worth exploring. Adults share their own post-secondary journeys — including non-linear paths, community college transfers, and financial challenges — to normalize diverse experiences.",
        true,
      ),
      "culture-q4-tools__touchstones-core-values": a5Val(
        "Every student is college-possible · The process is yours to own · Your story is worth telling · We celebrate every acceptance — big and small",
        true,
      ),
      "culture-q4-tools__touchstones-core-commitments": a5Val(
        "We help every student explore broadly before narrowing their list. We tell the whole truth about costs, deadlines, and odds. We celebrate all post-secondary pathways, not just selective four-year institutions.",
      ),
    },

    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("counselors", {
          isKey: true,
          notes: "Dedicated college counselors (1 per 80 students) serve as the primary facilitators of College Exposure programming — managing individual student relationships, programming logistics, and family communication.",
        }),
        a1Tag("single-lead-teacher", {
          notes: "Advisory teachers co-facilitate group sessions and serve as the first point of contact for students navigating day-to-day college stress.",
        }),
      ]),
      "facilitator-q1__fac-ratio": { archetypeA3Ratio: { learners: 80, facilitators: 1, isKey: false } },
      "facilitator-q2-adult__fac-role-definition": a5Val(
        "College counselors are responsible for: managing a full caseload of junior and senior advisees through the full application cycle; facilitating group programming for all grade levels; maintaining relationships with college admission officers at target schools; and monitoring FAFSA completion rates. Advisory teachers run group sessions and refer students to counselors for individual support. Near-peer mentors (college student volunteers) facilitate monthly panels and individual mentoring relationships.",
        true,
      ),
    },

    partnerships: {
      "partnerships-q1__partnerships-community": a1Val([
        a1Tag("university-partnerships", {
          isKey: true,
          notes: "Formal partnerships with 8–10 colleges and universities provide campus visit hosting, admissions fee waivers, early application programs, and on-campus preview days for enrolled students.",
        }),
        a1Tag("community-organization-partnerships", {
          isKey: true,
          notes: "Partnership with College Advising Corps and a local college access nonprofit supplements in-school counseling capacity, particularly for first-generation and low-income students.",
        }),
        a1Tag("business-partnerships", {
          notes: "Local employers provide job shadow and informational interview opportunities connecting college exposure to career pathway exploration.",
        }),
      ]),
      "partnerships-q1__partnerships-family": a1Val([
        a1Tag("family-workshops-presentations", {
          isKey: true,
          notes: "Annual FAFSA completion night, college application workshop for families, and financial aid information sessions — offered in English and Spanish — ensure families can actively support and understand the process.",
        }),
        a1Tag("regular-progress-communication", {
          notes: "Bi-monthly college counselor updates inform families of upcoming deadlines, student progress, and financial aid opportunities.",
        }),
      ]),
    },

    improvement: {
      "improvement-ci-q1__ci-people-teams": a1Val([
        a1Tag("teacher-led-improvement-team", {
          isKey: true,
          notes: "An annual College Exposure program review team (counselors, advisory teachers, alumni) evaluates application outcomes, acceptance rates, financial aid award data, and enrollment yields to refine the following year's programming.",
        }),
      ]),
    },
  };

  return {
    designedExperienceData: {
      keyDesignElements: { aims },
      subcomponents: [collegeVisitsSub, essayWritingSub],
      adultSubcomponents: [],
      learnersProfile: Object.keys(existingLearners).length > 0
        ? existingLearners
        : learnersProfile("grade_high_school", ["grade_11", "grade_12"], "Grades 11–12 with lighter-touch programming in grades 9–10. Priority focus on first-generation college students and those without a college-going family tradition."),
      adultsProfile: Object.keys(existingAdults).length > 0
        ? existingAdults
        : adultsProfile([
            { primaryId: "educators", secondaryIds: [], description: "Advisory teachers co-facilitating group college exposure sessions." },
            { primaryId: "student_support_wellbeing_staff", secondaryIds: ["school_counselors"], description: "Dedicated college counselors managing individual caseloads through the full application cycle." },
          ]),
      elementsExpertData: newExpert,
    },
    snapshotData: snapshotData({
      primaryOutcome1: "Social network",
      primaryOutcome2: "Identity & purpose",
      classroomsStudents: "Advisory blocks, ~120 students (Grades 11–12)",
      durationFrequency: "Advisory block + special events; intensive in Oct–Jan for seniors",
      whyItMatters: "For many of our students, college feels like a world that exists for other people. College Exposure dismantles that myth — one campus visit, one essay draft, and one mentor relationship at a time. We give students both the practical tools and the genuine belief that post-secondary success is within their reach.",
      craftStage: "Implementing",
      craftMonth: 5,
      craftTotal: 6,
    }),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  // ── Algebra ──────────────────────────────────────────────────────────────
  {
    const data = algebraData();
    await storage.updateComponent("algebra", {
      designedExperienceData: data.designedExperienceData,
      snapshotData: data.snapshotData,
    } as any);
    console.log("✅ Algebra seeded");
  }

  // ── Teach to One Math ─────────────────────────────────────────────────────
  {
    const data = teachToOneData();
    await storage.updateComponent("teach_to_one_math", {
      designedExperienceData: data.designedExperienceData,
      snapshotData: data.snapshotData,
    } as any);
    console.log("✅ Teach to One Math seeded");
  }

  // ── Extra Curriculars ─────────────────────────────────────────────────────
  {
    const data = extraCurricularsData();
    await storage.updateComponent("extra_curriculars", {
      designedExperienceData: data.designedExperienceData,
      snapshotData: data.snapshotData,
    } as any);
    console.log("✅ Extra Curriculars seeded");
  }

  // ── College Exposure ──────────────────────────────────────────────────────
  {
    const comp = await storage.getComponentByNodeId("college_exposure");
    if (!comp) { console.error("college_exposure not found"); process.exit(1); }
    const data = collegeExposureData(comp);
    await storage.updateComponent("college_exposure", {
      designedExperienceData: data.designedExperienceData,
      snapshotData: data.snapshotData,
    } as any);
    console.log("✅ College Exposure seeded (merged on existing)");
  }

  console.log("\n🎉 Batch 3 seeding complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
