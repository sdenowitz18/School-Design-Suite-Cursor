/**
 * Seed health scores (measures + instances) for the "overall" component
 * across all five scored dimensions: Design, Implementation, Learning &
 * Advancement Outcomes, Wellbeing & Conduct Outcomes, and Experience.
 *
 * Scores are intentionally spread so that some measures are ≥2 points above
 * the overall dimension score (→ excellence flag) and some ≥2 points below
 * (→ concern flag), giving immediate visual feedback in Status & Health.
 *
 * Run with:
 *   node --env-file=.env --import tsx/esm scripts/seed-health-scores.ts
 */

import { storage } from "../../server/storage.ts";
import { attachFinalScores } from "./attach-final-scores.ts";

// ── ID helpers ────────────────────────────────────────────────────────────────

let _counter = 0;
function genId(): string {
  return `hs_${Date.now()}_${++_counter}`;
}

const d = new Date();
const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function inst(actor: string, score: number) {
  return {
    id: genId(),
    actor,
    score,
    asOfDate: TODAY,
    retired: false,
  };
}

// Outcome-style measure (Learning/Advancement, Wellbeing/Conduct, Experience)
function outcomeMeasure(
  name: string,
  subDimensionIds: string[],
  score: number,
  opts: { importance?: "H" | "M" | "L"; confidence?: "H" | "M" | "L"; type?: "measure" | "perception" } = {},
) {
  return {
    id: genId(),
    name,
    subDimensionIds,
    importance: opts.importance ?? "M",
    confidence: opts.confidence ?? "M",
    type: opts.type ?? "measure",
    instances: [inst("School", score)],
    skipped: false,
  };
}

// Condition helper
type CKey = "Conviction" | "Capacity" | "Clarity" | "Culture" | "Coalition";
type StakeholderGroup = "students" | "families" | "educators_staff" | "admin_district" | "admin_school" | "other_leaders";
function condition(
  description: string,
  direction: "tailwind" | "headwind",
  windStrength: "H" | "M" | "L",
  stakeholderGroups: { group: StakeholderGroup; primary: boolean }[],
  cs: CKey[],
) {
  return {
    id: genId(),
    description,
    direction,
    windStrength,
    asOfDate: TODAY,
    actor: "School",
    stakeholderTags: stakeholderGroups,
    cs,
    rationale: "",
    instances: [],
  };
}

// Design / Implementation style measure (single importance weight, no confidence field)
function implMeasure(
  name: string,
  subDimensionIds: string[],
  score: number,
  importance: "H" | "M" | "L" = "M",
) {
  return {
    id: genId(),
    name,
    subDimensionIds,
    importance,
    instances: [inst("School", score)],
    skipped: false,
  };
}

// ── Design Score Data ─────────────────────────────────────────────────────────
// Seven sub-dimensions, one measure each. Targeted overall ≈ 3.
// Scores: 5, 4, 3, 3, 3, 2, 1 → 5 & 1 will flag (±2 from overall ~3).

const designScoreData = {
  actors: ["School"],
  measures: [
    implMeasure(
      "Richness of learner impact targets",
      ["design-richness-learner-impact"],
      5,
      "H",
    ),
    implMeasure(
      "Completeness of designed learner experience",
      ["design-completeness-learner-experience"],
      4,
      "H",
    ),
    implMeasure(
      "Leapiness of the designed experience",
      ["design-quality-learner-leapiness"],
      3,
      "M",
    ),
    implMeasure(
      "Completeness of designed adult experience",
      ["design-completeness-adult-experience"],
      3,
      "M",
    ),
    implMeasure(
      "Quality of tools & resources",
      ["design-tools-resources"],
      3,
      "M",
    ),
    implMeasure(
      "Coherence of design choices",
      ["design-coherence-choices"],
      2,
      "M",
    ),
    implMeasure(
      "Alignment to community context",
      ["design-alignment-context"],
      1,
      "L",
    ),
  ],
  overallMeasures: [],
  subDimensionWeights: {
    "design-richness-learner-impact": "H",
    "design-completeness-learner-experience": "H",
    "design-quality-learner-leapiness": "M",
    "design-completeness-adult-experience": "M",
    "design-tools-resources": "M",
    "design-coherence-choices": "M",
    "design-alignment-context": "L",
  },
};

