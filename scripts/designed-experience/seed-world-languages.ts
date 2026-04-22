/**
 * Seed World Languages component + Spanish & French subcomponents
 * with realistic designed experience data.
 *
 * Run with:
 *   node --env-file=.env --import tsx/esm scripts/seed-world-languages.ts
 */

import { storage } from "../../server/storage.ts";

// ── ID helpers ────────────────────────────────────────────────────────────────

let _counter = 0;
function genId(): string {
  return `de_${Date.now()}_${++_counter}`;
}

// ── Aim builders ──────────────────────────────────────────────────────────────

function leap(
  label: string,
  priority: "H" | "M" | "L",
  notes: string,
): Record<string, unknown> {
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

// ── A1 tag selection helpers ───────────────────────────────────────────────────

function a1Tag(
  tagId: string,
  opts: { isKey?: boolean; notes?: string; secondaries?: string[] } = {},
): Record<string, unknown> {
  return {
    tagId,
    isKey: opts.isKey ?? false,
    notes: opts.notes ?? "",
    selectedSecondaries: (opts.secondaries ?? []).map((s) => ({
      tagId: s,
      isKey: false,
      notes: "",
    })),
  };
}

function a1Val(
  tags: ReturnType<typeof a1Tag>[],
): Record<string, unknown> {
  return { archetypeA1: { selections: tags } };
}

function a3Val(
  value: number,
  unit: string,
  description: string,
  isKey = false,
): Record<string, unknown> {
  return { archetypeA3: { value, unit, description, isKey } };
}

function a3PairVal(
  first: number,
  second: number,
  isKey = false,
): Record<string, unknown> {
  return { archetypeA3Pair: { first, second, isKey } };
}

function a5Val(
  text: string,
  isKey = false,
): Record<string, unknown> {
  return { archetypeA5: { text, inheritFromSchool: false, isKey } };
}

// ── elementsExpertData builder ────────────────────────────────────────────────
// Key format: { [elementId]: { [questionId__bucketId]: BucketValue } }

function expertData(): Record<string, Record<string, unknown>> {
  return {
    // ── SCHEDULE & USE OF TIME ──────────────────────────────────────────────
    schedule: {
      // Q1 — formats, classrooms, duration, frequency, special containers
      "schedule-q1__formats-of-time-blocks": a1Val([
        a1Tag("core-course", { isKey: true, notes: "World Languages runs as a core daily course for all enrolled students." }),
        a1Tag("elective-special", { notes: "Advanced conversation sections offered as elective enrichment." }),
      ]),
      "schedule-q1__number-of-classrooms-and-students": a3PairVal(6, 180, true), // 6 classrooms, 180 students
      "schedule-q1__duration": a3Val(50, "min", "50-minute class periods", true),
      "schedule-q1__frequency": a3Val(5, "days", "5 days per week throughout the academic year", true),
      "schedule-q1__special-containers": a1Val([
        a1Tag("mini-terms", {
          isKey: true,
          notes: "Intensive language immersion weeks offered twice a year — one per semester — allowing students to focus deeply on conversational fluency and cultural exploration.",
        }),
      ]),
      // Q3 — master scheduling
      "schedule-q3__master-scheduling-systems": a5Val(
        "World Languages is integrated into the master schedule as a required course sequence (grades 9–12). Scheduling accounts for multi-level sections within the same classroom for advanced courses, and ensures language continuity across years rather than stand-alone enrollment.",
      ),
      // Q4 — scheduling tools
      "schedule-q4__scheduling-tools-resources": a5Val(
        "Scheduling software (Infinite Campus) is used to coordinate course sequencing and proficiency-level groupings. A shared language department scheduling template ensures alignment between Spanish and French sections.",
      ),
    },

    // ── LEARNING ACTIVITIES, INSTRUCTIONAL PRACTICES, C&A ──────────────────
    learning: {
      // Q1 — learning activities
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", {
          isKey: true,
          notes: "Mini-lessons on grammar, vocabulary, and phonetics anchor each class period before students practice in context.",
        }),
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
          isKey: true,
          notes: "Students explore authentic texts, audio, and video materials to inductively discover language patterns and cultural norms.",
          secondaries: ["learning-exposure-inquiry-based-instruction-indirect-instruction-experiential-learning"],
        }),
        a1Tag("learning-exposure-visits-and-fairs", {
          notes: "Annual cultural fair where students present research on Spanish- and French-speaking communities.",
        }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-discourse", {
          isKey: true,
          notes: "Structured conversation protocols (Socratic circles, fishbowl discussions) held entirely in the target language to build communicative confidence.",
        }),
        a1Tag("learning-practice-fluency-practice", {
          isKey: true,
          notes: "Daily 5-minute fluency drills — oral and written — targeting high-frequency vocabulary and verb conjugations.",
        }),
        a1Tag("learning-practice-formative-assessment", {
          isKey: false,
          notes: "Exit tickets and quick-writes in the target language assess daily comprehension.",
          secondaries: ["learning-practice-formative-assessment-exit-tickets", "learning-practice-formative-assessment-quick-writes"],
        }),
        a1Tag("learning-practice-summative-assessment", {
          notes: "End-of-unit performance assessments include spoken presentations and written compositions evaluated by ACTFL-aligned rubrics.",
          secondaries: ["learning-practice-summative-assessment-performance-assessment", "learning-practice-summative-assessment-portfolio-assessment"],
        }),
      ]),
      "learning-q1__learning-community": a1Val([
        a1Tag("learning-community-circles", {
          isKey: true,
          notes: "Weekly community circles conducted in the target language build classroom cohesion and give students low-stakes speaking practice.",
        }),
        a1Tag("learning-community-student-onboarding-transition-experiences", {
          notes: "Language placement protocols and a welcome 'Bienvenidos/Bienvenue' orientation for new students.",
          secondaries: ["learning-community-student-onboarding-transition-experiences-new-student-family-welcome"],
        }),
      ]),
      // Q2 — pedagogical approaches
      "learning-q2__learning-pedagogical": a1Val([
        a1Tag("learning-pedagogical-whole-child-supportive-teacher-tone", {
          isKey: true,
          notes: "Teachers affirm students' cultural and linguistic identities, validating heritage speakers and celebrating multilingualism as an asset.",
        }),
        a1Tag("learning-pedagogical-differentiation-practices-select-all-that-apply", {
          isKey: false,
          notes: "Differentiated tasks allow heritage speakers, beginners, and advanced learners to work on the same cultural theme at varied proficiency levels.",
        }),
      ]),
      "learning-q2__learning-grouping": a1Val([
        a1Tag("learning-grouping-small-group", {
          isKey: true,
          notes: "Proficiency-based small groups allow targeted practice without stigma — groups rotate so students see peers at all levels.",
        }),
        a1Tag("learning-grouping-whole-group", {
          notes: "Whole-group is used for cultural input, storytelling, and shared listening experiences.",
        }),
        a1Tag("learning-grouping-station-rotation", {
          isKey: false,
          notes: "Station rotation supports simultaneous practice across listening, speaking, reading, and writing.",
        }),
      ]),
      // Q3 adult — professional practices
      "learning-q3-adult__adult-processes-tuning": a1Val([
        a1Tag("adult-processes-tuning-collaborative-teams", {
          isKey: true,
          notes: "The World Languages department meets bi-weekly to align assessments, review student performance data, and share instructional strategies across Spanish and French.",
          secondaries: ["adult-processes-tuning-collaborative-teams-departmental"],
        }),
        a1Tag("adult-processes-tuning-instructional-coaching", {
          isKey: false,
          notes: "Language coaches provide embedded coaching cycles focused on target-language immersion and comprehensible input strategies.",
        }),
      ]),
      // Q4 tools — curriculum
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-hqim", {
          isKey: true,
          notes: "HQIM curricula aligned to ACTFL proficiency standards used for both Spanish and French sequences.",
        }),
        a1Tag("tools-curriculum-type-oer", {
          notes: "Open educational resources including authentic media (news articles, podcasts, short films) supplement the core curriculum.",
        }),
      ]),
      "learning-q4-tools__tools-assessment-types": a1Val([
        a1Tag("tools-assessment-types-formative-assessment", {
          isKey: true,
          notes: "Daily check-ins and exit tickets in target language provide real-time comprehension data.",
          secondaries: ["tools-assessment-types-formative-assessment-exit-tickets"],
        }),
        a1Tag("tools-assessment-types-summative-assessment", {
          isKey: true,
          notes: "Performance assessments aligned to ACTFL Integrated Performance Assessment (IPA) framework — Interpretive, Interpersonal, Presentational modes.",
          secondaries: ["tools-assessment-types-summative-assessment-performance-assessment", "tools-assessment-types-summative-assessment-portfolio-assessment"],
        }),
        a1Tag("tools-assessment-types-competency-based-assessment", {
          notes: "Proficiency benchmarking against ACTFL Novice–Distinguished scale at end of each course.",
          secondaries: ["tools-assessment-types-competency-based-assessment-mastery-based-assessment"],
        }),
      ]),
    },

    // ── SYSTEMS & PRACTICES FOR SCHOOL CULTURE ─────────────────────────────
    culture: {
      "culture-q1__culture-behavior-mgmt": a1Val([
        a1Tag("restorative-practices", {
          isKey: true,
          notes: "Restorative circles address language-anxiety incidents and create safe space for risk-taking in speaking practice.",
        }),
        a1Tag("responsive-classroom", {
          notes: "Responsive Classroom strategies reinforce belonging and ensure every student feels valued as a language learner.",
        }),
      ]),
      "culture-q1__culture-community-health": a1Val([
        a1Tag("learning-community-circles", {
          isKey: true,
          notes: "Weekly circles (held in target language when possible) build student community and normalize imperfect language use.",
        }),
      ]),
      "culture-q2__culture-facilitator-practices": a5Val(
        "Teachers model cultural humility and frequently share their own language-learning journeys. Classrooms display student-created cultural artifacts and use music, art, and food from Spanish- and French-speaking communities to build a sense of cultural immersion.",
        true,
      ),
      "culture-q4-tools__touchstones-core-values": a5Val(
        "Multilingualism as a superpower · Cultural curiosity · Risk-taking in communication · Respect for all linguistic and cultural backgrounds",
        true,
      ),
      "culture-q4-tools__touchstones-core-commitments": a5Val(
        "We commit to speaking the target language even when it's hard. We celebrate mistakes as part of the learning process. We honor every student's cultural identity and heritage language.",
      ),
    },

    // ── FACILITATOR ROLES & CONFIGURATIONS ──────────────────────────────────
    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", {
          isKey: true,
          notes: "Each section has a single lead teacher — a certified World Languages educator with native or near-native proficiency in the target language.",
        }),
        a1Tag("expanded-adult-supports", {
          notes: "Heritage speaker aides occasionally support specific cultural instruction and conversation practice.",
          secondaries: ["push-in-specialists"],
        }),
      ]),
      "facilitator-q1__fac-background-allocation": a1Val([
        a1Tag("critical-demographic-educators", {
          isKey: true,
          notes: "The department actively recruits educators who share cultural backgrounds with the languages taught, including educators from Spanish- and French-speaking communities.",
          secondaries: ["educators-from-community", "multilingual-educators"],
        }),
      ]),
      "facilitator-q1__fac-ratio": { archetypeA3Ratio: { learners: 22, facilitators: 1, isKey: false } },
      "facilitator-q2-adult__fac-role-definition": a5Val(
        "World Languages teachers are responsible for delivering comprehensible input instruction, facilitating authentic communicative tasks, conducting ACTFL-aligned performance assessments, and maintaining a culturally affirming classroom environment. Spanish teachers manage the Spanish level 1–4 sequence; French teachers manage French 1–4.",
        true,
      ),
      "facilitator-q3-adult-tools__fac-competency-framework": a1Val([
        a1Tag("danielson", {
          isKey: true,
          notes: "Danielson framework used for formal observation and evaluation, with supplementary ACTFL language-specific competencies for World Languages.",
        }),
      ]),
      "facilitator-q3-adult-tools__fac-skills-knowledge-mindsets": a5Val(
        "Teachers must demonstrate: ACTFL-certified proficiency (Advanced or higher), ability to teach in immersive target-language environments, deep cultural knowledge of Spanish- and French-speaking regions, and experience differentiating for heritage speakers alongside novice learners.",
      ),
    },

    // ── COMMUNITY & FAMILY PARTNERSHIPS ─────────────────────────────────────
    partnerships: {
      "partnerships-q1__partnerships-community": a1Val([
        a1Tag("college-continuing-ed-partnerships", {
          isKey: true,
          notes: "Partnership with a local university's language department provides AP Spanish and dual-enrollment French opportunities.",
        }),
        a1Tag("employer-career-partnerships", {
          notes: "Local bilingual businesses and nonprofits host career panels and informational interviews for upper-level language students.",
        }),
      ]),
      "partnerships-q1__partnerships-family": a1Val([
        a1Tag("family-communication-channels", {
          isKey: true,
          notes: "Multilingual family communications sent in English, Spanish, and French. Family newsletter highlights student language milestones.",
        }),
        a1Tag("family-conferencing", {
          notes: "Annual 'Showcase Night' where students present projects in target language to families.",
        }),
      ]),
      "partnerships-q2-adult__partnerships-systems-routines": a1Val([
        a1Tag("forging-maintaining-partnerships", {
          isKey: false,
          notes: "Department head maintains annual relationship-building with university language departments and bilingual community organizations.",
        }),
      ]),
    },

    // ── OPERATIONS, BUDGET & INFRASTRUCTURE ─────────────────────────────────
    ops: {
      "ops-q1__ops-physical-space": a1Val([
        a1Tag("classroom-ambience-visuals", {
          isKey: true,
          notes: "Classrooms feature cultural immersion environments — maps, posters, student work, and authentic realia from Spanish- and French-speaking countries. Target language is the primary language of all classroom signage.",
        }),
        a1Tag("classroom-layout-furniture", {
          notes: "Flexible seating allows rapid transitions between small-group conversation practice and whole-class instruction.",
        }),
      ]),
      "ops-q1__ops-software": a1Val([
        a1Tag("software-lms", {
          isKey: true,
          notes: "Canvas LMS used to assign listening/viewing activities, submit writing compositions, and provide audio feedback.",
        }),
        a1Tag("software-student-learning", {
          isKey: true,
          notes: "Duolingo for Schools and Rosetta Stone supplement in-class instruction for independent vocabulary practice.",
        }),
      ]),
      "ops-q5-tools__ops-hardware": a1Val([
        a1Tag("hardware-students", {
          isKey: true,
          notes: "1:1 student Chromebooks enable access to language learning platforms, authentic media, and digital writing portfolios.",
        }),
      ]),
    },

    // ── CONTINUOUS IMPROVEMENT & DESIGN ─────────────────────────────────────
    improvement: {
      "ci-q1__ci-people-teams": a1Val([
        a1Tag("ci-school-design-lead", {
          isKey: true,
          notes: "The World Languages department head serves as the primary design lead, coordinating curriculum review cycles and proficiency benchmark analyses.",
        }),
        a1Tag("ci-planning-teams", {
          notes: "Annual end-of-year retreat brings together all World Languages teachers to review outcome data and revise instructional plans for the following year.",
        }),
      ]),
      "ci-q1__ci-tuning-practices": a1Val([
        a1Tag("adult-processes-tuning-instructional-coaching", {
          isKey: true,
          notes: "Bi-annual instructional coaching cycles focus on target language use ratio (TL%), comprehensible input delivery, and student speaking time.",
        }),
        a1Tag("adult-processes-tuning-data-inquiry-cycles", {
          isKey: true,
          notes: "Department reviews ACTFL proficiency benchmark data each semester to identify students approaching and below proficiency targets.",
          secondaries: ["adult-processes-tuning-data-inquiry-cycles-pdsa"],
        }),
      ]),
      "ci-q2-tools__ci-design-tools": a1Val([
        a1Tag("ci-design-blueprints", {
          isKey: true,
          notes: "The School Design Blueprint guides annual program review for World Languages, connecting proficiency outcomes to school-wide learning and advancement goals.",
        }),
      ]),
    },
  };
}

