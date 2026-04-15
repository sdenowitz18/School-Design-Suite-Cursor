export interface OutcomeSubDimL2 {
  id: string;
  label: string;
}

export interface OutcomeSubDimL1 {
  id: string;
  label: string;
  children: OutcomeSubDimL2[];
}

/** Learning & advancement — five L1 siblings (four learning domains + Advancement). */
export const LEARNING_ADVANCEMENT_OUTCOME_TREE: OutcomeSubDimL1[] = [
  {
    id: "la-stem",
    label: "STEM",
    children: [
      { id: "la-stem-math", label: "Mathematics" },
      { id: "la-stem-science", label: "Natural sciences" },
      { id: "la-stem-comp-ai", label: "Computational & AI literacies" },
    ],
  },
  {
    id: "la-arts",
    label: "Arts & Humanities",
    children: [
      { id: "la-arts-ela", label: "English language arts" },
      { id: "la-arts-social", label: "Social studies & civics" },
      { id: "la-arts-lang", label: "World languages" },
      { id: "la-arts-performing", label: "Performing & visual arts" },
    ],
  },
  {
    id: "la-thinking",
    label: "Thinking & relating",
    children: [
      { id: "la-think-hots", label: "Higher order thinking skills" },
      { id: "la-think-learning", label: "Learning strategies & habits" },
      { id: "la-think-relationship", label: "Relationship skills" },
      { id: "la-think-mindsets", label: "Productive mindsets & purpose" },
    ],
  },
  {
    id: "la-professional",
    label: "Professional & practical",
    children: [
      { id: "la-prof-practical", label: "Practical life skills" },
      { id: "la-prof-career", label: "Career specific knowledge & skills" },
      { id: "la-prof-nav", label: "Career & continuing-education navigation knowledge & skills" },
      { id: "la-prof-physical", label: "Physical/athletic skills & habits" },
    ],
  },
  {
    id: "la-advancement",
    label: "Advancement",
    children: [
      { id: "la-adv-assets", label: "Assets for continuing education, career, and life" },
      { id: "la-adv-milestones", label: "Transitional milestones" },
    ],
  },
];

/** Wellbeing & conduct — two L1 groups (Wellbeing, Conduct). */
export const WELLBEING_CONDUCT_OUTCOME_TREE: OutcomeSubDimL1[] = [
  {
    id: "wc-wellbeing",
    label: "Wellbeing",
    children: [
      { id: "wc-wb-mental", label: "Mental & physical health" },
      { id: "wc-wb-social", label: "Social wellbeing" },
    ],
  },
  {
    id: "wc-conduct",
    label: "Conduct",
    children: [
      { id: "wc-cd-engagement", label: "Productive engagement & satisfaction" },
      { id: "wc-cd-behavior", label: "Behavior & attendance" },
    ],
  },
];

export function allL2IdsFromTree(tree: OutcomeSubDimL1[]): string[] {
  const ids: string[] = [];
  for (const l1 of tree) {
    for (const l2 of l1.children) ids.push(l2.id);
  }
  return ids;
}

export function getL1ByIdInTree(tree: OutcomeSubDimL1[], id: string): OutcomeSubDimL1 | undefined {
  return tree.find((l1) => l1.id === id);
}

export function buildAllL2OptionsFromTree(tree: OutcomeSubDimL1[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const l of tree) {
    for (const c of l.children) out.push({ id: c.id, label: c.label });
  }
  return out;
}
