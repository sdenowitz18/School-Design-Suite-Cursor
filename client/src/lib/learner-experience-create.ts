/** Shared defaults when creating school-level learner experience components (canvas + DB). */

export const LEARNER_COMPONENT_COLOR_ROTATION = [
  "bg-emerald-100",
  "bg-blue-100",
  "bg-amber-100",
  "bg-purple-100",
  "bg-rose-100",
  "bg-cyan-100",
];

export function defaultSnapshotForLearnerComponent(title: string) {
  return {
    description: `School-level learner experience component: ${title}.`,
    componentType: "Cross-cutting",
    level: "Course" as const,
    primaryOutcomes: [] as string[],
    subcomponents: [] as string[],
    variants: [] as string[],
    studentGroups: ["All Students"],
    keyExperiences: [] as string[],
    selectionGating: "universal",
    amountStudents: "0",
    amountPercentage: "0",
    amountContext: "student_body",
    amountClassrooms: "0",
    compositionType: "same",
    compFRL: 45,
    compIEP: 12,
    compELL: 8,
    compFemale: 50,
  };
}