// ── Learner profile ────────────────────────────────────────────────────────────

function learnersProfile(): Record<string, unknown> {
  return {
    selections: [
      {
        primaryId: "grade_high_school",
        secondaryIds: ["grade_9", "grade_10", "grade_11", "grade_12"],
        secondaryKeys: {
          grade_9: true,
          grade_10: true,
          grade_11: true,
          grade_12: true,
        },
        isKey: false,
        description: "World Languages serves all high school students grades 9–12 with a 4-year language sequence in Spanish or French.",
      },
      {
        primaryId: "home_language",
        secondaryIds: [],
        isKey: true,
        description: "A significant share of students speak Spanish as a home language; this program honors heritage speakers while serving novice learners side by side.",
      },
      {
        primaryId: "race_ethnicity",
        secondaryIds: [],
        isKey: true,
        description: "Student demographic is majority Latino/Hispanic and White with a growing multilingual population — language learning is designed to affirm all cultural identities.",
      },
      {
        primaryId: "interests_motivations",
        secondaryIds: [],
        isKey: false,
        description: "Students range from heritage speakers motivated by cultural connection to students seeking college credit or travel readiness — both groups are served within the same experience.",
      },
      {
        primaryId: "mandatory_all",
        secondaryIds: [],
        isKey: false,
        description: "World Languages level 1 is mandatory for all 9th grade students. Subsequent levels are open opt-in.",
      },
    ],
  };
}

