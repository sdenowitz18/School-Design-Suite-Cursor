"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Heart, Lock, Sparkles, Users, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { UNKNOWN_ACTOR_KEY, effectiveFromInstances, normActor } from "@shared/score-instances";
import type { ExperienceScoreData, ScoreFilter, ScoreInstance } from "@shared/schema";
import ScoreFilterBar from "./score-filter-bar";
import ScoreInstancesInlineEditor from "./score-instances-inline-editor";
import { listSelectableYearKeys } from "@shared/marking-period";
import { useGlobalActors } from "@/lib/actors-store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ScoreFlags from "./score-flags";

const PRIORITY_WEIGHT: Record<string, number> = { H: 6, M: 3, L: 1 };
type Hml = "H" | "M" | "L";
type LeapsScoringMode = "across" | "individual";
type ScoringMode = "dimensions" | "overall";

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

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function weightPillClass(active: boolean) {
  return active ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";
}

function WeightPicker({ value, onChange }: { value: Hml; onChange: (v: Hml) => void }) {
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

function calcWeights(leapCount: number): { leaps: number; health: number; behavior: number } {
  let leaps = 0;
  if (leapCount >= 5) leaps = 0.6;
  else if (leapCount >= 3) leaps = 0.5;
  else if (leapCount >= 1) leaps = 0.4;
  const remaining = 1 - leaps;
  return { leaps, health: remaining / 2, behavior: remaining / 2 };
}

function redistribute(base: { leaps: number; health: number; behavior: number }, has: { leaps: boolean; health: boolean; behavior: boolean }) {
  const missing = (has.leaps ? 0 : base.leaps) + (has.health ? 0 : base.health) + (has.behavior ? 0 : base.behavior);
  const count = (has.leaps ? 1 : 0) + (has.health ? 1 : 0) + (has.behavior ? 1 : 0);
  const add = count > 0 ? missing / count : 0;
  return {
    leaps: has.leaps ? base.leaps + add : 0,
    health: has.health ? base.health + add : 0,
    behavior: has.behavior ? base.behavior + add : 0,
  };
}

function weightedAverage(items: { score: number | null; weight: Hml }[]): number | null {
  let totalW = 0;
  let total = 0;
  for (const it of items) {
    if (it.score === null) continue;
    const w = PRIORITY_WEIGHT[it.weight] || 1;
    totalW += w;
    total += it.score * w;
  }
  if (totalW === 0) return null;
  return Math.round((total / totalW) * 100) / 100;
}

export default function ExperienceScoreOverallInstancesView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
}: {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter | null;
  onFilterChange?: (next: ScoreFilter) => void;
}) {
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

  const leapLabelsFromDE = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return aims.filter((a: any) => a?.type === "leap" && typeof a?.label === "string").map((a: any) => String(a.label));
  }, [comp]);

  const [scoringMode, setScoringMode] = useState<ScoringMode>("dimensions");
  const [activeDimTab, setActiveDimTab] = useState<"leaps" | "health" | "behavior">("leaps");
  const [leapsScoringMode, setLeapsScoringMode] = useState<LeapsScoringMode>("across");
  const [overallInstances, setOverallInstances] = useState<ScoreInstance[]>([]);
  const [leapsInstances, setLeapsInstances] = useState<ScoreInstance[]>([]);
  const [healthInstances, setHealthInstances] = useState<ScoreInstance[]>([]);
  const [behaviorInstances, setBehaviorInstances] = useState<ScoreInstance[]>([]);
  const [leapItems, setLeapItems] = useState<{ id: string; label: string; weight: Hml; instances: ScoreInstance[] }[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (scoringMode === "dimensions") setActiveDimTab("leaps");
  }, [scoringMode]);

  useEffect(() => {
    if (!comp || initialized) return;
    const esd: any = (comp as any)?.healthData?.experienceScoreData || {};
    const initialFilter: ScoreFilter =
      (sourceFilter as any) ||
      (esd?.filter as any) || {
        mode: "year",
        yearKey: listSelectableYearKeys(new Date(), 5)[0],
        aggregation: "singleLatest",
      };
    setLocalFilter(initialFilter as any);
    setScoringMode((esd.scoringMode as any) === "overall" ? "overall" : "dimensions");
    setLeapsScoringMode((esd.leapsScoringMode as any) === "individual" ? "individual" : "across");
    setActors(Array.isArray(esd.actors) ? esd.actors : []);
    setOverallInstances(Array.isArray(esd?.overallInstances) ? esd.overallInstances : []);
    setLeapsInstances(Array.isArray(esd?.leaps?.instances) ? esd.leaps.instances : []);
    setHealthInstances(Array.isArray(esd?.health?.instances) ? esd.health.instances : []);
    setBehaviorInstances(Array.isArray(esd?.behavior?.instances) ? esd.behavior.instances : []);

    const li: any[] = Array.isArray(esd?.leapItems) ? esd.leapItems : [];
    const normalized = li.map((x) => ({
      id: String(x?.id || genId()),
      label: String(x?.label || "Untitled"),
      weight: (x?.weight === "H" || x?.weight === "M" || x?.weight === "L" ? x.weight : "M") as Hml,
      instances: Array.isArray(x?.instances) ? x.instances : [],
    }));

    // Ensure leap items exist for DE leaps
    for (const label of leapLabelsFromDE) {
      const exists = normalized.some((x) => x.label.toLowerCase() === label.toLowerCase());
      if (!exists) normalized.push({ id: genId(), label, weight: "M", instances: [] });
    }

    setLeapItems(normalized);
    setInitialized(true);
  }, [comp, initialized, leapLabelsFromDE, sourceFilter]);

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
    scanInstances(leapsInstances);
    scanInstances(healthInstances);
    scanInstances(behaviorInstances);
    for (const li of Array.isArray(leapItems) ? leapItems : []) scanInstances((li as any)?.instances);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [actors, behaviorInstances, globalActors, healthInstances, leapItems, leapsInstances, overallInstances]);

  const leapsDimScore = useMemo(() => {
    if (leapsScoringMode === "across") return effectiveFromInstances(leapsInstances, filter).score;
    const items = leapItems.map((li) => ({
      score: effectiveFromInstances(li.instances || [], filter).score,
      weight: li.weight,
    }));
    return weightedAverage(items);
  }, [filter, leapItems, leapsInstances, leapsScoringMode]);

  const healthDimScore = useMemo(() => effectiveFromInstances(healthInstances, filter).score, [filter, healthInstances]);
  const behaviorDimScore = useMemo(() => effectiveFromInstances(behaviorInstances, filter).score, [filter, behaviorInstances]);

  const finalScore = useMemo(() => {
    const base = calcWeights(leapLabelsFromDE.length);
    const has = {
      leaps: leapsDimScore !== null,
      health: healthDimScore !== null,
      behavior: behaviorDimScore !== null,
    };
    const w = redistribute(base, has);
    const parts: { score: number | null; w: number }[] = [
      { score: leapsDimScore, w: w.leaps },
      { score: healthDimScore, w: w.health },
      { score: behaviorDimScore, w: w.behavior },
    ];
    let totalW = 0;
    let total = 0;
    for (const p of parts) {
      if (p.score === null || p.w === 0) continue;
      totalW += p.w;
      total += p.score * p.w;
    }
    if (totalW === 0) return null;
    return Math.round((total / totalW) * 100) / 100;
  }, [behaviorDimScore, healthDimScore, leapLabelsFromDE.length, leapsDimScore]);

  const overallFinalScore = useMemo(() => {
    return effectiveFromInstances(overallInstances || [], filter).score;
  }, [filter, overallInstances]);

  const displayedFinal = scoringMode === "overall" ? overallFinalScore : finalScore;

  const adjustedWeights = useMemo(() => {
    const base = calcWeights(leapLabelsFromDE.length);
    const has = { leaps: leapsDimScore !== null, health: healthDimScore !== null, behavior: behaviorDimScore !== null };
    return redistribute(base, has);
  }, [behaviorDimScore, healthDimScore, leapLabelsFromDE.length, leapsDimScore]);

  const dimConfig = useMemo(() => {
    return [
      { key: "leaps" as const, name: "Leaps & Design Principles", icon: Zap, score: leapsDimScore, weight: adjustedWeights.leaps, color: "text-amber-600" },
      { key: "health" as const, name: "Mental & Physical Health", icon: Heart, score: healthDimScore, weight: adjustedWeights.health, color: "text-rose-500" },
      { key: "behavior" as const, name: "Behavior, Attendance & Engagement", icon: Users, score: behaviorDimScore, weight: adjustedWeights.behavior, color: "text-blue-500" },
    ];
  }, [adjustedWeights.behavior, adjustedWeights.health, adjustedWeights.leaps, behaviorDimScore, healthDimScore, leapsDimScore]);

  const instanceCounts = useMemo(() => {
    const countScored = (insts: ScoreInstance[]) => insts.filter((i) => i?.score !== null && i?.score !== undefined).length;
    const total = (insts: ScoreInstance[]) => (Array.isArray(insts) ? insts.length : 0);

    if (scoringMode === "overall") return { scored: countScored(overallInstances), total: total(overallInstances) };

    const leapsTotal = leapsScoringMode === "across" ? total(leapsInstances) : leapItems.reduce((s, li) => s + total(li.instances || []), 0);
    const leapsScored = leapsScoringMode === "across" ? countScored(leapsInstances) : leapItems.reduce((s, li) => s + countScored((li.instances || []) as any), 0);
    const hTotal = total(healthInstances);
    const hScored = countScored(healthInstances);
    const bTotal = total(behaviorInstances);
    const bScored = countScored(behaviorInstances);
    return { scored: leapsScored + hScored + bScored, total: leapsTotal + hTotal + bTotal };
  }, [behaviorInstances, healthInstances, leapItems, leapsInstances, leapsScoringMode, overallInstances, scoringMode]);

  const aiSummary = useMemo(() => {
    if (displayedFinal === null) return "Add instances to compute an Experience score.";
    if (scoringMode === "overall") return `Experience score is ${Math.round(displayedFinal)} based on your overall instances.`;
    const parts: string[] = [];
    if (leapsDimScore !== null) parts.push(`Leaps: ${Math.max(1, Math.min(5, Math.round(leapsDimScore)))}`);
    if (healthDimScore !== null) parts.push(`Health: ${Math.max(1, Math.min(5, Math.round(healthDimScore)))}`);
    if (behaviorDimScore !== null) parts.push(`Behavior: ${Math.max(1, Math.min(5, Math.round(behaviorDimScore)))}`);
    return `Experience score is ${Math.round(displayedFinal)}. ${parts.join(". ")}${parts.length ? "." : ""}`;
  }, [behaviorDimScore, displayedFinal, healthDimScore, leapsDimScore, scoringMode]);

  const doSave = useCallback(
    (args: {
      scoringMode: ScoringMode;
      leapsScoringMode: LeapsScoringMode;
      overallInstances: ScoreInstance[];
      leapsInstances: ScoreInstance[];
      leapItems: { id: string; label: string; weight: Hml; instances: ScoreInstance[] }[];
      healthInstances: ScoreInstance[];
      behaviorInstances: ScoreInstance[];
      leapsDimScore: number | null;
      healthDimScore: number | null;
      behaviorDimScore: number | null;
      finalScore: number | null;
    }) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = (comp as any)?.healthData || {};
        const esd: any = existing?.experienceScoreData || {};
        const payload: Partial<ExperienceScoreData> = {
          ...esd,
          scoringMode: args.scoringMode,
          leapsScoringMode: args.leapsScoringMode,
          actors,
          filter,
          leaps: { ...(esd.leaps || {}), instances: args.leapsInstances, measures: [], excluded: false } as any,
          health: { ...(esd.health || {}), instances: args.healthInstances, measures: [], excluded: false } as any,
          behavior: { ...(esd.behavior || {}), instances: args.behaviorInstances, measures: [], excluded: false } as any,
          leapItems: args.leapItems.map((li) => ({ ...li, measures: [] })) as any,
          overallInstances: args.overallInstances,
          overallMeasures: [],
          leapsDimensionScore: args.leapsDimScore,
          healthDimensionScore: args.healthDimScore,
          behaviorDimensionScore: args.behaviorDimScore,
          finalExperienceScore: args.finalScore,
        };
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              experienceScoreData: payload,
            },
          },
        });
      }, 400);
    },
    [actors, comp, filter, nodeId, updateMutation],
  );

  useEffect(() => {
    if (!initialized) return;
    doSave({
      scoringMode,
      leapsScoringMode,
      overallInstances,
      leapsInstances,
      leapItems,
      healthInstances,
      behaviorInstances,
      leapsDimScore,
      healthDimScore,
      behaviorDimScore,
      finalScore: displayedFinal,
    });
  }, [
    behaviorDimScore,
    behaviorInstances,
    doSave,
    displayedFinal,
    healthDimScore,
    healthInstances,
    initialized,
    leapItems,
    leapsDimScore,
    leapsInstances,
    leapsScoringMode,
    overallInstances,
    scoringMode,
  ]);

  if (!nodeId) return null;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="experience-score-view-overall">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
        data-testid="button-back"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status &amp; Health
      </button>

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="experience-filter-bar" />

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="score-dashboard">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Experience Score</h2>
              {(title || (comp as any)?.title) && <p className="text-sm text-gray-500 mt-0.5">{title || (comp as any)?.title}</p>}
            </div>
            <ScoreChip score={displayedFinal} size="lg" />
          </div>
        </div>

        {scoringMode === "dimensions" && (
          <div className="grid grid-cols-3 gap-3 p-4" data-testid="dimension-tiles">
            {dimConfig.map((dim) => (
              <div key={dim.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2 cursor-default" data-testid={`dimension-tile-${dim.key}`}>
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
            overallScore={displayedFinal}
            items={
              scoringMode === "dimensions"
                ? [
                    ...(leapsScoringMode === "individual"
                      ? leapItems.map((li) => ({
                          key: `leap:${String(li.id)}`,
                          label: String(li.label || "Leap"),
                          score: effectiveFromInstances(li.instances || [], filter).score,
                        }))
                      : [{ key: "leaps", label: "Leaps & Design Principles", score: leapsDimScore }]),
                    { key: "health", label: "Mental & Physical Health", score: healthDimScore },
                    { key: "behavior", label: "Behavior, Attendance & Engagement", score: behaviorDimScore },
                  ]
                : []
            }
            threshold={2}
            maxPerSide={6}
            defaultOpen={false}
            testId="experience-flags"
          />
        </div>

        <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
          <span data-testid="instances-rated-count">
            {instanceCounts.scored}/{instanceCounts.total} instances rated
          </span>
          <span>Weighted: H=6, M=3, L=1</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4" data-testid="experience-scoring-mode">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-left",
              scoringMode === "dimensions" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
            onClick={() => setScoringMode("dimensions")}
            data-testid="mode-dimensions"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900">Dimensions</div>
              <p className="text-xs text-gray-500 mt-0.5">Score Leaps, Health, and Behavior separately, then roll up</p>
            </div>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all text-left",
              scoringMode === "overall" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
            onClick={() => setScoringMode("overall")}
            data-testid="mode-overall"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900">Overall</div>
              <p className="text-xs text-gray-500 mt-0.5">Attach instances directly to the component</p>
            </div>
          </button>
        </div>
      </div>

      {scoringMode === "overall" ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="experience-overall-instances">
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
              testIdPrefix="overall-exp"
            />
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
                      { key: "leaps" as const, label: "Leaps & Design Principles", score: leapsDimScore },
                      { key: "health" as const, label: "Mental & Physical Health", score: healthDimScore },
                      { key: "behavior" as const, label: "Behavior, Attendance & Engagement", score: behaviorDimScore },
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
                <h3 className="text-sm font-bold text-gray-900">Leaps &amp; Design Principles</h3>
                <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5 cursor-default">
                  <Lock className="w-2.5 h-2.5" />
                  {Math.round(adjustedWeights.leaps * 100)}%
                </Badge>
              </div>
              <ScoreChip score={leapsDimScore} size="sm" />
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2" data-testid="leaps-mode-toggle">
                <div className="text-xs text-gray-700 font-semibold">Leaps scoring</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left",
                      leapsScoringMode === "across" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300 bg-white",
                    )}
                    onClick={() => setLeapsScoringMode("across")}
                    data-testid="leaps-mode-across"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Across leaps</div>
                      <p className="text-xs text-gray-500 mt-0.5">One shared set of instances</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left",
                      leapsScoringMode === "individual" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300 bg-white",
                    )}
                    onClick={() => setLeapsScoringMode("individual")}
                    data-testid="leaps-mode-individual"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Individual leaps</div>
                      <p className="text-xs text-gray-500 mt-0.5">Score each leap, then roll up</p>
                    </div>
                  </button>
                </div>
                <div className="text-[11px] text-gray-500 mt-2">Switching modes does not delete saved values.</div>
              </div>

              {leapsScoringMode === "across" ? (
                <div className="space-y-3" data-testid="leaps-across">
                  <ScoreInstancesInlineEditor
                    label="Instances"
                    instances={leapsInstances}
                    onChange={setLeapsInstances}
                    actors={actorOptions}
                    onAddActor={(label) => {
                      addGlobalActor(label);
                      setActors((prev) => [...prev, label]);
                    }}
                    testIdPrefix="leaps-across"
                  />
                </div>
              ) : (
                <div className="space-y-3" data-testid="leaps-individual">
                  {leapItems.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400" data-testid="empty-leap-items">
                      No leaps are tagged in Designed Experience yet. Add leaps there to score them here.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leapItems.map((li) => {
                        const eff = effectiveFromInstances(li.instances || [], filter).score;
                        const instCount = Array.isArray(li.instances) ? li.instances.length : 0;
                        return (
                          <Collapsible key={li.id} defaultOpen={false}>
                            <div className="bg-gray-50 rounded-lg border border-gray-200" data-testid={`leap-item-${li.id}`}>
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <CollapsibleTrigger asChild>
                                    <button type="button" className="flex items-start gap-2 min-w-0 text-left">
                                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-gray-900 truncate">{li.label}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                          <span className={cn("inline-flex px-2 py-0.5 rounded-full border text-xs font-bold", scoreChip(eff))}>
                                            {eff === null ? "—" : String(eff)}
                                          </span>
                                          <span className="text-[11px] text-gray-500">Wt {li.weight}</span>
                                          <span className="text-[11px] text-gray-400">•</span>
                                          <span className="text-[11px] text-gray-500">{instCount} inst</span>
                                        </div>
                                      </div>
                                    </button>
                                  </CollapsibleTrigger>
                                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Weight</div>
                                    <WeightPicker value={li.weight} onChange={(v) => setLeapItems((prev) => prev.map((x) => (x.id === li.id ? { ...x, weight: v } : x)))} />
                                  </div>
                                </div>
                              </div>

                              <CollapsibleContent>
                                <div className="px-3 pb-3">
                                  <ScoreInstancesInlineEditor
                                    label="Instances"
                                    instances={li.instances}
                                    onChange={(next) => setLeapItems((prev) => prev.map((x) => (x.id === li.id ? { ...x, instances: next } : x)))}
                                    actors={actorOptions}
                                    onAddActor={(label) => {
                                      addGlobalActor(label);
                                      setActors((prev) => [...prev, label]);
                                    }}
                                    testIdPrefix={`leap-${li.id}`}
                                  />
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          ) : null}

          {activeDimTab === "health" ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="section-health">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className={cn("w-4 h-4", "text-rose-500")} />
                <h3 className="text-sm font-bold text-gray-900">Mental &amp; Physical Health</h3>
                <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5 cursor-default">
                  <Lock className="w-2.5 h-2.5" />
                  {Math.round(adjustedWeights.health * 100)}%
                </Badge>
              </div>
              <ScoreChip score={healthDimScore} size="sm" />
            </div>
            <div className="p-4 space-y-3">
              <ScoreInstancesInlineEditor
                instances={healthInstances}
                onChange={setHealthInstances}
                actors={actorOptions}
                onAddActor={(label) => {
                  addGlobalActor(label);
                  setActors((prev) => [...prev, label]);
                }}
                testIdPrefix="health"
              />
            </div>
          </div>
          ) : null}

          {activeDimTab === "behavior" ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="section-behavior">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className={cn("w-4 h-4", "text-blue-500")} />
                <h3 className="text-sm font-bold text-gray-900">Behavior, Attendance &amp; Engagement</h3>
                <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5 cursor-default">
                  <Lock className="w-2.5 h-2.5" />
                  {Math.round(adjustedWeights.behavior * 100)}%
                </Badge>
              </div>
              <ScoreChip score={behaviorDimScore} size="sm" />
            </div>
            <div className="p-4 space-y-3">
              <ScoreInstancesInlineEditor
                instances={behaviorInstances}
                onChange={setBehaviorInstances}
                actors={actorOptions}
                onAddActor={(label) => {
                  addGlobalActor(label);
                  setActors((prev) => [...prev, label]);
                }}
                testIdPrefix="behavior"
              />
            </div>
          </div>
          ) : null}
        </>
      )}
    </div>
  );
}

