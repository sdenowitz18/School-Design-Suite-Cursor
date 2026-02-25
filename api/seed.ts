import { getPool } from "./_db";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  const method = String(req?.method || "POST").toUpperCase();
  if (method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  try {
    const pool = await getPool();
    const existing = await pool.query("select node_id from components limit 1");
    if ((existing.rows || []).length > 0) {
      res.setHeader("Content-Type", "application/json");
      const all = await pool.query("select * from components");
      return res.end(JSON.stringify({ message: "Already seeded", components: all.rows || [] }));
    }

    const defaults = [
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
              description: "Daily block of dedicated math time focused on precision, practice, and fluency with core concepts.",
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
          keyExperiences: [],
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

    const created = [];
    for (const comp of defaults) {
      const q =
        "insert into components (node_id,title,subtitle,color,canvas_x,canvas_y,snapshot_data,designed_experience_data,health_data) " +
        "values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb) returning *";
      const values = [
        String((comp as any).nodeId),
        String((comp as any).title),
        String((comp as any).subtitle || ""),
        String((comp as any).color || "bg-emerald-100"),
        Number((comp as any).canvasX || 0),
        Number((comp as any).canvasY || 0),
        JSON.stringify((comp as any).snapshotData || {}),
        JSON.stringify((comp as any).designedExperienceData || {}),
        JSON.stringify((comp as any).healthData || {}),
      ];
      const r = await pool.query(q, values);
      created.push(r.rows?.[0]);
    }

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: "Seeded", components: created }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: err?.message || "Internal Server Error" }));
  }
}

