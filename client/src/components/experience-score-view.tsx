import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Plus, BarChart3, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { normActor, UNKNOWN_ACTOR_KEY } from "@shared/score-instances";
import { listSelectableYearKeys } from "@shared/marking-period";
import type { OutcomeMeasure, ScoreFilter } from "@shared/schema";
import {
  experienceHasLeapAimForTop,
  experienceHealthSubdimensions,
  experienceTagOptionsFromTops,
  experienceWeightsForComponent,
  remapExperienceSubdimensionIdsOnMeasures,
} from "@shared/experience-subdimension-tree";
import { isLeapAimActive } from "@shared/aim-selection";
import { calcFinalExperienceScore, migrateLegacyExperienceScoreData } from "@shared/experience-score-calc";
import type { ImplementationTopDimension } from "@shared/implementation-subdimension-tree";
import {
  calcImplementationTopDimensionScore,
  implementationTopDelta,
} from "@shared/implementation-score-calc";
import { collectInstanceFlagItems } from "@shared/outcome-score-calc";
import type { OutcomeSubDimL1 } from "@shared/outcome-subdimension-tree";
import ScoreFilterBar from "./score-filter-bar";
import ScoreFlags from "./score-flags";
import { useGlobalActors } from "@/lib/actors-store";
import {
  ScoreChip,
  SubDimTile,
  getFlagStatus,
  OutcomeMeasureCard,
  AddMeasurePanel,
} from "./outcome-score-view";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function createMeasure(name: string = ""): OutcomeMeasure {
  return {
    id: generateId(),
    name,
    type: "measure",
    description: "",
    appliesTo: "All students",
    priority: "M",
    importance: "M",
    confidence: "M",
    rating: null,
    instances: [],
    justification: "",
    reflectionAchievement: "",
    reflectionVariability: "",
    skipped: false,
    subDimensionIds: [],
    portedFlag: false,
    periodHistory: [],
    crossOutcome: false,
  };
}

function idsForExpTop(top: ImplementationTopDimension): Set<string> {
  return new Set([top.id]);
}

function truncateTileLabel(label: string, max = 46): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function roundFinal1to5(score: number | null): number | null {
  if (score === null) return null;
  const rounded = Math.round(score);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

interface ExperienceScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
  /** When a parent renders DrilldownNavBar, hide the duplicate “Back to Status & Health” row. */
  hideShellBackButton?: boolean;
}