// ── Adults profile ─────────────────────────────────────────────────────────────

function adultsProfile(): Record<string, unknown> {
  return {
    selections: [
      {
        primaryId: "educators",
        secondaryIds: ["educators_core_courses"],
      },
      {
        primaryId: "instructional_coaches",
        secondaryIds: [],
      },
    ],
    sliceDetail: {
      educators: {
        name: { text: "Ms. Maria Gonzalez (Spanish 1–4), Mr. Jean-Paul Moreau (French 1–4), Ms. Sofia Reyes (Spanish Conversation & AP)", isKey: false },
        incomingSkills: {
          text: "All World Languages educators hold ACTFL Advanced-level proficiency certification in their target language and have 3+ years of classroom experience. Ms. Gonzalez is a heritage Spanish speaker with experience differentiating for multilingual learners. Mr. Moreau lived in France for 4 years and brings authentic cultural context to instruction. Ms. Reyes specializes in Advanced Placement Spanish Language & Culture.",
          isKey: true,
        },
        background: {
          selections: [
            {
              tagId: "single-lead-teacher",
              isKey: true,
              notes: "Each language class has a single certified lead teacher responsible for all instruction and assessment.",
              selectedSecondaries: [],
            },
            {
              tagId: "critical-demographic-educators",
              isKey: true,
              notes: "Active effort to hire educators who share cultural backgrounds with the languages taught.",
              selectedSecondaries: [
                { tagId: "multilingual-educators", isKey: false, notes: "" },
                { tagId: "educators-from-community", isKey: false, notes: "" },
              ],
            },
          ],
        },
        staffing: {
          text: "World Languages staffing is organized by target language rather than grade level. Each teacher maintains a full load of 5 sections within their language. Department head (Ms. Gonzalez) has one reduced section to support curriculum coordination and coaching responsibilities.",
          isKey: false,
        },
        plainLanguage: "Three certified World Languages teachers lead the Spanish and French sequences. All are proficient or native speakers of their target language with deep cultural knowledge.",
      },
      instructional_coaches: {
        name: { text: "Mr. Robert Taylor (Instructional Coach, Humanities & World Languages)", isKey: false },
        incomingSkills: {
          text: "Mr. Taylor has a background in language acquisition and provides coaching on comprehensible input methods, target language ratio monitoring, and culturally responsive instruction.",
          isKey: false,
        },
        staffing: {
          text: "Instructional coach is shared across Humanities and World Languages departments, dedicating approximately 30% of coaching time to World Languages.",
          isKey: false,
        },
      },
    },
    q1PlainText: "World Languages is taught by three dedicated language educators — two for Spanish and one for French — supported by a shared instructional coach.",
  };
}

