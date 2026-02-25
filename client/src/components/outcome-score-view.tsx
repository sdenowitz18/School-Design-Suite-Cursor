import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  SkipForward,
  Target,
  BarChart3,
  AlertCircle,
  Sparkles,
  Upload,
  Ruler,
  Globe,
  UserCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
import OutcomeDetailView from "./outcome-detail-view";
import { effectiveFromInstances, UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import { listSelectableSemesterKeys, listSelectableYearKeys, minAsOfDate, toIsoDateString } from "@shared/marking-period";
import type { Measure, ScoreFilter, ScoreInstance, TargetedOutcome, OutcomeScoreData } from "@shared/schema";
import OutcomeScoreOverallInstancesView from "./outcome-score-overall-instances-view";
import ScoreFilterBar from "./score-filter-bar";
import { useGlobalActors } from "@/lib/actors-store";
import ScoreFlags from "./score-flags";
import { buildSubcomponentOutcomeIndex, normOutcomeKey } from "./outcomes-utils";

const PRIORITY_WEIGHT: Record<string, number> = { H: 6, M: 3, L: 1 };

function weightedAverage(items: { rating: number | null; priority: string; skipped: boolean }[]): number | null {
  let totalWeight = 0;
  let totalScore = 0;
  for (const item of items) {
    if (!item.skipped && item.rating !== null) {
      const w = PRIORITY_WEIGHT[item.priority] || 1;
      totalWeight += w;
      totalScore += item.rating * w;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round((totalScore / totalWeight) * 100) / 100;
}

function effectiveMeasureRating(measure: Measure, filter: ScoreFilter): number | null {
  const insts: ScoreInstance[] = Array.isArray((measure as any)?.instances) ? ((measure as any).instances as ScoreInstance[]) : [];
  if (insts.length === 0) return null;
  return effectiveFromInstances(insts, filter).score;
}

function calcOutcomeScore(measures: Measure[], filter: ScoreFilter): number | null {
  const items = measures.map((m) => ({
    rating: effectiveMeasureRating(m, filter),
    priority: (m as any)?.priority || "M",
    skipped: !!(m as any)?.skipped,
  }));
  return weightedAverage(items);
}

function calcComponentScore(outcomes: TargetedOutcome[]): number | null {
  const scored = outcomes
    .filter(o => !o.skipped && o.calculatedScore !== null)
    .map(o => ({ rating: o.calculatedScore, priority: o.priority, skipped: false }));
  return weightedAverage(scored);
}

function roundFinal1to5(score: number | null): number | null {
  if (score === null) return null;
  const rounded = Math.round(score);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const LEADER_PERCEPTION_MEASURE_NAME = "Leader perception of achievement";

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

function createOutcome(name: string = ""): TargetedOutcome {
  return {
    id: generateId(),
    outcomeId: generateId(),
    outcomeName: name,
    priority: "M",
    rigorPath: "thin",
    instances: [],
    measures: [],
    calculatedScore: null,
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

function PriorityPicker({ value, onChange, disabled }: { value: string; onChange: (v: "H" | "M" | "L") => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1" data-testid="priority-picker">
      {(["H", "M", "L"] as const).map(p => (
        <button
          key={p}
          onClick={() => !disabled && onChange(p)}
          disabled={disabled}
          className={cn(
            "w-7 h-7 rounded text-xs font-bold transition-all",
            value === p
              ? p === "H" ? "bg-red-500 text-white shadow-sm" :
                p === "M" ? "bg-yellow-500 text-white shadow-sm" :
                "bg-blue-400 text-white shadow-sm"
              : "bg-gray-100 text-gray-400 hover:bg-gray-200",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          data-testid={`priority-${p}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

const DEFAULT_SCALE: Record<string, string> = {
  "1": "Far below expectations",
  "2": "Below expectations",
  "3": "Meeting expectations",
  "4": "Above expectations",
  "5": "Far exceeds expectations",
};

function RatingInput({ value, onChange, scaleDefinitions }: { value: number | null; onChange: (v: number | null) => void; scaleDefinitions?: Record<string, string> }) {
  const scale = { ...DEFAULT_SCALE, ...(scaleDefinitions || {}) };
  return (
    <TooltipProvider>
      <div className="flex gap-1.5 items-center" data-testid="rating-input">
        {[1, 2, 3, 4, 5].map(n => (
          <Tooltip key={n}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onChange(value === n ? null : n)}
                className={cn(
                  "w-9 h-9 rounded-lg text-sm font-bold transition-all border",
                  value === n
                    ? n >= 4 ? "bg-emerald-500 text-white border-emerald-600 shadow-md scale-110" :
                      n === 3 ? "bg-yellow-500 text-white border-yellow-600 shadow-md scale-110" :
                      "bg-red-500 text-white border-red-600 shadow-md scale-110"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                )}
                data-testid={`rating-${n}`}
              >
                {n}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              {scale[String(n)] || `Rating ${n}`}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

function generateAISummary(
  outcomes: TargetedOutcome[],
  overallMeasures: Measure[],
  scoringMode: string,
  finalScore: number | null,
  filter: ScoreFilter,
): string {
  if (scoringMode === "overall") {
    const rated = overallMeasures.filter((m) => !m.skipped && effectiveMeasureRating(m, filter) !== null);
    if (rated.length === 0) return "No measures have been scored yet. Add measures and instances to see a summary.";
    const avg = finalScore;
    const high = rated.filter((m) => (effectiveMeasureRating(m, filter) || 0) >= 4);
    const low = rated.filter((m) => (effectiveMeasureRating(m, filter) || 0) <= 2);
    let summary = `Overall component score is ${avg !== null ? String(Math.max(1, Math.min(5, Math.round(avg)))) : "pending"} based on ${rated.length} rated measure${rated.length !== 1 ? "s" : ""}.`;
    if (high.length > 0) summary += ` Strengths include ${high.map(m => m.name).join(", ")}.`;
    if (low.length > 0) summary += ` Areas for growth: ${low.map(m => m.name).join(", ")}.`;
    return summary;
  }

  const scored = outcomes.filter(o => !o.skipped && o.calculatedScore !== null);
  const unscored = outcomes.filter(o => !o.skipped && o.calculatedScore === null);
  if (scored.length === 0 && unscored.length === 0) return "No outcomes have been added yet. Add outcomes and measures to generate a summary.";
  if (scored.length === 0) return `${unscored.length} outcome${unscored.length !== 1 ? "s" : ""} pending scoring. Add measures and instances to see a summary.`;

  const strong = scored.filter(o => (o.calculatedScore || 0) >= 4);
  const moderate = scored.filter(o => (o.calculatedScore || 0) >= 3 && (o.calculatedScore || 0) < 4);
  const weak = scored.filter(o => (o.calculatedScore || 0) < 3);

  let summary = `Component outcome score is ${finalScore !== null ? String(Math.max(1, Math.min(5, Math.round(finalScore)))) : "pending"} across ${scored.length} scored outcome${scored.length !== 1 ? "s" : ""}.`;
  if (strong.length > 0) summary += ` Strong performance in ${strong.map(o => o.outcomeName).join(", ")}.`;
  if (moderate.length > 0) summary += ` Moderate performance in ${moderate.map(o => o.outcomeName).join(", ")}.`;
  if (weak.length > 0) summary += ` Needs attention: ${weak.map(o => o.outcomeName).join(", ")}.`;
  if (unscored.length > 0) summary += ` ${unscored.length} outcome${unscored.length !== 1 ? "s" : ""} still awaiting scores.`;
  return summary;
}

function MeasureCard({
  measure,
  onUpdate,
  onDelete,
  outcomeSkipped,
  actors,
  onAddActor,
  filter,
}: {
  measure: Measure;
  onUpdate: (m: Measure) => void;
  onDelete: () => void;
  outcomeSkipped?: boolean;
  actors: string[];
  onAddActor?: (label: string) => void;
  filter: ScoreFilter;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScale, setShowScale] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const canSkip = measure.priority === "L";
  const isDisabled = measure.skipped || outcomeSkipped;
  const scaleDefs = measure.scaleDefinitions || {};
  const minDate = useMemo(() => minAsOfDate(new Date(), 5), []);
  const score = useMemo(() => effectiveMeasureRating(measure, filter), [filter, measure]);

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
  const [openInstRationale, setOpenInstRationale] = useState<Record<string, boolean>>({});

  const updateScale = (n: string, val: string) => {
    const updated = { ...scaleDefs, [n]: val };
    if (!val.trim()) delete updated[n];
    onUpdate({ ...measure, scaleDefinitions: Object.keys(updated).length > 0 ? updated : undefined });
  };

  const updateInstances = (next: ScoreInstance[]) => {
    onUpdate({ ...measure, rating: null, instances: next });
  };

  const addInstance = () => {
    const next: ScoreInstance = {
      id: generateId(),
      actor: "",
      asOfDate: toIsoDateString(new Date()),
      score: null,
      weight: "M",
      rationale: "",
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
            <div className="flex items-center gap-2 text-left">
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
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">{measure.appliesTo}</span>
                  {measure.skipped && <Badge variant="secondary" className="text-[9px] h-4 bg-amber-100 text-amber-700">Skipped</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                Instances {(measure.instances || []).length}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <PriorityPicker value={measure.priority} onChange={(p) => onUpdate({ ...measure, priority: p, skipped: p !== "L" ? false : measure.skipped })} disabled={isDisabled} />
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
                  <Label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">Applies to</Label>
                  <Input
                    value={measure.appliesTo}
                    onChange={(e) => onUpdate({ ...measure, appliesTo: e.target.value })}
                    placeholder="e.g. All students, Grade 9, Honors..."
                    className="h-8 text-sm"
                    disabled={isDisabled}
                    data-testid={`input-applies-to-${measure.id}`}
                  />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {canSkip && (
                  <button
                    onClick={() => onUpdate({ ...measure, skipped: !measure.skipped })}
                    className={cn(
                      "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors",
                      measure.skipped ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                    data-testid={`skip-measure-${measure.id}`}
                  >
                    <SkipForward className="w-3 h-3" />
                    {measure.skipped ? "Skipped" : "Skip"}
                  </button>
                )}
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowScale(!showScale)}
                        className={cn(
                          "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors",
                          showScale ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                        data-testid={`toggle-scale-${measure.id}`}
                      >
                        <Ruler className="w-3 h-3" />
                        Define scale
                      </button>
                      <button
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        onClick={() => {}}
                        data-testid={`upload-evidence-${measure.id}`}
                      >
                        <Upload className="w-3 h-3" />
                        Upload evidence
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] text-gray-500">
                        Uses the marking period + aggregation filters to compute this measure’s score.
                      </div>
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
                          const ratOpen = !!openInstRationale[instKey];
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
                                  <span className="text-[10px] font-semibold text-gray-600">As-of</span>
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

                              <div>
                                <button
                                  type="button"
                                  onClick={() => setOpenInstRationale((prev) => ({ ...prev, [instKey]: !prev[instKey] }))}
                                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                                  data-testid={`measure-inst-rationale-toggle-${measure.id}-${instKey}`}
                                >
                                  {ratOpen ? "Hide rationale" : (inst as any)?.rationale ? "Edit rationale" : "Add rationale"}
                                </button>
                                {ratOpen ? (
                                  <div className="mt-2">
                                    <Textarea
                                      value={String((inst as any)?.rationale || "")}
                                      onChange={(e) => {
                                        const v = e.currentTarget.value;
                                        updateInstances(
                                          (measure.instances || []).map((x) => (x.id === inst.id ? { ...x, rationale: v } : x)),
                                        );
                                      }}
                                      placeholder="Add rationale…"
                                      className="text-xs min-h-[60px] bg-white"
                                      data-testid={`measure-inst-rationale-${measure.id}-${instKey}`}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-gray-400 italic">
                    Make sure you consider the average achievement and how this achievement varies among students.
                  </p>

                  {showScale && (
                    <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-1.5" data-testid={`scale-panel-${measure.id}`}>
                      <span className="text-[10px] text-gray-500 font-semibold uppercase">Scale Definitions</span>
                      {[1, 2, 3, 4, 5].map(n => (
                        <div key={n} className="flex items-center gap-2">
                          <span className={cn(
                            "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                            n >= 4 ? "bg-emerald-100 text-emerald-700" :
                            n === 3 ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          )}>{n}</span>
                          <span className="text-[10px] text-gray-500">=</span>
                          <Input
                            value={scaleDefs[String(n)] || ""}
                            onChange={(e) => updateScale(String(n), e.target.value)}
                            placeholder={DEFAULT_SCALE[String(n)]}
                            className="h-6 text-[10px] flex-1"
                            data-testid={`scale-input-${n}-${measure.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setShowRationale(!showRationale)}
                    className={cn(
                      "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors mt-2",
                      showRationale ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                    data-testid={`toggle-rationale-${measure.id}`}
                  >
                    <FileText className="w-3 h-3" />
                    Rationale
                  </button>

                  {showRationale && (
                    <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-1.5" data-testid={`rationale-panel-${measure.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">Notes (optional)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-gray-500">Confidence</span>
                          <select
                            value={(measure as any).confidence || "M"}
                            onChange={(e) => onUpdate({ ...measure, confidence: e.target.value as any })}
                            className="h-6 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700"
                            data-testid={`confidence-select-${measure.id}`}
                          >
                            <option value="H">H</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                          </select>
                        </div>
                      </div>
                      <Textarea
                        value={measure.rationale || ""}
                        onChange={(e) => onUpdate({ ...measure, rationale: e.target.value || undefined })}
                        placeholder="Why was this measure chosen? What does it tell us?"
                        className="text-xs min-h-[60px] resize-none"
                        data-testid={`rationale-input-${measure.id}`}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface OutcomeScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
}

export default function OutcomeScoreView({ nodeId, title, onBack, sourceFilter, onFilterChange }: OutcomeScoreViewProps) {
  if (String(nodeId || "") === "overall") {
    return (
      <OutcomeScoreOverallInstancesView
        nodeId={nodeId}
        title={title}
        onBack={onBack}
        sourceFilter={sourceFilter}
        onFilterChange={onFilterChange}
      />
    );
  }

  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scoringMode, setScoringMode] = useState<"targeted" | "overall">("targeted");
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
  const [targetedOutcomes, setTargetedOutcomes] = useState<TargetedOutcome[]>([]);
  const [overallMeasures, setOverallMeasures] = useState<Measure[]>([]);
  const [expandedOutcomes, setExpandedOutcomes] = useState<Record<string, boolean>>({});
  const [newMeasureName, setNewMeasureName] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [selectedOutcomeLabel, setSelectedOutcomeLabel] = useState<string | null>(null);

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

  if (selectedOutcomeLabel) {
    return (
      <OutcomeDetailView
        nodeId={nodeId}
        title={title}
        outcomeLabel={selectedOutcomeLabel}
        onBack={() => setSelectedOutcomeLabel(null)}
        onOpenOutcomeScore={() => setSelectedOutcomeLabel(null)}
        sourceFilter={filter}
        onFilterChange={setFilter as any}
      />
    );
  }

  const normalizeMeasure = (m: Measure): Measure => ({
    ...m,
    skipped: m.priority === "L" ? m.skipped : false,
    confidence: (m as any).confidence === "H" || (m as any).confidence === "M" || (m as any).confidence === "L" ? (m as any).confidence : "M",
    reflectionAchievement: m.reflectionAchievement || "",
    reflectionVariability: m.reflectionVariability || "",
    instances: (() => {
      const raw = Array.isArray((m as any).instances) ? ((m as any).instances as ScoreInstance[]) : [];
      const fixed = raw.map((i: any) => ({ ...i, rationale: String(i?.rationale || "") })) as ScoreInstance[];
      // Migration: convert legacy manual rating into a first instance.
      if (raw.length === 0 && m.rating !== null && m.rating !== undefined) {
        return [
          {
            id: generateId(),
            actor: "",
            asOfDate: toIsoDateString(new Date()),
            score: m.rating as any,
            weight: "M",
            rationale: "",
          } satisfies ScoreInstance,
        ];
      }
      return fixed;
    })(),
    rating: null,
  });

  const normalizeOutcome = (o: TargetedOutcome): TargetedOutcome => ({
    ...o,
    skipped: o.priority === "L" ? o.skipped : false,
    rigorPath: "thin",
    measures: o.measures.map(normalizeMeasure),
  });

  const levelToPriority = (level: unknown): "H" | "M" | "L" => {
    if (level === "High") return "H";
    if (level === "Low") return "L";
    return "M";
  };

  const getDeOutcomeAims = useCallback((): { label: string; id: string; level?: unknown }[] => {
    if (!comp) return [];
    const de: any = comp.designedExperienceData || {};
    const kde = de.keyDesignElements || {};
    const aims: any[] = kde.aims || [];
    return aims
      .filter((a: any) => a?.type === "outcome")
      .map((a: any) => ({ label: a.label, id: a.id, level: a.level }));
  }, [comp]);

  const recalcOutcomes = useCallback(
    (outcomes: TargetedOutcome[]): TargetedOutcome[] => {
      return outcomes.map((o) => ({
        ...o,
        calculatedScore: calcOutcomeScore(o.measures, filter),
      }));
    },
    [filter],
  );

  useEffect(() => {
    if (comp && !initialized) {
      const hd: any = comp.healthData || {};
      const osd: Partial<OutcomeScoreData> = hd.outcomeScoreData || {};
      setScoringMode(osd.scoringMode || "targeted");
      setActors(Array.isArray((osd as any).actors) ? ((osd as any).actors as any[]) : []);
      const saved: any = ((osd as any).filter as any) || {};
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

      const existingOutcomes = (osd.targetedOutcomes || []).map(normalizeOutcome);
      const deAims = getDeOutcomeAims();
      const existingNames = new Set(existingOutcomes.map(o => o.outcomeName.trim().toLowerCase()));
      const merged = [...existingOutcomes];
      for (const aim of deAims) {
        if (!existingNames.has(aim.label.trim().toLowerCase())) {
          const created = createOutcome(aim.label.trim());
          merged.push({ ...created, priority: levelToPriority(aim.level) });
        }
      }

      // Ensure calculatedScore is initialized so finalScore can compute immediately.
      setTargetedOutcomes(recalcOutcomes(merged));
      setOverallMeasures((osd.overallMeasures || []).map(normalizeMeasure));
      const expanded: Record<string, boolean> = {};
      merged.forEach((o) => { expanded[o.id] = true; });
      setExpandedOutcomes(expanded);
      setInitialized(true);
    }
  }, [comp, initialized, recalcOutcomes]);

  // Keep the targeted outcome list in sync with Designed Experience outcome aims (including removals).
  // DE is treated as the source of truth for which outcomes are tracked.
  useEffect(() => {
    if (!initialized) return;
    if (scoringMode !== "targeted") return;

    const deAims = getDeOutcomeAims();
    const desired: { label: string; level?: unknown }[] = [];
    const seen = new Set<string>();
    for (const a of deAims) {
      const label = (a.label || "").trim();
      const key = normLabel(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      desired.push({ label, level: a.level });
    }

    const byName = new Map<string, TargetedOutcome>();
    for (const o of targetedOutcomes) {
      byName.set(normLabel(o.outcomeName || ""), o);
    }

    const next: TargetedOutcome[] = desired.map(({ label, level }) => {
      const existing = byName.get(normLabel(label));
      const priority = levelToPriority(level);
      return existing
        ? { ...existing, outcomeName: label, priority }
        : { ...createOutcome(label), priority };
    });

    const currentSig = targetedOutcomes
      .map((o) => `${normLabel(o.outcomeName || "")}:${String(o.priority || "")}`)
      .join("|");
    const nextSig = next
      .map((o) => `${normLabel(o.outcomeName || "")}:${String(o.priority || "")}`)
      .join("|");
    if (currentSig !== nextSig) {
      setTargetedOutcomes(recalcOutcomes(next));
      setExpandedOutcomes((prev) => {
        const updated = { ...prev };
        for (const o of next) {
          if (updated[o.id] === undefined) updated[o.id] = true;
        }
        return updated;
      });
    }
  }, [getDeOutcomeAims, initialized, recalcOutcomes, scoringMode, targetedOutcomes]);

  const finalScore = useMemo(() => {
    if (scoringMode === "overall") {
      const items = overallMeasures.map((m) => ({
        rating: effectiveMeasureRating(m, filter),
        priority: (m as any)?.priority || "M",
        skipped: !!(m as any)?.skipped,
      }));
      return roundFinal1to5(weightedAverage(items));
    }
    return roundFinal1to5(calcComponentScore(targetedOutcomes));
  }, [filter, scoringMode, targetedOutcomes, overallMeasures]);

  const normLabel = (s: string) => s.trim().toLowerCase();

  const removeOutcomeFromDE = useCallback((outcomeName: string) => {
    if (!nodeId || !comp) return;
    const de: any = comp.designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const existingAims: any[] = kde.aims || [];
    const filtered = existingAims.filter((a: any) => !(a.type === "outcome" && normLabel(a.label) === normLabel(outcomeName)));
    if (filtered.length === existingAims.length) return;
    updateMutation.mutate({
      nodeId,
      data: {
        designedExperienceData: {
          ...de,
          keyDesignElements: { ...kde, aims: filtered },
        },
      },
    });
  }, [nodeId, comp, updateMutation]);

  const doSave = useCallback((mode: string, outcomes: TargetedOutcome[], measures: Measure[], score: number | null) => {
    if (!nodeId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const existing: any = comp?.healthData || {};
      const existingOsd: any = existing.outcomeScoreData || {};
      updateMutation.mutate({
        nodeId,
        data: {
          healthData: {
            ...existing,
            outcomeScoreData: {
              ...existingOsd,
              scoringMode: mode,
              actors,
              filter,
              targetedOutcomes: outcomes,
              overallMeasures: measures,
              finalOutcomeScore: score,
            },
          },
        },
      });
    }, 1000);
  }, [nodeId, comp, updateMutation, actors, filter]);

  useEffect(() => {
    if (initialized) {
      doSave(scoringMode, targetedOutcomes, overallMeasures, finalScore);
    }
  }, [scoringMode, targetedOutcomes, overallMeasures, finalScore, initialized, actors, filter, doSave]);

  // Recalculate outcome scores when the filter changes.
  useEffect(() => {
    if (!initialized) return;
    if (scoringMode !== "targeted") return;
    setTargetedOutcomes((prev) => recalcOutcomes(prev));
  }, [initialized, recalcOutcomes, scoringMode]);

  const updateTargetedOutcomes = (updated: TargetedOutcome[]) => {
    const recalced = recalcOutcomes(updated);
    setTargetedOutcomes(recalced);
  };

  const optionalFromSubcomponents = useMemo(() => {
    if (!comp) return [];
    const subs: any[] = (comp as any)?.designedExperienceData?.subcomponents || [];
    const idx = buildSubcomponentOutcomeIndex(subs);
    const existing = new Set(
      (Array.isArray(targetedOutcomes) ? targetedOutcomes : [])
        .map((o) => normOutcomeKey(o?.outcomeName))
        .filter(Boolean),
    );

    const out: Array<{ key: string; label: string; subs: { id: string; name: string; priority: "H" | "M" | "L" }[] }> = [];
    for (const [k, v] of Array.from(idx.entries())) {
      if (existing.has(k)) continue;
      out.push({ key: k, label: v.label, subs: v.subcomponents });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [comp, targetedOutcomes]);

  const addOptionalOutcomeToScore = (label: string) => {
    const clean = String(label || "").trim();
    if (!clean) return;
    const key = normOutcomeKey(clean);
    if (!key) return;
    const exists = targetedOutcomes.some((o) => normOutcomeKey(o?.outcomeName) === key);
    if (exists) return;
    updateTargetedOutcomes([...targetedOutcomes, createOutcome(clean)]);
  };

  const deleteOutcome = (id: string) => {
    const toDelete = targetedOutcomes.find(o => o.id === id);
    const updated = targetedOutcomes.filter(o => o.id !== id);
    updateTargetedOutcomes(updated);
    if (toDelete) removeOutcomeFromDE(toDelete.outcomeName);
  };

  const updateOutcome = (id: string, changes: Partial<TargetedOutcome>) => {
    updateTargetedOutcomes(targetedOutcomes.map(o =>
      o.id === id ? { ...o, ...changes, skipped: changes.priority !== undefined && changes.priority !== "L" ? false : (changes.skipped ?? o.skipped) } : o
    ));
  };

  const addMeasureToOutcome = (outcomeId: string) => {
    const name = (newMeasureName[outcomeId] || "").trim();
    if (!name) return;
    updateTargetedOutcomes(targetedOutcomes.map(o =>
      o.id === outcomeId ? { ...o, measures: [...o.measures, createMeasure(name)] } : o
    ));
    setNewMeasureName(prev => ({ ...prev, [outcomeId]: "" }));
  };

  const updateMeasureInOutcome = (outcomeId: string, measure: Measure) => {
    updateTargetedOutcomes(targetedOutcomes.map(o =>
      o.id === outcomeId ? { ...o, measures: o.measures.map(m => m.id === measure.id ? measure : m) } : o
    ));
  };

  const deleteMeasureFromOutcome = (outcomeId: string, measureId: string) => {
    updateTargetedOutcomes(targetedOutcomes.map(o =>
      o.id === outcomeId ? { ...o, measures: o.measures.filter(m => m.id !== measureId) } : o
    ));
  };

  const addOverallMeasure = () => {
    const name = (newMeasureName["overall"] || "").trim();
    if (!name) return;
    setOverallMeasures(prev => [...prev, createMeasure(name)]);
    setNewMeasureName(prev => ({ ...prev, overall: "" }));
  };

  const updateOverallMeasure = (measure: Measure) => {
    setOverallMeasures(prev => prev.map(m => m.id === measure.id ? measure : m));
  };

  const deleteOverallMeasure = (measureId: string) => {
    setOverallMeasures(prev => prev.filter(m => m.id !== measureId));
  };

  const totalMeasures = scoringMode === "targeted"
    ? targetedOutcomes.reduce((sum, o) => sum + o.measures.length, 0)
    : overallMeasures.length;

  const ratedMeasures = scoringMode === "targeted"
    ? targetedOutcomes.reduce(
        (sum, o) => sum + o.measures.filter((m) => !m.skipped && effectiveMeasureRating(m, filter) !== null).length,
        0,
      )
    : overallMeasures.filter((m) => !m.skipped && effectiveMeasureRating(m, filter) !== null).length;

  const aiSummary = useMemo(
    () => generateAISummary(targetedOutcomes, overallMeasures, scoringMode, finalScore, filter),
    [targetedOutcomes, overallMeasures, scoringMode, finalScore, filter],
  );

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
    for (const o of Array.isArray(targetedOutcomes) ? targetedOutcomes : []) {
      scanInstances((o as any)?.instances);
      scanMeasures((o as any)?.measures);
    }
    scanMeasures(overallMeasures);

    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [actors, globalActors, overallMeasures, targetedOutcomes]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
        data-testid="button-back-to-health"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status & Health
      </button>

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="outcome-filter-bar" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="score-dashboard">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-gray-900">Outcome Score</h2>
              <p className="text-sm text-gray-500">{title}</p>
            </div>
            <div className="text-right space-y-1">
              <ScoreChip score={finalScore} size="lg" />
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Component O Score</p>
            </div>
          </div>

          {scoringMode === "targeted" && targetedOutcomes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {targetedOutcomes.map(o => (
                <div key={o.id} className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border",
                  o.skipped ? "bg-gray-50 border-gray-200 opacity-60" : "bg-gray-50 border-gray-200"
                )} data-testid={`outcome-score-tile-${o.id}`}>
                  <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center text-sm font-bold shrink-0",
                    o.calculatedScore !== null
                      ? o.calculatedScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                        o.calculatedScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-400"
                  )}>
                    {o.calculatedScore !== null ? String(Math.max(1, Math.min(5, Math.round(o.calculatedScore)))) : "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={cn("text-xs font-medium truncate block", o.skipped && "line-through text-gray-400")}>{o.outcomeName}</span>
                    <span className={cn(
                      "text-[9px] font-bold",
                      o.priority === "H" ? "text-red-500" : o.priority === "M" ? "text-yellow-600" : "text-blue-400"
                    )}>{o.priority}</span>
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
                  ? (targetedOutcomes || []).map((o: any) => ({ key: String(o.id), label: String(o.outcomeName || "Outcome"), score: o.calculatedScore ?? null }))
                  : (overallMeasures || []).map((m: any) => ({
                      key: String(m.id),
                      label: String(m.name || "Measure"),
                      score: effectiveMeasureRating(m, filter),
                    }))
                ) as any
              }
              threshold={2}
              defaultOpen={false}
              testId="outcome-flags"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{ratedMeasures}/{totalMeasures} measures rated</span>
          <span className="text-[10px] text-gray-400">Weighted: H=6, M=3, L=1</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <RadioGroup
          value={scoringMode}
          onValueChange={(v) => setScoringMode(v as "targeted" | "overall")}
          className="grid grid-cols-2 gap-3"
        >
          <label
            htmlFor="mode-targeted"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              scoringMode === "targeted" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
            )}
          >
            <RadioGroupItem value="targeted" id="mode-targeted" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Targeted Outcomes</div>
              <p className="text-xs text-gray-500 mt-0.5">Score individual outcomes, then roll up to component</p>
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
              <div className="text-sm font-semibold text-gray-900">Overall Component</div>
              <p className="text-xs text-gray-500 mt-0.5">Attach measures directly to the component</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {scoringMode === "targeted" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Targeted Outcomes
            </h3>
            <span className="text-xs text-gray-400">{targetedOutcomes.length} outcome{targetedOutcomes.length !== 1 ? "s" : ""}</span>
          </div>

          {targetedOutcomes.map((outcome) => {
            const isExpanded = expandedOutcomes[outcome.id] ?? false;
            const canSkip = outcome.priority === "L";
            const isUnscored = !outcome.skipped && (outcome.measures.length === 0 || outcome.measures.every(m => m.rating === null || m.skipped));
            const fromDE = getDeOutcomeAims().some(a => normLabel(a.label) === normLabel(outcome.outcomeName));

            return (
              <Collapsible
                key={outcome.id}
                open={isExpanded}
                onOpenChange={() => setExpandedOutcomes(prev => ({ ...prev, [outcome.id]: !prev[outcome.id] }))}
              >
                <div className={cn(
                  "border rounded-xl overflow-hidden transition-all",
                  outcome.skipped ? "border-gray-200 bg-gray-50 opacity-60" : "border-gray-200 bg-white shadow-sm"
                )}>
                  <CollapsibleTrigger asChild>
                    <div
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors group text-left cursor-pointer"
                      role="button"
                      tabIndex={0}
                      data-testid={`outcome-trigger-${outcome.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <ScoreChip score={outcome.calculatedScore} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{outcome.outcomeName || "Untitled Outcome"}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400">{outcome.measures.length} measure{outcome.measures.length !== 1 ? "s" : ""}</span>
                            {outcome.skipped && (
                              <Badge variant="secondary" className="text-[9px] h-4 bg-amber-100 text-amber-700">Skipped</Badge>
                            )}
                            {isUnscored && !outcome.skipped && (
                              <Badge variant="secondary" className="text-[9px] h-4 bg-orange-100 text-orange-600 border border-orange-200">Not scored</Badge>
                            )}
                            {fromDE && (
                              <Badge variant="secondary" className="text-[9px] h-4 bg-blue-50 text-blue-700 border border-blue-200">Primary</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <PriorityPicker
                            value={outcome.priority}
                            onChange={(p) => updateOutcome(outcome.id, { priority: p })}
                          />
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-gray-500 hover:text-gray-900"
                            onClick={() => setSelectedOutcomeLabel(outcome.outcomeName)}
                            data-testid={`button-outcome-details-${outcome.id}`}
                          >
                            Details
                          </Button>
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
                              onClick={() => updateOutcome(outcome.id, { skipped: !outcome.skipped })}
                              className={cn(
                                "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors",
                                outcome.skipped ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              )}
                              data-testid={`skip-outcome-${outcome.id}`}
                            >
                              <SkipForward className="w-3 h-3" />
                              {outcome.skipped ? "Skipped" : "Skip this outcome"}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => deleteOutcome(outcome.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          data-testid={`delete-outcome-${outcome.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {!outcome.skipped && (
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500 font-semibold">Measures</Label>
                          {outcome.measures.length === 0 && (
                            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Add at least one measure to score this outcome
                            </div>
                          )}
                          {outcome.measures.map((measure) => (
                            <MeasureCard
                              key={measure.id}
                              measure={measure}
                              onUpdate={(m) => updateMeasureInOutcome(outcome.id, m)}
                              onDelete={() => deleteMeasureFromOutcome(outcome.id, measure.id)}
                              outcomeSkipped={outcome.skipped}
                              actors={actorOptions}
                              onAddActor={onAddActor}
                              filter={filter}
                            />
                          ))}

                          {(() => {
                            const hasLeaderPerception = outcome.measures.some(
                              m => m.name.toLowerCase() === LEADER_PERCEPTION_MEASURE_NAME.toLowerCase()
                            );
                            return (
                              <button
                                onClick={() => {
                                  if (hasLeaderPerception) {
                                    const filtered = outcome.measures.filter(
                                      m => m.name.toLowerCase() !== LEADER_PERCEPTION_MEASURE_NAME.toLowerCase()
                                    );
                                    updateTargetedOutcomes(targetedOutcomes.map(o =>
                                      o.id === outcome.id ? { ...o, measures: filtered } : o
                                    ));
                                  } else {
                                    const newM = createMeasure(LEADER_PERCEPTION_MEASURE_NAME);
                                    updateTargetedOutcomes(targetedOutcomes.map(o =>
                                      o.id === outcome.id ? { ...o, measures: [...o.measures, newM] } : o
                                    ));
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2 text-[11px] font-medium rounded-md border px-3 py-2 transition-colors w-full",
                                  hasLeaderPerception
                                    ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                                    : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                                )}
                                data-testid={`toggle-leader-perception-${outcome.id}`}
                              >
                                <UserCheck className={cn("w-3.5 h-3.5", hasLeaderPerception ? "text-violet-500" : "text-gray-400")} />
                                <span>Leader perception of achievement</span>
                                <span className={cn(
                                  "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded",
                                  hasLeaderPerception ? "bg-violet-200 text-violet-700" : "bg-gray-200 text-gray-400"
                                )}>
                                  {hasLeaderPerception ? "ON" : "OFF"}
                                </span>
                              </button>
                            );
                          })()}

                          <div className="flex gap-2">
                            <Input
                              value={newMeasureName[outcome.id] || ""}
                              onChange={(e) => setNewMeasureName(prev => ({ ...prev, [outcome.id]: e.target.value }))}
                              placeholder="New measure name..."
                              className="h-8 text-xs flex-1"
                              onKeyDown={(e) => e.key === "Enter" && addMeasureToOutcome(outcome.id)}
                              data-testid={`input-new-measure-${outcome.id}`}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1"
                              onClick={() => addMeasureToOutcome(outcome.id)}
                              data-testid={`add-measure-${outcome.id}`}
                            >
                              <Plus className="w-3 h-3" /> Add
                            </Button>
                          </div>

                          <div
                            className="flex items-center gap-2 text-[10px] text-gray-300 bg-gray-50 rounded-md border border-dashed border-gray-200 px-3 py-2 cursor-not-allowed select-none"
                            data-testid={`whole-school-measures-${outcome.id}`}
                          >
                            <Globe className="w-3.5 h-3.5 text-gray-300" />
                            <span>Select from whole school measures</span>
                            <Badge variant="secondary" className="text-[8px] h-3.5 bg-gray-100 text-gray-400 ml-auto">Coming soon</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

          {optionalFromSubcomponents.length > 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">Optional outcomes from subcomponents</div>
                <span className="text-xs text-gray-400">{optionalFromSubcomponents.length}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                You can optionally add these to the Outcome Score here. They will still remain visible on the Outcomes page.
              </div>
              <div className="mt-3 space-y-2">
                {optionalFromSubcomponents.map((o) => (
                  <div key={o.key} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{o.label}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {o.subs.map((s) => (
                          <Badge key={s.id} variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                            From: {s.name} ({s.priority})
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => addOptionalOutcomeToScore(o.label)}>
                        Add to scoring list
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-900" onClick={() => setSelectedOutcomeLabel(o.label)}>
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="pt-1 text-xs text-gray-400 italic">
            Outcomes are managed in Designed Experience. Add or remove outcomes there to update this list.
          </div>
        </div>
      )}

      {scoringMode === "overall" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Component Measures
            </h3>
            <span className="text-xs text-gray-400">{overallMeasures.length} measure{overallMeasures.length !== 1 ? "s" : ""}</span>
          </div>

          {overallMeasures.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
              <AlertCircle className="w-3.5 h-3.5" />
              Add measures to calculate the component outcome score
            </div>
          )}

          {overallMeasures.map((measure) => (
            <MeasureCard
              key={measure.id}
              measure={measure}
              onUpdate={updateOverallMeasure}
              onDelete={() => deleteOverallMeasure(measure.id)}
              actors={actorOptions}
              onAddActor={onAddActor}
              filter={filter}
            />
          ))}

          <div className="flex gap-2 pt-1">
            <Input
              value={newMeasureName["overall"] || ""}
              onChange={(e) => setNewMeasureName(prev => ({ ...prev, overall: e.target.value }))}
              placeholder="New measure name..."
              className="h-9 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && addOverallMeasure()}
              data-testid="input-new-overall-measure"
            />
            <Button
              variant="outline"
              className="h-9 gap-1.5"
              onClick={addOverallMeasure}
              data-testid="add-overall-measure"
            >
              <Plus className="w-4 h-4" /> Add Measure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
