import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronDown, Info, Layers, Package, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { calculateRingDesignDimensionScores, calculateRingDesignScore } from "@shared/ring-design-score";
import type { RingDesignScoreData, ScoreFilter, ScoreInstance } from "@shared/schema";
import { listSelectableYearKeys } from "@shared/marking-period";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ScoreFilterBar from "./score-filter-bar";
import ScoreInstancesInlineEditor from "./score-instances-inline-editor";
import { effectiveFromInstances } from "@shared/score-instances";
import { useGlobalActors } from "@/lib/actors-store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ScoreFlags from "./score-flags";

const DESIGN_BLUEPRINT_OPTIONS = ["Baseline", "Aspirational", "Journey: Early Stage", "Journey: Late Stage"] as const;
type WeightLabel = "H" | "M" | "L";

function normalizeWeightLabel(value: unknown): WeightLabel {
  if (value === "H" || value === "M" || value === "L") return value;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "M";
  if (n >= 4) return "H";
  if (n >= 2) return "M";
  return "L";
}

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function WeightPicker({
  value,
  onChange,
}: {
  value: WeightLabel;
  onChange: (v: WeightLabel) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-gray-50" data-testid="design-weight-picker">
      {(["L", "M", "H"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-bold transition-colors",
            value === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800",
            k !== "L" && "border-l border-gray-200"
          )}
          aria-pressed={value === k}
          data-testid={`design-weight-${k}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function ConfidenceSelect({
  value,
  onChange,
}: {
  value: WeightLabel;
  onChange: (v: WeightLabel) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as WeightLabel)}
      className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700"
      data-testid="confidence-select"
    >
      <option value="H">H</option>
      <option value="M">M</option>
      <option value="L">L</option>
    </select>
  );
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

interface RingDesignScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
}

export default function RingDesignScoreView({ nodeId, title, onBack, sourceFilter, onFilterChange }: RingDesignScoreViewProps) {
  const { actors: globalActors, addActor: addGlobalActor, mergeActors: mergeGlobalActors } = useGlobalActors();
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [designScoringMode, setDesignScoringMode] = useState<RingDesignScoreData["designScoringMode"]>("overall");
  const [activeDimTab, setActiveDimTab] = useState<"aims" | "experience" | "resources">("aims");
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
  const [overallInstances, setOverallInstances] = useState<ScoreInstance[]>([]);
  const [overallDesignScore, setOverallDesignScore] = useState<number | null>(null);
  const [overallDesignRationale, setOverallDesignRationale] = useState<string>("");
  const [overallDesignConfidence, setOverallDesignConfidence] = useState<WeightLabel>("M");
  const [designWeights, setDesignWeights] = useState<RingDesignScoreData["designWeights"]>({
    aimsWeight: "L",
    experienceWeight: "M",
    resourcesWeight: "M",
  });
  const [subDimensions, setSubDimensions] = useState<RingDesignScoreData["subDimensions"]>({
    aims: { leapsScore: null, outcomesScore: null, leapsInstances: [], outcomesInstances: [], leapsConfidence: "M", outcomesConfidence: "M" } as any,
    studentExperience: {
      thoroughnessScore: null,
      thoroughnessInstances: [],
      thoroughnessWeight: "L",
      leapinessScore: null,
      leapinessInstances: [],
      coherenceScore: null,
      coherenceInstances: [],
      coherenceWeight: "L",
      thoroughnessConfidence: "M",
      leapinessConfidence: "M",
      coherenceConfidence: "M",
    } as any,
    supportingResources: {
      thoroughnessScore: null,
      thoroughnessInstances: [],
      thoroughnessWeight: "M",
      qualityScore: null,
      qualityInstances: [],
      qualityWeight: "M",
      coherenceScore: null,
      coherenceInstances: [],
      coherenceWeight: "M",
      thoroughnessConfidence: "M",
      qualityConfidence: "M",
      coherenceConfidence: "M",
    } as any,
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (designScoringMode !== "overall") setActiveDimTab("aims");
  }, [designScoringMode]);

  useEffect(() => {
    if (!comp || initialized) return;
    const hd: any = comp.healthData || {};
    const rsd: Partial<RingDesignScoreData> = hd.ringDesignScoreData || {};

    setDesignScoringMode(rsd.designScoringMode || "overall");
    const saved: any = (rsd as any).filter || {};
    const initial: ScoreFilter =
      (sourceFilter as any) ||
      (saved?.mode
        ? (saved as any)
        : ({
            mode: "year",
            yearKey: listSelectableYearKeys(new Date(), 5)[0],
            aggregation: saved?.aggregation || "singleLatest",
            actorKey: saved?.actorKey,
          } as any));
    setLocalFilter(initial as any);
    setOverallInstances((Array.isArray((rsd as any).overallInstances) ? ((rsd as any).overallInstances as any[]) : []) as any);
    setOverallDesignScore(normalizeScore(rsd.overallDesignScore));
    setOverallDesignRationale(rsd.overallDesignRationale || "");
    setOverallDesignConfidence(normalizeWeightLabel((rsd as any).overallDesignConfidence ?? "M"));
    setDesignWeights({
      aimsWeight: normalizeWeightLabel(rsd.designWeights?.aimsWeight),
      experienceWeight: normalizeWeightLabel(rsd.designWeights?.experienceWeight),
      resourcesWeight: normalizeWeightLabel(rsd.designWeights?.resourcesWeight),
    });
    setSubDimensions({
      aims: {
        leapsScore: normalizeScore((rsd as any).subDimensions?.aims?.leapsScore),
        leapsInstances: (rsd as any).subDimensions?.aims?.leapsInstances || [],
        leapsRationale: (rsd as any).subDimensions?.aims?.leapsRationale,
        leapsConfidence: normalizeWeightLabel((rsd as any).subDimensions?.aims?.leapsConfidence ?? "M"),
        outcomesScore: normalizeScore((rsd as any).subDimensions?.aims?.outcomesScore),
        outcomesInstances: (rsd as any).subDimensions?.aims?.outcomesInstances || [],
        outcomesRationale: (rsd as any).subDimensions?.aims?.outcomesRationale,
        outcomesConfidence: normalizeWeightLabel((rsd as any).subDimensions?.aims?.outcomesConfidence ?? "M"),
      },
      studentExperience: {
        thoroughnessScore: normalizeScore((rsd as any).subDimensions?.studentExperience?.thoroughnessScore),
        thoroughnessInstances: (rsd as any).subDimensions?.studentExperience?.thoroughnessInstances || [],
        thoroughnessRationale: (rsd as any).subDimensions?.studentExperience?.thoroughnessRationale,
        thoroughnessConfidence: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.thoroughnessConfidence ?? "M"),
        thoroughnessWeight: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.thoroughnessWeight ?? "L"),
        leapinessScore: normalizeScore((rsd as any).subDimensions?.studentExperience?.leapinessScore),
        leapinessInstances: (rsd as any).subDimensions?.studentExperience?.leapinessInstances || [],
        leapinessRationale: (rsd as any).subDimensions?.studentExperience?.leapinessRationale,
        leapinessConfidence: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.leapinessConfidence ?? "M"),
        coherenceScore: normalizeScore((rsd as any).subDimensions?.studentExperience?.coherenceScore),
        coherenceInstances: (rsd as any).subDimensions?.studentExperience?.coherenceInstances || [],
        coherenceRationale: (rsd as any).subDimensions?.studentExperience?.coherenceRationale,
        coherenceConfidence: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.coherenceConfidence ?? "M"),
        coherenceWeight: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.coherenceWeight ?? "L"),
      },
      supportingResources: {
        thoroughnessScore: normalizeScore((rsd as any).subDimensions?.supportingResources?.thoroughnessScore),
        thoroughnessInstances: (rsd as any).subDimensions?.supportingResources?.thoroughnessInstances || [],
        thoroughnessRationale: (rsd as any).subDimensions?.supportingResources?.thoroughnessRationale,
        thoroughnessConfidence: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.thoroughnessConfidence ?? "M"),
        thoroughnessWeight: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.thoroughnessWeight ?? "M"),
        qualityScore: normalizeScore((rsd as any).subDimensions?.supportingResources?.qualityScore),
        qualityInstances: (rsd as any).subDimensions?.supportingResources?.qualityInstances || [],
        qualityRationale: (rsd as any).subDimensions?.supportingResources?.qualityRationale,
        qualityConfidence: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.qualityConfidence ?? "M"),
        qualityWeight: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.qualityWeight ?? "M"),
        coherenceScore: normalizeScore((rsd as any).subDimensions?.supportingResources?.coherenceScore),
        coherenceInstances: (rsd as any).subDimensions?.supportingResources?.coherenceInstances || [],
        coherenceRationale: (rsd as any).subDimensions?.supportingResources?.coherenceRationale,
        coherenceConfidence: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.coherenceConfidence ?? "M"),
        coherenceWeight: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.coherenceWeight ?? "M"),
      },
    } as any);
    setInitialized(true);
  }, [comp, initialized, sourceFilter]);

  const actorOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (a: unknown) => {
      const clean = String(a ?? "").trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };

    for (const a of Array.isArray(globalActors) ? globalActors : []) add(a);
    for (const inst of Array.isArray(overallInstances) ? overallInstances : []) add((inst as any)?.actor);

    const aims: any = (subDimensions as any)?.aims || {};
    for (const inst of Array.isArray(aims?.leapsInstances) ? aims.leapsInstances : []) add((inst as any)?.actor);
    for (const inst of Array.isArray(aims?.outcomesInstances) ? aims.outcomesInstances : []) add((inst as any)?.actor);

    const se: any = (subDimensions as any)?.studentExperience || {};
    for (const inst of Array.isArray(se?.thoroughnessInstances) ? se.thoroughnessInstances : []) add((inst as any)?.actor);
    for (const inst of Array.isArray(se?.leapinessInstances) ? se.leapinessInstances : []) add((inst as any)?.actor);
    for (const inst of Array.isArray(se?.coherenceInstances) ? se.coherenceInstances : []) add((inst as any)?.actor);

    const sr: any = (subDimensions as any)?.supportingResources || {};
    for (const inst of Array.isArray(sr?.thoroughnessInstances) ? sr.thoroughnessInstances : []) add((inst as any)?.actor);
    for (const inst of Array.isArray(sr?.qualityInstances) ? sr.qualityInstances : []) add((inst as any)?.actor);
    for (const inst of Array.isArray(sr?.coherenceInstances) ? sr.coherenceInstances : []) add((inst as any)?.actor);

    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [globalActors, overallInstances, subDimensions]);

  useEffect(() => {
    if (actorOptions.length > 0) mergeGlobalActors(actorOptions);
  }, [actorOptions, mergeGlobalActors]);

  const dimensionScores = useMemo(() => {
    const rsd: RingDesignScoreData = {
      designScoringMode,
      actors: actorOptions,
      filter,
      overallDesignScore,
      overallInstances,
      overallDesignRationale,
      overallDesignConfidence,
      designDimensions: { aimsScore: null, experienceScore: null, resourcesScore: null },
      designWeights,
      subDimensions,
      finalDesignScore: null,
    };
    return calculateRingDesignDimensionScores(rsd);
  }, [actorOptions, designScoringMode, designWeights, filter, overallDesignRationale, overallDesignScore, overallInstances, subDimensions]);

  const finalScore = useMemo(() => {
    const rsd: RingDesignScoreData = {
      designScoringMode,
      actors: actorOptions,
      filter,
      overallDesignScore,
      overallInstances,
      overallDesignRationale,
      overallDesignConfidence,
      designDimensions: dimensionScores,
      designWeights,
      subDimensions,
      finalDesignScore: null,
    };
    return calculateRingDesignScore({ healthData: { ringDesignScoreData: rsd } });
  }, [actorOptions, designScoringMode, designWeights, dimensionScores, filter, overallDesignRationale, overallDesignScore, overallInstances, subDimensions]);

  const dimTiles = useMemo(() => {
    return [
      { key: "aims", label: "Aims", icon: Target, score: (dimensionScores as any)?.aimsScore ?? null, weight: (designWeights as any)?.aimsWeight ?? "M" },
      {
        key: "experience",
        label: "Student experience",
        icon: Layers,
        score: (dimensionScores as any)?.experienceScore ?? null,
        weight: (designWeights as any)?.experienceWeight ?? "M",
      },
      {
        key: "resources",
        label: "Supporting resources",
        icon: Package,
        score: (dimensionScores as any)?.resourcesScore ?? null,
        weight: (designWeights as any)?.resourcesWeight ?? "M",
      },
    ] as const;
  }, [designWeights, dimensionScores]);

  const doSave = useCallback(
    (rsd: RingDesignScoreData, computed: number | null) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = comp?.healthData || {};
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              ringDesignScoreData: {
                ...rsd,
                finalDesignScore: computed,
              },
            },
          },
        });
      }, 600);
    },
    [comp, nodeId, updateMutation]
  );

  useEffect(() => {
    if (!initialized) return;
    const rsd: RingDesignScoreData = {
      designScoringMode,
      actors: actorOptions,
      filter,
      overallDesignScore,
      overallInstances,
      overallDesignRationale,
      overallDesignConfidence,
      designDimensions: dimensionScores,
      designWeights,
      subDimensions,
      finalDesignScore: finalScore,
    };
    doSave(rsd, finalScore);
  }, [
    actorOptions,
    designScoringMode,
    designWeights,
    doSave,
    finalScore,
    filter,
    initialized,
    overallDesignConfidence,
    overallDesignRationale,
    overallDesignScore,
    overallInstances,
    subDimensions,
    dimensionScores,
  ]);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="ring-design-score-view">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
        data-testid="button-back-design-score"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status &amp; Health
      </button>

      <ScoreFilterBar filter={filter as any} onChange={setFilter as any} actors={actorOptions} />

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="score-dashboard">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Design Score</h2>
              {(title || comp?.title) && <p className="text-sm text-gray-500 mt-0.5">{title || comp?.title}</p>}
            </div>
            <div data-testid="design-final-score">
              <ScoreChip score={finalScore} size="lg" />
            </div>
          </div>
        </div>

        {designScoringMode === "multi" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4" data-testid="dimension-tiles">
            {dimTiles.map((t) => (
              <div key={t.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2 cursor-default" data-testid={`dimension-tile-${t.key}`}>
                <div className="flex items-center gap-1.5">
                  <t.icon className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700 truncate">{t.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <ScoreChip score={t.score} size="sm" />
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                    W: {String(t.weight || "M")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="px-4 pb-4 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              {designScoringMode === "overall"
                ? "Overall mode: Final score equals the Overall Design Score (1–5)."
                : "Dimensions mode: Sub-dimension scores roll up into three dimensions, then the final score is a weighted average using H/M/L weights (rounded). Blank scores are ignored."}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4" data-testid="flags-section">
          <ScoreFlags
            overallScore={finalScore}
            items={[
              { key: "aims", label: "Aims for Learners", score: dimensionScores.aimsScore ?? null },
              { key: "experience", label: "Student Experience", score: dimensionScores.experienceScore ?? null },
              { key: "resources", label: "Supporting Resources & Routines", score: dimensionScores.resourcesScore ?? null },
            ]}
            threshold={2}
            defaultOpen={false}
            testId="design-flags"
          />
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>{designScoringMode === "overall" ? "Mode: Overall" : "Mode: Dimensions"}</span>
            <span>Weighted: H=4, M=2, L=1</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4" data-testid="design-scoring-mode">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <RadioGroup
          value={designScoringMode}
          onValueChange={(v) => setDesignScoringMode(v as "overall" | "multi")}
          className="grid grid-cols-2 gap-3"
        >
          <label
            htmlFor="design-mode-dimensions"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              designScoringMode === "multi" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="multi" id="design-mode-dimensions" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Dimensions</div>
              <p className="text-xs text-gray-500 mt-0.5">Score sub-dimensions and roll up using H/M/L weights</p>
            </div>
          </label>
          <label
            htmlFor="design-mode-overall"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              designScoringMode === "overall" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="overall" id="design-mode-overall" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Overall</div>
              <p className="text-xs text-gray-500 mt-0.5">Set a single overall score for design</p>
            </div>
          </label>
        </RadioGroup>
        <p className="text-[10px] text-gray-400">Switching modes does not delete saved values.</p>
      </div>

      {designScoringMode === "overall" ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="design-overall-section">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Overall Design Score</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              1–5
            </Badge>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-gray-700">Instances</div>
              <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                Score {effectiveFromInstances(overallInstances || [], filter).score ?? "—"}
              </Badge>
            </div>
            <ScoreInstancesInlineEditor
              instances={overallInstances as any}
              onChange={setOverallInstances as any}
              actors={actorOptions}
              onAddActor={(label) => addGlobalActor(label)}
              testIdPrefix="design-overall"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-500">Overall confidence (optional)</span>
              <ConfidenceSelect value={overallDesignConfidence} onChange={setOverallDesignConfidence} />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="design-dimensions-section">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Dimensions</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              H/M/L weights
            </Badge>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3" data-testid="design-dimension-tabs">
              <Tabs value={activeDimTab} onValueChange={(v) => setActiveDimTab(v as any)} className="w-full">
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-gray-200 gap-6">
                  {(
                    [
                      { key: "aims" as const, label: "Aims for Learners", score: dimensionScores.aimsScore ?? null },
                      { key: "experience" as const, label: "Student Experience", score: dimensionScores.experienceScore ?? null },
                      { key: "resources" as const, label: "Supporting Resources & Routines", score: dimensionScores.resourcesScore ?? null },
                    ] as const
                  ).map((t) => (
                    <TabsTrigger
                      key={t.key}
                      value={t.key}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-900 data-[state=active]:shadow-none px-0 py-2 text-gray-500 hover:text-gray-700 bg-transparent flex items-center gap-2"
                      data-testid={`design-dim-tab-${t.key}`}
                    >
                      <span className="truncate max-w-[260px]">{t.label}</span>
                      <ScoreChip score={t.score} size="sm" />
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Aims */}
            {activeDimTab === "aims" ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3" data-testid="design-dimension-aims">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[10px] text-gray-500">2 sub-dimensions (Leaps, Outcomes). Weights are fixed.</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-500">Dimension weight</span>
                    <WeightPicker value={normalizeWeightLabel(designWeights.aimsWeight)} onChange={(v) => setDesignWeights((prev) => ({ ...prev, aimsWeight: v }))} />
                  </div>
                </div>

                {(
                  [
                    { key: "leapsScore", instancesKey: "leapsInstances", label: "Leaps" },
                    { key: "outcomesScore", instancesKey: "outcomesInstances", label: "Outcomes" },
                  ] as const
                ).map((row) => {
                  const instances = ((subDimensions as any).aims as any)?.[row.instancesKey] as any[];
                  const instCount = Array.isArray(instances) ? instances.length : 0;
                  const score = effectiveFromInstances((Array.isArray(instances) ? instances : []) as any, filter).score;
                  return (
                    <Collapsible key={row.key} defaultOpen={false}>
                      <div className="bg-white rounded-md border border-gray-200" data-testid={`aims-sub-${row.key}`}>
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <CollapsibleTrigger asChild>
                              <button type="button" className="flex items-center gap-2 min-w-0 text-left">
                                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-800 truncate">{row.label}</div>
                                  <div className="text-[10px] text-gray-500">{instCount} instance{instCount === 1 ? "" : "s"}</div>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                                Wt M (locked)
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                                Score {score ?? "—"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="px-3 pb-3">
                            <ScoreInstancesInlineEditor
                              instances={(Array.isArray(instances) ? instances : []) as any}
                              onChange={(next) =>
                                setSubDimensions((prev) => ({
                                  ...prev,
                                  aims: { ...(prev.aims as any), [row.instancesKey]: next },
                                }))
                              }
                              actors={actorOptions}
                              onAddActor={(label) => addGlobalActor(label)}
                              testIdPrefix={`aims-${row.key}`}
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            ) : null}

              {/* Student Experience */}
            {activeDimTab === "experience" ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3" data-testid="design-dimension-experience">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[10px] text-gray-500">3 sub-dimensions. Leapiness weight is fixed.</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-500">Dimension weight</span>
                    <WeightPicker
                      value={normalizeWeightLabel(designWeights.experienceWeight)}
                      onChange={(v) => setDesignWeights((prev) => ({ ...prev, experienceWeight: v }))}
                    />
                  </div>
                </div>

                {(
                  [
                    {
                      key: "thoroughnessScore",
                      label: "Thoroughness of designed student experience",
                      weightKey: "thoroughnessWeight",
                      rationaleKey: "thoroughnessRationale",
                      weightLocked: false,
                    },
                    {
                      key: "leapinessScore",
                      label: "Leapiness of designed student experience",
                      weightKey: null,
                      rationaleKey: "leapinessRationale",
                      weightLocked: true,
                      lockedWeight: "H" as const,
                    },
                    {
                      key: "coherenceScore",
                      label: "Coherence of designed student experience",
                      weightKey: "coherenceWeight",
                      rationaleKey: "coherenceRationale",
                      weightLocked: false,
                    },
                  ] as const
                ).map((row) => {
                  const instances = (subDimensions.studentExperience as any)?.[`${String(row.key).replace("Score", "")}Instances`] as any[];
                  const weight =
                    row.weightLocked
                      ? row.lockedWeight
                      : normalizeWeightLabel((subDimensions.studentExperience as any)[row.weightKey as any]);
                  const instCount = Array.isArray(instances) ? instances.length : 0;
                  const score = effectiveFromInstances((Array.isArray(instances) ? instances : []) as any, filter).score;

                  return (
                    <Collapsible key={row.key} defaultOpen={false}>
                      <div className="bg-white rounded-md border border-gray-200" data-testid={`se-sub-${row.key}`}>
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <CollapsibleTrigger asChild>
                              <button type="button" className="flex items-center gap-2 min-w-0 text-left">
                                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-800 truncate">{row.label}</div>
                                  <div className="text-[10px] text-gray-500">{instCount} instance{instCount === 1 ? "" : "s"}</div>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {row.weightLocked ? (
                                <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                                  Wt {weight} (locked)
                                </Badge>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-gray-500">Wt</span>
                                  <WeightPicker
                                    value={weight}
                                    onChange={(v) =>
                                      setSubDimensions((prev) => ({
                                        ...prev,
                                        studentExperience: { ...(prev.studentExperience as any), [row.weightKey as any]: v },
                                      }))
                                    }
                                  />
                                </div>
                              )}
                              <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                                Score {score ?? "—"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="px-3 pb-3">
                            <ScoreInstancesInlineEditor
                              instances={(Array.isArray(instances) ? instances : []) as any}
                              onChange={(next) =>
                                setSubDimensions((prev) => ({
                                  ...prev,
                                  studentExperience: {
                                    ...(prev.studentExperience as any),
                                    [`${String(row.key).replace("Score", "")}Instances`]: next,
                                  },
                                }))
                              }
                              actors={actorOptions}
                              onAddActor={(label) => addGlobalActor(label)}
                              testIdPrefix={`se-${row.key}`}
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            ) : null}

              {/* Supporting Resources & Routines */}
            {activeDimTab === "resources" ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3" data-testid="design-dimension-resources">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[10px] text-gray-500">3 sub-dimensions.</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-500">Dimension weight</span>
                    <WeightPicker
                      value={normalizeWeightLabel(designWeights.resourcesWeight)}
                      onChange={(v) => setDesignWeights((prev) => ({ ...prev, resourcesWeight: v }))}
                    />
                  </div>
                </div>

                {(
                  [
                    { key: "thoroughnessScore", label: "Thoroughness", weightKey: "thoroughnessWeight", rationaleKey: "thoroughnessRationale" },
                    { key: "qualityScore", label: "Quality", weightKey: "qualityWeight", rationaleKey: "qualityRationale" },
                    { key: "coherenceScore", label: "Coherence", weightKey: "coherenceWeight", rationaleKey: "coherenceRationale" },
                  ] as const
                ).map((row) => {
                  const weight = normalizeWeightLabel((subDimensions.supportingResources as any)[row.weightKey]);
                  const instances = (subDimensions.supportingResources as any)?.[`${String(row.key).replace("Score", "")}Instances`] as any[];
                  const instCount = Array.isArray(instances) ? instances.length : 0;
                  const score = effectiveFromInstances((Array.isArray(instances) ? instances : []) as any, filter).score;
                  return (
                    <Collapsible key={row.key} defaultOpen={false}>
                      <div className="bg-white rounded-md border border-gray-200" data-testid={`sr-sub-${row.key}`}>
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <CollapsibleTrigger asChild>
                              <button type="button" className="flex items-center gap-2 min-w-0 text-left">
                                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-800 truncate">{row.label}</div>
                                  <div className="text-[10px] text-gray-500">{instCount} instance{instCount === 1 ? "" : "s"}</div>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-gray-500">Wt</span>
                                <WeightPicker
                                  value={weight}
                                  onChange={(v) =>
                                    setSubDimensions((prev) => ({
                                      ...prev,
                                      supportingResources: { ...(prev.supportingResources as any), [row.weightKey]: v },
                                    }))
                                  }
                                />
                              </div>
                              <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                                Score {score ?? "—"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="px-3 pb-3">
                            <ScoreInstancesInlineEditor
                              instances={(Array.isArray(instances) ? instances : []) as any}
                              onChange={(next) =>
                                setSubDimensions((prev) => ({
                                  ...prev,
                                  supportingResources: {
                                    ...(prev.supportingResources as any),
                                    [`${String(row.key).replace("Score", "")}Instances`]: next,
                                  },
                                }))
                              }
                              actors={actorOptions}
                              onAddActor={(label) => addGlobalActor(label)}
                              testIdPrefix={`sr-${row.key}`}
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

