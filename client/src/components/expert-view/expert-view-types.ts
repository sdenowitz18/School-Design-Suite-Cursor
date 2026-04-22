export type ComponentType = 'center' | 'ring';

export type Archetype = 'A1' | 'A2' | 'A3' | 'A3Ratio' | 'A3Pair' | 'A4' | 'A5' | 'A2Tension';

export interface TagDef {
  id: string;
  label: string;
  secondaries?: TagDef[];
}

/** Group tags under a discipline heading (e.g. ELA vs Mathematics) within one A-1 bucket. */
export interface DisciplineGroupDef {
  id: string;
  label: string;
  tags: TagDef[];
}

/** One row in the A-2 (Unique) tension block: pick left or right emphasis. */
export interface TensionPairDef {
  id: string;
  question: string;
  leftLabel: string;
  rightLabel: string;
}

export interface BucketDef {
  id: string;
  title: string;
  archetype: Archetype | 'MultiSelect';
  customAllowed?: boolean;
  centerOnly?: boolean;
  ringOnly?: boolean;
  /** Hide this bucket entirely at the center level — no editor, no rollup placeholder. */
  hideAtCenter?: boolean;
  /** Show “Adult experience” badge; buckets still visible so nothing is missed. */
  adultOnly?: boolean;
  contextNote?: string;
  units?: string[];
  /** For archetype A3Pair: field labels for the two number inputs. */
  pairLabels?: [string, string];
  /** For archetype A3Pair: optional placeholders for the two number inputs. */
  pairPlaceholders?: [string, string];
  tags?: TagDef[];
  /** For archetype A2Tension only */
  tensions?: TensionPairDef[];
  /** For A-1: show tags in sections with bold discipline headers (e.g. core/supplemental curricula). */
  disciplineGroups?: DisciplineGroupDef[];
  /**
   * Ring components only: offer “Same as school-wide” vs “Different” for this bucket;
   * school-wide values come from the `overall` component’s expert data.
   */
  ringSchoolWideChoice?: boolean;
  placeholder?: string;
  /**
   * When set, this bucket's value is stored in (and read from) the shared
   * `data['__shared__'][syncedBucketId]` slot instead of the element-scoped
   * namespace. All buckets with the same `syncedBucketId` across any element
   * share a single selection state.
   */
  syncedBucketId?: string;
  /**
   * When true, display A1 items in the center card as "Primary (Secondary1, Secondary2)"
   * instead of the default which shows secondary labels as separate bullets.
   * Used for buckets like CI "Broader set of community contributors" and Ops "Hardware / tech devices".
   */
  groupedSecondaryDisplay?: boolean;
}

export type ElementSection = 'practices' | 'tools';

export interface QuestionDef {
  id: string;
  question: string;
  section: ElementSection;
  buckets: BucketDef[];
}

export interface ElementDef {
  id: string;
  title: string;
  shortTitle: string;
  questions: QuestionDef[];
}

// ─── Value Types ───────────────────────────────────────────────────────────────

export interface SecondarySelection {
  tagId: string;
  isKey: boolean;
  notes: string;
}

export interface TagSelection {
  tagId: string;
  isCustom?: boolean;
  customLabel?: string;
  isKey: boolean;
  notes: string;
  selectedSecondaries: SecondarySelection[];
}

export interface A1Value {
  selections: TagSelection[];
  /** Ring + `ringSchoolWideChoice`: mirror school-wide tag selections when true. */
  inheritFromSchool?: boolean;
}

export interface A2Value {
  selectedId: string | null;
  isCustom?: boolean;
  customLabel?: string;
  isKey: boolean;
  notes: string;
}

export interface A3Value {
  value: number | null;
  unit: string;
  description: string;
  isKey: boolean;
}

export interface A3RatioValue {
  learners: number | null;
  facilitators: number | null;
  isKey: boolean;
}

export interface A3PairValue {
  first: number | null;
  second: number | null;
  isKey: boolean;
}

export interface A4Value {
  days: string[];
  time: string;
  recurrence: string;
  notes: string;
  isKey: boolean;
}

export interface A5Value {
  text: string;
  inheritFromSchool: boolean;
  isKey: boolean;
}

export interface A2TensionValue {
  /** tension id → which side is emphasized */
  selections: Record<string, 'left' | 'right' | null>;
}

// ─── Yearly Schedule ───────────────────────────────────────────────────────────

export interface YearlyScheduleEntry {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface YearlyScheduleValue {
  entries: YearlyScheduleEntry[];
}

// ─── Marking Periods ───────────────────────────────────────────────────────────

export type MarkingPeriodType = 'semester' | 'trimester' | 'quarter';

export interface MarkingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface MarkingPeriodsValue {
  periodType: MarkingPeriodType | null;
  periods: MarkingPeriod[];
}

// ─── Bucket Value ──────────────────────────────────────────────────────────────

export interface BucketValue {
  archetypeA1?: A1Value;
  archetypeA2?: A2Value;
  archetypeA2Tension?: A2TensionValue;
  archetypeA3?: A3Value;
  archetypeA3Ratio?: A3RatioValue;
  archetypeA3Pair?: A3PairValue;
  archetypeA4?: A4Value;
  archetypeA5?: A5Value;
  yearlySchedule?: YearlyScheduleValue;
  markingPeriods?: MarkingPeriodsValue;
  plainLanguageAnswer?: string;
}

export interface ElementsExpertData {
  [elementId: string]: {
    [bucketId: string]: BucketValue;
  };
}
