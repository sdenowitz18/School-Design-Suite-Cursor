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
import type { DesignScoreData, OutcomeMeasure, ScoreFilter } from "@shared/schema";
import {
  DESIGN_SUBDIMENSION_TREE,
  allDesignWeightedIds,
  allDesignTagOptions,
} from "@shared/design-subdimension-tree";
import type { ImplementationTopDimension } from "@shared/implementation-subdimension-tree";
import {
  calcFinalDesignScore,
  calcDesignDimensionScore,
  designTopDelta,
} from "@shared/design-score-calc";
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

const DESIGN_TREE_AS_OUTCOME = DESIGN_SUBDIMENSION_TREE as unknown as OutcomeSubDimL1[];

function defaultDesignWeights(): Record<string, "H" | "M" | "L"> {
  const o: Record<string, "H" | "M" | "L"> = {};
  for (const id of allDesignWeightedIds()) o[id] = "M";
  return o;
}

function idsForDesignTop(top: ImplementationTopDimension): Set<string> {
  const s = new Set<string>([top.id]);
  for (const c of top.children) s.add(c.id);
  return s;
}

function truncateTileLabel(label: string, max = 46): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

interface DesignScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
  hideShellBackButton?: boolean;
}

export default function DesignScoreView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
  hideShellBackButton = false,
}: DesignScoreViewProps) {
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
  const [subDimensionWeights, setSubDimensionWeights] = useState<Record<string, "H" | "M" | "L">>(defaultDesignWeights);
  const [initialized, setInitialized] = useState(false);
  const [addOverallType, setAddOverallType] = useState<"measure" | "perception" | null>(null);
  const [addSubdimType, setAddSubdimType] = useState<"measure" | "perception" | null>(null);
  const [filterTopId, setFilterTopId] = useState<string | null>(null);

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
    if (comp && !initialized) {
      const hd: any = comp.healthData || {};
      const dsd: Partial<DesignScoreData> = hd.designScoreData || {};
      setActors(Array.isArray(dsd.actors) ? (dsd.actors as string[]) : []);
      const saved: any = dsd.filter || {};
      setFilter(
        saved?.mode
          ? (saved as any)
          : ({ mode: "year", yearKey: listSelectableYearKeys(new Date(), 5)[0] } as any),
      );
      const valid = new Set(allDesignWeightedIds());
      const rawMeasures = Array.isArray(dsd.measures) ? (dsd.measures as OutcomeMeasure[]) : [];
      setMeasures(
        rawMeasures.filter((m) => {
          const ids = m.subDimensionIds || [];
          return ids.length === 0 || ids.some((id) => valid.has(id));
        }),
      );
      setOverallMeasures(Array.isArray(dsd.overallMeasures) ? (dsd.overallMeasures as OutcomeMeasure[]) : []);
      const merged = {
        ...defaultDesignWeights(),
        ...(dsd.subDimensionWeights && typeof dsd.subDimensionWeights === "object" ? (dsd.subDimensionWeights as any) : {}),
      };
      setSubDimensionWeights(merged);
      setInitialized(true);
    }
  }, [comp, initialized, setFilter]);

  const finalScore = useMemo(
    () => calcFinalDesignScore(measures, overallMeasures, subDimensionWeights, filter),
    [measures, overallMeasures, subDimensionWeights, filter],
  );

  const doSave = useCallback(() => {
    const nid = nodeId;
    if (!nid) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const existing: any = compRef.current?.healthData || {};
      const existingDsd: any = existing.designScoreData || {};
      updateMutation.mutate({
        nodeId: nid,
        data: {
          healthData: {
            ...existing,
            designScoreData: {
              ...existingDsd,
              actors,
              filter,
              measures,
              overallMeasures,
              subDimensionWeights,
              finalDesignScore: finalScore,
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
    const scanInsts = (insts: unknown) => { for (const i of Array.isArray(insts) ? insts : []) add((i as any)?.actor); };
    const scanMs = (ms: unknown) => { for (const m of Array.isArray(ms) ? ms : []) scanInsts((m as any)?.instances); };
    scanMs(measures);
    scanMs(overallMeasures);
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [actors, globalActors, measures, overallMeasures]);

  const allTagOptions = useMemo(() => allDesignTagOptions(), []);

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
    const subdimOnly = measures.filter((m) => !(m as any).crossOutcome);
    if (!filterTopId) return subdimOnly;
    const top = DESIGN_SUBDIMENSION_TREE.find((t) => t.id === filterTopId);
    if (!top) return subdimOnly;
    const allowed = idsForDesignTop(top as ImplementationTopDimension);
    return subdimOnly.filter((m) => (m.subDimensionIds || []).some((id) => allowed.has(id)));
  }, [measures, filterTopId]);

  const topRows = DESIGN_SUBDIMENSION_TREE.map((top) => {
    const idSet = idsForDesignTop(top as ImplementationTopDimension);
    const tagged = measures.filter(
      (m) => !(m as any).crossOutcome && (m.subDimensionIds || []).some((id) => idSet.has(id)),
    );
    const flagItems = collectInstanceFlagItems(tagged, filter);
    return {
      ...top,
      score: calcDesignDimensionScore(top as ImplementationTopDimension, measures, overallMeasures, subDimensionWeights, filter),
      delta: designTopDelta(top as ImplementationTopDimension, measures, overallMeasures, subDimensionWeights, filter),
      measureCount: tagged.length,
      weight: subDimensionWeights[top.id] || "M",
      flagItems,
    };
  });

  const allFlagItems = collectInstanceFlagItems([...measures, ...overallMeasures], filter);
  const overallFlagStatus = getFlagStatus(allFlagItems, finalScore);

  const totalMeasures = measures.length + overallMeasures.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {!hideShellBackButton ? (
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group" data-testid="button-back-to-health">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Status & Health
        </button>
      ) : null}

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="design-filter-bar" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="design-score-dashboard">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-gray-900">Design Score</h2>
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
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Design Score</p>
            </div>
          </div>

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

          {(() => {
            const flagMeasures = filterTopId
              ? measures.filter((m) => {
                  const top = DESIGN_SUBDIMENSION_TREE.find((t) => t.id === filterTopId);
                  if (!top) return false;
                  const allowed = idsForDesignTop(top as ImplementationTopDimension);
                  return (m.subDimensionIds || []).some((id) => allowed.has(id));
                })
              : [...measures, ...overallMeasures];
            return (
              <ScoreFlags
                overallScore={finalScore}
                items={collectInstanceFlagItems(flagMeasures, filter)}
                threshold={1}
                defaultOpen={false}
                testId="design-l1-flags"
              />
            );
          })()}
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
            Overall design measures
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
            l2Options={DESIGN_TREE_AS_OUTCOME}
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
            {filter.mode !== "none" ? "No overall measures for this period." : "Add overall design measures to contribute alongside sub-dimension scores."}
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
              dimensionTagTree={DESIGN_TREE_AS_OUTCOME}
            />
          ))
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Subdimension measures
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
            l2Options={DESIGN_TREE_AS_OUTCOME}
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
            <button type="button" className="text-[10px] text-gray-400 hover:text-gray-700 underline" onClick={() => setFilterTopId(null)}>
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
              dimensionTagTree={DESIGN_TREE_AS_OUTCOME}
            />
          ))
        )}
      </div>
    </div>
  );
}
