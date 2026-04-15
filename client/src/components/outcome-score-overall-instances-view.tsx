"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Sparkles, Target, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { outcomeHealthBucketForLabel } from "@/lib/outcome-health-bucket";
import { UNKNOWN_ACTOR_KEY, effectiveFromInstances, normActor } from "@shared/score-instances";
import type { ScoreFilter, ScoreInstance, TargetedOutcome, OutcomeScoreData } from "@shared/schema";
import ScoreFilterBar from "./score-filter-bar";
import ScoreInstancesInlineEditor from "./score-instances-inline-editor";
import { listSelectableYearKeys } from "@shared/marking-period";
import { useGlobalActors } from "@/lib/actors-store";
import ScoreFlags from "./score-flags";

const PRIORITY_WEIGHT: Record<string, number> = { H: 6, M: 3, L: 1 };

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function weightedAverage(items: { rating: number | null; weight: "H" | "M" | "L"; skipped: boolean }[]): number | null {
  let totalWeight = 0;
  let totalScore = 0;
  for (const item of items) {
    if (!item.skipped && item.rating !== null) {
      const w = PRIORITY_WEIGHT[item.weight] || 1;
      totalWeight += w;
      totalScore += item.rating * w;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round((totalScore / totalWeight) * 100) / 100;
}

function scoreChip(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-400 border-gray-200";
  if (score >= 4) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function ScoreChip({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  if (score === null)
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-gray-100 text-gray-400 font-bold border border-gray-200",
          size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-16 h-12 text-2xl" : "w-10 h-10 text-lg",
        )}
      >
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
    <div
      className={cn(
        "flex items-center justify-center rounded-md font-bold border",
        color,
        size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-16 h-12 text-2xl" : "w-10 h-10 text-lg",
      )}
      data-testid="score-chip"
    >
      {rounded}
    </div>
  );
}

function weightPillClass(active: boolean) {
  return active ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";
}

function WeightPicker({ value, onChange }: { value: "H" | "M" | "L"; onChange: (v: "H" | "M" | "L") => void }) {
  return (
    <div className="flex items-center gap-2">
      {(
        [
          { v: "H" as const, label: "High" },
          { v: "M" as const, label: "Med" },
          { v: "L" as const, label: "Low" },
        ] as const
      ).map((x) => (
        <button
          key={x.v}
          type="button"
          className={cn("px-2 py-1 rounded-full border text-[11px] font-bold transition-colors", weightPillClass(value === x.v))}
          onClick={() => onChange(x.v)}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}

function normalizeOutcome(o: any): TargetedOutcome {
  return {
    id: String(o?.id || genId()),
    outcomeId: String(o?.outcomeId || genId()),
    outcomeName: String(o?.outcomeName || "Untitled"),
    priority: (o?.priority === "H" || o?.priority === "M" || o?.priority === "L" ? o.priority : "M") as any,
    rigorPath: "thin",
    instances: (Array.isArray(o?.instances) ? o.instances : []) as ScoreInstance[],
    measures: Array.isArray(o?.measures) ? o.measures : [],
    calculatedScore: typeof o?.calculatedScore === "number" ? o.calculatedScore : null,
    skipped: !!o?.skipped,
  } as any;
}

export default function OutcomeScoreOverallInstancesView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
  variant = "learningAdvancement",
}: {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter | null;
  onFilterChange?: (next: ScoreFilter) => void;
  variant?: "learningAdvancement" | "wellbeingConduct";
}) {
  const healthKey =
    variant === "wellbeingConduct" ? "wellbeingConductOutcomeScoreData" : "learningAdvancementOutcomeScoreData";
  const { actors: globalActors, addActor: addGlobalActor, mergeActors: mergeGlobalActors } = useGlobalActors();
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localFilter, setLocalFilter] = useState<ScoreFilter>({
    mode: "year",
    yearKey: listSelectableYearKeys(new Date(), 5)[0],
    aggregation: "singleLatest",
  } as any);
  const filter = (sourceFilter as any) || localFilter;
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

  const [scoringMode, setScoringMode] = useState<"targeted" | "overall">("targeted");

  const deOutcomes = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return aims.filter((a: any) => a?.type === "outcome" && typeof a?.label === "string").map((a: any) => String(a.label));
  }, [comp]);

  const scopedDeOutcomes = useMemo(() => {
    return deOutcomes.filter((label) => outcomeHealthBucketForLabel(label) === healthKey);
  }, [deOutcomes, healthKey]);

  const [outcomes, setOutcomes] = useState<TargetedOutcome[]>([]);
  const [overallInstances, setOverallInstances] = useState<ScoreInstance[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!comp || initialized) return;
    const osd: any = (comp as any)?.healthData?.[healthKey] || {};
    const initialFilter: ScoreFilter =
      (sourceFilter as any) ||
      (osd?.filter as any) || {
        mode: "year",
        yearKey: listSelectableYearKeys(new Date(), 5)[0],
        aggregation: "singleLatest",
      };
    setLocalFilter(initialFilter as any);
    setScoringMode((osd.scoringMode as any) === "overall" ? "overall" : "targeted");
    setActors(Array.isArray(osd.actors) ? osd.actors : []);
    const targeted: any[] = Array.isArray(osd.targetedOutcomes) ? osd.targetedOutcomes : [];
    const normalized = targeted.map(normalizeOutcome);
    setOverallInstances(Array.isArray(osd.overallInstances) ? osd.overallInstances : []);

    // Ensure DE outcomes exist in list
    for (const label of scopedDeOutcomes) {
      const exists = normalized.some((o) => String(o.outcomeName).toLowerCase() === String(label).toLowerCase());
      if (!exists) normalized.push(normalizeOutcome({ outcomeName: label, priority: "M", instances: [] }));
    }

    setOutcomes(normalized);
    setInitialized(true);
  }, [comp, healthKey, initialized, scopedDeOutcomes, sourceFilter]);

  useEffect(() => {
    if (!initialized) return;
    mergeGlobalActors(actors);
  }, [actors, initialized, mergeGlobalActors]);

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
    for (const a of Array.isArray(globalActors) ? globalActors : []) add(a);
    for (const a of Array.isArray(actors) ? actors : []) add(a);
    scanInstances(overallInstances);
    for (const o of Array.isArray(outcomes) ? outcomes : []) scanInstances((o as any)?.instances);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [actors, globalActors, outcomes, overallInstances]);

  const computed = useMemo(() => {
    return outcomes.map((o) => {
      const eff = effectiveFromInstances((o as any).instances || [], filter).score;
      return { ...o, calculatedScore: eff };
    });
  }, [filter, outcomes]);

  const targetedFinalScore = useMemo(() => {
    const items = computed.map((o) => ({
      rating: (o as any).calculatedScore ?? null,
      weight: (o as any).priority || "M",
      skipped: !!(o as any).skipped,
    }));
    return weightedAverage(items as any);
  }, [computed]);

  const overallFinalScore = useMemo(() => {
    return effectiveFromInstances(overallInstances || [], filter).score;
  }, [filter, overallInstances]);

  const finalScore = scoringMode === "overall" ? overallFinalScore : targetedFinalScore;

  const instanceCounts = useMemo(() => {
    const countScored = (insts: ScoreInstance[]) => insts.filter((i) => i?.score !== null && i?.score !== undefined).length;
    const total = (insts: ScoreInstance[]) => (Array.isArray(insts) ? insts.length : 0);
    if (scoringMode === "overall") return { scored: countScored(overallInstances), total: total(overallInstances) };
    const tTotal = computed.reduce((s, o: any) => s + total((o.instances || []) as any), 0);
    const tScored = computed.reduce((s, o: any) => s + countScored((o.instances || []) as any), 0);
    return { scored: tScored, total: tTotal };
  }, [computed, overallInstances, scoringMode]);

  const aiSummary = useMemo(() => {
    if (finalScore === null) return "Add instances to compute an Outcomes score.";
    if (scoringMode === "overall") return `Outcomes score is ${Math.round(finalScore)} based on your overall instances.`;
    const scored = computed.filter((o: any) => o.calculatedScore !== null && o.calculatedScore !== undefined).length;
    return `Outcomes score is ${Math.round(finalScore)} across ${scored}/${computed.length} scored outcomes (weighted H=6, M=3, L=1).`;
  }, [computed, finalScore, scoringMode]);

  const [openById, setOpenById] = useState<Record<string, boolean>>({});

  const doSave = useCallback(
    (args: { scoringMode: "targeted" | "overall"; targeted: TargetedOutcome[]; overallInstances: ScoreInstance[]; final: number | null }) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = (comp as any)?.healthData || {};
        const osd: any = existing?.[healthKey] || {};
        const payload: Partial<OutcomeScoreData> = {
          ...osd,
          actors,
          filter,
          scoringMode: args.scoringMode,
          targetedOutcomes: args.targeted.map((o) => ({
            ...o,
            calculatedScore: (o as any).calculatedScore ?? null,
            // Measures removed for overall component.
            measures: [],
          })) as any,
          overallInstances: args.overallInstances,
          overallMeasures: [],
          finalOutcomeScore: args.final,
        };
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              [healthKey]: payload,
            },
          },
        });
      }, 400);
    },
    [actors, comp, filter, healthKey, nodeId, updateMutation],
  );

  useEffect(() => {
    if (!initialized) return;
    doSave({ scoringMode, targeted: computed as any, overallInstances, final: finalScore });
  }, [computed, doSave, finalScore, initialized, overallInstances, scoringMode]);

  if (!nodeId) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24" data-testid="outcome-score-view-overall">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
        data-testid="button-back-to-health"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status &amp; Health
      </button>

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="outcome-filter-bar" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="score-dashboard">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-gray-900">Outcome Score</h2>
              <p className="text-sm text-gray-500">{title || (comp as any)?.title || "Overall"}</p>
            </div>
            <div className="text-right space-y-1">
              <ScoreChip score={finalScore} size="lg" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Component O Score</p>
            </div>
          </div>

          {scoringMode === "targeted" && computed.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {computed.map((o: any) => (
                <div
                  key={o.id}
                  className={cn("flex items-center gap-2 p-2 rounded-lg border", o.skipped ? "bg-gray-50 border-gray-200 opacity-60" : "bg-gray-50 border-gray-200")}
                  data-testid={`outcome-score-tile-${o.id}`}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded flex items-center justify-center text-sm font-bold shrink-0",
                      o.calculatedScore !== null && o.calculatedScore !== undefined
                        ? o.calculatedScore >= 4
                          ? "bg-emerald-100 text-emerald-700"
                          : o.calculatedScore >= 3
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-400",
                    )}
                  >
                    {o.calculatedScore !== null && o.calculatedScore !== undefined
                      ? String(Math.max(1, Math.min(5, Math.round(o.calculatedScore))))
                      : "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={cn("text-xs font-medium truncate block", o.skipped && "line-through text-gray-400")}>{o.outcomeName}</span>
                    <span
                      className={cn(
                        "text-[9px] font-bold",
                        o.priority === "H" ? "text-red-500" : o.priority === "M" ? "text-yellow-600" : "text-blue-400",
                      )}
                    >
                      {o.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-blue-50/60 rounded-lg border border-blue-100 p-3 flex gap-2" data-testid="ai-summary">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">{aiSummary}</p>
          </div>

          <div className="mt-3" data-testid="flags-section">
            <ScoreFlags
              overallScore={finalScore}
              items={
                (scoringMode === "targeted"
                  ? (computed || []).map((o: any) => ({
                      key: String(o.id),
                      label: String(o.outcomeName || "Outcome"),
                      score: o.calculatedScore ?? null,
                    }))
                  : []) as any
              }
              threshold={2}
              defaultOpen={false}
              testId="outcome-flags"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
            {instanceCounts.scored}/{instanceCounts.total} instances rated
          </span>
          <span className="text-[10px] text-gray-400">Weighted: H=6, M=3, L=1</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <RadioGroup value={scoringMode} onValueChange={(v) => setScoringMode(v as any)} className="grid grid-cols-2 gap-3">
          <label
            htmlFor="overall-outcomes-targeted"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              scoringMode === "targeted" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="targeted" id="overall-outcomes-targeted" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">By outcome</div>
              <p className="text-xs text-gray-500 mt-0.5">Score outcomes (instances) and roll up</p>
            </div>
          </label>
          <label
            htmlFor="overall-outcomes-overall"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              scoringMode === "overall" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="overall" id="overall-outcomes-overall" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Overall Component</div>
              <p className="text-xs text-gray-500 mt-0.5">Attach instances directly to the component</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {scoringMode === "overall" ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="outcomes-overall-instances">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Overall Instances</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              Weighted: H=6, M=3, L=1
            </Badge>
          </div>
          <div className="p-4 space-y-3">
            <ScoreInstancesInlineEditor
              instances={overallInstances}
              onChange={setOverallInstances}
              actors={actorOptions}
              onAddActor={(label) => {
                addGlobalActor(label);
                setActors((prev) => [...prev, label]);
              }}
              testIdPrefix="overall-outcomes"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Targeted Outcomes
            </h3>
            <span className="text-xs text-gray-400">
              {computed.length} outcome{computed.length !== 1 ? "s" : ""}
            </span>
          </div>

          {computed.length === 0 ? (
            <div className="text-sm text-gray-500">No outcomes yet.</div>
          ) : (
            computed.map((outcome: any) => {
              const isExpanded = openById[outcome.id] ?? false;
              const canSkip = outcome.priority === "L";
              const eff = outcome.calculatedScore ?? null;
              const instCount = Array.isArray(outcome.instances) ? outcome.instances.length : 0;
              return (
                <Collapsible
                  key={outcome.id}
                  open={isExpanded}
                  onOpenChange={() => setOpenById((prev) => ({ ...prev, [outcome.id]: !isExpanded }))}
                >
                  <div className={cn("border rounded-xl overflow-hidden transition-all", outcome.skipped ? "border-gray-200 bg-gray-50 opacity-60" : "border-gray-200 bg-white shadow-sm")}>
                    <CollapsibleTrigger asChild>
                      <div
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors group text-left cursor-pointer"
                        role="button"
                        tabIndex={0}
                        data-testid={`outcome-trigger-${outcome.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ScoreChip score={eff} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{outcome.outcomeName || "Untitled Outcome"}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{instCount} instance{instCount !== 1 ? "s" : ""}</span>
                              {outcome.skipped && <Badge variant="secondary" className="text-[9px] h-4 bg-amber-100 text-amber-700">Skipped</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div onClick={(e) => e.stopPropagation()}>
                            <WeightPicker
                              value={outcome.priority}
                              onChange={(v) => setOutcomes((prev) => prev.map((x) => (x.id === outcome.id ? { ...x, priority: v } : x)))}
                            />
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t border-gray-100 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {canSkip && (
                              <button
                                onClick={() => setOutcomes((prev) => prev.map((x) => (x.id === outcome.id ? { ...x, skipped: !x.skipped } : x)))}
                                className={cn(
                                  "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors",
                                  outcome.skipped ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                                )}
                                data-testid={`skip-outcome-${outcome.id}`}
                              >
                                {outcome.skipped ? "Skipped" : "Skip this outcome"}
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => setOutcomes((prev) => prev.filter((x) => x.id !== outcome.id))}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            data-testid={`delete-outcome-${outcome.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {!outcome.skipped && (
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-500 font-semibold">Instances</Label>
                            <ScoreInstancesInlineEditor
                              instances={(outcome.instances || []) as ScoreInstance[]}
                              onChange={(next) => setOutcomes((prev) => prev.map((x: any) => (x.id === outcome.id ? { ...x, instances: next } : x)))}
                              actors={actorOptions}
                              onAddActor={(label) => {
                                addGlobalActor(label);
                                setActors((prev) => [...prev, label]);
                              }}
                              testIdPrefix={`outcome-${outcome.id}`}
                            />
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

