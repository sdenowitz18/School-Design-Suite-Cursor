import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const components = pgTable("components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nodeId: text("node_id").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  color: text("color").notNull().default("bg-emerald-100"),
  canvasX: integer("canvas_x").notNull().default(0),
  canvasY: integer("canvas_y").notNull().default(0),
  snapshotData: jsonb("snapshot_data").notNull().default(sql`'{}'::jsonb`),
  designedExperienceData: jsonb("designed_experience_data").notNull().default(sql`'{}'::jsonb`),
  healthData: jsonb("health_data").notNull().default(sql`'{}'::jsonb`),
});

export const insertComponentSchema = createInsertSchema(components).omit({ id: true });
export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type Component = typeof components.$inferSelect;

export const snapshotDataSchema = z.object({
  description: z.string().optional(),
  componentType: z.enum(["STEM", "Humanities", "Wayfinding", "Well-being", "Cross-cutting"]).optional(),
  level: z.enum(["Course", "Subject", "Other"]).optional(),
  isAP: z.boolean().optional(),
  formatOfTimeUse: z.string().optional(),
  specificType: z.string().optional(),
  participationModel: z.string().optional(),
  subcomponents: z.array(z.string()).optional(),
  variants: z.array(z.string()).optional(),
  studentGroups: z.array(z.string()).optional(),
  keyExperiences: z.array(z.string()).optional(),
  primaryOutcomes: z.array(z.string()).optional(),
  embeddedComponents: z.array(z.string()).optional(),
  hostCourses: z.array(z.string()).optional(),
  selectionGating: z.string().optional(),
  gatingSpecifics: z.string().optional(),
  amountStudents: z.string().optional(),
  amountPercentage: z.string().optional(),
  amountContext: z.string().optional(),
  amountClassrooms: z.string().optional(),
  compositionType: z.string().optional(),
  compFRL: z.number().optional(),
  compIEP: z.number().optional(),
  compELL: z.number().optional(),
  compFemale: z.number().optional(),
  sequenceDescription: z.string().optional(),
  timeStructure: z.string().optional(),
  termLength: z.string().optional(),
  sessionFrequency: z.string().optional(),
  sessionFrequencyPer: z.string().optional(),
  sessionDuration: z.string().optional(),
});

export type SnapshotData = z.infer<typeof snapshotDataSchema>;

export const measureSchema = z.object({
  id: z.string(),
  name: z.string(),
  appliesTo: z.string().default("All students"),
  priority: z.enum(["H", "M", "L"]).default("M"),
  confidence: z.enum(["H", "M", "L"]).default("M"),
  rating: z.number().min(1).max(5).nullable().default(null),
  justification: z.string().optional(),
  reflectionAchievement: z.string().default(""),
  reflectionVariability: z.string().default(""),
  skipped: z.boolean().default(false),
  scaleDefinitions: z.record(z.string(), z.string()).optional(),
  rationale: z.string().optional(),
});

export type Measure = z.infer<typeof measureSchema>;

export const targetedOutcomeSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  outcomeName: z.string(),
  priority: z.enum(["H", "M", "L"]).default("M"),
  rigorPath: z.literal("thin").default("thin"),
  measures: z.array(measureSchema).default([]),
  calculatedScore: z.number().nullable().default(null),
  skipped: z.boolean().default(false),
});

export type TargetedOutcome = z.infer<typeof targetedOutcomeSchema>;

export const outcomeScoreDataSchema = z.object({
  scoringMode: z.enum(["targeted", "overall"]).default("targeted"),
  targetedOutcomes: z.array(targetedOutcomeSchema).default([]),
  overallMeasures: z.array(measureSchema).default([]),
  outcomeNotes: z
    .record(
      z.string(),
      z.object({
        appliesDescription: z.string().default(""),
      }),
    )
    .default({}),
  finalOutcomeScore: z.number().nullable().default(null),
});

export type OutcomeScoreData = z.infer<typeof outcomeScoreDataSchema>;

export const experienceDimensionSchema = z.object({
  measures: z.array(measureSchema).default([]),
  excluded: z.boolean().default(false),
});

export type ExperienceDimension = z.infer<typeof experienceDimensionSchema>;

export const experienceScoreDataSchema = z.object({
  scoringMode: z.enum(["dimensions", "overall"]).default("dimensions"),
  leapsScoringMode: z.enum(["across", "individual"]).default("across"),
  leaps: experienceDimensionSchema.default({ measures: [], excluded: false }),
  health: experienceDimensionSchema.default({ measures: [], excluded: false }),
  behavior: experienceDimensionSchema.default({ measures: [], excluded: false }),
  leapItems: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        weight: z.enum(["H", "M", "L"]).default("M"),
        measures: z.array(measureSchema).default([]),
      }),
    )
    .default([]),
  overallMeasures: z.array(measureSchema).default([]),
  leapsDimensionScore: z.number().nullable().default(null),
  healthDimensionScore: z.number().nullable().default(null),
  behaviorDimensionScore: z.number().nullable().default(null),
  finalExperienceScore: z.number().nullable().default(null),
});