// ── Subcomponent builder ───────────────────────────────────────────────────────

function buildSubcomponent(
  name: string,
  language: "Spanish" | "French",
): Record<string, unknown> {
  const isSpanish = language === "Spanish";

  const subLeaps = [
    leap(
      "Relevance",
      "H",
      isSpanish
        ? "Spanish instruction connects to students' lived experiences, heritage culture, and real-world professional and civic contexts where Spanish is the medium of communication."
        : "French instruction links to global Francophone contexts — from West Africa to Quebec — giving students authentic reasons to engage with the language beyond the classroom.",
    ),
    leap(
      "Whole-child focus",
      "M",
      isSpanish
        ? "Heritage speakers are honored as whole people whose linguistic identity is an asset. Instruction addresses linguistic confidence alongside skill-building."
        : "French instruction attends to student identity and confidence, recognizing that learning a new language involves vulnerability and cultural identity exploration.",
    ),
    leap(
      "Agency",
      "M",
      isSpanish
        ? "Students choose topics for presentations and essays from a curated list tied to Spanish-speaking cultures, giving them voice in the learning experience."
        : "French students choose their end-of-year cultural research topic, exercising agency in how they connect with the Francophone world.",
    ),
  ];

  const subOutcomes = [
    outcome(
      "World languages",
      "H",
      isSpanish
        ? "The core aim is Spanish proficiency growth — moving all students at least one ACTFL level per year."
        : "The core aim is French proficiency growth — moving all students at least one ACTFL level per year.",
      {
        subSelections: [isSpanish ? "Spanish" : "French"],
        subPriorities: { [isSpanish ? "Spanish" : "French"]: "H" },
        subPrimaries: { [isSpanish ? "Spanish" : "French"]: true },
      },
    ),
    outcome(
      "Relationship skills",
      "M",
      isSpanish
        ? "Spanish class cultivates real communicative relationship skills — students must negotiate meaning, listen actively, and respond to peers entirely in Spanish."
        : "French conversation practice explicitly develops interpersonal communication skills across cultural contexts.",
      {
        subSelections: ["Communication"],
        subPriorities: { Communication: "M" },
      },
    ),
    outcome(
      "Productive mindsets & purpose",
      "M",
      isSpanish
        ? "Students develop a multilingual identity and a growth mindset toward language acquisition — crucial for sustained engagement through years 1–4."
        : "Students build identity as global citizens and Francophiles with a sense of purpose in cross-cultural communication.",
      {
        subSelections: ["Identity & purpose"],
        subPriorities: { "Identity & purpose": "M" },
      },
    ),
  ];

  // Subcomponent-level expert data (focused, not duplicating all parent data)
  const subExpert = {
    learning: {
      "learning-q1__learning-exposure": a1Val([
        a1Tag("learning-exposure-direct-instruction", {
          isKey: true,
          notes: isSpanish
            ? "Targeted mini-lessons on Spanish grammar structures, verb conjugation patterns, and vocabulary sets anchor each class."
            : "Targeted mini-lessons on French phonetics, grammar, and vocabulary are the backbone of each French class period.",
        }),
        a1Tag("learning-exposure-inquiry-based-instruction-indirect-instruction", {
          isKey: true,
          notes: isSpanish
            ? "Authentic Spanish media — podcasts, news clips, literature — used for inductive discovery of grammar and cultural norms."
            : "Authentic Francophone media — RFI podcasts, TV5Monde clips, graphic novels — used for immersive comprehension practice.",
        }),
      ]),
      "learning-q1__learning-practice": a1Val([
        a1Tag("learning-practice-discourse", {
          isKey: true,
          notes: isSpanish
            ? "Partner conversations and fishbowl discussions held exclusively in Spanish build communicative confidence at every proficiency level."
            : "Structured debate and discussion protocols in French develop academic language and interpersonal communication skills.",
        }),
        a1Tag("learning-practice-fluency-practice", {
          isKey: true,
          notes: isSpanish
            ? "Daily Spanish fluency drills using high-frequency word lists and verb conjugation sprints build automaticity."
            : "Daily French listening and speaking fluency activities targeting common phrases, pronunciation, and linking sounds.",
        }),
      ]),
      "learning-q2__learning-pedagogical": a1Val([
        a1Tag("learning-pedagogical-whole-child-supportive-teacher-tone", {
          isKey: true,
          notes: isSpanish
            ? "Spanish teachers explicitly honor heritage speakers' home language as a learning asset rather than a correction target."
            : "French teachers normalize language errors and celebrate risk-taking, creating psychological safety in the target language.",
        }),
      ]),
      "learning-q4-tools__tools-curriculum-type": a1Val([
        a1Tag("tools-curriculum-type-hqim", {
          isKey: true,
          notes: isSpanish
            ? "Pearson Realidades adapted with ACTFL IPA-aligned performance tasks for the Spanish sequence."
            : "Édito and Bien Dit! curricula adapted with authentic Francophone materials for the French sequence.",
        }),
      ]),
    },
    culture: {
      "culture-q4-tools__touchstones-core-values": a5Val(
        isSpanish
          ? "El español como puerta al mundo · Heritage as strength · Comunidad y curiosidad cultural"
          : "Le français, une porte ouverte sur le monde · Curiosité culturelle · Communauté francophone mondiale",
        true,
      ),
    },
    facilitator: {
      "facilitator-q1__fac-classroom-staffing": a1Val([
        a1Tag("single-lead-teacher", {
          isKey: true,
          notes: isSpanish
            ? "Ms. Maria Gonzalez leads Spanish 1–3; Ms. Sofia Reyes leads Spanish 4/AP. Both are heritage or near-native speakers."
            : "Mr. Jean-Paul Moreau leads all French sections (French 1–4). Native speaker with professional and cultural experience in France and West Africa.",
        }),
      ]),
      "facilitator-q2-adult__fac-role-definition": a5Val(
        isSpanish
          ? "Spanish teachers deliver comprehensible input instruction, facilitate Integrated Performance Assessments (IPAs), maintain immersive classroom environments, and support heritage speaker differentiation alongside novice learners."
          : "French teacher delivers comprehensible input instruction across all French levels, conducts ACTFL-aligned performance assessments, facilitates cultural exploration through Francophone media, and differentiates for both novice and intermediate learners.",
        true,
      ),
    },
  };

  const subLearnersProfile = {
    selections: [
      {
        primaryId: "grade_high_school",
        secondaryIds: ["grade_9", "grade_10", "grade_11", "grade_12"],
        isKey: false,
        description: isSpanish
          ? "Spanish serves all grade levels 9–12 in a 4-year proficiency sequence plus AP Spanish Language & Culture."
          : "French serves grades 9–12 in a 4-year proficiency sequence, with a smaller cohort of students selecting French as their language of choice.",
      },
      {
        primaryId: "home_language",
        secondaryIds: [],
        isKey: isSpanish,
        description: isSpanish
          ? "Many Spanish students are heritage speakers for whom Spanish is their home or family language. The program is designed to serve both heritage and novice learners simultaneously."
          : "Some French students have Francophone family backgrounds or lived abroad. Heritage speakers are rare but honored when present.",
      },
      {
        primaryId: "interests_motivations",
        secondaryIds: [],
        isKey: false,
        description: isSpanish
          ? "Student motivations range from family connection and heritage pride to college admission requirements and travel goals."
          : "Students select French for a combination of college requirement fulfillment, cultural interest (particularly in West African and European French contexts), and career goals.",
      },
    ],
  };

  const subAdultsProfile = {
    selections: [{ primaryId: "educators", secondaryIds: ["educators_core_courses"] }],
    sliceDetail: {
      educators: {
        name: {
          text: isSpanish
            ? "Ms. Maria Gonzalez (Spanish 1–3), Ms. Sofia Reyes (Spanish 4 & AP)"
            : "Mr. Jean-Paul Moreau (French 1–4)",
          isKey: false,
        },
        incomingSkills: {
          text: isSpanish
            ? "Ms. Gonzalez is a heritage Spanish speaker from a bilingual household, with 8 years of classroom experience and AP certification. Ms. Reyes holds ACTFL Superior proficiency and is AP Spanish Language & Culture certified."
            : "Mr. Moreau is a native French speaker who lived and worked in Paris and Dakar for 4 years before entering education. He brings firsthand knowledge of Francophone diversity across European and West African contexts.",
          isKey: true,
        },
        staffing: {
          text: isSpanish
            ? "Two teachers share the Spanish program. Ms. Gonzalez teaches levels 1–3 and coordinates the department; Ms. Reyes specializes in levels 4 and AP."
            : "One teacher manages all four French levels. Support from the instructional coach focuses on differentiation strategies for the multi-level French population.",
          isKey: false,
        },
      },
    },
    q1PlainText: isSpanish
      ? "Two experienced Spanish educators lead the Spanish program — a heritage speaker and an AP-certified specialist."
      : "One native French-speaking educator leads all French levels, drawing on deep cultural knowledge of Francophone communities worldwide.",
  };

  return {
    id: genId(),
    name,
    description: isSpanish
      ? "The Spanish subcomponent encompasses Spanish 1–4 and AP Spanish Language & Culture. It serves a broad range of learners — from heritage speakers to novice learners — with differentiated instruction and ACTFL proficiency-based assessment throughout."
      : "The French subcomponent encompasses French 1–4, serving students who choose French as their language of study. Instruction emphasizes Francophone cultural diversity, communicative proficiency, and connection to global French-speaking communities.",
    keyDesignElements: {
      aims: [...subLeaps, ...subOutcomes],
      practices: [],
      supports: [],
    },
    elementsExpertData: subExpert,
    learnersProfile: subLearnersProfile,
    adultsProfile: subAdultsProfile,
    aims: [],
    practices: [],
    supports: [],
  };
}

