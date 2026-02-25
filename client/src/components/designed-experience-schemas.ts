export const OUTCOME_SCHEMA: Record<string, Record<string, string[]>> = {
  STEM: {
    Mathematics: ["Algebra", "Geometry", "Calculus"],
    "Natural sciences": ["Physics", "Chemistry", "Biology"],
    "Digital & AI literacies": ["Computer science", "AI literacy", "Robotics"],
  },
  Humanities: {
    "English language arts": ["Reading", "Writing", "Literature"],
    "Social studies & civics": ["US history", "World history", "Civics"],
    "World languages": ["Mandarin", "French"],
    "Performing & visual arts": ["Visual art", "Music", "Drama"],
  },
  "Cross-cutting": {
    "Higher-order thinking skills": ["Critical thinking", "Systems thinking", "Creativity"],
    "Learning strategies & habits": ["Goal-setting", "Note-taking"],
    "Collaboration & communication skills": ["Collaboration", "Communication", "Leadership & followership"],
  },
  "Well-being": {
    "Social emotional capacities": ["Identity & purpose", "Mindsets & self-regulation", "Relationship skills"],
    "Physical capacities": ["Athletics", "Healthy habits"],
    "Mental & physical health": ["Emotional well-being & mood", "Stress & resilience", "Anxiety/depressive symptoms"],
    "Behavior, attendance, & engagement": ["Attendance", "Positive & negative behavioral incidents", "Participation"],
  },
  Wayfinding: {
    "Practical, professional, & continuing education capacities": [
      "Practical knowledge & life skills",
      "Professional knowledge & skills",
      "Continuing-education / post-secondary knowledge & exposure",
    ],
    "Postsecondary assets": ["Industry-recognized credentials", "Early college coursework", "Postsecondary plan"],
    "Transitional milestones": ["Promotion / graduation", "Postsecondary enrollment", "Successful career transition"],
  },
};

export const LEAP_SCHEMA: Record<string, string[]> = {
  "Level 1": ["Whole-child focus", "Connection & community", "High expectations with rigorous learning", "Relevance", "Customization", "Agency"],
};

export const PRACTICE_SCHEMA: Record<string, string[]> = {
  "Instructional Strategies": [
    "Direct instruction",
    "Problem-based instruction",
    "Project-based learning",
    "Inquiry-based learning",
    "Socratic seminar",
    "Flipped classroom",
    "Lecture",
    "Modeling",
  ],
  "Student Engagement": [
    "Discourse",
    "Collaborative learning",
    "Peer tutoring",
    "Student-led discussion",
    "Think-pair-share",
    "Gallery walk",
    "Jigsaw",
  ],
  "Assessment Practices": [
    "Formative assessment",
    "Fluency practice",
    "Exit tickets",
    "Self-assessment",
    "Peer review",
    "Portfolio assessment",
    "Standards-based grading",
  ],
  Differentiation: ["Scaffolding", "Tiered assignments", "Flexible grouping", "Choice boards", "Learning stations", "Accommodations & modifications"],
};

export const SUPPORT_SCHEMA: Record<string, string[]> = {
  "Curriculum & Materials": ["High-quality aligned curriculum", "Supplemental materials", "Digital resources", "Manipulatives & tools", "Textbook adoption"],
  "Assessment Tools": ["Common unit assessments", "Interim assessments", "Diagnostic assessments", "Benchmark assessments", "Rubrics & scoring guides"],
  "Professional Development": ["Coaching cycles", "PLC collaboration", "Instructional rounds", "Content-area training", "Data literacy training"],
  "Student Support Structures": ["Tutoring program", "Intervention block", "Office hours", "Study groups", "Mentoring program"],
  "Technology & Infrastructure": ["Learning management system", "Student devices", "Assessment platform", "Data dashboard", "Communication tools"],
};

// Lightweight plain-English descriptions used by the AI Companion.
// If a label isn't present, the AI will fall back to a generic description template.
export const OUTCOME_DESCRIPTIONS: Record<string, string> = {
  Algebra: "Students build fluency with symbols, expressions, equations, and functions to model and solve problems.",
  Geometry: "Students reason about shapes, space, and measurement; they use proofs and visual models to justify claims.",
  Calculus: "Students analyze change using limits, derivatives, and integrals to model continuous phenomena.",
  Physics: "Students explain and predict how forces, energy, motion, and matter interact in physical systems.",
  Chemistry: "Students model matter and reactions, using evidence to explain changes at the particle level.",
  Biology: "Students explain living systems, from cells to ecosystems, using models, data, and scientific practices.",
  "Computer science": "Students learn computational thinking, algorithms, data, and programming to build and reason about systems.",
  "AI literacy": "Students understand how AI systems work at a high level, including data, bias, and responsible use.",
  Robotics: "Students design and program machines that sense, decide, and act to accomplish tasks.",
};

export const LEAP_DESCRIPTIONS: Record<string, string> = {
  "Whole-child focus": "The component supports academic learning alongside social-emotional and developmental needs.",
  "Connection & community": "The experience builds belonging, strong relationships, and shared norms for learning.",
  "High expectations with rigorous learning": "Students encounter challenging work with supports that enable success.",
  Relevance: "Learning connects to students’ lives, interests, identity, and future opportunities.",
  Customization: "The design adapts to learner needs through flexible pathways, scaffolds, and choices.",
  Agency: "Students have meaningful voice and ownership over goals, work products, and learning processes.",
};

export const PRACTICE_DESCRIPTIONS: Record<string, string> = {
  "Problem-based instruction": "Students learn through rich problems that require reasoning, modeling, and explanation.",
  Discourse: "Students explain thinking, build on peers’ ideas, and use evidence in structured discussion.",
  "Formative assessment": "Teachers check understanding frequently and adjust instruction based on evidence.",
  Scaffolding: "Tasks and supports are sequenced so learners can access complex work and gradually gain independence.",
};

export const SUPPORT_DESCRIPTIONS: Record<string, string> = {
  "High-quality aligned curriculum": "Materials are coherent, standards-aligned, and support rigorous daily instruction.",
  "Common unit assessments": "Shared assessments provide consistent signals about learning across classrooms.",
  "Interim assessments": "Periodic checks help monitor progress and adjust instruction before end-of-course outcomes.",
  "Tutoring program": "Structured additional learning time provides targeted practice and feedback.",
};