export type ExperienceScoreData = z.infer<typeof experienceScoreDataSchema>;

export const ringDesignDimensionsSchema = z.object({
  aimsScore: z.number().int().min(1).max(5).nullable().default(null),
  experienceScore: z.number().int().min(1).max(5).nullable().default(null),
  resourcesScore: z.number().int().min(1).max(5).nullable().default(null),
});

export type RingDesignDimensions = z.infer<typeof ringDesignDimensionsSchema>;

export const ringDesignWeightsSchema = z.object({
  aimsWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("L"),
  experienceWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("M"),
  resourcesWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("M"),
});

export type RingDesignWeights = z.infer<typeof ringDesignWeightsSchema>;

export const ringDesignAimsSubDimensionsSchema = z.object({
  leapsScore: z.number().int().min(1).max(5).nullable().default(null),
  leapsRationale: z.string().optional(),
  leapsConfidence: z.enum(["H", "M", "L"]).default("M"),
  outcomesScore: z.number().int().min(1).max(5).nullable().default(null),
  outcomesRationale: z.string().optional(),
  outcomesConfidence: z.enum(["H", "M", "L"]).default("M"),
});

export type RingDesignAimsSubDimensions = z.infer<typeof ringDesignAimsSubDimensionsSchema>;

export const ringDesignStudentExperienceSubDimensionsSchema = z.object({
  thoroughnessScore: z.number().int().min(1).max(5).nullable().default(null),
  thoroughnessRationale: z.string().optional(),
  thoroughnessConfidence: z.enum(["H", "M", "L"]).default("M"),
  thoroughnessWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("L"),

  leapinessScore: z.number().int().min(1).max(5).nullable().default(null),
  leapinessRationale: z.string().optional(),
  leapinessConfidence: z.enum(["H", "M", "L"]).default("M"),

  coherenceScore: z.number().int().min(1).max(5).nullable().default(null),
  coherenceRationale: z.string().optional(),
  coherenceConfidence: z.enum(["H", "M", "L"]).default("M"),
  coherenceWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("L"),
});

export type RingDesignStudentExperienceSubDimensions = z.infer<typeof ringDesignStudentExperienceSubDimensionsSchema>;

export const ringDesignSupportingResourcesSubDimensionsSchema = z.object({
  thoroughnessScore: z.number().int().min(1).max(5).nullable().default(null),
  thoroughnessRationale: z.string().optional(),
  thoroughnessConfidence: z.enum(["H", "M", "L"]).default("M"),
  thoroughnessWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("M"),

  qualityScore: z.number().int().min(1).max(5).nullable().default(null),
  qualityRationale: z.string().optional(),
  qualityConfidence: z.enum(["H", "M", "L"]).default("M"),
  qualityWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("M"),

  coherenceScore: z.number().int().min(1).max(5).nullable().default(null),
  coherenceRationale: z.string().optional(),
  coherenceConfidence: z.enum(["H", "M", "L"]).default("M"),
  coherenceWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("M"),
});

export type RingDesignSupportingResourcesSubDimensions = z.infer<typeof ringDesignSupportingResourcesSubDimensionsSchema>;

export const ringDesignSubDimensionsSchema = z.object({
  aims: ringDesignAimsSubDimensionsSchema.default({
    leapsScore: null,
    outcomesScore: null,
  }),
  studentExperience: ringDesignStudentExperienceSubDimensionsSchema.default({
    thoroughnessScore: null,
    thoroughnessWeight: "L",
    leapinessScore: null,
    coherenceScore: null,
    coherenceWeight: "L",
  }),
  supportingResources: ringDesignSupportingResourcesSubDimensionsSchema.default({
    thoroughnessScore: null,
    thoroughnessWeight: "M",
    qualityScore: null,
    qualityWeight: "M",
    coherenceScore: null,
    coherenceWeight: "M",
  }),
});

export type RingDesignSubDimensions = z.infer<typeof ringDesignSubDimensionsSchema>;