// ── Main seeding function ──────────────────────────────────────────────────────

async function seedWorldLanguages() {
  console.log("🌍 Seeding World Languages...");

  const existing = await storage.getComponentByNodeId("world_languages");
  if (!existing) {
    console.error("❌ world_languages component not found in DB. Make sure the app has been seeded first.");
    process.exit(1);
  }

  // Build leaps for the parent (World Languages as a whole)
  const parentLeaps = [
    leap(
      "Whole-child focus",
      "H",
      "World Languages places student identity at the center of instruction. Heritage speakers and novice learners alike are treated as whole people whose linguistic and cultural backgrounds are assets, not deficits. The program attends to affective dimensions of language learning — confidence, identity, and belonging — alongside skill development.",
    ),
    leap(
      "Relevance",
      "H",
      "Language learning is grounded in real-world contexts and authentic communication. Students engage with genuine Spanish and French media, literature, and community partners. The program connects to students' existing cultural lives and future civic and professional aspirations as multilingual citizens.",
    ),
    leap(
      "Customization",
      "M",
      "Instruction differentiates for heritage speakers and novice learners within the same classroom. Proficiency-based grouping within classes allows teachers to tailor practice tasks, vocabulary goals, and assessment criteria to each student's starting point and trajectory.",
    ),
    leap(
      "Agency",
      "M",
      "Students exercise choice in how they demonstrate proficiency — through oral presentations, written compositions, or multimodal projects. Elective advanced sections and self-directed vocabulary practice give students voice in their language learning journey.",
    ),
  ];

  // Build outcomes for the parent (World Languages as a whole, covering both Spanish and French)
  const parentOutcomes = [
    outcome(
      "World languages",
      "H",
      "The primary goal of World Languages is measurable proficiency growth in Spanish or French, assessed against ACTFL standards. Students exit the program at Intermediate-Low or higher after 4 years.",
      {
        subSelections: ["Spanish", "French"],
        subPriorities: { Spanish: "H", French: "H" },
        subPrimaries: { Spanish: true, French: true },
      },
    ),
    outcome(
      "Relationship skills",
      "H",
      "Language classes explicitly develop interpersonal communication skills — active listening, negotiating meaning, and collaborative problem-solving — all practiced through the medium of the target language.",
      {
        subSelections: ["Communication", "Collaboration"],
        subPriorities: { Communication: "H", Collaboration: "M" },
      },
    ),
    outcome(
      "Productive mindsets & purpose",
      "M",
      "Students develop multilingual identities and a growth mindset toward language acquisition, understanding that language learning is a lifelong process tied to cultural empathy and global citizenship.",
      {
        subSelections: ["Identity & purpose", "Mindsets & self-regulation"],
        subPriorities: { "Identity & purpose": "M", "Mindsets & self-regulation": "M" },
      },
    ),
    outcome(
      "Higher order thinking skills",
      "M",
      "Analyzing authentic texts, synthesizing cultural information, and producing original target-language content develop critical and creative thinking across the language sequence.",
      {
        subSelections: ["Critical thinking"],
        subPriorities: { "Critical thinking": "M" },
      },
    ),
  ];

  const subcomponents = [
    buildSubcomponent("Spanish", "Spanish"),
    buildSubcomponent("French", "French"),
  ];

  const designedExperienceData = {
    description: "World Languages at this school provides a rigorous, culturally affirming language program in Spanish and French for all high school students. Using ACTFL proficiency standards as the framework, students progress through four levels of study with the option of AP Spanish Language & Culture. The program serves a diverse population including heritage Spanish speakers, novice learners, and students pursuing language study for college readiness and global citizenship.",
    experienceAudience: "learner",
    keyDesignElements: {
      aims: [...parentLeaps, ...parentOutcomes],
      practices: [],
      supports: [],
    },
    elementsExpertData: expertData(),
    subcomponents,
    adultSubcomponents: [],
    learnersProfile: learnersProfile(),
    adultsProfile: adultsProfile(),
  };

  await storage.updateComponent("world_languages", {
    designedExperienceData,
  });

  console.log("✅ World Languages seeded successfully!");
  console.log(`   - ${parentLeaps.length} leaps (parent)`);
  console.log(`   - ${parentOutcomes.length} outcome groups (parent)`);
  console.log(`   - ${subcomponents.length} subcomponents: Spanish, French`);
  console.log("   - elementsExpertData: schedule, learning, culture, facilitator, partnerships, ops, improvement");
  console.log("   - learnersProfile: grade band, home language, race/ethnicity, interests, selection gating");
  console.log("   - adultsProfile: Ms. Maria Gonzalez, Mr. Jean-Paul Moreau, Ms. Sofia Reyes, Mr. Robert Taylor");
}

seedWorldLanguages().catch((err) => {
  console.error("❌ Error seeding World Languages:", err);
  process.exit(1);
});
