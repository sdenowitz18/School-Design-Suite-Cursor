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
  overviewContextData: z
    .object({
      schoolName: z.string().optional(),
      schoolType: z.enum(["Elementary School", "Middle School", "High School"]).optional(),
      district: z.string().default(""),
      studentCount: z.union([z.string(), z.number()]).optional(),
      mission: z.string().optional(),
      schedule: z
        .object({
          schoolYearStart: z.string().default(""),
          schoolYearEnd: z.string().default(""),
          semester1Start: z.string().default(""),
          semester1End: z.string().default(""),
          semester2Start: z.string().default(""),
          semester2End: z.string().default(""),
        })
        .default({
          schoolYearStart: "",
          schoolYearEnd: "",
          semester1Start: "",
          semester1End: "",
          semester2Start: "",
          semester2End: "",
        }),
      timeModel: z
        .object({
          daysPerYear: z.string().default(""),
          hoursPerDay: z.string().default(""),
        })
        .default({
          daysPerYear: "",
          hoursPerDay: "",
        }),
      whoWeServe: z
        .object({
          compFRL: z.number().int().min(0).max(100).default(45),
          compIEP: z.number().int().min(0).max(100).default(12),
          compELL: z.number().int().min(0).max(100).default(8),
          compFemale: z.number().int().min(0).max(100).default(50),
        })
        .default({
          compFRL: 45,
          compIEP: 12,
          compELL: 8,
          compFemale: 50,
        }),
      contextOverview: z
        .object({
          communityOverviewText: z.string().default(""),
          policyConsiderationsText: z.string().default(""),
          historyOfChangeText: z.string().default(""),
          otherContextText: z.string().default(""),
        })
        .default({
          communityOverviewText: "",
          policyConsiderationsText: "",
          historyOfChangeText: "",
          otherContextText: "",
        }),
      stakeholderMap: z
        .object({
          students: z
            .object({
              populationSize: z.string().default(""),
              additionalContext: z.string().default(""),
              keyRepresentatives: z.string().default(""),
            })
            .default({ populationSize: "", additionalContext: "", keyRepresentatives: "" }),
          families: z
            .object({
              populationSize: z.string().default(""),
              additionalContext: z.string().default(""),
              keyRepresentatives: z.string().default(""),
            })
            .default({ populationSize: "", additionalContext: "", keyRepresentatives: "" }),
          educatorsStaff: z
            .object({
              populationSize: z.string().default(""),
              additionalContext: z.string().default(""),
              keyRepresentatives: z.string().default(""),
            })
            .default({ populationSize: "", additionalContext: "", keyRepresentatives: "" }),
          administration: z
            .object({
              populationSize: z.string().default(""),
              additionalContext: z.string().default(""),
              keyRepresentatives: z.string().default(""),
            })
            .default({ populationSize: "", additionalContext: "", keyRepresentatives: "" }),
          otherCommunityLeaders: z
            .object({
              populationSize: z.string().default(""),
              additionalContext: z.string().default(""),
              keyRepresentatives: z.string().default(""),
            })
            .default({ populationSize: "", additionalContext: "", keyRepresentatives: "" }),
        })
        .default({
          students: { populationSize: "", additionalContext: "", keyRepresentatives: "" },
          families: { populationSize: "", additionalContext: "", keyRepresentatives: "" },
          educatorsStaff: { populationSize: "", additionalContext: "", keyRepresentatives: "" },
          administration: { populationSize: "", additionalContext: "", keyRepresentatives: "" },
          otherCommunityLeaders: { populationSize: "", additionalContext: "", keyRepresentatives: "" },
        }),
    })
    .optional(),
});

export type SnapshotData = z.infer<typeof snapshotDataSchema>;

export const scoreInstanceSchema = z.object({
  id: z.string(),
  actor: z.string().default(""),
  asOfDate: z.string(),
  score: z.number().int().min(1).max(5).nullable().default(null),
  weight: z.enum(["H", "M", "L"]).default("M"),
  importance: z.enum(["H", "M", "L"]).default("M"),
  confidence: z.enum(["H", "M", "L"]).default("M"),
  rationale: z.string().default(""),
  retired: z.boolean().default(false),
});
export type ScoreInstance = z.infer<typeof scoreInstanceSchema>;

