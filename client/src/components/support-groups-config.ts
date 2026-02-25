export type SupportGroupKey =
  | "curriculumAssessment"
  | "cultureSystemsProcesses"
  | "adultRolesHiringLearning"
  | "scheduleUseOfTime"
  | "communityFamilyPartnership"
  | "operationsBudgetInfrastructure"
  | "continuousImprovementDesign";

export const SUPPORT_GROUPS: { key: SupportGroupKey; title: string; subtitle: string }[] = [
  {
    key: "curriculumAssessment",
    title: "Curriculum & Assessment",
    subtitle: "Curriculum, assessment tools, and what “quality” looks like.",
  },
  {
    key: "cultureSystemsProcesses",
    title: "Systems & Processes for School Culture",
    subtitle: "Norms, rituals, routines, and systems that shape culture.",
  },
  {
    key: "adultRolesHiringLearning",
    title: "Adult Roles, Hiring, and Learning",
    subtitle: "Roles, staffing, coaching, and adult learning routines.",
  },
  {
    key: "scheduleUseOfTime",
    title: "Schedule & Use of Time",
    subtitle: "How time is structured to support the experience.",
  },
  {
    key: "communityFamilyPartnership",
    title: "Community and Family Partnership",
    subtitle: "Partnership structures and touchpoints with families/community.",
  },
  {
    key: "operationsBudgetInfrastructure",
    title: "Operations, Budget, and Infrastructure",
    subtitle: "Ops, budgets, tools, and infrastructure that enable the work.",
  },
  {
    key: "continuousImprovementDesign",
    title: "Continuous Improvement & Design",
    subtitle: "Cycles for learning, iteration, and continuous improvement.",
  },
];

