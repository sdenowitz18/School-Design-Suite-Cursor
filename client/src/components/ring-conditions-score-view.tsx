import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Info, Lock, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import type {
  RingConditionItem,
  RingConditionsCKey,
  RingConditionsInstance,
  RingConditionsScoreData,
  RingConditionsStakeholderGroup,
  ScoreFilter,
} from "@shared/schema";
import { calculateRingConditionsScoreFromData, calculateRingConditionsSum } from "@shared/ring-conditions-score";
import { inSelectedPeriod, normActor } from "@shared/score-instances";
import { listSelectableYearKeys, parseIsoDate } from "@shared/marking-period";
import ScoreFilterBar from "./score-filter-bar";
import RingConditionsInstancesInlineEditor from "./ring-conditions-instances-inline-editor";
import { useGlobalActors } from "@/lib/actors-store";
import ScoreFlags, { SignalFlags } from "./score-flags";

type Hml = "H" | "M" | "L";

const STAKEHOLDER_LABEL: Record<RingConditionsStakeholderGroup, string> = {
  students: "Students",
  families: "Families",
  educators_staff: "Educators / Staff",
  admin_district: "Administration (District)",
  admin_school: "Administration (School)",
  other_leaders: "Other Community Leaders",
};

const C_KEYS: RingConditionsCKey[] = ["Conviction", "Capacity", "Clarity", "Culture", "Coalition"];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function todayYmd(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function hmlValue(v: unknown): number {
  if (v === "H" || v === "M" || v === "L") return v === "H" ? 4 : v === "M" ? 2 : 1;
  return 2;
}

function format1(v: number): string {
  const r = Math.round(v * 10) / 10;
  return String(r);
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

function tinyChipClass(v: Hml) {
  if (v === "H") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "M") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function HmlPicker({ value, onChange }: { value: Hml; onChange: (v: Hml) => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-gray-50" data-testid="hml-picker">
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
          aria-pressed={value === k}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function DirectionToggle({ value, onChange }: { value: "tailwind" | "headwind"; onChange: (v: "tailwind" | "headwind") => void }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-gray-50" data-testid="direction-toggle">
      {(["tailwind", "headwind"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-bold transition-colors",
            value === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800",
            k !== "tailwind" && "border-l border-gray-200",
          )}
          aria-pressed={value === k}
        >
          {k === "tailwind" ? "Tailwind (+)" : "Headwind (–)"}
        </button>
      ))}
    </div>
  );
}

function CsMultiSelect({ value, onChange }: { value: RingConditionsCKey[]; onChange: (next: RingConditionsCKey[]) => void }) {
  const set = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="c-multiselect">
      {C_KEYS.map((k) => {
        const active = set.has(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => {
              const next = new Set(set);
              if (active) {
                // Cs tagging is required: don't allow removing the last tag.
                if (next.size <= 1) return;
                next.delete(k);
              }
              else next.add(k);
              onChange(Array.from(next));
            }}
            className={cn(
              "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
              active ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800",
            )}
            aria-pressed={active}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

function CsFilterChips({
  value,
  onChange,
}: {
  value: RingConditionsCKey[];
  onChange: (next: RingConditionsCKey[]) => void;
}) {
  const set = new Set(value);
  const options: RingConditionsCKey[] = [...C_KEYS];
  const toggle = (k: RingConditionsCKey) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="conditions-filter">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
          value.length === 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800",
        )}
        aria-pressed={value.length === 0}
      >
        All
      </button>
      {options.map((k) => {
        const active = set.has(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={cn(
              "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
              active ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800",
            )}
            aria-pressed={active}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

function normalizeConditionInstance(partial?: Partial<RingConditionsInstance>): RingConditionsInstance {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const id = String((partial as any)?.id || generateId());
  const asOfDate = String(partial?.asOfDate || `${yyyy}-${mm}-${dd}`);
  const actor = String(partial?.actor || "");
  const windStrength = (partial?.windStrength === "H" || partial?.windStrength === "M" || partial?.windStrength === "L" ? partial.windStrength : "M") as any;
  const rationale = String((partial as any)?.rationale || "");
  return { id, asOfDate, actor, windStrength, rationale } as any;
}

function effectiveWindStrength(instances: RingConditionsInstance[], filter: any): number | null {
  const agg = filter?.aggregation || "singleLatest";
  const list = Array.isArray(instances) ? instances : [];

  const eligible: { actorKey: string; dt: number; strength: number }[] = [];
  for (const inst of list) {
    const d = parseIsoDate(String((inst as any)?.asOfDate || ""));
    if (!d) continue;
    if (!inSelectedPeriod(d, filter)) continue;
    const actorKey = normActor((inst as any)?.actor);
    eligible.push({ actorKey, dt: d.getTime(), strength: hmlValue((inst as any)?.windStrength) });
  }
  if (eligible.length === 0) return null;

  if (agg === "latestPerActor") {
    const wanted = normActor(filter?.actorKey);
    if (!wanted) return null;
    const filtered = eligible.filter((e) => e.actorKey === wanted);
    if (filtered.length === 0) return null;
    filtered.sort((a, b) => b.dt - a.dt);
    return filtered[0].strength;
  }

  const byActor = new Map<string, { dt: number; strength: number }>();
  for (const e of eligible) {
    const prev = byActor.get(e.actorKey);
    if (!prev || e.dt > prev.dt) byActor.set(e.actorKey, { dt: e.dt, strength: e.strength });
  }
  const values = Array.from(byActor.values());
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v.strength, 0) / values.length;
}

interface RingConditionsScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
}

export default function RingConditionsScoreView({ nodeId, title, onBack, sourceFilter, onFilterChange }: RingConditionsScoreViewProps) {
  const { actors: globalActors, addActor: addGlobalActor, mergeActors: mergeGlobalActors } = useGlobalActors();
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [conditions, setConditions] = useState<RingConditionItem[]>([]);
  const [openById, setOpenById] = useState<Record<string, boolean>>({});
  const [filterCs, setFilterCs] = useState<RingConditionsCKey[]>([]);
  const [summaryMode, setSummaryMode] = useState<"cs" | "stakeholder">("cs");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!comp || initialized) return;
    const hd: any = comp.healthData || {};
    const csd: Partial<RingConditionsScoreData> = hd.ringConditionsScoreData || {};
    const saved: any = (csd as any).filter || {};
    const initial: ScoreFilter =
      (sourceFilter as any) ||
      (saved?.mode
        ? (saved as any)
        : ({
            mode: "year",
            yearKey: listSelectableYearKeys(new Date(), 5)[0],
            aggregation: saved?.aggregation || "singleLatest",
            actorKey: saved?.actorKey,
          } as any));
    setLocalFilter(initial as any);
    setConditions(
      (((csd as any).conditions || []) as any[]).map((c) => {
        const legacyWind = (c?.windStrength === "H" || c?.windStrength === "M" || c?.windStrength === "L" ? c.windStrength : "M") as any;
        const rawInsts: any[] = Array.isArray(c?.instances) ? c.instances : [];
        const insts =
          rawInsts.length > 0
            ? rawInsts.map((i: any) => normalizeConditionInstance(i))
            : legacyWind
              ? [normalizeConditionInstance({ asOfDate: todayYmd(), actor: "", windStrength: legacyWind, rationale: "" } as any)]
              : [];
        return {
          id: String(c?.id || generateId()),
          stakeholderGroup: (c?.stakeholderGroup || "students") as any,
          direction: (c?.direction || "tailwind") as any,
          windStrength: (c?.windStrength || "M") as any, // legacy fallback
          instances: insts,
          cs: Array.isArray(c?.cs) && c.cs.length > 0 ? c.cs : (["Conviction"] as any),
          description: String(c?.description || ""),
          dateLogged: c?.dateLogged ? String(c.dateLogged) : "", // legacy
        };
      }),
    );
    const open: Record<string, boolean> = {};
    ((((csd as any).conditions || []) as any[]) as any[]).forEach((c) => {
      const id = String(c?.id || "");
      if (id) open[id] = false;
    });
    setOpenById(open);
    setInitialized(true);
  }, [comp, initialized, sourceFilter]);

  const actorOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (a: unknown) => {
      const clean = String(a ?? "").trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };
    for (const a of Array.isArray(globalActors) ? globalActors : []) add(a);
    for (const c of Array.isArray(conditions) ? conditions : []) {
      const insts: any[] = Array.isArray((c as any)?.instances) ? ((c as any).instances as any[]) : [];
      for (const inst of insts) add((inst as any)?.actor);
    }
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [conditions, globalActors]);

  useEffect(() => {
    if (!initialized) return;
    mergeGlobalActors(actorOptions);
  }, [actorOptions, initialized, mergeGlobalActors]);

  const computed = useMemo(() => {
    const data: RingConditionsScoreData = {
      actors: actorOptions,
      filter,
      conditions,
      finalConditionsScore: null,
      conditionsSum: null,
    };
    return calculateRingConditionsScoreFromData(data);
  }, [actorOptions, conditions, filter]);

  const cSummaries = useMemo(() => {
    return C_KEYS.map((k) => {
      const subset = (Array.isArray(conditions) ? conditions : []).filter((c) => {
        const tags: any[] = Array.isArray((c as any)?.cs) ? ((c as any).cs as any[]) : [];
        return tags.some((t) => String(t) === String(k));
      });
      const data: RingConditionsScoreData = {
        actors: actorOptions,
        filter,
        conditions: subset,
        finalConditionsScore: null,
        conditionsSum: null,
      };
      const res = calculateRingConditionsScoreFromData(data);
      return { key: k, label: k, score: res.score, count: subset.length };
    });
  }, [actorOptions, conditions, filter]);

  const stakeholderSummaries = useMemo(() => {
    const keys = Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[];
    return keys.map((k) => {
      const subset = (Array.isArray(conditions) ? conditions : []).filter((c) => String((c as any)?.stakeholderGroup) === String(k));
      const data: RingConditionsScoreData = {
        actors: actorOptions,
        filter,
        conditions: subset as any,
        finalConditionsScore: null,
        conditionsSum: null,
      };
      const res = calculateRingConditionsScoreFromData(data);
      return { key: k, label: STAKEHOLDER_LABEL[k], score: res.score, count: subset.length };
    });
  }, [actorOptions, conditions, filter]);

  const doSave = useCallback(
    (data: RingConditionsScoreData) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = comp?.healthData || {};
        const calc = calculateRingConditionsScoreFromData(data);
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              ringConditionsScoreData: {
                ...data,
                conditionsSum: calc.sum,
                finalConditionsScore: calc.score,
              },
            },
          },
        });
      }, 600);
    },
    [comp, nodeId, updateMutation],
  );

  useEffect(() => {
    if (!initialized) return;
    doSave({
      actors: actorOptions,
      filter,
      conditions,
      finalConditionsScore: computed.score,
      conditionsSum: computed.sum,
    });
  }, [actorOptions, computed.score, computed.sum, conditions, doSave, filter, initialized]);

  const addCondition = () => {
    const id = `cond_${generateId()}`;
    setConditions((prev) => [
      ...prev,
      {
        id,
        stakeholderGroup: "students",
        direction: "tailwind",
        windStrength: "M", // legacy fallback
        instances: [],
        cs: ["Conviction"],
        description: "",
        dateLogged: todayYmd(), // legacy
      },
    ]);
    setOpenById((prev) => ({ ...prev, [id]: true }));
  };

  const updateCondition = (id: string, patch: Partial<RingConditionItem>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? ({ ...c, ...patch } as any) : c)));
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
    setOpenById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const contributionFor = (c: RingConditionItem): number => {
    const insts: RingConditionsInstance[] = Array.isArray((c as any)?.instances) ? ((c as any).instances as any) : [];
    const eff = insts.length > 0 ? effectiveWindStrength(insts, filter) : hmlValue((c as any).windStrength);
    if (eff === null) return 0;
    const sign = c.direction === "tailwind" ? 1 : -1;
    return sign * eff;
  };

  const visibleConditions = useMemo(() => {
    if (filterCs.length === 0) return conditions;
    const want = new Set(filterCs);
    return conditions.filter((c) => {
      const tags = Array.isArray((c as any).cs) ? ((c as any).cs as any[]) : [];
      if (tags.length === 0) return false;
      return tags.some((t) => want.has(String(t) as any));
    });
  }, [conditions, filterCs]);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="ring-conditions-score-view">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Status &amp; Health
      </button>

      <ScoreFilterBar filter={filter} onChange={setFilter as any} actors={actorOptions} />

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="score-dashboard">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Conditions Score</h2>
              {(title || comp?.title) && <p className="text-sm text-gray-500 mt-0.5">{title || comp?.title}</p>}
            </div>
            <ScoreChip score={computed.score} size="lg" />
          </div>
        </div>

        <div className="px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold text-gray-600">Summary</div>
            <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white">
              <button
                type="button"
                className={cn("px-2.5 py-1 text-[11px] font-semibold transition-colors", summaryMode === "cs" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900")}
                onClick={() => setSummaryMode("cs")}
              >
                5Cs
              </button>
              <button
                type="button"
                className={cn("px-2.5 py-1 text-[11px] font-semibold transition-colors border-l border-gray-200", summaryMode === "stakeholder" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900")}
                onClick={() => setSummaryMode("stakeholder")}
              >
                Stakeholders
              </button>
            </div>
          </div>
        </div>

        <div className={cn("grid gap-3 p-4", summaryMode === "cs" ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6")} data-testid="dimension-tiles">
          {(summaryMode === "cs" ? (cSummaries as any) : (stakeholderSummaries as any)).map((t: any) => (
            <div key={t.key} className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2 cursor-default" data-testid={`dimension-tile-${t.key}`}>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs font-semibold text-gray-700 truncate">{t.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <ScoreChip score={t.score} size="sm" />
                <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                  {t.count}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Tailwinds add points and headwinds subtract points. Each condition contributes \(direction × wind strength\) based on its latest instance(s).
              The total maps to a 1–5 score (rescaled).
            </p>
          </div>
        </div>

        <div className="px-4 pb-4" data-testid="flags-section">
          <SignalFlags
            title="Flags"
            items={(Array.isArray(conditions) ? conditions : []).map((c: any) => {
              const sum =
                calculateRingConditionsSum({
                  actors: actorOptions as any,
                  filter,
                  conditions: [c],
                  finalConditionsScore: null,
                  conditionsSum: null,
                } as any) ?? null;
              const desc = String(c?.description || "").trim();
              const group = String(c?.stakeholderGroup || "").trim();
              const label = desc ? desc : group ? group : "Condition";
              return { key: String(c?.id || label), label, value: sum };
            })}
            maxPerSide={3}
            showValues={false}
            defaultOpen={false}
            testId="conditions-flags"
          />
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>{conditions.length} condition{conditions.length !== 1 ? "s" : ""}</span>
            <span>Sum: {computed.sum ?? "—"} (H=4, M=2, L=1)</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="conditions-list">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Conditions</h3>
          <Button size="sm" variant="outline" onClick={addCondition} className="h-8 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50">
            <Plus className="w-3.5 h-3.5" />
            Add condition
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-gray-700">Filter by 5Cs</Label>
              <span className="text-[10px] text-gray-400">
                Showing {visibleConditions.length}/{conditions.length}
              </span>
            </div>
            <CsFilterChips value={filterCs} onChange={setFilterCs} />
          </div>
          {conditions.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">No conditions yet. Add one to start scoring.</div>
          ) : (
            visibleConditions.map((c) => {
              const isOpen = !!openById[c.id];
              const contrib = contributionFor(c);
              const insts: RingConditionsInstance[] = Array.isArray((c as any)?.instances) ? ((c as any).instances as any) : [];
              const eff = insts.length > 0 ? effectiveWindStrength(insts, filter) : hmlValue((c as any).windStrength);
              const effLabel: Hml =
                eff === null ? "M" : eff >= 3.5 ? "H" : eff >= 1.5 ? "M" : "L";
              const csTags: string[] = Array.isArray((c as any)?.cs) ? ((c as any).cs as any[]).map((x) => String(x)) : [];
              return (
                <Collapsible
                  key={c.id}
                  open={isOpen}
                  onOpenChange={(v) => setOpenById((prev) => ({ ...prev, [c.id]: v }))}
                >
                  <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden" data-testid={`condition-${c.id}`}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 text-left hover:bg-gray-100/40 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-900">{STAKEHOLDER_LABEL[c.stakeholderGroup]}</span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] h-5",
                                  c.direction === "tailwind" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                                )}
                              >
                                {c.direction === "tailwind" ? "Tailwind" : "Headwind"}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                                Wind {effLabel}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-700">
                                {insts.length} inst
                              </Badge>
                              {csTags.slice(0, 2).map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-white text-gray-600 border-gray-200"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {c.description?.trim() ? c.description.trim() : <span className="italic text-gray-400">No description yet</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isOpen && "rotate-180")} />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeCondition(c.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-3 space-y-3 border-t border-gray-200 bg-white">
                        {/* Condition-level fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-gray-600">Stakeholder group</Label>
                            <select
                              value={c.stakeholderGroup}
                              onChange={(e) => updateCondition(c.id, { stakeholderGroup: e.target.value as any })}
                              className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                            >
                              {(Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[]).map((k) => (
                                <option key={k} value={k}>
                                  {STAKEHOLDER_LABEL[k]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-gray-600">Direction</Label>
                            <div className="mt-1">
                              <DirectionToggle value={c.direction} onChange={(v) => updateCondition(c.id, { direction: v })} />
                            </div>
                          </div>

                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-[11px] text-gray-600">Related 5Cs</Label>
                            <CsMultiSelect value={c.cs || []} onChange={(next) => updateCondition(c.id, { cs: next })} />
                          </div>

                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-[11px] text-gray-600">Description</Label>
                            <Textarea
                              value={c.description || ""}
                              onChange={(e) => updateCondition(c.id, { description: e.currentTarget.value })}
                              placeholder="Describe the condition…"
                              className="text-xs min-h-[64px] bg-white"
                            />
                          </div>
                        </div>

                        <Separator />

                        {/* Instances */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-semibold text-gray-700">Instances</div>
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", tinyChipClass(effLabel))}>
                                Effective: {eff === null ? "—" : `${effLabel} (${format1(eff)})`}
                              </span>
                            </div>
                          </div>

                          <RingConditionsInstancesInlineEditor
                            instances={insts as any}
                            onChange={(next) => updateCondition(c.id, { instances: next as any })}
                            actors={actorOptions}
                            onAddActor={(label) => addGlobalActor(label)}
                            testIdPrefix={`cond-${c.id}`}
                          />
                        </div>

                        <Separator />
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Effective wind: <span className="font-semibold">{eff === null ? "—" : `${effLabel} (${format1(eff)})`}</span></span>
                          <span>
                            Contribution: <span className="font-semibold">{format1(contrib)}</span>
                          </span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

