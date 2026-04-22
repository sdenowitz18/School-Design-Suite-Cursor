/**
 * Seed health scores for all ring components:
 *   world_languages, student_advisory_seminar, teach_to_one_math,
 *   science, english_language_arts, algebra, extra_curriculars
 *
 * Run with:
 *   npm run seed:scores:ring-components
 *
 * college_exposure is intentionally excluded — it already has health data
 * entered through the UI. Re-run seed:scores:overall for the center node.
 */

import { storage } from "../../server/storage.ts";
import { attachFinalScores } from "./attach-final-scores.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

let _c = 0;
function id() { return `hs_${Date.now()}_${++_c}`; }
const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function inst(actor: string, score: number) {
  return { id: id(), actor, score, asOfDate: TODAY, retired: false };
}

function om(
  name: string,
  subDimensionIds: string[],
  score: number,
  importance: "H" | "M" | "L" = "M",
) {
  return {
    id: id(), name, subDimensionIds,
    importance, confidence: "M" as const, type: "measure" as const,
    instances: [inst("School", score)], skipped: false,
  };
}

type CKey = "Conviction" | "Capacity" | "Clarity" | "Culture" | "Coalition";
type StakeholderGroup = "students" | "families" | "educators_staff" | "admin_district" | "admin_school" | "other_leaders";
function cond(
  description: string,
  direction: "tailwind" | "headwind",
  windStrength: "H" | "M" | "L",
  stakeholderGroups: { group: StakeholderGroup; primary: boolean }[],
  cs: CKey[],
) {
  return {
    id: id(), description, direction, windStrength,
    asOfDate: TODAY, actor: "School",
    stakeholderTags: stakeholderGroups, cs, rationale: "", instances: [],
  };
}

function im(
  name: string,
  subDimensionIds: string[],
  score: number,
  importance: "H" | "M" | "L" = "M",
) {
  return {
    id: id(), name, subDimensionIds,
    importance,
    instances: [inst("School", score)], skipped: false,
  };
}

// ── Shared sub-dimension weight defaults ──────────────────────────────────────

const designWeights = {
  "design-richness-learner-impact": "H" as const,
  "design-completeness-learner-experience": "H" as const,
  "design-quality-learner-leapiness": "M" as const,
  "design-completeness-adult-experience": "M" as const,
  "design-tools-resources": "M" as const,
  "design-coherence-choices": "M" as const,
  "design-alignment-context": "L" as const,
};

const implWeights = {
  "impl-plan-approach": "H" as const,
  "impl-feasibility-sustainability": "H" as const,
  "impl-skillfulness-learner-experience": "H" as const,
  "impl-skill-learner-classroom-delivery-outcomes": "H" as const,
  "impl-skill-learner-inspire-motivate-engagement": "M" as const,
  "impl-students-enrollment-attendance": "M" as const,
  "impl-fidelity-design": "H" as const,
  "impl-fidelity-learner-experience": "H" as const,
  "impl-fidelity-adult-experience": "M" as const,
  "impl-skillfulness-adult-experience": "M" as const,
  "impl-measurement-admin-quality": "L" as const,
};

const expWeights = {
  "exp-leap-whole-child-focus": "H" as const,
  "exp-leap-connection-community": "H" as const,
  "exp-leap-high-expectations-with-rigorous-learning": "H" as const,
  "exp-leap-relevance": "M" as const,
  "exp-leap-customization": "M" as const,
  "exp-leap-agency": "M" as const,
};

// ── Component health data builders ────────────────────────────────────────────

function buildDesignExplicit(measures: ReturnType<typeof im>[]) {
  return { actors: ["School"], measures, overallMeasures: [], subDimensionWeights: designWeights };
}

function buildImplExplicit(measures: ReturnType<typeof im>[]) {
  return { actors: ["School"], measures, overallMeasures: [], subDimensionWeights: implWeights };
}

function buildExpExplicit(measures: ReturnType<typeof om>[]) {
  return { actors: ["School"], measures, overallMeasures: [], subDimensionWeights: expWeights };
}

function buildLAExplicit(
  measures: ReturnType<typeof om>[],
  weights: Record<string, "H"|"M"|"L">,
) {
  return { actors: ["School"], filter: {}, measures, overallMeasures: [], subDimensionWeights: weights };
}

function buildWBExplicit(measures: ReturnType<typeof om>[]) {
  return {
    actors: ["School"], filter: {}, measures, overallMeasures: [],
    subDimensionWeights: {
      "wc-wb-mental": "H" as const, "wc-wb-social": "M" as const,
      "wc-cd-engagement": "M" as const, "wc-cd-behavior": "H" as const,
    },
  };
}

