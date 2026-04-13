export const OUTCOME_SCHEMA: Record<string, Record<string, string[]>> = {
  STEM: {
    Mathematics: ["Algebraic knowledge & skills", "Math identity", "Math habits"],
    "Natural sciences": ["Physics knowledge & skills", "Chemistry knowledge & skills", "Scientific reasoning"],
    "Computational & AI literacies": ["Computer science", "AI literacy", "Robotics"],
  },
  "Arts & Humanities": {
    "English language arts": ["Reading", "Writing", "Literature"],
    "Social studies & civics": ["US history knowledge", "World history knowledge", "Historical thinking", "Civics"],
    "World languages": ["Spanish", "Mandarin", "French", "Swahili"],
    "Performing & visual arts": ["Visual art", "Music", "Drama"],
  },
  "Thinking & Relating": {
    "Higher order thinking skills": ["Critical thinking", "Systems thinking", "Creativity"],
    "Learning strategies & habits": ["Goal-setting", "Note-taking"],
    "Relationship skills": ["Collaboration", "Communication", "Leadership & followership"],
    "Productive mindsets & purpose": ["Identity & purpose", "Mindsets & self-regulation"],
  },
  "Professional & Practical": {
    "Practical life skills": [],
    "Career specific knowledge & skills": ["Financial services", "Mgmt & entrepreneurship", "Healthcare & human services", "Agriculture"],
    "Career & continuing-education navigation knowledge & skills": [],
    "Physical/athletic skills & habits": [],
  },
  Advancement: {
    "Assets for continuing education, career, and life": [
      "GPA",
      "Transcript",
      "Educator relationships & recommendations",
      "Early college coursework",
      "Industry-recognized credentials",
      "Logged experience and work artifacts",
      "Social network",
    ],
    "Transitional milestones": ["Promotion / graduation", "Postsecondary enrollment", "Successful career transition"],
  },
  Wellbeing: {
    "Mental & physical health": ["Emotional well-being & mood", "Stress & resilience", "Anxiety/depressive symptoms"],
    "Social wellbeing": ["Belonging", "Quality of peer relationships", "Connection to teachers & staff"],
  },
  "Conduct & Engagement": {
    "Productive engagement & satisfaction": ["Participation", "Engagement profiles", "Social engagement", "Satisfaction"],
    "Behavior & attendance": ["Positive & negative behavior incidents", "Attendance"],
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

/** One–two sentence blurbs for leap detail screens (keep concise). */
export const LEAP_DESCRIPTIONS: Record<string, string> = {
  "Whole-child focus":
    "Academic learning alongside social-emotional and developmental needs.",
  "Connection & community": "Belonging, strong relationships, and shared norms for learning.",
  "High expectations with rigorous learning": "Challenging work with supports so students can succeed.",
  Relevance: "Learning connects to students’ lives, interests, and future paths.",
  Customization: "Flexible pathways, scaffolds, and choices that adapt to learners.",
  Agency: "Meaningful voice and ownership over goals, work products, and learning processes.",
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