export default function ExperienceScoreView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
  hideShellBackButton = false,
}: ExperienceScoreViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const { data: allComponents } = useQuery({ ...componentQueries.all, enabled: !!nodeId } as any);
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compRef = useRef(comp);
  compRef.current = comp;

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

  const [measures, setMeasures] = useState<OutcomeMeasure[]>([]);
  const [overallMeasures, setOverallMeasures] = useState<OutcomeMeasure[]>([]);
  const [subDimensionWeights, setSubDimensionWeights] = useState<Record<string, "H" | "M" | "L">>({});
  const [initialized, setInitialized] = useState(false);
  const [addOverallType, setAddOverallType] = useState<"measure" | "perception" | null>(null);
  const [addSubdimType, setAddSubdimType] = useState<"measure" | "perception" | null>(null);
  const [filterTopId, setFilterTopId] = useState<string | null>(null);

  const leapAims = useMemo(() => {
    const de: any = comp?.designedExperienceData || {};
    const kde = de.keyDesignElements || {};
    const aims: any[] = kde.aims || [];
    return aims.filter((a: any) => a?.type === "leap" && typeof a?.label === "string" && isLeapAimActive(a));
  }, [comp]);

  const experienceTops = useMemo(
    () => experienceHealthSubdimensions((allComponents as any[]) || []),
    [allComponents],
  );

  const EXPERIENCE_TREE_AS_OUTCOME = experienceTops as unknown as OutcomeSubDimL1[];

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

  useEffect(() => {
    setInitialized(false);
  }, [nodeId]);

  useEffect(() => {
    if (!comp || initialized || allComponents === undefined) return;
    const hd: any = comp.healthData || {};
    const esd: any = hd.experienceScoreData || {};
    setActors(Array.isArray(esd.actors) ? esd.actors : []);
    const saved: any = esd.filter || {};
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

    const topsAtInit = experienceHealthSubdimensions(allComponents as any[]);
    const migrated = migrateLegacyExperienceScoreData(esd, leapAims);
    const remapped = remapExperienceSubdimensionIdsOnMeasures(migrated.measures, comp);
    setMeasures(remapped);
    setOverallMeasures(migrated.overallMeasures);
    const deW = experienceWeightsForComponent(comp, topsAtInit);
    setSubDimensionWeights({
      ...deW,
      ...migrated.subDimensionWeights,
      ...(typeof esd.subDimensionWeights === "object" ? esd.subDimensionWeights : {}),
    });
    setInitialized(true);
  }, [comp, initialized, leapAims, setFilter, allComponents]);

  useEffect(() => {
    if (!initialized || !comp) return;
    const deW = experienceWeightsForComponent(comp, experienceTops);
    setSubDimensionWeights((prev) => {
      const next = { ...prev };
      for (const top of experienceTops) {
        if (experienceHasLeapAimForTop(comp, top.id)) next[top.id] = deW[top.id];
        else if (next[top.id] === undefined) next[top.id] = "M";
      }
      for (const id of Object.keys(next)) {
        if (!experienceTops.some((t) => t.id === id)) delete next[id];
      }
      return next;
    });
  }, [comp, experienceTops, initialized]);

  const finalScore = useMemo(() => {
    const raw = calcFinalExperienceScore(measures, overallMeasures, subDimensionWeights, filter, experienceTops);
    return roundFinal1to5(raw);
  }, [measures, overallMeasures, subDimensionWeights, filter, experienceTops]);

  const doSave = useCallback(() => {
    const nid = nodeId;
    if (!nid) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
           const existing: any = compRef.current?.healthData || {};
      updateMutation.mutate({
        nodeId: nid,
        data: {
          healthData: {
            ...existing,
            experienceScoreData: {
              scoringMode: "dimensions",
              actors,
              filter,
              subDimensionWeights,
              measures,
              overallMeasures,
              finalExperienceScore: finalScore,
            },
          },
        },
      });
    }, 800);
  }, [nodeId, actors, filter, measures, overallMeasures, subDimensionWeights, finalScore, updateMutation]);

  useEffect(() => {
    if (initialized) doSave();
  }, [initialized, doSave]);

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
    const scanInsts = (insts: unknown) => {
      for (const i of Array.isArray(insts) ? insts : []) add((i as any)?.actor);
    };
    const scanMs = (ms: unknown) => {
      for (const m of Array.isArray(ms) ? ms : []) scanInsts((m as any)?.instances);
    };
    scanMs(measures);
    scanMs(overallMeasures);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [actors, globalActors, measures, overallMeasures]);

  const allTagOptions = useMemo(() => experienceTagOptionsFromTops(experienceTops), [experienceTops]);

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

  const handleMeasureUpdate = useCallback((m: OutcomeMeasure) => {
    const shouldBeOverall = !(m.subDimensionIds?.length) || !!(m as any).crossOutcome;
    if (shouldBeOverall) {
      setMeasures((prev) => prev.filter((x) => x.id !== m.id));
      setOverallMeasures((prev) =>
        prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m],
      );
    } else {
      setOverallMeasures((prev) => prev.filter((x) => x.id !== m.id));
      setMeasures((prev) =>
        prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m],
      );
    }
  }, []);

  const handleWeightChange = useCallback((id: string, w: "H" | "M" | "L") => {
    setSubDimensionWeights((prev) => ({ ...prev, [id]: w }));
  }, []);

  const filteredSubdimMeasures = useMemo(() => {
    const subdimOnly = measures.filter((m) => !(m as any).crossOutcome);
    if (!filterTopId) return subdimOnly;
    const top = experienceTops.find((t) => t.id === filterTopId);
    if (!top) return subdimOnly;
    const allowed = idsForExpTop(top);
    return subdimOnly.filter((m) => (m.subDimensionIds || []).some((id) => allowed.has(id)));
  }, [measures, filterTopId, experienceTops]);

  const topRows = useMemo(() => {
    return experienceTops.map((top) => {
      const idSet = idsForExpTop(top);
      const tagged = measures.filter(
        (m) => !(m as any).crossOutcome && (m.subDimensionIds || []).some((id) => idSet.has(id)),
      );
      const flagItems = collectInstanceFlagItems(tagged, filter);
      return {
        ...top,
        score: calcImplementationTopDimensionScore(top, measures, overallMeasures, subDimensionWeights, filter),
        delta: implementationTopDelta(top, measures, overallMeasures, subDimensionWeights, filter),
        measureCount: tagged.length,
        weight: subDimensionWeights[top.id] || "M",
        flagItems,
      };
    });
  }, [experienceTops, measures, overallMeasures, subDimensionWeights, filter]);

  const allFlagItems = collectInstanceFlagItems([...measures, ...overallMeasures], filter);
  const overallFlagStatus = getFlagStatus(allFlagItems, finalScore);
  const totalMeasures = measures.length + overallMeasures.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {!hideShellBackButton ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
          data-testid="button-back-to-health"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Status &amp; Health
        </button>
      ) : null}

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="experience-filter-bar" />

      <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
        The six core leaps always appear below. Custom design principles added anywhere in the school show as extra
        subdimensions. Select a leap or principle for this component in Designed Experience → Manage leaps to set
        priority (H/M/L); you can leave rows unscored if they do not apply.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="experience-score-dashboard">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-gray-900">Experience Score</h2>
              <p className="text-sm text-gray-500">{title}</p>
            </div>
            <div className="text-right space-y-1">
              <div
                className={cn("inline-block rounded-xl p-0.5", {
                  "ring-2 ring-red-400": overallFlagStatus === "concern",
                  "ring-2 ring-emerald-400": overallFlagStatus === "excellence",
                })}
                style={
                  overallFlagStatus === "both"
                    ? {
                        padding: "3px",
                        borderRadius: "0.75rem",
                        background:
                          "repeating-linear-gradient(135deg, #ef4444 0px, #ef4444 6px, #10b981 6px, #10b981 12px)",
                      }
                    : {}
                }
              >
                <div className={overallFlagStatus === "both" ? "rounded-[9px] overflow-hidden" : ""}>
                  <ScoreChip score={finalScore} size="lg" />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Experience Score</p>
            </div>
          </div>

          {topRows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {topRows.map((row) => (
                <SubDimTile
                  key={row.id}
                  label={truncateTileLabel(row.label)}
                  fullLabel={row.label}
                  score={row.score}
                  weight={row.weight}
                  measureCount={row.measureCount}
                  delta={row.delta}
                  active={filterTopId === row.id}
                  onClick={() => setFilterTopId((prev) => (prev === row.id ? null : row.id))}
                  onWeightChange={(w) => handleWeightChange(row.id, w)}
                  flagStatus={getFlagStatus(row.flagItems, finalScore)}
                />
              ))}
            </div>
          )}

          <ScoreFlags
              overallScore={finalScore}
              items={collectInstanceFlagItems(
                filterTopId
                  ? measures.filter((m) => {
                      const top = experienceTops.find((t) => t.id === filterTopId);
                      if (!top) return false;
                      const allowed = idsForExpTop(top);
                      return (m.subDimensionIds || []).some((id) => allowed.has(id));
                    })
                  : [...measures, ...overallMeasures],
                filter,
              )}
              threshold={1}
              defaultOpen={false}
              testId="experience-l1-flags"
            />
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{totalMeasures} total measures</span>
          <span className="text-[10px] text-gray-400">Sub-dimension &amp; measure weight: L=1, M=3, H=5</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Overall experience measures
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {overallMeasures.length} measure{overallMeasures.length !== 1 ? "s" : ""}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Measure
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setAddOverallType("measure")}>From Scratch</DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400">
                  Pull from a Component <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {addOverallType !== null && (
          <AddMeasurePanel
            l2Options={EXPERIENCE_TREE_AS_OUTCOME}
            measureType={addOverallType}
            panelVariant="design"
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
            {filter.mode !== "none"
              ? "No overall measures for this period."
              : "Add overall experience measures to contribute alongside sub-dimension scores."}
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
              allL2s={allTagOptions}
              subDimensionWeights={subDimensionWeights}
              measureScoringMode="design"
              dimensionTagTree={EXPERIENCE_TREE_AS_OUTCOME}
            />
          ))
        )}
      </div>

      {experienceTops.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Subdimension measures
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {filteredSubdimMeasures.length} measure{filteredSubdimMeasures.length !== 1 ? "s" : ""}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Measure
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setAddSubdimType("measure")}>From Scratch</DropdownMenuItem>
                  <DropdownMenuItem disabled className="text-gray-400">
                    Pull from a Component <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {addSubdimType !== null && (
            <AddMeasurePanel
              l2Options={EXPERIENCE_TREE_AS_OUTCOME}
              measureType={addSubdimType}
              panelVariant="design"
              defaultL2Ids={filterTopId ? [filterTopId] : undefined}
              onAdd={(m) => {
                const isOverall = !m.subDimensionIds || m.subDimensionIds.length === 0;
                if (isOverall) addOverallMeasure(m);
                else addMeasure(m);
                setAddSubdimType(null);
              }}
              onCancel={() => setAddSubdimType(null)}
            />
          )}

          {filterTopId && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Filtering by</span>
              <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
                {topRows.find((r) => r.id === filterTopId)?.label || filterTopId}
              </Badge>
              <button
                type="button"
                className="text-[10px] text-gray-400 hover:text-gray-700 underline"
                onClick={() => setFilterTopId(null)}
              >
                Clear
              </button>
            </div>
          )}

          {filteredSubdimMeasures.length === 0 && addSubdimType === null ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {filterTopId ? "No measures tagged to this dimension." : "No subdimension measures yet."}
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
                allL2s={allTagOptions}
                subDimensionWeights={subDimensionWeights}
                measureScoringMode="design"
                dimensionTagTree={EXPERIENCE_TREE_AS_OUTCOME}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