export const ringDesignScoreDataSchema = z.object({
  designScoringMode: z.enum(["overall", "multi"]).default("overall"),
  overallDesignScore: z.number().int().min(1).max(5).nullable().default(null),
  overallDesignRationale: z.string().optional(),
  overallDesignConfidence: z.enum(["H", "M", "L"]).default("M"),
  designDimensions: ringDesignDimensionsSchema.default({
    aimsScore: null,
    experienceScore: null,
    resourcesScore: null,
  }),
  designWeights: ringDesignWeightsSchema.default({
    aimsWeight: "L",
    experienceWeight: "M",
    resourcesWeight: "M",
  }),
  subDimensions: ringDesignSubDimensionsSchema.default({
    aims: { leapsScore: null, outcomesScore: null },
    studentExperience: { thoroughnessScore: null, thoroughnessWeight: "L", leapinessScore: null, coherenceScore: null, coherenceWeight: "L" },
    supportingResources: { thoroughnessScore: null, thoroughnessWeight: "M", qualityScore: null, qualityWeight: "M", coherenceScore: null, coherenceWeight: "M" },
  }),
  finalDesignScore: z.number().int().min(1).max(5).nullable().default(null),
});

export type RingDesignScoreData = z.infer<typeof ringDesignScoreDataSchema>;

export const ringImplementationDimensionKeySchema = z.enum(["quality", "fidelity", "scale", "learnerDemand"]);
export type RingImplementationDimensionKey = z.infer<typeof ringImplementationDimensionKeySchema>;

export const ringImplementationDimensionSchema = z.object({
  score: z.number().int().min(1).max(5).nullable().default(null),
  rationale: z.string().optional(),
  confidence: z.enum(["H", "M", "L"]).default("M"),
  weight: z.enum(["H", "M", "L"]).default("M"),
});

export type RingImplementationDimension = z.infer<typeof ringImplementationDimensionSchema>;

export const ringImplementationScoreDataSchema = z.object({
  implementationScoringMode: z.enum(["overall", "multi"]).default("overall"),
  overallImplementationScore: z.number().int().min(1).max(5).nullable().default(null),
  overallImplementationRationale: z.string().optional(),
  overallImplementationConfidence: z.enum(["H", "M", "L"]).default("M"),
  dimensions: z
    .object({
      quality: ringImplementationDimensionSchema.default({ score: null, weight: "M" }),
      fidelity: ringImplementationDimensionSchema.default({ score: null, weight: "M" }),
      scale: ringImplementationDimensionSchema.default({ score: null, weight: "M" }),
      learnerDemand: ringImplementationDimensionSchema.default({ score: null, weight: "M" }),
    })
    .default({
      quality: { score: null, weight: "M" },
      fidelity: { score: null, weight: "M" },
      scale: { score: null, weight: "M" },
      learnerDemand: { score: null, weight: "M" },
    }),
  finalImplementationScore: z.number().int().min(1).max(5).nullable().default(null),
});

export type RingImplementationScoreData = z.infer<typeof ringImplementationScoreDataSchema>;

export const ringConditionsStakeholderGroupSchema = z.enum([
  "students",
  "families",
  "educators_staff",
  "admin_district",
  "admin_school",
  "other_leaders",
]);
export type RingConditionsStakeholderGroup = z.infer<typeof ringConditionsStakeholderGroupSchema>;

export const ringConditionsDirectionSchema = z.enum(["tailwind", "headwind"]);
export type RingConditionsDirection = z.infer<typeof ringConditionsDirectionSchema>;

export const ringConditionsCKeySchema = z.enum(["Conviction", "Capacity", "Clarity", "Culture", "Coalition"]);
export type RingConditionsCKey = z.infer<typeof ringConditionsCKeySchema>;

export const ringConditionsStakeholderWeightsSchema = z
  .object({
    students: z.enum(["H", "M", "L"]).default("M"),
    families: z.enum(["H", "M", "L"]).default("M"),
    educators_staff: z.enum(["H", "M", "L"]).default("M"),
    admin_district: z.enum(["H", "M", "L"]).default("H"),
    admin_school: z.enum(["H", "M", "L"]).default("H"),
    other_leaders: z.enum(["H", "M", "L"]).default("L"),
  })
  .default({
    students: "M",
    families: "M",
    educators_staff: "M",
    admin_district: "H",
    admin_school: "H",
    other_leaders: "L",
  });
export type RingConditionsStakeholderWeights = z.infer<typeof ringConditionsStakeholderWeightsSchema>;

export const ringConditionItemSchema = z.object({
  id: z.string(),
  stakeholderGroup: ringConditionsStakeholderGroupSchema,
  direction: ringConditionsDirectionSchema,
  windStrength: z.enum(["H", "M", "L"]).default("M"),
  cs: z.array(ringConditionsCKeySchema).default([]),
  description: z.string().default(""),
  dateLogged: z.string().optional(),
});
export type RingConditionItem = z.infer<typeof ringConditionItemSchema>;

export const ringConditionsScoreDataSchema = z.object({
  stakeholderWeights: ringConditionsStakeholderWeightsSchema,
  conditions: z.array(ringConditionItemSchema).default([]),
  finalConditionsScore: z.number().int().min(1).max(5).nullable().default(null),
  conditionsSum: z.number().nullable().default(null),
});
export type RingConditionsScoreData = z.infer<typeof ringConditionsScoreDataSchema>;