// ── Implementation Score Data ─────────────────────────────────────────────────
// Nine leaf nodes (child-level IDs used for the two tops that have children).
// Targeted overall ≈ 3. Scores spread so 5 & 1 will flag.

const implementationScoreData = {
  actors: ["School"],
  measures: [
    implMeasure(
      "Implementation plan quality",
      ["impl-plan-approach"],
      4,
      "H",
    ),
    implMeasure(
      "Perceived feasibility & sustainability",
      ["impl-feasibility-sustainability"],
      5,
      "H",
    ),
    implMeasure(
      "Classroom delivery & instructional outcomes",
      ["impl-skill-learner-classroom-delivery-outcomes"],
      3,
      "H",
    ),
    implMeasure(
      "Inspires & motivates learners",
      ["impl-skill-learner-inspire-motivate-engagement"],
      3,
      "M",
    ),
    implMeasure(
      "Student enrollment & attendance vs. targets",
      ["impl-students-enrollment-attendance"],
      3,
      "M",
    ),
    implMeasure(
      "Fidelity to designed learner experience",
      ["impl-fidelity-learner-experience"],
      2,
      "H",
    ),
    implMeasure(
      "Fidelity to designed adult experience",
      ["impl-fidelity-adult-experience"],
      1,
      "M",
    ),
    implMeasure(
      "Skillfulness of facilitating adult experience",
      ["impl-skillfulness-adult-experience"],
      3,
      "M",
    ),
    implMeasure(
      "Measurement administration quality",
      ["impl-measurement-admin-quality"],
      4,
      "L",
    ),
  ],
  overallMeasures: [],
  subDimensionWeights: {
    "impl-plan-approach": "H",
    "impl-feasibility-sustainability": "H",
    "impl-skillfulness-learner-experience": "H",
    "impl-skill-learner-classroom-delivery-outcomes": "H",
    "impl-skill-learner-inspire-motivate-engagement": "M",
    "impl-students-enrollment-attendance": "M",
    "impl-fidelity-design": "H",
    "impl-fidelity-learner-experience": "H",
    "impl-fidelity-adult-experience": "M",
    "impl-skillfulness-adult-experience": "M",
    "impl-measurement-admin-quality": "L",
  },
};

// ── Learning & Advancement Outcome Score Data ─────────────────────────────────
// One measure per L2 sub-dimension across all five L1 groups.
// Targeted overall ≈ 3. 5s and 1s will flag.

