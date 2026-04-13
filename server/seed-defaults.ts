import type { Component, InsertComponent } from "../shared/schema";
import { storage } from "./storage";

/** Default canvas components when the DB has no rows (same as POST /api/seed). */
export const DEFAULT_COMPONENT_SEEDS: InsertComponent[] = [
  {
    nodeId: "algebra",
    title: "Algebra",
    subtitle: "STEM Component",
    color: "bg-emerald-100",
    canvasX: 600,
    canvasY: 100,
    snapshotData: {
      description:
        "Students develop deep conceptual understanding, procedural fluency, and problem-solving skills through a rigorous, standards-aligned mathematics curriculum.",
      componentType: "STEM",
      level: "Course",
      primaryOutcomes: ["Algebra", "Geometry"],
      subcomponents: ["Algebra I", "Geometry", "Algebra II"],
      variants: ["Algebra A", "Algebra Honors"],
      studentGroups: ["All Students", "Honors"],
      keyExperiences: ["Morning Meeting", "Student-Led Conferences"],
      embeddedComponents: ["Math"],
      hostCourses: ["Algebra I"],
      selectionGating: "universal",
      amountStudents: "450",
      amountPercentage: "100",
      amountContext: "student_body",
      amountClassrooms: "12",
      compositionType: "same",
      compFRL: 45,
      compIEP: 12,
      compELL: 8,
      compFemale: 50,
    },
    designedExperienceData: {
      description:
        "Overview of the key components of the algebra learning component. This blueprint defines the student experience, outcomes, and necessary supports.",
      subcomponents: [
        {
          id: "sc_seed_1",
          name: "Algebra I",
          description: "Students take an introductory algebra course focusing on linear relationships and functions.",
          aims: [
            { id: "a1", type: "outcome", label: "Algebra", isPrimary: true },
            { id: "a2", type: "outcome", label: "Critical thinking" },
          ],
          practices: [
            { id: "p1", type: "practice", label: "Problem-based instruction" },
            { id: "p2", type: "practice", label: "Discourse" },
          ],
          supports: [
            { id: "s1", type: "support", label: "High-quality aligned curriculum" },
            { id: "s2", type: "support", label: "Common unit assessments" },
          ],
        },
        {
          id: "sc_seed_2",
          name: "Math Block",
          description:
            "Daily block of dedicated math time focused on precision, practice, and fluency with core concepts.",
          aims: [
            { id: "a3", type: "outcome", label: "Geometry" },
            { id: "a4", type: "outcome", label: "Problem solving" },
          ],
          practices: [
            { id: "p3", type: "practice", label: "Fluency practice" },
            { id: "p4", type: "practice", label: "Formative assessment" },
          ],
          supports: [{ id: "s3", type: "support", label: "Interim assessments" }],
        },
      ],
    },
    healthData: {},
  },
  {
    nodeId: "math",
    title: "Math",
    subtitle: "STEM Component",
    color: "bg-emerald-100",
    canvasX: 300,
    canvasY: 450,
    snapshotData: {
      description: "",
      componentType: "STEM",
      level: "Course",
      primaryOutcomes: [],
      subcomponents: [],
      variants: [],
      studentGroups: ["All Students"],
      keyExperiences: [],
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
    },
    designedExperienceData: {},
    healthData: {},
  },
  {
    nodeId: "college_exposure",
    title: "College Exposure",
    subtitle: "Access & Opportunity",
    color: "bg-blue-100",
    canvasX: 900,
    canvasY: 450,
    snapshotData: {
      description:
        "A set of experiences designed to ensure all students develop familiarity with post-secondary pathways, build practical readiness skills, and have equitable access to college and career opportunities.",
      componentType: "Wayfinding",
      level: "Course",
      primaryOutcomes: ["Continuing-education / post-secondary knowledge & exposure", "Postsecondary plan"],
      subcomponents: [],
      variants: [],
      studentGroups: ["All Students"],
      keyExperiences: [
        {
          name: "College Tours",
          formatOfTimeUse: "special_event",
          specificType: "",
          frequency: "2",
          frequencyPer: "year",
          duration: "240",
          timeDescription: "",
        },
        {
          name: "Post-Secondary Fair",
          formatOfTimeUse: "special_event",
          specificType: "",
          frequency: "1",
          frequencyPer: "year",
          duration: "120",
          timeDescription: "",
        },
        {
          name: "Summer Bridge Program",
          formatOfTimeUse: "extracurricular",
          specificType: "Extracurricular activity",
          frequency: "1",
          frequencyPer: "total",
          duration: "",
          timeDescription: "2-week intensive summer program between junior and senior year",
        },
        {
          name: "Dual Enrollment",
          formatOfTimeUse: "course_core",
          specificType: "Elective",
          frequency: "5",
          frequencyPer: "week",
          duration: "50",
          timeDescription: "",
        },
        {
          name: "College Application Workshop",
          formatOfTimeUse: "flexible",
          specificType: "Flex time",
          frequency: "1",
          frequencyPer: "week",
          duration: "45",
          timeDescription: "",
        },
      ],
      selectionGating: "universal",
      amountStudents: "450",
      amountPercentage: "100",
      amountContext: "student_body",
      amountClassrooms: "0",
      compositionType: "same",
      compFRL: 45,
      compIEP: 12,
      compELL: 8,
      compFemale: 50,
    },
    designedExperienceData: {},
    healthData: {},
  },
  {
    nodeId: "overall",
    title: "Overall School",
    subtitle: "Key Levers",
    color: "bg-white",
    canvasX: 600,
    canvasY: 300,
    snapshotData: {},
    designedExperienceData: {},
    healthData: {},
  },
];

export async function seedDefaultComponentsIfEmpty(): Promise<{
  message: string;
  components: Component[];
}> {
  const existing = await storage.getComponents();
  if (existing.length > 0) {
    return { message: "Already seeded", components: existing };
  }
  const created: Component[] = [];
  for (const row of DEFAULT_COMPONENT_SEEDS) {
    created.push(await storage.createComponent(row));
  }
  return { message: "Seeded", components: created };
}
