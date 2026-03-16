export interface OutcomeSubDimL2 {
  id: string;
  label: string;
}

export interface OutcomeSubDimL1 {
  id: string;
  label: string;
  children: OutcomeSubDimL2[];
}

export const OUTCOME_SUBDIMENSION_TREE: OutcomeSubDimL1[] = [
  {
    id: "stem",
    label: "STEM",
    children: [
      { id: "stem-math", label: "Mathematics" },
      { id: "stem-science", label: "Natural sciences" },
      { id: "stem-comp", label: "Computational literacy" },
    ],
  },
  {
    id: "humanities",
    label: "Humanities & Arts capacities",
    children: [
      { id: "hum-ela", label: "English language arts" },
      { id: "hum-social", label: "Social studies & civics" },
      { id: "hum-lang", label: "World languages" },
      { id: "hum-arts", label: "Performing & visual arts" },
    ],
  },
  {
    id: "tlc",
    label: "Cross-cutting TLC",
    children: [
      { id: "tlc-thinking", label: "Higher order thinking skills" },
      { id: "tlc-learning", label: "Learning strategies & habits" },
      { id: "tlc-collab", label: "Collaboration & communication skills" },
    ],
  },
  {
    id: "wayfinding",
    label: "Wayfinding",
    children: [
      { id: "way-practical", label: "Practical, professional, and continuing-education capacities" },
      { id: "way-post", label: "Postsecondary assets" },
      { id: "way-milestones", label: "Transitional milestones" },
    ],
  },
  {
    id: "wellbeing",
    label: "Wellbeing",
    children: [
      { id: "well-se", label: "Social-emotional & engagement capacities" },
      { id: "well-phys", label: "Physical capacities" },
    ],
  },
];

const _l2ById = new Map<string, OutcomeSubDimL2>();
const _l1ByL2 = new Map<string, OutcomeSubDimL1>();
for (const l1 of OUTCOME_SUBDIMENSION_TREE) {
  for (const l2 of l1.children) {
    _l2ById.set(l2.id, l2);
    _l1ByL2.set(l2.id, l1);
  }
}

export function getL2ById(id: string): OutcomeSubDimL2 | undefined {
  return _l2ById.get(id);
}

export function getL1ForL2(l2Id: string): OutcomeSubDimL1 | undefined {
  return _l1ByL2.get(l2Id);
}

export function getL1ById(id: string): OutcomeSubDimL1 | undefined {
  return OUTCOME_SUBDIMENSION_TREE.find((l1) => l1.id === id);
}

export function allL2Ids(): string[] {
  return Array.from(_l2ById.keys());
}