export const scoreFilterSchema = z.object({
  mode: z.enum(["none", "year", "semester", "quarter"]).default("none"),
  yearKey: z.string().optional(),
  semesterKey: z.string().optional(),
  quarterKey: z.string().optional(),
  aggregation: z.enum(["singleLatest", "latestPerActor"]).optional().default("singleLatest"),
  actorKey: z.string().optional(),
});
export type ScoreFilter = z.infer<typeof scoreFilterSchema>;

export const measureSchema = z.object({
  id: z.string(),
  name: z.string(),
  markingPeriod: z
    .object({
      mode: z.enum(["year", "semester", "quarter"]).optional(),
      yearKey: z.string().optional(),
      semesterKey: z.string().optional(),
      quarterKey: z.string().optional(),
    })
    .optional(),
  appliesTo: z.string().default("All students"),
  priority: z.enum(["H", "M", "L"]).default("M"),
  confidence: z.enum(["H", "M", "L"]).default("M"),
  rating: z.number().min(1).max(5).nullable().default(null),
  instances: z.array(scoreInstanceSchema).default([]),
  justification: z.string().optional(),
  reflectionAchievement: z.string().default(""),
  reflectionVariability: z.string().default(""),
  skipped: z.boolean().default(false),
  scaleDefinitions: z.record(z.string(), z.string()).optional(),
  rationale: z.string().optional(),
});

export type Measure = z.infer<typeof measureSchema>;

export const outcomePeriodSnapshotSchema = z.object({
  markingPeriod: z.object({
    mode: z.enum(["year", "semester", "quarter"]).optional(),
    yearKey: z.string().optional(),
    semesterKey: z.string().optional(),
    quarterKey: z.string().optional(),
  }),
  importance: z.enum(["H", "M", "L"]).default("M"),
  confidence: z.enum(["H", "M", "L"]).default("M"),
  instances: z.array(scoreInstanceSchema).default([]),
  archivedAt: z.string().optional(),
});
export type OutcomePeriodSnapshot = z.infer<typeof outcomePeriodSnapshotSchema>;

export const outcomeMeasureSchema = measureSchema.extend({
  subDimensionIds: z.array(z.string()).default([]),
  description: z.string().default(""),
  importance: z.enum(["H", "M", "L"]).default("M"),
  type: z.enum(["measure", "perception"]).default("measure"),
  portedFromId: z.string().optional(),
  portedFlag: z.boolean().default(false),
  periodHistory: z.array(outcomePeriodSnapshotSchema).default([]),
  crossOutcome: z.boolean().default(false),
});
export type OutcomeMeasure = z.infer<typeof outcomeMeasureSchema>;

export const scoringNodeWeightSchema = z.enum(["H", "M", "L"]);
export type ScoringNodeWeight = z.infer<typeof scoringNodeWeightSchema>;

export const scoringNodeSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      label: z.string(),
      weight: scoringNodeWeightSchema.default("M"),
      score: z.number().int().min(1).max(5).nullable().default(null),
      measures: z.array(measureSchema).default([]),
      children: z.array(scoringNodeSchema).default([]),
      confidence: z.enum(["H", "M", "L"]).default("M"),
      rationale: z.string().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
);

export type ScoringNode = z.infer<typeof scoringNodeSchema>;

export function canNodeAcceptMeasures(node: Pick<ScoringNode, "children">): boolean {
  return !Array.isArray(node.children) || node.children.length === 0;
}

export const scoreTreeSchema = z.object({
  scoringMode: z.enum(["dimensions", "overall"]).default("dimensions"),
  actors: z.array(z.string()).default([]),
  filter: scoreFilterSchema.default({ mode: "none", aggregation: "singleLatest" }),
  overallInstances: z.array(scoreInstanceSchema).default([]),
  overallMeasures: z.array(measureSchema).default([]),
  nodes: z.array(scoringNodeSchema).default([]),
  finalScore: z.number().int().min(1).max(5).nullable().default(null),
});

export type ScoreTree = z.infer<typeof scoreTreeSchema>;