// ── Component definitions ─────────────────────────────────────────────────────

const COMPONENTS: Record<string, {
  designScoreData: any;
  implementationScoreData: any;
  learningAdvancementOutcomeScoreData: any;
  wellbeingConductOutcomeScoreData: any;
  experienceScoreData: any;
}> = {

  // ─── World Languages ────────────────────────────────────────────────────────
  world_languages: {
    designScoreData: buildDesignExplicit([
      im("Richness of language learner impact targets", ["design-richness-learner-impact"], 4, "H"),
      im("Completeness of immersive language experience", ["design-completeness-learner-experience"], 5, "H"),
      im("Leapiness of language learning design", ["design-quality-learner-leapiness"], 3, "M"),
      im("Completeness of educator adult experience", ["design-completeness-adult-experience"], 3, "M"),
      im("Quality of language tools & resources", ["design-tools-resources"], 2, "M"),
      im("Coherence across language modalities", ["design-coherence-choices"], 3, "M"),
      im("Alignment to community linguistic context", ["design-alignment-context"], 1, "L"),
    ]),
    implementationScoreData: buildImplExplicit([
      im("Language program implementation plan", ["impl-plan-approach"], 4, "H"),
      im("Feasibility of language instruction model", ["impl-feasibility-sustainability"], 3, "H"),
      im("Classroom delivery in target language", ["impl-skill-learner-classroom-delivery-outcomes"], 4, "H"),
      im("Inspires engagement & love of language", ["impl-skill-learner-inspire-motivate-engagement"], 5, "M"),
      im("Enrollment in language pathways", ["impl-students-enrollment-attendance"], 3, "M"),
      im("Fidelity to designed language experience", ["impl-fidelity-learner-experience"], 2, "H"),
      im("Fidelity to adult professional learning plan", ["impl-fidelity-adult-experience"], 3, "M"),
      im("Skillfulness of language coaching", ["impl-skillfulness-adult-experience"], 1, "M"),
      im("Language assessment administration quality", ["impl-measurement-admin-quality"], 4, "L"),
    ]),
    learningAdvancementOutcomeScoreData: buildLAExplicit([
      om("World language proficiency (STAMP/OPI)", ["la-arts-lang"], 5, "H"),
      om("Cross-cultural competency", ["la-arts-social"], 3, "M"),
      om("ELA skills applied in target language", ["la-arts-ela"], 3, "M"),
      om("Career readiness in global contexts", ["la-prof-career"], 2, "M"),
      om("Continuing education assets (bilingualism)", ["la-adv-assets"], 4, "H"),
      om("Transitional milestones (seal of biliteracy)", ["la-adv-milestones"], 3, "H"),
    ], {
      "la-arts-lang": "H", "la-arts-social": "M", "la-arts-ela": "M",
      "la-prof-career": "M", "la-adv-assets": "H", "la-adv-milestones": "H",
    }),
    wellbeingConductOutcomeScoreData: buildWBExplicit([
      om("Cultural identity & social wellbeing", ["wc-wb-social"], 4, "H"),
      om("Mental & emotional health indicators", ["wc-wb-mental"], 3, "M"),
      om("Engagement & satisfaction in language class", ["wc-cd-engagement"], 5, "M"),
      om("Attendance & behavior in language cohort", ["wc-cd-behavior"], 1, "H"),
    ]),
    experienceScoreData: buildExpExplicit([
      om("Whole-child focus in language learning", ["exp-leap-whole-child-focus"], 4, "H"),
      om("Connection to global community", ["exp-leap-connection-community"], 5, "H"),
      om("High expectations in language rigor", ["exp-leap-high-expectations-with-rigorous-learning"], 3, "H"),
      om("Relevance of language to student life", ["exp-leap-relevance"], 3, "M"),
      om("Customized language pathway options", ["exp-leap-customization"], 2, "M"),
      om("Student agency in language learning", ["exp-leap-agency"], 1, "M"),
    ]),
    ringConditionsScoreData: {
      actors: ["School"],
      filter: { mode: "none", aggregation: "singleLatest" },
      conditions: [
        cond("Community support for bilingual/multilingual education", "tailwind", "H", [{ group: "families", primary: true }, { group: "students", primary: false }], ["Conviction", "Culture"]),
        cond("Strong educator team committed to language instruction", "tailwind", "H", [{ group: "educators_staff", primary: true }], ["Conviction", "Capacity"]),
        cond("Limited instructional time for language depth", "headwind", "M", [{ group: "admin_school", primary: true }], ["Capacity", "Clarity"]),
        cond("State testing pressure de-prioritizes world languages", "headwind", "M", [{ group: "admin_district", primary: true }], ["Conviction", "Clarity"]),
      ],
    },
  },

  // ─── Student Advisory Seminar ────────────────────────────────────────────────
  student_advisory_seminar: {
    designScoreData: buildDesignExplicit([
      im("Richness of advisory learner impact", ["design-richness-learner-impact"], 3, "H"),
      im("Completeness of advisory experience", ["design-completeness-learner-experience"], 4, "H"),
      im("Leapiness of advisory design", ["design-quality-learner-leapiness"], 5, "M"),
      im("Completeness of advisor adult experience", ["design-completeness-adult-experience"], 3, "M"),
      im("Quality of advisory tools & curriculum", ["design-tools-resources"], 3, "M"),
      im("Coherence across advisory touchpoints", ["design-coherence-choices"], 2, "M"),
      im("Alignment to student needs & context", ["design-alignment-context"], 1, "L"),
    ]),
    implementationScoreData: buildImplExplicit([
      im("Advisory implementation plan & scheduling", ["impl-plan-approach"], 4, "H"),
      im("Feasibility of advisory model at scale", ["impl-feasibility-sustainability"], 3, "H"),
      im("Advisor facilitation quality", ["impl-skill-learner-classroom-delivery-outcomes"], 3, "H"),
      im("Advisor inspires belonging & trust", ["impl-skill-learner-inspire-motivate-engagement"], 5, "M"),
      im("Student participation in advisory", ["impl-students-enrollment-attendance"], 4, "M"),
      im("Fidelity to designed advisory experience", ["impl-fidelity-learner-experience"], 3, "H"),
      im("Fidelity to advisor support structure", ["impl-fidelity-adult-experience"], 2, "M"),
      im("Skillfulness of advisor coaching", ["impl-skillfulness-adult-experience"], 1, "M"),
      im("Advisory measurement & survey quality", ["impl-measurement-admin-quality"], 3, "L"),
    ]),
    learningAdvancementOutcomeScoreData: buildLAExplicit([
      om("Higher-order thinking in advisory", ["la-think-hots"], 3, "M"),
      om("Learning strategies & habits of mind", ["la-think-learning"], 4, "H"),
      om("Relationship skills & conflict resolution", ["la-think-relationship"], 5, "H"),
      om("Productive mindsets & sense of purpose", ["la-think-mindsets"], 3, "M"),
      om("Practical life skills", ["la-prof-practical"], 3, "M"),
      om("College & career navigation knowledge", ["la-prof-nav"], 2, "M"),
      om("Assets for continuing education", ["la-adv-assets"], 1, "H"),
    ], {
      "la-think-hots": "M", "la-think-learning": "H", "la-think-relationship": "H",
      "la-think-mindsets": "M", "la-prof-practical": "M", "la-prof-nav": "M", "la-adv-assets": "H",
    }),
    wellbeingConductOutcomeScoreData: buildWBExplicit([
      om("Mental & emotional health support outcomes", ["wc-wb-mental"], 5, "H"),
      om("Social wellbeing & belonging", ["wc-wb-social"], 4, "H"),
      om("Productive engagement in advisory", ["wc-cd-engagement"], 3, "M"),
      om("Behavior & attendance (advisory cohort)", ["wc-cd-behavior"], 1, "H"),
    ]),
    experienceScoreData: buildExpExplicit([
      om("Whole-child focus in advisory", ["exp-leap-whole-child-focus"], 5, "H"),
      om("Connection & community building", ["exp-leap-connection-community"], 4, "H"),
      om("High expectations in advisory", ["exp-leap-high-expectations-with-rigorous-learning"], 2, "H"),
      om("Relevance of advisory to student goals", ["exp-leap-relevance"], 3, "M"),
      om("Customization in advisory pathways", ["exp-leap-customization"], 3, "M"),
      om("Student agency in advisory", ["exp-leap-agency"], 1, "M"),
    ]),
    ringConditionsScoreData: {
      actors: ["School"],
      filter: { mode: "none", aggregation: "singleLatest" },
      conditions: [
        cond("High student buy-in for advisory model", "tailwind", "H", [{ group: "students", primary: true }], ["Conviction", "Culture"]),
        cond("Counselor/advisor team skilled and committed", "tailwind", "M", [{ group: "educators_staff", primary: true }], ["Capacity", "Conviction"]),
        cond("Advisory seen as non-academic by some families", "headwind", "M", [{ group: "families", primary: true }], ["Conviction", "Clarity"]),
        cond("Scheduling competes with core academic time", "headwind", "H", [{ group: "admin_school", primary: true }], ["Capacity", "Coalition"]),
      ],
    },
  },

  // ─── Teach to One Math ──────────────────────────────────────────────────────
  teach_to_one_math: {
    designScoreData: buildDesignExplicit([
      im("Richness of personalized math impact", ["design-richness-learner-impact"], 5, "H"),
      im("Completeness of adaptive math experience", ["design-completeness-learner-experience"], 4, "H"),
      im("Leapiness of adaptive math model", ["design-quality-learner-leapiness"], 3, "M"),
      im("Completeness of math teacher adult experience", ["design-completeness-adult-experience"], 3, "M"),
      im("Quality of TTM digital tools & resources", ["design-tools-resources"], 4, "M"),
      im("Coherence across math modalities", ["design-coherence-choices"], 3, "M"),
      im("Alignment to student skill levels", ["design-alignment-context"], 1, "L"),
    ]),
    implementationScoreData: buildImplExplicit([
      im("TTM scheduling & implementation plan", ["impl-plan-approach"], 4, "H"),
      im("Feasibility of multi-modal math delivery", ["impl-feasibility-sustainability"], 3, "H"),
      im("Instructor delivery quality (small groups)", ["impl-skill-learner-classroom-delivery-outcomes"], 5, "H"),
      im("Inspires math confidence & engagement", ["impl-skill-learner-inspire-motivate-engagement"], 3, "M"),
      im("Student attendance & participation", ["impl-students-enrollment-attendance"], 4, "M"),
      im("Fidelity to TTM learner experience", ["impl-fidelity-learner-experience"], 2, "H"),
      im("Fidelity to TTM adult experience", ["impl-fidelity-adult-experience"], 1, "M"),
      im("Math coaching skillfulness", ["impl-skillfulness-adult-experience"], 3, "M"),
      im("Math assessment administration quality", ["impl-measurement-admin-quality"], 4, "L"),
    ]),
    learningAdvancementOutcomeScoreData: buildLAExplicit([
      om("Math proficiency growth (TTM adaptive)", ["la-stem-math"], 5, "H"),
      om("Computational thinking & problem solving", ["la-stem-comp-ai"], 3, "M"),
      om("Higher-order math reasoning", ["la-think-hots"], 3, "H"),
      om("Learning strategies in math", ["la-think-learning"], 2, "M"),
      om("Productive math mindsets (growth mindset)", ["la-think-mindsets"], 1, "M"),
      om("Transitional math milestones (Algebra readiness)", ["la-adv-milestones"], 4, "H"),
    ], {
      "la-stem-math": "H", "la-stem-comp-ai": "M", "la-think-hots": "H",
      "la-think-learning": "M", "la-think-mindsets": "M", "la-adv-milestones": "H",
    }),
    wellbeingConductOutcomeScoreData: buildWBExplicit([
      om("Math anxiety & mental health indicators", ["wc-wb-mental"], 3, "H"),
      om("Peer collaboration & social wellbeing", ["wc-wb-social"], 4, "M"),
      om("Productive engagement in math rotations", ["wc-cd-engagement"], 3, "M"),
      om("Attendance & on-task behavior", ["wc-cd-behavior"], 1, "H"),
    ]),
    experienceScoreData: buildExpExplicit([
      om("Whole-child focus in math learning", ["exp-leap-whole-child-focus"], 3, "H"),
      om("Connection through math collaboration", ["exp-leap-connection-community"], 2, "H"),
      om("High expectations in rigorous math", ["exp-leap-high-expectations-with-rigorous-learning"], 5, "H"),
      om("Relevance of math to real world", ["exp-leap-relevance"], 3, "M"),
      om("Customization of math learning path", ["exp-leap-customization"], 4, "M"),
      om("Student agency in math pacing", ["exp-leap-agency"], 1, "M"),
    ]),
    ringConditionsScoreData: {
      actors: ["School"],
      filter: { mode: "none", aggregation: "singleLatest" },
      conditions: [
        cond("EdTech platform (Teach to One) backed by strong vendor support", "tailwind", "H", [{ group: "admin_school", primary: true }, { group: "educators_staff", primary: false }], ["Capacity", "Conviction"]),
        cond("Students respond well to personalized pacing", "tailwind", "H", [{ group: "students", primary: true }], ["Culture", "Conviction"]),
        cond("Some math teachers resistant to non-traditional instruction", "headwind", "M", [{ group: "educators_staff", primary: true }], ["Culture", "Conviction"]),
        cond("Parent concern over departure from grade-level curriculum", "headwind", "M", [{ group: "families", primary: true }], ["Clarity", "Conviction"]),
      ],
    },
  },

  // ─── Science ────────────────────────────────────────────────────────────────
  science: {
    designScoreData: buildDesignExplicit([
      im("Richness of science learner impact", ["design-richness-learner-impact"], 4, "H"),
      im("Completeness of inquiry-based experience", ["design-completeness-learner-experience"], 3, "H"),
      im("Leapiness of science design", ["design-quality-learner-leapiness"], 3, "M"),
      im("Completeness of science teacher PD design", ["design-completeness-adult-experience"], 2, "M"),
      im("Quality of lab & science tools", ["design-tools-resources"], 4, "M"),
      im("Coherence across science disciplines", ["design-coherence-choices"], 3, "M"),
      im("Alignment to community STEM context", ["design-alignment-context"], 1, "L"),
    ]),
    implementationScoreData: buildImplExplicit([
      im("Science program implementation plan", ["impl-plan-approach"], 3, "H"),
      im("Feasibility of lab-based model", ["impl-feasibility-sustainability"], 4, "H"),
      im("Teacher delivery of inquiry lessons", ["impl-skill-learner-classroom-delivery-outcomes"], 4, "H"),
      im("Inspires curiosity & scientific thinking", ["impl-skill-learner-inspire-motivate-engagement"], 5, "M"),
      im("Enrollment in science pathways", ["impl-students-enrollment-attendance"], 3, "M"),
      im("Fidelity to inquiry-based experience", ["impl-fidelity-learner-experience"], 3, "H"),
      im("Fidelity to science PD structure", ["impl-fidelity-adult-experience"], 2, "M"),
      im("Skillfulness of science coaching", ["impl-skillfulness-adult-experience"], 1, "M"),
      im("Science assessment quality", ["impl-measurement-admin-quality"], 4, "L"),
    ]),
    learningAdvancementOutcomeScoreData: buildLAExplicit([
      om("Science proficiency (NGSS-aligned)", ["la-stem-science"], 4, "H"),
      om("Computational & data literacy in science", ["la-stem-comp-ai"], 3, "M"),
      om("Math applied to science contexts", ["la-stem-math"], 3, "M"),
      om("Higher-order scientific reasoning", ["la-think-hots"], 5, "H"),
      om("Learning strategies in science", ["la-think-learning"], 2, "M"),
      om("Career readiness in STEM fields", ["la-prof-career"], 1, "M"),
      om("Assets for STEM continuing education", ["la-adv-assets"], 4, "H"),
    ], {
      "la-stem-science": "H", "la-stem-comp-ai": "M", "la-stem-math": "M",
      "la-think-hots": "H", "la-think-learning": "M", "la-prof-career": "M", "la-adv-assets": "H",
    }),
    wellbeingConductOutcomeScoreData: buildWBExplicit([
      om("Mental health & science identity", ["wc-wb-mental"], 3, "H"),
      om("Collaboration & social wellbeing in labs", ["wc-wb-social"], 4, "M"),
      om("Productive engagement in science", ["wc-cd-engagement"], 3, "M"),
      om("Behavior & attendance (science cohort)", ["wc-cd-behavior"], 1, "H"),
    ]),
    experienceScoreData: buildExpExplicit([
      om("Whole-child in science exploration", ["exp-leap-whole-child-focus"], 3, "H"),
      om("Community connection through science", ["exp-leap-connection-community"], 4, "H"),
      om("High expectations in rigorous science", ["exp-leap-high-expectations-with-rigorous-learning"], 5, "H"),
      om("Relevance of science to real-world issues", ["exp-leap-relevance"], 3, "M"),
      om("Customized science pathways", ["exp-leap-customization"], 3, "M"),
      om("Student agency in science inquiry", ["exp-leap-agency"], 1, "M"),
    ]),
    ringConditionsScoreData: {
      actors: ["School"],
      filter: { mode: "none", aggregation: "singleLatest" },
      conditions: [
        cond("NGSS adoption creates strong curricular anchor", "tailwind", "H", [{ group: "admin_district", primary: true }, { group: "educators_staff", primary: false }], ["Clarity", "Conviction"]),
        cond("Science teachers energized by inquiry-based model", "tailwind", "H", [{ group: "educators_staff", primary: true }], ["Culture", "Conviction"]),
        cond("Lab facilities and materials underfunded", "headwind", "H", [{ group: "admin_district", primary: true }], ["Capacity"]),
        cond("Limited time for deep project-based science work", "headwind", "M", [{ group: "admin_school", primary: true }, { group: "educators_staff", primary: false }], ["Capacity", "Clarity"]),
      ],
    },
  },

  // ─── English Language Arts ──────────────────────────────────────────────────
  english_language_arts: {
    designScoreData: buildDesignExplicit([
      im("Richness of literacy learner impact", ["design-richness-learner-impact"], 5, "H"),
      im("Completeness of literacy experience", ["design-completeness-learner-experience"], 4, "H"),
      im("Leapiness of ELA design", ["design-quality-learner-leapiness"], 3, "M"),
      im("Completeness of ELA teacher PD design", ["design-completeness-adult-experience"], 3, "M"),
      im("Quality of literacy tools & texts", ["design-tools-resources"], 3, "M"),
      im("Coherence across reading/writing/speaking", ["design-coherence-choices"], 2, "M"),
      im("Alignment to student cultural context", ["design-alignment-context"], 1, "L"),
    ]),
    implementationScoreData: buildImplExplicit([
      im("ELA implementation plan", ["impl-plan-approach"], 4, "H"),
      im("Feasibility of workshop model", ["impl-feasibility-sustainability"], 3, "H"),
      im("Teacher delivery of reading/writing lessons", ["impl-skill-learner-classroom-delivery-outcomes"], 4, "H"),
      im("Inspires love of reading & expression", ["impl-skill-learner-inspire-motivate-engagement"], 5, "M"),
      im("Student participation in ELA", ["impl-students-enrollment-attendance"], 4, "M"),
      im("Fidelity to designed literacy experience", ["impl-fidelity-learner-experience"], 2, "H"),
      im("Fidelity to ELA adult PD structure", ["impl-fidelity-adult-experience"], 1, "M"),
      im("Skillfulness of ELA coaching", ["impl-skillfulness-adult-experience"], 3, "M"),
      im("ELA assessment administration quality", ["impl-measurement-admin-quality"], 3, "L"),
    ]),
    learningAdvancementOutcomeScoreData: buildLAExplicit([
      om("Reading proficiency & comprehension", ["la-arts-ela"], 5, "H"),
      om("Writing quality & expression", ["la-arts-ela"], 4, "H"),
      om("Social studies & civics literacy", ["la-arts-social"], 3, "M"),
      om("Higher-order literary analysis", ["la-think-hots"], 3, "H"),
      om("Learning strategies & reading habits", ["la-think-learning"], 2, "M"),
      om("Relationship skills through discussion", ["la-think-relationship"], 3, "M"),
      om("Assets for college writing & reading", ["la-adv-assets"], 1, "H"),
    ], {
      "la-arts-ela": "H", "la-arts-social": "M", "la-think-hots": "H",
      "la-think-learning": "M", "la-think-relationship": "M", "la-adv-assets": "H",
    }),
    wellbeingConductOutcomeScoreData: buildWBExplicit([
      om("Reading identity & mental health", ["wc-wb-mental"], 4, "H"),
      om("Social wellbeing through ELA discussion", ["wc-wb-social"], 3, "M"),
      om("Productive engagement in literacy", ["wc-cd-engagement"], 4, "M"),
      om("Attendance & behavior (ELA cohort)", ["wc-cd-behavior"], 1, "H"),
    ]),
    experienceScoreData: buildExpExplicit([
      om("Whole-child focus in literacy", ["exp-leap-whole-child-focus"], 4, "H"),
      om("Community connection through storytelling", ["exp-leap-connection-community"], 5, "H"),
      om("High expectations in rigorous ELA", ["exp-leap-high-expectations-with-rigorous-learning"], 3, "H"),
      om("Relevance of texts to student lives", ["exp-leap-relevance"], 3, "M"),
      om("Customized reading & writing choices", ["exp-leap-customization"], 2, "M"),
      om("Student agency in ELA", ["exp-leap-agency"], 1, "M"),
    ]),
    ringConditionsScoreData: {
      actors: ["School"],
      filter: { mode: "none", aggregation: "singleLatest" },
      conditions: [
        cond("Rich literary culture championed by department", "tailwind", "H", [{ group: "educators_staff", primary: true }], ["Culture", "Conviction"]),
        cond("Students engaged with diverse and relevant texts", "tailwind", "M", [{ group: "students", primary: true }], ["Culture", "Conviction"]),
        cond("Writing achievement gaps across student subgroups", "headwind", "H", [{ group: "admin_school", primary: true }, { group: "admin_district", primary: false }], ["Clarity", "Coalition"]),
        cond("Limited planning time for interdisciplinary ELA integration", "headwind", "M", [{ group: "educators_staff", primary: true }], ["Capacity", "Clarity"]),
      ],
    },
  },

  // ─── Algebra ────────────────────────────────────────────────────────────────
  algebra: {
    designScoreData: buildDesignExplicit([
      im("Richness of algebra learner impact", ["design-richness-learner-impact"], 4, "H"),
      im("Completeness of algebra experience", ["design-completeness-learner-experience"], 4, "H"),
      im("Leapiness of algebra design", ["design-quality-learner-leapiness"], 3, "M"),
      im("Completeness of algebra teacher PD design", ["design-completeness-adult-experience"], 2, "M"),
      im("Quality of algebra tools & resources", ["design-tools-resources"], 3, "M"),
      im("Coherence across algebra units", ["design-coherence-choices"], 3, "M"),
      im("Alignment to student math readiness", ["design-alignment-context"], 1, "L"),
    ]),
    implementationScoreData: buildImplExplicit([
      im("Algebra implementation plan", ["impl-plan-approach"], 4, "H"),
      im("Feasibility of algebra course model", ["impl-feasibility-sustainability"], 3, "H"),
      im("Teacher delivery of algebra instruction", ["impl-skill-learner-classroom-delivery-outcomes"], 4, "H"),
      im("Inspires algebraic thinking & confidence", ["impl-skill-learner-inspire-motivate-engagement"], 3, "M"),
      im("Enrollment & attendance in algebra", ["impl-students-enrollment-attendance"], 5, "M"),
      im("Fidelity to designed algebra experience", ["impl-fidelity-learner-experience"], 3, "H"),
      im("Fidelity to algebra teacher PD", ["impl-fidelity-adult-experience"], 2, "M"),
      im("Skillfulness of math coaching (algebra)", ["impl-skillfulness-adult-experience"], 1, "M"),
      im("Algebra assessment administration", ["impl-measurement-admin-quality"], 4, "L"),
    ]),
    learningAdvancementOutcomeScoreData: buildLAExplicit([
      om("Algebra proficiency (state assessment)", ["la-stem-math"], 5, "H"),
      om("Algebraic reasoning & problem solving", ["la-think-hots"], 4, "H"),
      om("Math learning strategies & habits", ["la-think-learning"], 3, "M"),
      om("Productive math mindsets", ["la-think-mindsets"], 2, "M"),
      om("Readiness for advanced math (geometry/pre-calc)", ["la-adv-milestones"], 3, "H"),
      om("STEM career knowledge & skills", ["la-prof-career"], 1, "M"),
    ], {
      "la-stem-math": "H", "la-think-hots": "H", "la-think-learning": "M",
      "la-think-mindsets": "M", "la-adv-milestones": "H", "la-prof-career": "M",
    }),
    wellbeingConductOutcomeScoreData: buildWBExplicit([
      om("Math anxiety & mental health", ["wc-wb-mental"], 3, "H"),
      om("Peer collaboration in algebra", ["wc-wb-social"], 4, "M"),
      om("Engagement & satisfaction in algebra", ["wc-cd-engagement"], 3, "M"),
      om("Attendance & behavior (algebra cohort)", ["wc-cd-behavior"], 1, "H"),
    ]),
    experienceScoreData: buildExpExplicit([
      om("Whole-child in algebra learning", ["exp-leap-whole-child-focus"], 3, "H"),
      om("Collaboration & community in math", ["exp-leap-connection-community"], 3, "H"),
      om("High expectations in algebra rigor", ["exp-leap-high-expectations-with-rigorous-learning"], 5, "H"),
      om("Relevance of algebra to real contexts", ["exp-leap-relevance"], 3, "M"),
      om("Customization in algebra pacing", ["exp-leap-customization"], 2, "M"),
      om("Student agency in algebra", ["exp-leap-agency"], 1, "M"),
    ]),
    ringConditionsScoreData: {
      actors: ["School"],
      filter: { mode: "none", aggregation: "singleLatest" },
      conditions: [
        cond("Strong math instructional coaching capacity", "tailwind", "H", [{ group: "educators_staff", primary: true }, { group: "admin_school", primary: false }], ["Capacity", "Conviction"]),
        cond("District pushing algebra access for all students", "tailwind", "M", [{ group: "admin_district", primary: true }], ["Conviction", "Coalition"]),
        cond("Persistent math achievement gaps among subgroups", "headwind", "H", [{ group: "admin_school", primary: true }, { group: "admin_district", primary: false }], ["Clarity", "Coalition"]),
        cond("Student math anxiety reduces engagement", "headwind", "M", [{ group: "students", primary: true }], ["Culture", "Conviction"]),
      ],
    },
  },

  // ─── Extra Curriculars ──────────────────────────────────────────────────────
  extra_curriculars: {
    designScoreData: buildDesignExplicit([
      im("Richness of EC learner impact design", ["design-richness-learner-impact"], 3, "H"),
      im("Completeness of EC learner experience", ["design-completeness-learner-experience"], 4, "H"),
      im("Leapiness of EC design", ["design-quality-learner-leapiness"], 5, "M"),
      im("Completeness of EC adult facilitator design", ["design-completeness-adult-experience"], 3, "M"),
      im("Quality of EC tools & activity resources", ["design-tools-resources"], 3, "M"),
      im("Coherence across EC offerings", ["design-coherence-choices"], 2, "M"),
      im("Alignment to student interest & context", ["design-alignment-context"], 1, "L"),
    ]),
    implementationScoreData: buildImplExplicit([
      im("EC scheduling & implementation plan", ["impl-plan-approach"], 4, "H"),
      im("Feasibility of EC portfolio model", ["impl-feasibility-sustainability"], 4, "H"),
      im("Facilitator delivery quality", ["impl-skill-learner-classroom-delivery-outcomes"], 3, "H"),
      im("Inspires passion & belonging", ["impl-skill-learner-inspire-motivate-engagement"], 5, "M"),
      im("Student participation in EC", ["impl-students-enrollment-attendance"], 4, "M"),
      im("Fidelity to designed EC experience", ["impl-fidelity-learner-experience"], 3, "H"),
      im("Fidelity to facilitator support plan", ["impl-fidelity-adult-experience"], 2, "M"),
      im("Skillfulness of EC coaching", ["impl-skillfulness-adult-experience"], 1, "M"),
      im("EC measurement quality", ["impl-measurement-admin-quality"], 3, "L"),
    ]),
    learningAdvancementOutcomeScoreData: buildLAExplicit([
      om("Performing & visual arts skills", ["la-arts-performing"], 4, "M"),
      om("Physical & athletic skills", ["la-prof-physical"], 3, "M"),
      om("Relationship & leadership skills", ["la-think-relationship"], 5, "H"),
      om("Practical life skills through EC", ["la-prof-practical"], 3, "M"),
      om("Productive mindsets & purpose through EC", ["la-think-mindsets"], 3, "M"),
      om("Career-specific skills (clubs & activities)", ["la-prof-career"], 1, "M"),
    ], {
      "la-arts-performing": "M", "la-prof-physical": "M", "la-think-relationship": "H",
      "la-prof-practical": "M", "la-think-mindsets": "M", "la-prof-career": "M",
    }),
    wellbeingConductOutcomeScoreData: buildWBExplicit([
      om("Physical health through athletics & activities", ["wc-wb-mental"], 4, "H"),
      om("Social wellbeing & belonging in EC", ["wc-wb-social"], 5, "H"),
      om("Productive engagement & satisfaction", ["wc-cd-engagement"], 3, "M"),
      om("Attendance & behavior in EC", ["wc-cd-behavior"], 1, "H"),
    ]),
    experienceScoreData: buildExpExplicit([
      om("Whole-child through EC activities", ["exp-leap-whole-child-focus"], 5, "H"),
      om("Community & connection through EC", ["exp-leap-connection-community"], 4, "H"),
      om("High expectations in EC pursuits", ["exp-leap-high-expectations-with-rigorous-learning"], 2, "H"),
      om("Relevance of EC to student passions", ["exp-leap-relevance"], 4, "M"),
      om("Customization of EC choices", ["exp-leap-customization"], 3, "M"),
      om("Student agency in EC selection", ["exp-leap-agency"], 1, "M"),
    ]),
    ringConditionsScoreData: {
      actors: ["School"],
      filter: { mode: "none", aggregation: "singleLatest" },
      conditions: [
        cond("High student enthusiasm and participation in EC programs", "tailwind", "H", [{ group: "students", primary: true }], ["Culture", "Conviction"]),
        cond("Family support for student EC involvement", "tailwind", "M", [{ group: "families", primary: true }], ["Coalition", "Culture"]),
        cond("Limited funding and staffing for EC program expansion", "headwind", "H", [{ group: "admin_district", primary: true }, { group: "admin_school", primary: false }], ["Capacity", "Coalition"]),
        cond("Transportation barriers limit after-school participation", "headwind", "M", [{ group: "students", primary: true }, { group: "families", primary: false }], ["Capacity", "Clarity"]),
      ],
    },
  },
};

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  const nodeIds = Object.keys(COMPONENTS);
  console.log(`Seeding health scores for ${nodeIds.length} ring components…\n`);

  const allComponents = await storage.getComponents();

  for (const nodeId of nodeIds) {
    const existing = await storage.getComponentByNodeId(nodeId);
    if (!existing) {
      console.warn(`  ⚠ '${nodeId}' not found — skipping.`);
      continue;
    }
    const existingHealth: any = (existing.healthData as any) || {};
    const nextHealth: Record<string, unknown> = {
      ...existingHealth,
      ...COMPONENTS[nodeId],
    };
    attachFinalScores(nextHealth, allComponents);
    await storage.updateComponent(nodeId, {
      healthData: nextHealth,
    });
    console.log(`  ✓ ${nodeId}`);
  }

  console.log("\nDone. Open each ring component's Status & Health to see measures and flags.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
