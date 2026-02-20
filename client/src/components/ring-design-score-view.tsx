import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronDown, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { calculateRingDesignDimensionScores, calculateRingDesignScore } from "@shared/ring-design-score";
import type { RingDesignScoreData } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

function ScoreButtons({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-1.5 items-center" data-testid="design-score-buttons">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "w-9 h-9 rounded-lg text-sm font-bold transition-all border",
            value === n
              ? n >= 4
                ? "bg-emerald-500 text-white border-emerald-600 shadow-md scale-110"
                : n === 3
                  ? "bg-yellow-500 text-white border-yellow-600 shadow-md scale-110"
                  : "bg-red-500 text-white border-red-600 shadow-md scale-110"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
          )}
          aria-pressed={value === n}
          data-testid={`design-score-${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
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

  const rounded = Math.round(score * 10) / 10;
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
}

export default function RingDesignScoreView({ nodeId, title, onBack }: RingDesignScoreViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [designScoringMode, setDesignScoringMode] = useState<RingDesignScoreData["designScoringMode"]>("overall");
  const [overallDesignScore, setOverallDesignScore] = useState<number | null>(null);
  const [overallDesignRationale, setOverallDesignRationale] = useState<string>("");
  const [overallDesignConfidence, setOverallDesignConfidence] = useState<WeightLabel>("M");
  const [designWeights, setDesignWeights] = useState<RingDesignScoreData["designWeights"]>({
    aimsWeight: "L",
    experienceWeight: "M",
    resourcesWeight: "M",
  });
  const [subDimensions, setSubDimensions] = useState<RingDesignScoreData["subDimensions"]>({
    aims: { leapsScore: null, outcomesScore: null, leapsConfidence: "M", outcomesConfidence: "M" } as any,
    studentExperience: {
      thoroughnessScore: null,
      thoroughnessWeight: "L",
      leapinessScore: null,
      coherenceScore: null,
      coherenceWeight: "L",
      thoroughnessConfidence: "M",
      leapinessConfidence: "M",
      coherenceConfidence: "M",
    } as any,
    supportingResources: {
      thoroughnessScore: null,
      thoroughnessWeight: "M",
      qualityScore: null,
      qualityWeight: "M",
      coherenceScore: null,
      coherenceWeight: "M",
      thoroughnessConfidence: "M",
      qualityConfidence: "M",
      coherenceConfidence: "M",
    } as any,
  });
  const [initialized, setInitialized] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!comp || initialized) return;
    const hd: any = comp.healthData || {};
    const rsd: Partial<RingDesignScoreData> = hd.ringDesignScoreData || {};

    setDesignScoringMode(rsd.designScoringMode || "overall");
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
        leapsRationale: (rsd as any).subDimensions?.aims?.leapsRationale,
        leapsConfidence: normalizeWeightLabel((rsd as any).subDimensions?.aims?.leapsConfidence ?? "M"),
        outcomesScore: normalizeScore((rsd as any).subDimensions?.aims?.outcomesScore),
        outcomesRationale: (rsd as any).subDimensions?.aims?.outcomesRationale,
        outcomesConfidence: normalizeWeightLabel((rsd as any).subDimensions?.aims?.outcomesConfidence ?? "M"),
      },
      studentExperience: {
        thoroughnessScore: normalizeScore((rsd as any).subDimensions?.studentExperience?.thoroughnessScore),
        thoroughnessRationale: (rsd as any).subDimensions?.studentExperience?.thoroughnessRationale,
        thoroughnessConfidence: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.thoroughnessConfidence ?? "M"),
        thoroughnessWeight: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.thoroughnessWeight ?? "L"),
        leapinessScore: normalizeScore((rsd as any).subDimensions?.studentExperience?.leapinessScore),
        leapinessRationale: (rsd as any).subDimensions?.studentExperience?.leapinessRationale,
        leapinessConfidence: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.leapinessConfidence ?? "M"),
        coherenceScore: normalizeScore((rsd as any).subDimensions?.studentExperience?.coherenceScore),
        coherenceRationale: (rsd as any).subDimensions?.studentExperience?.coherenceRationale,
        coherenceConfidence: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.coherenceConfidence ?? "M"),
        coherenceWeight: normalizeWeightLabel((rsd as any).subDimensions?.studentExperience?.coherenceWeight ?? "L"),
      },
      supportingResources: {
        thoroughnessScore: normalizeScore((rsd as any).subDimensions?.supportingResources?.thoroughnessScore),
        thoroughnessRationale: (rsd as any).subDimensions?.supportingResources?.thoroughnessRationale,
        thoroughnessConfidence: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.thoroughnessConfidence ?? "M"),
        thoroughnessWeight: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.thoroughnessWeight ?? "M"),
        qualityScore: normalizeScore((rsd as any).subDimensions?.supportingResources?.qualityScore),
        qualityRationale: (rsd as any).subDimensions?.supportingResources?.qualityRationale,
        qualityConfidence: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.qualityConfidence ?? "M"),
        qualityWeight: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.qualityWeight ?? "M"),
        coherenceScore: normalizeScore((rsd as any).subDimensions?.supportingResources?.coherenceScore),
        coherenceRationale: (rsd as any).subDimensions?.supportingResources?.coherenceRationale,
        coherenceConfidence: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.coherenceConfidence ?? "M"),
        coherenceWeight: normalizeWeightLabel((rsd as any).subDimensions?.supportingResources?.coherenceWeight ?? "M"),
      },
    } as any);
    setInitialized(true);
  }, [comp, initialized]);

  const dimensionScores = useMemo(() => {
    const rsd: RingDesignScoreData = {
      designScoringMode,
      overallDesignScore,
      overallDesignRationale,
      overallDesignConfidence,
      designDimensions: { aimsScore: null, experienceScore: null, resourcesScore: null },
      designWeights,
      subDimensions,
      finalDesignScore: null,
    };
    return calculateRingDesignDimensionScores(rsd);
  }, [designScoringMode, designWeights, overallDesignRationale, overallDesignScore, subDimensions]);

  const finalScore = useMemo(() => {
    const rsd: RingDesignScoreData = {
      designScoringMode,
      overallDesignScore,
      overallDesignRationale,
      overallDesignConfidence,
      designDimensions: dimensionScores,
      designWeights,
      subDimensions,
      finalDesignScore: null,
    };
    return calculateRingDesignScore({ healthData: { ringDesignScoreData: rsd } });
  }, [designScoringMode, designWeights, dimensionScores, overallDesignRationale, overallDesignScore, subDimensions]);

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
      overallDesignScore,
      overallDesignRationale,
      overallDesignConfidence,
      designDimensions: dimensionScores,
      designWeights,
      subDimensions,
      finalDesignScore: finalScore,
    };
    doSave(rsd, finalScore);
  }, [designScoringMode, designWeights, doSave, finalScore, initialized, overallDesignScore, overallDesignRationale, subDimensions, dimensionScores]);

  const toggleRationale = (key: string) => {
    setRationaleOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

        <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
          <span>{designScoringMode === "overall" ? "Mode: Overall" : "Mode: Dimensions"}</span>
          <span>Weighted: H=4, M=2, L=1</span>
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

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="design-blueprint-card">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Blueprint (Representative)</h3>
          <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
            Placeholder
          </Badge>
        </div>
        <div className="p-4 space-y-2">
          <Label className="text-xs text-gray-700">Blueprint</Label>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="h-8 text-xs font-medium border-gray-300 bg-white justify-between w-full"
            data-testid="design-blueprint-dropdown-disabled"
          >
            {DESIGN_BLUEPRINT_OPTIONS[0]}
            <ChevronDown className="w-3 h-3 ml-2 text-gray-400" />
          </Button>
          <p className="text-[10px] text-gray-400">Blueprint switching is placeholder-only for now.</p>
        </div>
      </div>

      {designScoringMode === "overall" ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="design-overall-section">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Overall Design Score</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              1–5
            </Badge>
          </div>
          <div className="p-4 space-y-3">
            <ScoreButtons value={overallDesignScore} onChange={setOverallDesignScore} />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleRationale("overall")}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                data-testid="toggle-overall-rationale"
              >
                {rationaleOpen.overall ? "Hide rationale" : overallDesignRationale ? "Edit rationale" : "Add rationale"}
              </button>
              {rationaleOpen.overall && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-500">Confidence</span>
                    <ConfidenceSelect value={overallDesignConfidence} onChange={setOverallDesignConfidence} />
                  </div>
                  <Textarea
                    value={overallDesignRationale}
                    onChange={(e) => setOverallDesignRationale(e.currentTarget.value)}
                    placeholder="Add rationale for the overall score…"
                    className="text-xs min-h-[70px]"
                    data-testid="overall-rationale"
                  />
                </div>
              )}
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
            {/* Aims */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3" data-testid="design-dimension-aims">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">Aims for Learners</div>
                    <div className="text-[10px] text-gray-500">2 sub-dimensions (Leaps, Outcomes). Weights are fixed.</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">Score {dimensionScores.aimsScore ?? "—"}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gray-500">Wt</span>
                      <WeightPicker
                        value={normalizeWeightLabel(designWeights.aimsWeight)}
                        onChange={(v) => setDesignWeights((prev) => ({ ...prev, aimsWeight: v }))}
                      />
                    </div>
                  </div>
                </div>

                {(
                  [
                    { key: "leapsScore", label: "Leaps", rationaleKey: "leapsRationale" },
                    { key: "outcomesScore", label: "Outcomes", rationaleKey: "outcomesRationale" },
                  ] as const
                ).map((row) => {
                  const score = subDimensions.aims[row.key];
                  const rationale = (subDimensions.aims as any)[row.rationaleKey] as string | undefined;
                  const ratKey = `aims.${row.key}`;
                  return (
                    <div key={row.key} className="bg-white rounded-md border border-gray-200 p-3 space-y-2" data-testid={`aims-sub-${row.key}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-800">{row.label}</div>
                        <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">Wt M (locked)</Badge>
                      </div>
                      <ScoreButtons
                        value={score}
                        onChange={(v) => setSubDimensions((prev) => ({ ...prev, aims: { ...prev.aims, [row.key]: v } }))}
                      />
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleRationale(ratKey)}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                          data-testid={`toggle-rationale-${ratKey}`}
                        >
                          {rationaleOpen[ratKey] ? "Hide rationale" : rationale ? "Edit rationale" : "Add rationale"}
                        </button>
                        {rationaleOpen[ratKey] && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-gray-500">Confidence</span>
                              <ConfidenceSelect
                                value={normalizeWeightLabel((subDimensions.aims as any)[`${row.key.replace("Score", "")}Confidence`] ?? "M")}
                                onChange={(v) =>
                                  setSubDimensions((prev) => ({
                                    ...prev,
                                    aims: { ...(prev.aims as any), [`${row.key.replace("Score", "")}Confidence`]: v },
                                  }))
                                }
                              />
                            </div>
                            <Textarea
                              value={rationale || ""}
                              onChange={(e) =>
                                setSubDimensions((prev) => ({
                                  ...prev,
                                  aims: { ...(prev.aims as any), [row.rationaleKey]: e.currentTarget.value },
                                }))
                              }
                              placeholder="Add rationale…"
                              className="text-xs min-h-[70px]"
                              data-testid={`rationale-${ratKey}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Student Experience */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3" data-testid="design-dimension-experience">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">Student Experience</div>
                    <div className="text-[10px] text-gray-500">3 sub-dimensions. Leapiness weight is fixed.</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">Score {dimensionScores.experienceScore ?? "—"}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gray-500">Wt</span>
                      <WeightPicker
                        value={normalizeWeightLabel(designWeights.experienceWeight)}
                        onChange={(v) => setDesignWeights((prev) => ({ ...prev, experienceWeight: v }))}
                      />
                    </div>
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
                  const score = (subDimensions.studentExperience as any)[row.key] as number | null;
                  const rationale = (subDimensions.studentExperience as any)[row.rationaleKey] as string | undefined;
                  const ratKey = `studentExperience.${row.key}`;
                  const weight =
                    row.weightLocked
                      ? row.lockedWeight
                      : normalizeWeightLabel((subDimensions.studentExperience as any)[row.weightKey as any]);

                  return (
                    <div key={row.key} className="bg-white rounded-md border border-gray-200 p-3 space-y-2" data-testid={`se-sub-${row.key}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-800">{row.label}</div>
                        {row.weightLocked ? (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">Wt {weight} (locked)</Badge>
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
                      </div>
                      <ScoreButtons
                        value={score}
                        onChange={(v) =>
                          setSubDimensions((prev) => ({
                            ...prev,
                            studentExperience: { ...(prev.studentExperience as any), [row.key]: v },
                          }))
                        }
                      />
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleRationale(ratKey)}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                          data-testid={`toggle-rationale-${ratKey}`}
                        >
                          {rationaleOpen[ratKey] ? "Hide rationale" : rationale ? "Edit rationale" : "Add rationale"}
                        </button>
                        {rationaleOpen[ratKey] && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-gray-500">Confidence</span>
                              <ConfidenceSelect
                                value={normalizeWeightLabel((subDimensions.studentExperience as any)[`${row.key.replace("Score", "")}Confidence`] ?? "M")}
                                onChange={(v) =>
                                  setSubDimensions((prev) => ({
                                    ...prev,
                                    studentExperience: { ...(prev.studentExperience as any), [`${row.key.replace("Score", "")}Confidence`]: v },
                                  }))
                                }
                              />
                            </div>
                            <Textarea
                              value={rationale || ""}
                              onChange={(e) =>
                                setSubDimensions((prev) => ({
                                  ...prev,
                                  studentExperience: { ...(prev.studentExperience as any), [row.rationaleKey]: e.currentTarget.value },
                                }))
                              }
                              placeholder="Add rationale…"
                              className="text-xs min-h-[70px]"
                              data-testid={`rationale-${ratKey}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Supporting Resources & Routines */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3" data-testid="design-dimension-resources">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900 truncate">Supporting Resources & Routines</div>
                    <div className="text-[10px] text-gray-500">3 sub-dimensions.</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">Score {dimensionScores.resourcesScore ?? "—"}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gray-500">Wt</span>
                      <WeightPicker
                        value={normalizeWeightLabel(designWeights.resourcesWeight)}
                        onChange={(v) => setDesignWeights((prev) => ({ ...prev, resourcesWeight: v }))}
                      />
                    </div>
                  </div>
                </div>

                {(
                  [
                    { key: "thoroughnessScore", label: "Thoroughness", weightKey: "thoroughnessWeight", rationaleKey: "thoroughnessRationale" },
                    { key: "qualityScore", label: "Quality", weightKey: "qualityWeight", rationaleKey: "qualityRationale" },
                    { key: "coherenceScore", label: "Coherence", weightKey: "coherenceWeight", rationaleKey: "coherenceRationale" },
                  ] as const
                ).map((row) => {
                  const score = (subDimensions.supportingResources as any)[row.key] as number | null;
                  const rationale = (subDimensions.supportingResources as any)[row.rationaleKey] as string | undefined;
                  const weight = normalizeWeightLabel((subDimensions.supportingResources as any)[row.weightKey]);
                  const ratKey = `supportingResources.${row.key}`;
                  return (
                    <div key={row.key} className="bg-white rounded-md border border-gray-200 p-3 space-y-2" data-testid={`sr-sub-${row.key}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-800">{row.label}</div>
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
                      </div>
                      <ScoreButtons
                        value={score}
                        onChange={(v) =>
                          setSubDimensions((prev) => ({
                            ...prev,
                            supportingResources: { ...(prev.supportingResources as any), [row.key]: v },
                          }))
                        }
                      />
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleRationale(ratKey)}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                          data-testid={`toggle-rationale-${ratKey}`}
                        >
                          {rationaleOpen[ratKey] ? "Hide rationale" : rationale ? "Edit rationale" : "Add rationale"}
                        </button>
                        {rationaleOpen[ratKey] && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-gray-500">Confidence</span>
                              <ConfidenceSelect
                                value={normalizeWeightLabel((subDimensions.supportingResources as any)[`${row.key.replace("Score", "")}Confidence`] ?? "M")}
                                onChange={(v) =>
                                  setSubDimensions((prev) => ({
                                    ...prev,
                                    supportingResources: { ...(prev.supportingResources as any), [`${row.key.replace("Score", "")}Confidence`]: v },
                                  }))
                                }
                              />
                            </div>
                            <Textarea
                              value={rationale || ""}
                              onChange={(e) =>
                                setSubDimensions((prev) => ({
                                  ...prev,
                                  supportingResources: { ...(prev.supportingResources as any), [row.rationaleKey]: e.currentTarget.value },
                                }))
                              }
                              placeholder="Add rationale…"
                              className="text-xs min-h-[70px]"
                              data-testid={`rationale-${ratKey}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

