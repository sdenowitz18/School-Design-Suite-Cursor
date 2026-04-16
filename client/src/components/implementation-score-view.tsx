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
import type { ImplementationScoreData, OutcomeMeasure, ScoreFilter } from "@shared/schema";
import {
  IMPLEMENTATION_SUBDIMENSION_TREE,
  allImplementationWeightedIds,
  allImplementationTagOptions,
  type ImplementationTopDimension,
} from "@shared/implementation-subdimension-tree";
import {
  calcFinalImplementationScore,
  calcImplementationTopDimensionScore,
  calcImplementationLeafScore,
  implementationTopDelta,
  implementationLeafDelta,
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

const IMPL_TREE_AS_OUTCOME = IMPLEMENTATION_SUBDIMENSION_TREE as unknown as OutcomeSubDimL1[];

function defaultImplementationWeights(): Record<string, "H" | "M" | "L"> {
  const o: Record<string, "H" | "M" | "L"> = {};
  for (const id of allImplementationWeightedIds()) o[id] = "M";
  return o;
}

function idsForImplementationTop(top: ImplementationTopDimension): Set<string> {
  const s = new Set<string>([top.id]);
  for (const c of top.children) s.add(c.id);
  return s;
}

function truncateTileLabel(label: string, max = 46): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function ImplementationTopDetailPage({
  top,
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
  top: ImplementationTopDimension;
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
  const [filterChildId, setFilterChildId] = useState<string | null>(null);
  const [addOverallNestedType, setAddOverallNestedType] = useState<"measure" | "perception" | null>(null);
  const [addSubNestedType, setAddSubNestedType] = useState<"measure" | "perception" | null>(null);

  const topScore = useMemo(
    () => calcImplementationTopDimensionScore(top, measures, overallMeasures, subDimensionWeights, filter),
    [top, measures, overallMeasures, subDimensionWeights, filter],
  );

  const childIdSet = useMemo(() => new Set(top.children.map((c) => c.id)), [top.children]);

  const childRows = useMemo(() => {
    return top.children.map((c) => {
      const tagged = measures.filter((m) => {
        if ((m as any).crossOutcome) return false;
        const ids = m.subDimensionIds || [];
        return ids.length === 1 && ids[0] === c.id;
      });
      return {
        ...c,
        score: calcImplementationLeafScore(c.id, measures, overallMeasures, filter),
        delta: implementationLeafDelta(c.id, measures, overallMeasures, filter),
        measureCount: tagged.length,
        weight: subDimensionWeights[c.id] || "M",
        flagItems: collectInstanceFlagItems(tagged, filter),
      };
    });
  }, [top.children, measures, overallMeasures, filter, subDimensionWeights]);

  const idSet = useMemo(() => idsForImplementationTop(top), [top]);

  const measuresForTop = useMemo(() => {
    return measures.filter(
      (m) =>
        !(m as any).crossOutcome &&
        (m.subDimensionIds || []).some((id) => idSet.has(id)),
    );
  }, [measures, idSet]);

  const nestedOverallMeasures = useMemo(() => {
    return measures.filter((m) => {
      if ((m as any).crossOutcome) return false;
      const ids = m.subDimensionIds || [];
      if (ids.length === 0) return false;
      const hasParent = ids.includes(top.id);
      const hasChild = ids.some((id) => childIdSet.has(id));
      return hasParent && !hasChild;
    });
  }, [measures, top.id, childIdSet]);

  const nestedSubMeasures = useMemo(() => {
    return measures.filter((m) => {
      if ((m as any).crossOutcome) return false;
      const ids = m.subDimensionIds || [];
      return ids.some((id) => childIdSet.has(id));
    });
  }, [measures, childIdSet]);

  const visibleSubMeasures = useMemo(() => {
    if (!filterChildId) return nestedSubMeasures;
    return nestedSubMeasures.filter((m) => (m.subDimensionIds || []).includes(filterChildId));
  }, [nestedSubMeasures, filterChildId]);

  const topFlagItems = useMemo(() => collectInstanceFlagItems(measuresForTop, filter), [measuresForTop, filter]);
  const topFlagStatus = getFlagStatus(topFlagItems, topScore);

  const allTagOptions = useMemo(() => allImplementationTagOptions(), []);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Implementation Score
      </button>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="space-y-1 min-w-0">
              <h2 className="text-lg font-serif font-bold text-gray-900" title={top.label}>
                {truncateTileLabel(top.label, 80)}
              </h2>
              <p className="text-xs text-gray-500">Sub-dimension detail</p>
            </div>
            <div
              className={cn("inline-block rounded-xl p-0.5 shrink-0", {
                "ring-2 ring-red-400": topFlagStatus === "concern",
                "ring-2 ring-emerald-400": topFlagStatus === "excellence",
              })}
              style={topFlagStatus === "both" ? {
                padding: "3px",
                borderRadius: "0.75rem",
                background: "repeating-linear-gradient(135deg, #ef4444 0px, #ef4444 6px, #10b981 6px, #10b981 12px)",
              } : {}}
            >
              <div className={topFlagStatus === "both" ? "rounded-[9px] overflow-hidden" : ""}>
                <ScoreChip score={topScore} size="lg" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {childRows.map((row) => (
              <SubDimTile
                key={row.id}
                label={truncateTileLabel(row.label)}
                fullLabel={row.label}
                score={row.score}
                weight={row.weight}
                measureCount={row.measureCount}
                delta={row.delta}
                onClick={() => setFilterChildId((prev) => (prev === row.id ? null : row.id))}
                onWeightChange={(w) => onWeightChange(row.id, w)}
                active={filterChildId === row.id}
                flagStatus={getFlagStatus(row.flagItems, topScore)}
              />
            ))}
          </div>

          <ScoreFlags
            overallScore={topScore}
            items={collectInstanceFlagItems(filterChildId ? visibleSubMeasures : measuresForTop, filter)}
            threshold={1}
            defaultOpen={false}
            testId="implementation-nested-flags"
          />
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{measuresForTop.length} total measures</span>
          <span className="text-[10px] text-gray-400">Weight: L=1, M=3, H=5</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Overall — {truncateTileLabel(top.label, 36)}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{nestedOverallMeasures.length} measure{nestedOverallMeasures.length !== 1 ? "s" : ""}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Measure
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setAddOverallNestedType("measure")}>From Scratch</DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400">Pull from a Component <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {addOverallNestedType !== null && (
          <AddMeasurePanel
            l2Options={IMPL_TREE_AS_OUTCOME}
            restrictToTopId={top.id}
            defaultL2Ids={[top.id]}
            measureType={addOverallNestedType}
            panelVariant="implementation"
            onAdd={(m) => { onAddMeasure(m); setAddOverallNestedType(null); }}
            onCancel={() => setAddOverallNestedType(null)}
          />
        )}
        {nestedOverallMeasures.length === 0 && addOverallNestedType === null ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
            <AlertCircle className="w-3.5 h-3.5" /> No whole-dimension measures yet. These apply to {truncateTileLabel(top.label, 48)} as a whole.
          </div>
        ) : (
          nestedOverallMeasures.map((m) => (
            <OutcomeMeasureCard
              key={m.id}
              measure={m}
              onUpdate={onUpdateMeasure}
              onDelete={() => onDeleteMeasure(m.id)}
              actors={actors}
              onAddActor={onAddActor}
              filter={filter}
              allL2s={allTagOptions}
              subDimensionWeights={subDimensionWeights}
              measureScoringMode="implementation"
              dimensionTagTree={IMPL_TREE_AS_OUTCOME}
            />
          ))
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Sub-component measures
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{visibleSubMeasures.length} measure{visibleSubMeasures.length !== 1 ? "s" : ""}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Measure
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setAddSubNestedType("measure")}>From Scratch</DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400">Pull from a Component <span className="ml-auto text-[10px] text-gray-300">Coming Soon</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {addSubNestedType !== null && (
          <AddMeasurePanel
            l2Options={IMPL_TREE_AS_OUTCOME}
            restrictToTopId={top.id}
            defaultL2Ids={[filterChildId || top.children[0]?.id].filter(Boolean) as string[]}
            measureType={addSubNestedType}
            panelVariant="implementation"
            onAdd={(m) => { onAddMeasure(m); setAddSubNestedType(null); }}
            onCancel={() => setAddSubNestedType(null)}
          />
        )}
        {filterChildId && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtering sub-components by</span>
            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
              {childRows.find((r) => r.id === filterChildId)?.label || filterChildId}
            </Badge>
            <button type="button" className="text-[10px] text-gray-400 hover:text-gray-700 underline" onClick={() => setFilterChildId(null)}>
              Clear
            </button>
          </div>
        )}
        {visibleSubMeasures.length === 0 && addSubNestedType === null ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200">
            <AlertCircle className="w-3.5 h-3.5" /> {filterChildId ? "No measures tagged to this sub-component." : "No sub-component measures yet."}
          </div>
        ) : (
          visibleSubMeasures.map((m) => (
            <OutcomeMeasureCard
              key={m.id}
              measure={m}
              onUpdate={onUpdateMeasure}
              onDelete={() => onDeleteMeasure(m.id)}
              actors={actors}
              onAddActor={onAddActor}
              filter={filter}
              allL2s={allTagOptions}
              subDimensionWeights={subDimensionWeights}
              measureScoringMode="implementation"
              dimensionTagTree={IMPL_TREE_AS_OUTCOME}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ImplementationScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
  hideShellBackButton?: boolean;
}

export default function ImplementationScoreView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
  hideShellBackButton = false,
}: ImplementationScoreViewProps) {
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
  const [subDimensionWeights, setSubDimensionWeights] = useState<Record<string, "H" | "M" | "L">>(defaultImplementationWeights);
  const [initialized, setInitialized] = useState(false);
  const [selectedTopId, setSelectedTopId] = useState<string | null>(null);
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
      const isd: Partial<ImplementationScoreData> = hd.implementationScoreData || {};
      setActors(Array.isArray(isd.actors) ? (isd.actors as string[]) : []);
      const saved: any = isd.filter || {};
      setFilter(
        saved?.mode
          ? (saved as any)
          : ({ mode: "year", yearKey: listSelectableYearKeys(new Date(), 5)[0] } as any),
      );
      const valid = new Set(allImplementationWeightedIds());
      const rawMeasures = Array.isArray(isd.measures) ? (isd.measures as OutcomeMeasure[]) : [];
      setMeasures(
        rawMeasures.filter((m) => {
          const ids = m.subDimensionIds || [];
          return ids.length === 0 || ids.some((id) => valid.has(id));
        }),
      );
      setOverallMeasures(Array.isArray(isd.overallMeasures) ? (isd.overallMeasures as OutcomeMeasure[]) : []);
      const merged = {
        ...defaultImplementationWeights(),
        ...(isd.subDimensionWeights && typeof isd.subDimensionWeights === "object" ? (isd.subDimensionWeights as any) : {}),
      };
      setSubDimensionWeights(merged);
      setInitialized(true);
    }
  }, [comp, initialized, setFilter]);

  const finalScore = useMemo(
    () => calcFinalImplementationScore(measures, overallMeasures, subDimensionWeights, filter),
    [measures, overallMeasures, subDimensionWeights, filter],
  );

  const doSave = useCallback(() => {
    const nid = nodeId;
    if (!nid) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const existing: any = compRef.current?.healthData || {};
      const existingIsd: any = existing.implementationScoreData || {};
      updateMutation.mutate({
        nodeId: nid,
        data: {
          healthData: {
            ...existing,
            implementationScoreData: {
              ...existingIsd,
              actors,
              filter,
              measures,
              overallMeasures,
              subDimensionWeights,
              finalImplementationScore: finalScore,
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

  const allTagOptions = useMemo(() => allImplementationTagOptions(), []);

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
    const top = IMPLEMENTATION_SUBDIMENSION_TREE.find((t) => t.id === filterTopId);
    if (!top) return subdimOnly;
    const allowed = idsForImplementationTop(top);
    return subdimOnly.filter((m) => (m.subDimensionIds || []).some((id) => allowed.has(id)));
  }, [measures, filterTopId]);

  const selectedTop = selectedTopId ? IMPLEMENTATION_SUBDIMENSION_TREE.find((t) => t.id === selectedTopId) : undefined;
  if (selectedTopId && selectedTop && selectedTop.children.length > 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
        <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="implementation-filter-bar" />
        <ImplementationTopDetailPage
          top={selectedTop}
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
          onBack={() => setSelectedTopId(null)}
        />
      </div>
    );
  }

  const topRows = IMPLEMENTATION_SUBDIMENSION_TREE.map((top) => {
    const idSet = idsForImplementationTop(top);
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

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} testId="implementation-filter-bar" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="implementation-score-dashboard">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-gray-900">Implementation Score</h2>
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
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Implementation Score</p>
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
                onNavigate={row.children.length > 0 ? () => setSelectedTopId(row.id) : undefined}
                onWeightChange={(w) => handleWeightChange(row.id, w)}
                flagStatus={getFlagStatus(row.flagItems, finalScore)}
              />
            ))}
          </div>

          {(() => {
            const flagMeasures = filterTopId
              ? measures.filter((m) => {
                  const top = IMPLEMENTATION_SUBDIMENSION_TREE.find((t) => t.id === filterTopId);
                  if (!top) return false;
                  const allowed = idsForImplementationTop(top);
                  return (m.subDimensionIds || []).some((id) => allowed.has(id));
                })
              : [...measures, ...overallMeasures];
            return (
              <ScoreFlags
                overallScore={finalScore}
                items={collectInstanceFlagItems(flagMeasures, filter)}
                threshold={1}
                defaultOpen={false}
                testId="implementation-l1-flags"
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
            Overall implementation measures
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
            l2Options={IMPL_TREE_AS_OUTCOME}
            measureType={addOverallType}
            panelVariant="implementation"
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
            {filter.mode !== "none" ? "No overall measures for this period." : "Add overall measures to contribute to the implementation score alongside sub-dimension scores."}
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
              measureScoringMode="implementation"
              dimensionTagTree={IMPL_TREE_AS_OUTCOME}
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
            l2Options={IMPL_TREE_AS_OUTCOME}
            measureType={addSubdimType}
            panelVariant="implementation"
            defaultL2Ids={
              filterTopId
                ? (() => {
                    const t = IMPLEMENTATION_SUBDIMENSION_TREE.find((x) => x.id === filterTopId);
                    if (!t) return undefined;
                    if (t.children.length === 0) return [t.id];
                    return [t.children[0].id];
                  })()
                : undefined
            }
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
              measureScoringMode="implementation"
              dimensionTagTree={IMPL_TREE_AS_OUTCOME}
            />
          ))
        )}
      </div>
    </div>
  );
}
