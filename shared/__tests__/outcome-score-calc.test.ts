import { describe, it, expect } from "vitest";
import { effectiveFromInstances, getEffectiveInstanceIds } from "../score-instances";
import { calcMeasureScore } from "../outcome-score-calc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inst(overrides: Partial<{
  id: string;
  actor: string;
  asOfDate: string;
  score: number | null;
  importance: "H" | "M" | "L";
  confidence: "H" | "M" | "L";
  retired: boolean;
}>) {
  return {
    id: overrides.id ?? "i1",
    actor: overrides.actor ?? "alice",
    asOfDate: overrides.asOfDate ?? "2025-10-15",
    score: overrides.score ?? 3,
    weight: "M" as const,
    importance: overrides.importance ?? "M",
    confidence: overrides.confidence ?? "M",
    rationale: "",
    retired: overrides.retired ?? false,
  };
}

const yearFilter = { mode: "year" as const, yearKey: "2025" }; // Sep 2025 – Aug 2026, end = 2026-08-31
const semFallFilter = { mode: "semester" as const, semesterKey: "2025-Fall" }; // Sep–Dec 2025, end = 2025-12-31
const noFilter = { mode: "none" as const };

// ─── effectiveFromInstances ───────────────────────────────────────────────────

describe("effectiveFromInstances", () => {
  it("returns null when no instances", () => {
    expect(effectiveFromInstances([], yearFilter).score).toBeNull();
  });

  it("single instance — returns its score directly", () => {
    const result = effectiveFromInstances([inst({ score: 4 })], yearFilter);
    expect(result.score).toBe(4);
  });

  it("excludes retired instances", () => {
    const instances = [
      inst({ id: "i1", score: 4, retired: false }),
      inst({ id: "i2", actor: "alice", score: 2, retired: true }),
    ];
    // Only non-retired i1 should count
    const result = effectiveFromInstances(instances, noFilter);
    expect(result.score).toBe(4);
  });

  it("excludes instances outside period end date", () => {
    const instances = [
      inst({ id: "i1", asOfDate: "2025-11-01", score: 4 }), // within Fall (≤ 2025-12-31)
      inst({ id: "i2", actor: "bob", asOfDate: "2026-01-15", score: 2 }), // after Fall end
    ];
    const result = effectiveFromInstances(instances, semFallFilter);
    // Only alice's instance counts
    expect(result.score).toBe(4);
  });

  it("includes instances on or before period end date", () => {
    const instances = [
      inst({ id: "i1", asOfDate: "2025-12-31", score: 3 }), // exactly on end date
    ];
    const result = effectiveFromInstances(instances, semFallFilter);
    expect(result.score).toBe(3);
  });

  it("includes all instances from the same actor (no per-actor deduplication)", () => {
    // Both alice instances contribute: score 2 (MM=3) + score 5 (MM=3) → avg = 3.5 → clamps to 4
    const instances = [
      inst({ id: "i1", actor: "alice", asOfDate: "2025-09-01", score: 2 }),
      inst({ id: "i2", actor: "alice", asOfDate: "2025-11-01", score: 5 }),
    ];
    const result = effectiveFromInstances(instances, yearFilter);
    expect(result.score).toBe(4);
  });

  it("actor filter — only includes specified actor", () => {
    const instances = [
      inst({ id: "i1", actor: "alice", score: 4 }),
      inst({ id: "i2", actor: "bob", score: 2 }),
    ];
    const filterWithActor = { ...yearFilter, actorKey: "alice" };
    const result = effectiveFromInstances(instances, filterWithActor);
    expect(result.score).toBe(4);
  });

  it("weighted average across multiple actors", () => {
    // alice: MM = weight 3, score 4; bob: HH = weight 5, score 2
    // avg = (4*3 + 2*5) / (3+5) = (12+10)/8 = 22/8 = 2.75 → rounds to 3
    const instances = [
      inst({ id: "i1", actor: "alice", score: 4, importance: "M", confidence: "M" }),
      inst({ id: "i2", actor: "bob", score: 2, importance: "H", confidence: "H" }),
    ];
    const result = effectiveFromInstances(instances, noFilter);
    expect(result.score).toBe(3);
  });

  it("returns null when all instances are retired", () => {
    const instances = [
      inst({ id: "i1", score: 4, retired: true }),
      inst({ id: "i2", actor: "bob", score: 3, retired: true }),
    ];
    expect(effectiveFromInstances(instances, noFilter).score).toBeNull();
  });

  it("returns null when all instances are outside period", () => {
    const instances = [
      inst({ id: "i1", asOfDate: "2026-01-15", score: 4 }), // after Fall 2025 end
    ];
    expect(effectiveFromInstances(instances, semFallFilter).score).toBeNull();
  });
});