const learningAdvancementOutcomeScoreData = {
  actors: ["School"],
  filter: {},
  measures: [
    // STEM
    outcomeMeasure("Math proficiency (state assessment)", ["la-stem-math"], 4, { importance: "H" }),
    outcomeMeasure("Science performance", ["la-stem-science"], 3, { importance: "M" }),
    outcomeMeasure("Computational & AI literacy", ["la-stem-comp-ai"], 2, { importance: "L" }),

    // Arts & Humanities
    outcomeMeasure("Reading & writing proficiency (ELA)", ["la-arts-ela"], 5, { importance: "H" }),
    outcomeMeasure("Social studies & civics knowledge", ["la-arts-social"], 3, { importance: "M" }),
    outcomeMeasure("World language proficiency", ["la-arts-lang"], 3, { importance: "L" }),
    outcomeMeasure("Performing & visual arts skill", ["la-arts-performing"], 1, { importance: "L" }),

    // Thinking & Relating
    outcomeMeasure("Higher-order thinking skills", ["la-think-hots"], 4, { importance: "H" }),
    outcomeMeasure("Learning strategies & habits", ["la-think-learning"], 3, { importance: "M" }),
    outcomeMeasure("Relationship skills", ["la-think-relationship"], 3, { importance: "M" }),
    outcomeMeasure("Productive mindsets & purpose", ["la-think-mindsets"], 2, { importance: "M" }),

    // Professional & Practical
    outcomeMeasure("Practical life skills", ["la-prof-practical"], 3, { importance: "M" }),
    outcomeMeasure("Career-specific knowledge & skills", ["la-prof-career"], 4, { importance: "M" }),
    outcomeMeasure("Career & continuing-ed navigation", ["la-prof-nav"], 3, { importance: "M" }),
    outcomeMeasure("Physical & athletic skills", ["la-prof-physical"], 1, { importance: "L" }),

    // Advancement
    outcomeMeasure("Assets for continuing education & life", ["la-adv-assets"], 4, { importance: "H" }),
    outcomeMeasure("Transitional milestones achieved", ["la-adv-milestones"], 3, { importance: "H" }),
  ],
  overallMeasures: [],
  subDimensionWeights: {
    "la-stem-math": "H",
    "la-stem-science": "M",
    "la-stem-comp-ai": "L",
    "la-arts-ela": "H",
    "la-arts-social": "M",
    "la-arts-lang": "L",
    "la-arts-performing": "L",
    "la-think-hots": "H",
    "la-think-learning": "M",
    "la-think-relationship": "M",
    "la-think-mindsets": "M",
    "la-prof-practical": "M",
    "la-prof-career": "M",
    "la-prof-nav": "M",
    "la-prof-physical": "L",
    "la-adv-assets": "H",
    "la-adv-milestones": "H",
  },
};

// ── Wellbeing & Conduct Outcome Score Data ────────────────────────────────────
// Four L2 sub-dimensions. Targeted overall ≈ 3. 5 & 1 will flag.

const wellbeingConductOutcomeScoreData = {
  actors: ["School"],
  filter: {},
  measures: [
    // Wellbeing
    outcomeMeasure("Mental & physical health indicators", ["wc-wb-mental"], 5, { importance: "H" }),
    outcomeMeasure("Social wellbeing & sense of belonging", ["wc-wb-social"], 3, { importance: "M" }),

    // Conduct
    outcomeMeasure("Productive engagement & student satisfaction", ["wc-cd-engagement"], 3, { importance: "M" }),
    outcomeMeasure("Behavior incidents & attendance rate", ["wc-cd-behavior"], 1, { importance: "H" }),
  ],
  overallMeasures: [],
  subDimensionWeights: {
    "wc-wb-mental": "H",
    "wc-wb-social": "M",
    "wc-cd-engagement": "M",
    "wc-cd-behavior": "H",
  },
};

// ── Experience Score Data ─────────────────────────────────────────────────────
// Six canonical Leap sub-dimension IDs (fixed, label-based slugs).
// Targeted overall ≈ 3. 5 & 1 will flag.

const experienceScoreData = {
  actors: ["School"],
  measures: [
    outcomeMeasure(
      "Whole-child focus quality of experience",
      ["exp-leap-whole-child-focus"],
      5,
      { importance: "H" },
    ),
    outcomeMeasure(
      "Connection & community quality of experience",
      ["exp-leap-connection-community"],
      4,
      { importance: "H" },
    ),
    outcomeMeasure(
      "High expectations & rigorous learning quality",
      ["exp-leap-high-expectations-with-rigorous-learning"],
      3,
      { importance: "H" },
    ),
    outcomeMeasure(
      "Relevance quality of experience",
      ["exp-leap-relevance"],
      3,
      { importance: "M" },
    ),
    outcomeMeasure(
      "Customization quality of experience",
      ["exp-leap-customization"],
      2,
      { importance: "M" },
    ),
    outcomeMeasure(
      "Agency quality of experience",
      ["exp-leap-agency"],
      1,
      { importance: "M" },
    ),
  ],
  overallMeasures: [],
  subDimensionWeights: {
    "exp-leap-whole-child-focus": "H",
    "exp-leap-connection-community": "H",
    "exp-leap-high-expectations-with-rigorous-learning": "H",
    "exp-leap-relevance": "M",
    "exp-leap-customization": "M",
    "exp-leap-agency": "M",
  },
};

