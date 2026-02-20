import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  SkipForward,
  AlertCircle,
  Sparkles,
  Upload,
  Ruler,
  Heart,
  Users,
  Zap,
  Globe,
  FileText,
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
import type { ExperienceScoreData, Measure, ExperienceDimension } from "@shared/schema";

const PRIORITY_WEIGHT: Record<string, number> = { H: 6, M: 3, L: 1 };
type LeapsScoringMode = "across" | "individual";
type Hml = "H" | "M" | "L";

type LeapItem = {
  id: string;
  label: string;
  weight: Hml;
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

function calcDimensionScore(dim: ExperienceDimension): number | null {
  return weightedAverage(dim.measures);
}

function calcLeapScoreFromMeasures(measures: Measure[]): number | null {
  return weightedAverage(measures);
}

function calcLeapsDimensionScoreFromItems(items: LeapItem[]): number | null {
  let totalWeight = 0;
  let total = 0;
  for (const item of items) {
    const score = calcLeapScoreFromMeasures(item.measures);
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
  healthExcluded: boolean,
  behaviorExcluded: boolean,
): { leaps: number; health: number; behavior: number } {
  const dims: { key: string; weight: number; scored: boolean }[] = [];

  if (baseWeights.leapsWeight > 0) {
    dims.push({ key: "leaps", weight: baseWeights.leapsWeight, scored: leapsDimScore !== null });
  }
  dims.push({ key: "health", weight: baseWeights.healthWeight, scored: healthDimScore !== null && !healthExcluded });
  dims.push({ key: "behavior", weight: baseWeights.behaviorWeight, scored: behaviorDimScore !== null && !behaviorExcluded });

  const scoredDims = dims.filter(d => d.scored);
  const missingWeight = dims.filter(d => !d.scored).reduce((s, d) => s + d.weight, 0);
  const redistPerDim = scoredDims.length > 0 ? missingWeight / scoredDims.length : 0;

  const result = { leaps: 0, health: 0, behavior: 0 };
  for (const d of dims) {
    const adjusted = d.scored ? d.weight + redistPerDim : 0;
    (result as any)[d.key] = adjusted;
  }
  return result;
}

function calcFinalScore(
  leapsDimScore: number | null,
  healthDimScore: number | null,
  behaviorDimScore: number | null,
  weights: { leapsWeight: number; healthWeight: number; behaviorWeight: number },
): number | null {
  if (leapsDimScore === null && weights.leapsWeight > 0) return null;

  const dims: { score: number; weight: number }[] = [];
  const missingWeights: number[] = [];

  if (weights.leapsWeight > 0) {
    if (leapsDimScore !== null) dims.push({ score: leapsDimScore, weight: weights.leapsWeight });
    else missingWeights.push(weights.leapsWeight);
  }

  if (healthDimScore !== null && weights.healthWeight > 0) {
    dims.push({ score: healthDimScore, weight: weights.healthWeight });
  } else {
    missingWeights.push(weights.healthWeight);
  }

  if (behaviorDimScore !== null && weights.behaviorWeight > 0) {
    dims.push({ score: behaviorDimScore, weight: weights.behaviorWeight });
  } else {
    missingWeights.push(weights.behaviorWeight);
  }

  if (dims.length === 0) return null;

  const totalMissing = missingWeights.reduce((s, w) => s + w, 0);
  const redistPerDim = totalMissing / dims.length;
  const adjusted = dims.map(d => ({ ...d, weight: d.weight + redistPerDim }));

  let total = 0;
  for (const d of adjusted) {
    total += d.score * d.weight;
  }
  return Math.round(total * 100) / 100;
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

  const rounded = Math.round(score * 10) / 10;
  const color = rounded >= 4 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                rounded >= 3 ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                "bg-red-100 text-red-700 border-red-200";

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

function LeapsModeToggle({ value, onChange }: { value: LeapsScoringMode; onChange: (v: LeapsScoringMode) => void }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2" data-testid="leaps-mode-toggle">
      <Label className="text-xs text-gray-700">Leaps scoring</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as LeapsScoringMode)} className="grid grid-cols-2 gap-2">
        <label
          htmlFor="leaps-mode-across"
          className={cn(
            "flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-all",
            value === "across" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
          )}
        >
          <RadioGroupItem value="across" id="leaps-mode-across" className="mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-gray-900">Across leaps</div>
            <p className="text-[11px] text-gray-500 mt-0.5">One shared set of measures</p>
          </div>
        </label>
        <label
          htmlFor="leaps-mode-individual"
          className={cn(
            "flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-all",
            value === "individual" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
          )}
        >
          <RadioGroupItem value="individual" id="leaps-mode-individual" className="mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-gray-900">Individual leaps</div>
            <p className="text-[11px] text-gray-500 mt-0.5">Score each tagged leap, then roll up</p>
          </div>
        </label>
      </RadioGroup>
      <p className="text-[10px] text-gray-400">Switching does not delete saved values.</p>
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
  leaps: ExperienceDimension,
  health: ExperienceDimension,
  behavior: ExperienceDimension,
  leapsDimScore: number | null,
  healthDimScore: number | null,
  behaviorDimScore: number | null,
  finalScore: number | null,
): string {
  const allMeasures = [...leaps.measures, ...health.measures, ...behavior.measures];
  const rated = allMeasures.filter(m => !m.skipped && m.rating !== null);

  if (rated.length === 0) {
    return "No measures have been scored yet. Add and rate measures across dimensions to see a summary.";
  }

  let summary = `Experience score is ${finalScore !== null ? String(finalScore) : "pending"}.`;

  if (leapsDimScore !== null) {
    summary += ` Leaps dimension: ${(Math.round(leapsDimScore * 10) / 10).toFixed(1)}.`;
    const strong = leaps.measures.filter(m => !m.skipped && (m.rating ?? 0) >= 4);
    const weak = leaps.measures.filter(m => !m.skipped && m.rating !== null && m.rating < 3);
    if (strong.length > 0) summary += ` Strong: ${strong.map(m => m.name).join(", ")}.`;
    if (weak.length > 0) summary += ` Needs attention: ${weak.map(m => m.name).join(", ")}.`;
  } else {
    summary += " Leaps dimension awaiting scores.";
  }

  if (health.measures.length === 0) {
    summary += " Health dimension excluded (no measures).";
  } else if (healthDimScore !== null) {
    summary += ` Health: ${(Math.round(healthDimScore * 10) / 10).toFixed(1)}.`;
  }

  if (behavior.measures.length === 0) {
    summary += " Behavior dimension excluded (no measures).";
  } else if (behaviorDimScore !== null) {
    summary += ` Behavior: ${(Math.round(behaviorDimScore * 10) / 10).toFixed(1)}.`;
  }

  return summary;
}

const LEAP_MEASURES = [
  "Student Self Report Survey",
  "Leaps Look for Observation",
  "Teacher Perception Survey",
];

function MeasureCard({
  measure,
  onUpdate,
  onDelete,
  sectionDisabled,
  isLeapsDimension,
}: {
  measure: Measure;
  onUpdate: (m: Measure) => void;
  onDelete: () => void;
  sectionDisabled?: boolean;
  isLeapsDimension?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScale, setShowScale] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const canSkip = measure.priority === "L";
  const isDisabled = measure.skipped || sectionDisabled;
  const scaleDefs = measure.scaleDefinitions || {};

  const updateScale = (n: string, val: string) => {
    const updated = { ...scaleDefs, [n]: val };
    if (!val.trim()) delete updated[n];
    onUpdate({ ...measure, scaleDefinitions: Object.keys(updated).length > 0 ? updated : undefined });
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
                measure.rating !== null
                  ? measure.rating >= 4 ? "bg-emerald-100 text-emerald-700" :
                    measure.rating === 3 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-400"
              )}>
                {measure.rating !== null ? measure.rating : "—"}
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
              <button
                className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded cursor-not-allowed uppercase tracking-wider whitespace-nowrap"
                onClick={(e) => e.stopPropagation()}
              >
                Update Score
              </button>
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
                  {isLeapsDimension ? (
                    <select
                      value={measure.name}
                      onChange={(e) => onUpdate({ ...measure, name: e.target.value })}
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isDisabled}
                      data-testid={`select-measure-name-${measure.id}`}
                    >
                      <option value="" disabled>Select a measure...</option>
                      {LEAP_MEASURES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={measure.name}
                      onChange={(e) => onUpdate({ ...measure, name: e.target.value })}
                      placeholder="Measure name..."
                      className="h-8 text-sm"
                      disabled={isDisabled}
                      data-testid={`input-measure-name-${measure.id}`}
                    />
                  )}
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
                    <Label className="text-xs text-gray-500 font-semibold">Rating (1–5)</Label>
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
                        onClick={() => setShowRationale(!showRationale)}
                        className={cn(
                          "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors",
                          showRationale ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                        data-testid={`toggle-rationale-${measure.id}`}
                      >
                        <FileText className="w-3 h-3" />
                        Rationale
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

                  <RatingInput
                    value={measure.rating}
                    onChange={(r) => onUpdate({ ...measure, rating: r })}
                    scaleDefinitions={measure.scaleDefinitions}
                  />

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

                  {showRationale && (
                    <div className="mt-2 bg-purple-50 rounded-lg border border-purple-200 p-2.5 space-y-1.5" data-testid={`rationale-panel-${measure.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-purple-600 font-semibold uppercase">Notes</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-purple-700">Confidence</span>
                          <select
                            value={(measure as any).confidence || "M"}
                            onChange={(e) => onUpdate({ ...measure, confidence: e.target.value as any })}
                            className="h-6 rounded-md border border-purple-200 bg-white px-2 text-[11px] font-semibold text-gray-700"
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
                        onChange={(e) => onUpdate({ ...measure, rationale: e.target.value })}
                        placeholder="Explain the reasoning behind this rating..."
                        className="text-sm min-h-[60px] bg-white"
                        data-testid={`input-rationale-${measure.id}`}
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

interface ExperienceScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
}

export default function ExperienceScoreView({ nodeId, title, onBack }: ExperienceScoreViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scoringMode, setScoringMode] = useState<"dimensions" | "overall">("dimensions");
  const [leapsScoringMode, setLeapsScoringMode] = useState<LeapsScoringMode>("across");
  const [leaps, setLeaps] = useState<ExperienceDimension>({ measures: [], excluded: false });
  const [health, setHealth] = useState<ExperienceDimension>({ measures: [], excluded: false });
  const [behavior, setBehavior] = useState<ExperienceDimension>({ measures: [], excluded: false });
  const [leapItems, setLeapItems] = useState<LeapItem[]>([]);
  const [overallMeasures, setOverallMeasures] = useState<Measure[]>([]);
  const [newMeasureName, setNewMeasureName] = useState<Record<string, string>>({ leaps: "", health: "", behavior: "" });
  const [newLeapMeasureName, setNewLeapMeasureName] = useState<Record<string, string>>({});
  const [newOverallMeasureName, setNewOverallMeasureName] = useState("");
  const [initialized, setInitialized] = useState(false);

  const normalizeMeasure = (m: Measure): Measure => ({
    ...m,
    skipped: m.priority === "L" ? m.skipped : false,
    confidence: (m as any).confidence === "H" || (m as any).confidence === "M" || (m as any).confidence === "L" ? (m as any).confidence : "M",
    reflectionAchievement: m.reflectionAchievement || "",
    reflectionVariability: m.reflectionVariability || "",
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
      setLeapsScoringMode(((esd as any).leapsScoringMode as LeapsScoringMode) || "across");
      setLeaps({
        measures: (esd.leaps?.measures || []).map(normalizeMeasure),
        excluded: esd.leaps?.excluded || false,
      });
      setHealth({
        measures: (esd.health?.measures || []).map(normalizeMeasure),
        excluded: esd.health?.excluded || false,
      });
      setBehavior({
        measures: (esd.behavior?.measures || []).map(normalizeMeasure),
        excluded: esd.behavior?.excluded || false,
      });
      setLeapItems(
        (((esd as any).leapItems || []) as any[]).map((li) => ({
          id: String(li?.id || generateId()),
          label: String(li?.label || "Untitled leap"),
          weight: normalizeHml(li?.weight),
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
    if (leapsScoringMode !== "individual") return;

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
          ? { ...existing, label: aim.label, weight: desiredWeight }
          : { id: aim.id, label: aim.label, weight: desiredWeight, measures: [] },
      );
    }

    const currentSig = leapItems.map((li) => `${normLabel(li.label)}:${li.weight}`).join("|");
    const nextSig = next.map((li) => `${normLabel(li.label)}:${li.weight}`).join("|");
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
  }, [getLeapAimsFromDE, initialized, leapItems, leapsScoringMode, scoringMode]);

  const leapsDimScore = useMemo(() => {
    if (leapsScoringMode === "individual") return calcLeapsDimensionScoreFromItems(leapItems);
    return calcDimensionScore(leaps);
  }, [leapItems, leaps, leapsScoringMode]);
  const healthDimScore = useMemo(() => calcDimensionScore(health), [health]);
  const behaviorDimScore = useMemo(() => calcDimensionScore(behavior), [behavior]);

  const leapsMeasuresAll = useMemo(() => {
    if (leapsScoringMode === "individual") return leapItems.flatMap((li) => li.measures);
    return leaps.measures;
  }, [leapItems, leaps.measures, leapsScoringMode]);

  const finalScore = useMemo(
    () => {
      let raw: number | null = null;
      if (scoringMode === "overall") {
        raw = weightedAverage(overallMeasures);
        return roundFinal1to5(raw);
      }
      const requiresLeaps = baseWeights.leapsWeight > 0;
      const hasAnyLeapsMeasures =
        leapsScoringMode === "individual" ? leapItems.some((li) => li.measures.length > 0) : leaps.measures.length > 0;
      if (requiresLeaps && !hasAnyLeapsMeasures) return null;
      raw = calcFinalScore(leapsDimScore, healthDimScore, behaviorDimScore, baseWeights);
      return roundFinal1to5(raw);
    },
    [scoringMode, overallMeasures, baseWeights, leapsDimScore, healthDimScore, behaviorDimScore, leaps.measures.length, leapItems, leapsScoringMode]
  );

  const adjustedWeights = useMemo(
    () => calcRedistributedWeights(baseWeights, leapsDimScore, healthDimScore, behaviorDimScore, health.measures.length === 0, behavior.measures.length === 0),
    [baseWeights, leapsDimScore, healthDimScore, behaviorDimScore, health.measures.length, behavior.measures.length]
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
  }, [nodeId, comp, updateMutation]);

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

  const toggleExclude = (dim: "health" | "behavior") => {
  };

  const allMeasures = scoringMode === "overall" ? overallMeasures : [...leapsMeasuresAll, ...health.measures, ...behavior.measures];
  const totalMeasures = allMeasures.length;
  const ratedMeasures = allMeasures.filter(m => !m.skipped && m.rating !== null).length;

  const aiSummary = useMemo(() => {
    if (scoringMode === "overall") {
      const rated = overallMeasures.filter(m => !m.skipped && m.rating !== null);
      if (rated.length === 0) return "No measures have been scored yet. Add and rate measures to see a summary.";
      return `Overall experience score is ${finalScore !== null ? String(finalScore) : "pending"} based on ${rated.length} rated measure${rated.length !== 1 ? "s" : ""}.`;
    }
    return generateAISummary({ measures: leapsMeasuresAll, excluded: false }, health, behavior, leapsDimScore, healthDimScore, behaviorDimScore, finalScore);
  }, [behavior, behaviorDimScore, finalScore, health, healthDimScore, leapsDimScore, leapsMeasuresAll, overallMeasures, scoringMode]);

  const weightFormulaText = useMemo(() => {
    if (leapCount === 0) return "No leaps tagged → Leaps 0%, Health 50%, Behavior 50%";
    return `${leapCount} leap${leapCount !== 1 ? "s" : ""} → Leaps ${Math.round(baseWeights.leapsWeight * 100)}%, Health ${Math.round(baseWeights.healthWeight * 100)}%, Behavior ${Math.round(baseWeights.behaviorWeight * 100)}%`;
  }, [leapCount, baseWeights]);

  const getWeightTooltip = (dim: "leaps" | "health" | "behavior"): string => {
    const bw = dim === "leaps" ? baseWeights.leapsWeight : dim === "health" ? baseWeights.healthWeight : baseWeights.behaviorWeight;
    const aw = dim === "leaps" ? adjustedWeights.leaps : dim === "health" ? adjustedWeights.health : adjustedWeights.behavior;
    const basePercent = Math.round(bw * 100);
    const adjustedPercent = Math.round(aw * 100);

    if (dim === "leaps") {
      let tip = `${leapCount} leap${leapCount !== 1 ? "s" : ""} in Designed Experience → ${basePercent}% base weight.`;
      if (adjustedPercent !== basePercent) {
        const diff = adjustedPercent - basePercent;
        const sources: string[] = [];
        if (health.measures.length === 0 || healthDimScore === null) sources.push("Health");
        if (behavior.measures.length === 0 || behaviorDimScore === null) sources.push("Behavior");
        tip += ` +${diff}% redistributed from ${sources.join(" and ")} dimension${sources.length > 1 ? "s" : ""} → ${adjustedPercent}% effective.`;
      } else {
        tip += " No redistribution applied.";
      }
      return tip;
    }

    const dimName = dim === "health" ? "Health" : "Behavior";
    const isExcluded = dim === "health" ? health.measures.length === 0 : behavior.measures.length === 0;
    const dimScore = dim === "health" ? healthDimScore : behaviorDimScore;

    if (isExcluded) {
      return `Excluded — weight redistributed to other dimensions.`;
    }

    let tip = `Base weight: ${basePercent}%.`;
    if (adjustedPercent !== basePercent && dimScore !== null) {
      const diff = adjustedPercent - basePercent;
      const sources: string[] = [];
      if (dim !== "health" && (health.measures.length === 0 || healthDimScore === null)) sources.push("Health");
      if (dim !== "behavior" && (behavior.measures.length === 0 || behaviorDimScore === null)) sources.push("Behavior");
      if (leapsDimScore === null && baseWeights.leapsWeight > 0) sources.push("Leaps");
      tip += ` +${diff}% redistributed from ${sources.join(" and ")} dimension${sources.length > 1 ? "s" : ""} → ${adjustedPercent}% effective.`;
    } else if (dimScore === null) {
      tip += " No rated measures — weight redistributed to other dimensions.";
    } else {
      tip += " No redistribution applied.";
    }
    return tip;
  };

  const dimConfig = [
    { key: "leaps" as const, name: "Leaps & Design Principles", icon: Zap, score: leapsDimScore, weight: adjustedWeights.leaps, color: "text-amber-600" },
    { key: "health" as const, name: "Mental & Physical Health", icon: Heart, score: healthDimScore, weight: adjustedWeights.health, color: "text-rose-500" },
    { key: "behavior" as const, name: "Behavior, Attendance & Engagement", icon: Users, score: behaviorDimScore, weight: adjustedWeights.behavior, color: "text-blue-500" },
  ];

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
            <div className="grid grid-cols-3 gap-3 p-4" data-testid="dimension-tiles">
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

          <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
            <span data-testid="measures-rated-count">{ratedMeasures}/{totalMeasures} measures rated</span>
            {scoringMode === "dimensions" ? <span data-testid="weight-formula">{weightFormulaText}</span> : <span data-testid="weight-formula">Weighted: H=6, M=3, L=1</span>}
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
                <p className="text-xs text-gray-500 mt-0.5">Score Leaps, Health, and Behavior separately, then roll up</p>
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
              <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                Weighted: H=6, M=3, L=1
              </Badge>
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
                  isLeapsDimension={false}
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
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="section-leaps">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className={cn("w-4 h-4", "text-amber-600")} />
                  <h3 className="text-sm font-bold text-gray-900">Leaps &amp; Design Principles</h3>
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
                <LeapsModeToggle value={leapsScoringMode} onChange={setLeapsScoringMode} />

                {leapsScoringMode === "across" ? (
                  <div className="space-y-3" data-testid="leaps-across">
                    {leaps.measures.length === 0 && (
                      <div className="text-center py-4 text-xs text-gray-400" data-testid="empty-leaps">
                        No measures added yet. Add a measure below.
                      </div>
                    )}

                    {leaps.measures.map((m) => (
                      <MeasureCard
                        key={m.id}
                        measure={m}
                        onUpdate={(updated) => updateDimMeasure("leaps", m.id, updated)}
                        onDelete={() => deleteDimMeasure("leaps", m.id)}
                        sectionDisabled={false}
                        isLeapsDimension
                      />
                    ))}

                    <div className="flex items-center gap-2" data-testid="add-measure-leaps-across">
                      <select
                        value={newMeasureName.leaps}
                        onChange={(e) => setNewMeasureName((prev) => ({ ...prev, leaps: e.target.value }))}
                        className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        data-testid="select-new-measure-leaps"
                      >
                        <option value="">Select a measure...</option>
                        {LEAP_MEASURES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addDimMeasure("leaps")}
                        disabled={!newMeasureName.leaps.trim()}
                        className="h-8 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </Button>
                    </div>
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
                          const leapScore = calcLeapScoreFromMeasures(li.measures);
                          return (
                            <div key={li.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3" data-testid={`leap-item-${li.id}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-900 truncate">{li.label}</div>
                                  <div className="text-[10px] text-gray-500">Weight and measures roll up into the Leaps dimension.</div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] h-5 bg-gray-200 text-gray-700"
                                    title="Set leap priority in Designed Experience"
                                  >
                                    Wt {li.weight}
                                  </Badge>
                                  <ScoreChip score={leapScore} size="sm" />
                                </div>
                              </div>

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
                                  isLeapsDimension
                                />
                              ))}

                              <div className="flex items-center gap-2" data-testid={`add-measure-leap-${li.id}`}>
                                <select
                                  value={newLeapMeasureName[li.id] || ""}
                                  onChange={(e) => setNewLeapMeasureName((prev) => ({ ...prev, [li.id]: e.target.value }))}
                                  className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  data-testid={`select-new-measure-leap-${li.id}`}
                                >
                                  <option value="">Select a measure...</option>
                                  {LEAP_MEASURES.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DimensionSection
              dimKey="health"
              title="Mental & Physical Health"
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
            />

            <DimensionSection
              dimKey="behavior"
              title="Behavior, Attendance & Engagement"
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
            />
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
            isLeapsDimension={dimKey === "leaps"}
          />
        ))}

        <div className="flex items-center gap-2" data-testid={`add-measure-${dimKey}`}>
          {dimKey === "leaps" ? (
            <select
              value={newMeasureName}
              onChange={(e) => onNewMeasureNameChange(e.target.value)}
              className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid={`select-new-measure-${dimKey}`}
            >
              <option value="">Select a measure...</option>
              {LEAP_MEASURES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <Input
              value={newMeasureName}
              onChange={(e) => onNewMeasureNameChange(e.target.value)}
              placeholder="Add measure name..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && onAddMeasure()}
              data-testid={`input-new-measure-${dimKey}`}
            />
          )}
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