// ─── getEffectiveInstanceIds ──────────────────────────────────────────────────

describe("getEffectiveInstanceIds", () => {
  it("returns empty set for empty instances", () => {
    expect(getEffectiveInstanceIds([], yearFilter).size).toBe(0);
  });

  it("returns all non-retired instance ids (no per-actor deduplication)", () => {
    const instances = [
      inst({ id: "i1", actor: "alice", asOfDate: "2025-09-01", score: 3 }),
      inst({ id: "i2", actor: "alice", asOfDate: "2025-11-01", score: 4 }),
    ];
    const ids = getEffectiveInstanceIds(instances, yearFilter);
    expect(ids.has("i1")).toBe(true);
    expect(ids.has("i2")).toBe(true);
  });

  it("excludes retired instances from effective set", () => {
    const instances = [
      inst({ id: "i1", score: 4, retired: false }),
      inst({ id: "i2", actor: "bob", score: 3, retired: true }),
    ];
    const ids = getEffectiveInstanceIds(instances, noFilter);
    expect(ids.has("i1")).toBe(true);
    expect(ids.has("i2")).toBe(false);
  });

  it("excludes out-of-period instances from effective set", () => {
    const instances = [
      inst({ id: "i1", asOfDate: "2025-10-15", score: 4 }),       // within Fall
      inst({ id: "i2", actor: "bob", asOfDate: "2026-02-01", score: 3 }), // outside Fall
    ];
    const ids = getEffectiveInstanceIds(instances, semFallFilter);
    expect(ids.has("i1")).toBe(true);
    expect(ids.has("i2")).toBe(false);
  });
});

// ─── calcMeasureScore ─────────────────────────────────────────────────────────

describe("calcMeasureScore", () => {
  const makeMeasure = (instances: ReturnType<typeof inst>[]) => ({
    id: "m1",
    name: "Test",
    instances,
    subDimensionIds: [],
    description: "",
    importance: "M" as const,
    confidence: "M" as const,
    type: "measure" as const,
    portedFromId: undefined,
    portedFlag: false,
    periodHistory: [],
    crossOutcome: false,
    appliesTo: "All students",
    priority: "M" as const,
    rating: null,
    reflectionAchievement: "",
    reflectionVariability: "",
    skipped: false,
  });

  it("returns null for measure with no instances", () => {
    expect(calcMeasureScore(makeMeasure([]), yearFilter)).toBeNull();
  });

  it("returns correct score for single instance in period", () => {
    const m = makeMeasure([inst({ asOfDate: "2025-10-01", score: 4 })]);
    expect(calcMeasureScore(m, yearFilter)).toBe(4);
  });

  it("returns null for measure whose only instance is retired", () => {
    const m = makeMeasure([inst({ score: 4, retired: true })]);
    expect(calcMeasureScore(m, yearFilter)).toBeNull();
  });

  it("returns null for measure whose only instance is outside period", () => {
    const m = makeMeasure([inst({ asOfDate: "2026-01-15", score: 4 })]);
    expect(calcMeasureScore(m, semFallFilter)).toBeNull();
  });
});
