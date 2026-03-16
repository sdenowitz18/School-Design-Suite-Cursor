import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Info, Layers, Package, Target, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { calculateRingDesignMeasureDimensionScores, calculateRingDesignScore } from "@shared/ring-design-score";
import type { Measure, RingDesignMeasureBased, RingDesignScoreData, ScoreFilter, ScoreInstance } from "@shared/schema";
import { listSelectableQuarterKeys, listSelectableSemesterKeys, listSelectableYearKeys } from "@shared/marking-period";
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
type DesignTab = "aims" | "completenessDesignedExperience" | "qualityCompletenessSrr" | "coherenceDesignedExperience" | "alignmentDesignedExperience";

function normalizeWeightLabel(value: unknown): WeightLabel {
  if (value === "H" || value === "M" || value === "L") return value;
  return "M";
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

function formatMarkingPeriodSummary(measure: Measure): string {
  const mp: any = (measure as any)?.markingPeriod;
  if (!mp) return "No period";
  const mode = String(mp?.mode || "year");
  if (mode === "semester") return String(mp?.semesterKey || "Semester");
  if (mode === "quarter") return String(mp?.quarterKey || "Quarter");
  return String(mp?.yearKey || "Year");
}

function defaultMeasureBasedDesign(): RingDesignMeasureBased {
  return {
    dimensions: {
      aims: { measures: [] },
      completenessDesignedExperience: { measures: [] },
      qualityCompletenessSrr: { measures: [] },
      coherenceDesignedExperience: {
        qualityOfMaterials: { measures: [] },
        qualityOfMaterialsCompilation: { measures: [] },
        childWeights: { qualityOfMaterialsWeight: "M", qualityOfMaterialsCompilationWeight: "M" },
      },
      alignmentDesignedExperience: { measures: [] },
    },
    weights: {
      aimsWeight: "M",
      completenessDesignedExperienceWeight: "M",
      qualityCompletenessSrrWeight: "M",
      coherenceDesignedExperienceWeight: "M",
      alignmentDesignedExperienceWeight: "M",
    },
  };
}

function ScoreChip({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  if (score === null) return <div className={cn("flex items-center justify-center rounded-md bg-gray-100 text-gray-400 font-bold border border-gray-200", size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-16 h-12 text-2xl" : "w-10 h-10 text-lg")}>—</div>;
  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  const color = rounded >= 4 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : rounded >= 3 ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-red-100 text-red-700 border-red-200";
  return <div className={cn("flex items-center justify-center rounded-md font-bold border", color, size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-16 h-12 text-2xl" : "w-10 h-10 text-lg")} data-testid="score-chip">{rounded}</div>;
}

function WeightPicker({ value, onChange }: { value: WeightLabel; onChange: (v: WeightLabel) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-gray-50">
      {(["L", "M", "H"] as const).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={cn("px-2.5 py-1 text-[11px] font-bold transition-colors", value === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800", k !== "L" && "border-l border-gray-200")}>
          {k}
        </button>
      ))}
    </div>
  );
}

function MeasureList({
  title,
  measures,
  onChange,
  actors,
  onAddActor,
  filter,
  testIdPrefix,
  showTitle = true,
  emptyStateText = "No measures yet. Add a measure to start scoring.",
}: {
  title: string;
  measures: Measure[];
  onChange: (next: Measure[]) => void;
  actors: string[];
  onAddActor: (label: string) => void;
  filter: ScoreFilter;
  testIdPrefix: string;
  showTitle?: boolean;
  emptyStateText?: string;
}) {
  const [newName, setNewName] = useState("");
  const yearKeys = listSelectableYearKeys(new Date(), 5);
  const semesterKeys = listSelectableSemesterKeys(new Date(), 5);
  const quarterKeys = listSelectableQuarterKeys(new Date(), 5);

  return (
    <div className="space-y-2">
      {showTitle ? <div className="text-xs font-semibold text-gray-700">{title}</div> : null}
      <div className="flex items-center gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.currentTarget.value)} placeholder="Add a measure" className="h-8 text-sm" />
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
      {measures.length === 0 ? <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">{emptyStateText}</div> : null}
      {measures.map((m) => {
        const score = effectiveFromInstances((m.instances || []) as any, filter).score;
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
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">Score {score ?? "—"}</Badge>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => onChange(measures.filter((x) => x.id !== m.id))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  <Input value={m.name} onChange={(e) => onChange(measures.map((x) => (x.id === m.id ? { ...x, name: e.currentTarget.value } : x)))} placeholder="Measure name" className="h-8 text-xs" />
                  <Textarea value={m.rationale || ""} onChange={(e) => onChange(measures.map((x) => (x.id === m.id ? { ...x, rationale: e.currentTarget.value } : x)))} placeholder="Lightweight description" className="text-xs min-h-[56px]" />
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
                      <select className="h-8 rounded-md border border-gray-200 px-2 text-xs" value={(m as any)?.markingPeriod?.yearKey || yearKeys[0]} onChange={(e) => onChange(measures.map((x) => (x.id === m.id ? ({ ...x, markingPeriod: { ...(x as any).markingPeriod, mode: "year", yearKey: e.currentTarget.value } } as any) : x)))}>
                        {yearKeys.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    ) : markingMode === "semester" ? (
                      <select className="h-8 rounded-md border border-gray-200 px-2 text-xs" value={(m as any)?.markingPeriod?.semesterKey || semesterKeys[0]} onChange={(e) => onChange(measures.map((x) => (x.id === m.id ? ({ ...x, markingPeriod: { ...(x as any).markingPeriod, mode: "semester", semesterKey: e.currentTarget.value } } as any) : x)))}>
                        {semesterKeys.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    ) : (
                      <select className="h-8 rounded-md border border-gray-200 px-2 text-xs" value={(m as any)?.markingPeriod?.quarterKey || quarterKeys[0]} onChange={(e) => onChange(measures.map((x) => (x.id === m.id ? ({ ...x, markingPeriod: { ...(x as any).markingPeriod, mode: "quarter", quarterKey: e.currentTarget.value } } as any) : x)))}>
                        {quarterKeys.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <ScoreInstancesInlineEditor instances={(m.instances || []) as any} onChange={(next) => onChange(measures.map((x) => (x.id === m.id ? { ...x, instances: next as any } : x)))} actors={actors} onAddActor={onAddActor} testIdPrefix={`${testIdPrefix}-${m.id}`} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
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
  const [activeDimTab, setActiveDimTab] = useState<DesignTab>("aims");
  const [localFilter, setLocalFilter] = useState<ScoreFilter>({ mode: "year", yearKey: listSelectableYearKeys(new Date(), 5)[0], aggregation: "singleLatest" } as any);
  const filter = sourceFilter || localFilter;
  const [overallInstances, setOverallInstances] = useState<ScoreInstance[]>([]);
  const [overallMeasures, setOverallMeasures] = useState<Measure[]>([]);
  const [measureBasedDesign, setMeasureBasedDesign] = useState<RingDesignMeasureBased>(defaultMeasureBasedDesign());
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
    const rsd: any = (comp as any)?.healthData?.ringDesignScoreData || {};
    setDesignScoringMode((rsd?.designScoringMode as any) || "overall");
    setLocalFilter((sourceFilter as any) || (rsd?.filter as any) || localFilter);
    setOverallInstances(Array.isArray(rsd?.overallInstances) ? rsd.overallInstances : []);
    setOverallMeasures(Array.isArray(rsd?.overallMeasures) ? rsd.overallMeasures : []);
    setMeasureBasedDesign(rsd?.measureBasedDesign ? (rsd.measureBasedDesign as RingDesignMeasureBased) : defaultMeasureBasedDesign());
    setInitialized(true);
  }, [comp, initialized, localFilter, sourceFilter]);

  const allMeasures = useMemo(() => {
    const d: any = measureBasedDesign?.dimensions || {};
    return [
      ...(d?.aims?.measures || []),
      ...(d?.completenessDesignedExperience?.measures || []),
      ...(d?.qualityCompletenessSrr?.measures || []),
      ...(d?.alignmentDesignedExperience?.measures || []),
      ...(d?.coherenceDesignedExperience?.qualityOfMaterials?.measures || []),
      ...(d?.coherenceDesignedExperience?.qualityOfMaterialsCompilation?.measures || []),
    ] as Measure[];
  }, [measureBasedDesign]);

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
    for (const inst of overallInstances || []) add((inst as any)?.actor);
    for (const m of overallMeasures) for (const inst of (m.instances || [])) add((inst as any)?.actor);
    for (const m of allMeasures) for (const inst of (m.instances || [])) add((inst as any)?.actor);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [allMeasures, globalActors, overallInstances, overallMeasures]);

  useEffect(() => {
    if (actorOptions.length > 0) mergeGlobalActors(actorOptions);
  }, [actorOptions, mergeGlobalActors]);

  const rsdForCalc = useMemo(() => {
    return {
      designScoringMode,
      actors: actorOptions,
      filter,
      measureBasedDesign,
      overallInstances,
      overallMeasures,
      overallDesignScore: null,
      overallDesignConfidence: "M",
      overallDesignRationale: "",
      designDimensions: { aimsScore: null, experienceScore: null, resourcesScore: null },
      designWeights: { aimsWeight: "M", experienceWeight: "M", resourcesWeight: "M" },
      subDimensions: {
        aims: { leapsScore: null, outcomesScore: null },
        studentExperience: { thoroughnessScore: null, leapinessScore: null, coherenceScore: null },
        supportingResources: { thoroughnessScore: null, qualityScore: null, coherenceScore: null },
      },
      finalDesignScore: null,
    } as RingDesignScoreData;
  }, [actorOptions, designScoringMode, filter, measureBasedDesign, overallInstances, overallMeasures]);

  const fiveDimScores = useMemo(() => calculateRingDesignMeasureDimensionScores(rsdForCalc), [rsdForCalc]);
  const finalScore = useMemo(() => calculateRingDesignScore({ healthData: { ringDesignScoreData: rsdForCalc } }), [rsdForCalc]);

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
            ringDesignScoreData: {
              ...(existing?.ringDesignScoreData || {}),
              designScoringMode,
              actors: actorOptions,
              filter,
              measureBasedDesign,
              overallInstances,
              overallMeasures,
              finalDesignScore: finalScore,
            },
          },
        },
      });
    }, 450);
  }, [actorOptions, comp, designScoringMode, filter, finalScore, initialized, measureBasedDesign, nodeId, overallInstances, overallMeasures, updateMutation]);

  const setNodeMeasures = (key: "aims" | "completenessDesignedExperience" | "qualityCompletenessSrr" | "alignmentDesignedExperience", next: Measure[]) =>
    setMeasureBasedDesign((prev) => ({ ...prev, dimensions: { ...prev.dimensions, [key]: { ...(prev.dimensions as any)[key], measures: next } } }));

  const setCoherenceMeasures = (key: "qualityOfMaterials" | "qualityOfMaterialsCompilation", next: Measure[]) =>
    setMeasureBasedDesign((prev) => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        coherenceDesignedExperience: {
          ...prev.dimensions.coherenceDesignedExperience,
          [key]: {
            ...(prev.dimensions.coherenceDesignedExperience as any)[key],
            measures: next,
          },
        },
      },
    }));

  const tiles = [
    { key: "aims", label: "Richness/Robustness of Aims", score: fiveDimScores.aimsScore, icon: Target, weight: measureBasedDesign.weights.aimsWeight },
    { key: "completenessDesignedExperience", label: "Completeness of designed experience", score: fiveDimScores.completenessDesignedExperienceScore, icon: Layers, weight: measureBasedDesign.weights.completenessDesignedExperienceWeight },
    { key: "qualityCompletenessSrr", label: "Quality & Completeness of SRR", score: fiveDimScores.qualityCompletenessSrrScore, icon: Package, weight: measureBasedDesign.weights.qualityCompletenessSrrWeight },
    { key: "coherenceDesignedExperience", label: "Coherence in the design experience", score: fiveDimScores.coherenceDesignedExperienceScore, icon: Layers, weight: measureBasedDesign.weights.coherenceDesignedExperienceWeight },
    { key: "alignmentDesignedExperience", label: "Alignment of the designed experience", score: fiveDimScores.alignmentDesignedExperienceScore, icon: Package, weight: measureBasedDesign.weights.alignmentDesignedExperienceWeight },
  ] as const;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="ring-design-score-view">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group" data-testid="button-back-design-score">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status &amp; Health
      </button>

      <ScoreFilterBar filter={filter as any} onChange={setFilter as any} actors={actorOptions} />

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Design Score</h2>
            {(title || (comp as any)?.title) && <p className="text-sm text-gray-500 mt-0.5">{title || (comp as any)?.title}</p>}
          </div>
          <ScoreChip score={finalScore} size="lg" />
        </div>

        {designScoringMode === "multi" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4" data-testid="dimension-tiles">
            {tiles.map((t) => (
              <div key={t.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <t.icon className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700 leading-tight">{t.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <ScoreChip score={t.score} size="sm" />
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">W: {t.weight}</Badge>
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
                ? "Overall mode: Final score is derived from overall instances."
                : "Dimensions mode: score each dimension by measures; Coherence rolls up from its two subdimensions. Instances are nested inside measures."}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4">
          <ScoreFlags
            overallScore={finalScore}
            items={[
              { key: "aims", label: "Richness/Robustness of Aims", score: fiveDimScores.aimsScore },
              { key: "completeness", label: "Completeness of designed experience", score: fiveDimScores.completenessDesignedExperienceScore },
              { key: "srr", label: "Quality & Completeness of SRR", score: fiveDimScores.qualityCompletenessSrrScore },
              { key: "coherence", label: "Coherence in the design experience", score: fiveDimScores.coherenceDesignedExperienceScore },
              { key: "alignment", label: "Alignment of the designed experience", score: fiveDimScores.alignmentDesignedExperienceScore },
            ]}
            threshold={2}
            defaultOpen={false}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <RadioGroup value={designScoringMode} onValueChange={(v) => setDesignScoringMode(v as any)} className="grid grid-cols-2 gap-3">
          <label htmlFor="design-mode-dimensions" className={cn("flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all", designScoringMode === "multi" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300")}>
            <RadioGroupItem value="multi" id="design-mode-dimensions" className="mt-0.5" />
            <div><div className="text-sm font-semibold text-gray-900">Dimensions</div><p className="text-xs text-gray-500 mt-0.5">Score by dimensions and measures</p></div>
          </label>
          <label htmlFor="design-mode-overall" className={cn("flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all", designScoringMode === "overall" ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300")}>
            <RadioGroupItem value="overall" id="design-mode-overall" className="mt-0.5" />
            <div><div className="text-sm font-semibold text-gray-900">Overall</div><p className="text-xs text-gray-500 mt-0.5">Single overall stream</p></div>
          </label>
        </RadioGroup>
      </div>

      {designScoringMode === "overall" ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">Overall Design Measures</h3></div>
          <div className="p-4">
            <MeasureList
              title="Overall measures"
              measures={overallMeasures}
              onChange={setOverallMeasures}
              actors={actorOptions}
              onAddActor={addGlobalActor}
              filter={filter}
              testIdPrefix="design-overall"
            />
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="design-dimensions-section">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Dimensions</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">H/M/L weights</Badge>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <Tabs value={activeDimTab} onValueChange={(v) => setActiveDimTab(v as DesignTab)} className="w-full">
                <TabsList className="w-full h-auto p-0 bg-transparent border-b border-gray-200 grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {tiles.map((t) => (
                    <TabsTrigger
                      key={t.key}
                      value={t.key as DesignTab}
                      className="rounded-md border border-transparent data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 data-[state=active]:shadow-none px-2 py-2 text-gray-600 hover:text-gray-800 bg-transparent flex items-start justify-between gap-2 min-h-[56px]"
                    >
                      <span className="text-left whitespace-normal leading-tight">{t.label}</span>
                      <ScoreChip score={t.score} size="sm" />
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {activeDimTab === "aims" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Richness/Robustness of Aims</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension (no sub-dimensions).</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker value={measureBasedDesign.weights.aimsWeight} onChange={(v) => setMeasureBasedDesign((p) => ({ ...p, weights: { ...p.weights, aimsWeight: v } }))} />
                </div>
                <MeasureList title="Measures" showTitle={false} measures={measureBasedDesign.dimensions.aims.measures} onChange={(next) => setNodeMeasures("aims", next)} actors={actorOptions} onAddActor={addGlobalActor} filter={filter} testIdPrefix="design-aims" />
              </div>
            ) : null}

            {activeDimTab === "completenessDesignedExperience" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Completeness of designed experience</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension (no sub-dimensions).</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker value={measureBasedDesign.weights.completenessDesignedExperienceWeight} onChange={(v) => setMeasureBasedDesign((p) => ({ ...p, weights: { ...p.weights, completenessDesignedExperienceWeight: v } }))} />
                </div>
                <MeasureList title="Measures" showTitle={false} measures={measureBasedDesign.dimensions.completenessDesignedExperience.measures} onChange={(next) => setNodeMeasures("completenessDesignedExperience", next)} actors={actorOptions} onAddActor={addGlobalActor} filter={filter} testIdPrefix="design-completeness" />
              </div>
            ) : null}

            {activeDimTab === "qualityCompletenessSrr" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Quality & Completeness of SRR</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension (no sub-dimensions).</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker value={measureBasedDesign.weights.qualityCompletenessSrrWeight} onChange={(v) => setMeasureBasedDesign((p) => ({ ...p, weights: { ...p.weights, qualityCompletenessSrrWeight: v } }))} />
                </div>
                <MeasureList title="Measures" showTitle={false} measures={measureBasedDesign.dimensions.qualityCompletenessSrr.measures} onChange={(next) => setNodeMeasures("qualityCompletenessSrr", next)} actors={actorOptions} onAddActor={addGlobalActor} filter={filter} testIdPrefix="design-srr" />
              </div>
            ) : null}

            {activeDimTab === "coherenceDesignedExperience" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Coherence in the design experience</div>
                  <div className="text-[11px] text-gray-500">This dimension has two sub-dimensions. Add measures inside each section below.</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker value={measureBasedDesign.weights.coherenceDesignedExperienceWeight} onChange={(v) => setMeasureBasedDesign((p) => ({ ...p, weights: { ...p.weights, coherenceDesignedExperienceWeight: v } }))} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className="rounded-xl border-2 border-gray-200 bg-gray-50/60 p-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-800">Quality of Materials</div>
                        <WeightPicker value={measureBasedDesign.dimensions.coherenceDesignedExperience.childWeights.qualityOfMaterialsWeight} onChange={(v) => setMeasureBasedDesign((p) => ({ ...p, dimensions: { ...p.dimensions, coherenceDesignedExperience: { ...p.dimensions.coherenceDesignedExperience, childWeights: { ...p.dimensions.coherenceDesignedExperience.childWeights, qualityOfMaterialsWeight: v } } } }))} />
                      </div>
                      <div className="text-[11px] text-gray-500">Measures entered here only affect this sub-dimension.</div>
                    </div>
                    <MeasureList title="Measures" showTitle={false} measures={measureBasedDesign.dimensions.coherenceDesignedExperience.qualityOfMaterials.measures} onChange={(next) => setCoherenceMeasures("qualityOfMaterials", next)} actors={actorOptions} onAddActor={addGlobalActor} filter={filter} testIdPrefix="design-coherence-materials" />
                  </section>
                  <section className="rounded-xl border-2 border-gray-200 bg-gray-50/60 p-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-800">Quality of Materials Compilation</div>
                        <WeightPicker value={measureBasedDesign.dimensions.coherenceDesignedExperience.childWeights.qualityOfMaterialsCompilationWeight} onChange={(v) => setMeasureBasedDesign((p) => ({ ...p, dimensions: { ...p.dimensions, coherenceDesignedExperience: { ...p.dimensions.coherenceDesignedExperience, childWeights: { ...p.dimensions.coherenceDesignedExperience.childWeights, qualityOfMaterialsCompilationWeight: v } } } }))} />
                      </div>
                      <div className="text-[11px] text-gray-500">Measures entered here only affect this sub-dimension.</div>
                    </div>
                    <MeasureList title="Measures" showTitle={false} measures={measureBasedDesign.dimensions.coherenceDesignedExperience.qualityOfMaterialsCompilation.measures} onChange={(next) => setCoherenceMeasures("qualityOfMaterialsCompilation", next)} actors={actorOptions} onAddActor={addGlobalActor} filter={filter} testIdPrefix="design-coherence-compilation" />
                  </section>
                </div>
              </div>
            ) : null}

            {activeDimTab === "alignmentDesignedExperience" ? (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-800">Alignment of the designed experience</div>
                  <div className="text-[11px] text-gray-500">Use measures directly in this dimension (no sub-dimensions).</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">Dimension weight</div>
                  <WeightPicker value={measureBasedDesign.weights.alignmentDesignedExperienceWeight} onChange={(v) => setMeasureBasedDesign((p) => ({ ...p, weights: { ...p.weights, alignmentDesignedExperienceWeight: v } }))} />
                </div>
                <MeasureList title="Measures" showTitle={false} measures={measureBasedDesign.dimensions.alignmentDesignedExperience.measures} onChange={(next) => setNodeMeasures("alignmentDesignedExperience", next)} actors={actorOptions} onAddActor={addGlobalActor} filter={filter} testIdPrefix="design-alignment" />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

