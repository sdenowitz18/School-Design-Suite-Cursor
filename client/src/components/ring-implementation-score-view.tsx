import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ClipboardCheck, Gauge, Info, Lock, Medal, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import ScoreFilterBar from "@/components/score-filter-bar";
import ScoreInstancesInlineEditor from "@/components/score-instances-inline-editor";
import { useGlobalActors } from "@/lib/actors-store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { calculateRingImplementationScore } from "@shared/ring-implementation-score";
import type { RingImplementationInstance, RingImplementationScoreData } from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ScoreFlags from "./score-flags";
import {
  formatSchoolYearLabel,
  getSchoolYearKey,
  getSemesterKey,
  listSelectableSemesterKeys,
  listSelectableYearKeys,
  minAsOfDate,
  parseIsoDate,
  toIsoDateString,
} from "@shared/marking-period";

type WeightLabel = "H" | "M" | "L";

const ACTORS_LS_KEY = "sds_ring_impl_actors_v1";
const RING_NODE_IDS = ["algebra", "math", "college_exposure"] as const;
const PRIORITY_WEIGHT: Record<WeightLabel, number> = { H: 6, M: 3, L: 1 };
const UNKNOWN_ACTOR_KEY = "__unknown__";

function normActor(value: unknown): string {
  const clean = String(value ?? "").trim();
  if (!clean) return UNKNOWN_ACTOR_KEY;
  return clean.toLowerCase();
}

function weightValue(label: WeightLabel): number {
  if (label === "H") return 4;
  if (label === "M") return 2;
  return 1;
}

function priorityValue(label: WeightLabel): number {
  return PRIORITY_WEIGHT[label] ?? 1;
}

function safeDateKey(value: string): number {
  const d = parseIsoDate(value);
  return d ? d.getTime() : 0;
}

function inSelectedPeriod(asOfDate: string, filter: any): boolean {
  const d = parseIsoDate(asOfDate);
  if (!d) return false;
  const mode = filter?.mode || "none";
  if (mode === "none") return true;
  if (mode === "year") {
    const y = String(filter?.yearKey || "");
    if (!y) return true;
    return getSchoolYearKey(d) === y;
  }
  if (mode === "semester") {
    const s = String(filter?.semesterKey || "");
    if (!s) return true;
    return getSemesterKey(d) === s;
  }
  return true;
}

function effectiveFromInstances(
  instances: RingImplementationInstance[],
  filter: any,
): { score: number | null; weightLabel: WeightLabel | null } {
  const scored = (instances || []).filter((i) => i.score !== null && inSelectedPeriod(i.asOfDate, filter));
  if (scored.length === 0) return { score: null, weightLabel: null };

  const agg = filter?.aggregation || "singleLatest";

  if (agg === "latestPerActor") {
    const wanted = normActor(filter?.actorKey);
    if (!wanted) return { score: null, weightLabel: null };
    const filtered = scored.filter((i) => normActor(i.actor) === wanted);
    if (filtered.length === 0) return { score: null, weightLabel: null };
    const latest = [...filtered].sort((a, b) => safeDateKey(b.asOfDate) - safeDateKey(a.asOfDate))[0];
    return { score: latest.score ?? null, weightLabel: latest.weight ?? "M" };
  }

  // Single Latest (default): latest per actor, then weighted average across actors.
  const byActor = new Map<string, RingImplementationInstance>();
  for (const inst of scored) {
    const key = normActor(inst.actor);
    const prev = byActor.get(key);
    if (!prev || safeDateKey(inst.asOfDate) > safeDateKey(prev.asOfDate)) byActor.set(key, inst);
  }
  const latests = Array.from(byActor.values());
  if (latests.length === 0) return { score: null, weightLabel: null };

  let totalW = 0;
  let total = 0;
  for (const inst of latests) {
    const score = inst.score ?? null;
    if (score === null) continue;
    const w = weightValue(inst.weight);
    if (w <= 0) continue;
    totalW += w;
    total += score * w;
  }
  if (totalW <= 0) return { score: null, weightLabel: null };
  const avg = total / totalW;
  const score = Math.max(1, Math.min(5, Math.round(avg)));
  const avgW = totalW / Math.max(1, latests.length);
  const weightLabel: WeightLabel = avgW >= 3 ? "H" : avgW >= 1.5 ? "M" : "L";
  return { score, weightLabel };
}

