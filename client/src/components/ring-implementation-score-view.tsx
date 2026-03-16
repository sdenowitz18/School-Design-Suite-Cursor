import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Gauge, Info, ShieldCheck, Target, Trash2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import {
  calculateRingImplementationMeasureDimensionScores,
  calculateRingImplementationScore,
} from "@shared/ring-implementation-score";
import type {
  Measure,
  RingImplementationMeasureBased,
  RingImplementationScoreData,
  ScoreFilter,
} from "@shared/schema";
import {
  listSelectableQuarterKeys,
  listSelectableSemesterKeys,
  listSelectableYearKeys,
} from "@shared/marking-period";
import ScoreFilterBar from "./score-filter-bar";
import ScoreInstancesInlineEditor from "./score-instances-inline-editor";
import { effectiveFromInstances } from "@shared/score-instances";
import { useGlobalActors } from "@/lib/actors-store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import ScoreFlags from "./score-flags";

type WeightLabel = "H" | "M" | "L";
type ImplTab =
  | "studentsEnrollment"
  | "feasibilitySustainability"
  | "fidelityDesignedExperience"
  | "skillfulnessInstructionFacilitation"
  | "measurementAdministrationQuality";

interface RingImplementationScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
}

function newMeasure(): Measure {
  return {
    id: `m_${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    appliesTo: "All students",
    priority: "M",
    confidence: "M",
    rating: null,
    instances: [],
    reflectionAchievement: "",
    reflectionVariability: "",
    skipped: false,
    rationale: "",
    markingPeriod: { mode: "year", yearKey: listSelectableYearKeys(new Date(), 5)[0] },
  } as Measure;
}

function defaultMeasureBasedImplementation(): RingImplementationMeasureBased {
  return {
    dimensions: {
      studentsEnrollment: { measures: [] },
      feasibilitySustainability: { measures: [] },
      fidelityDesignedExperience: { measures: [] },
      skillfulnessInstructionFacilitation: {
        classroomManagementDeliveryOutcomes: { measures: [] },
        inspireMotivateEngagement: { measures: [] },
        childWeights: {
          classroomManagementDeliveryOutcomesWeight: "M",
          inspireMotivateEngagementWeight: "M",
        },
      },
      measurementAdministrationQuality: { measures: [] },
    },
    weights: {
      studentsEnrollmentWeight: "M",
      feasibilitySustainabilityWeight: "M",
      fidelityDesignedExperienceWeight: "M",
      skillfulnessInstructionFacilitationWeight: "M",
      measurementAdministrationQualityWeight: "M",
    },
  };
}

function formatMarkingPeriodSummary(measure: Measure): string {
  const mp: any = (measure as any)?.markingPeriod;
  if (!mp) return "No period";
  const mode = String(mp?.mode || "year");
  if (mode === "semester") return String(mp?.semesterKey || "Semester");
  if (mode === "quarter") return String(mp?.quarterKey || "Quarter");
  return String(mp?.yearKey || "Year");
}

function ScoreChip({
  score,
  size = "md",
}: {
  score: number | null;
  size?: "sm" | "md" | "lg";
}) {
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
    >
      {rounded}
    </div>
  );
}

function WeightPicker({ value, onChange }: { value: WeightLabel; onChange: (v: WeightLabel) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-gray-50">
      {(["L", "M", "H"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-bold transition-colors",
            value === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800",
            k !== "L" && "border-l border-gray-200",
          )}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function MeasureList({
  measures,
  onChange,
  actors,
  onAddActor,
  filter,
  testIdPrefix,
  emptyStateText = "No measures yet. Add a measure to start scoring.",
}: {
  measures: Measure[];
  onChange: (next: Measure[]) => void;
  actors: string[];
  onAddActor: (label: string) => void;
  filter: ScoreFilter;
  testIdPrefix: string;
  emptyStateText?: string;
}) {
  const [newName, setNewName] = useState("");
  const yearKeys = listSelectableYearKeys(new Date(), 5);
  const semesterKeys = listSelectableSemesterKeys(new Date(), 5);
  const quarterKeys = listSelectableQuarterKeys(new Date(), 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          placeholder="Add a measure"
          className="h-8 text-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8" disabled={!newName.trim()}>
              Add measure
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => { onChange([...measures, { ...newMeasure(), name: newName.trim() }]); setNewName(""); }}>From Scratch</DropdownMenuItem>
            <DropdownMenuItem disabled className="text-gray-400">Pull from Whole School <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {measures.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {emptyStateText}
        </div>
      ) : null}

      {measures.map((m) => {
        const score = effectiveFromInstances((m.instances || []) as any, filter as any).score;
        const markingMode = String((m as any)?.markingPeriod?.mode || "year");
        const periodLabel = formatMarkingPeriodSummary(m);
        return (
          <Collapsible key={m.id} defaultOpen={false}>
            <div className="border border-gray-200 rounded-lg bg-white">
              <div className="p-3 flex items-center justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex items-center gap-2 min-w-0 text-left">
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{m.name || "Untitled measure"}</div>
                      <div className="text-[10px] text-gray-500">{periodLabel}</div>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-100 text-gray-600">
                    {(m.instances || []).length} inst
                  </Badge>
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                    Score {score ?? "—"}
                  </Badge>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-gray-400 hover:text-red-600"
                    onClick={() => onChange(measures.filter((x) => x.id !== m.id))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  <Input
                    value={m.name}
                    onChange={(e) =>
                      onChange(measures.map((x) => (x.id === m.id ? { ...x, name: e.currentTarget.value } : x)))
                    }
                    placeholder="Measure name"
                    className="h-8 text-xs"
                  />
                  <Textarea
                    value={m.rationale || ""}
                    onChange={(e) =>
                      onChange(measures.map((x) => (x.id === m.id ? { ...x, rationale: e.currentTarget.value } : x)))
                    }
                    placeholder="Lightweight description"
                    className="text-xs min-h-[56px]"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                      value={markingMode}
                      onChange={(e) => {
                        const mode = e.currentTarget.value as "year" | "semester" | "quarter";
                        const markingPeriod =
                          mode === "year"
                            ? { mode, yearKey: yearKeys[0] }
                            : mode === "semester"
                              ? { mode, semesterKey: semesterKeys[0] }
                              : { mode, quarterKey: quarterKeys[0] };
                        onChange(measures.map((x) => (x.id === m.id ? ({ ...x, markingPeriod } as any) : x)));
                      }}
                    >
                      <option value="year">year</option>
                      <option value="semester">semester</option>
                      <option value="quarter">quarter</option>
                    </select>
                    {markingMode === "year" ? (
                      <select
                        className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                        value={(m as any)?.markingPeriod?.yearKey || yearKeys[0]}
                        onChange={(e) =>
                          onChange(
                            measures.map((x) =>
                              x.id === m.id
                                ? ({ ...x, markingPeriod: { ...(x as any).markingPeriod, mode: "year", yearKey: e.currentTarget.value } } as any)
                                : x,
                            ),
                          )
                        }
                      >
                        {yearKeys.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    ) : markingMode === "semester" ? (
                      <select
                        className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                        value={(m as any)?.markingPeriod?.semesterKey || semesterKeys[0]}
                        onChange={(e) =>
                          onChange(
                            measures.map((x) =>
                              x.id === m.id
                                ? ({
                                    ...x,
                                    markingPeriod: {
                                      ...(x as any).markingPeriod,
                                      mode: "semester",
                                      semesterKey: e.currentTarget.value,
                                    },
                                  } as any)
                                : x,
                            ),
                          )
                        }
                      >
                        {semesterKeys.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                        value={(m as any)?.markingPeriod?.quarterKey || quarterKeys[0]}
                        onChange={(e) =>
                          onChange(
                            measures.map((x) =>
                              x.id === m.id
                                ? ({
                                    ...x,
                                    markingPeriod: {
                                      ...(x as any).markingPeriod,
                                      mode: "quarter",
                                      quarterKey: e.currentTarget.value,
                                    },
                                  } as any)
                                : x,
                            ),
                          )
                        }
                      >
                        {quarterKeys.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <ScoreInstancesInlineEditor
                    instances={(m.instances || []) as any}
                    onChange={(next) => onChange(measures.map((x) => (x.id === m.id ? { ...x, instances: next as any } : x)))}
                    actors={actors}
                    onAddActor={onAddActor}
                    testIdPrefix={`${testIdPrefix}-${m.id}`}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

export default function RingImplementationScoreView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
}: RingImplementationScoreViewProps) {
  const { actors: globalActors, addActor: addGlobalActor, mergeActors: mergeGlobalActors } = useGlobalActors();
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [implementationScoringMode, setImplementationScoringMode] =
    useState<RingImplementationScoreData["implementationScoringMode"]>("overall");
  const [activeDimTab, setActiveDimTab] = useState<ImplTab>("studentsEnrollment");
  const [localFilter, setLocalFilter] = useState<ScoreFilter>({
    mode: "year",
    yearKey: listSelectableYearKeys(new Date(), 5)[0],
    aggregation: "singleLatest",
  } as any);
  const filter = sourceFilter || localFilter;
  const [overallMeasures, setOverallMeasures] = useState<Measure[]>([]);
  const [measureBasedImplementation, setMeasureBasedImplementation] =
    useState<RingImplementationMeasureBased>(defaultMeasureBasedImplementation());
  const [initialized, setInitialized] = useState(false);

  const setFilter = useCallback(
    (next: ScoreFilter) => {
      onFilterChange?.(next);
      setLocalFilter(next);
    },
    [onFilterChange],
  );

  useEffect(() => {
    if (!comp || initialized) return;
    const rsd: any = (comp as any)?.healthData?.ringImplementationScoreData || {};
    setImplementationScoringMode((rsd?.implementationScoringMode as any) || "overall");
    setLocalFilter((sourceFilter as any) || (rsd?.filter as any) || localFilter);
    setOverallMeasures(Array.isArray(rsd?.overallMeasures) ? rsd.overallMeasures : []);
    setMeasureBasedImplementation(
      rsd?.measureBasedImplementation
        ? (rsd.measureBasedImplementation as RingImplementationMeasureBased)
        : defaultMeasureBasedImplementation(),
    );
    setInitialized(true);
  }, [comp, initialized, localFilter, sourceFilter]);

  const allMeasures = useMemo(() => {
    const d: any = measureBasedImplementation?.dimensions || {};
    return [
      ...(overallMeasures || []),
      ...(d?.studentsEnrollment?.measures || []),
      ...(d?.feasibilitySustainability?.measures || []),
      ...(d?.fidelityDesignedExperience?.measures || []),
      ...(d?.measurementAdministrationQuality?.measures || []),
      ...(d?.skillfulnessInstructionFacilitation?.classroomManagementDeliveryOutcomes?.measures || []),
      ...(d?.skillfulnessInstructionFacilitation?.inspireMotivateEngagement?.measures || []),
    ] as Measure[];
  }, [measureBasedImplementation, overallMeasures]);

  const actorOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (v: unknown) => {
      const clean = String(v || "").trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };
    for (const a of globalActors || []) add(a);
    for (const m of allMeasures) for (const inst of m.instances || []) add((inst as any)?.actor);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [allMeasures, globalActors]);

  useEffect(() => {
    if (actorOptions.length > 0) mergeGlobalActors(actorOptions);
  }, [actorOptions, mergeGlobalActors]);

  const rsdForCalc = useMemo(
    () =>
      ({
        implementationScoringMode,
        actors: actorOptions,
        filter,
        measureBasedImplementation,
        overallMeasures,
        overallInstances: [],
        overallImplementationScore: null,
        overallImplementationRationale: "",
        overallImplementationConfidence: "M",
        dimensions: {
          studentsEnrollment: { instances: [], score: null, weight: "M" },
          feasibilitySustainability: { instances: [], score: null, weight: "M" },
          fidelityDesignedExperience: { instances: [], score: null, weight: "M" },
          qualityDelivery: { instances: [], score: null, weight: "M" },
          measurementAdministrationQuality: { instances: [], score: null, weight: "M" },
        },
        finalImplementationScore: null,
      }) as unknown as RingImplementationScoreData,
    [actorOptions, filter, implementationScoringMode, measureBasedImplementation, overallMeasures],
  );

  const fiveDimScores = useMemo(
    () => calculateRingImplementationMeasureDimensionScores(rsdForCalc),
    [rsdForCalc],
  );
  const finalScore = useMemo(
    () => calculateRingImplementationScore({ healthData: { ringImplementationScoreData: rsdForCalc } }),
    [rsdForCalc],
  );

  useEffect(() => {
    if (!initialized || !nodeId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const existing: any = (comp as any)?.healthData || {};
      updateMutation.mutate({
        nodeId,
        data: {
          healthData: {
            ...existing,
            ringImplementationScoreData: {
              ...(existing?.ringImplementationScoreData || {}),
              implementationScoringMode,
              actors: actorOptions,
              filter,
              measureBasedImplementation,
              overallMeasures,
              finalImplementationScore: finalScore,
            },
          },
        },
      });
    }, 450);
  }, [
    actorOptions,
    comp,
    filter,
    finalScore,
    implementationScoringMode,
    initialized,
    measureBasedImplementation,
    nodeId,
    overallMeasures,
    updateMutation,
  ]);

  const setNodeMeasures = (
    key:
      | "studentsEnrollment"
      | "feasibilitySustainability"
      | "fidelityDesignedExperience"
      | "measurementAdministrationQuality",
    next: Measure[],
  ) =>
    setMeasureBasedImplementation((prev) => ({
      ...prev,
      dimensions: { ...prev.dimensions, [key]: { ...(prev.dimensions as any)[key], measures: next } },
    }));

  const setSkillMeasures = (
    key: "classroomManagementDeliveryOutcomes" | "inspireMotivateEngagement",
    next: Measure[],
  ) =>
    setMeasureBasedImplementation((prev) => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        skillfulnessInstructionFacilitation: {
          ...prev.dimensions.skillfulnessInstructionFacilitation,
          [key]: {
            ...(prev.dimensions.skillfulnessInstructionFacilitation as any)[key],
            measures: next,
          },
        },
      },
    }));

  const tiles = [
    {
      key: "studentsEnrollment",
      label: "Students involved / enrollment",
      score: fiveDimScores.studentsEnrollmentScore,
      icon: Users,
      weight: measureBasedImplementation.weights.studentsEnrollmentWeight,
    },
    {
      key: "feasibilitySustainability",
      label: "Perceived feasibility / sustainability",
      score: fiveDimScores.feasibilitySustainabilityScore,
      icon: ShieldCheck,
      weight: measureBasedImplementation.weights.feasibilitySustainabilityWeight,
    },
    {
      key: "fidelityDesignedExperience",
      label: "Fidelity to designed experience",
      score: fiveDimScores.fidelityDesignedExperienceScore,
      icon: Target,
      weight: measureBasedImplementation.weights.fidelityDesignedExperienceWeight,
    },
    {
      key: "skillfulnessInstructionFacilitation",
      label: "Skillfulness of instruction & Facilitation",
      score: fiveDimScores.skillfulnessInstructionFacilitationScore,
      icon: Target,
      weight: measureBasedImplementation.weights.skillfulnessInstructionFacilitationWeight,
    },
    {
      key: "measurementAdministrationQuality",
      label: "Measurement administration quality",
      score: fiveDimScores.measurementAdministrationQualityScore,
      icon: Gauge,
      weight: measureBasedImplementation.weights.measurementAdministrationQualityWeight,
    },
  ] as const;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="ring-implementation-score-view">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status &amp; Health
      </button>

      <ScoreFilterBar filter={filter as any} onChange={setFilter as any} actors={actorOptions} />

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Implementation Score</h2>
            {(title || (comp as any)?.title) && (
              <p className="text-sm text-gray-500 mt-0.5">{title || (comp as any)?.title}</p>
            )}
          </div>
          <ScoreChip score={finalScore} size="lg" />
        </div>

        {implementationScoringMode === "multi" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {tiles.map((t) => (
              <div key={t.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <t.icon className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700 leading-tight">{t.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <ScoreChip score={t.score} size="sm" />
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                    W: {t.weight}
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
              {implementationScoringMode === "overall"
                ? "Overall mode: final score is derived from overall measures."
                : "Dimensions mode: score each dimension by measures; Skillfulness rolls up from its two sub-dimensions."}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4">
          <ScoreFlags
            overallScore={finalScore}
            items={[
              {
                key: "studentsEnrollment",
                label: "Students involved / enrollment",
                score: fiveDimScores.studentsEnrollmentScore,
              },
              {
                key: "feasibilitySustainability",
                label: "Perceived feasibility / sustainability",
                score: fiveDimScores.feasibilitySustainabilityScore,
              },
              {
                key: "fidelityDesignedExperience",
                label: "Fidelity to designed experience",
                score: fiveDimScores.fidelityDesignedExperienceScore,
              },
              {
                key: "skillfulnessInstructionFacilitation",
                label: "Skillfulness of instruction & Facilitation",
                score: fiveDimScores.skillfulnessInstructionFacilitationScore,
              },
              {
                key: "measurementAdministrationQuality",
                label: "Measurement administration quality",
                score: fiveDimScores.measurementAdministrationQualityScore,
              },
            ]}
            threshold={2}
            defaultOpen={false}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <RadioGroup
          value={implementationScoringMode}
          onValueChange={(v) => setImplementationScoringMode(v as any)}
          className="grid grid-cols-2 gap-3"
        >
          <label
            htmlFor="impl-mode-dimensions"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              implementationScoringMode === "multi"
                ? "border-blue-500 bg-blue-50/50"
                : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="multi" id="impl-mode-dimensions" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Dimensions</div>
              <p className="text-xs text-gray-500 mt-0.5">Score by dimensions and measures</p>
            </div>
          </label>
          <label
            htmlFor="impl-mode-overall"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
              implementationScoringMode === "overall"
                ? "border-blue-500 bg-blue-50/50"
                : "border-gray-200 hover:border-gray-300",
            )}
          >
            <RadioGroupItem value="overall" id="impl-mode-overall" className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Overall</div>
              <p className="text-xs text-gray-500 mt-0.5">Score using overall measures</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {implementationScoringMode === "overall" ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Overall Implementation Measures</h3>
          </div>
          <div className="p-4">
            <MeasureList
              measures={overallMeasures}
              onChange={setOverallMeasures}
              actors={actorOptions}
              onAddActor={addGlobalActor}
              filter={filter}
              testIdPrefix="implementation-overall"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Dimensions</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              H/M/L weights
            </Badge>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <Tabs value={activeDimTab} onValueChange={(v) => setActiveDimTab(v as ImplTab)} className="w-full">
                <TabsList className="w-full h-auto p-0 bg-transparent border-b border-gray-200 grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {tiles.map((t) => (
                    <TabsTrigger
                      key={t.key}
                      value={t.key as ImplTab}
                      className="rounded-md border border-transparent data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-none px-2 py-2 text-gray-600 hover:text-gray-800 bg-transparent flex items-start justify-between gap-2 min-h-[56px]"
                    >
                      <span className="text-left whitespace-normal leading-tight">{t.label}</span>
                      <ScoreChip score={t.score} size="sm" />
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {activeDimTab === "studentsEnrollment" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Students involved / enrollment</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension.</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker
                    value={measureBasedImplementation.weights.studentsEnrollmentWeight}
                    onChange={(v) =>
                      setMeasureBasedImplementation((p) => ({
                        ...p,
                        weights: { ...p.weights, studentsEnrollmentWeight: v },
                      }))
                    }
                  />
                </div>
                <MeasureList
                  measures={measureBasedImplementation.dimensions.studentsEnrollment.measures}
                  onChange={(next) => setNodeMeasures("studentsEnrollment", next)}
                  actors={actorOptions}
                  onAddActor={addGlobalActor}
                  filter={filter}
                  testIdPrefix="implementation-enrollment"
                />
              </div>
            ) : null}

            {activeDimTab === "feasibilitySustainability" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Perceived feasibility / sustainability</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension.</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker
                    value={measureBasedImplementation.weights.feasibilitySustainabilityWeight}
                    onChange={(v) =>
                      setMeasureBasedImplementation((p) => ({
                        ...p,
                        weights: { ...p.weights, feasibilitySustainabilityWeight: v },
                      }))
                    }
                  />
                </div>
                <MeasureList
                  measures={measureBasedImplementation.dimensions.feasibilitySustainability.measures}
                  onChange={(next) => setNodeMeasures("feasibilitySustainability", next)}
                  actors={actorOptions}
                  onAddActor={addGlobalActor}
                  filter={filter}
                  testIdPrefix="implementation-feasibility"
                />
              </div>
            ) : null}

            {activeDimTab === "fidelityDesignedExperience" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Fidelity to designed experience</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension.</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker
                    value={measureBasedImplementation.weights.fidelityDesignedExperienceWeight}
                    onChange={(v) =>
                      setMeasureBasedImplementation((p) => ({
                        ...p,
                        weights: { ...p.weights, fidelityDesignedExperienceWeight: v },
                      }))
                    }
                  />
                </div>
                <MeasureList
                  measures={measureBasedImplementation.dimensions.fidelityDesignedExperience.measures}
                  onChange={(next) => setNodeMeasures("fidelityDesignedExperience", next)}
                  actors={actorOptions}
                  onAddActor={addGlobalActor}
                  filter={filter}
                  testIdPrefix="implementation-fidelity"
                />
              </div>
            ) : null}

            {activeDimTab === "skillfulnessInstructionFacilitation" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Skillfulness of instruction & Facilitation</div>
                  <div className="text-[11px] text-gray-500">
                    This dimension has two sub-dimensions. Add measures in each section below.
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker
                    value={measureBasedImplementation.weights.skillfulnessInstructionFacilitationWeight}
                    onChange={(v) =>
                      setMeasureBasedImplementation((p) => ({
                        ...p,
                        weights: { ...p.weights, skillfulnessInstructionFacilitationWeight: v },
                      }))
                    }
                  />
                </div>
                <div className="space-y-3">
                  <Collapsible defaultOpen={false}>
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button type="button" className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/70">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">
                              Quality of classroom management, delivery, and driving to outcomes
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Measures (
                              {measureBasedImplementation.dimensions.skillfulnessInstructionFacilitation
                                .classroomManagementDeliveryOutcomes.measures.length}
                              )
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-gray-100 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] text-gray-500">Sub-dimension weight</div>
                            <WeightPicker
                              value={
                                measureBasedImplementation.dimensions.skillfulnessInstructionFacilitation.childWeights
                                  .classroomManagementDeliveryOutcomesWeight
                              }
                              onChange={(v) =>
                                setMeasureBasedImplementation((p) => ({
                                  ...p,
                                  dimensions: {
                                    ...p.dimensions,
                                    skillfulnessInstructionFacilitation: {
                                      ...p.dimensions.skillfulnessInstructionFacilitation,
                                      childWeights: {
                                        ...p.dimensions.skillfulnessInstructionFacilitation.childWeights,
                                        classroomManagementDeliveryOutcomesWeight: v,
                                      },
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <MeasureList
                            measures={
                              measureBasedImplementation.dimensions.skillfulnessInstructionFacilitation
                                .classroomManagementDeliveryOutcomes.measures
                            }
                            onChange={(next) => setSkillMeasures("classroomManagementDeliveryOutcomes", next)}
                            actors={actorOptions}
                            onAddActor={addGlobalActor}
                            filter={filter}
                            testIdPrefix="implementation-skill-management"
                          />
                        </div>
                      </CollapsibleContent>
                    </section>
                  </Collapsible>

                  <Collapsible defaultOpen={false}>
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button type="button" className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/70">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">
                              Ability to inspire, motivate, and foster appreciation and healthy engagement
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Measures (
                              {measureBasedImplementation.dimensions.skillfulnessInstructionFacilitation
                                .inspireMotivateEngagement.measures.length}
                              )
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-gray-100 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] text-gray-500">Sub-dimension weight</div>
                            <WeightPicker
                              value={
                                measureBasedImplementation.dimensions.skillfulnessInstructionFacilitation.childWeights
                                  .inspireMotivateEngagementWeight
                              }
                              onChange={(v) =>
                                setMeasureBasedImplementation((p) => ({
                                  ...p,
                                  dimensions: {
                                    ...p.dimensions,
                                    skillfulnessInstructionFacilitation: {
                                      ...p.dimensions.skillfulnessInstructionFacilitation,
                                      childWeights: {
                                        ...p.dimensions.skillfulnessInstructionFacilitation.childWeights,
                                        inspireMotivateEngagementWeight: v,
                                      },
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <MeasureList
                            measures={
                              measureBasedImplementation.dimensions.skillfulnessInstructionFacilitation
                                .inspireMotivateEngagement.measures
                            }
                            onChange={(next) => setSkillMeasures("inspireMotivateEngagement", next)}
                            actors={actorOptions}
                            onAddActor={addGlobalActor}
                            filter={filter}
                            testIdPrefix="implementation-skill-inspire"
                          />
                        </div>
                      </CollapsibleContent>
                    </section>
                  </Collapsible>
                </div>
              </div>
            ) : null}

            {activeDimTab === "measurementAdministrationQuality" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Measurement administration quality</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension.</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker
                    value={measureBasedImplementation.weights.measurementAdministrationQualityWeight}
                    onChange={(v) =>
                      setMeasureBasedImplementation((p) => ({
                        ...p,
                        weights: { ...p.weights, measurementAdministrationQualityWeight: v },
                      }))
                    }
                  />
                </div>
                <MeasureList
                  measures={measureBasedImplementation.dimensions.measurementAdministrationQuality.measures}
                  onChange={(next) => setNodeMeasures("measurementAdministrationQuality", next)}
                  actors={actorOptions}
                  onAddActor={addGlobalActor}
                  filter={filter}
                  testIdPrefix="implementation-measurement"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
