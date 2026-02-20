import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { calculateRingImplementationScore } from "@shared/ring-implementation-score";
import type { RingImplementationScoreData } from "@shared/schema";

type WeightLabel = "H" | "M" | "L";

function normalizeWeightLabel(value: unknown): WeightLabel {
  if (value === "H" || value === "M" || value === "L") return value;
  return "M";
}

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function ScoreButtons({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1.5 items-center" data-testid="impl-score-buttons">
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
          data-testid={`impl-score-${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function WeightPicker({ value, onChange }: { value: WeightLabel; onChange: (v: WeightLabel) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-gray-50" data-testid="impl-weight-picker">
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
          data-testid={`impl-weight-${k}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function ConfidenceSelect({ value, onChange }: { value: WeightLabel; onChange: (v: WeightLabel) => void }) {
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

interface RingImplementationScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
}

export default function RingImplementationScoreView({ nodeId, title, onBack }: RingImplementationScoreViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [implementationScoringMode, setImplementationScoringMode] = useState<RingImplementationScoreData["implementationScoringMode"]>("overall");
  const [overallImplementationScore, setOverallImplementationScore] = useState<number | null>(null);
  const [overallImplementationRationale, setOverallImplementationRationale] = useState<string>("");
  const [overallImplementationConfidence, setOverallImplementationConfidence] = useState<WeightLabel>("M");
  const [dimensions, setDimensions] = useState<RingImplementationScoreData["dimensions"]>({
    quality: { score: null, weight: "M", confidence: "M" } as any,
    fidelity: { score: null, weight: "M", confidence: "M" } as any,
    scale: { score: null, weight: "M", confidence: "M" } as any,
    learnerDemand: { score: null, weight: "M", confidence: "M" } as any,
  });
  const [initialized, setInitialized] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!comp || initialized) return;
    const hd: any = comp.healthData || {};
    const rsd: Partial<RingImplementationScoreData> = hd.ringImplementationScoreData || {};
    const d: any = rsd.dimensions || {};

    setImplementationScoringMode((rsd as any).implementationScoringMode || "overall");
    setOverallImplementationScore(normalizeScore((rsd as any).overallImplementationScore));
    setOverallImplementationRationale((rsd as any).overallImplementationRationale || "");
    setOverallImplementationConfidence(normalizeWeightLabel((rsd as any).overallImplementationConfidence ?? "M"));
    setDimensions({
      quality: {
        score: normalizeScore(d.quality?.score),
        rationale: d.quality?.rationale,
        confidence: normalizeWeightLabel(d.quality?.confidence ?? "M"),
        weight: normalizeWeightLabel(d.quality?.weight),
      },
      fidelity: {
        score: normalizeScore(d.fidelity?.score),
        rationale: d.fidelity?.rationale,
        confidence: normalizeWeightLabel(d.fidelity?.confidence ?? "M"),
        weight: normalizeWeightLabel(d.fidelity?.weight),
      },
      scale: {
        score: normalizeScore(d.scale?.score),
        rationale: d.scale?.rationale,
        confidence: normalizeWeightLabel(d.scale?.confidence ?? "M"),
        weight: normalizeWeightLabel(d.scale?.weight),
      },
      learnerDemand: {
        score: normalizeScore(d.learnerDemand?.score),
        rationale: d.learnerDemand?.rationale,
        confidence: normalizeWeightLabel(d.learnerDemand?.confidence ?? "M"),
        weight: normalizeWeightLabel(d.learnerDemand?.weight),
      },
    });
    setInitialized(true);
  }, [comp, initialized]);

  const finalScore = useMemo(() => {
    const rsd: RingImplementationScoreData = {
      implementationScoringMode,
      overallImplementationScore,
      overallImplementationRationale,
      overallImplementationConfidence,
      dimensions,
      finalImplementationScore: null,
    };
    return calculateRingImplementationScore({ healthData: { ringImplementationScoreData: rsd } });
  }, [dimensions, implementationScoringMode, overallImplementationRationale, overallImplementationScore]);

  const doSave = useCallback(
    (rsd: RingImplementationScoreData, computed: number | null) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = comp?.healthData || {};
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              ringImplementationScoreData: {
                ...rsd,
                finalImplementationScore: computed,
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
    const rsd: RingImplementationScoreData = {
      implementationScoringMode,
      overallImplementationScore,
      overallImplementationRationale,
      overallImplementationConfidence,
      dimensions,
      finalImplementationScore: finalScore,
    };
    doSave(rsd, finalScore);
  }, [dimensions, doSave, finalScore, initialized, implementationScoringMode, overallImplementationScore, overallImplementationRationale]);

  const toggleRationale = (key: string) => {
    setRationaleOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="ring-implementation-score-view">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
        data-testid="button-back-impl-score"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status &amp; Health
      </button>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="score-dashboard">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Implementation Score</h2>
              {(title || comp?.title) && <p className="text-sm text-gray-500 mt-0.5">{title || comp?.title}</p>}
            </div>
            <div data-testid="impl-final-score">
              <ScoreChip score={finalScore} size="lg" />
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              {implementationScoringMode === "overall"
                ? "Overall mode: Final score equals the Overall Implementation Score (1–5)."
                : "Dimensions mode: Final score is a weighted average of scored dimensions using H/M/L weights (H=4, M=2, L=1), rounded to the nearest whole. Blank scores are ignored."}
            </p>
          </div>
        </div>

        <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
          <span>{implementationScoringMode === "overall" ? "Mode: Overall" : "Mode: Dimensions"}</span>
          <span>Weighted: H=4, M=2, L=1</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4" data-testid="impl-scoring-mode">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <RadioGroup
          value={implementationScoringMode}
          onValueChange={(v) => setImplementationScoringMode(v as "overall" | "multi")}
          className="grid grid-cols-2 gap-3"
        >
          <label
            htmlFor="impl-mode-dimensions"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              implementationScoringMode === "multi" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="multi" id="impl-mode-dimensions" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Dimensions</div>
              <p className="text-xs text-gray-500 mt-0.5">Score dimensions and roll up using H/M/L weights</p>
            </div>
          </label>
          <label
            htmlFor="impl-mode-overall"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              implementationScoringMode === "overall" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="overall" id="impl-mode-overall" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Overall</div>
              <p className="text-xs text-gray-500 mt-0.5">Set a single overall score for implementation</p>
            </div>
          </label>
        </RadioGroup>
        <p className="text-[10px] text-gray-400">Switching modes does not delete saved values.</p>
      </div>

      {implementationScoringMode === "overall" ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="impl-overall-section">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Overall Implementation Score</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              1–5
            </Badge>
          </div>
          <div className="p-4 space-y-3">
            <ScoreButtons value={overallImplementationScore} onChange={setOverallImplementationScore} />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleRationale("impl.overall")}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                data-testid="toggle-overall-impl-rationale"
              >
                {rationaleOpen["impl.overall"] ? "Hide rationale" : overallImplementationRationale ? "Edit rationale" : "Add rationale"}
              </button>
              {rationaleOpen["impl.overall"] && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-500">Confidence</span>
                    <ConfidenceSelect value={overallImplementationConfidence} onChange={setOverallImplementationConfidence} />
                  </div>
                  <Textarea
                    value={overallImplementationRationale}
                    onChange={(e) => setOverallImplementationRationale(e.currentTarget.value)}
                    placeholder="Add rationale…"
                    className="text-xs min-h-[70px]"
                    data-testid="impl-overall-rationale"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="impl-dimensions">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Dimensions</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              H/M/L weights
            </Badge>
          </div>
          <div className="p-4 space-y-3">
            {(
              [
                { key: "quality", label: "Quality" },
                { key: "fidelity", label: "Fidelity" },
                { key: "scale", label: "Scale" },
                { key: "learnerDemand", label: "Learner Demand" },
              ] as const
            ).map((row) => {
              const dim: any = (dimensions as any)[row.key] || {};
              const ratKey = `impl.${row.key}`;
              return (
                <div key={row.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2" data-testid={`impl-dimension-${row.key}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate">{row.label}</div>
                      <div className="text-[10px] text-gray-500">Score 1–5 and weight (H/M/L).</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold text-gray-500">Wt</span>
                      <WeightPicker
                        value={normalizeWeightLabel(dim.weight)}
                        onChange={(v) =>
                          setDimensions((prev) => ({
                            ...(prev as any),
                            [row.key]: { ...((prev as any)[row.key] || {}), weight: v },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <ScoreButtons
                    value={dim.score ?? null}
                    onChange={(v) =>
                      setDimensions((prev) => ({
                        ...(prev as any),
                        [row.key]: { ...((prev as any)[row.key] || {}), score: v },
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
                      {rationaleOpen[ratKey] ? "Hide rationale" : dim.rationale ? "Edit rationale" : "Add rationale"}
                    </button>
                    {rationaleOpen[ratKey] && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-gray-500">Confidence</span>
                            <ConfidenceSelect
                              value={normalizeWeightLabel(dim.confidence ?? "M")}
                              onChange={(v) =>
                                setDimensions((prev) => ({
                                  ...(prev as any),
                                  [row.key]: { ...((prev as any)[row.key] || {}), confidence: v },
                                }))
                              }
                            />
                          </div>
                          <Textarea
                            value={dim.rationale || ""}
                            onChange={(e) =>
                              setDimensions((prev) => ({
                                ...(prev as any),
                                [row.key]: { ...((prev as any)[row.key] || {}), rationale: e.currentTarget.value },
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
      )}
    </div>
  );
}

