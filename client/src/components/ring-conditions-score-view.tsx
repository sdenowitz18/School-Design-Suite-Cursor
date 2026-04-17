import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Info, Lock, Plus, Star, Trash2 } from "lucide-react";
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
  RingConditionStakeholderTag,
  RingConditionsCKey,
  RingConditionsScoreData,
  RingConditionsStakeholderGroup,
  ScoreFilter,
} from "@shared/schema";
import {
  calculateRingConditionsScoreFromData,
  calculateRingConditionsSum,
  conditionMatchesStakeholder,
  effectiveConditionWindStrength,
  getConditionStakeholderGroups,
  getPrimaryStakeholderGroup,
} from "@shared/ring-conditions-score";
import { UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import { listSelectableYearKeys, minAsOfDate, parseIsoDate } from "@shared/marking-period";
import ScoreFilterBar from "./score-filter-bar";
import { Input } from "@/components/ui/input";
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

function CsMultiSelect({
  value,
  primaryC,
  onChange,
  onPrimaryChange,
}: {
  value: RingConditionsCKey[];
  primaryC: RingConditionsCKey;
  onChange: (next: RingConditionsCKey[]) => void;
  onPrimaryChange: (next: RingConditionsCKey) => void;
}) {
  const set = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5 items-center" data-testid="c-multiselect">
      {C_KEYS.map((k) => {
        const active = set.has(k);
        const isPrimary = active && primaryC === k;
        return (
          <div key={k} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const next = new Set(set);
                if (active) {
                  if (next.size <= 1) return;
                  next.delete(k);
                  const arr = Array.from(next) as RingConditionsCKey[];
                  onChange(arr);
                  if (primaryC === k) onPrimaryChange(arr[0]);
                } else {
                  const arr = [...Array.from(next), k] as RingConditionsCKey[];
                  onChange(arr);
                }
              }}
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors inline-flex items-center gap-1",
                active ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800",
              )}
              aria-pressed={active}
            >
              {k}
            </button>
            {active ? (
              <button
                type="button"
                title="Primary C for this condition"
                onClick={() => onPrimaryChange(k)}
                className={cn(
                  "p-0.5 rounded border border-transparent hover:border-amber-200",
                  isPrimary ? "text-amber-600" : "text-gray-300 hover:text-amber-500",
                )}
                aria-label={`Set ${k} as primary C`}
              >
                <Star className={cn("w-3 h-3", isPrimary && "fill-amber-400")} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StakeholderTagsPicker({
  value,
  onChange,
}: {
  value: RingConditionStakeholderTag[];
  onChange: (next: RingConditionStakeholderTag[]) => void;
}) {
  const keys = Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[];
  const byGroup = new Map(value.map((t) => [t.group, t] as const));

  const toggle = (g: RingConditionsStakeholderGroup) => {
    if (byGroup.has(g)) {
      if (value.length <= 1) return;
      const next = value.filter((t) => t.group !== g);
      if (!next.some((t) => t.primary)) next[0] = { group: next[0].group, primary: true };
      onChange(next);
    } else {
      if (value.length === 0) onChange([{ group: g, primary: true }]);
      else onChange([...value, { group: g, primary: false }]);
    }
  };

  const setPrimary = (g: RingConditionsStakeholderGroup) => {
    onChange(value.map((t) => ({ ...t, primary: t.group === g })));
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center" data-testid="stakeholder-multiselect">
      {keys.map((g) => {
        const active = byGroup.has(g);
        const isPrimary = !!value.find((t) => t.group === g)?.primary;
        return (
          <div key={g} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => toggle(g)}
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors max-w-[200px] truncate",
                active ? "bg-violet-50 border-violet-200 text-violet-800" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800",
              )}
              aria-pressed={active}
            >
              {STAKEHOLDER_LABEL[g]}
            </button>
            {active ? (
              <button
                type="button"
                title="Primary stakeholder group"
                onClick={() => setPrimary(g)}
                className={cn(
                  "p-0.5 rounded border border-transparent hover:border-amber-200 shrink-0",
                  isPrimary ? "text-amber-600" : "text-gray-300 hover:text-amber-500",
                )}
                aria-label={`Set ${STAKEHOLDER_LABEL[g]} as primary`}
              >
                <Star className={cn("w-3 h-3", isPrimary && "fill-amber-400")} />
              </button>
            ) : null}
          </div>
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

function StakeholderFilterChips({
  value,
  onChange,
}: {
  value: RingConditionsStakeholderGroup[];
  onChange: (next: RingConditionsStakeholderGroup[]) => void;
}) {
  const set = new Set(value);
  const keys = Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[];
  const toggle = (g: RingConditionsStakeholderGroup) => {
    const next = new Set(set);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="stakeholder-conditions-filter">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn(
          "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
          value.length === 0 ? "bg-violet-50 border-violet-200 text-violet-800" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800",
        )}
        aria-pressed={value.length === 0}
      >
        All
      </button>
      {keys.map((g) => {
        const active = set.has(g);
        return (
          <button
            key={g}
            type="button"
            onClick={() => toggle(g)}
            className={cn(
              "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors max-w-[160px] truncate",
              active ? "bg-violet-50 border-violet-200 text-violet-800" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800",
            )}
            aria-pressed={active}
          >
            {STAKEHOLDER_LABEL[g]}
          </button>
        );
      })}
    </div>
  );
}

function normalizeLoadedCondition(raw: any): RingConditionItem {
  const id = String(raw?.id || generateId());
  const direction = raw?.direction === "headwind" ? "headwind" : "tailwind";
  const cs: RingConditionsCKey[] =
    Array.isArray(raw?.cs) && raw.cs.length > 0 ? (raw.cs as RingConditionsCKey[]) : (["Conviction"] as RingConditionsCKey[]);
  const primaryC: RingConditionsCKey = raw?.primaryC && cs.includes(raw.primaryC) ? raw.primaryC : cs[0];

  const allowedGroups = new Set(Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[]);
  let stakeholderTags: RingConditionStakeholderTag[] = [];
  if (Array.isArray(raw?.stakeholderTags) && raw.stakeholderTags.length > 0) {
    stakeholderTags = raw.stakeholderTags
      .map((t: any) => ({
        group: t?.group as RingConditionsStakeholderGroup,
        primary: !!t?.primary,
      }))
      .filter((t: RingConditionStakeholderTag) => allowedGroups.has(t.group));
    if (stakeholderTags.length === 0) stakeholderTags = [{ group: "students", primary: true }];
  } else if (raw?.stakeholderGroup && allowedGroups.has(raw.stakeholderGroup)) {
    stakeholderTags = [{ group: raw.stakeholderGroup as RingConditionsStakeholderGroup, primary: true }];
  } else {
    stakeholderTags = [{ group: "students", primary: true }];
  }
  if (!stakeholderTags.some((t) => t.primary)) stakeholderTags[0] = { ...stakeholderTags[0], primary: true };
  if (stakeholderTags.filter((t) => t.primary).length !== 1) {
    stakeholderTags = stakeholderTags.map((t, i) => ({ ...t, primary: i === 0 }));
  }

  let windStrength: Hml = "M";
  if (raw?.windStrength === "H" || raw?.windStrength === "M" || raw?.windStrength === "L") windStrength = raw.windStrength;
  let asOfDate = String(raw?.asOfDate || raw?.dateLogged || "");
  let actor = String(raw?.actor || "");
  let rationale = String(raw?.rationale || "");

  const rawInsts: any[] = Array.isArray(raw?.instances) ? raw.instances : [];
  if (rawInsts.length > 0) {
    const parsed = rawInsts
      .map((i: any) => ({ i, t: parseIsoDate(String(i?.asOfDate || ""))?.getTime() ?? 0 }))
      .sort((a, b) => a.t - b.t);
    const latest = parsed[parsed.length - 1]?.i;
    if (latest) {
      asOfDate = String(latest.asOfDate || asOfDate || todayYmd());
      actor = String(latest.actor ?? actor);
      if (latest.windStrength === "H" || latest.windStrength === "M" || latest.windStrength === "L") windStrength = latest.windStrength;
      if (latest.rationale) rationale = String(latest.rationale);
    }
  }
  if (!asOfDate) asOfDate = todayYmd();

  return {
    id,
    direction,
    windStrength,
    asOfDate,
    actor,
    rationale: rationale || undefined,
    stakeholderTags,
    cs,
    primaryC,
    description: String(raw?.description || ""),
    instances: [],
  } as RingConditionItem;
}

function ConditionLogFields({
  asOfDate,
  actor,
  windStrength,
  rationale,
  actors,
  onAddActor,
  onPatch,
  testIdPrefix,
}: {
  asOfDate: string;
  actor: string;
  windStrength: Hml;
  rationale?: string;
  actors: string[];
  onAddActor: (label: string) => void;
  onPatch: (patch: Partial<Pick<RingConditionItem, "asOfDate" | "actor" | "windStrength" | "rationale">>) => void;
  testIdPrefix?: string;
}) {
  const minDate = minAsOfDate(new Date(), 5);
  const actorOptions = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const a of Array.isArray(actors) ? actors : []) {
      const clean = String(a ?? "").trim();
      if (!clean) continue;
      const key = normActor(clean);
      if (!key || key === UNKNOWN_ACTOR_KEY) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: clean });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [actors]);

  const actorLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of actorOptions) m.set(a.key, a.label);
    return m;
  }, [actorOptions]);

  const ADD_NEW_KEY = "__add_new__";
  const [draftActor, setDraftActor] = useState("");
  const [addingActor, setAddingActor] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState(false);

  const actorValue = normActor(actor);
  const isAdding = addingActor;

  return (
    <div className="space-y-2" data-testid={testIdPrefix ? `${testIdPrefix}-log-fields` : undefined}>
      <div className="text-xs font-semibold text-gray-700">Log</div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-600">Actor</span>
          <select
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
            value={isAdding ? ADD_NEW_KEY : actorValue}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v === ADD_NEW_KEY) {
                setAddingActor(true);
                return;
              }
              setAddingActor(false);
              if (v === UNKNOWN_ACTOR_KEY) return onPatch({ actor: "" });
              const label = actorLabelByKey.get(v) || String(v);
              onPatch({ actor: label });
            }}
            data-testid={testIdPrefix ? `${testIdPrefix}-actor` : undefined}
          >
            <option value={UNKNOWN_ACTOR_KEY}>Unknown</option>
            {actorOptions.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
            <option value={ADD_NEW_KEY}>Add new…</option>
          </select>
        </div>

        {isAdding ? (
          <div className="flex items-center gap-2">
            <Input
              value={draftActor}
              onChange={(e) => setDraftActor(e.currentTarget?.value ?? "")}
              placeholder="New actor…"
              className="h-8 w-[150px] text-xs bg-white"
              data-testid={testIdPrefix ? `${testIdPrefix}-actor-draft` : undefined}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              onClick={() => {
                const clean = String(draftActor || "").trim();
                if (!clean) return;
                onAddActor(clean);
                onPatch({ actor: clean });
                setDraftActor("");
                setAddingActor(false);
              }}
              data-testid={testIdPrefix ? `${testIdPrefix}-actor-add` : undefined}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-[11px] text-gray-500"
              onClick={() => {
                setDraftActor("");
                setAddingActor(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-600">As-of</span>
          <Input
            type="date"
            className="h-8 w-[150px] text-xs bg-white"
            value={String(asOfDate || "")}
            min={minDate}
            onChange={(e) => onPatch({ asOfDate: e.currentTarget.value })}
            data-testid={testIdPrefix ? `${testIdPrefix}-date` : undefined}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-600">Wind</span>
          <select
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
            value={String(windStrength || "M")}
            onChange={(e) => onPatch({ windStrength: e.currentTarget.value as Hml })}
            data-testid={testIdPrefix ? `${testIdPrefix}-wind` : undefined}
          >
            <option value="H">H</option>
            <option value="M">M</option>
            <option value="L">L</option>
          </select>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setRationaleOpen((v) => !v)}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
        >
          {rationaleOpen ? "Hide rationale" : rationale ? "Edit rationale" : "Add rationale"}
        </button>
        {rationaleOpen ? (
          <div className="mt-2">
            <Textarea
              value={String(rationale || "")}
              onChange={(e) => onPatch({ rationale: e.currentTarget.value })}
              placeholder="Add rationale…"
              className="text-xs min-h-[60px] bg-white"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface RingConditionsScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  sourceFilter?: ScoreFilter;
  onFilterChange?: (next: ScoreFilter) => void;
  hideShellBackButton?: boolean;
}

export default function RingConditionsScoreView({
  nodeId,
  title,
  onBack,
  sourceFilter,
  onFilterChange,
  hideShellBackButton = false,
}: RingConditionsScoreViewProps) {
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
  const [filterStakeholders, setFilterStakeholders] = useState<RingConditionsStakeholderGroup[]>([]);
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
    setConditions((((csd as any).conditions || []) as any[]).map((c) => normalizeLoadedCondition(c)));
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
      add((c as any)?.actor);
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
      const subset = (Array.isArray(conditions) ? conditions : []).filter((c) => conditionMatchesStakeholder(c, k));
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
    const row = normalizeLoadedCondition({
      id,
      stakeholderTags: [{ group: "students", primary: true }],
      direction: "tailwind",
      windStrength: "M",
      asOfDate: todayYmd(),
      actor: "",
      cs: ["Conviction"],
      primaryC: "Conviction",
      description: "",
    });
    setConditions((prev) => [...prev, row]);
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
    const eff = effectiveConditionWindStrength(c, filter);
    if (eff === null) return 0;
    const sign = c.direction === "tailwind" ? 1 : -1;
    return sign * eff;
  };

  const visibleConditions = useMemo(() => {
    let list = conditions;
    if (filterCs.length > 0) {
      const want = new Set(filterCs);
      list = list.filter((c) => {
        const tags = Array.isArray((c as any).cs) ? ((c as any).cs as any[]) : [];
        if (tags.length === 0) return false;
        return tags.some((t) => want.has(String(t) as any));
      });
    }
    if (filterStakeholders.length > 0) {
      const want = new Set(filterStakeholders);
      list = list.filter((c) => getConditionStakeholderGroups(c).some((g) => want.has(g)));
    }
    return list;
  }, [conditions, filterCs, filterStakeholders]);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="ring-conditions-score-view">
      {!hideShellBackButton ? (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Status &amp; Health
        </button>
      ) : null}

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
              Tailwinds add points and headwinds subtract points. Each logged condition contributes once to the overall score (direction × wind strength).
              Rollups by 5C or stakeholder include the same condition in every matching category. The total maps to a 1–5 score (rescaled).
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
              const group = getPrimaryStakeholderGroup(c);
              const label = desc ? desc : group ? STAKEHOLDER_LABEL[group] : "Condition";
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
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-gray-700">Filter list (5Cs)</Label>
              <span className="text-[10px] text-gray-400">
                Showing {visibleConditions.length}/{conditions.length}
              </span>
            </div>
            <CsFilterChips value={filterCs} onChange={setFilterCs} />
            <div className="space-y-2">
              <Label className="text-xs text-gray-700">Filter list (stakeholders)</Label>
              <StakeholderFilterChips value={filterStakeholders} onChange={setFilterStakeholders} />
            </div>
          </div>
          {conditions.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">No conditions yet. Add one to start scoring.</div>
          ) : (
            visibleConditions.map((c) => {
              const isOpen = !!openById[c.id];
              const contrib = contributionFor(c);
              const eff = effectiveConditionWindStrength(c, filter);
              const effLabel: Hml =
                eff === null ? "M" : eff >= 3.5 ? "H" : eff >= 1.5 ? "M" : "L";
              const csTags: string[] = Array.isArray((c as any)?.cs) ? ((c as any).cs as any[]).map((x) => String(x)) : [];
              const primarySg = getPrimaryStakeholderGroup(c);
              const sgCount = getConditionStakeholderGroups(c).length;
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
                              <span className="text-xs font-semibold text-gray-900">
                                {primarySg ? STAKEHOLDER_LABEL[primarySg] : "Stakeholders"}
                                {sgCount > 1 ? (
                                  <span className="text-gray-500 font-normal"> +{sgCount - 1}</span>
                                ) : null}
                              </span>
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
                                Wind {c.windStrength}
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
                        <div className="grid grid-cols-1 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-gray-600">Stakeholder groups (star = primary)</Label>
                            <StakeholderTagsPicker
                              value={c.stakeholderTags || []}
                              onChange={(next) => updateCondition(c.id, { stakeholderTags: next })}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-gray-600">Direction</Label>
                            <div className="mt-1">
                              <DirectionToggle value={c.direction} onChange={(v) => updateCondition(c.id, { direction: v })} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-gray-600">Related 5Cs (star = primary)</Label>
                            <CsMultiSelect
                              value={c.cs || []}
                              primaryC={
                                c.primaryC && (c.cs || []).includes(c.primaryC) ? c.primaryC : (c.cs || [])[0] || "Conviction"
                              }
                              onChange={(next) => {
                                const pc =
                                  c.primaryC && next.includes(c.primaryC) ? c.primaryC : next[0];
                                updateCondition(c.id, { cs: next, primaryC: pc });
                              }}
                              onPrimaryChange={(pc) => updateCondition(c.id, { primaryC: pc })}
                            />
                          </div>

                          <div className="space-y-1">
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

                        <ConditionLogFields
                          asOfDate={c.asOfDate || ""}
                          actor={c.actor || ""}
                          windStrength={(c.windStrength === "H" || c.windStrength === "M" || c.windStrength === "L" ? c.windStrength : "M") as Hml}
                          rationale={c.rationale}
                          actors={actorOptions}
                          onAddActor={(label) => addGlobalActor(label)}
                          onPatch={(patch) => updateCondition(c.id, patch)}
                          testIdPrefix={`cond-${c.id}`}
                        />

                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", tinyChipClass(effLabel))}>
                            In selected period: {eff === null ? "—" : `${effLabel} (${format1(eff)})`}
                          </span>
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

