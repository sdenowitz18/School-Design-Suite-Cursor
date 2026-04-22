/**
 * Seed Overall School (center), Science, English Language Arts, Student Advisory Seminar
 *
 * Run with:
 *   node --env-file=.env --import tsx/esm scripts/seed-batch-2.ts
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

// ── Bucket value helpers ───────────────────────────────────────────────────────

function a1Tag(tagId: string, opts: { isKey?: boolean; notes?: string; secondaries?: string[] } = {}): Record<string, unknown> {
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

// ── Shared learner profile helper ─────────────────────────────────────────────

function gradeHSProfile(desc: string, extraSelections: Record<string, unknown>[] = []): Record<string, unknown> {
  return {
    selections: [
      {
        primaryId: "grade_high_school",
        secondaryIds: ["grade_9", "grade_10", "grade_11", "grade_12"],
        secondaryKeys: { grade_9: true, grade_10: true, grade_11: true, grade_12: true },
        isKey: false,
        description: desc,
      },
      ...extraSelections,
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. OVERALL SCHOOL (CENTER COMPONENT)
// ═════════════════════════════════════════════════════════════════════════════

async function seedOverall() {
  console.log("\n🏫 Seeding Overall School (center)...");

  const existing = await storage.getComponentByNodeId("overall");
  if (!existing) { console.error("❌ overall not found"); return; }

  const existingDe = (existing.designedExperienceData as any) ?? {};
  const existingExpert = existingDe.elementsExpertData ?? {};

  // Merge new expert buckets on top of existing — don't wipe what's already there
  const newExpert: Record<string, Record<string, unknown>> = {
    schedule: {
      // centerOnly — school-wide day layout
      "schedule-q2__school-day-week-year-layout": a1Val([
        a1Tag("traditional-school-day", {
          isKey: true,
          notes: "7-period day, Monday–Friday with a dedicated advisory block built into the schedule each morning.",
        }),
        a1Tag("early-delayed-start", {
          notes: "Wednesday delayed start (9:30 AM) reserved for all-staff professional learning.",
          secondaries: ["delayed-start"],
        }),
      ]),
      "schedule-q3__master-scheduling-systems": a5Val(
        "The master schedule is built by the principal and scheduling coordinator using Infinite Campus, with input from department heads. The schedule is designed to protect advisory time, minimize conflicts for AP and dual-enrollment students, and enable cross-departmental collaboration periods.",
        true,
      ),
      "schedule-q4__scheduling-tools-resources": a5Val(
        "Infinite Campus SIS for master scheduling. Supplemental scheduling template shared across department heads to surface conflicts before the school year begins.",
      ),
      // Preserve any existing schedule buckets
      ...(existingExpert.schedule ?? {}),
    },
    learning: {
      // Fill in adult-facing and improvement buckets not already present
      "learning-q3-adult__adult-processes-tuning": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", {
          isKey: true,
          notes: "All teachers participate in weekly department PLCs and a monthly cross-disciplinary Instructional Leadership Team (ILT) meeting focused on school-wide learning priorities.",
          secondaries: ["adult-processes-tuning-collaborative-teams-plcs", "adult-processes-tuning-collaborative-teams-ilt", "adult-processes-tuning-collaborative-teams-departmental"],
        }),
        a1Tag("adult-processes-tuning-instructional-rounds-walkthroughs", {
          isKey: true,
          notes: "Monthly learning walks across departments — led by department heads — surface instructional trends and inform coaching focus areas.",
          secondaries: ["adult-processes-tuning-instructional-rounds-observation-feedback", "adult-processes-tuning-instructional-rounds-learning-walks"],
        }),
        a1Tag("adult-processes-tuning-data-inquiry-cycles", {
          isKey: true,
          notes: "Bi-annual data days examine student outcome trends across all ring components — leaps progress, academic outcomes, and wellbeing indicators.",
          secondaries: ["adult-processes-tuning-data-inquiry-cycles-pdsa", "adult-processes-tuning-data-reviews-student-work-analysis"],
        }),
        a1Tag("adult-processes-tuning-lesson-planning-observation-reflection", {
          notes: "Departments engage in collaborative lesson planning cycles, with peer observation and video-based reflection each semester.",
          secondaries: ["adult-processes-tuning-lesson-planning-collaborative-lesson"],
        }),
      ]),
      "learning-q3-adult__adult-professional-learning": a1Val([
        a1Tag("adult-professional-learning-workshops-institutes", {
          isKey: true,
          notes: "3-day back-to-school institute + 2-day mid-year institute focused on school-wide learning priorities. Topics rotate annually based on data review findings.",
        }),
        a1Tag("adult-professional-learning-teacher-mentoring", {
          isKey: true,
          notes: "All new teachers are paired with a veteran teacher mentor for 2 years. Monthly structured check-ins and shared observation cycles are built into the mentoring model.",
        }),
        a1Tag("adult-professional-learning-leadership-development", {
          notes: "Aspiring leaders can apply to a school-based leadership development fellowship, supporting future department head and AP pipeline.",
          secondaries: ["adult-professional-learning-leadership-development-aspiring-pipelines"],
        }),
      ]),
      // Preserve existing learning buckets
      ...(existingExpert.learning ?? {}),
    },
    culture: {
      "culture-q1__culture-adult-community": a1Val([
        a1Tag("staff-wellness", {
          isKey: true,
          notes: "Monthly staff wellness activities, an anonymous wellbeing pulse survey, and a dedicated wellness coordinator support educator retention and mental health.",
        }),
        a1Tag("plcs-wellbeing", {
          isKey: false,
          notes: "PLCs dedicate 15 minutes each session to team connection and adult relationship-building before diving into instructional work.",
        }),
        a1Tag("adult-staff-circles", {
          notes: "Restorative circles used with staff as well as students — modeling for faculty the practices students experience.",
        }),
      ]),
      "culture-q2__culture-facilitator-practices": a5Val(
        "School culture is anchored in restorative practices and a whole-child philosophy that applies equally to students and adults. Leaders model vulnerability, celebrate learning from mistakes, and maintain a 'no hierarchy in our learning' stance — teachers are learners too.",
        true,
      ),
      "culture-q4-tools__touchstones-core-values": a5Val(
        "Whole child · High expectations for all · Belonging and community · Learning as a lifelong practice · Equity and cultural responsiveness",
        true,
      ),
      "culture-q4-tools__touchstones-core-commitments": a5Val(
        "We commit to knowing every student as a whole person. We commit to holding high expectations alongside deep support. We commit to examining our assumptions and growing our practice together as educators.",
        true,
      ),
      "culture-q4-tools__touchstones-cherished-norms": a5Val(
        "Students are greeted by name at the door every day. Advisory is sacred time — no pull-outs, no announcements. Teachers eat lunch with students at least once per week.",
      ),
      // Preserve existing culture buckets
      ...(existingExpert.culture ?? {}),
    },
    facilitator: {
      "facilitator-q1__fac-other-roles": a1Val([
        a1Tag("school-leaders-administrators", {
          isKey: true,
          notes: "Principal provides instructional leadership and is visible in classrooms weekly. Two APs manage student support and operations respectively.",
        }),
        a1Tag("student-support-wellbeing", {
          isKey: true,
          notes: "Two school counselors (Ms. Amanda Williams and Mr. David Chen) provide academic advising, social-emotional support, and college/career guidance for all students.",
        }),
        a1Tag("instructional-coaches", {
          isKey: true,
          notes: "Mr. Robert Taylor serves as the school's instructional coach, supporting all departments with embedded coaching cycles, observation/feedback, and curriculum alignment.",
        }),
      ]),
      "facilitator-q2-adult__fac-role-definition": a5Val(
        "Instructional leadership is distributed across the principal, two APs, department heads, and the instructional coach. The principal sets vision and culture; APs manage operations and student support; department heads lead content-area professional learning; the instructional coach supports all teachers across all departments.",
        true,
      ),
      "facilitator-q3-adult-tools__fac-competency-framework": a1Val([
        a1Tag("danielson", {
          isKey: true,
          notes: "Danielson Framework for Teaching used for all formal teacher evaluations. Observations conducted twice annually for all teachers, with additional informal walkthroughs each semester.",
        }),
      ]),
      "facilitator-q3-adult-tools__fac-skills-knowledge-mindsets": a5Val(
        "School-wide priority competencies for all teachers: (1) culturally responsive pedagogy, (2) restorative practices proficiency, (3) data-informed instructional decision-making, (4) strong relationships with students as whole people. New teachers receive explicit training in all four during induction.",
        true,
      ),
      // Preserve existing facilitator buckets
      ...(existingExpert.facilitator ?? {}),
    },
    partnerships: {
      "partnerships-q1__partnerships-community": a1Val([
        a1Tag("college-continuing-ed-partnerships", {
          isKey: true,
          notes: "Dual enrollment partnerships with two regional universities provide college credit opportunities across AP and advanced courses. Students earn credits while still in high school.",
        }),
        a1Tag("service-provider-partnerships", {
          isKey: true,
          notes: "Mental health and wraparound services provided via partnership with a local community health organization — embedded counseling staff on-site 3 days per week.",
        }),
        a1Tag("employer-career-partnerships", {
          notes: "School-wide Career Day in spring brings 30+ employers across industries. Seniors use this as a culminating professional networking experience.",
        }),
      ]),
      "partnerships-q1__partnerships-family": a1Val([
        a1Tag("family-communication-channels", {
          isKey: true,
          notes: "Multilingual family communications via email, text (Remind/ParentSquare), and phone. School website maintained in English and Spanish. Interpreters available for all family meetings.",
        }),
        a1Tag("family-school-governance", {
          isKey: true,
          notes: "Active parent advisory council meets monthly with the principal. Council includes representation from each grade level and both English and Spanish-speaking families.",
        }),
        a1Tag("family-conferencing", {
          notes: "Two formal family conference seasons per year (fall and spring). Student-led conferences used in 9th and 10th grade; traditional teacher-led conferences for 11th–12th.",
        }),
      ]),
      "partnerships-q2-adult__partnerships-systems-routines": a1Val([
        a1Tag("community-school-governance", {
          isKey: true,
          notes: "Annual community partnership review conducted by the principal and counseling team — assessing impact of each formal partnership on student outcomes.",
        }),
        a1Tag("forging-maintaining-partnerships", {
          notes: "The family engagement coordinator (Ms. Patricia Ortega) manages ongoing relationships with community partners and coordinates volunteer recruitment.",
        }),
      ]),
      "partnerships-q3-adult-tools__partnerships-family-community-tools": a1Val([
        a1Tag("family-handbook", {
          isKey: true,
          notes: "Comprehensive school handbook published annually in English and Spanish. Includes student rights, academic expectations, and family engagement calendar.",
        }),
      ]),
      // Preserve existing partnerships data
      ...(existingExpert.partnerships ?? {}),
    },
    ops: {
      "ops-q1__ops-physical-space": a1Val([
        a1Tag("classroom-layout-furniture", {
          isKey: true,
          notes: "All classrooms feature flexible seating (moveable desks or tables with chairs) enabling rapid transition between whole-group, small-group, and independent configurations.",
        }),
        a1Tag("classroom-ambience-visuals", {
          isKey: true,
          notes: "Classrooms display student work, anchor charts for learning norms, and culturally affirming visuals. 'Learning environment walks' each semester support teachers in maintaining high-quality classroom environments.",
        }),
        a1Tag("building-layout-furniture", {
          notes: "Flexible community spaces in hallways and common areas allow for small-group work, quiet study, and informal student-teacher connection outside the classroom.",
        }),
      ]),
      "ops-q3__ops-cost": a5Val(
        "The school operates within a per-pupil district allocation supplemented by Title I funding. Dual-enrollment and AP course fees are covered through district and state support for eligible students — no student is denied access due to cost.",
      ),
      "ops-q3__ops-funding": a5Val(
        "Funding sources: per-pupil district allocation, Title I funds, state career and technical education grants, and a small school foundation endowment that supports enrichment and professional development activities.",
        true,
      ),
      "ops-q4-adult__ops-systems-routines": a1Val([
        a1Tag("ops-enrollment-systems", {
          isKey: true,
          notes: "Open enrollment with active outreach to ensure diverse enrollment — recruitment targeting underrepresented zip codes and multilingual families.",
        }),
      ]),
      // Preserve existing ops buckets
      ...(existingExpert.ops ?? {}),
    },
    improvement: {
      "ci-q1__ci-people-teams": a1Val([
        a1Tag("ci-school-design-lead", {
          isKey: true,
          notes: "Principal Maria Rodriguez serves as the primary school design lead, with the instructional coach (Mr. Robert Taylor) as co-lead for instructional improvement cycles.",
        }),
        a1Tag("ci-planning-teams", {
          isKey: true,
          notes: "Annual school design retreat (3 days, August) brings together department heads, counselors, and teacher leaders to review the previous year's outcome data and refine the Blueprint for the coming year.",
        }),
        a1Tag("ci-design-partner", {
          notes: "External design partner (district-based design team) provides annual consultation on Blueprint coherence and supports mid-year design reviews.",
        }),
      ]),
      "ci-q1__ci-community-contributors": a1Val([
        a1Tag("ci-input-givers", {
          isKey: true,
          notes: "Student advisory council provides termly feedback on school culture, learning experiences, and wellbeing — directly informing design decisions.",
        }),
        a1Tag("ci-testers", {
          notes: "Pilot cohorts of teachers test new instructional approaches (e.g., restorative circles, advisory protocols) before school-wide rollout.",
        }),
      ]),
      "ci-q1__ci-tuning-practices": a1Val([
        a1Tag("adult-processes-tuning-data-inquiry-cycles", {
          isKey: true,
          notes: "Termly data reviews at the department and school level using a consistent data protocol: student outcome trends, wellbeing indicators, and instructional practice observations.",
          secondaries: ["adult-processes-tuning-data-inquiry-cycles-pdsa"],
        }),
        a1Tag("ci-additional-perspective-collection", {
          isKey: false,
          notes: "Annual student and family surveys (Panorama) provide quantitative wellbeing and engagement data to complement outcome data in design decisions.",
        }),
      ]),
      "ci-q1__ci-bigger-change-practices": a1Val([
        a1Tag("ci-periodic-stepbacks", {
          isKey: true,
          notes: "Mid-year 'step-back' (January) and end-of-year retreat are the two formal moments for evaluating whether the Blueprint design is achieving its intended outcomes at the school level.",
        }),
        a1Tag("ci-vision-teaching-learning", {
          isKey: false,
          notes: "Every 3 years, the school engages in a full Blueprint revision process — reviewing all ring components, leaps, outcomes, and design principles with the full school community.",
        }),
      ]),
      "ci-q2-tools__ci-design-tools": a1Val([
        a1Tag("ci-design-blueprints", {
          isKey: true,
          notes: "The School Design Blueprint is the school's primary design and improvement document — reviewed at every leadership meeting and updated annually.",
        }),
        a1Tag("ci-design-journey-improvement-plans", {
          notes: "Component-level improvement plans created annually for each ring component, tracking progress toward leaps and outcome goals.",
        }),
      ]),
      // Preserve existing improvement data
      ...(existingExpert.improvement ?? {}),
    },
    // Preserve the __shared__ key
    __shared__: existingExpert.__shared__ ?? {},
  };

  const overallLeaps = [
    leap("Whole-child focus", "H", "Every school system and structure is designed with the whole student in mind — academic, social, emotional, and physical wellbeing. Advisory, counseling, and restorative practices are not add-ons but core design features embedded across the school week."),
    leap("Connection & community", "H", "Students and adults experience this school as a genuine community — a place where they are known by name, their identities are honored, and belonging is actively designed. Advisory, community circles, and family partnerships are the primary vehicles."),
    leap("High expectations with rigorous learning", "H", "The school holds all students to high academic standards regardless of background, while providing the scaffolding, differentiation, and support structures needed for every student to meet them. Rigor and care are not in tension here."),
    leap("Relevance", "M", "Learning across all ring components is connected to students' lives, cultural contexts, and future aspirations. Every component team is asked: 'Why would a student care about this?' The answer shapes instruction, partnerships, and culminating experiences."),
    leap("Agency", "M", "Students exercise meaningful choice in how they learn and demonstrate learning across the school. Student advisory council, student-led conferences, and choice-based capstone projects are school-wide expressions of student agency."),
  ];

  const overallOutcomes = [
    outcome("English language arts", "H", "School-wide literacy is a cross-disciplinary commitment — all content-area teachers explicitly support reading and writing development within their disciplines.", {
      subSelections: ["Reading", "Writing"],
      subPriorities: { Reading: "H", Writing: "H" },
      subPrimaries: { Reading: true },
    }),
    outcome("Higher order thinking skills", "H", "Every ring component is designed to develop higher-order thinking — not just content knowledge. School-wide rubrics for critical thinking and problem-solving are used across departments.", {
      subSelections: ["Critical thinking", "Systems thinking"],
      subPriorities: { "Critical thinking": "H", "Systems thinking": "M" },
      subPrimaries: { "Critical thinking": true },
    }),
    outcome("Productive mindsets & purpose", "H", "The school explicitly develops student identity, purpose, and self-regulation — not as a 'soft skills' add-on but as an integrated design goal across advisory, academic, and enrichment experiences.", {
      subSelections: ["Identity & purpose", "Mindsets & self-regulation"],
      subPriorities: { "Identity & purpose": "H", "Mindsets & self-regulation": "H" },
    }),
    outcome("Relationship skills", "M", "Communication, collaboration, and leadership are explicitly developed across advisory and academic experiences — and assessed through performance tasks and advisory portfolios.", {
      subSelections: ["Communication", "Collaboration"],
      subPriorities: { Communication: "M", Collaboration: "M" },
    }),
    outcome("Assets for continuing education, career, and life", "M", "Every student graduates with a robust portfolio of credentials, relationships, and experiences that position them for success in post-secondary education and career pathways.", {
      subSelections: ["Transcript", "Educator relationships & recommendations", "Early college coursework"],
      subPriorities: { Transcript: "M", "Educator relationships & recommendations": "M", "Early college coursework": "M" },
    }),
    outcome("Mental & physical health", "M", "Student wellbeing is a design priority — counseling, restorative practices, and advisory are the primary vehicles for monitoring and supporting student mental and physical health.", {
      subSelections: ["Emotional well-being & mood", "Stress & resilience"],
      subPriorities: { "Emotional well-being & mood": "M", "Stress & resilience": "M" },
    }),
  ];

  const overallDE = {
    ...existingDe,
    description: "Overall School is a public high school serving grades 9–12 with a mission to develop the whole child — academically, socially, emotionally — through a coherent system of designed learning experiences. The school is organized around eight distinct ring components (program offerings) that together form a comprehensive, personalized high school experience. Design is guided by a living School Blueprint reviewed and updated annually.",
    keyDesignElements: {
      aims: [...overallLeaps, ...overallOutcomes],
      practices: existingDe.keyDesignElements?.practices ?? [],
      supports: existingDe.keyDesignElements?.supports ?? [],
    },
    elementsExpertData: newExpert,
    learnersProfile: {
      selections: [
        {
          primaryId: "grade_high_school",
          secondaryIds: ["grade_9", "grade_10", "grade_11", "grade_12"],
          secondaryKeys: { grade_9: true, grade_10: true, grade_11: true, grade_12: true },
          isKey: false,
          description: "The school serves approximately 600 students across grades 9–12.",
        },
        { primaryId: "socioeconomic", secondaryIds: [], isKey: true, description: "Approximately 65% of students qualify for free/reduced-price lunch. Design explicitly accounts for socioeconomic context in scheduling, materials access, and enrichment equity." },
        { primaryId: "race_ethnicity", secondaryIds: [], isKey: true, description: "Majority Latino/Hispanic (52%) and Black/African American (28%) student body. Culturally responsive design is a school-wide priority, not a program-specific one." },
        { primaryId: "home_language", secondaryIds: [], isKey: true, description: "Approximately 30% of students speak a language other than English at home, primarily Spanish. Multilingual family communications and ELL support services are core infrastructure." },
        { primaryId: "disability_neurodivergence", secondaryIds: [], isKey: false, description: "14% of students have IEPs or 504 plans. Inclusion model supported by push-in specialists and co-teaching in core courses." },
        { primaryId: "mandatory_all", secondaryIds: [], isKey: false, description: "All students attend all ring component programs as part of the school's comprehensive program model. Selection gating applies only to advanced/AP levels within components." },
      ],
    },
    adultsProfile: {
      selections: [
        { primaryId: "school_leaders_administrators", secondaryIds: ["principal_head_of_school", "ap_dean_school", "school_based_design_lead"] },
        { primaryId: "student_support_wellbeing_staff", secondaryIds: ["school_counselors"] },
        { primaryId: "district_leaders_staff", secondaryIds: ["instructional_coaches"] },
        { primaryId: "school_operations_support_staff", secondaryIds: ["family_engagement_coordinators"] },
      ],
      sliceDetail: {
        school_leaders_administrators: {
          name: { text: "Principal Maria Rodriguez · AP (Student Support) Sarah Kim · AP (Operations) James Okafor", isKey: false },
          incomingSkills: {
            text: "Principal Rodriguez brings 12 years of school leadership experience, a background in instructional coaching, and deep expertise in restorative practices. She led a previous turnaround that improved student wellbeing and attendance metrics by 40% over 3 years. APs each have 8+ years of school leadership experience.",
            isKey: true,
          },
          staffing: {
            text: "School leadership team of 3: principal (instructional leadership, culture, Blueprint stewardship), AP Kim (student support, counseling coordination, advisory), AP Okafor (operations, scheduling, partnerships). Weekly leadership team meetings focus on data and Blueprint coherence.",
            isKey: false,
          },
          plainLanguage: "A 3-person leadership team anchors school direction, culture, and operations with clearly divided and collaborative portfolios.",
        },
        student_support_wellbeing_staff: {
          name: { text: "Ms. Amanda Williams (Lead Counselor, 11th–12th grade) · Mr. David Chen (Counselor, 9th–10th grade)", isKey: false },
          incomingSkills: {
            text: "Ms. Williams is a licensed clinical social worker with specialization in adolescent mental health and college counseling. She leads the school's restorative practices implementation and coordinates the community mental health partnership. Mr. Chen is a licensed professional counselor with expertise in early high school transition support and academic advising for first-generation students.",
            isKey: true,
          },
          staffing: {
            text: "Each counselor carries a caseload of approximately 300 students, split by grade band (9th–10th, 11th–12th). Both co-facilitate weekly advisory council and contribute to school-wide design reviews.",
            isKey: false,
          },
        },
        district_leaders_staff: {
          name: { text: "Mr. Robert Taylor (Instructional Coach, Humanities & World Languages)", isKey: false },
          incomingSkills: {
            text: "Mr. Taylor has 10 years of classroom teaching experience in English and Social Studies, followed by 5 years as a school-based instructional coach. He is trained in Cognitive Coaching and the Danielson Framework, and leads the school's classroom observation and feedback cycles.",
            isKey: false,
          },
          staffing: {
            text: "Instructional coach embedded full-time at the school. Coaching load: 2 formal coaching cycles per teacher per year, plus open-door classroom visits and department PLC facilitation. Splits time across all departments with heavier allocation to departments with the greatest student outcome gaps.",
            isKey: false,
          },
        },
        school_operations_support_staff: {
          name: { text: "Ms. Patricia Ortega (Family Engagement & Community Partnership Coordinator)", isKey: false },
          incomingSkills: {
            text: "Bilingual (English/Spanish) with 6 years of community organizing experience in education contexts. Manages all school-family communications, coordinates the parent advisory council, and stewards community partnership relationships.",
            isKey: false,
          },
          staffing: { text: "Full-time role, reporting to AP Okafor, with dotted-line relationship to the principal for Blueprint-related partnership work.", isKey: false },
        },
      },
      q1PlainText: "The school's adult team includes a 3-person leadership team, 2 counselors, a full-time instructional coach, and a bilingual family engagement coordinator — designed to ensure every student is known, supported, and connected.",
    },
  };

  await storage.updateComponent("overall", { designedExperienceData: overallDE });
  console.log(`  ✅ Overall School seeded (${overallLeaps.length} leaps, ${overallOutcomes.length} outcome groups)`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. SCIENCE
// ═════════════════════════════════════════════════════════════════════════════

function buildScienceSub(name: "Chemistry" | "Biology" | "Physics"): Record<string, unknown> {
  const info: Record<string, { l3: string; outcomeNotes: string; instructionNotes: string; teacherName: string; teacherBio: string; culturalNote: string }> = {
    Chemistry: {
      l3: "Chemistry knowledge & skills",
      outcomeNotes: "Students develop deep understanding of matter, reactions, and molecular interactions — applying chemistry concepts to real-world phenomena including environmental chemistry and materials science.",
      instructionNotes: "Lab-based learning anchors Chemistry instruction. Students conduct experiments weekly, write lab reports with claims, evidence, and reasoning (CER), and connect chemical concepts to environmental and industrial applications.",
      teacherName: "Mr. James Okafor (Chemistry & AP Environmental Science)",
      teacherBio: "Mr. Okafor holds a degree in chemistry with 9 years of classroom experience. He integrates environmental justice themes into chemistry instruction and runs the school's Green Chemistry Club.",
      culturalNote: "Chemistry instruction explicitly connects to environmental justice — students study local pollution data and community health impacts of industrial chemistry.",
    },
    Biology: {
      l3: "Biology knowledge & skills",
      outcomeNotes: "Students investigate living systems from cells to ecosystems, developing both content knowledge and scientific reasoning skills applicable to health, environment, and life sciences fields.",
      instructionNotes: "Biology uses a phenomena-based instructional model — students encounter real biological phenomena first, then build explanations using data and models. Dissections, microscopy labs, and field observations round out the experience.",
      teacherName: "Ms. Priya Sharma (Biology & AP Biology)",
      teacherBio: "Ms. Sharma has a background in biomedical research before entering education, bringing genuine scientific inquiry experience to her classroom. She mentors students in the school science fair and connects learning to health careers.",
      culturalNote: "Biology units connect to student and community health — lessons on genetics, epidemiology, and the human body use student-relevant health data and community health context.",
    },
    Physics: {
      l3: "Physics knowledge & skills",
      outcomeNotes: "Students develop physics understanding through mathematical modeling, experimental design, and real-world engineering applications — from mechanics to energy systems.",
      instructionNotes: "Physics instruction uses the modeling instruction approach — students build and revise conceptual models through hands-on experiments, progressively moving from concrete to abstract understanding of physical laws.",
      teacherName: "Dr. Kevin Park (Physics & AP Physics)",
      teacherBio: "Dr. Park holds a PhD in applied physics and transitioned to teaching from an engineering career. He brings real-world engineering and research experience into every unit and runs the school's robotics and engineering design electives.",
      culturalNote: "Physics instruction connects to engineering and sustainability — students design and test solutions to real energy and structural engineering challenges.",
    },
  };

  const { l3, outcomeNotes, instructionNotes, teacherName, teacherBio, culturalNote } = info[name];

  const subLeaps = [
    leap("High expectations with rigorous learning", "H", `${name} holds every student to genuine scientific thinking standards — not just content recall. Students are expected to design experiments, analyze data, construct evidence-based arguments, and revise their models based on new evidence.`),
    leap("Relevance", "H", `${name} connects scientific concepts to real-world phenomena students encounter in their lives and communities. ${culturalNote}`),
    leap("Agency", "M", `Students in ${name} exercise meaningful agency in scientific inquiry — designing their own experimental procedures, choosing variables, and generating original research questions for their culminating project.`),
  ];

  const subOutcomes = [
    outcome("Natural sciences", "H", outcomeNotes, {
      subSelections: [l3, "Scientific reasoning"],
      subPriorities: { [l3]: "H", "Scientific reasoning": "H" },
      subPrimaries: { [l3]: true },
    }),
    outcome("Higher order thinking skills", "M", `${name} explicitly develops scientific reasoning, evidence-based argumentation, and systems thinking as transferable skills beyond the specific content domain.`, {
      subSelections: ["Critical thinking", "Systems thinking"],
      subPriorities: { "Critical thinking": "M", "Systems thinking": "M" },
    }),
  ];

  const subExpert = {
    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", { isKey: true, notes: `${name} mini-lessons introduce conceptual frameworks and scientific vocabulary before students engage in lab-based application.` }),
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
          isKey: true,
          notes: instructionNotes,
          secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-experiential-learning"],
        }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-discourse", { isKey: true, notes: `Scientific argumentation — students construct and critique claims, evidence, and reasoning (CER) in structured peer discourse.` }),
        a1Tag("learning-practice-summative-assessment", {
          isKey: true,
          notes: `${name} uses performance-based lab assessments and cumulative design projects as primary summative measures.`,
          secondaries: ["learning-practice-summative-assessment-performance-assessment", "learning-practice-summative-assessment-written-or-verbal-assessment"],
        }),
        a1Tag("learning-practice-formative-assessment", {
          notes: "Daily warm-up phenomena prompts and exit-ticket model diagrams serve as formative checks throughout the unit.",
          secondaries: ["learning-practice-formative-assessment-exit-tickets"],
        }),
      ]),
      "learning-q2__learning-grouping": a1Val([
        a1Tag("learning-grouping-small-group", { isKey: true, notes: "Lab groups of 3–4 students enable collaborative scientific inquiry and shared data collection." }),
        a1Tag("learning-grouping-whole-group", { notes: "Whole-group discussions used for phenomena introduction, data analysis share-outs, and class-level model building." }),
      ]),
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-hqim", { isKey: true, notes: `NGSS-aligned curriculum (${name === "Biology" ? "HHMI BioInteractive" : name === "Chemistry" ? "Modeling Chemistry" : "Modeling Physics"}) provides the core unit sequence.` }),
        a1Tag("tools-curriculum-type-oer", { notes: "Supplemental phenomena and real-world data sets from NOAA, NASA, and peer-reviewed science publications." }),
      ]),
      "learning-q4-tools__tools-assessment-types": a1Val([
        a1Tag("tools-assessment-types-formative-assessment", { isKey: true, notes: "Daily phenomena prompts and model diagrams provide real-time insight into conceptual understanding." }),
        a1Tag("tools-assessment-types-summative-assessment", { isKey: true, notes: "Performance tasks and lab practicals replace traditional tests as the primary summative measure.", secondaries: ["tools-assessment-types-summative-assessment-performance-assessment"] }),
      ]),
    },
    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", { isKey: true, notes: teacherName }),
        a1Tag("expanded-adult-supports", { notes: "Lab safety technician supports all science labs — assists with setup, safety protocols, and materials management.", secondaries: ["push-in-specialists"] }),
      ]),
      "facilitator-q2-adult__fac-role-definition": a5Val(teacherBio, true),
    },
    ops: {
      "ops-q1__ops-physical-space": a1Val([
        a1Tag("classroom-layout-furniture", { isKey: true, notes: `Dedicated ${name} lab space with lab tables, safety equipment, fume hood (Chemistry/Biology), and materials storage. Lab configuration enables both whole-class demonstrations and small-group experimental work.` }),
        a1Tag("classroom-ambience-visuals", { notes: "Lab safety posters, current scientific news displays, and student-designed model diagrams displayed throughout the lab environment." }),
      ]),
    },
  };

  return {
    id: genId(), name, description: `The ${name} subcomponent provides a rigorous, inquiry-based learning experience within the Science program. ${instructionNotes}`,
    keyDesignElements: { aims: [...subLeaps, ...subOutcomes], practices: [], supports: [] },
    elementsExpertData: subExpert,
    learnersProfile: gradeHSProfile(`${name} is offered at standard and AP/advanced levels, serving students in grades 9–12 depending on course sequencing.`, [
      { primaryId: "prior_knowledge", secondaryIds: [], isKey: true, description: `Students enter ${name} with varying levels of prior science experience. Instruction is designed to be accessible to students without prior exposure while challenging those with strong backgrounds.` },
    ]),
    adultsProfile: {
      selections: [{ primaryId: "educators", secondaryIds: ["educators_core_courses"] }],
      sliceDetail: {
        educators: {
          name: { text: teacherName, isKey: false },
          incomingSkills: { text: teacherBio, isKey: true },
        },
      },
      q1PlainText: `${name} is led by ${teacherName}.`,
    },
    aims: [], practices: [], supports: [],
  };
}

async function seedScience() {
  console.log("\n🔬 Seeding Science...");

  const scienceLeaps = [
    leap("High expectations with rigorous learning", "H", "Science at this school holds every student to genuine scientific thinking — not just content recall. All students design experiments, analyze data, construct evidence-based arguments, and revise their models. AP-level rigor is the aspiration for all learners across Chemistry, Biology, and Physics."),
    leap("Relevance", "H", "Science is taught through real-world phenomena that students can observe, question, and investigate. Every unit launches with a phenomenon drawn from students' communities and environments — from local water quality to environmental health to physics of everyday objects."),
    leap("Whole-child focus", "M", "Science instruction attends to students' identities as scientists — actively dismantling the myth that science is 'not for them.' Scientists from students' own cultural communities are highlighted; student identity as a scientist is explicitly developed."),
    leap("Agency", "M", "Science students exercise genuine agency in inquiry — they pose questions, design procedures, collect data, and revise their explanations. Culminating projects allow students to investigate a phenomenon of personal or community relevance."),
  ];

  const scienceOutcomes = [
    outcome("Natural sciences", "H", "The Science program develops genuine scientific understanding across Chemistry, Biology, and Physics — with NGSS-aligned performance expectations as the standard.", {
      subSelections: ["Physics knowledge & skills", "Chemistry knowledge & skills", "Scientific reasoning"],
      subPriorities: { "Physics knowledge & skills": "H", "Chemistry knowledge & skills": "H", "Scientific reasoning": "H" },
      subPrimaries: { "Scientific reasoning": true },
    }),
    outcome("Computational & AI literacies", "M", "Data analysis, modeling, and computational thinking are integrated throughout all three science courses — preparing students for STEM pathways.", {
      subSelections: ["Computer science"],
      subPriorities: { "Computer science": "M" },
    }),
    outcome("Higher order thinking skills", "H", "Critical thinking, evidence evaluation, and systems thinking are explicitly developed and assessed across the Science program.", {
      subSelections: ["Critical thinking", "Systems thinking", "Creativity"],
      subPriorities: { "Critical thinking": "H", "Systems thinking": "H", Creativity: "M" },
      subPrimaries: { "Critical thinking": true },
    }),
  ];

  const subcomponents = [buildScienceSub("Chemistry"), buildScienceSub("Biology"), buildScienceSub("Physics")];

  const scienceExpert = {
    schedule: {
      "schedule-q1__formats-of-time-blocks": a1Val([
        a1Tag("core-course", { isKey: true, notes: "All three science courses (Chemistry, Biology, Physics) run as core daily courses within the school schedule." }),
        a1Tag("elective-special", { notes: "Advanced science electives (AP Environmental Science, Engineering Design) offered as optional enrichment pathways." }),
      ]),
      "schedule-q1__number-of-classrooms-and-students": a3PairVal(8, 200, true),
      "schedule-q1__duration": a3Val(55, "min", "55-minute class periods — extended to 90 minutes on lab days (every other week)", true),
      "schedule-q1__frequency": a3Val(5, "days", "5 days per week, with alternating lab-day schedule every other week", true),
    },
    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", { isKey: true, notes: "Conceptual mini-lessons (15–20 min) anchor each class before inquiry-based investigation." }),
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
          isKey: true,
          notes: "Phenomena-based learning: students observe a real-world phenomenon, generate questions, design investigations, and build explanations.",
          secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-problem-based-instruction", "learning-exposure-inquiry-based-instruction-indirect-instruction-experiential-learning"],
        }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-discourse", { isKey: true, notes: "CER (Claim-Evidence-Reasoning) scientific argumentation structures all written and verbal discourse in Science." }),
        a1Tag("learning-practice-authentic-classroom-based-application", { isKey: true, notes: "Real lab experiments, field measurements, and design challenges replace artificial textbook problems as the primary learning activity." }),
        a1Tag("learning-practice-goal-setting", { notes: "Students set learning targets at the start of each unit and self-assess against NGSS performance expectations at the close." }),
      ]),
      "learning-q2__learning-grouping": a1Val([
        a1Tag("learning-grouping-small-group", { isKey: true, notes: "Lab groups of 3–4 students. Groups are strategically mixed by prior science experience and rotated each unit." }),
        a1Tag("learning-grouping-whole-group", { notes: "Whole-group model-building sessions used to synthesize class-wide data and build shared scientific explanations." }),
      ]),
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-hqim", { isKey: true, notes: "NGSS-aligned HQIM used for all three courses (Modeling Chemistry, HHMI BioInteractive, Modeling Physics)." }),
        a1Tag("tools-curriculum-type-oer", { notes: "Real-world data from NOAA, NASA, USGS, and CDC integrated as supplemental phenomena sources." }),
      ]),
      "learning-q4-tools__tools-assessment-types": a1Val([
        a1Tag("tools-assessment-types-formative-assessment", { isKey: true, notes: "Daily phenomena prompts and model diagrams. Weekly lab notebook checks.", secondaries: ["tools-assessment-types-formative-assessment-exit-tickets"] }),
        a1Tag("tools-assessment-types-summative-assessment", { isKey: true, notes: "Performance-based lab practicals and design challenge exhibitions as primary summative measures.", secondaries: ["tools-assessment-types-summative-assessment-performance-assessment", "tools-assessment-types-summative-assessment-portfolio-assessment"] }),
      ]),
    },
    culture: {
      "culture-q2__culture-facilitator-practices": a5Val("Science teachers explicitly build 'scientist identity' in all students. Every unit opens with a profile of a scientist from a background underrepresented in STEM. Student science fair showcases are celebrated school-wide as a cultural event, not just an academic one.", true),
    },
    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", { isKey: true, notes: "Each science course has a dedicated certified teacher. Lab technician supports all three courses for safety and materials management." }),
      ]),
      "facilitator-q1__fac-ratio": { archetypeA3Ratio: { learners: 24, facilitators: 1, isKey: false } },
    },
    ops: {
      "ops-q1__ops-physical-space": a1Val([
        a1Tag("classroom-layout-furniture", { isKey: true, notes: "Dedicated science labs for each course with safety equipment, lab tables, and specialized materials storage. Lab safety protocols reviewed at the start of each unit." }),
        a1Tag("classroom-ambience-visuals", { notes: "Lab environments display current science news, NGSS performance expectations, and student-created model posters." }),
      ]),
    },
    improvement: {
      "ci-q1__ci-tuning-practices": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", { isKey: true, notes: "Science department meets weekly to review student performance data on NGSS performance expectations and align lab schedules.", secondaries: ["adult-processes-tuning-collaborative-teams-departmental"] }),
      ]),
    },
  };

  const de = {
    description: "Science at this school provides an NGSS-aligned inquiry-based learning experience across Chemistry, Biology, and Physics. All three courses use phenomena-based learning as the primary instructional model — students encounter real-world phenomena first and build scientific explanations through investigation, modeling, and argumentation.",
    experienceAudience: "learner",
    keyDesignElements: { aims: [...scienceLeaps, ...scienceOutcomes], practices: [], supports: [] },
    elementsExpertData: scienceExpert,
    subcomponents,
    adultSubcomponents: [],
    learnersProfile: gradeHSProfile("Science serves all students grades 9–12 through a 3-year required sequence (Biology 9th, Chemistry 10th, Physics 11th) plus optional AP pathways in 12th grade.", [
      { primaryId: "prior_knowledge", secondaryIds: [], isKey: true, description: "Students enter the science sequence with varying levels of middle school science preparation. Courses are designed to be accessible without assuming prior depth, while providing extension for students with strong backgrounds." },
      { primaryId: "interests_motivations", secondaryIds: [], isKey: false, description: "A growing cohort of students is interested in STEM careers — especially health sciences and environmental science. The program actively cultivates this interest while serving all students." },
    ]),
    adultsProfile: {
      selections: [{ primaryId: "educators", secondaryIds: ["educators_core_courses"] }, { primaryId: "student_support_wellbeing_staff", secondaryIds: [] }],
      sliceDetail: {
        educators: {
          name: { text: "Mr. James Okafor (Chemistry) · Ms. Priya Sharma (Biology) · Dr. Kevin Park (Physics)", isKey: false },
          incomingSkills: { text: "All three Science teachers hold content-area degrees and teaching certifications. Collectively they bring backgrounds in research chemistry, biomedical science, and applied physics — giving students access to authentic scientists as their teachers.", isKey: true },
          staffing: { text: "Three teachers each lead a single course (Chemistry, Biology, Physics) plus advanced/AP sections. Shared lab technician supports all three. Science department head role rotates annually.", isKey: false },
        },
      },
      q1PlainText: "Science is led by three experienced, content-specialist educators — each with backgrounds in their respective scientific fields — supported by a shared lab technician.",
    },
  };

  await storage.updateComponent("science", { designedExperienceData: de });
  console.log(`  ✅ Science seeded (${scienceLeaps.length} leaps, ${scienceOutcomes.length} outcome groups, 3 subcomponents)`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. ENGLISH LANGUAGE ARTS
// ═════════════════════════════════════════════════════════════════════════════

async function seedELA() {
  console.log("\n📚 Seeding English Language Arts...");

  const elaLeaps = [
    leap("High expectations with rigorous learning", "H", "ELA holds every student to genuine college-and-career literacy standards — not a watered-down version for 'struggling readers.' Complex texts, sophisticated writing tasks, and rigorous analytical discourse are the standard for all students, with scaffolding designed so every learner can access and succeed with them."),
    leap("Whole-child focus", "H", "ELA instruction honors students' full identities and lived experiences as readers and writers. Texts are chosen to reflect students' cultures, histories, and communities. Personal narrative, identity writing, and student-chosen independent reading are core components of the program."),
    leap("Relevance", "H", "Reading and writing are taught as real-world tools — not school-only skills. Students write for authentic audiences (blogs, op-eds, community publications), read texts that matter to their world, and develop media literacy in an era of information complexity."),
    leap("Agency", "M", "Students exercise choice in independent reading selection, essay topic development, and creative writing directions. Book clubs and writing workshop models give students genuine ownership over their reading and writing lives."),
  ];

  const elaOutcomes = [
    outcome("English language arts", "H", "The ELA program explicitly targets reading and writing proficiency as foundational, transferable academic skills — assessed through portfolio-based and performance-based measures alongside standardized ones.", {
      subSelections: ["Reading", "Writing", "Literature"],
      subPriorities: { Reading: "H", Writing: "H", Literature: "M" },
      subPrimaries: { Reading: true, Writing: true },
    }),
    outcome("Higher order thinking skills", "H", "Critical reading, close analysis, argumentation, and synthesis — the intellectual tools of ELA — are explicitly developed and assessed as higher-order thinking competencies applicable across disciplines.", {
      subSelections: ["Critical thinking", "Creativity"],
      subPriorities: { "Critical thinking": "H", Creativity: "M" },
    }),
    outcome("Relationship skills", "M", "Book clubs, writing workshop peer review, and Socratic seminars explicitly develop communication, active listening, and collaborative discussion as core ELA practices.", {
      subSelections: ["Communication", "Collaboration"],
      subPriorities: { Communication: "H", Collaboration: "M" },
    }),
    outcome("Productive mindsets & purpose", "M", "Students develop identities as readers and writers — not just students who complete reading and writing assignments. The program explicitly builds student confidence, stamina, and love of language and story.", {
      subSelections: ["Identity & purpose"],
      subPriorities: { "Identity & purpose": "M" },
    }),
  ];

  const elaExpert = {
    schedule: {
      "schedule-q1__formats-of-time-blocks": a1Val([
        a1Tag("core-course", { isKey: true, notes: "ELA is a required daily core course for all grades 9–12, with year-long sequences at standard and Advanced Placement levels." }),
      ]),
      "schedule-q1__number-of-classrooms-and-students": a3PairVal(7, 175, true),
      "schedule-q1__duration": a3Val(55, "min", "55-minute class periods", true),
      "schedule-q1__frequency": a3Val(5, "days", "5 days per week, year-long", true),
      "schedule-q1__special-containers": a1Val([
        a1Tag("mini-terms", { isKey: true, notes: "Two intensive writing mini-terms per year (2 weeks each): one focused on argumentative writing and one on creative/narrative writing. Students write daily with in-class workshop feedback." }),
      ]),
    },
    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", { isKey: true, notes: "Mini-lessons on craft, grammar, and analytical reading strategies (15–20 min) anchor each class before workshop or discussion time." }),
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", { isKey: true, notes: "Socratic seminars and structured literature discussions where students lead inquiry around complex texts, constructing meaning collaboratively before the teacher synthesizes.", secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-problem-based-instruction"] }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-discourse", { isKey: true, notes: "Socratic seminar is the primary classroom discourse structure. Students prepare discussion questions, lead discussion, and evaluate their own participation using a self-assessment rubric." }),
        a1Tag("learning-practice-authentic-classroom-based-application", { isKey: true, notes: "Writing workshop model: students draft, peer conference, revise, and publish writing for authentic audiences. Several pieces per semester are published in the school literary magazine or submitted to community publications." }),
        a1Tag("learning-practice-formative-assessment", { notes: "Reading response journals and annotation checks serve as formative assessment tools.", secondaries: ["learning-practice-formative-assessment-quick-writes"] }),
        a1Tag("learning-practice-summative-assessment", { isKey: true, notes: "Portfolio-based assessment: each semester students curate a portfolio of their best writing with a reflective introduction assessing their own growth.", secondaries: ["learning-practice-summative-assessment-portfolio-assessment", "learning-practice-summative-assessment-performance-assessment"] }),
        a1Tag("learning-practice-goal-setting", { notes: "Students set reading and writing goals at the start of each unit and track progress in their reader-writer notebooks." }),
      ]),
      "learning-q1__learning-community": a1Val([
        a1Tag("learning-community-circles", { isKey: true, notes: "Story circles — a modified community circle format where students share stories and listen actively — used 1–2x per semester to build classroom community and honor student narrative." }),
        a1Tag("learning-community-mentoring-networking", { notes: "Student book clubs meet monthly during class, pairing students across grade levels for cross-grade reading discussion." }),
      ]),
      "learning-q2__learning-pedagogical": a1Val([
        a1Tag("learning-pedagogical-whole-child-supportive-teacher-tone", { isKey: true, notes: "Teachers approach reading and writing instruction as identity work — affirming student voices, honoring diverse linguistic backgrounds, and building a community of readers and writers who see themselves in the texts they read." }),
        a1Tag("learning-pedagogical-differentiation-practices-select-all-that-apply", { isKey: true, notes: "Text leveling, scaffolded annotation guides, and tiered writing supports ensure all students can access complex texts and produce sophisticated writing regardless of prior reading level." }),
      ]),
      "learning-q2__learning-grouping": a1Val([
        a1Tag("learning-grouping-small-group", { isKey: true, notes: "Book club groups of 4–5 meet weekly for independent reading discussion. Writing workshop conferencing uses small-group feedback structures." }),
        a1Tag("learning-grouping-whole-group", { notes: "Whole-group Socratic seminars and read-alouds (teacher models close reading with think-alouds) used 2–3x per week." }),
        a1Tag("learning-grouping-individualized", { notes: "1:1 teacher-student writing conferences occur at least once per unit — the signature personalized element of the writing workshop model." }),
      ]),
      "learning-q3-adult__adult-processes-tuning": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", { isKey: true, notes: "ELA department meets weekly to calibrate writing rubrics, review student work, and align independent reading assessment practices across grade-level teams.", secondaries: ["adult-processes-tuning-collaborative-teams-departmental"] }),
        a1Tag("adult-processes-tuning-data-inquiry-cycles", { notes: "Bi-annual analysis of student writing portfolios using shared rubrics to identify school-wide writing trends and adjust instruction.", secondaries: ["adult-processes-tuning-data-reviews-student-work-analysis"] }),
      ]),
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-hqim", { isKey: true, notes: "Wit & Wisdom (grades 9–10) and StudySync (grades 11–12) serve as the core curriculum, supplemented with culturally diverse independent reading choices." }),
        a1Tag("tools-curriculum-type-oer", { notes: "Diverse text sets curated by teachers featuring contemporary authors, cultural literary traditions, and student-selected texts." }),
        a1Tag("tools-curriculum-type-ap-ib", { notes: "AP English Language & Composition and AP English Literature & Composition for 11th–12th grade pathways.", secondaries: ["tools-curriculum-type-ap-ib-ap"] }),
      ]),
      "learning-q4-tools__tools-assessment-types": a1Val([
        a1Tag("tools-assessment-types-formative-assessment", { isKey: true, notes: "Annotation checks, quick-writes, and reading response journals.", secondaries: ["tools-assessment-types-formative-assessment-quick-writes"] }),
        a1Tag("tools-assessment-types-summative-assessment", { isKey: true, notes: "Writing portfolios and Socratic seminar performance tasks as primary summative measures.", secondaries: ["tools-assessment-types-summative-assessment-portfolio-assessment", "tools-assessment-types-summative-assessment-performance-assessment"] }),
      ]),
    },
    culture: {
      "culture-q2__culture-facilitator-practices": a5Val("ELA classrooms are intentionally built as communities of readers and writers — spaces where student voices are primary and teacher voice is in service of amplifying students. Teachers share their own reading and writing lives alongside students, modeling vulnerability and love of language.", true),
      "culture-q4-tools__touchstones-core-values": a5Val("Every voice matters · Reading is a conversation · Writing is thinking made visible · We are all storytellers", true),
    },
    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", { isKey: true, notes: "Each ELA section has a single certified teacher. All ELA teachers are trained in the writing workshop model and Socratic seminar facilitation." }),
        a1Tag("primary-secondary-teacher", { notes: "Co-taught sections exist for students with IEPs — ELA teacher and special education teacher deliver instruction together.", secondaries: ["teacher-paraprofessional"] }),
      ]),
      "facilitator-q1__fac-ratio": { archetypeA3Ratio: { learners: 25, facilitators: 1, isKey: false } },
      "facilitator-q2-adult__fac-role-definition": a5Val("ELA teachers facilitate writing workshop conferences (1:1 and small group), lead Socratic seminars, curate diverse text sets, and assess student writing portfolios using calibrated rubrics. All teachers maintain individual reading logs and model reading lives for students.", true),
    },
    partnerships: {
      "partnerships-q1__partnerships-community": a1Val([
        a1Tag("service-provider-partnerships", { isKey: true, notes: "Partnership with local literary arts organization brings published authors to class each semester for writing workshops and readings — students receive authentic author feedback on their work." }),
        a1Tag("college-continuing-ed-partnerships", { notes: "AP English courses provide dual-credit opportunities through the regional community college for qualifying students." }),
      ]),
      "partnerships-q1__partnerships-family": a1Val([
        a1Tag("family-conferencing", { isKey: true, notes: "Student-led portfolio conferences in 9th–10th grade: students share their writing portfolios with families and discuss growth as readers and writers." }),
      ]),
    },
    ops: {
      "ops-q1__ops-physical-space": a1Val([
        a1Tag("classroom-layout-furniture", { isKey: true, notes: "Flexible seating supports rapid transitions between whole-group Socratic seminars, small-group book clubs, and individual writing workshop time." }),
        a1Tag("classroom-ambience-visuals", { isKey: true, notes: "Classroom libraries with diverse texts available for independent reading. Student writing published and displayed throughout the space. Author and poet portraits from diverse backgrounds." }),
      ]),
      "ops-q1__ops-software": a1Val([
        a1Tag("software-lms", { isKey: true, notes: "Canvas LMS for digital submission of essays, peer review, and teacher feedback on drafts." }),
        a1Tag("software-student-learning", { notes: "CommonLit and Newsela for differentiated reading level access to complex texts.", isKey: false }),
      ]),
    },
    improvement: {
      "ci-q1__ci-tuning-practices": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", { isKey: true, notes: "ELA department engages in collaborative essay scoring sessions each semester — calibrating rubrics and identifying school-wide writing trends.", secondaries: ["adult-processes-tuning-collaborative-teams-departmental"] }),
        a1Tag("adult-processes-tuning-data-reviews-data-dialogue-routines", { notes: "Portfolio data reviewed at mid-year and end-of-year to track writing proficiency growth across grade levels.", secondaries: ["adult-processes-tuning-data-reviews-student-work-analysis"] }),
      ]),
    },
  };

  const de = {
    description: "English Language Arts develops students as confident, critical readers and writers who use language as a tool for thinking, self-expression, and civic participation. Using a writing workshop and Socratic seminar model, students engage with complex, culturally diverse texts and produce authentic writing for real audiences across all four years of high school.",
    experienceAudience: "learner",
    keyDesignElements: { aims: [...elaLeaps, ...elaOutcomes], practices: [], supports: [] },
    elementsExpertData: elaExpert,
    subcomponents: [],
    adultSubcomponents: [],
    learnersProfile: gradeHSProfile("ELA is required for all students grades 9–12, with AP English Language & Composition (11th) and AP English Literature & Composition (12th) available as advanced pathways.", [
      { primaryId: "prior_knowledge", secondaryIds: [], isKey: true, description: "Students arrive with wide-ranging reading levels and writing backgrounds. The writing workshop and differentiated text model is designed to serve all reading levels simultaneously without ability-grouping or tracking within courses." },
      { primaryId: "home_language", secondaryIds: [], isKey: true, description: "A significant share of students are multilingual learners whose home language is not English. ELA instruction honors students' full linguistic repertoires and treats multilingualism as an asset rather than a deficit." },
      { primaryId: "interests_motivations", secondaryIds: [], isKey: false, description: "Students bring diverse reading interests — from sports journalism to graphic novels to social justice literature. Independent reading choice is a core program commitment." },
    ]),
    adultsProfile: {
      selections: [{ primaryId: "educators", secondaryIds: ["educators_core_courses"] }],
      sliceDetail: {
        educators: {
          name: { text: "Ms. Jennifer Walsh (ELA 9–10, Dept. Head) · Mr. Marcus Brown (ELA 11–12, AP English Literature) · Ms. Aisha Cooper (AP English Language, ELA 11)", isKey: false },
          incomingSkills: { text: "All ELA teachers are trained in the writing workshop model (Teachers College Reading & Writing Project or equivalent) and Socratic seminar facilitation. Ms. Walsh holds a National Board Certification in ELA. Mr. Brown is an AP reader for the College Board. Ms. Cooper brings a background in journalism and multicultural literature curation.", isKey: true },
          staffing: { text: "Three ELA teachers each cover 5 sections across grade-level assignments. Ms. Walsh (dept. head) has one reduced section to support curriculum coordination, teacher observation, and writing workshop coaching for new ELA teachers.", isKey: false },
        },
      },
      q1PlainText: "Three experienced ELA educators lead the program — a National Board Certified teacher, an AP reader, and a journalism-trained multicultural literature specialist.",
    },
  };

  await storage.updateComponent("english_language_arts", { designedExperienceData: de });
  console.log(`  ✅ ELA seeded (${elaLeaps.length} leaps, ${elaOutcomes.length} outcome groups, no subcomponents)`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. STUDENT ADVISORY SEMINAR
// ═════════════════════════════════════════════════════════════════════════════

function buildAdvisorySub(name: "9th–10th Grade Advisory" | "11th–12th Grade Advisory"): Record<string, unknown> {
  const isUnderclassman = name === "9th–10th Grade Advisory";

  const subLeaps = [
    leap("Connection & community", "H", isUnderclassman
      ? "9th and 10th grade advisory is explicitly designed to help new students build their community. The transition to high school is a pivotal moment — advisory is the primary structure that ensures no student falls through the cracks in their first two years."
      : "11th and 12th grade advisory deepens community through shared future-planning. Students support each other through the college and career process — celebrating wins, providing peer support during stress, and building lasting peer relationships."),
    leap("Agency", "H", isUnderclassman
      ? "Younger students develop self-advocacy skills, goal-setting habits, and academic planning tools through advisory — building the agency muscles they'll need throughout high school."
      : "Upper-division students exercise genuine agency in their post-secondary planning. Advisory supports students in driving their own college and career research, application process, and decision-making — not just following a prescribed path."),
    leap("Whole-child focus", "H", isUnderclassman
      ? "9th and 10th grade advisory attends explicitly to the social-emotional transition of early high school — new school environments, evolving peer relationships, and developing sense of identity. Academic support is secondary to relational connection."
      : "11th and 12th grade advisory holds the whole student — not just their applications and transcripts. Mental health during the college process, family dynamics, financial stress, and identity questions are all fair game in advisory conversations."),
  ];

  const subOutcomes = [
    outcome("Productive mindsets & purpose", "H", isUnderclassman
      ? "9th and 10th grade advisory explicitly builds growth mindset, academic resilience, and a developing sense of purpose and identity as a high school student."
      : "11th and 12th grade advisory deepens students' sense of purpose and life direction — supported by career exploration, community service, and post-secondary planning.", {
      subSelections: ["Identity & purpose", "Mindsets & self-regulation"],
      subPriorities: { "Identity & purpose": "H", "Mindsets & self-regulation": "H" },
      subPrimaries: { "Identity & purpose": true },
    }),
    outcome("Social wellbeing", "H", isUnderclassman
      ? "Early advisory is designed to ensure every 9th and 10th grader has at least one trusted adult and one trusted peer in the school — the foundational relational infrastructure for high school success."
      : "Upper-division advisory maintains and deepens students' sense of belonging through the most stressful years — junior and senior year — while building peer support networks for post-secondary transitions.", {
      subSelections: ["Belonging", "Quality of peer relationships", "Connection to teachers & staff"],
      subPriorities: { Belonging: "H", "Quality of peer relationships": "H", "Connection to teachers & staff": "H" },
      subPrimaries: { Belonging: true },
    }),
    outcome("Assets for continuing education, career, and life", isUnderclassman ? "M" : "H",
      isUnderclassman
        ? "9th and 10th grade advisory begins building the foundational assets — transcript awareness, educator relationships, and goal-setting — that will matter deeply in junior and senior year."
        : "11th and 12th grade advisory is the primary vehicle for students building the assets they'll need for post-secondary success — college applications, financial aid navigation, career exploration, and professional network building.", {
      subSelections: ["Educator relationships & recommendations", isUnderclassman ? "Transcript" : "Postsecondary enrollment"],
      subPriorities: { "Educator relationships & recommendations": isUnderclassman ? "M" : "H", [isUnderclassman ? "Transcript" : "Postsecondary enrollment"]: isUnderclassman ? "M" : "H" },
      subPrimaries: { [isUnderclassman ? "Transcript" : "Postsecondary enrollment"]: true },
    }),
  ];

  const subExpert = {
    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", { isKey: false, notes: isUnderclassman
          ? "Short skill-building lessons on academic planning, study strategies, and self-advocacy delivered in advisory."
          : "College application workshops, financial aid literacy lessons, and career exploration sessions delivered in advisory." }),
        a1Tag("learning-exposure-visits-and-fairs", { isKey: isUnderclassman ? false : true, notes: isUnderclassman
          ? "Field trips to local colleges provide early exposure to post-secondary environments for 9th and 10th graders."
          : "College fairs and career panels organized through advisory bring post-secondary and professional contexts directly to students.", secondaries: isUnderclassman ? ["learning-exposure-visits-and-fairs-college-visits"] : ["learning-exposure-visits-and-fairs-college-career-fairs", "learning-exposure-visits-and-fairs-college-visits"] }),
      ]),
      "learning-q1__learning-community": a1Val([
        a1Tag("learning-community-circles", { isKey: true, notes: isUnderclassman
          ? "Weekly community circles are the signature practice of 9th–10th grade advisory — check-ins, community agreements, and sharing rituals build trust and belonging across the year."
          : "Community circles continue into 11th–12th grade, adapted for the emotional texture of the college and career process — sharing stress, celebrating milestones, and processing uncertainty together." }),
        a1Tag("learning-community-mentoring-networking", { isKey: isUnderclassman ? false : true, notes: isUnderclassman
          ? "Peer mentoring pairs (10th grade mentors for 9th graders) provide near-peer navigation support."
          : "Alumni mentoring network connects seniors with recent graduates navigating college and career transitions — structured monthly 1:1 conversations." }),
      ]),
      "learning-q1__learning-individual-planning": a5Val(isUnderclassman
        ? "Individual 4-year academic plans developed in 9th grade and reviewed annually with each student's advisor. Plans include coursework goals, extracurricular interests, and initial post-secondary direction exploration."
        : "Individual college and career plans developed and refined through junior and senior year in advisory. Plans include college lists, application timelines, financial aid strategy, and career exploration reflections.",
        true),
    },
    culture: {
      "culture-q2__culture-facilitator-practices": a5Val(isUnderclassman
        ? "9th–10th advisory facilitators are trained in restorative practices, active listening, and circle facilitation. They prioritize relationship over content — every advisory session begins with a personal check-in before any agenda items."
        : "11th–12th advisors are trained in college counseling basics, financial aid literacy, and stress management support. They function as 'caring adults who hold the whole person' — not just college process managers.",
        true),
      "culture-q4-tools__touchstones-core-values": a5Val(isUnderclassman
        ? "You belong here · Ask for help · We show up for each other · Every student has a trusted adult"
        : "You have a future worth planning · Be honest about what you need · Celebrate each other's wins · Community over competition",
        true),
    },
    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", { isKey: true, notes: isUnderclassman
          ? "Each advisory group of 15–18 students has a single advisor — a trained staff member (teacher or counselor) who commits to the same group for 2 years (9th and 10th grade)."
          : "Each advisory group of 15–18 students has a single advisor who commits to the same group for 2 years (11th and 12th grade). Counselors Ms. Williams and Mr. Chen serve as anchor advisors for their grade bands." }),
      ]),
      "facilitator-q1__fac-other-roles": a1Val([
        a1Tag("student-support-wellbeing", { isKey: true, notes: isUnderclassman
          ? "Mr. David Chen (counselor) provides oversight and case management support for all 9th–10th advisory groups, meeting with each advisory at least once per quarter."
          : "Ms. Amanda Williams (counselor) provides college counseling support across all 11th–12th advisory groups — leading key sessions on college research, applications, and financial aid." }),
      ]),
    },
  };

  return {
    id: genId(), name,
    description: isUnderclassman
      ? "9th–10th grade advisory provides the relational foundation for high school success. Students are assigned to a small advisory group with a consistent adult advisor for their first two years. Advisory meets daily and focuses on community-building, academic self-advocacy, goal-setting, and early post-secondary exploration."
      : "11th–12th grade advisory guides students through the college and career planning process while maintaining the community and relational support that began in 9th grade. Advisory meets daily and integrates college application support, career exploration, financial aid literacy, and social-emotional wellbeing.",
    keyDesignElements: { aims: [...subLeaps, ...subOutcomes], practices: [], supports: [] },
    elementsExpertData: subExpert,
    learnersProfile: {
      selections: [{
        primaryId: isUnderclassman ? "grade_elementary_school" : "grade_high_school",
        secondaryIds: isUnderclassman ? ["grade_9", "grade_10"] : ["grade_11", "grade_12"],
        secondaryKeys: isUnderclassman ? { grade_9: true, grade_10: true } : { grade_11: true, grade_12: true },
        isKey: false,
        description: isUnderclassman
          ? "9th–10th grade advisory serves all students in their first two years of high school — a critical transition and relationship-building period."
          : "11th–12th grade advisory serves all upperclassmen through the college and career decision process — the most high-stakes two years of their high school experience.",
      }, {
        primaryId: "mandatory_all", secondaryIds: [], isKey: false,
        description: "Advisory is mandatory for all students — every student in the school is in an advisory group every day. There is no opt-out.",
      }],
    },
    adultsProfile: {
      selections: [{ primaryId: "educators", secondaryIds: [] }, { primaryId: "student_support_wellbeing_staff", secondaryIds: ["school_counselors"] }],
      sliceDetail: {
        educators: {
          incomingSkills: { text: isUnderclassman
            ? "9th–10th advisors are trained in restorative practices, circle facilitation, and adolescent development. All advisors receive 3 days of advisory-specific training before the school year begins."
            : "11th–12th advisors receive training in college counseling basics, financial aid literacy, and senior transition stress. Annual training from Ms. Williams (lead counselor) keeps advisors current on college process changes.",
            isKey: true },
          staffing: { text: isUnderclassman
            ? "Each advisor serves a group of 15–18 students for 2 consecutive years (9th and 10th grade). Advisory is built into all staff schedules — teachers, counselors, and administrators all advise."
            : "11th–12th advisors commit to their group for 2 years. Counselors serve as co-facilitators for key college-process advisory sessions throughout the year.",
            isKey: false },
        },
        student_support_wellbeing_staff: {
          name: { text: isUnderclassman ? "Mr. David Chen (9th–10th Grade Counselor)" : "Ms. Amanda Williams (11th–12th Grade Counselor, Lead)", isKey: false },
          incomingSkills: { text: isUnderclassman
            ? "Mr. Chen specializes in early high school transition and first-generation student support. He leads training for all 9th–10th advisors and provides case management for students identified as needing additional support."
            : "Ms. Amanda Williams is a licensed clinical social worker specializing in adolescent mental health and college counseling. She oversees all 11th–12th advisory programming, leads college application workshops, and coordinates with advisors on student wellbeing monitoring.",
            isKey: true },
        },
      },
      q1PlainText: isUnderclassman
        ? "9th–10th advisory is facilitated by trained teacher-advisors with oversight from school counselor Mr. David Chen."
        : "11th–12th advisory is facilitated by trained teacher-advisors with deep involvement from lead counselor Ms. Amanda Williams.",
    },
    aims: [], practices: [], supports: [],
  };
}

async function seedStudentAdvisory() {
  console.log("\n🧭 Seeding Student Advisory Seminar...");

  const advisoryLeaps = [
    leap("Connection & community", "H", "Student Advisory Seminar is the school's primary community-building structure. Advisory ensures every student has a trusted adult and a peer community — not by accident, but by design. Small advisory groups of 15–18 students stay together with the same advisor for 2 years, creating lasting bonds across the high school experience."),
    leap("Whole-child focus", "H", "Advisory is explicitly designed for the whole child — social, emotional, and developmental — not just academic advising. Social-emotional learning, identity development, and wellbeing monitoring are the explicit purposes of advisory, not secondary benefits."),
    leap("Agency", "H", "Students in advisory develop increasing agency over their own lives and futures. Academic planning, post-secondary preparation, and goal-setting are student-driven processes in advisory — advisors coach and support, but students own their plans."),
    leap("Relevance", "M", "Advisory connects the school experience to students' real lives — family context, community identity, future aspirations, and current wellbeing challenges. Curriculum is drawn from students' lived experiences and designed to address what actually matters to them right now."),
  ];

  const advisoryOutcomes = [
    outcome("Social wellbeing", "H", "Advisory is the primary system for monitoring and developing student social wellbeing — belonging, peer relationships, and adult connection. Every student exits high school having been known deeply by at least one adult and belonging to a tight peer community.", {
      subSelections: ["Belonging", "Quality of peer relationships", "Connection to teachers & staff"],
      subPriorities: { Belonging: "H", "Quality of peer relationships": "H", "Connection to teachers & staff": "H" },
      subPrimaries: { Belonging: true, "Connection to teachers & staff": true },
    }),
    outcome("Productive mindsets & purpose", "H", "Advisory is the explicit vehicle for developing student identity, purpose, growth mindset, and self-regulation across all four years of high school.", {
      subSelections: ["Identity & purpose", "Mindsets & self-regulation"],
      subPriorities: { "Identity & purpose": "H", "Mindsets & self-regulation": "H" },
      subPrimaries: { "Identity & purpose": true },
    }),
    outcome("Mental & physical health", "H", "Advisory is the school's early warning system for student mental health — advisors are trained to identify students struggling and connect them to counseling and wraparound supports.", {
      subSelections: ["Emotional well-being & mood", "Stress & resilience"],
      subPriorities: { "Emotional well-being & mood": "H", "Stress & resilience": "H" },
    }),
    outcome("Assets for continuing education, career, and life", "M", "Advisory progressively builds the assets students need for post-secondary success — relationships with educators, career awareness, financial literacy, and a plan for what comes next.", {
      subSelections: ["Educator relationships & recommendations", "Postsecondary enrollment"],
      subPriorities: { "Educator relationships & recommendations": "H", "Postsecondary enrollment": "M" },
    }),
  ];

  const advisoryExpert = {
    schedule: {
      "schedule-q1__formats-of-time-blocks": a1Val([
        a1Tag("advisory-block", { isKey: true, notes: "Advisory meets daily as a dedicated 30-minute block built into the school schedule. It is protected time — no pull-outs, no announcements, no academic class encroachment." }),
      ]),
      "schedule-q1__number-of-classrooms-and-students": a3PairVal(30, 600, true),
      "schedule-q1__duration": a3Val(30, "min", "30 minutes daily dedicated advisory block", true),
      "schedule-q1__frequency": a3Val(5, "days", "5 days per week, every day of the school year", true),
      "schedule-q3__master-scheduling-systems": a5Val("Advisory is built into the master schedule as Period 1 (first period of each day). All staff — including administrators — are assigned to advisory groups, ensuring every adult in the building has a relational investment in a specific group of students.", true),
    },
    learning: {
      "learning-q1__learning-community": a1Val([
        a1Tag("learning-community-circles", { isKey: true, notes: "Community circle is the daily advisory format — check-in rounds, discussion prompts, and closing rituals build trust and belonging progressively across the year." }),
        a1Tag("learning-community-counseling", { isKey: true, notes: "Counselors Ms. Williams and Mr. Chen co-facilitate quarterly advisory sessions focused on social-emotional wellbeing, stress management, and identity development." }),
        a1Tag("learning-community-student-onboarding-transition-experiences", { isKey: true, notes: "Dedicated 'Welcome Week' advisory curriculum for new 9th graders — community-building, school navigation, and relationship-formation activities.", secondaries: ["learning-community-student-onboarding-transition-experiences-new-student-family-welcome", "learning-community-student-onboarding-transition-experiences-rites-of-passage"] }),
        a1Tag("learning-community-mentoring-networking", { notes: "Senior mentors paired with incoming 9th graders for the first semester — structured peer mentoring with monthly check-in protocols." }),
      ]),
      "learning-q1__learning-individual-planning": a5Val("Individual student plans are maintained and updated in advisory — 4-year academic plans (9th grade), post-secondary planning documents (11th–12th grade), and annual goal-setting reflections (all grades). Advisors conduct 1:1 planning conferences with each student twice per year.", true),
    },
    culture: {
      "culture-q1__culture-behavior-mgmt": a1Val([
        a1Tag("restorative-practices", { isKey: true, notes: "Advisory uses restorative practices as its primary culture-building approach — circles, agreements, and accountability structures grounded in relationships rather than punishment." }),
        a1Tag("responsive-classroom", { notes: "Responsive Classroom strategies inform how advisors build and maintain community norms across the year." }),
      ]),
      "culture-q2__culture-facilitator-practices": a5Val("Advisory facilitators are selected for relational skills as much as content expertise. Training emphasizes active listening, non-judgmental response, and the ability to hold space for students' full range of experiences — joy, struggle, uncertainty, and growth. Advisors model vulnerability and personal reflection.", true),
      "culture-q4-tools__touchstones-core-values": a5Val("You belong here · Every voice matters · We hold each other accountable with care · Showing up is an act of community", true),
      "culture-q4-tools__touchstones-core-commitments": a5Val("We commit to knowing every student's story. We commit to being a place where students can be honest about how they're really doing. We commit to celebrating milestones — big and small — together.", true),
    },
    facilitator: {
      "facilitator-q1__fac-other-roles": a1Val([
        a1Tag("school-leaders-administrators", { isKey: true, notes: "Principal Rodriguez and both APs each advise a group — modeling that school leadership is in community with students, not above them." }),
        a1Tag("student-support-wellbeing", { isKey: true, notes: "Ms. Amanda Williams and Mr. David Chen are the anchor counselors — supervising advisory programming school-wide, facilitating key SEL sessions, and providing case management for students identified in advisory as needing additional support." }),
      ]),
      "facilitator-q2-adult__fac-role-definition": a5Val("Advisors are responsible for: (1) facilitating daily community circle, (2) monitoring each student's academic and social wellbeing throughout the year, (3) completing annual 1:1 planning conferences with each student, (4) serving as the primary point of contact for families about their child's overall school experience, and (5) escalating concerns to counselors when needed.", true),
      "facilitator-q3-adult-tools__fac-skills-knowledge-mindsets": a5Val("All advisors trained in: restorative circle facilitation, Panorama wellbeing data interpretation, college and career basics (upper-division advisors), and mandated reporter protocols. 3-day advisory training at start of school year + 1 advisory PD day per semester.", true),
    },
    partnerships: {
      "partnerships-q1__partnerships-family": a1Val([
        a1Tag("family-communication-channels", { isKey: true, notes: "Advisors serve as the primary family contact for each student — sending a monthly 'advisory update' email and initiating outreach when student wellbeing concerns arise." }),
        a1Tag("family-conferencing", { isKey: true, notes: "Student-led advisory portfolio conferences each semester: students share their academic and personal growth with families in a structured advisory format." }),
      ]),
    },
    improvement: {
      "ci-q1__ci-tuning-practices": a1Val([
        a1Tag("adult-processes-tuning-data-inquiry-cycles", { isKey: true, notes: "Panorama wellbeing survey results analyzed by advisory team each semester — informing adjustments to advisory curriculum and triggering outreach to students showing declining wellbeing indicators.", secondaries: ["adult-processes-tuning-data-inquiry-cycles-pdsa"] }),
      ]),
    },
  };

  const de = {
    description: "Student Advisory Seminar is a daily, all-school program that assigns every student to a small advisory group of 15–18 peers with a consistent adult advisor for two-year spans (9th–10th and 11th–12th). Advisory is the school's primary community-building and whole-child development structure — protecting time each day for relationship, reflection, goal-setting, and social-emotional growth across all four years of high school.",
    experienceAudience: "learner",
    keyDesignElements: { aims: [...advisoryLeaps, ...advisoryOutcomes], practices: [], supports: [] },
    elementsExpertData: advisoryExpert,
    subcomponents: [buildAdvisorySub("9th–10th Grade Advisory"), buildAdvisorySub("11th–12th Grade Advisory")],
    adultSubcomponents: [],
    learnersProfile: {
      selections: [
        {
          primaryId: "grade_high_school",
          secondaryIds: ["grade_9", "grade_10", "grade_11", "grade_12"],
          secondaryKeys: { grade_9: true, grade_10: true, grade_11: true, grade_12: true },
          isKey: false,
          description: "Advisory is mandatory for all students, all grades, all years. Every student in the school is in advisory every day.",
        },
        { primaryId: "socioeconomic", secondaryIds: [], isKey: true, description: "Advisory is designed to be especially critical for first-generation students and those navigating financial hardship — providing the relational and informational support structures that some families have access to outside school and others do not." },
        { primaryId: "disability_neurodivergence", secondaryIds: [], isKey: false, description: "Advisory IEP/504 accommodations are built in — advisors receive relevant information for students with support plans and coordinate with the counseling team accordingly." },
        { primaryId: "mandatory_all", secondaryIds: [], isKey: false, description: "Advisory is mandatory for all students, every day." },
      ],
    },
    adultsProfile: {
      selections: [
        { primaryId: "educators", secondaryIds: [] },
        { primaryId: "student_support_wellbeing_staff", secondaryIds: ["school_counselors"] },
        { primaryId: "school_leaders_administrators", secondaryIds: ["principal_head_of_school", "ap_dean_school"] },
      ],
      sliceDetail: {
        educators: {
          incomingSkills: { text: "All teacher-advisors complete 3 days of advisory training focused on restorative circle facilitation, active listening, and student wellbeing monitoring. Ongoing monthly advisory team meetings (facilitated by counselors) keep advisors aligned and supported.", isKey: true },
          staffing: { text: "Every teacher in the school advises. Advisory groups of 15–18 students are assigned to each staff member. Teachers maintain their advisory group for 2 consecutive years.", isKey: false },
        },
        student_support_wellbeing_staff: {
          name: { text: "Ms. Amanda Williams (11th–12th Counselor & Advisory Supervisor) · Mr. David Chen (9th–10th Counselor & Advisory Supervisor)", isKey: false },
          incomingSkills: { text: "Both counselors are licensed professionals with specializations in adolescent development. They provide clinical oversight of the advisory program, facilitate SEL-specific advisory sessions, and provide case management for students identified through advisory monitoring as needing additional support.", isKey: true },
          staffing: { text: "Each counselor supervises their grade-band's advisory program — providing monthly advisor meetings, co-facilitating advisory sessions, reviewing Panorama wellbeing data, and managing referrals generated through advisory.", isKey: false },
        },
        school_leaders_administrators: {
          name: { text: "Principal Maria Rodriguez · AP Sarah Kim · AP James Okafor", isKey: false },
          incomingSkills: { text: "All three school administrators advise student groups — modeling that community membership is not reserved for students and teachers only. Leadership advisory groups are treated the same as teacher advisory groups, with the same curriculum and expectations.", isKey: false },
          staffing: { text: "Administrators' advisory groups are smaller (10–12 students) to accommodate scheduling demands, but the commitment and curriculum are identical to teacher advisory groups.", isKey: false },
        },
      },
      q1PlainText: "Advisory is a whole-school practice — every teacher, counselor, and administrator advises a group of students for 2 consecutive years. Counselors provide clinical oversight and co-facilitate key advisory sessions.",
    },
  };

  await storage.updateComponent("student_advisory_seminar", { designedExperienceData: de });
  console.log(`  ✅ Student Advisory Seminar seeded (${advisoryLeaps.length} leaps, ${advisoryOutcomes.length} outcome groups, 2 subcomponents)`);
}

// ── Run all ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting batch seed: Overall School, Science, ELA, Student Advisory Seminar\n");
  await seedOverall();
  await seedScience();
  await seedELA();
  await seedStudentAdvisory();
  console.log("\n✅ All 4 components seeded successfully!");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