function effectiveFromItems(items: any[], filter: any): number | null {
  const list = Array.isArray(items) ? items : [];
  let totalWeight = 0;
  let total = 0;
  for (const it of list) {
    const insts: RingImplementationInstance[] = Array.isArray((it as any)?.instances) ? (it as any).instances : [];
    const score = insts.length > 0 ? effectiveFromInstances(insts, filter).score : null;
    if (score === null) continue;
    const p = normalizeWeightLabel((it as any)?.priority ?? "M");
    const w = priorityValue(p);
    if (w <= 0) continue;
    totalWeight += w;
    total += score * w;
  }
  if (totalWeight <= 0) return null;
  const avg = total / totalWeight;
  return Math.max(1, Math.min(5, Math.round(avg)));
}

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
  sourceFilter?: any;
  onFilterChange?: (next: any) => void;
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
  const { data: allComponents } = useQuery(componentQueries.all);
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compRef = useRef<any>(null);

  const [implementationScoringMode, setImplementationScoringMode] = useState<RingImplementationScoreData["implementationScoringMode"]>("overall");
  const [activeDimTab, setActiveDimTab] = useState<string>("studentsEnrollment");
  const [overallImplementationScore, setOverallImplementationScore] = useState<number | null>(null);
  const [overallImplementationRationale, setOverallImplementationRationale] = useState<string>("");
  const [overallImplementationConfidence, setOverallImplementationConfidence] = useState<WeightLabel>("M");
  const [overallInstances, setOverallInstances] = useState<RingImplementationInstance[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [localFilter, setLocalFilter] = useState<any>({
    mode: "year",
    yearKey: listSelectableYearKeys(new Date(), 5)[0],
    aggregation: "singleLatest",
    actorKey: undefined,
  });
  const filter = sourceFilter || localFilter;
  const setFilter = useCallback(
    (next: any) => {
      onFilterChange?.(next);
      setLocalFilter(next);
    },
    [onFilterChange],
  );
  useEffect(() => {
    if (sourceFilter) setLocalFilter(sourceFilter);
  }, [sourceFilter]);

  useEffect(() => {
    if (implementationScoringMode !== "overall") setActiveDimTab("studentsEnrollment");
  }, [implementationScoringMode]);
  const [addingActorByInstanceId, setAddingActorByInstanceId] = useState<Record<string, boolean>>({});
  const [newActorDraftByInstanceId, setNewActorDraftByInstanceId] = useState<Record<string, string>>({});
  const [dimensions, setDimensions] = useState<RingImplementationScoreData["dimensions"]>({
    studentsEnrollment: { scoringMode: "overall", items: [], score: null, weight: "M", confidence: "M" } as any,
    feasibilitySustainability: { scoringMode: "overall", items: [], score: null, weight: "M", confidence: "M" } as any,
    fidelityDesignedExperience: { scoringMode: "overall", items: [], score: null, weight: "M", confidence: "M" } as any,
    qualityDelivery: { scoringMode: "overall", items: [], score: null, weight: "M", confidence: "M" } as any,
    measurementAdministrationQuality: { scoringMode: "overall", items: [], score: null, weight: "M", confidence: "M" } as any,
  });
  const [initialized, setInitialized] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState<Record<string, boolean>>({});

  const isCenterOverall = nodeId === "overall";

  useEffect(() => {
    compRef.current = comp;
  }, [comp]);

  const minDate = useMemo(() => minAsOfDate(new Date(), 5), []);
  const maxDate = useMemo(() => toIsoDateString(new Date()), []);

  const unionActors = useCallback((base: string[], extra: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of [...base, ...extra]) {
      const clean = String(a || "").trim();
      if (!clean) continue;
      const key = normActor(clean);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
    return out;
  }, []);

  const loadActorsFromLocalStorage = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(ACTORS_LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, []);

  const saveActorsToLocalStorage = useCallback((list: string[]) => {
    try {
      localStorage.setItem(ACTORS_LS_KEY, JSON.stringify(list));
    } catch {}
  }, []);

  const newInstance = useCallback((): RingImplementationInstance => {
    return {
      id: `impl_${Math.random().toString(36).slice(2, 10)}`,
      actor: "",
      asOfDate: toIsoDateString(new Date()),
      score: null,
      weight: "M",
      rationale: "",
    };
  }, []);

  useEffect(() => {
    if (!comp || initialized) return;
    const hd: any = comp.healthData || {};
    const rsd: Partial<RingImplementationScoreData> = hd.ringImplementationScoreData || {};
    const d: any = rsd.dimensions || {};

    setImplementationScoringMode((rsd as any).implementationScoringMode || "overall");
    setOverallImplementationScore(normalizeScore((rsd as any).overallImplementationScore));
    setOverallImplementationRationale((rsd as any).overallImplementationRationale || "");
    setOverallImplementationConfidence(normalizeWeightLabel((rsd as any).overallImplementationConfidence ?? "M"));

    const defaultYearKey = listSelectableYearKeys(new Date(), 5)[0];
    const rawSavedFilter = (rsd as any).filter || {};
    const savedMode = String(rawSavedFilter?.mode || "");
    const nextFilter =
      savedMode === "semester"
        ? {
            mode: "semester",
            semesterKey: rawSavedFilter?.semesterKey || listSelectableSemesterKeys(new Date(), 5)[0],
            yearKey: undefined,
            aggregation: rawSavedFilter?.aggregation || "singleLatest",
            actorKey: rawSavedFilter?.actorKey,
          }
        : {
            mode: "year",
            yearKey: rawSavedFilter?.yearKey || defaultYearKey,
            semesterKey: undefined,
            aggregation: rawSavedFilter?.aggregation || "singleLatest",
            actorKey: rawSavedFilter?.actorKey,
          };
    setLocalFilter(nextFilter);

    const storedActors = loadActorsFromLocalStorage();
    const rsdActors = Array.isArray((rsd as any).actors) ? (rsd as any).actors.map(String) : [];

    const savedOverallInstances = Array.isArray((rsd as any).overallInstances) ? (rsd as any).overallInstances : [];
    const overallInsts: RingImplementationInstance[] =
      savedOverallInstances.length > 0
        ? savedOverallInstances.map((i: any) => ({
            id: String(i.id || `impl_${Math.random().toString(36).slice(2, 10)}`),
            actor: String(i.actor || ""),
            asOfDate: String(i.asOfDate || toIsoDateString(new Date())),
            score: normalizeScore(i.score),
            weight: normalizeWeightLabel(i.weight),
          }))
        : [];
    setOverallInstances(overallInsts);

    const migrateDim = (raw: any): any => {
      const instancesRaw = Array.isArray(raw?.instances) ? raw.instances : [];
      const instances: RingImplementationInstance[] =
        instancesRaw.length > 0
          ? instancesRaw.map((i: any) => ({
              id: String(i.id || `impl_${Math.random().toString(36).slice(2, 10)}`),
              actor: String(i.actor || ""),
              asOfDate: String(i.asOfDate || toIsoDateString(new Date())),
              score: normalizeScore(i.score),
              weight: normalizeWeightLabel(i.weight),
            }))
          : [];
      if (instances.length === 0 && raw?.score != null) {
        instances.push({
          id: `impl_${Math.random().toString(36).slice(2, 10)}`,
          actor: "",
          asOfDate: toIsoDateString(new Date()),
          score: normalizeScore(raw.score),
          weight: normalizeWeightLabel(raw.weight),
          rationale: "",
        });
      }
      return {
        instances,
        score: normalizeScore(raw?.score),
        rationale: raw?.rationale,
        confidence: normalizeWeightLabel(raw?.confidence ?? "M"),
        weight: normalizeWeightLabel(raw?.weight),
      };
    };
    const legacyMap: Record<string, string> = {
      studentsEnrollment: "scale",
      feasibilitySustainability: "learnerDemand",
      fidelityDesignedExperience: "fidelity",
      qualityDelivery: "quality",
    };

    const migrateDimWithItems = (raw: any, itemsKind: "subcomponent" | "component"): any => {
      const base = migrateDim(raw);
      const scoringMode = raw?.scoringMode === "items" ? "items" : "overall";
      const itemsRaw = Array.isArray(raw?.items) ? raw.items : [];
      const items = itemsRaw.map((it: any) => ({
        key: String(it?.key || ""),
        label: String(it?.label || ""),
        priority: normalizeWeightLabel(it?.priority ?? "M"),
        score: normalizeScore(it?.score),
        instances: (Array.isArray(it?.instances) ? it.instances : []).map((i: any) => ({
          id: String(i.id || `impl_${Math.random().toString(36).slice(2, 10)}`),
          actor: String(i.actor || ""),
          asOfDate: String(i.asOfDate || toIsoDateString(new Date())),
          score: normalizeScore(i.score),
          weight: normalizeWeightLabel(i.weight),
        })),
        confidence: normalizeWeightLabel(it?.confidence ?? "M"),
        rationale: it?.rationale,
      })).filter((it: any) => it.key);
      return {
        ...base,
        scoringMode,
        itemsKind: raw?.itemsKind || itemsKind,
        items,
        weight: normalizeWeightLabel(raw?.weight ?? base.weight ?? "M"),
      };
    };

    const dimKind: "subcomponent" | "component" = isCenterOverall ? "component" : "subcomponent";
    const getRaw = (key: string) => d?.[key] || d?.[legacyMap[key]] || {};
    const nextDims: any = {
      studentsEnrollment: migrateDimWithItems(getRaw("studentsEnrollment"), dimKind),
      feasibilitySustainability: migrateDimWithItems(getRaw("feasibilitySustainability"), dimKind),
      fidelityDesignedExperience: migrateDimWithItems(getRaw("fidelityDesignedExperience"), dimKind),
      qualityDelivery: migrateDimWithItems(getRaw("qualityDelivery"), dimKind),
      measurementAdministrationQuality: migrateDimWithItems(getRaw("measurementAdministrationQuality"), dimKind),
    };
    setDimensions(nextDims);

    const instanceActors: string[] = [];
    for (const inst of overallInsts) if (inst.actor?.trim()) instanceActors.push(inst.actor);
    for (const key of [
      "studentsEnrollment",
      "feasibilitySustainability",
      "fidelityDesignedExperience",
      "qualityDelivery",
      "measurementAdministrationQuality",
    ] as const) {
      const insts: RingImplementationInstance[] = Array.isArray(nextDims?.[key]?.instances) ? nextDims[key].instances : [];
      for (const inst of insts) if (inst.actor?.trim()) instanceActors.push(inst.actor);
    }
    const mergedActors = unionActors(unionActors(storedActors, rsdActors), instanceActors);
    setActors(mergedActors);
    setInitialized(true);
  }, [comp, initialized]);

  useEffect(() => {
    if (!initialized) return;
    saveActorsToLocalStorage(actors);
  }, [actors, initialized, saveActorsToLocalStorage]);

  useEffect(() => {
    if (!initialized) return;
    mergeGlobalActors(actors);
  }, [actors, initialized, mergeGlobalActors]);

  const actorOptions = useMemo(() => unionActors(globalActors, actors), [actors, globalActors, unionActors]);

  const finalScore = useMemo(() => {
    const rsd: RingImplementationScoreData = {
      implementationScoringMode,
      actors,
      filter,
      overallInstances,
      overallImplementationScore,
      overallImplementationRationale,
      overallImplementationConfidence,
      dimensions,
      finalImplementationScore: null,
    };
    return calculateRingImplementationScore({ healthData: { ringImplementationScoreData: rsd } });
  }, [actors, dimensions, filter, implementationScoringMode, overallImplementationRationale, overallImplementationScore, overallInstances]);

  const doSave = useCallback(
    (rsd: RingImplementationScoreData, computed: number | null) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = compRef.current?.healthData || {};
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
    [nodeId, updateMutation]
  );

  useEffect(() => {
    if (!initialized) return;
    const rsd: RingImplementationScoreData = {
      implementationScoringMode,
      actors,
      filter,
      overallInstances,
      overallImplementationScore,
      overallImplementationRationale,
      overallImplementationConfidence,
      dimensions,
      finalImplementationScore: finalScore,
    };
    doSave(rsd, finalScore);
  }, [actors, dimensions, doSave, filter, finalScore, initialized, implementationScoringMode, overallImplementationScore, overallImplementationRationale, overallInstances]);

  const addActor = (name: string) => {
    const clean = String(name || "").trim();
    if (!clean) return;
    setActors((prev) => unionActors(prev, [clean]));
  };

  const canonicalActor = useCallback(
    (value: string) => {
      const key = normActor(value);
      if (key === UNKNOWN_ACTOR_KEY) return "";
      return actors.find((a) => normActor(a) === key) || "";
    },
    [actors],
  );

  const actorSelectValue = (actor: string) => (actor && actor.trim() ? actor : UNKNOWN_ACTOR_KEY);

  const mergeDerivedItems = useCallback(
    (
      derived: { key: string; label: string }[],
      saved: any[],
    ): {
      key: string;
      label: string;
      priority: WeightLabel;
      score: number | null;
      instances: RingImplementationInstance[];
      confidence: WeightLabel;
      rationale?: string;
    }[] => {
      const byKey = new Map<string, any>();
      for (const it of Array.isArray(saved) ? saved : []) {
        const k = String(it?.key || "");
        if (!k) continue;
        byKey.set(k, it);
      }
      const out: any[] = [];
      const used = new Set<string>();
      for (const d of derived) {
        const existing = byKey.get(d.key);
        used.add(d.key);
        out.push({
          key: d.key,
          label: d.label,
          priority: normalizeWeightLabel(existing?.priority ?? "M"),
          score: normalizeScore(existing?.score),
          instances: Array.isArray(existing?.instances) ? existing.instances : [],
          confidence: normalizeWeightLabel(existing?.confidence ?? "M"),
          rationale: existing?.rationale,
        });
      }
      // Preserve any previously-saved items that no longer exist in the derived list.
      for (const [k, existing] of Array.from(byKey.entries())) {
        if (used.has(k)) continue;
        out.push({
          key: k,
          label: String(existing?.label || k),
          priority: normalizeWeightLabel(existing?.priority ?? "M"),
          score: normalizeScore(existing?.score),
          instances: Array.isArray(existing?.instances) ? existing.instances : [],
          confidence: normalizeWeightLabel(existing?.confidence ?? "M"),
          rationale: existing?.rationale,
          _archived: true,
        });
      }
      return out;
    },
    [],
  );

  const derivedSubcomponentItems = useMemo(() => {
    const subs: any[] = Array.isArray((comp as any)?.designedExperienceData?.subcomponents) ? (comp as any).designedExperienceData.subcomponents : [];
    return subs
      .map((s) => ({ key: String(s?.id || ""), label: String(s?.name || s?.title || "").trim() }))
      .filter((s) => s.key && s.label);
  }, [comp]);

  const derivedComponentItems = useMemo(() => {
    const list: any[] = Array.isArray(allComponents) ? allComponents : [];
    const ringIds = new Set<string>((RING_NODE_IDS as readonly string[]).map(String));
    return list
      .filter((c) => ringIds.has(String(c?.nodeId)))
      .map((c) => ({ key: String(c?.nodeId || ""), label: String(c?.title || c?.nodeId || "").trim() }))
      .filter((c) => c.key && c.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allComponents]);

  const dimTiles = useMemo(() => {
    const rows = [
      { key: "studentsEnrollment", label: "Students involved / enrollment", icon: Users },
      { key: "feasibilitySustainability", label: "Feasibility / sustainability", icon: ShieldCheck },
      { key: "fidelityDesignedExperience", label: "Fidelity to designed experience", icon: ClipboardCheck },
      { key: "qualityDelivery", label: "Quality of delivery", icon: Medal },
      { key: "measurementAdministrationQuality", label: "Measurement admin quality", icon: Gauge },
    ] as const;

    const derived = isCenterOverall ? derivedComponentItems : derivedSubcomponentItems;
    return rows.map((row) => {
      const dim: any = (dimensions as any)[row.key] || {};
      const instances: RingImplementationInstance[] = Array.isArray(dim.instances) ? dim.instances : [];
      const eff = effectiveFromInstances(instances, filter);
      const mergedItems = mergeDerivedItems(derived, dim.items || []);
      const itemsEff = effectiveFromItems(mergedItems, filter);
      const scoringMode: "overall" | "items" = dim.scoringMode === "items" ? "items" : "overall";
      const usedScore = scoringMode === "items" ? itemsEff : eff.score;
      const usedWeight = scoringMode === "items" ? normalizeWeightLabel(dim.weight ?? "M") : eff.weightLabel ?? "M";
      return { ...row, usedScore: usedScore ?? null, usedWeight };
    });
  }, [derivedComponentItems, derivedSubcomponentItems, dimensions, filter, isCenterOverall, mergeDerivedItems]);

  const updateDimensionInstances = (key: string, next: RingImplementationInstance[]) => {
    setDimensions((prev: any) => ({ ...prev, [key]: { ...(prev[key] || {}), instances: next } }));
  };

  const addDimInstance = (key: string) => {
    updateDimensionInstances(key, [...(((dimensions as any)[key]?.instances as RingImplementationInstance[]) || []), newInstance()]);
  };

  const updateDimInstance = (key: string, id: string, patch: Partial<RingImplementationInstance>) => {
    const current = (((dimensions as any)[key]?.instances as RingImplementationInstance[]) || []).map((i) =>
      i.id === id ? { ...i, ...patch } : i,
    );
    updateDimensionInstances(key, current);
  };

  const removeDimInstance = (key: string, id: string) => {
    const current = (((dimensions as any)[key]?.instances as RingImplementationInstance[]) || []).filter((i) => i.id !== id);
    updateDimensionInstances(key, current);
  };

  const setDim = (key: string, patch: any) =>
    setDimensions((prev: any) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));

  const setItem = (dimKey: string, itemKey: string, patch: any) =>
    setDimensions((prev: any) => {
      const cur = (prev as any)[dimKey] || {};
      const items = Array.isArray(cur.items) ? cur.items : [];
      const nextItems = items.map((it: any) => (String(it?.key) === String(itemKey) ? { ...it, ...patch } : it));
      return { ...prev, [dimKey]: { ...cur, items: nextItems } };
    });

  const updateItemInstances = (dimKey: string, itemKey: string, next: RingImplementationInstance[]) =>
    setItem(dimKey, itemKey, { instances: next });

  const addItemInstance = (dimKey: string, itemKey: string) => {
    const curDim: any = (dimensions as any)[dimKey] || {};
    const curItems: any[] = Array.isArray(curDim.items) ? curDim.items : [];
    const cur = curItems.find((x) => String(x?.key) === String(itemKey));
    const insts: RingImplementationInstance[] = Array.isArray(cur?.instances) ? cur.instances : [];
    updateItemInstances(dimKey, itemKey, [...insts, newInstance()]);
  };

  const updateItemInstance = (dimKey: string, itemKey: string, id: string, patch: Partial<RingImplementationInstance>) => {
    const curDim: any = (dimensions as any)[dimKey] || {};
    const curItems: any[] = Array.isArray(curDim.items) ? curDim.items : [];
    const cur = curItems.find((x) => String(x?.key) === String(itemKey));
    const insts: RingImplementationInstance[] = Array.isArray(cur?.instances) ? cur.instances : [];
    updateItemInstances(
      dimKey,
      itemKey,
      insts.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  };

  const removeItemInstance = (dimKey: string, itemKey: string, id: string) => {
    const curDim: any = (dimensions as any)[dimKey] || {};
    const curItems: any[] = Array.isArray(curDim.items) ? curDim.items : [];
    const cur = curItems.find((x) => String(x?.key) === String(itemKey));
    const insts: RingImplementationInstance[] = Array.isArray(cur?.instances) ? cur.instances : [];
    updateItemInstances(
      dimKey,
      itemKey,
      insts.filter((i) => i.id !== id),
    );
  };

  const addOverallInstance = () => setOverallInstances((prev) => [...prev, newInstance()]);
  const updateOverallInstance = (id: string, patch: Partial<RingImplementationInstance>) => {
    setOverallInstances((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const removeOverallInstance = (id: string) => setOverallInstances((prev) => prev.filter((i) => i.id !== id));

  const startAddActorForInstance = (id: string) => {
    setAddingActorByInstanceId((prev) => ({ ...prev, [id]: true }));
    setNewActorDraftByInstanceId((prev) => ({ ...prev, [id]: "" }));
  };

  const cancelAddActorForInstance = (id: string) => {
    setAddingActorByInstanceId((prev) => ({ ...prev, [id]: false }));
    setNewActorDraftByInstanceId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const confirmAddActorForInstance = (id: string, onSetActor: (name: string) => void) => {
    const name = String(newActorDraftByInstanceId[id] || "").trim();
    if (!name) return;
    addActor(name);
    onSetActor(name);
    cancelAddActorForInstance(id);
  };

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

      <ScoreFilterBar filter={filter as any} onChange={setFilter as any} actors={actorOptions} testId="impl-filter-bar" />

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

        {implementationScoringMode === "multi" ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4" data-testid="dimension-tiles">
            {dimTiles.map((t) => (
              <div key={t.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2 cursor-default" data-testid={`dimension-tile-${t.key}`}>
                <div className="flex items-center gap-1.5">
                  <t.icon className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700 truncate">{t.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <ScoreChip score={t.usedScore} size="sm" />
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600 gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> {String(t.usedWeight || "M")}
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
                ? "Overall mode: Final score is computed from your saved instances (using the marking period filter if set)."
                : "Dimensions mode: Final score is computed from each dimension’s selected instance(s) and their H/M/L weights, rounded to the nearest whole. Blank scores are ignored."}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4" data-testid="flags-section">
          <ScoreFlags
            overallScore={finalScore}
            items={dimTiles.map((t) => ({ key: String(t.key), label: String(t.label), score: (t.usedScore ?? null) as any }))}
            threshold={2}
            defaultOpen={false}
            testId="implementation-flags"
          />
        </div>

        {/* Filter lives above this card for consistency */}

        <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
          <span>{implementationScoringMode === "overall" ? "Mode: Overall" : "Mode: Dimensions"}</span>
          <span>Priority weights: H=6, M=3, L=1</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4" data-testid="impl-scoring-mode">
        <h3 className="text-sm font-semibold text-gray-700">Scoring Mode</h3>
        <RadioGroup
          value={implementationScoringMode as string}
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
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">Instances ({overallInstances.length})</div>
              <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                Score {effectiveFromInstances(overallInstances || [], filter).score ?? "—"}
              </Badge>
            </div>

            <ScoreInstancesInlineEditor
              instances={overallInstances as any}
              onChange={(next) => setOverallInstances(next as any)}
              actors={actorOptions}
              onAddActor={(label) => {
                addGlobalActor(label);
                addActor(label);
              }}
              testIdPrefix="impl-overall"
            />

            <Separator />

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
            {(() => {
              const rows = [
                { key: "studentsEnrollment", label: "Students involved / enrollment", itemLabel: isCenterOverall ? "By component" : "By subcomponent" },
                { key: "feasibilitySustainability", label: "Perceived feasibility / sustainability", itemLabel: isCenterOverall ? "By component" : "By subcomponent" },
                { key: "fidelityDesignedExperience", label: "Fidelity to designed student experience", itemLabel: isCenterOverall ? "By component" : "By subcomponent" },
                { key: "qualityDelivery", label: "Quality of experience delivery", itemLabel: isCenterOverall ? "By component" : "By subcomponent" },
                { key: "measurementAdministrationQuality", label: "Measurement administration quality", itemLabel: isCenterOverall ? "By component" : "By subcomponent" },
              ] as const;

              const tabMeta = rows.map((row) => {
                const dim: any = (dimensions as any)[row.key] || {};
                const instances: RingImplementationInstance[] = Array.isArray(dim.instances) ? dim.instances : [];
                const eff = effectiveFromInstances(instances, filter);
                const derived = isCenterOverall ? derivedComponentItems : derivedSubcomponentItems;
                const mergedItems = mergeDerivedItems(derived, dim.items || []);
                const itemsEff = effectiveFromItems(mergedItems, filter);
                const scoringMode: "overall" | "items" = dim.scoringMode === "items" ? "items" : "overall";
                const tabScore = scoringMode === "items" ? itemsEff : eff.score;
                return { key: row.key, label: row.label, score: tabScore };
              });

              return (
                <>
                  <div className="bg-white border border-gray-200 rounded-lg p-3" data-testid="impl-dimension-tabs">
                    <Tabs value={activeDimTab} onValueChange={(v) => setActiveDimTab(String(v))} className="w-full">
                      <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-gray-200 gap-4 overflow-x-auto">
                        {tabMeta.map((t) => (
                          <TabsTrigger
                            key={t.key}
                            value={t.key}
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-900 data-[state=active]:shadow-none px-0 py-2 text-gray-500 hover:text-gray-700 bg-transparent flex items-center gap-2"
                            data-testid={`impl-dim-tab-${t.key}`}
                          >
                            <span className="truncate max-w-[180px]" title={t.label}>
                              {(() => {
                                const short: Record<string, string> = {
                                  studentsEnrollment: "Enrollment",
                                  feasibilitySustainability: "Sustainability",
                                  fidelityDesignedExperience: "Fidelity",
                                  qualityDelivery: "Delivery",
                                  measurementAdministrationQuality: "Measurement",
                                };
                                return short[String(t.key)] || t.label;
                              })()}
                            </span>
                            <ScoreChip score={t.score ?? null} size="sm" />
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>

                  {rows
                    .filter((r) => String(r.key) === String(activeDimTab))
                    .map((row) => {
              const dim: any = (dimensions as any)[row.key] || {};
              const instances: RingImplementationInstance[] = Array.isArray(dim.instances) ? dim.instances : [];
              const eff = effectiveFromInstances(instances, filter);
              const derived = isCenterOverall ? derivedComponentItems : derivedSubcomponentItems;
              const mergedItems = mergeDerivedItems(derived, dim.items || []);
              const itemsEff = effectiveFromItems(mergedItems, filter);
              const ratKey = `impl.${row.key}`;
              const scoringMode: "overall" | "items" = dim.scoringMode === "items" ? "items" : "overall";
              return (
                <div key={row.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2" data-testid={`impl-dimension-${row.key}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white" data-testid={`impl-dim-mode-${row.key}`}>
                      {([
                        { key: "overall", label: "Overall" },
                        { key: "items", label: row.itemLabel },
                      ] as const).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() =>
                            setDim(row.key, {
                              scoringMode: opt.key,
                              itemsKind: isCenterOverall ? "component" : "subcomponent",
                              items: mergeDerivedItems(derived, dim.items || []),
                            })
                          }
                          className={cn(
                            "px-3 py-1.5 text-[11px] font-bold transition-colors",
                            scoringMode === opt.key ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900",
                            opt.key !== "overall" && "border-l border-gray-200",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {scoringMode === "items" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-600">Dimension weight</span>
                        <WeightPicker value={normalizeWeightLabel(dim.weight ?? "M")} onChange={(v) => setDim(row.key, { weight: v })} />
                      </div>
                    ) : null}

                    <div className="ml-auto">
                      <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                        {scoringMode === "items" ? `Rollup: ${itemsEff ?? "—"}` : `Used: ${eff.score ?? "—"} (${eff.weightLabel ?? "—"})`}
                      </Badge>
                    </div>
                  </div>

                  {scoringMode === "items" ? (
                    <div className="space-y-2">
                      {mergedItems.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">
                          {isCenterOverall ? "No components available to score." : "No subcomponents available to score."}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {mergedItems.map((it: any) => (
                            <Collapsible key={it.key} defaultOpen={false}>
                              <div className={cn("bg-white border border-gray-200 rounded-lg", it._archived && "opacity-80")}>
                                <div className="p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <CollapsibleTrigger asChild>
                                      <button type="button" className="flex items-center gap-2 min-w-0 text-left">
                                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                        <div className="min-w-0">
                                          <div className="text-xs font-semibold text-gray-900 truncate">
                                            {it.label}
                                            {it._archived ? <span className="text-[10px] text-gray-400 font-semibold"> (archived)</span> : null}
                                          </div>
                                          <div className="text-[10px] text-gray-500">
                                            Priority {String(it.priority || "M")} •{" "}
                                            {Array.isArray(it.instances) ? it.instances.length : 0} instance
                                            {Array.isArray(it.instances) && it.instances.length === 1 ? "" : "s"}
                                          </div>
                                        </div>
                                      </button>
                                    </CollapsibleTrigger>
                                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-[11px] font-semibold text-gray-600">Priority</span>
                                      <WeightPicker value={it.priority} onChange={(v) => setItem(row.key, it.key, { priority: v })} />
                                      <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                                        Score {effectiveFromInstances((it.instances || []) as any, filter).score ?? "—"}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                <CollapsibleContent>
                                  <div className="px-3 pb-3 space-y-2">
                                    <div className="text-[10px] text-gray-500">Priority + instance scores roll up to the dimension.</div>
                                    <ScoreInstancesInlineEditor
                                      instances={(it.instances || []) as any}
                                      onChange={(next) => updateItemInstances(row.key, it.key, next as any)}
                                      actors={actorOptions}
                                      onAddActor={(label) => {
                                        addGlobalActor(label);
                                        addActor(label);
                                      }}
                                      testIdPrefix={`impl-item-${row.key}-${it.key}`}
                                    />
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-gray-500">Instances ({instances.length})</div>
                        <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                          Score {eff.score ?? "—"}
                        </Badge>
                      </div>

                      <ScoreInstancesInlineEditor
                        instances={instances as any}
                        onChange={(next) => updateDimensionInstances(row.key, next as any)}
                        actors={actorOptions}
                        onAddActor={(label) => {
                          addGlobalActor(label);
                          addActor(label);
                        }}
                        testIdPrefix={`impl-dim-${row.key}`}
                      />
                    </>
                  )}

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
                                setDimensions((prev: any) => ({
                                  ...(prev as any),
                                  [row.key]: { ...((prev as any)[row.key] || {}), confidence: v },
                                }))
                              }
                            />
                          </div>
                          <Textarea
                            value={dim.rationale || ""}
                            onChange={(e) =>
                              setDimensions((prev: any) => ({
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
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}