export const targetedOutcomeSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  outcomeName: z.string(),
  priority: z.enum(["H", "M", "L"]).default("M"),
  rigorPath: z.literal("thin").default("thin"),
  instances: z.array(scoreInstanceSchema).default([]),
  measures: z.array(measureSchema).default([]),
  calculatedScore: z.number().nullable().default(null),
  skipped: z.boolean().default(false),
});

export type TargetedOutcome = z.infer<typeof targetedOutcomeSchema>;

export const outcomeScoreDataSchema = z.object({
  actors: z.array(z.string()).default([]),
  filter: scoreFilterSchema.default({ mode: "none", aggregation: "singleLatest" }),
  subDimensionWeights: z.record(z.string(), z.enum(["H", "M", "L"])).default({}),
  measures: z.array(outcomeMeasureSchema).default([]),
  overallMeasures: z.array(outcomeMeasureSchema).default([]),
  finalOutcomeScore: z.number().nullable().default(null),
  outcomeNotes: z
    .record(
      z.string(),
      z.object({
        appliesDescription: z.string().default(""),
      }),
    )
    .default({}),
});

export type OutcomeScoreData = z.infer<typeof outcomeScoreDataSchema>;

export const experienceDimensionSchema = z.object({
  instances: z.array(scoreInstanceSchema).default([]),
  measures: z.array(measureSchema).default([]),
  excluded: z.boolean().default(false),
});

export type ExperienceDimension = z.infer<typeof experienceDimensionSchema>;

export const experienceScoreDataSchema = z.object({
  scoringMode: z.enum(["dimensions", "overall"]).default("dimensions"),
  leapsScoringMode: z.enum(["across", "individual"]).default("across"),
  actors: z.array(z.string()).default([]),
  filter: scoreFilterSchema.default({ mode: "none", aggregation: "singleLatest" }),
  canonicalTree: scoreTreeSchema.optional(),
  leaps: experienceDimensionSchema.default({ measures: [], excluded: false }),
  health: experienceDimensionSchema.default({ measures: [], excluded: false }),
  behavior: experienceDimensionSchema.default({ measures: [], excluded: false }),
  leapItems: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        weight: z.enum(["H", "M", "L"]).default("M"),
        instances: z.array(scoreInstanceSchema).default([]),
        measures: z.array(measureSchema).default([]),
      }),
    )
    .default([]),
  overallInstances: z.array(scoreInstanceSchema).default([]),
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
  leapsInstances: z.array(scoreInstanceSchema).default([]),
  leapsRationale: z.string().optional(),
  leapsConfidence: z.enum(["H", "M", "L"]).default("M"),
  outcomesScore: z.number().int().min(1).max(5).nullable().default(null),
  outcomesInstances: z.array(scoreInstanceSchema).default([]),
  outcomesRationale: z.string().optional(),
  outcomesConfidence: z.enum(["H", "M", "L"]).default("M"),
});

export type RingDesignAimsSubDimensions = z.infer<typeof ringDesignAimsSubDimensionsSchema>;

export const ringDesignStudentExperienceSubDimensionsSchema = z.object({
  thoroughnessScore: z.number().int().min(1).max(5).nullable().default(null),
  thoroughnessInstances: z.array(scoreInstanceSchema).default([]),
  thoroughnessRationale: z.string().optional(),
  thoroughnessConfidence: z.enum(["H", "M", "L"]).default("M"),
  thoroughnessWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("L"),

  leapinessScore: z.number().int().min(1).max(5).nullable().default(null),
  leapinessInstances: z.array(scoreInstanceSchema).default([]),
  leapinessRationale: z.string().optional(),
  leapinessConfidence: z.enum(["H", "M", "L"]).default("M"),

  coherenceScore: z.number().int().min(1).max(5).nullable().default(null),
  coherenceInstances: z.array(scoreInstanceSchema).default([]),
  coherenceRationale: z.string().optional(),
  coherenceConfidence: z.enum(["H", "M", "L"]).default("M"),
  coherenceWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("L"),
});

export type RingDesignStudentExperienceSubDimensions = z.infer<typeof ringDesignStudentExperienceSubDimensionsSchema>;

