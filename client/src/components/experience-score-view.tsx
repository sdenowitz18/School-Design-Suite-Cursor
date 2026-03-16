import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  Sparkles,
  Heart,
  Users,
  Zap,
  Globe,
  BarChart3,
  Lock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { effectiveFromInstances, UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import {
  getQuarterKey,
  getSchoolYearKey,
  getSemesterKey,
  listSelectableQuarterKeys,
  listSelectableSemesterKeys,
  listSelectableYearKeys,
  minAsOfDate,
  toIsoDateString,
} from "@shared/marking-period";
import type { ExperienceScoreData, ExperienceDimension, Measure, ScoreFilter, ScoreInstance } from "@shared/schema";
import ScoreFilterBar from "./score-filter-bar";
import ScoreFlags from "./score-flags";
import { useGlobalActors } from "@/lib/actors-store";

const PRIORITY_WEIGHT: Record<string, number> = { H: 6, M: 3, L: 1 };
type LeapsScoringMode = "across" | "individual";
type Hml = "H" | "M" | "L";

type LeapItem = {
  id: string;
  label: string;
  autoWeight: Hml;
  weight: Hml;
  weightMode: "auto" | "manual";
  measures: Measure[];
};

function normalizeHml(value: unknown): Hml {
  return value === "H" || value === "M" || value === "L" ? value : "M";
}

function normLabel(s: string): string {
  return s.trim().toLowerCase();
}

function defaultWeightFromLevel(level: unknown): Hml {
  if (level === "High") return "H";
  if (level === "Medium") return "M";
  if (level === "Low") return "L";
  return "M";
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

type MarkingPeriodMode = "year" | "semester" | "quarter";

function getMeasureMarkingPeriod(measure: Measure): { mode: MarkingPeriodMode; key: string } {
  const rawMode = (measure as any)?.markingPeriodMode;
  const mode: MarkingPeriodMode = rawMode === "semester" || rawMode === "quarter" ? rawMode : "year";
  const rawKey = String((measure as any)?.markingPeriodKey || "").trim();
  const instances = Array.isArray((measure as any)?.instances) ? ((measure as any).instances as ScoreInstance[]) : [];
  const firstWithDate = instances.find((i) => String(i?.asOfDate || "").trim().length > 0);

  if (rawKey) return { mode, key: rawKey };
  if (!firstWithDate) {
    const yearKey = listSelectableYearKeys(new Date(), 5)[0];
    if (mode === "semester") return { mode, key: `${yearKey}-Fall` };
    if (mode === "quarter") return { mode, key: `${yearKey}-Q1` };
    return { mode, key: yearKey };
  }

  const d = new Date(`${String(firstWithDate.asOfDate)}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    const yearKey = listSelectableYearKeys(new Date(), 5)[0];
    if (mode === "semester") return { mode, key: `${yearKey}-Fall` };
    if (mode === "quarter") return { mode, key: `${yearKey}-Q1` };
    return { mode, key: yearKey };
  }
  if (mode === "semester") return { mode, key: getSemesterKey(d) };
  if (mode === "quarter") return { mode, key: getQuarterKey(d) };
  return { mode, key: getSchoolYearKey(d) };
}

function markingPeriodKeyToIsoDate(mode: MarkingPeriodMode, key: string): string | null {
  if (mode === "year") {
    const y = Number(key);
    if (!Number.isFinite(y)) return null;
    return `${String(y)}-09-15`;
  }
  const [yStr, part] = String(key).split("-");
  const y = Number(yStr);
  if (!Number.isFinite(y)) return null;
  if (mode === "semester") {
    if (part === "Fall") return `${String(y)}-10-15`;
    if (part === "Spring") return `${String(y + 1)}-03-15`;
    return null;
  }
  if (part === "Q1") return `${String(y)}-10-15`;
  if (part === "Q2") return `${String(y)}-12-15`;
  if (part === "Q3") return `${String(y + 1)}-02-15`;
  if (part === "Q4") return `${String(y + 1)}-05-15`;
  return null;
}

function markingPeriodLabel(mode: MarkingPeriodMode, key: string): string {
  if (mode === "year") return String(key);
  const [y, part] = String(key).split("-");
  if (!y || !part) return key;
  if (mode === "semester") return `${y} ${part === "Fall" ? "S1" : "S2"}`;
  return `${y} ${part}`;
}

function weightedAverage(items: { rating: number | null; priority: string; skipped: boolean }[]): number | null {
  let count = 0;
  let total = 0;
  for (const item of items) {
    if (item.rating === null) continue;
    count += 1;
    total += item.rating;
  }
  if (count === 0) return null;
  return Math.round((total / count) * 100) / 100;
}

function effectiveMeasureRating(measure: Measure, filter: ScoreFilter): number | null {
  const insts: ScoreInstance[] = Array.isArray((measure as any)?.instances) ? ((measure as any).instances as ScoreInstance[]) : [];
  if (insts.length === 0) return null;
  return effectiveFromInstances(insts, filter).score;
}

function calcDimensionScore(dim: ExperienceDimension, filter: ScoreFilter): number | null {
  const items = (dim.measures || []).map((m: any) => ({
    rating: effectiveMeasureRating(m as Measure, filter),
    priority: m?.priority || "M",
    skipped: !!m?.skipped,
  }));
  return weightedAverage(items);
}

function calcLeapScoreFromMeasures(measures: Measure[], filter: ScoreFilter): number | null {
  const items = (measures || []).map((m: any) => ({
    rating: effectiveMeasureRating(m as Measure, filter),
    priority: m?.priority || "M",
    skipped: !!m?.skipped,
  }));
  return weightedAverage(items);
}

function calcLeapsDimensionScoreFromItems(items: LeapItem[], filter: ScoreFilter): number | null {
  let totalWeight = 0;
  let total = 0;
  for (const item of items) {
    const score = calcLeapScoreFromMeasures(item.measures, filter);
    if (score === null) continue;
    const w = PRIORITY_WEIGHT[item.weight] || 1;
    totalWeight += w;
    total += score * w;
  }
  if (totalWeight === 0) return null;
  return Math.round((total / totalWeight) * 100) / 100;
}

function calcWeights(leapCount: number): { leapsWeight: number; healthWeight: number; behaviorWeight: number } {
  let leapsWeight = 0;
  if (leapCount >= 5) leapsWeight = 0.60;
  else if (leapCount >= 3) leapsWeight = 0.50;
  else if (leapCount >= 1) leapsWeight = 0.40;
  const remaining = 1.00 - leapsWeight;
  return { leapsWeight, healthWeight: remaining / 2, behaviorWeight: remaining / 2 };
}

function calcRedistributedWeights(
  baseWeights: { leapsWeight: number; healthWeight: number; behaviorWeight: number },
  leapsDimScore: number | null,
  healthDimScore: number | null,
  behaviorDimScore: number | null,
): { leaps: number; health: number; behavior: number } {
  const dims: { key: string; weight: number; scored: boolean }[] = [];

  if (baseWeights.leapsWeight > 0) {
    dims.push({ key: "leaps", weight: baseWeights.leapsWeight, scored: leapsDimScore !== null });
  }
  dims.push({ key: "health", weight: baseWeights.healthWeight, scored: healthDimScore !== null });
  dims.push({ key: "behavior", weight: baseWeights.behaviorWeight, scored: behaviorDimScore !== null });

  const scoredDims = dims.filter(d => d.scored);
  if (scoredDims.length === 0) {
    return {
      leaps: baseWeights.leapsWeight,
      health: baseWeights.healthWeight,
      behavior: baseWeights.behaviorWeight,
    };
  }
  const missingWeight = dims.filter(d => !d.scored).reduce((s, d) => s + d.weight, 0);
  const redistPerDim = scoredDims.length > 0 ? missingWeight / scoredDims.length : 0;

  const result = { leaps: 0, health: 0, behavior: 0 };
  for (const d of dims) {
    const adjusted = d.scored ? d.weight + redistPerDim : 0;
    (result as any)[d.key] = adjusted;
  }
  return result;
}

function calcEmergentStatesScore(
  healthDimScore: number | null,
  behaviorDimScore: number | null,
  healthWeight: number,
  behaviorWeight: number,
): number | null {
  if (healthDimScore === null && behaviorDimScore === null) return null;
  if (healthDimScore !== null && behaviorDimScore === null) return healthDimScore;
  if (behaviorDimScore !== null && healthDimScore === null) return behaviorDimScore;
  const totalWeight = healthWeight + behaviorWeight;
  if (totalWeight <= 0) return null;
  return Math.round((((healthDimScore as number) * healthWeight + (behaviorDimScore as number) * behaviorWeight) / totalWeight) * 100) / 100;
}

function calcTwoDimensionFinalScore(
  leapsDimScore: number | null,
  emergentDimScore: number | null,
  weights: { leapsWeight: number; emergentWeight: number },
): number | null {
  if (weights.leapsWeight > 0 && leapsDimScore === null) return null;
  let totalWeight = 0;
  let total = 0;
  if (leapsDimScore !== null && weights.leapsWeight > 0) {
    totalWeight += weights.leapsWeight;
    total += leapsDimScore * weights.leapsWeight;
  }
  if (emergentDimScore !== null && weights.emergentWeight > 0) {
    totalWeight += weights.emergentWeight;
    total += emergentDimScore * weights.emergentWeight;
  }
  if (totalWeight <= 0) return null;
  return Math.round((total / totalWeight) * 100) / 100;
}

function roundFinal1to5(score: number | null): number | null {
  if (score === null) return null;
  const rounded = Math.round(score);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

function createMeasure(name: string = ""): Measure {
  return {
    id: generateId(),
    name,
    appliesTo: "All students",
    priority: "M",
    confidence: "M",
    rating: null,
    instances: [],
    justification: "",
    reflectionAchievement: "",
    reflectionVariability: "",
    skipped: false,
  };
}

function ScoreChip({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  if (score === null) return (
    <div className={cn(
      "flex items-center justify-center rounded-md bg-gray-100 text-gray-400 font-bold border border-gray-200",
      size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-16 h-12 text-2xl" : "w-10 h-10 text-lg"
    )}>
      —
    </div>
  );

  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  const color =
    rounded >= 4
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : rounded >= 3
        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
        : "bg-red-100 text-red-700 border-red-200";

  return (
    <div className={cn(
      "flex items-center justify-center rounded-md font-bold border",
      color,
      size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-16 h-12 text-2xl" : "w-10 h-10 text-lg"
    )} data-testid="score-chip">
      {rounded}
    </div>
  );
}

function generateAISummary(
  leaps: ExperienceDimension,
  health: ExperienceDimension,
  behavior: ExperienceDimension,
  leapsDimScore: number | null,
  healthDimScore: number | null,
  behaviorDimScore: number | null,
  finalScore: number | null,
  filter: ScoreFilter,
): string {
  const allMeasures = [...leaps.measures, ...health.measures, ...behavior.measures];
  const rated = allMeasures.filter((m) => effectiveMeasureRating(m as any, filter) !== null);

  if (rated.length === 0) {
    return "No measures have been scored yet. Add measures and instances across dimensions to see a summary.";
  }

  let summary = `Experience score is ${finalScore !== null ? String(finalScore) : "pending"}.`;

  if (leapsDimScore !== null) {
    summary += ` Leaps dimension: ${String(Math.max(1, Math.min(5, Math.round(leapsDimScore))))}.`;
    const strong = leaps.measures.filter((m) => (effectiveMeasureRating(m as any, filter) ?? 0) >= 4);
    const weak = leaps.measures.filter((m) => effectiveMeasureRating(m as any, filter) !== null && (effectiveMeasureRating(m as any, filter) || 0) < 3);
    if (strong.length > 0) summary += ` Strong: ${strong.map(m => m.name).join(", ")}.`;
    if (weak.length > 0) summary += ` Needs attention: ${weak.map(m => m.name).join(", ")}.`;
  } else {
    summary += " Leaps dimension awaiting scores.";
  }

  if (health.measures.length === 0) {
    summary += " Health dimension excluded (no measures).";
  } else if (healthDimScore !== null) {
    summary += ` Health: ${String(Math.max(1, Math.min(5, Math.round(healthDimScore))))}.`;
  }

  if (behavior.measures.length === 0) {
    summary += " Behavior dimension excluded (no measures).";
  } else if (behaviorDimScore !== null) {
    summary += ` Behavior: ${String(Math.max(1, Math.min(5, Math.round(behaviorDimScore))))}.`;
  }

  return summary;
}

function MeasureCard({
  measure,
  onUpdate,
  onDelete,
  sectionDisabled,
  actors,
  onAddActor,
  filter,
}: {
  measure: Measure;
  onUpdate: (m: Measure) => void;
  onDelete: () => void;
  sectionDisabled?: boolean;
  actors: string[];
  onAddActor?: (label: string) => void;
  filter: ScoreFilter;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDisabled = !!sectionDisabled;
  const minDate = useMemo(() => minAsOfDate(new Date(), 5), []);
  const yearKeys = useMemo(() => listSelectableYearKeys(new Date(), 5), []);
  const semesterKeys = useMemo(() => listSelectableSemesterKeys(new Date(), 5), []);
  const quarterKeys = useMemo(() => listSelectableQuarterKeys(new Date(), 5), []);
  const score = useMemo(() => effectiveMeasureRating(measure, filter), [filter, measure]);
  const selectedMarkingPeriod = useMemo(() => getMeasureMarkingPeriod(measure), [measure]);
  const actorOptions = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const a of Array.isArray(actors) ? actors : []) {
      const clean = String(a ?? "").trim();
      if (!clean) continue;
      const key = normActor(clean);
      if (!key || key === UNKNOWN_ACTOR_KEY) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: clean });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [actors]);
  const actorLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of actorOptions) m.set(a.key, a.label);
    return m;
  }, [actorOptions]);
  const ADD_NEW_KEY = "__add_new__";
  const [addingByInstId, setAddingByInstId] = useState<Record<string, boolean>>({});
  const [draftByInstId, setDraftByInstId] = useState<Record<string, string>>({});

  const updateInstances = (next: ScoreInstance[]) => {
    onUpdate({ ...measure, rating: null, instances: next });
  };

  const addInstance = () => {
    const initialAsOf =
      markingPeriodKeyToIsoDate(selectedMarkingPeriod.mode, selectedMarkingPeriod.key) || toIsoDateString(new Date());
    const next: ScoreInstance = {
      id: generateId(),
      actor: "",
      asOfDate: initialAsOf,
      score: null,
      weight: "M",
      importance: "M",
      confidence: "M",
      rationale: "",
      retired: false,
    };
    updateInstances([...(measure.instances || []), next]);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        "bg-white border rounded-lg overflow-hidden transition-all",
        isDisabled ? "opacity-50 border-gray-200 bg-gray-50" : "border-gray-200 shadow-sm"
      )} data-testid={`measure-card-${measure.id}`}>
        <CollapsibleTrigger asChild>
          <div className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50/50 transition-colors cursor-pointer group" role="button" tabIndex={0} data-testid={`measure-trigger-${measure.id}`}>
            <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
              <div className={cn(
                "w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0",
                score !== null
                  ? score >= 4 ? "bg-emerald-100 text-emerald-700" :
                    score === 3 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-400"
              )}>
                {score !== null ? score : "—"}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate block">{measure.name || "Untitled measure"}</span>
                {String((measure as any)?.justification || "").trim() ? (
                  <div className="text-[10px] text-gray-500 truncate mt-0.5">
                    {String((measure as any)?.justification || "")}
                  </div>
                ) : null}
                <div className="text-[10px] text-gray-400 mt-0.5">Marking period: {markingPeriodLabel(selectedMarkingPeriod.mode, selectedMarkingPeriod.key)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                Instances {(measure.instances || []).length}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-gray-100 px-3 py-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2.5">
                <div>
                  <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Measure Name</Label>
                  <Input
                    value={measure.name}
                    onChange={(e) => onUpdate({ ...measure, name: e.target.value })}
                    placeholder="Measure name..."
                    className="h-8 text-sm"
                    disabled={isDisabled}
                    data-testid={`input-measure-name-${measure.id}`}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Description</Label>
                  <Textarea
                    value={String((measure as any)?.justification || "")}
                    onChange={(e) => onUpdate({ ...measure, justification: e.currentTarget.value })}
                    placeholder="Describe this measure..."
                    className="text-xs min-h-[64px] bg-white"
                    disabled={isDisabled}
                    data-testid={`input-measure-description-${measure.id}`}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Marking period</Label>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                      value={selectedMarkingPeriod.mode}
                      onChange={(e) => {
                        const raw = e.currentTarget.value;
                        const nextMode: MarkingPeriodMode = raw === "semester" || raw === "quarter" ? raw : "year";
                        const nextKey =
                          nextMode === "semester" ? semesterKeys[0] : nextMode === "quarter" ? quarterKeys[0] : yearKeys[0];
                        onUpdate({ ...(measure as any), markingPeriodMode: nextMode, markingPeriodKey: nextKey });
                      }}
                      disabled={isDisabled}
                      data-testid={`measure-marking-period-mode-${measure.id}`}
                    >
                      <option value="year">year</option>
                      <option value="semester">semester</option>
                      <option value="quarter">quarter</option>
                    </select>
                    <select
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                      value={selectedMarkingPeriod.key}
                      onChange={(e) =>
                        onUpdate({
                          ...(measure as any),
                          markingPeriodMode: selectedMarkingPeriod.mode,
                          markingPeriodKey: e.currentTarget.value,
                        })
                      }
                      disabled={isDisabled}
                      data-testid={`measure-marking-period-key-${measure.id}`}
                    >
                      {(selectedMarkingPeriod.mode === "semester"
                        ? semesterKeys
                        : selectedMarkingPeriod.mode === "quarter"
                          ? quarterKeys
                          : yearKeys
                      ).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors p-1" data-testid={`delete-measure-${measure.id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isDisabled && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-gray-500 font-semibold">Instances</Label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] text-gray-500">Uses marking period + aggregation filters to compute this measure’s score.</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1"
                        onClick={addInstance}
                        data-testid={`measure-add-instance-${measure.id}`}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add instance
                      </Button>
                    </div>

                    {(measure.instances || []).length === 0 ? (
                      <div className="text-xs text-gray-400 italic">No instances yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {(measure.instances || []).map((inst) => {
                          const instKey = String(inst?.id || "");
                          const actorValue = normActor(inst?.actor);
                          const isAdding = !!addingByInstId[instKey];
                          return (
                            <div key={instKey} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-gray-600">Actor</span>
                                  <select
                                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                                    value={isAdding ? ADD_NEW_KEY : actorValue}
                                    onChange={(e) => {
                                      const v = e.currentTarget.value;
                                      if (v === ADD_NEW_KEY) {
                                        setAddingByInstId((prev) => ({ ...prev, [instKey]: true }));
                                        return;
                                      }
                                      setAddingByInstId((prev) => ({ ...prev, [instKey]: false }));
                                      updateInstances(
                                        (measure.instances || []).map((x) =>
                                          x.id === inst.id
                                            ? {
                                                ...x,
                                                actor:
                                                  v === UNKNOWN_ACTOR_KEY
                                                    ? ""
                                                    : actorLabelByKey.get(v) || String(v),
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    data-testid={`measure-inst-actor-${measure.id}-${instKey}`}
                                  >
                                    <option value={UNKNOWN_ACTOR_KEY}>Unknown</option>
                                    {actorOptions.map((a) => (
                                      <option key={a.key} value={a.key}>
                                        {a.label}
                                      </option>
                                    ))}
                                    {onAddActor ? <option value={ADD_NEW_KEY}>Add new…</option> : null}
                                  </select>
                                </div>

                                {isAdding && onAddActor ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={draftByInstId[instKey] || ""}
                                      onChange={(e) => {
                                        const v = e.currentTarget?.value ?? "";
                                        setDraftByInstId((prev) => ({ ...prev, [instKey]: v }));
                                      }}
                                      placeholder="New actor…"
                                      className="h-8 w-[150px] text-xs bg-white"
                                      data-testid={`measure-inst-actor-draft-${measure.id}-${instKey}`}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-[11px]"
                                      onClick={() => {
                                        const clean = String(draftByInstId[instKey] || "").trim();
                                        if (!clean) return;
                                        onAddActor(clean);
                                        updateInstances(
                                          (measure.instances || []).map((x) => (x.id === inst.id ? { ...x, actor: clean } : x)),
                                        );
                                        setDraftByInstId((prev) => ({ ...prev, [instKey]: "" }));
                                        setAddingByInstId((prev) => ({ ...prev, [instKey]: false }));
                                      }}
                                    >
                                      Add
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-[11px] text-gray-500"
                                      onClick={() => {
                                        setDraftByInstId((prev) => ({ ...prev, [instKey]: "" }));
                                        setAddingByInstId((prev) => ({ ...prev, [instKey]: false }));
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : null}

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-gray-600">Marking period</span>
                                  <Input
                                    type="date"
                                    className="h-8 w-[150px] text-xs"
                                    value={String(inst?.asOfDate || "")}
                                    min={minDate}
                                    onChange={(e) => {
                                      const v = e.currentTarget.value;
                                      updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, asOfDate: v } : x)));
                                    }}
                                    data-testid={`measure-inst-date-${measure.id}-${instKey}`}
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-gray-600">Score</span>
                                  <select
                                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                                    value={inst?.score === null || inst?.score === undefined ? "" : String(inst.score)}
                                    onChange={(e) => {
                                      const v = e.currentTarget.value;
                                      updateInstances(
                                        (measure.instances || []).map((x) =>
                                          x.id === inst.id ? { ...x, score: v ? Number(v) : null } : x,
                                        ),
                                      );
                                    }}
                                    data-testid={`measure-inst-score-${measure.id}-${instKey}`}
                                  >
                                    <option value="">—</option>
                                    {[1, 2, 3, 4, 5].map((n) => (
                                      <option key={n} value={String(n)}>
                                        {n}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-gray-600">Weight</span>
                                  <select
                                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                                    value={String(inst?.weight || "M")}
                                    onChange={(e) => {
                                      const v = e.currentTarget.value;
                                      updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, weight: v as any } : x)));
                                    }}
                                    data-testid={`measure-inst-weight-${measure.id}-${instKey}`}
                                  >
                                    <option value="H">H</option>
                                    <option value="M">M</option>
                                    <option value="L">L</option>
                                  </select>
                                </div>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-gray-400 hover:text-red-600"
                                  onClick={() => updateInstances((measure.instances || []).filter((x) => x.id !== inst.id))}
                                  data-testid={`measure-inst-remove-${measure.id}-${instKey}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ExperienceScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
}

export default function ExperienceScoreView({ nodeId, title, onBack, sourceFilter, onFilterChange }: ExperienceScoreViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scoringMode, setScoringMode] = useState<"dimensions" | "overall">("dimensions");
  const [activeDimTab, setActiveDimTab] = useState<"leaps" | "emergent">("leaps");
  const [leapsScoringMode, setLeapsScoringMode] = useState<LeapsScoringMode>("individual");
  const [actors, setActors] = useState<string[]>([]);
  const { actors: globalActors, addActor: addGlobalActor, mergeActors: mergeGlobalActors } = useGlobalActors();
  const [localFilter, setLocalFilter] = useState<ScoreFilter>({
    mode: "year",
    yearKey: listSelectableYearKeys(new Date(), 5)[0],
    aggregation: "singleLatest",
  } as any);
  const filter = sourceFilter || localFilter;
  const setFilter = useCallback(
    (next: ScoreFilter) => {
      onFilterChange?.(next);
      setLocalFilter(next);
    },
    [onFilterChange],
  );
  useEffect(() => {
    if (sourceFilter) setLocalFilter(sourceFilter);
  }, [sourceFilter]);
  const [leaps, setLeaps] = useState<ExperienceDimension>({ instances: [], measures: [], excluded: false });
  const [health, setHealth] = useState<ExperienceDimension>({ instances: [], measures: [], excluded: false });
  const [behavior, setBehavior] = useState<ExperienceDimension>({ instances: [], measures: [], excluded: false });
  const [leapItems, setLeapItems] = useState<LeapItem[]>([]);
  const [overallMeasures, setOverallMeasures] = useState<Measure[]>([]);
  const [newMeasureName, setNewMeasureName] = useState<Record<string, string>>({ leaps: "", health: "", behavior: "" });
  const [newLeapMeasureName, setNewLeapMeasureName] = useState<Record<string, string>>({});
  const [newOverallMeasureName, setNewOverallMeasureName] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (scoringMode === "dimensions") setActiveDimTab("leaps");
  }, [scoringMode]);

  useEffect(() => {
    if (!initialized) return;
    mergeGlobalActors(actors);
  }, [actors, initialized, mergeGlobalActors]);

  const onAddActor = useCallback(
    (label: string) => {
      const clean = String(label ?? "").trim();
      if (!clean) return;
      addGlobalActor(clean);
      setActors((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const seen = new Set(list.map((p) => normActor(p)));
        const key = normActor(clean);
        if (key === UNKNOWN_ACTOR_KEY) return list;
        if (seen.has(key)) return list;
        return [...list, clean];
      });
    },
    [addGlobalActor],
  );

  const normalizeMeasure = (m: Measure): Measure => ({
    ...m,
    skipped: m.priority === "L" ? m.skipped : false,
    confidence: (m as any).confidence === "H" || (m as any).confidence === "M" || (m as any).confidence === "L" ? (m as any).confidence : "M",
    reflectionAchievement: m.reflectionAchievement || "",
    reflectionVariability: m.reflectionVariability || "",
    instances: (() => {
      const raw = Array.isArray((m as any).instances) ? ((m as any).instances as ScoreInstance[]) : [];
      const fixed = raw.map((i: any) => ({ ...i, rationale: String(i?.rationale || "") })) as ScoreInstance[];
      if (raw.length === 0 && m.rating !== null && m.rating !== undefined) {
        return [
          {
            id: generateId(),
            actor: "",
            asOfDate: toIsoDateString(new Date()),
            score: m.rating as any,
            weight: "M",
            importance: "M",
            confidence: "M",
            rationale: "",
            retired: false,
          } satisfies ScoreInstance,
        ];
      }
      return fixed;
    })(),
    rating: null,
  });

  const getLeapAimsFromDE = useCallback((): { id: string; label: string; level?: unknown }[] => {
    if (!comp) return [];
    const de: any = comp.designedExperienceData || {};
    const kde = de.keyDesignElements || {};
    const aims: any[] = kde.aims || [];
    return aims
      .filter((a: any) => a?.type === "leap" && typeof a?.label === "string")
      .map((a: any) => ({ id: String(a.id || a.label), label: String(a.label), level: a.level }));
  }, [comp]);

  const leapCount = useMemo(() => getLeapAimsFromDE().length, [getLeapAimsFromDE]);
  const baseWeights = useMemo(() => calcWeights(leapCount), [leapCount]);

  useEffect(() => {
    if (comp && !initialized) {
      const hd: any = comp.healthData || {};
      const esd: Partial<ExperienceScoreData> = hd.experienceScoreData || {};
      setScoringMode((esd as any).scoringMode || "dimensions");
      setLeapsScoringMode((((esd as any).leapsScoringMode as LeapsScoringMode) || "individual") === "across" ? "individual" : "individual");
      setActors(Array.isArray((esd as any).actors) ? ((esd as any).actors as any[]) : []);
      const saved: any = ((esd as any).filter as any) || {};
      setFilter(
        saved?.mode
          ? (saved as any)
          : ({
              mode: "year",
              yearKey: listSelectableYearKeys(new Date(), 5)[0],
              aggregation: saved?.aggregation || "singleLatest",
              actorKey: saved?.actorKey,
            } as any),
      );
      setLeaps({
        instances: Array.isArray((esd.leaps as any)?.instances)
          ? (((esd.leaps as any).instances as any[]) || []).map((i: any) => ({ ...i, rationale: String(i?.rationale || "") }))
          : [],
        measures: (esd.leaps?.measures || []).map(normalizeMeasure),
        excluded: esd.leaps?.excluded || false,
      });
      setHealth({
        instances: Array.isArray((esd.health as any)?.instances)
          ? (((esd.health as any).instances as any[]) || []).map((i: any) => ({ ...i, rationale: String(i?.rationale || "") }))
          : [],
        measures: (esd.health?.measures || []).map(normalizeMeasure),
        excluded: esd.health?.excluded || false,
      });
      setBehavior({
        instances: Array.isArray((esd.behavior as any)?.instances)
          ? (((esd.behavior as any).instances as any[]) || []).map((i: any) => ({ ...i, rationale: String(i?.rationale || "") }))
          : [],
        measures: (esd.behavior?.measures || []).map(normalizeMeasure),
        excluded: esd.behavior?.excluded || false,
      });
      setLeapItems(
        (((esd as any).leapItems || []) as any[]).map((li) => ({
          id: String(li?.id || generateId()),
          label: String(li?.label || "Untitled leap"),
          autoWeight: normalizeHml(li?.autoWeight ?? li?.weight),
          weight: normalizeHml(li?.weight ?? li?.autoWeight),
          weightMode: li?.weightMode === "manual" ? "manual" : "auto",
          measures: (li?.measures || []).map(normalizeMeasure),
        })),
      );
      setOverallMeasures(((esd as any).overallMeasures || []).map(normalizeMeasure));
      setInitialized(true);
    }
  }, [comp, initialized]);

  // Auto-sync leap list for "Individual leaps" with Designed Experience leap aims.
  useEffect(() => {
    if (!initialized) return;
    if (scoringMode !== "dimensions") return;

    const aims = getLeapAimsFromDE();
    const byLabel = new Map<string, LeapItem>();
    for (const li of leapItems) {
      byLabel.set(normLabel(li.label), li);
    }

    const next: LeapItem[] = [];
    const seen = new Set<string>();
    for (const aim of aims) {
      const key = normLabel(aim.label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = byLabel.get(key);
      const desiredWeight = defaultWeightFromLevel(aim.level);
      next.push(
        existing
          ? {
              ...existing,
              label: aim.label,
              autoWeight: desiredWeight,
              weight: existing.weightMode === "manual" ? existing.weight : desiredWeight,
              weightMode: existing.weightMode === "manual" ? "manual" : "auto",
            }
          : { id: aim.id, label: aim.label, autoWeight: desiredWeight, weight: desiredWeight, weightMode: "auto", measures: [] },
      );
    }

    const currentSig = leapItems.map((li) => `${normLabel(li.label)}:${li.autoWeight}:${li.weight}:${li.weightMode}`).join("|");
    const nextSig = next.map((li) => `${normLabel(li.label)}:${li.autoWeight}:${li.weight}:${li.weightMode}`).join("|");
    if (currentSig !== nextSig) {
      setLeapItems(next);
      setNewLeapMeasureName((prev) => {
        const updated = { ...prev };
        for (const li of next) {
          if (updated[li.id] === undefined) updated[li.id] = "";
        }
        return updated;
      });
    }
  }, [getLeapAimsFromDE, initialized, leapItems, scoringMode]);

  const leapsDimScore = useMemo(() => {
    if (Array.isArray(leapItems) && leapItems.length > 0) return calcLeapsDimensionScoreFromItems(leapItems, filter);
    return calcDimensionScore(leaps, filter);
  }, [filter, leapItems, leaps]);
  const healthDimScore = useMemo(() => calcDimensionScore(health, filter), [filter, health]);
  const behaviorDimScore = useMemo(() => calcDimensionScore(behavior, filter), [filter, behavior]);
  const emergentDimScore = useMemo(
    () => calcEmergentStatesScore(healthDimScore, behaviorDimScore, baseWeights.healthWeight, baseWeights.behaviorWeight),
    [baseWeights.behaviorWeight, baseWeights.healthWeight, behaviorDimScore, healthDimScore],
  );

  const leapsMeasuresAll = useMemo(() => {
    if (Array.isArray(leapItems) && leapItems.length > 0) return leapItems.flatMap((li) => li.measures);
    return leaps.measures;
  }, [leapItems, leaps.measures]);

  const finalScore = useMemo(
    () => {
      let raw: number | null = null;
      if (scoringMode === "overall") {
        raw = weightedAverage(
          overallMeasures.map((m: any) => ({
            rating: effectiveMeasureRating(m as Measure, filter),
            priority: m?.priority || "M",
            skipped: !!m?.skipped,
          })),
        );
        return roundFinal1to5(raw);
      }
      const requiresLeaps = baseWeights.leapsWeight > 0;
      const hasAnyLeapsMeasures = leapItems.some((li) => li.measures.length > 0) || leaps.measures.length > 0;
      if (requiresLeaps && !hasAnyLeapsMeasures) return null;
      const adjustedForFinal = calcRedistributedWeights(baseWeights, leapsDimScore, healthDimScore, behaviorDimScore);
      raw = calcTwoDimensionFinalScore(leapsDimScore, emergentDimScore, {
        leapsWeight: adjustedForFinal.leaps,
        emergentWeight: adjustedForFinal.health + adjustedForFinal.behavior,
      });
      return roundFinal1to5(raw);
    },
    [filter, scoringMode, overallMeasures, baseWeights, leapsDimScore, healthDimScore, behaviorDimScore, emergentDimScore, leaps.measures.length, leapItems]
  );

  const adjustedWeights = useMemo(
    () => calcRedistributedWeights(baseWeights, leapsDimScore, healthDimScore, behaviorDimScore),
    [baseWeights, leapsDimScore, healthDimScore, behaviorDimScore]
  );

  const doSave = useCallback((args: {
    scoringMode: "dimensions" | "overall";
    leapsScoringMode: LeapsScoringMode;
    leaps: ExperienceDimension;
    health: ExperienceDimension;
    behavior: ExperienceDimension;
    leapItems: LeapItem[];
    overallMeasures: Measure[];
    leapsDimensionScore: number | null;
    healthDimensionScore: number | null;
    behaviorDimensionScore: number | null;
    finalExperienceScore: number | null;
  }) => {
    if (!nodeId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const existing: any = comp?.healthData || {};
      updateMutation.mutate({
        nodeId,
        data: {
          healthData: {
            ...existing,
            experienceScoreData: {
              scoringMode: args.scoringMode,
              leapsScoringMode: args.leapsScoringMode,
              actors,
              filter,
              leaps: args.leaps,
              health: args.health,
              behavior: args.behavior,
              leapItems: args.leapItems,
              overallMeasures: args.overallMeasures,
              leapsDimensionScore: args.leapsDimensionScore,
              healthDimensionScore: args.healthDimensionScore,
              behaviorDimensionScore: args.behaviorDimensionScore,
              finalExperienceScore: args.finalExperienceScore,
            },
          },
        },
      });
    }, 1000);
  }, [nodeId, comp, updateMutation, actors, filter]);

  useEffect(() => {
    if (initialized) {
      doSave({
        scoringMode,
        leapsScoringMode,
        leaps,
        health,
        behavior,
        leapItems,
        overallMeasures,
        leapsDimensionScore: leapsDimScore,
        healthDimensionScore: healthDimScore,
        behaviorDimensionScore: behaviorDimScore,
        finalExperienceScore: finalScore,
      });
    }
  }, [behavior, behaviorDimScore, doSave, finalScore, health, healthDimScore, initialized, leapItems, leaps, leapsDimScore, leapsScoringMode, overallMeasures, scoringMode]);

  const addOverallMeasure = () => {
    const name = newOverallMeasureName.trim();
    if (!name) return;
    setOverallMeasures((prev) => [...prev, createMeasure(name)]);
    setNewOverallMeasureName("");
  };

  const updateOverallMeasure = (measure: Measure) => {
    setOverallMeasures((prev) => prev.map((m) => (m.id === measure.id ? measure : m)));
  };

  const deleteOverallMeasure = (measureId: string) => {
    setOverallMeasures((prev) => prev.filter((m) => m.id !== measureId));
  };

  const updateDimMeasure = (dim: "leaps" | "health" | "behavior", measureId: string, updated: Measure) => {
    const setter = dim === "leaps" ? setLeaps : dim === "health" ? setHealth : setBehavior;
    setter(prev => ({
      ...prev,
      measures: prev.measures.map(m => m.id === measureId ? updated : m),
    }));
  };

  const deleteDimMeasure = (dim: "leaps" | "health" | "behavior", measureId: string) => {
    const setter = dim === "leaps" ? setLeaps : dim === "health" ? setHealth : setBehavior;
    setter(prev => ({
      ...prev,
      measures: prev.measures.filter(m => m.id !== measureId),
    }));
  };

  const addDimMeasure = (dim: "leaps" | "health" | "behavior") => {
    const name = (newMeasureName[dim] || "").trim();
    if (!name) return;
    const m = createMeasure(name);
    const setter = dim === "leaps" ? setLeaps : dim === "health" ? setHealth : setBehavior;
    setter(prev => ({ ...prev, measures: [...prev.measures, m] }));
    setNewMeasureName(prev => ({ ...prev, [dim]: "" }));
  };

  const updateLeapItemMeasure = (leapId: string, measureId: string, updated: Measure) => {
    setLeapItems((prev) =>
      prev.map((li) => (li.id === leapId ? { ...li, measures: li.measures.map((m) => (m.id === measureId ? updated : m)) } : li)),
    );
  };

  const deleteLeapItemMeasure = (leapId: string, measureId: string) => {
    setLeapItems((prev) => prev.map((li) => (li.id === leapId ? { ...li, measures: li.measures.filter((m) => m.id !== measureId) } : li)));
  };

  const addLeapItemMeasure = (leapId: string) => {
    const name = (newLeapMeasureName[leapId] || "").trim();
    if (!name) return;
    const m = createMeasure(name);
    setLeapItems((prev) => prev.map((li) => (li.id === leapId ? { ...li, measures: [...li.measures, m] } : li)));
    setNewLeapMeasureName((prev) => ({ ...prev, [leapId]: "" }));
  };

  const setLeapItemWeight = (leapId: string, next: "AUTO" | Hml) => {
    setLeapItems((prev) =>
      prev.map((li) => {
        if (li.id !== leapId) return li;
        if (next === "AUTO") return { ...li, weightMode: "auto", weight: li.autoWeight };
        if (li.weightMode !== "manual" || li.weight !== next) {
          const confirmed = window.confirm("This will override the auto-calculated leap priority. Continue?");
          if (!confirmed) return li;
        }
        return { ...li, weightMode: "manual", weight: next };
      }),
    );
  };

  const toggleExclude = (dim: "health" | "behavior") => {
  };

  const allMeasures = scoringMode === "overall" ? overallMeasures : [...leapsMeasuresAll, ...health.measures, ...behavior.measures];
  const totalMeasures = allMeasures.length;
  const ratedMeasures = allMeasures.filter((m) => effectiveMeasureRating(m as any, filter) !== null).length;

  const aiSummary = useMemo(() => {
    if (scoringMode === "overall") {
      const rated = overallMeasures.filter((m) => effectiveMeasureRating(m as any, filter) !== null);
      if (rated.length === 0) return "No measures have been scored yet. Add measures and instances to see a summary.";
      return `Overall experience score is ${finalScore !== null ? String(finalScore) : "pending"} based on ${rated.length} rated measure${rated.length !== 1 ? "s" : ""}.`;
    }
    return generateAISummary(
      { instances: [], measures: leapsMeasuresAll, excluded: false },
      health,
      behavior,
      leapsDimScore,
      healthDimScore,
      behaviorDimScore,
      finalScore,
      filter,
    );
  }, [behavior, behaviorDimScore, filter, finalScore, health, healthDimScore, leapsDimScore, leapsMeasuresAll, overallMeasures, scoringMode]);

  const weightFormulaText = useMemo(() => {
    const emergentBase = baseWeights.healthWeight + baseWeights.behaviorWeight;
    if (leapCount === 0) return `No leaps tagged -> Core Experience Tenants 0%, Emergent States ${Math.round(emergentBase * 100)}%`;
    return `${leapCount} leap${leapCount !== 1 ? "s" : ""} -> Core Experience Tenants ${Math.round(baseWeights.leapsWeight * 100)}%, Emergent States ${Math.round(emergentBase * 100)}%`;
  }, [leapCount, baseWeights]);

  const getWeightTooltip = (dim: "leaps" | "health" | "behavior" | "emergent"): string => {
    if (dim === "emergent") {
      const baseEmergent = baseWeights.healthWeight + baseWeights.behaviorWeight;
      const adjustedEmergent = adjustedWeights.health + adjustedWeights.behavior;
      const basePercent = Math.round(baseEmergent * 100);
      const adjustedPercent = Math.round(adjustedEmergent * 100);
      if (adjustedPercent !== basePercent) {
        const diff = adjustedPercent - basePercent;
        return `Base weight: ${basePercent}%. +${diff}% redistributed from Core Experience Tenants -> ${adjustedPercent}% effective.`;
      }
      return `Base weight: ${basePercent}%. No redistribution applied.`;
    }

    const bw = dim === "leaps" ? baseWeights.leapsWeight : dim === "health" ? baseWeights.healthWeight : baseWeights.behaviorWeight;
    const aw = dim === "leaps" ? adjustedWeights.leaps : dim === "health" ? adjustedWeights.health : adjustedWeights.behavior;
    const basePercent = Math.round(bw * 100);
    const adjustedPercent = Math.round(aw * 100);

    if (dim === "leaps") {
      let tip = `${leapCount} leap${leapCount !== 1 ? "s" : ""} in Designed Experience → ${basePercent}% base weight.`;
      if (adjustedPercent !== basePercent) {
        const diff = adjustedPercent - basePercent;
        const sources: string[] = [];
        if (healthDimScore === null) sources.push("Health");
        if (behaviorDimScore === null) sources.push("Behavior");
        tip += ` +${diff}% redistributed from ${sources.join(" and ")} dimension${sources.length > 1 ? "s" : ""} → ${adjustedPercent}% effective.`;
      } else {
        tip += " No redistribution applied.";
      }
      return tip;
    }

    const dimName = dim === "health" ? "Health" : "Behavior";
    const isExcluded = dim === "health" ? healthDimScore === null : behaviorDimScore === null;
    const dimScore = dim === "health" ? healthDimScore : behaviorDimScore;

    if (isExcluded) {
      return `Excluded — weight redistributed to other dimensions.`;
    }

    let tip = `Base weight: ${basePercent}%.`;
    if (adjustedPercent !== basePercent && dimScore !== null) {
      const diff = adjustedPercent - basePercent;
      const sources: string[] = [];
      if (dim !== "health" && healthDimScore === null) sources.push("Health");
      if (dim !== "behavior" && behaviorDimScore === null) sources.push("Behavior");
      if (leapsDimScore === null && baseWeights.leapsWeight > 0) sources.push("Leaps");
      tip += ` +${diff}% redistributed from ${sources.join(" and ")} dimension${sources.length > 1 ? "s" : ""} → ${adjustedPercent}% effective.`;
    } else if (dimScore === null) {
      tip += " No rated measures — weight redistributed to other dimensions.";
    } else {
      tip += " No redistribution applied.";
    }
    return tip;
  };

  const emergentAdjustedWeight = adjustedWeights.health + adjustedWeights.behavior;
  const dimConfig = [
    { key: "leaps" as const, name: "Core Experience Tenants", icon: Zap, score: leapsDimScore, weight: adjustedWeights.leaps, color: "text-amber-600" },
    { key: "emergent" as const, name: "Emergent States", icon: Globe, score: emergentDimScore, weight: emergentAdjustedWeight, color: "text-indigo-500" },
  ];

  const actorOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (a: unknown) => {
      const clean = String(a ?? "").trim();
      if (!clean) return;
      const key = normActor(clean);
      if (!key || key === UNKNOWN_ACTOR_KEY) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };
    const scanInstances = (insts: unknown) => {
      const list = Array.isArray(insts) ? insts : [];
      for (const inst of list) add((inst as any)?.actor);
    };
    const scanMeasures = (measures: unknown) => {
      const list = Array.isArray(measures) ? measures : [];
      for (const m of list) scanInstances((m as any)?.instances);
    };

    for (const a of Array.isArray(globalActors) ? globalActors : []) add(a);
    for (const a of Array.isArray(actors) ? actors : []) add(a);
    scanInstances((leaps as any)?.instances);
    scanMeasures((leaps as any)?.measures);
    scanInstances((health as any)?.instances);
    scanMeasures((health as any)?.measures);
    scanInstances((behavior as any)?.instances);
    scanMeasures((behavior as any)?.measures);
    for (const li of Array.isArray(leapItems) ? leapItems : []) scanInstances((li as any)?.instances);
    scanMeasures(overallMeasures);

    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [actors, behavior, globalActors, health, leapItems, leaps, overallMeasures]);

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="experience-score-view">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Status & Health
        </button>

        <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="experience-filter-bar" />

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="score-dashboard">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Experience Score</h2>
                {title && <p className="text-sm text-gray-500 mt-0.5">{title}</p>}
              </div>
              <ScoreChip score={finalScore} size="lg" />
            </div>
          </div>

          {scoringMode === "dimensions" && (
            <div className="grid grid-cols-2 gap-3 p-4" data-testid="dimension-tiles">
              {dimConfig.map(dim => (
                <Tooltip key={dim.key}>
                  <TooltipTrigger asChild>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2 cursor-default" data-testid={`dimension-tile-${dim.key}`}>
                      <div className="flex items-center gap-1.5">
                        <dim.icon className={cn("w-3.5 h-3.5", dim.color)} />
                        <span className="text-xs font-semibold text-gray-700 truncate">{dim.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <ScoreChip score={dim.score} size="sm" />
                        <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          {Math.round(dim.weight * 100)}%
                        </Badge>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[280px]">
                    {getWeightTooltip(dim.key)}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          <div className="px-4 pb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2" data-testid="ai-summary">
              <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">{aiSummary}</p>
            </div>
          </div>

          <div className="px-4 pb-4" data-testid="flags-section">
            <ScoreFlags
              overallScore={finalScore}
              items={
                scoringMode === "overall"
                  ? overallMeasures
                      .map((m: any) => ({
                        key: String(m?.id || m?.name || Math.random()),
                        label: String(m?.name || "Measure"),
                        score: effectiveMeasureRating(m as any, filter),
                      }))
                  : [
                      ...(leapsScoringMode === "individual"
                        ? leapItems.map((li) => ({
                            key: `leap:${String(li.id)}`,
                            label: String(li.label || "Leap"),
                            score: calcLeapScoreFromMeasures(li.measures, filter),
                          }))
                        : (leapsMeasuresAll || [])
                            .map((m: any) => ({
                              key: String(m?.id || m?.name || Math.random()),
                              label: `Leaps: ${String(m?.name || "Measure")}`,
                              score: effectiveMeasureRating(m as any, filter),
                            }))),
                      ...(health.measures || [])
                        .map((m: any) => ({
                          key: String(m?.id || m?.name || Math.random()),
                          label: `Health: ${String(m?.name || "Measure")}`,
                          score: effectiveMeasureRating(m as any, filter),
                        })),
                      ...(behavior.measures || [])
                        .map((m: any) => ({
                          key: String(m?.id || m?.name || Math.random()),
                          label: `Behavior: ${String(m?.name || "Measure")}`,
                          score: effectiveMeasureRating(m as any, filter),
                        })),
                    ]
              }
              threshold={2}
              maxPerSide={6}
              defaultOpen={false}
              testId="experience-flags"
            />
          </div>

          <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
            <span data-testid="measures-rated-count">{ratedMeasures}/{totalMeasures} measures rated</span>
            {scoringMode === "dimensions" ? <span data-testid="weight-formula">{weightFormulaText}</span> : <span data-testid="weight-formula">Instance-weighted score</span>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4" data-testid="experience-scoring-mode">
          <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
          <RadioGroup value={scoringMode} onValueChange={(v) => setScoringMode(v as "dimensions" | "overall")} className="grid grid-cols-2 gap-3">
            <label
              htmlFor="mode-dimensions"
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                scoringMode === "dimensions" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
              )}
            >
              <RadioGroupItem value="dimensions" id="mode-dimensions" className="mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Dimensions</div>
                <p className="text-xs text-gray-500 mt-0.5">Score core tenants and emergent states, then roll up</p>
              </div>
            </label>
            <label
              htmlFor="mode-overall"
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                scoringMode === "overall" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
              )}
            >
              <RadioGroupItem value="overall" id="mode-overall" className="mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Overall</div>
                <p className="text-xs text-gray-500 mt-0.5">Attach measures directly to the component</p>
              </div>
            </label>
          </RadioGroup>
        </div>

        {scoringMode === "overall" ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="experience-overall-measures">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-gray-900">Overall Measures</h3>
              </div>
              <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">Instance-weighted</Badge>
            </div>
            <div className="p-4 space-y-3">
              {overallMeasures.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400">No measures added yet. Add a measure below.</div>
              )}
              {overallMeasures.map((m) => (
                <MeasureCard
                  key={m.id}
                  measure={m}
                  onUpdate={(updated) => updateOverallMeasure(updated)}
                  onDelete={() => deleteOverallMeasure(m.id)}
                  sectionDisabled={false}
                  actors={actorOptions}
                  onAddActor={onAddActor}
                  filter={filter}
                />
              ))}
              <div className="flex items-center gap-2" data-testid="add-measure-overall">
                <Input
                  value={newOverallMeasureName}
                  onChange={(e) => setNewOverallMeasureName(e.target.value)}
                  placeholder="Add measure name..."
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && addOverallMeasure()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addOverallMeasure}
                  disabled={!newOverallMeasureName.trim()}
                  className="h-8 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="experience-dimension-tabs">
              <div className="px-4 py-3">
                <Tabs value={activeDimTab} onValueChange={(v) => setActiveDimTab(v as any)} className="w-full">
                  <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-gray-200 gap-6">
                    {(
                      [
                        { key: "leaps" as const, label: "Core Experience Tenants", score: leapsDimScore },
                        { key: "emergent" as const, label: "Emergent States", score: emergentDimScore },
                      ] as const
                    ).map((t) => (
                      <TabsTrigger
                        key={t.key}
                        value={t.key}
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-900 data-[state=active]:shadow-none px-0 py-2 text-gray-500 hover:text-gray-700 bg-transparent flex items-center gap-2"
                        data-testid={`experience-dim-tab-${t.key}`}
                      >
                        <span className="truncate max-w-[220px]">{t.label}</span>
                        <ScoreChip score={t.score} size="sm" />
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {activeDimTab === "leaps" ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="section-leaps">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className={cn("w-4 h-4", "text-amber-600")} />
                  <h3 className="text-sm font-bold text-gray-900">Core Experience Tenants</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5 cursor-default">
                          <Lock className="w-2.5 h-2.5" />
                          {Math.round(adjustedWeights.leaps * 100)}%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[280px]">
                        {getWeightTooltip("leaps")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <ScoreChip score={leapsDimScore} size="sm" />
              </div>

              <div className="p-4 space-y-4">
                  <div className="space-y-3" data-testid="leaps-individual">
                    {leapItems.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-400" data-testid="empty-leap-items">
                        No leaps are tagged in Designed Experience yet. Add leaps there to score them here.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leapItems.map((li) => {
                          const leapScore = calcLeapScoreFromMeasures(li.measures, filter);
                          const instCount = (li.measures || []).reduce((s, m: any) => s + (Array.isArray(m?.instances) ? m.instances.length : 0), 0);
                          const measureCount = Array.isArray(li.measures) ? li.measures.length : 0;
                          return (
                            <Collapsible key={li.id} defaultOpen={false}>
                              <div className="bg-gray-50 rounded-lg border border-gray-200" data-testid={`leap-item-${li.id}`}>
                                <div className="p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <CollapsibleTrigger asChild>
                                      <button type="button" className="flex items-center gap-2 min-w-0 text-left">
                                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                        <div className="min-w-0">
                                          <div className="text-xs font-semibold text-gray-900 truncate">{li.label}</div>
                                          <div className="text-[10px] text-gray-500">
                                            Wt {li.weight} • {measureCount} measure{measureCount === 1 ? "" : "s"} • {instCount} inst
                                          </div>
                                        </div>
                                      </button>
                                    </CollapsibleTrigger>
                                    <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <Badge
                                        variant="secondary"
                                        className="text-[9px] h-5 bg-gray-200 text-gray-700"
                                        title="Auto-calculated from Designed Experience; can be overridden."
                                      >
                                        {li.weightMode === "manual" ? `Override:${li.weight}` : `Auto:${li.autoWeight}`}
                                      </Badge>
                                      <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white">
                                        {(["AUTO", "H", "M", "L"] as const).map((k) => (
                                          <button
                                            key={k}
                                            type="button"
                                            onClick={() => setLeapItemWeight(li.id, k as any)}
                                            className={cn(
                                              "px-2 py-0.5 text-[10px] font-bold transition-colors",
                                              k !== "AUTO" && "border-l border-gray-200",
                                              (k === "AUTO" ? li.weightMode === "auto" : li.weightMode === "manual" && li.weight === k)
                                                ? "bg-blue-50 text-blue-700"
                                                : "text-gray-500 hover:text-gray-800",
                                            )}
                                          >
                                            {k}
                                          </button>
                                        ))}
                                      </div>
                                      <ScoreChip score={leapScore} size="sm" />
                                    </div>
                                  </div>
                                </div>

                                <CollapsibleContent>
                                  <div className="px-3 pb-3 space-y-3">
                                    {li.measures.length === 0 && (
                                      <div className="text-center py-3 text-xs text-gray-400" data-testid={`empty-leap-measures-${li.id}`}>
                                        No measures added yet. Add a measure below.
                                      </div>
                                    )}

                                    {li.measures.map((m) => (
                                      <MeasureCard
                                        key={m.id}
                                        measure={m}
                                        onUpdate={(updated) => updateLeapItemMeasure(li.id, m.id, updated)}
                                        onDelete={() => deleteLeapItemMeasure(li.id, m.id)}
                                        sectionDisabled={false}
                                        actors={actorOptions}
                                        onAddActor={onAddActor}
                                        filter={filter}
                                      />
                                    ))}

                                    <div className="flex items-center gap-2" data-testid={`add-measure-leap-${li.id}`}>
                                      <Input
                                        value={newLeapMeasureName[li.id] || ""}
                                        onChange={(e) => setNewLeapMeasureName((prev) => ({ ...prev, [li.id]: e.target.value }))}
                                        placeholder="Add measure name..."
                                        className="h-8 text-sm flex-1"
                                        data-testid={`input-new-measure-leap-${li.id}`}
                                        onKeyDown={(e) => e.key === "Enter" && addLeapItemMeasure(li.id)}
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => addLeapItemMeasure(li.id)}
                                        disabled={!((newLeapMeasureName[li.id] || "").trim())}
                                        className="h-8 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add
                                      </Button>
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                      Auto priority is derived from Designed Experience. Switching to H/M/L requires confirmation and sets a manual override.
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                      </div>
                    )}
                  </div>
              </div>
            </div>
            ) : null}

            {activeDimTab === "emergent" ? (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="section-emergent">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className={cn("w-4 h-4", "text-indigo-500")} />
                    <h3 className="text-sm font-bold text-gray-900">Emergent States</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5 cursor-default">
                            <Lock className="w-2.5 h-2.5" />
                            {Math.round(emergentAdjustedWeight * 100)}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[280px]">
                          {getWeightTooltip("emergent")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <ScoreChip score={emergentDimScore} size="sm" />
                </div>
                <div className="p-4 space-y-4">
                  <DimensionSection
                    dimKey="health"
                    title="Mental & Physical Health Status"
                    icon={Heart}
                    iconColor="text-rose-500"
                    dimension={health}
                    baseWeight={baseWeights.healthWeight}
                    adjustedWeight={adjustedWeights.health}
                    weightTooltip={getWeightTooltip("health")}
                    newMeasureName={newMeasureName.health}
                    onNewMeasureNameChange={(v) => setNewMeasureName(prev => ({ ...prev, health: v }))}
                    onAddMeasure={() => addDimMeasure("health")}
                    onUpdateMeasure={(id, m) => updateDimMeasure("health", id, m)}
                    onDeleteMeasure={(id) => deleteDimMeasure("health", id)}
                    actors={actorOptions}
                    onAddActor={onAddActor}
                    filter={filter}
                  />
                  <DimensionSection
                    dimKey="behavior"
                    title="Satisfaction, Engagement, Behavior, and Conduct"
                    icon={Users}
                    iconColor="text-blue-500"
                    dimension={behavior}
                    baseWeight={baseWeights.behaviorWeight}
                    adjustedWeight={adjustedWeights.behavior}
                    weightTooltip={getWeightTooltip("behavior")}
                    newMeasureName={newMeasureName.behavior}
                    onNewMeasureNameChange={(v) => setNewMeasureName(prev => ({ ...prev, behavior: v }))}
                    onAddMeasure={() => addDimMeasure("behavior")}
                    onUpdateMeasure={(id, m) => updateDimMeasure("behavior", id, m)}
                    onDeleteMeasure={(id) => deleteDimMeasure("behavior", id)}
                    actors={actorOptions}
                    onAddActor={onAddActor}
                    filter={filter}
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}


function DimensionSection({
  dimKey,
  title,
  icon: Icon,
  iconColor,
  dimension,
  baseWeight,
  adjustedWeight,
  weightTooltip,
  newMeasureName,
  onNewMeasureNameChange,
  onAddMeasure,
  onUpdateMeasure,
  onDeleteMeasure,
  leapCount,
  actors,
  onAddActor,
  filter,
}: {
  dimKey: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  dimension: ExperienceDimension;
  baseWeight: number;
  adjustedWeight: number;
  weightTooltip: string;
  newMeasureName: string;
  onNewMeasureNameChange: (v: string) => void;
  onAddMeasure: () => void;
  onUpdateMeasure: (id: string, m: Measure) => void;
  onDeleteMeasure: (id: string) => void;
  leapCount?: number;
  actors: string[];
  onAddActor?: (label: string) => void;
  filter: ScoreFilter;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid={`section-${dimKey}`}>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", iconColor)} />
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5 cursor-default">
                  <Lock className="w-2.5 h-2.5" />
                  {Math.round(adjustedWeight * 100)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[280px]">
                {weightTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {dimension.measures.length === 0 && dimKey !== "leaps" && (
          <Badge variant="secondary" className="text-[9px] h-5 bg-amber-100 text-amber-600">
            Auto-excluded (no measures)
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-3">
        {dimension.measures.length === 0 && (
          <div className="text-center py-4 text-xs text-gray-400" data-testid={`empty-${dimKey}`}>
            No measures added yet. Add a measure below.
          </div>
        )}

        {dimension.measures.map(m => (
          <MeasureCard
            key={m.id}
            measure={m}
            onUpdate={(updated) => onUpdateMeasure(m.id, updated)}
            onDelete={() => onDeleteMeasure(m.id)}
            sectionDisabled={false}
            actors={actors}
            onAddActor={onAddActor}
            filter={filter}
          />
        ))}

        <div className="flex items-center gap-2" data-testid={`add-measure-${dimKey}`}>
          <Input
            value={newMeasureName}
            onChange={(e) => onNewMeasureNameChange(e.target.value)}
            placeholder="Add measure name..."
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && onAddMeasure()}
            data-testid={`input-new-measure-${dimKey}`}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onAddMeasure}
            disabled={!newMeasureName.trim()}
            className="h-8 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
            data-testid={`button-add-measure-${dimKey}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>

        <div
          className="flex items-center gap-2 text-[10px] text-gray-300 bg-gray-50 rounded-md border border-dashed border-gray-200 px-3 py-2 cursor-not-allowed select-none"
          data-testid={`whole-school-measures-${dimKey}`}
        >
          <Globe className="w-3.5 h-3.5 text-gray-300" />
          <span>Select from whole school measures</span>
          <Badge variant="secondary" className="text-[8px] h-3.5 bg-gray-100 text-gray-400 ml-auto">Coming soon</Badge>
        </div>

        {dimKey === "leaps" && leapCount !== undefined && (
          <div className="flex items-start gap-1.5 text-[10px] text-gray-400 bg-amber-50 border border-amber-100 rounded-md px-3 py-2" data-testid="leaps-info-note">
            <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <span>
              The number of leaps tagged in Designed Experience (currently {leapCount}) determines this dimension's weight in the overall score.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
