/**
 * GreatSchools-aligned explainer copy + short data-aware sentences for chart views.
 * Source: spreadsheet "GreatSchools Chart Descriptions.xlsx"
 *
 * Generated narratives use **bold** markers for key terms.
 * Render with <BoldText> from academic-chart-shared.
 */

export const GS_COPY = {
  collegePrep:
    "GreatSchools gathers college prep information from government-collected data.",

  testScoresIntro:
    "These scores reflect how well students at this school perform on state-required tests.",

  raceStudentProgress:
    "These ratings reflect how much students at this school improved from one year to the next compared to similar students at other schools in the state. It's a helpful way to measure how well a school is helping kids learn and advance.",

  raceGraduationLead:
    "This shows graduation rates for different races/ethnicities. Big differences may suggest that some students are not getting the support they need to succeed.",

  raceTestOverview:
    "This shows Test Score Ratings for different races/ethnicities. Big differences may suggest that some student groups are not getting the support they need to succeed.",

  raceTestSubject: (subject: string) =>
    `This shows results across different races/ethnicities on the **${subject}** test given to students once a year. Big differences may suggest that some student groups are not getting the support they need to succeed.`,

  raceDiscSuspended:
    "This shows the out-of-school suspension rates across different races/ethnicities at this school compared to the state average. High suspension rates mean less time for teaching and learning.",

  raceDiscAbsent:
    "This shows the percentage of students absent 15 or more days across different races/ethnicities at this school compared to the state average. High absenteeism rates mean less time for teaching and learning.",

  lowIncomeStudentProgress:
    "These ratings measure how much students from low-income households improved academically from one year to the next, compared to similar students at other schools in the state.",

  lowIncomeTestScoresOverview:
    "This shows test score ratings for low-income students compared to all students at this school. Big differences may suggest that some student groups are not getting the support they need to succeed.",

  lowIncomeTestScoresSubject: (subject: string) =>
    `This shows results for low-income students on the **${subject}** test given once a year. Big differences may suggest that some student groups are not getting the support they need to succeed.`,

  swdLead: (subject: string) =>
    `This shows results for students with disabilities on the **${subject}** test given once a year. Big differences may suggest that some student groups are not getting the support they need to succeed.`,
} as const;

const EPS = 0.55;

export type Relation = "above" | "below" | "about";

export function relationToBenchmark(
  value: number | null,
  benchmark: number | null,
): Relation | null {
  if (value == null || benchmark == null) return null;
  if (value > benchmark + EPS) return "above";
  if (value < benchmark - EPS) return "below";
  return "about";
}

export function lowIncomeGraduationNarrative(
  liSchool: number | null,
  allStudentsStateAvg: number | null,
): string | null {
  if (liSchool == null || allStudentsStateAvg == null) return null;
  const rel = relationToBenchmark(liSchool, allStudentsStateAvg);
  if (rel === "above") {
    return "**Low-income students** graduate **above** the statewide rate for **all students**.";
  }
  if (rel === "about") {
    return "**Low-income students** graduate at about the same rate as the statewide average for **all students**.";
  }
  return "**Low-income students** graduate **below** the statewide rate for **all students**.";
}

/** Canonical example for the state-test info modal (Pennsylvania / Keystone). */
export const GS_STATE_TEST_MODAL_BODY =
  "In 2023–2024, Pennsylvania used the Keystone Exams to assess high school students in Algebra I, Literature, and Biology. The Keystone Exams are standards-based, which means they measure how well students are mastering specific skills defined for each grade by the state of Pennsylvania. The goal is for all students to score at or above the proficient level on the tests. Other states use different assessments; this description is an example you can replace with your state's tests.";