export const ringDesignSupportingResourcesSubDimensionsSchema = z.object({
  thoroughnessScore: z.number().int().min(1).max(5).nullable().default(null),
  thoroughnessInstances: z.array(scoreInstanceSchema).default([]),
  thoroughnessRationale: z.string().optional(),
  thoroughnessConfidence: z.enum(["H", "M", "L"]).default("M"),
  thoroughnessWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("M"),

  qualityScore: z.number().int().min(1).max(5).nullable().default(null),
  qualityInstances: z.array(scoreInstanceSchema).default([]),
  qualityRationale: z.string().optional(),
  qualityConfidence: z.enum(["H", "M", "L"]).default("M"),
  qualityWeight: z.union([z.number().int().min(1), z.enum(["H", "M", "L"])]).default("M"),

  coherenceScore: z.number().int().min(1).max(5).nullable().default(null),
  coherenceInstances: z.array(scoreInstanceSchema).default([]),
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

export const ringDesignMeasureNodeSchema = z.object({
  measures: z.array(measureSchema).default([]),
});
export type RingDesignMeasureNode = z.infer<typeof ringDesignMeasureNodeSchema>;

export const ringDesignCoherenceMeasureSchema = z.object({
  qualityOfMaterials: ringDesignMeasureNodeSchema.default({ measures: [] }),
  qualityOfMaterialsCompilation: ringDesignMeasureNodeSchema.default({ measures: [] }),
  childWeights: z
    .object({
      qualityOfMaterialsWeight: z.enum(["H", "M", "L"]).default("M"),
      qualityOfMaterialsCompilationWeight: z.enum(["H", "M", "L"]).default("M"),
    })
    .default({
      qualityOfMaterialsWeight: "M",
      qualityOfMaterialsCompilationWeight: "M",
    }),
});
export type RingDesignCoherenceMeasure = z.infer<typeof ringDesignCoherenceMeasureSchema>;

export const ringDesignMeasureDimensionsSchema = z.object({
  aims: ringDesignMeasureNodeSchema.default({ measures: [] }),
  completenessDesignedExperience: ringDesignMeasureNodeSchema.default({ measures: [] }),
  qualityCompletenessSrr: ringDesignMeasureNodeSchema.default({ measures: [] }),
  coherenceDesignedExperience: ringDesignCoherenceMeasureSchema.default({}),
  alignmentDesignedExperience: ringDesignMeasureNodeSchema.default({ measures: [] }),
});
export type RingDesignMeasureDimensions = z.infer<typeof ringDesignMeasureDimensionsSchema>;

export const ringDesignMeasureWeightsSchema = z.object({
  aimsWeight: z.enum(["H", "M", "L"]).default("M"),
  completenessDesignedExperienceWeight: z.enum(["H", "M", "L"]).default("M"),
  qualityCompletenessSrrWeight: z.enum(["H", "M", "L"]).default("M"),
  coherenceDesignedExperienceWeight: z.enum(["H", "M", "L"]).default("M"),
  alignmentDesignedExperienceWeight: z.enum(["H", "M", "L"]).default("M"),
});
export type RingDesignMeasureWeights = z.infer<typeof ringDesignMeasureWeightsSchema>;

export const ringDesignMeasureBasedSchema = z.object({
  dimensions: ringDesignMeasureDimensionsSchema.default({}),
  weights: ringDesignMeasureWeightsSchema.default({
    aimsWeight: "M",
    completenessDesignedExperienceWeight: "M",
    qualityCompletenessSrrWeight: "M",
    coherenceDesignedExperienceWeight: "M",
    alignmentDesignedExperienceWeight: "M",
  }),
});
export type RingDesignMeasureBased = z.infer<typeof ringDesignMeasureBasedSchema>;

export const ringDesignScoreDataSchema = z.object({
  designScoringMode: z.enum(["overall", "multi"]).default("overall"),
  actors: z.array(z.string()).default([]),
  filter: scoreFilterSchema.default({ mode: "none", aggregation: "singleLatest" }),
  canonicalTree: scoreTreeSchema.optional(),
  measureBasedDesign: ringDesignMeasureBasedSchema.default({}),
  overallDesignScore: z.number().int().min(1).max(5).nullable().default(null),
  overallInstances: z.array(scoreInstanceSchema).default([]),
  overallMeasures: z.array(measureSchema).default([]),
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

export const ringImplementationDimensionKeySchema = z.enum([
  "studentsEnrollment",
  "feasibilitySustainability",
  "fidelityDesignedExperience",
  "qualityDelivery",
  "measurementAdministrationQuality",
]);
export type RingImplementationDimensionKey = z.infer<typeof ringImplementationDimensionKeySchema>;

export const ringImplementationItemPrioritySchema = z.enum(["H", "M", "L"]);
export type RingImplementationItemPriority = z.infer<typeof ringImplementationItemPrioritySchema>;

export const ringImplementationInstanceSchema = scoreInstanceSchema;
export type RingImplementationInstance = z.infer<typeof ringImplementationInstanceSchema>;

export const ringImplementationFilterSchema = scoreFilterSchema;
export type RingImplementationFilter = z.infer<typeof ringImplementationFilterSchema>;

export const ringImplementationMeasureNodeSchema = z.object({
  measures: z.array(measureSchema).default([]),
});
export type RingImplementationMeasureNode = z.infer<typeof ringImplementationMeasureNodeSchema>;

export const ringImplementationSkillfulnessMeasureSchema = z.object({
  classroomManagementDeliveryOutcomes: ringImplementationMeasureNodeSchema.default({ measures: [] }),
  inspireMotivateEngagement: ringImplementationMeasureNodeSchema.default({ measures: [] }),
  childWeights: z
    .object({
      classroomManagementDeliveryOutcomesWeight: z.enum(["H", "M", "L"]).default("M"),
      inspireMotivateEngagementWeight: z.enum(["H", "M", "L"]).default("M"),
    })
    .default({
      classroomManagementDeliveryOutcomesWeight: "M",
      inspireMotivateEngagementWeight: "M",
    }),
});
export type RingImplementationSkillfulnessMeasure = z.infer<typeof ringImplementationSkillfulnessMeasureSchema>;

export const ringImplementationMeasureDimensionsSchema = z.object({
  studentsEnrollment: ringImplementationMeasureNodeSchema.default({ measures: [] }),
  feasibilitySustainability: ringImplementationMeasureNodeSchema.default({ measures: [] }),
  fidelityDesignedExperience: ringImplementationMeasureNodeSchema.default({ measures: [] }),
  skillfulnessInstructionFacilitation: ringImplementationSkillfulnessMeasureSchema.default({}),
  measurementAdministrationQuality: ringImplementationMeasureNodeSchema.default({ measures: [] }),
});
export type RingImplementationMeasureDimensions = z.infer<typeof ringImplementationMeasureDimensionsSchema>;

export const ringImplementationMeasureWeightsSchema = z.object({
  studentsEnrollmentWeight: z.enum(["H", "M", "L"]).default("M"),
  feasibilitySustainabilityWeight: z.enum(["H", "M", "L"]).default("M"),
  fidelityDesignedExperienceWeight: z.enum(["H", "M", "L"]).default("M"),
  skillfulnessInstructionFacilitationWeight: z.enum(["H", "M", "L"]).default("M"),
  measurementAdministrationQualityWeight: z.enum(["H", "M", "L"]).default("M"),
});
export type RingImplementationMeasureWeights = z.infer<typeof ringImplementationMeasureWeightsSchema>;

export const ringImplementationMeasureBasedSchema = z.object({
  dimensions: ringImplementationMeasureDimensionsSchema.default({}),
  weights: ringImplementationMeasureWeightsSchema.default({
    studentsEnrollmentWeight: "M",
    feasibilitySustainabilityWeight: "M",
    fidelityDesignedExperienceWeight: "M",
    skillfulnessInstructionFacilitationWeight: "M",
    measurementAdministrationQualityWeight: "M",
  }),
});
export type RingImplementationMeasureBased = z.infer<typeof ringImplementationMeasureBasedSchema>;

export const ringImplementationDimensionSchema = z.object({
  scoringMode: z.enum(["overall", "items"]).default("overall"),
  itemsKind: z.enum(["subcomponent", "component"]).optional(),
  items: z
    .array(
      z.object({
        key: z.string(),
        label: z.string().default(""),
        priority: ringImplementationItemPrioritySchema.default("M"),
        score: z.number().int().min(1).max(5).nullable().default(null),
        instances: z.array(ringImplementationInstanceSchema).default([]),
        confidence: z.enum(["H", "M", "L"]).default("M"),
        rationale: z.string().optional(),
      }),
    )
    .default([]),
  instances: z.array(ringImplementationInstanceSchema).default([]),
  score: z.number().int().min(1).max(5).nullable().default(null),
  rationale: z.string().optional(),
  confidence: z.enum(["H", "M", "L"]).default("M"),
  weight: z.enum(["H", "M", "L"]).default("M"),
});

export type RingImplementationDimension = z.infer<typeof ringImplementationDimensionSchema>;

export const ringImplementationScoreDataSchema = z.object({
  implementationScoringMode: z.enum(["overall", "multi"]).default("overall"),
  actors: z.array(z.string()).default([]),
  filter: ringImplementationFilterSchema.default({ mode: "none", aggregation: "singleLatest" }),
  canonicalTree: scoreTreeSchema.optional(),
  measureBasedImplementation: ringImplementationMeasureBasedSchema.default({}),
  overallInstances: z.array(ringImplementationInstanceSchema).default([]),
  overallMeasures: z.array(measureSchema).default([]),
  overallImplementationScore: z.number().int().min(1).max(5).nullable().default(null),
  overallImplementationRationale: z.string().optional(),
  overallImplementationConfidence: z.enum(["H", "M", "L"]).default("M"),
  dimensions: z
    .object({
      studentsEnrollment: ringImplementationDimensionSchema.default({ instances: [], score: null, weight: "M" }),
      feasibilitySustainability: ringImplementationDimensionSchema.default({ instances: [], score: null, weight: "M" }),
      fidelityDesignedExperience: ringImplementationDimensionSchema.default({ instances: [], score: null, weight: "M" }),
      qualityDelivery: ringImplementationDimensionSchema.default({ instances: [], score: null, weight: "M" }),
      measurementAdministrationQuality: ringImplementationDimensionSchema.default({ instances: [], score: null, weight: "M" }),
    })
    // Keep legacy dimension keys in stored JSON without stripping.
    .passthrough()
    .default({
      studentsEnrollment: { instances: [], score: null, weight: "M" },
      feasibilitySustainability: { instances: [], score: null, weight: "M" },
      fidelityDesignedExperience: { instances: [], score: null, weight: "M" },
      qualityDelivery: { instances: [], score: null, weight: "M" },
      measurementAdministrationQuality: { instances: [], score: null, weight: "M" },
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

export const ringConditionsInstanceSchema = z.object({
  id: z.string().optional(),
  asOfDate: z.string().default(""),
  actor: z.string().default(""),
  windStrength: z.enum(["H", "M", "L"]).default("M"),
  rationale: z.string().optional(),
});
export type RingConditionsInstance = z.infer<typeof ringConditionsInstanceSchema>;

export const ringConditionItemSchema = z.object({
  id: z.string(),
  stakeholderGroup: ringConditionsStakeholderGroupSchema,
  direction: ringConditionsDirectionSchema,
  // Legacy (pre-instances): keep for lazy migration fallback.
  windStrength: z.enum(["H", "M", "L"]).optional().default("M"),
  instances: z.array(ringConditionsInstanceSchema).default([]),
  cs: z.array(ringConditionsCKeySchema).default([]),
  description: z.string().default(""),
  dateLogged: z.string().optional(),
});
export type RingConditionItem = z.infer<typeof ringConditionItemSchema>;

export const ringConditionsScoreDataSchema = z
  .object({
    actors: z.array(z.string()).default([]),
    filter: scoreFilterSchema.default({ mode: "none", aggregation: "singleLatest" }),
    conditions: z.array(ringConditionItemSchema).default([]),
    finalConditionsScore: z.number().int().min(1).max(5).nullable().default(null),
    conditionsSum: z.number().nullable().default(null),
  })
  // Keep legacy keys in stored JSON (e.g. stakeholderWeights) without stripping.
  .passthrough();
export type RingConditionsScoreData = z.infer<typeof ringConditionsScoreDataSchema>;
