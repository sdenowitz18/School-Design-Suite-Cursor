import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  BarChart3,
  AlertCircle,
  Sparkles,
  Check,
  X,
  Pencil,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { effectiveFromInstances, getPeriodEndFromFilter, UNKNOWN_ACTOR_KEY, normActor, computeMeasureWeight, computeMeasureWeightDisplay, computeMeasureWeightNumeric, OUTCOME_WEIGHT_VALUES } from "@shared/score-instances";
import {
  listSelectableYearKeys,
  toIsoDateString,
  minAsOfDate,
} from "@shared/marking-period";
import type { OutcomeMeasure, ScoreFilter, ScoreInstance, OutcomeScoreData, OutcomePeriodSnapshot } from "@shared/schema";
import ScoreFilterBar from "./score-filter-bar";
import ScoreFlags from "./score-flags";
import { useGlobalActors } from "@/lib/actors-store";
import {
  LEARNING_ADVANCEMENT_OUTCOME_TREE,
  WELLBEING_CONDUCT_OUTCOME_TREE,
  allL2IdsFromTree,
  getL1ByIdInTree,
  buildAllL2OptionsFromTree,
  type OutcomeSubDimL1,
  type OutcomeSubDimL2,
} from "@shared/outcome-subdimension-tree";
import { classifyImplementationMultiTagSelection } from "@shared/implementation-subdimension-tree";
import { classifyDesignMultiTagSelection } from "@shared/design-subdimension-tree";
import {
  calcL2Score,
  calcL1Score,
  calcOverallOutcomeScore,
  calcMeasureScore,
  normalizedWeightedAvg,
  measureDelta,
  l2Delta,
  l1Delta,
  collectInstanceFlagItems,
  type DeltaDirection,
} from "@shared/outcome-score-calc";
import { IMPLEMENTATION_MEASURE_WEIGHT_VALUES } from "@shared/implementation-score-calc";

export type OutcomeScoreVariant = "learningAdvancement" | "wellbeingConduct";

const OUTCOME_VARIANT_CONFIG: Record<
  OutcomeScoreVariant,
  {
    healthDataKey: string;
    tree: OutcomeSubDimL1[];
    scoreTitle: string;
    dashboardHeading: string;
  }
> = {
  learningAdvancement: {
    healthDataKey: "learningAdvancementOutcomeScoreData",
    tree: LEARNING_ADVANCEMENT_OUTCOME_TREE,
    scoreTitle: "Learning & advancement outcomes",
    dashboardHeading: "Learning & advancement outcome score",
  },
  wellbeingConduct: {
    healthDataKey: "wellbeingConductOutcomeScoreData",
    tree: WELLBEING_CONDUCT_OUTCOME_TREE,
    scoreTitle: "Wellbeing & conduct outcomes",
    dashboardHeading: "Wellbeing & conduct outcome score",
  },
};

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function clamp1to5(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v)));
}

export function ScoreChip({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
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
  const rounded = clamp1to5(score);
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
    >
      {rounded}
    </div>
  );
}

function createOutcomeMeasure(name: string = "", measureType: "measure" | "perception" = "measure"): OutcomeMeasure {
  return {
    id: generateId(),
    name,
    appliesTo: "All students",
    priority: "M",
    confidence: "M",
    importance: "M",
    type: measureType,
    rating: null,
    instances: [],
    subDimensionIds: [],
    description: "",
    justification: "",
    reflectionAchievement: "",
    reflectionVariability: "",
    skipped: false,
    portedFlag: false,
    periodHistory: [],
    crossOutcome: false,
  } as OutcomeMeasure;
}

function safeHML(v: unknown): "H" | "M" | "L" {
  return v === "H" || v === "M" || v === "L" ? v : "M";
}

function computedWeight(m: OutcomeMeasure): "H" | "M" | "L" {
  return computeMeasureWeight(safeHML((m as any).importance), safeHML(m.confidence));
}

function computedWeightDisplay(m: OutcomeMeasure): string {
  return computeMeasureWeightDisplay(safeHML((m as any).importance), safeHML(m.confidence));
}

const WEIGHT_LABELS: Record<string, string> = { H: "High", M: "Medium", L: "Low" };

export function DeltaArrow({ delta }: { delta: DeltaDirection | null }) {
  if (delta === null) return null;
  if (delta === "up") return <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />;
  if (delta === "down") return <ArrowDown className="w-3.5 h-3.5 text-red-500" />;
  return <ArrowRight className="w-3.5 h-3.5 text-gray-400" />;
}

type MPMode = "year" | "semester" | "quarter";

function getMeasureMP(m: OutcomeMeasure): { mode: MPMode; key: string } | null {
  const mp = (m as any).markingPeriod;
  if (mp && typeof mp === "object") {
    const mode: MPMode = mp.mode === "semester" || mp.mode === "quarter" ? mp.mode : "year";
    const key = mode === "semester" ? (mp.semesterKey || "") : mode === "quarter" ? (mp.quarterKey || "") : (mp.yearKey || "");
    if (key) return { mode, key };
  }
  // Backwards compat: flat markingPeriodMode / markingPeriodKey (legacy)
  const flatMode = (m as any).markingPeriodMode;
  const flatKey = String((m as any).markingPeriodKey || "").trim();
  if (flatKey && (flatMode === "semester" || flatMode === "quarter" || flatMode === "year")) {
    return { mode: flatMode, key: flatKey };
  }
  return null;
}

function mpLabel(mode: MPMode, key: string): string {
  if (mode === "year") return key;
  const [y, part] = key.split("-");
  if (!y || !part) return key;
  if (mode === "semester") return `${part === "Fall" ? "S1" : "S2"} ${y}`;
  return `${part} ${y}`;
}


export function getFlagStatus(
  items: { score: number | null }[],
  overallScore: number | null,
  threshold = 1,
): "concern" | "excellence" | "both" | null {
  if (overallScore === null) return null;
  const base = Math.max(1, Math.min(5, Math.round(overallScore)));
  let hasConcern = false;
  let hasExcellence = false;
  for (const it of items) {
    if (it.score === null) continue;
    const s = Math.max(1, Math.min(5, Math.round(it.score)));
    if (s - base >= threshold) hasExcellence = true;
    if (base - s >= threshold) hasConcern = true;
  }
  if (hasExcellence && hasConcern) return "both";
  if (hasExcellence) return "excellence";
  if (hasConcern) return "concern";
  return null;
}

// ─── Sub-dimension tile ────────────────────────────────────────────────

export function SubDimTile({
  label,
  fullLabel,
  score,
  weight,
  measureCount,
  onClick,
  onNavigate,
  onWeightChange,
  active,
  delta,
  flagStatus,
}: {
  label: string;
  /** Shown in native tooltip on hover (full text when `label` is truncated). */
  fullLabel?: string;
  score: number | null;
  weight?: "H" | "M" | "L";
  measureCount: number;
  onClick?: () => void;
  onNavigate?: () => void;
  onWeightChange?: (w: "H" | "M" | "L") => void;
  active?: boolean;
  delta?: DeltaDirection | null;
  flagStatus?: "concern" | "excellence" | "both" | null;
}) {
  const isBothFlag = flagStatus === "both" && !active;

  const scoreChip = (
    <div
      className={cn(
        !isBothFlag && !active && flagStatus === "concern" && "ring-2 ring-red-400 rounded",
        !isBothFlag && !active && flagStatus === "excellence" && "ring-2 ring-emerald-400 rounded",
      )}
      style={isBothFlag ? {
        padding: "2px",
        borderRadius: "0.375rem",
        background: "repeating-linear-gradient(135deg, #ef4444 0px, #ef4444 5px, #10b981 5px, #10b981 10px)",
      } : {}}
    >
      <div
        className={cn(
          "w-9 h-9 rounded flex items-center justify-center text-sm font-bold",
          isBothFlag ? "rounded-[3px]" : "",
          score !== null
            ? score >= 4 ? "bg-emerald-100 text-emerald-700" : score >= 3 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-400",
        )}
      >
        {score !== null ? clamp1to5(score) : "—"}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 p-2.5 rounded-lg border transition-all",
        active ? "bg-blue-50 border-blue-400 ring-1 ring-blue-300" : "bg-gray-50 border-gray-200",
        onClick && "cursor-pointer hover:border-blue-300 hover:bg-blue-50/30",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center gap-1 shrink-0">
        {scoreChip}
        <DeltaArrow delta={delta ?? null} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium truncate block" title={fullLabel ?? label}>
          {label}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-gray-500">{measureCount} measure{measureCount !== 1 ? "s" : ""}</span>
          {onWeightChange ? (
            <select
              className="h-5 text-[9px] rounded border border-gray-200 bg-white px-1 font-semibold text-gray-500"
              value={weight}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onWeightChange(e.target.value as any); }}
            >
              <option value="H">H</option>
              <option value="M">M</option>
              <option value="L">L</option>
            </select>
          ) : weight ? (
            <span className="text-[9px] text-gray-400">wt: {weight}</span>
          ) : null}
        </div>
      </div>
      {onNavigate && (
        <button
          type="button"
          className="p-1 rounded hover:bg-gray-200 transition-colors shrink-0"
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          title={`View ${label} details`}
        >
          <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
        </button>
      )}
    </div>
  );
}