// ── Conditions Score Data ─────────────────────────────────────────────────────
// Mix of tailwinds and headwinds across stakeholder groups and 5Cs.
// The calculateRingConditionsSum scoring: tailwind H=4, M=2, L=1 / headwind negates.

const ringConditionsScoreData = {
  actors: ["School"],
  filter: { mode: "none", aggregation: "singleLatest" },
  conditions: [
    // Tailwinds
    condition(
      "Strong principal sponsorship for innovation agenda",
      "tailwind", "H",
      [{ group: "admin_school", primary: true }, { group: "admin_district", primary: false }],
      ["Conviction", "Coalition"],
    ),
    condition(
      "District leadership supportive of school design autonomy",
      "tailwind", "H",
      [{ group: "admin_district", primary: true }],
      ["Conviction", "Capacity"],
    ),
    condition(
      "High student enthusiasm for personalized learning",
      "tailwind", "M",
      [{ group: "students", primary: true }],
      ["Culture", "Conviction"],
    ),
    condition(
      "Families actively engaged in school design process",
      "tailwind", "M",
      [{ group: "families", primary: true }],
      ["Coalition", "Culture"],
    ),
    condition(
      "Educator core team deeply aligned to model",
      "tailwind", "H",
      [{ group: "educators_staff", primary: true }],
      ["Conviction", "Clarity"],
    ),
    // Headwinds
    condition(
      "Scheduling constraints limit extended learning blocks",
      "headwind", "H",
      [{ group: "admin_school", primary: true }, { group: "educators_staff", primary: false }],
      ["Capacity", "Clarity"],
    ),
    condition(
      "Subset of staff skeptical of departure from traditional model",
      "headwind", "M",
      [{ group: "educators_staff", primary: true }],
      ["Culture", "Conviction"],
    ),
    condition(
      "Budget constraints limiting technology and staffing",
      "headwind", "H",
      [{ group: "admin_district", primary: true }, { group: "admin_school", primary: false }],
      ["Capacity"],
    ),
    condition(
      "State accountability testing pressure creates tension with design",
      "headwind", "M",
      [{ group: "admin_district", primary: true }],
      ["Clarity", "Conviction"],
    ),
  ],
};

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding health scores for 'overall'…");

  const existing = await storage.getComponentByNodeId("overall");
  if (!existing) {
    console.error("Component 'overall' not found. Run the default seed first (npm run seed).");
    process.exit(1);
  }

  const existingHealth: any = (existing.healthData as any) || {};
  const allComponents = await storage.getComponents();

  const nextHealth: Record<string, unknown> = {
    ...existingHealth,
    designScoreData,
    implementationScoreData,
    learningAdvancementOutcomeScoreData,
    wellbeingConductOutcomeScoreData,
    experienceScoreData,
    ringConditionsScoreData,
  };
  attachFinalScores(nextHealth, allComponents);

  await storage.updateComponent("overall", {
    healthData: nextHealth,
  });

  console.log("Done. Open Status & Health for 'overall' to see measures and flags.");
  console.log("");
  console.log("Expected flags (2-point delta from overall dimension score):");
  console.log("  Design          — Excellence: Richness (5)  |  Concern: Alignment (1)");
  console.log("  Implementation  — Excellence: Feasibility (5)  |  Concern: Fidelity adult (1)");
  console.log("  L&A Outcomes    — Excellence: ELA (5)  |  Concern: Arts (1), Physical (1)");
  console.log("  Wellbeing       — Excellence: Mental health (5)  |  Concern: Behavior (1)");
  console.log("  Experience      — Excellence: Whole-child (5)  |  Concern: Agency (1)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