// ─── OutcomeMeasureCard ────────────────────────────────────────────────

export function OutcomeMeasureCard({
  measure,
  onUpdate,
  onDelete,
  actors,
  onAddActor,
  filter,
  allL2s,
  subDimensionWeights,
  measureScoringMode = "outcome",
  dimensionTagTree,
}: {
  measure: OutcomeMeasure;
  onUpdate: (m: OutcomeMeasure) => void;
  onDelete: () => void;
  actors: string[];
  onAddActor?: (label: string) => void;
  filter: ScoreFilter;
  allL2s?: { id: string; label: string }[];
  subDimensionWeights?: Record<string, "H" | "M" | "L">;
  measureScoringMode?: "outcome" | "implementation" | "design";
  dimensionTagTree?: OutcomeSubDimL1[];
}) {
  const isImpStyle = measureScoringMode === "implementation" || measureScoringMode === "design";
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [showReweight, setShowReweight] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState<string | null>(null);
  const [showCrossOutcomeModal, setShowCrossOutcomeModal] = useState(false);
  const [pendingSubDimIds, setPendingSubDimIds] = useState<string[]>([]);
  const [showImplParentModal, setShowImplParentModal] = useState(false);
  const [showImplFullModal, setShowImplFullModal] = useState(false);
  const [pendingImplTagIds, setPendingImplTagIds] = useState<string[]>([]);
  const [showDesignMultiModal, setShowDesignMultiModal] = useState(false);
  const minDate = useMemo(() => minAsOfDate(new Date(), 5), []);
  const score = useMemo(() => calcMeasureScore(measure, filter), [filter, measure]);
  const mDelta = useMemo(() => measureDelta(measure, filter), [measure, filter]);
  const imp = safeHML((measure as any).importance);
  const mWeight = isImpStyle ? imp : computedWeight(measure);
  const mWeightDisplay = isImpStyle
    ? String(IMPLEMENTATION_MEASURE_WEIGHT_VALUES[imp])
    : computedWeightDisplay(measure);
  const tagTree = dimensionTagTree ?? LEARNING_ADVANCEMENT_OUTCOME_TREE;
  const overallTagLabel =
    measureScoringMode === "implementation"
      ? "Overall"
      : measureScoringMode === "design"
        ? "Overall design"
        : "All Outcomes";
  const periodEnd = useMemo(() => getPeriodEndFromFilter(filter), [filter]);

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

  const ADD_NEW_KEY = "__add_new__";
  const [addingByInstId, setAddingByInstId] = useState<Record<string, boolean>>({});
  const [draftByInstId, setDraftByInstId] = useState<Record<string, string>>({});

  const updateInstances = (next: ScoreInstance[]) => {
    onUpdate({ ...measure, rating: null, instances: next });
  };

  const addInstance = () => {
    const existing = measure.instances || [];
    const existingInPeriod = existing.filter((inst) => {
      if ((inst as any).retired) return false;
      if (!periodEnd) return true;
      return String(inst.asOfDate || "") <= periodEnd;
    });
    const next: ScoreInstance = {
      id: generateId(),
      actor: "",
      asOfDate: toIsoDateString(new Date()),
      score: null,
      weight: mWeight,
      importance: "M",
      confidence: "M",
      rationale: "",
      retired: false,
    };
    updateInstances([...existing, next]);
    if (existingInPeriod.length >= 1) {
      setShowReweight(true);
    }
  };

  const taggedL2Labels = useMemo(() => {
    if (!allL2s) return [];
    const ids = new Set(measure.subDimensionIds || []);
    return allL2s.filter((l) => ids.has(l.id));
  }, [allL2s, measure.subDimensionIds]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={(open) => {
        setIsExpanded(open);
        if (!open) {
          setIsEditing(false);
          setShowTagEditor(false);
        }
      }}
    >
      <div
        className="bg-white border rounded-lg overflow-hidden transition-all border-gray-200 shadow-sm"
        data-testid={`outcome-measure-card-${measure.id}`}
      >
        {/* ── Card header ── */}
        <div className="flex items-center px-3 py-2.5 gap-2">
          <CollapsibleTrigger asChild>
            <div
              className="flex items-center justify-between flex-1 min-w-0 hover:bg-gray-50/50 transition-colors cursor-pointer rounded-md group"
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center gap-2 text-left min-w-0 flex-1">
                <div className="flex items-center gap-0.5 shrink-0">
                  <div
                    className={cn(
                      "w-7 h-7 rounded flex items-center justify-center text-xs font-bold",
                      score !== null
                        ? score >= 4 ? "bg-emerald-100 text-emerald-700" : score === 3 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-400",
                    )}
                  >
                    {score !== null ? clamp1to5(score) : "—"}
                  </div>
                  <DeltaArrow delta={mDelta} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {(measure as any).type === "perception" ? "[Perception] " : (measure as any).type === "measure" ? "[Framework-based] " : ""}{measure.name || "Untitled measure"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px] text-gray-500">
                    <span className="uppercase tracking-wider">wt: {mWeightDisplay}</span>
                    <span className="text-gray-300">·</span>
                    {taggedL2Labels.length === 0 && (
                      <span className="text-[9px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{overallTagLabel}</span>
                    )}
                    {taggedL2Labels.map((l) => (
                      <span key={l.id} className="text-[9px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                        {l.label}{subDimensionWeights ? ` (${subDimensionWeights[l.id] || "M"})` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                  Instances {(measure.instances || []).length}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </div>
          </CollapsibleTrigger>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Delete measure */}
            <button
              type="button"
              className="p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Delete measure"
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Edit mode toggle */}
            <button
              type="button"
              className={cn(
                "p-1.5 rounded transition-colors",
                isEditing ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
              )}
              title="Edit measure"
              onClick={() => {
                if (!isExpanded) {
                  setIsExpanded(true);
                  setIsEditing(true);
                } else {
                  const next = !isEditing;
                  setIsEditing(next);
                  if (!next) setShowTagEditor(false);
                }
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Reweight instances dialog (Step 4) ── */}
        <Dialog open={showReweight} onOpenChange={setShowReweight}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Review instance weights</DialogTitle>
              <DialogDescription>
                You added a new instance. Review the importance and confidence weights for all instances counted in this measure's score.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-1 max-h-72 overflow-y-auto">
              {(measure.instances || []).map((inst) => {
                const isRetiredInst = !!(inst as any).retired;
                return (
                  <div key={inst.id} className={cn(
                    "flex items-center gap-3 rounded-lg p-2.5",
                    isRetiredInst ? "bg-gray-50 opacity-50" : "bg-gray-50"
                  )}>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-700 truncate block">{String(inst.actor || "Unknown")}</span>
                      <span className="text-[10px] text-gray-400">
                        {String(inst.asOfDate || "")} · Score: {inst.score ?? "—"}
                        {isRetiredInst && <span className="ml-1 text-gray-400 italic">· Retired</span>}
                      </span>
                    </div>
                                       {!isRetiredInst && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-gray-500">Imp.</span>
                        <select
                          className="h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] font-semibold"
                          value={(inst as any).importance || "M"}
                          onChange={(e) => updateInstances((measure.instances || []).map((x) => x.id === inst.id ? { ...x, importance: e.target.value as "H" | "M" | "L" } : x))}
                        >
                          <option value="L">L</option>
                          <option value="M">M</option>
                          <option value="H">H</option>
                        </select>
                        {!isImpStyle && (
                          <>
                            <span className="text-[10px] text-gray-500">Conf.</span>
                            <select
                              className="h-7 rounded border border-gray-200 bg-white px-1.5 text-[11px] font-semibold"
                              value={(inst as any).confidence || "M"}
                              onChange={(e) => updateInstances((measure.instances || []).map((x) => x.id === inst.id ? { ...x, confidence: e.target.value as "H" | "M" | "L" } : x))}
                            >
                              <option value="L">L</option>
                              <option value="M">M</option>
                              <option value="H">H</option>
                            </select>
                          </>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className={cn("p-1 rounded transition-colors shrink-0", isRetiredInst ? "text-blue-400 hover:text-blue-600" : "text-gray-400 hover:text-red-500")}
                      title={isRetiredInst ? "Un-retire" : "Retire"}
                      onClick={() => updateInstances((measure.instances || []).map((x) =>
                        x.id === inst.id ? { ...x, retired: !isRetiredInst } : x
                      ))}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button size="sm" className="h-8 text-xs" onClick={() => setShowReweight(false)}>
                <Check className="w-3.5 h-3.5 mr-1" /> Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Cross-outcome acknowledgement modal ── */}
        <Dialog open={showCrossOutcomeModal} onOpenChange={(open) => { if (!open) { setPendingSubDimIds([]); setShowCrossOutcomeModal(false); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Multiple sub-dimensions selected</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Selecting more than one sub-dimension means this measure will contribute to the overall dimension score, not to individual sub-dimension ratings.
                <br /><br />
                To affect individual sub-dimensions, add a separate measure for each one.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setPendingSubDimIds([]); setShowCrossOutcomeModal(false); }}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => {
                onUpdate({ ...measure, subDimensionIds: pendingSubDimIds, crossOutcome: true } as any);
                setPendingSubDimIds([]);
                setShowCrossOutcomeModal(false);
              }}>
                Confirm — dimension-level contribution
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {measureScoringMode === "implementation" && (
          <>
            <Dialog open={showImplParentModal} onOpenChange={(open) => { if (!open) { setPendingImplTagIds([]); setShowImplParentModal(false); } }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Overall measure for this sub-dimension</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed">
                    {(() => {
                      const c = classifyImplementationMultiTagSelection(pendingImplTagIds);
                      const label = c.kind === "parent_overall" ? c.parentLabel : "this area";
                      return (
                        <>
                          This measure will contribute to the score for{" "}
                          <span className="font-semibold text-gray-800">{label}</span> as a whole, not to individual sub-components.
                          <br /><br />
                          Add separate measures if you need scores for each component.
                        </>
                      );
                    })()}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setPendingImplTagIds([]); setShowImplParentModal(false); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      const c = classifyImplementationMultiTagSelection(pendingImplTagIds);
                      if (c.kind === "parent_overall") {
                        onUpdate({ ...measure, subDimensionIds: [c.parentId], crossOutcome: false } as any);
                      }
                      setPendingImplTagIds([]);
                      setShowImplParentModal(false);
                    }}
                  >
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={showImplFullModal} onOpenChange={(open) => { if (!open) { setPendingImplTagIds([]); setShowImplFullModal(false); } }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Overall implementation measure</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed">
                    You selected tags from more than one implementation sub-dimension. This measure will contribute to the{" "}
                    <span className="font-semibold text-gray-800">overall implementation score</span> only, not to individual sub-dimensions.
                    <br /><br />
                    Add separate measures if you need scores for specific sub-dimensions.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setPendingImplTagIds([]); setShowImplFullModal(false); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      onUpdate({ ...measure, subDimensionIds: [], crossOutcome: false } as any);
                      setPendingImplTagIds([]);
                      setShowImplFullModal(false);
                    }}
                  >
                    Confirm — overall implementation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {measureScoringMode === "design" && (
          <Dialog open={showDesignMultiModal} onOpenChange={(open) => { if (!open) setShowDesignMultiModal(false); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Overall design score</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  You selected more than one design sub-dimension. This measure will contribute to the{" "}
                  <span className="font-semibold text-gray-800">overall design score</span> only (untagged), not to individual sub-dimensions.
                  <br /><br />
                  Add separate measures if you need scores for specific sub-dimensions.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowDesignMultiModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    onUpdate({ ...measure, subDimensionIds: [], crossOutcome: false } as any);
                    setShowDesignMultiModal(false);
                  }}
                >
                  Confirm — overall design
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ── Retire confirmation dialog (Step 5) ── */}
        <Dialog open={!!showRetireConfirm} onOpenChange={(open) => { if (!open) setShowRetireConfirm(null); }}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>Retire this instance?</DialogTitle>
              <DialogDescription>
                It will be excluded from scoring but remain visible. You can un-retire it at any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowRetireConfirm(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={() => {
                if (showRetireConfirm) {
                  updateInstances((measure.instances || []).map((x) => x.id === showRetireConfirm ? { ...x, retired: true } : x));
                  setShowRetireConfirm(null);
                }
              }}>
                <Archive className="w-3.5 h-3.5" /> Retire
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CollapsibleContent>
          <div className="border-t border-gray-200 px-3 py-3 space-y-3">

            {/* ── Summary (view mode only) ── */}
            {!isEditing && (
              <div className="space-y-2.5">
                {measure.description ? (
                  <p className="text-xs text-gray-700 leading-relaxed">{measure.description}</p>
                ) : (
                  <p className="text-xs text-gray-400 italic">No description</p>
                )}
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold tracking-wide">Importance</span>
                    <p className="text-gray-700 font-medium">
                      {{ H: "High", M: "Medium", L: "Low" }[(measure as any).importance as "H" | "M" | "L"] ?? "Medium"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold tracking-wide">Confidence</span>
                    <p className="text-gray-700 font-medium">
                      {{ H: "High", M: "Medium", L: "Low" }[measure.confidence as "H" | "M" | "L"] ?? "Medium"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold tracking-wide">Weight</span>
                    <p className="text-gray-700 font-medium">{mWeightDisplay} <span className="text-gray-400 font-normal text-[10px]">(out of 5)</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Edit mode panel (only when isEditing) ── */}
            {isEditing && (
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Editing measure</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-blue-600"
                    onClick={() => { setIsEditing(false); setShowTagEditor(false); }}
                  >
                    <Check className="w-3 h-3 mr-1" /> Done
                  </Button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Measure Name</Label>
                    <Input
                      value={measure.name}
                      onChange={(e) => onUpdate({ ...measure, name: e.target.value })}
                      placeholder="Measure name..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Description</Label>
                    <Textarea
                      value={measure.description || ""}
                      onChange={(e) => onUpdate({ ...measure, description: e.currentTarget.value })}
                      placeholder="Describe this measure..."
                      className="text-xs min-h-[48px] bg-white"
                    />
                  </div>
                  <div className={cn("grid gap-2", isImpStyle ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Importance</Label>
                      <select
                        className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                        value={(measure as any).importance || "M"}
                        onChange={(e) => {
                          const imp = e.target.value as "H" | "M" | "L";
                          if (isImpStyle) {
                            const insts = (measure.instances || []).map((i) => ({
                              ...i,
                              weight: imp,
                              importance: imp,
                              confidence: (i as any).confidence || "M",
                            }));
                            onUpdate({ ...measure, importance: imp, instances: insts } as any);
                          } else {
                            const w = computeMeasureWeight(imp, measure.confidence || "M");
                            const insts = (measure.instances || []).map((i) => ({ ...i, weight: w }));
                            onUpdate({ ...measure, importance: imp, instances: insts } as any);
                          }
                        }}
                      >
                        <option value="H">High</option>
                        <option value="M">Medium</option>
                        <option value="L">Low</option>
                      </select>
                    </div>
                    {!isImpStyle && (
                      <div>
                        <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Confidence</Label>
                        <select
                          className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                          value={measure.confidence || "M"}
                          onChange={(e) => {
                            const conf = e.target.value as "H" | "M" | "L";
                            const w = computeMeasureWeight((measure as any).importance || "M", conf);
                            const insts = (measure.instances || []).map((i) => ({ ...i, weight: w }));
                            onUpdate({ ...measure, confidence: conf, instances: insts } as any);
                          }}
                        >
                          <option value="H">High</option>
                          <option value="M">Medium</option>
                          <option value="L">Low</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {isImpStyle ? (
                      <>
                        Measure weight: <span className="font-bold">{mWeightDisplay}</span> (L=1, M=3, H=5)
                      </>
                    ) : (
                      <>
                        Computed weight: <span className="font-bold">{mWeightDisplay}</span> (LL=1, LM=2, MM=3, MH=4, HH=5)
                      </>
                    )}
                  </div>
                </div>

                {/* Sub-dimension tag editor */}
                {allL2s && allL2s.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowTagEditor((v) => !v)}
                      className="text-[10px] font-semibold text-blue-700 flex items-center gap-1 hover:underline"
                    >
                      <Pencil className="w-3 h-3" />
                      {showTagEditor ? "Hide sub-dimensions" : "Edit sub-dimensions"}
                    </button>
                    {showTagEditor && (() => {
                      const currentIds = new Set(measure.subDimensionIds || []);
                      const isAllOutcomes = currentIds.size === 0;
                      const isCrossOutcome = !!(measure as any).crossOutcome;

                      const applyImplTagIds = (nextUniq: string[]) => {
                        const uniq = Array.from(new Set(nextUniq.filter(Boolean)));
                        if (uniq.length <= 1) {
                          onUpdate({ ...measure, subDimensionIds: uniq, crossOutcome: false } as any);
                          return;
                        }
                        const c = classifyImplementationMultiTagSelection(uniq);
                        if (c.kind === "parent_overall") {
                          setPendingImplTagIds(uniq);
                          setShowImplParentModal(true);
                        } else {
                          setPendingImplTagIds(uniq);
                          setShowImplFullModal(true);
                        }
                      };

                      const applyDesignTagIds = (nextUniq: string[]) => {
                        const uniq = Array.from(new Set(nextUniq.filter(Boolean)));
                        if (uniq.length <= 1) {
                          onUpdate({ ...measure, subDimensionIds: uniq, crossOutcome: false } as any);
                          return;
                        }
                        if (classifyDesignMultiTagSelection(uniq) === "overall_design") {
                          setShowDesignMultiModal(true);
                        }
                      };

                      const trySetSubDims = (newIds: string[]) => {
                        if (measureScoringMode === "implementation") {
                          applyImplTagIds(newIds);
                          return;
                        }
                        if (measureScoringMode === "design") {
                          applyDesignTagIds(newIds);
                          return;
                        }
                        if (newIds.length > 1) {
                          setPendingSubDimIds(newIds);
                          setShowCrossOutcomeModal(true);
                        } else {
                          onUpdate({ ...measure, subDimensionIds: newIds, crossOutcome: false } as any);
                        }
                      };

                      return (
                        <div className="space-y-2 max-h-52 overflow-y-auto pl-1">
                          {isCrossOutcome && (
                            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                              Dimension-level contribution — not scored at individual sub-dimension level.
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => { if (!isAllOutcomes) onUpdate({ ...measure, subDimensionIds: [], crossOutcome: false } as any); }}
                            className={cn(
                              "text-[11px] px-3 py-1 rounded border font-bold uppercase tracking-wide transition-colors w-full text-left",
                              isAllOutcomes ? "bg-indigo-100 border-indigo-400 text-indigo-800" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400",
                            )}
                          >
                            {overallTagLabel}
                          </button>
                          {tagTree.map((l1) => {
                            if (l1.children.length === 0) {
                              const isOn = currentIds.has(l1.id);
                              return (
                                <div key={l1.id} className="space-y-1">
                                  <button
                                    type="button"
                                    title={l1.label}
                                    onClick={() => {
                                      if (measureScoringMode === "implementation") {
                                        applyImplTagIds(isOn ? [] : [l1.id]);
                                      } else if (measureScoringMode === "design") {
                                        applyDesignTagIds(isOn ? [] : [l1.id]);
                                      } else if (!isAllOutcomes) {
                                        trySetSubDims(isOn ? [] : [l1.id]);
                                      }
                                    }}
                                    className={cn(
                                      "text-[10px] px-2 py-1 rounded-full border transition-colors max-w-full truncate",
                                      isOn ? "bg-blue-100 border-blue-300 text-blue-800 font-semibold" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                                    )}
                                  >
                                    {l1.label.length > 42 ? `${l1.label.slice(0, 40)}…` : l1.label}
                                  </button>
                                </div>
                              );
                            }
                            const childIds = l1.children.map((c) => c.id);
                            const allOn = childIds.length > 0 && childIds.every((id) => currentIds.has(id));
                            return (
                              <div
                                key={l1.id}
                                className={cn(
                                  measureScoringMode === "implementation" && "rounded-lg border border-gray-100 bg-gray-50/50 p-2 space-y-2",
                                  measureScoringMode !== "implementation" && "space-y-1",
                                )}
                              >
                                {measureScoringMode !== "implementation" && (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-semibold text-gray-600 truncate" title={l1.label}>{l1.label}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isAllOutcomes) return;
                                        const ids = new Set(measure.subDimensionIds || []);
                                        if (allOn) { for (const id of childIds) ids.delete(id); } else { for (const id of childIds) ids.add(id); }
                                        trySetSubDims(Array.from(ids));
                                      }}
                                      className={cn(
                                        "text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wide transition-colors shrink-0",
                                        allOn ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400",
                                      )}
                                    >
                                      All {l1.label.length > 20 ? `${l1.label.slice(0, 18)}…` : l1.label}
                                    </button>
                                  </div>
                                )}
                                {measureScoringMode === "implementation" && (
                                  <>
                                    <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Whole sub-dimension</div>
                                    <button
                                      type="button"
                                      title={l1.label}
                                      onClick={() => {
                                        const base = new Set(measure.subDimensionIds || []);
                                        if (currentIds.has(l1.id)) base.delete(l1.id);
                                        else base.add(l1.id);
                                        applyImplTagIds(Array.from(base));
                                      }}
                                      className={cn(
                                        "text-[10px] px-2.5 py-1.5 rounded-md border text-left w-full transition-colors max-w-full truncate font-medium",
                                        currentIds.has(l1.id)
                                          ? "bg-blue-100 border-blue-300 text-blue-900"
                                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300",
                                      )}
                                    >
                                      {l1.label.length > 56 ? `${l1.label.slice(0, 54)}…` : l1.label}
                                    </button>
                                    <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400 pt-1 border-t border-gray-200/80">
                                      Sub-components
                                    </div>
                                  </>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                  {l1.children.map((l2) => {
                                    const isOn = currentIds.has(l2.id);
                                    return (
                                      <button
                                        key={l2.id}
                                        type="button"
                                        title={l2.label}
                                        onClick={() => {
                                          if (measureScoringMode === "implementation") {
                                            const base = new Set(measure.subDimensionIds || []);
                                            if (currentIds.has(l2.id)) base.delete(l2.id);
                                            else base.add(l2.id);
                                            applyImplTagIds(Array.from(base));
                                            return;
                                          }
                                          if (allOn || isAllOutcomes) return;
                                          const ids = new Set(measure.subDimensionIds || []);
                                          if (ids.has(l2.id)) ids.delete(l2.id); else ids.add(l2.id);
                                          trySetSubDims(Array.from(ids));
                                        }}
                                        className={cn(
                                          "text-[10px] px-2 py-1 rounded-full border transition-colors max-w-[220px] truncate",
                                          allOn ? "bg-blue-50 border-blue-200 text-blue-400 opacity-60 cursor-not-allowed" : isOn ? "bg-blue-100 border-blue-300 text-blue-800 font-semibold" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                                        )}
                                      >
                                        {l2.label.length > 42 ? `${l2.label.slice(0, 40)}…` : l2.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={onDelete}
                    className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete measure
                  </button>
                </div>
              </div>
            )}

            <Separator />

            {/* ── Instances (always visible in view and edit mode) ── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-500 font-semibold">Instances</Label>
                </div>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={addInstance}>
                  <Plus className="w-3.5 h-3.5" /> Add instance
                </Button>
              </div>
              {(measure.instances || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic">No instances yet. Click "Add instance" to get started.</p>
              ) : (
                <div className="space-y-2">
                  {(measure.instances || []).map((inst) => {
                    const instKey = String(inst?.id || "");
                    const actorValue = normActor(inst?.actor);
                    const isAdding = !!addingByInstId[instKey];
                    const isRetired = !!(inst as any).retired;
                    const isOutsidePeriod = !isRetired && periodEnd !== null && String(inst.asOfDate || "") > periodEnd;
                    return (
                      <div key={instKey} className={cn(
                        "rounded-lg p-2.5 space-y-2 border",
                        isRetired ? "bg-gray-50 border-gray-200 opacity-40" : "bg-gray-50 border-gray-200"
                      )}>
                        {isRetired && (
                          <div className="flex items-center gap-1 -mb-1">
                            <Archive className="w-3 h-3 text-gray-400" />
                            <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">Retired — excluded from scoring</span>
                          </div>
                        )}
                        {isOutsidePeriod && (
                          <div className="-mb-1">
                            <span className="text-[9px] text-gray-400 italic">Outside selected period — not counted</span>
                          </div>
                        )}
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
                                const label = actorOptions.find((a) => a.key === v)?.label || v;
                                updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, actor: label } : x)));
                              }}
                            >
                              <option value={UNKNOWN_ACTOR_KEY}>(none)</option>
                              {actorOptions.map((a) => (
                                <option key={a.key} value={a.key}>{a.label}</option>
                              ))}
                              <option value={ADD_NEW_KEY}>+ Add new actor</option>
                            </select>
                            {isAdding && (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={draftByInstId[instKey] || ""}
                                  onChange={(e) => setDraftByInstId((prev) => ({ ...prev, [instKey]: e.target.value }))}
                                  placeholder="New actor name"
                                  className="h-8 text-xs w-28"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const name = (draftByInstId[instKey] || "").trim();
                                      if (name) {
                                        onAddActor?.(name);
                                        updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, actor: name } : x)));
                                        setDraftByInstId((prev) => ({ ...prev, [instKey]: "" }));
                                        setAddingByInstId((prev) => ({ ...prev, [instKey]: false }));
                                      }
                                    }
                                  }}
                                />
                                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
                                  const name = (draftByInstId[instKey] || "").trim();
                                  if (name) {
                                    onAddActor?.(name);
                                    updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, actor: name } : x)));
                                  }
                                  setDraftByInstId((prev) => ({ ...prev, [instKey]: "" }));
                                  setAddingByInstId((prev) => ({ ...prev, [instKey]: false }));
                                }}>
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
                                  setAddingByInstId((prev) => ({ ...prev, [instKey]: false }));
                                  setDraftByInstId((prev) => ({ ...prev, [instKey]: "" }));
                                }}>
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-600">Date</span>
                            <Input
                              type="date"
                              className="h-8 text-xs w-36"
                              value={String(inst.asOfDate || "")}
                              min={minDate}
                              onChange={(e) => updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, asOfDate: e.target.value } : x)))}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-600">Score</span>
                            <select
                              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                              value={inst.score !== null ? String(inst.score) : ""}
                              onChange={(e) => {
                                const val = e.currentTarget.value;
                                const sc = val ? Number(val) : null;
                                updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, score: sc } : x)));
                              }}
                            >
                              <option value="">—</option>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-600">Imp.</span>
                            <select
                              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                              value={(inst as any).importance || "M"}
                              onChange={(e) => updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, importance: e.target.value as "H" | "M" | "L" } : x)))}
                            >
                              <option value="L">L</option>
                              <option value="M">M</option>
                              <option value="H">H</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-600">Conf.</span>
                            <select
                              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                              value={(inst as any).confidence || "M"}
                              onChange={(e) => updateInstances((measure.instances || []).map((x) => (x.id === inst.id ? { ...x, confidence: e.target.value as "H" | "M" | "L" } : x)))}
                            >
                              <option value="L">L</option>
                              <option value="M">M</option>
                              <option value="H">H</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1 ml-auto">
                            {isRetired ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-gray-400 hover:text-blue-600 text-[10px] gap-1"
                                title="Un-retire this instance"
                                onClick={() => updateInstances((measure.instances || []).map((x) => x.id === inst.id ? { ...x, retired: false } : x))}
                              >
                                <Archive className="w-3.5 h-3.5" /> Un-retire
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-gray-400 hover:text-amber-600 text-[10px] gap-1"
                                title="Retire this instance"
                                onClick={() => setShowRetireConfirm(inst.id)}
                              >
                                <Archive className="w-3.5 h-3.5" /> Retire
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 px-2 text-gray-400 hover:text-red-600"
                              onClick={() => updateInstances((measure.instances || []).filter((x) => x.id !== inst.id))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={String((inst as any).rationale || "")}
                          onChange={(e) => updateInstances((measure.instances || []).map((x) => x.id === inst.id ? { ...x, rationale: e.currentTarget.value } : x))}
                          placeholder="Rationale..."
                          className="text-xs min-h-[32px] bg-white"
                          rows={1}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}


// ─── AddMeasureSheet (inline panel) ────────────────────────────────────

export function AddMeasurePanel({
  onAdd,
  onCancel,
  l2Options,
  defaultL2Ids,
  measureType: initialMeasureType = "measure",
  panelVariant = "outcome",
  restrictToTopId,
}: {
  onAdd: (m: OutcomeMeasure) => void;
  onCancel: () => void;
  l2Options: OutcomeSubDimL1[];
  defaultL2Ids?: string[];
  measureType?: "measure" | "perception";
  panelVariant?: "outcome" | "implementation" | "design";
  /** When set (nested implementation page), only this top’s group is shown. */
  restrictToTopId?: string;
}) {
  const isImpl = panelVariant === "implementation";
  const isDesign = panelVariant === "design";
  const isImpStyle = isImpl || isDesign;
  const displayL2Options = useMemo(() => {
    if (!restrictToTopId) return l2Options;
    const t = l2Options.find((x) => x.id === restrictToTopId);
    return t ? [t] : l2Options;
  }, [l2Options, restrictToTopId]);

  const [measureType, setMeasureType] = useState<"measure" | "perception">(initialMeasureType);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState<"H" | "M" | "L">("M");
  const [confidence, setConfidence] = useState<"H" | "M" | "L">("M");
  const [selectedL2s, setSelectedL2s] = useState<Set<string>>(new Set(defaultL2Ids || []));
  const [allOutcomes, setAllOutcomes] = useState(!defaultL2Ids || defaultL2Ids.length === 0);
  const [showCrossOutcomeModal, setShowCrossOutcomeModal] = useState(false);
  // The candidate set to apply if user confirms the cross-outcome modal
  const [pendingL2Ids, setPendingL2Ids] = useState<Set<string> | null>(null);
  // Once the user has acknowledged cross-outcome for this add flow, don't re-prompt
  const [crossOutcomeAcknowledged, setCrossOutcomeAcknowledged] = useState(false);
  const [showImplParentModal, setShowImplParentModal] = useState(false);
  const [showImplFullModal, setShowImplFullModal] = useState(false);
  const [pendingImplSelection, setPendingImplSelection] = useState<Set<string> | null>(null);
  const [showDesignMultiModal, setShowDesignMultiModal] = useState(false);

  const toggleAllOutcomes = () => {
    setAllOutcomes((prev) => {
      if (!prev) {
        setSelectedL2s(new Set());
        setCrossOutcomeAcknowledged(false);
      }
      return !prev;
    });
  };

  const toggle = (id: string) => {
    if (allOutcomes) return;
    if (isDesign) {
      const next = new Set(selectedL2s);
      if (next.has(id)) {
        next.delete(id);
        setSelectedL2s(next);
        return;
      }
      next.add(id);
      if (next.size <= 1) {
        setSelectedL2s(next);
        return;
      }
      setShowDesignMultiModal(true);
      return;
    }
    if (isImpl) {
      const next = new Set(selectedL2s);
      if (next.has(id)) {
        next.delete(id);
        setSelectedL2s(next);
        return;
      }
      next.add(id);
      if (next.size <= 1) {
        setSelectedL2s(next);
        return;
      }
      const c = classifyImplementationMultiTagSelection(Array.from(next));
      if (c.kind === "parent_overall") {
        setPendingImplSelection(next);
        setShowImplParentModal(true);
 return;
      }
      setPendingImplSelection(next);
      setShowImplFullModal(true);
      return;
    }
    const next = new Set(selectedL2s);
    if (next.has(id)) {
      // Deselecting — always allowed
      next.delete(id);
      setSelectedL2s(next);
      if (next.size <= 1) setCrossOutcomeAcknowledged(false);
    } else {
      // Selecting — show modal if this would be the 2nd+ selection
      next.add(id);
      if (next.size > 1 && !crossOutcomeAcknowledged) {
        setPendingL2Ids(next);
        setShowCrossOutcomeModal(true);
      } else {
        setSelectedL2s(next);
      }
    }
  };

  const toggleAll = (l1: OutcomeSubDimL1) => {
    if (allOutcomes || isImpl || isDesign) return;
    const childIds = l1.children.map((c) => c.id);
    const allSelected = childIds.every((id) => selectedL2s.has(id));
    const next = new Set(selectedL2s);
    if (allSelected) {
      for (const id of childIds) next.delete(id);
      setSelectedL2s(next);
      if (next.size <= 1) setCrossOutcomeAcknowledged(false);
    } else {
      for (const id of childIds) next.add(id);
      if (next.size > 1 && !crossOutcomeAcknowledged) {
        setPendingL2Ids(next);
        setShowCrossOutcomeModal(true);
      } else {
        setSelectedL2s(next);
      }
    }
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const m = createOutcomeMeasure(name.trim(), measureType);
    m.description = description;
    (m as any).importance = importance;
    m.confidence = confidence;
    if (isDesign) {
      if (allOutcomes) {
        m.subDimensionIds = [];
      } else {
        const arr = Array.from(selectedL2s);
        if (arr.length === 0) m.subDimensionIds = [];
        else if (classifyDesignMultiTagSelection(arr) === "overall_design") m.subDimensionIds = [];
        else m.subDimensionIds = arr;
      }
      (m as any).crossOutcome = false;
      onAdd(m);
      return;
    }
    if (isImpl) {
      if (allOutcomes) {
        m.subDimensionIds = [];
      } else {
        const arr = Array.from(selectedL2s);
        if (arr.length === 0) m.subDimensionIds = [];
        else {
          const c = classifyImplementationMultiTagSelection(arr);
          if (c.kind === "full_implementation") m.subDimensionIds = [];
          else if (c.kind === "parent_overall") m.subDimensionIds = [c.parentId];
          else m.subDimensionIds = arr;
        }
      }
      (m as any).crossOutcome = false;
      onAdd(m);
      return;
    }
    const subDimIds = allOutcomes ? [] : Array.from(selectedL2s);
    m.subDimensionIds = subDimIds;
    (m as any).crossOutcome = subDimIds.length > 1;
    onAdd(m);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900">Add Measure</h4>
      <div>
        <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5 block">Type</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMeasureType("measure")}
            className={cn(
              "px-3 py-1.5 rounded border text-xs font-medium transition-colors",
              measureType === "measure"
                ? "bg-gray-100 border-gray-300 text-gray-800"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
            )}
          >
            Framework-based
          </button>
          <button
            type="button"
            onClick={() => setMeasureType("perception")}
            className={cn(
              "px-3 py-1.5 rounded border text-xs font-medium transition-colors",
              measureType === "perception"
                ? "bg-purple-50 border-purple-300 text-purple-800"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
            )}
          >
            Perception Score
          </button>
        </div>
        {measureType === "perception" && (
          <p className="text-[10px] text-gray-500 mt-1">Survey or stakeholder feedback data</p>
        )}
      </div>
      <div>
        <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Measure name..." className="h-8 text-sm" autoFocus />
      </div>
      <div>
        <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.currentTarget.value)} placeholder="Brief description..." className="text-xs min-h-[40px]" />
      </div>
      <div className={cn("grid gap-2", isImpStyle ? "grid-cols-1" : "grid-cols-2")}>
        <div>
          <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Importance</Label>
          <select className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold" value={importance} onChange={(e) => setImportance(e.target.value as any)}>
            <option value="H">High</option>
            <option value="M">Medium</option>
            <option value="L">Low</option>
          </select>
        </div>
        {!isImpStyle && (
          <div>
            <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Confidence</Label>
            <select className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold" value={confidence} onChange={(e) => setConfidence(e.target.value as any)}>
              <option value="H">High</option>
              <option value="M">Medium</option>
              <option value="L">Low</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1.5 block">
          {isDesign ? "Design sub-dimensions" : isImpl ? "Implementation sub-dimensions" : "Sub-dimensions"}
        </Label>
        <div className="space-y-3 max-h-52 overflow-y-auto border border-gray-200 rounded-lg p-2">
          <button
            type="button"
            onClick={toggleAllOutcomes}
            className={cn(
              "text-[11px] px-3 py-1 rounded border font-bold uppercase tracking-wide transition-colors w-full text-left",
              allOutcomes
                ? "bg-indigo-100 border-indigo-400 text-indigo-800"
                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400",
            )}
          >
            {isImpStyle ? "Overall (untagged)" : "All Outcomes"}
          </button>
          {displayL2Options.map((l1) => {
            if (l1.children.length === 0) {
              const isOn = selectedL2s.has(l1.id);
              return (
                <div key={l1.id} className={cn(allOutcomes && "opacity-50 pointer-events-none")}>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      title={l1.label}
                      onClick={() => toggle(l1.id)}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded-full border transition-colors max-w-full truncate",
                        isOn ? "bg-blue-100 border-blue-300 text-blue-800 font-semibold" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300",
                      )}
                    >
                      {l1.label.length > 42 ? `${l1.label.slice(0, 40)}…` : l1.label}
                    </button>
                  </div>
                </div>
              );
            }
            const childIds = l1.children.map((c) => c.id);
            const allSelected = !isImpl && childIds.length > 0 && childIds.every((id) => selectedL2s.has(id));
            return (
              <div
                key={l1.id}
                className={cn(
                  "rounded-lg border border-gray-100 bg-gray-50/50 p-2 space-y-2",
                  allOutcomes && "opacity-50 pointer-events-none",
                )}
              >
                {!isImpl && (
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => toggleAll(l1)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wide transition-colors",
                        allSelected
                          ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-400",
                      )}
                    >
                      All {l1.label}
                    </button>
                  </div>
                )}
                {isImpl && (
                  <>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Whole sub-dimension</div>
                    <button
                      type="button"
                      title={l1.label}
                      onClick={() => toggle(l1.id)}
                      className={cn(
                        "text-[10px] px-2.5 py-1.5 rounded-md border text-left w-full transition-colors max-w-full truncate font-medium",
                        selectedL2s.has(l1.id)
                          ? "bg-blue-100 border-blue-300 text-blue-900"
                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300",
                      )}
                    >
                      {l1.label.length > 56 ? `${l1.label.slice(0, 54)}…` : l1.label}
                    </button>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400 pt-1 border-t border-gray-200/80">
                      Sub-components
                    </div>
                  </>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {l1.children.map((l2) => (
                    <button
                      key={l2.id}
                      type="button"
                      title={l2.label}
                      onClick={() => { if (!allSelected) toggle(l2.id); }}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded-full border transition-colors max-w-[220px] truncate",
                        allSelected
                          ? "bg-blue-50 border-blue-200 text-blue-400 opacity-60 cursor-not-allowed"
                          : selectedL2s.has(l2.id)
                            ? "bg-blue-100 border-blue-300 text-blue-800 font-semibold"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300",
                      )}
                    >
                      {l2.label.length > 42 ? `${l2.label.slice(0, 40)}…` : l2.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={handleAdd} disabled={!name.trim()}>
          <Plus className="w-3.5 h-3.5" /> {measureType === "perception" ? "Add Perception Score" : "Add Measure"}
        </Button>
      </div>

      {/* Cross-outcome modal for add panel */}
      <Dialog open={showCrossOutcomeModal} onOpenChange={(open) => { if (!open) { setShowCrossOutcomeModal(false); setPendingL2Ids(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Multiple sub-dimensions selected</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Selecting more than one sub-dimension means this measure will contribute to the overall dimension score, not to individual sub-dimension ratings.
              <br /><br />
              To affect individual sub-dimensions, add a separate measure for each one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { setShowCrossOutcomeModal(false); setPendingL2Ids(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                if (pendingL2Ids) setSelectedL2s(pendingL2Ids);
                setCrossOutcomeAcknowledged(true);
                setPendingL2Ids(null);
                setShowCrossOutcomeModal(false);
              }}
            >
              Confirm — dimension-level contribution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showImplParentModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowImplParentModal(false);
            setPendingImplSelection(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Overall measure for this sub-dimension</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {pendingImplSelection && (() => {
                const c = classifyImplementationMultiTagSelection(Array.from(pendingImplSelection));
                if (c.kind !== "parent_overall") return null;
                return (
                  <>
                    This measure will contribute to the score for{" "}
                    <span className="font-semibold text-gray-800">{c.parentLabel}</span> as a whole, not to individual sub-components.
                    <br /><br />
                    Add separate measures if you need scores for each component.
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { setShowImplParentModal(false); setPendingImplSelection(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                if (pendingImplSelection) {
                  const c = classifyImplementationMultiTagSelection(Array.from(pendingImplSelection));
                  if (c.kind === "parent_overall") setSelectedL2s(new Set([c.parentId]));
                }
                setPendingImplSelection(null);
                setShowImplParentModal(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showImplFullModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowImplFullModal(false);
            setPendingImplSelection(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Overall implementation measure</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              You selected tags from more than one implementation sub-dimension. This measure will contribute to the{" "}
              <span className="font-semibold text-gray-800">overall implementation score</span> only, not to individual sub-dimensions.
              <br /><br />
              Add separate measures if you need scores for specific sub-dimensions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { setShowImplFullModal(false); setPendingImplSelection(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setAllOutcomes(true);
                setSelectedL2s(new Set());
                setPendingImplSelection(null);
                setShowImplFullModal(false);
              }}
            >
              Confirm — overall implementation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDesignMultiModal}
        onOpenChange={(open) => {
          if (!open) setShowDesignMultiModal(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Overall design score</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              You selected more than one design sub-dimension. This measure will contribute to the{" "}
              <span className="font-semibold text-gray-800">overall design score</span> only (untagged), not to individual sub-dimensions.
              <br /><br />
              Add separate measures if you need scores for specific sub-dimensions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setShowDesignMultiModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setAllOutcomes(true);
                setSelectedL2s(new Set());
                setShowDesignMultiModal(false);
              }}
            >
              Confirm — overall design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── L2 Page ───────────────────────────────────────────────────────────

function L2SubDimensionPage({
  l1,
  subdimensionTree,
  parentScoreTitle,
  measures,
  overallMeasures,
  subDimensionWeights,
  filter,
  actors,
  onAddActor,
  onUpdateMeasure,
  onDeleteMeasure,
  onAddMeasure,
  onWeightChange,
  onBack,
}: {
  l1: OutcomeSubDimL1;
  subdimensionTree: OutcomeSubDimL1[];
  parentScoreTitle: string;
  measures: OutcomeMeasure[];
  overallMeasures: OutcomeMeasure[];
  subDimensionWeights: Record<string, "H" | "M" | "L">;
  filter: ScoreFilter;
  actors: string[];
  onAddActor: (label: string) => void;
  onUpdateMeasure: (m: OutcomeMeasure) => void;
  onDeleteMeasure: (id: string) => void;
  onAddMeasure: (m: OutcomeMeasure) => void;
  onWeightChange: (id: string, w: "H" | "M" | "L") => void;
  onBack: () => void;
}) {
  const [filterL2Id, setFilterL2Id] = useState<string | null>(null);
  const [addPanelType, setAddPanelType] = useState<"measure" | "perception" | null>(null);

  const l1Score = useMemo(() => calcL1Score(l1, measures, overallMeasures, subDimensionWeights, filter), [l1, measures, overallMeasures, subDimensionWeights, filter]);

  const l2Rows = useMemo(() => {
    return l1.children.map((l2) => {
      const tagged = measures.filter((m) => !(m as any).crossOutcome && (m.subDimensionIds || []).includes(l2.id));
      return {
        ...l2,
        score: calcL2Score(l2.id, measures, filter),
        delta: l2Delta(l2.id, measures, filter),
        measureCount: tagged.length,
        weight: subDimensionWeights[l2.id] || "M",
        flagItems: collectInstanceFlagItems(tagged, filter),
      };
    });
  }, [l1.children, measures, filter, subDimensionWeights]);

  const measuresForL1 = useMemo(() => {
    const l2Ids = new Set(l1.children.map((c) => c.id));
    return measures.filter((m) => !(m as any).crossOutcome && (m.subDimensionIds || []).some((id) => l2Ids.has(id)));
  }, [l1.children, measures]);

  const l1FlagItems = useMemo(() => collectInstanceFlagItems(measuresForL1, filter), [measuresForL1, filter]);
  const l1FlagStatus = getFlagStatus(l1FlagItems, l1Score);

  const visibleMeasures = useMemo(() => {
    if (!filterL2Id) return measuresForL1;
    return measuresForL1.filter((m) => (m.subDimensionIds || []).includes(filterL2Id));
  }, [measuresForL1, filterL2Id]);

  const allL2s = useMemo(() => buildAllL2OptionsFromTree(subdimensionTree), [subdimensionTree]);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to {parentScoreTitle}
      </button>

      {/* Score dashboard – matches L1 page layout */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-lg font-serif font-bold text-gray-900">{l1.label}</h2>
              <p className="text-xs text-gray-500">Sub-dimension detail</p>
            </div>
            <div
              className={cn("inline-block rounded-xl p-0.5", {
                "ring-2 ring-red-400": l1FlagStatus === "concern",
                "ring-2 ring-emerald-400": l1FlagStatus === "excellence",
              })}
              style={l1FlagStatus === "both" ? {
                padding: "3px",
                borderRadius: "0.75rem",
                background: "repeating-linear-gradient(135deg, #ef4444 0px, #ef4444 6px, #10b981 6px, #10b981 12px)",
              } : {}}
            >
              <div className={l1FlagStatus === "both" ? "rounded-[9px] overflow-hidden" : ""}>
                <ScoreChip score={l1Score} size="lg" />
              </div>
            </div>
          </div>

          {/* L2 tiles – clickable as filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {l2Rows.map((row) => (
              <SubDimTile
                key={row.id}
                label={row.label}
                score={row.score}
                weight={row.weight}
                measureCount={row.measureCount}
                delta={row.delta}
                onClick={() => setFilterL2Id((prev) => prev === row.id ? null : row.id)}
                onWeightChange={(w) => onWeightChange(row.id, w)}
                active={filterL2Id === row.id}
                flagStatus={getFlagStatus(row.flagItems, l1Score)}
              />
            ))}
          </div>

          {filterL2Id && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">Filtering by</span>
              <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
                {l2Rows.find((r) => r.id === filterL2Id)?.label || filterL2Id}
              </Badge>
              <button className="text-[10px] text-gray-400 hover:text-gray-700 underline" onClick={() => setFilterL2Id(null)}>
                Clear
              </button>
            </div>
          )}

          {/* Flags – individual instance scores vs overall */}
          <ScoreFlags
            overallScore={l1Score}
            items={collectInstanceFlagItems(filterL2Id ? visibleMeasures : measuresForL1, filter)}
            threshold={1}
            defaultOpen={false}
            testId="outcome-l2-flags"
          />
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{measuresForL1.length} total measures</span>
          <span className="text-[10px] text-gray-400">Weight: LL=1, LM=2, MM=3, MH=4, HH=5</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Measures ({visibleMeasures.length})</h3>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Measure
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setAddPanelType("measure")}>From Scratch</DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400">Pull from a Component <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {addPanelType !== null && (
          <AddMeasurePanel
            l2Options={subdimensionTree}
            defaultL2Ids={[filterL2Id || l1.children[0]?.id].filter(Boolean)}
            measureType={addPanelType}
            onAdd={(m) => { onAddMeasure(m); setAddPanelType(null); }}
            onCancel={() => setAddPanelType(null)}
          />
        )}
        {visibleMeasures.length === 0 && addPanelType === null ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
            <AlertCircle className="w-3.5 h-3.5" /> {filterL2Id ? "No measures tagged to this sub-dimension." : "No measures yet. Add a measure to start scoring."}
          </div>
        ) : (
          visibleMeasures.map((m) => (
            <OutcomeMeasureCard
              key={m.id}
              measure={m}
              onUpdate={onUpdateMeasure}
              onDelete={() => onDeleteMeasure(m.id)}
              actors={actors}
              onAddActor={onAddActor}
              filter={filter}
              allL2s={allL2s}
              subDimensionWeights={subDimensionWeights}
              dimensionTagTree={subdimensionTree}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main OutcomeScoreView (L1 Page) ──────────────────────────────────

interface OutcomeScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
  /** Which healthData outcome bucket and subdimension tree to use. */
  variant?: OutcomeScoreVariant;
}

export default function OutcomeScoreView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
  variant = "learningAdvancement",
}: OutcomeScoreViewProps) {
  const outCfg = OUTCOME_VARIANT_CONFIG[variant];
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compRef = useRef(comp);
  compRef.current = comp;

  const [actors, setActors] = useState<string[]>([]);
  const { actors: globalActors, addActor: addGlobalActor, mergeActors: mergeGlobalActors } = useGlobalActors();
  const [localFilter, setLocalFilter] = useState<ScoreFilter>({
    mode: "year",
    yearKey: listSelectableYearKeys(new Date(), 5)[0],
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

  const [measures, setMeasures] = useState<OutcomeMeasure[]>([]);
  const [overallMeasures, setOverallMeasures] = useState<OutcomeMeasure[]>([]);
  const [subDimensionWeights, setSubDimensionWeights] = useState<Record<string, "H" | "M" | "L">>({});
  const [initialized, setInitialized] = useState(false);
  const [selectedL1Id, setSelectedL1Id] = useState<string | null>(null);
  const [addOverallType, setAddOverallType] = useState<"measure" | "perception" | null>(null);
  const [addSubdimType, setAddSubdimType] = useState<"measure" | "perception" | null>(null);
  const [filterL1Id, setFilterL1Id] = useState<string | null>(null);

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
        if (key === UNKNOWN_ACTOR_KEY || seen.has(key)) return list;
        return [...list, clean];
      });
    },
    [addGlobalActor],
  );

  // Hydrate from stored data
  useEffect(() => {
    if (comp && !initialized) {
      const hd: any = comp.healthData || {};
      const osd: Partial<OutcomeScoreData> = hd[outCfg.healthDataKey] || {};
      setActors(Array.isArray(osd.actors) ? (osd.actors as string[]) : []);
      const saved: any = osd.filter || {};
      setFilter(
        saved?.mode
          ? (saved as any)
          : ({ mode: "year", yearKey: listSelectableYearKeys(new Date(), 5)[0] } as any),
      );
      const validL2 = new Set(allL2IdsFromTree(outCfg.tree));
      const rawMeasures = Array.isArray(osd.measures) ? (osd.measures as OutcomeMeasure[]) : [];
      setMeasures(rawMeasures.filter((m) => {
        const ids = m.subDimensionIds || [];
        return ids.length === 0 || ids.some((id) => validL2.has(id));
      }));
      setOverallMeasures(Array.isArray(osd.overallMeasures) ? (osd.overallMeasures as OutcomeMeasure[]) : []);
      setSubDimensionWeights(osd.subDimensionWeights && typeof osd.subDimensionWeights === "object" ? (osd.subDimensionWeights as any) : {});
      setInitialized(true);
    }
  }, [comp, initialized, setFilter, outCfg.healthDataKey, outCfg.tree]);

  // Compute final score using instance date-based filtering
  const finalScore = useMemo(
    () => calcOverallOutcomeScore(measures, overallMeasures, subDimensionWeights, filter, outCfg.tree),
    [measures, overallMeasures, subDimensionWeights, filter, outCfg.tree],
  );

  // Autosave
  const doSave = useCallback(() => {
    const nid = nodeId;
    if (!nid) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const existing: any = compRef.current?.healthData || {};
      const existingOsd: any = existing[outCfg.healthDataKey] || {};
      updateMutation.mutate({
        nodeId: nid,
        data: {
          healthData: {
            ...existing,
            [outCfg.healthDataKey]: {
              ...existingOsd,
              actors,
              filter,
              measures,
              overallMeasures,
              subDimensionWeights,
              finalOutcomeScore: finalScore,
            },
          },
        },
      });
    }, 800);
  }, [nodeId, actors, filter, measures, overallMeasures, subDimensionWeights, finalScore, updateMutation, outCfg.healthDataKey]);

  useEffect(() => {
    if (initialized) doSave();
  }, [initialized, doSave]);

  // Actor options from all sources
  const actorOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (a: unknown) => {
      const clean = String(a ?? "").trim();
      if (!clean) return;
      const key = normActor(clean);
      if (!key || key === UNKNOWN_ACTOR_KEY || seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };
    for (const a of globalActors || []) add(a);
    for (const a of actors) add(a);
    const scanInsts = (insts: unknown) => { for (const i of Array.isArray(insts) ? insts : []) add((i as any)?.actor); };
    const scanMs = (ms: unknown) => { for (const m of Array.isArray(ms) ? ms : []) scanInsts((m as any)?.instances); };
    scanMs(measures);
    scanMs(overallMeasures);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [actors, globalActors, measures, overallMeasures]);

  const allL2s = useMemo(() => buildAllL2OptionsFromTree(outCfg.tree), [outCfg.tree]);

  // Measure CRUD
  const deleteMeasure = useCallback((id: string) => {
    setMeasures((prev) => prev.filter((x) => x.id !== id));
  }, []);
  const addMeasure = useCallback((m: OutcomeMeasure) => {
    setMeasures((prev) => [...prev, m]);
  }, []);

  const deleteOverallMeasure = useCallback((id: string) => {
    setOverallMeasures((prev) => prev.filter((x) => x.id !== id));
  }, []);
  const addOverallMeasure = useCallback((m: OutcomeMeasure) => {
    setOverallMeasures((prev) => [...prev, m]);
  }, []);

  /**
   * Unified update handler — routes a measure to the correct list based on
   * whether it should be "overall" (no subdimensions OR crossOutcome: true).
   * Moves the measure between lists if its routing has changed.
   */
  const handleMeasureUpdate = useCallback((m: OutcomeMeasure) => {
    const shouldBeOverall = !(m.subDimensionIds?.length) || !!(m as any).crossOutcome;
    if (shouldBeOverall) {
      setMeasures((prev) => prev.filter((x) => x.id !== m.id));
      setOverallMeasures((prev) =>
        prev.some((x) => x.id === m.id)
          ? prev.map((x) => (x.id === m.id ? m : x))
          : [...prev, m],
      );
    } else {
      setOverallMeasures((prev) => prev.filter((x) => x.id !== m.id));
      setMeasures((prev) =>
        prev.some((x) => x.id === m.id)
          ? prev.map((x) => (x.id === m.id ? m : x))
          : [...prev, m],
      );
    }
  }, []);

  const handleWeightChange = useCallback((id: string, w: "H" | "M" | "L") => {
    setSubDimensionWeights((prev) => ({ ...prev, [id]: w }));
  }, []);

  const filteredSubdimMeasures = useMemo(() => {
    // crossOutcome measures live under "Overall Outcome Dimension Measures", not here
    const subdimOnly = measures.filter((m) => !(m as any).crossOutcome);
    if (!filterL1Id) return subdimOnly;
    const l1 = getL1ByIdInTree(outCfg.tree, filterL1Id);
    if (!l1) return subdimOnly;
    const l2Ids = new Set(l1.children.map((c) => c.id));
    return subdimOnly.filter((m) => (m.subDimensionIds || []).some((id) => l2Ids.has(id)));
  }, [measures, filterL1Id, outCfg.tree]);

  // ── L2 Page ──
  if (selectedL1Id) {
    const l1 = getL1ByIdInTree(outCfg.tree, selectedL1Id);
    if (!l1) {
      setSelectedL1Id(null);
      return null;
    }
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
        <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="outcome-filter-bar" />
        <L2SubDimensionPage
          l1={l1}
          subdimensionTree={outCfg.tree}
          parentScoreTitle={outCfg.scoreTitle}
          measures={measures}
          overallMeasures={overallMeasures}
          subDimensionWeights={subDimensionWeights}
          filter={filter}
          actors={actorOptions}
          onAddActor={onAddActor}
          onUpdateMeasure={handleMeasureUpdate}
          onDeleteMeasure={deleteMeasure}
          onAddMeasure={addMeasure}
          onWeightChange={handleWeightChange}
          onBack={() => setSelectedL1Id(null)}
        />
      </div>
    );
  }

  // ── L1 Page ──
  const l1Rows = outCfg.tree.map((l1) => {
    const l2Ids = new Set(l1.children.map((c) => c.id));
    const tagged = measures.filter((m) => !(m as any).crossOutcome && (m.subDimensionIds || []).some((id) => l2Ids.has(id)));
    const flagItems = collectInstanceFlagItems(tagged, filter);
    return {
      ...l1,
      score: calcL1Score(l1, measures, overallMeasures, subDimensionWeights, filter),
      delta: l1Delta(l1, measures, overallMeasures, subDimensionWeights, filter),
      measureCount: tagged.length,
      flagItems,
    };
  });

  const allFlagItems = collectInstanceFlagItems([...measures, ...overallMeasures], filter);
  const overallFlagStatus = getFlagStatus(allFlagItems, finalScore);

  const totalMeasures = measures.length + overallMeasures.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group" data-testid="button-back-to-health">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status & Health
      </button>

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="outcome-filter-bar" />

      {/* Score dashboard */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="score-dashboard">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-gray-900">{outCfg.dashboardHeading}</h2>
              <p className="text-sm text-gray-500">{title}</p>
            </div>
            <div className="text-right space-y-1">
              <div
                className={cn("inline-block rounded-xl p-0.5", {
                  "ring-2 ring-red-400": overallFlagStatus === "concern",
                  "ring-2 ring-emerald-400": overallFlagStatus === "excellence",
                })}
                style={overallFlagStatus === "both" ? {
                  padding: "3px",
                  borderRadius: "0.75rem",
                  background: "repeating-linear-gradient(135deg, #ef4444 0px, #ef4444 6px, #10b981 6px, #10b981 12px)",
                } : {}}
              >
                <div className={overallFlagStatus === "both" ? "rounded-[9px] overflow-hidden" : ""}>
                  <ScoreChip score={finalScore} size="lg" />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{outCfg.scoreTitle}</p>
            </div>
          </div>

          {/* L1 sub-dimension tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {l1Rows.map((row) => (
              <SubDimTile
                key={row.id}
                label={row.label}
                score={row.score}
                measureCount={row.measureCount}
                delta={row.delta}
                active={filterL1Id === row.id}
                onClick={() => setFilterL1Id((prev) => prev === row.id ? null : row.id)}
                onNavigate={() => setSelectedL1Id(row.id)}
                flagStatus={getFlagStatus(row.flagItems, finalScore)}
              />
            ))}
          </div>

          {/* Flags – individual instance scores vs overall */}
          {(() => {
            const flagMeasures = filterL1Id
              ? measures.filter((m) =>
                  (m.subDimensionIds || []).some((id) =>
                    getL1ByIdInTree(outCfg.tree, filterL1Id)?.children.map((c) => c.id).includes(id)
                  )
                )
              : [...measures, ...overallMeasures];
            return (
              <ScoreFlags
                overallScore={finalScore}
                items={collectInstanceFlagItems(flagMeasures, filter)}
                threshold={1}
                defaultOpen={false}
                testId="outcome-l1-flags"
              />
            );
          })()}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{totalMeasures} total measures</span>
          <span className="text-[10px] text-gray-400">Weight: LL=1, LM=2, MM=3, MH=4, HH=5</span>
        </div>
      </div>

      {/* Overall Outcome Dimension Measures */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Overall Outcome Dimension Measures
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{overallMeasures.length} measure{overallMeasures.length !== 1 ? "s" : ""}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Measure
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setAddOverallType("measure")}>From Scratch</DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400">Pull from a Component <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {addOverallType !== null && (
          <AddMeasurePanel
            l2Options={outCfg.tree}
            measureType={addOverallType}
            onAdd={(m) => {
              const isOverall = !m.subDimensionIds || m.subDimensionIds.length === 0;
              if (isOverall) addOverallMeasure(m);
              else addMeasure(m);
              setAddOverallType(null);
            }}
            onCancel={() => setAddOverallType(null)}
          />
        )}

        {overallMeasures.length === 0 && addOverallType === null ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
            <AlertCircle className="w-3.5 h-3.5" />
            {filter.mode !== "none" ? "No overall measures for this period." : "Add overall measures to contribute to the Outcome dimension score alongside sub-dimension scores."}
          </div>
        ) : (
          overallMeasures.map((m) => (
            <OutcomeMeasureCard
              key={m.id}
              measure={m}
              onUpdate={handleMeasureUpdate}
              onDelete={() => deleteOverallMeasure(m.id)}
              actors={actorOptions}
              onAddActor={onAddActor}
              filter={filter}
              allL2s={allL2s}
              subDimensionWeights={subDimensionWeights}
              dimensionTagTree={outCfg.tree}
            />
          ))
        )}
      </div>

      {/* Subdimension Measures */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Subdimension Measures
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{filteredSubdimMeasures.length} measure{filteredSubdimMeasures.length !== 1 ? "s" : ""}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Measure
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setAddSubdimType("measure")}>From Scratch</DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400">Pull from a Component <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {addSubdimType !== null && (
          <AddMeasurePanel
            l2Options={outCfg.tree}
            measureType={addSubdimType}
            defaultL2Ids={filterL1Id ? getL1ByIdInTree(outCfg.tree, filterL1Id)?.children.map((c) => c.id) : undefined}
            onAdd={(m) => {
              const isOverall = !m.subDimensionIds || m.subDimensionIds.length === 0;
              if (isOverall) addOverallMeasure(m);
              else addMeasure(m);
              setAddSubdimType(null);
            }}
            onCancel={() => setAddSubdimType(null)}
          />
        )}

        {filterL1Id && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtering by</span>
            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
              {l1Rows.find((r) => r.id === filterL1Id)?.label || filterL1Id}
            </Badge>
            <button className="text-[10px] text-gray-400 hover:text-gray-700 underline" onClick={() => setFilterL1Id(null)}>
              Clear
            </button>
          </div>
        )}

        {filteredSubdimMeasures.length === 0 && addSubdimType === null ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
            <AlertCircle className="w-3.5 h-3.5" />
            {filterL1Id ? "No measures tagged to this dimension." : "No subdimension measures yet."}
          </div>
        ) : (
          filteredSubdimMeasures.map((m) => (
            <OutcomeMeasureCard
              key={m.id}
              measure={m}
              onUpdate={handleMeasureUpdate}
              onDelete={() => deleteMeasure(m.id)}
              actors={actorOptions}
              onAddActor={onAddActor}
              filter={filter}
              allL2s={allL2s}
              subDimensionWeights={subDimensionWeights}
              dimensionTagTree={outCfg.tree}
            />
          ))
        )}
      </div>
    </div>
  );
}
