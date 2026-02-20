import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Info, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import type { RingConditionItem, RingConditionsCKey, RingConditionsScoreData, RingConditionsStakeholderGroup } from "@shared/schema";
import { calculateRingConditionsScoreFromData } from "@shared/ring-conditions-score";

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

  const color =
    score >= 4
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score >= 3
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
      {score}
    </div>
  );
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

interface RingConditionsScoreViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
}

export default function RingConditionsScoreView({ nodeId, title, onBack }: RingConditionsScoreViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stakeholderWeights, setStakeholderWeights] = useState<RingConditionsScoreData["stakeholderWeights"]>({
    students: "M",
    families: "M",
    educators_staff: "M",
    admin_district: "H",
    admin_school: "H",
    other_leaders: "L",
  });
  const [conditions, setConditions] = useState<RingConditionItem[]>([]);
  const [showWeights, setShowWeights] = useState(false);
  const [openById, setOpenById] = useState<Record<string, boolean>>({});
  const [filterCs, setFilterCs] = useState<RingConditionsCKey[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!comp || initialized) return;
    const hd: any = comp.healthData || {};
    const csd: Partial<RingConditionsScoreData> = hd.ringConditionsScoreData || {};
    setStakeholderWeights({
      students: (csd as any).stakeholderWeights?.students || "M",
      families: (csd as any).stakeholderWeights?.families || "M",
      educators_staff: (csd as any).stakeholderWeights?.educators_staff || "M",
      admin_district: (csd as any).stakeholderWeights?.admin_district || "H",
      admin_school: (csd as any).stakeholderWeights?.admin_school || "H",
      other_leaders: (csd as any).stakeholderWeights?.other_leaders || "L",
    } as any);
    setConditions((((csd as any).conditions || []) as any[]).map((c) => ({
      id: String(c?.id || generateId()),
      stakeholderGroup: (c?.stakeholderGroup || "students") as any,
      direction: (c?.direction || "tailwind") as any,
      windStrength: (c?.windStrength || "M") as any,
      cs: Array.isArray(c?.cs) && c.cs.length > 0 ? c.cs : (["Conviction"] as any),
      description: String(c?.description || ""),
      dateLogged: c?.dateLogged ? String(c.dateLogged) : "",
    })));
    const open: Record<string, boolean> = {};
    ((((csd as any).conditions || []) as any[]) as any[]).forEach((c) => {
      const id = String(c?.id || "");
      if (id) open[id] = false;
    });
    setOpenById(open);
    setInitialized(true);
  }, [comp, initialized]);

  const computed = useMemo(() => {
    const data: RingConditionsScoreData = {
      stakeholderWeights: stakeholderWeights as any,
      conditions,
      finalConditionsScore: null,
      conditionsSum: null,
    };
    return calculateRingConditionsScoreFromData(data);
  }, [conditions, stakeholderWeights]);

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
      stakeholderWeights: stakeholderWeights as any,
      conditions,
      finalConditionsScore: computed.score,
      conditionsSum: computed.sum,
    });
  }, [computed.score, computed.sum, conditions, doSave, initialized, stakeholderWeights]);

  const addCondition = () => {
    const id = `cond_${generateId()}`;
    setConditions((prev) => [
      ...prev,
      {
        id,
        stakeholderGroup: "students",
        direction: "tailwind",
        windStrength: "M",
        cs: ["Conviction"],
        description: "",
        dateLogged: todayYmd(),
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
    const map: Record<string, number> = { H: 4, M: 2, L: 1 };
    const sw = map[String((stakeholderWeights as any)[c.stakeholderGroup] || "M")] ?? 2;
    const ws = map[String(c.windStrength || "M")] ?? 2;
    const sign = c.direction === "tailwind" ? 1 : -1;
    return sign * sw * ws;
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

        <div className="px-4 pb-4 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Tailwinds add points and headwinds subtract points. Each condition contributes \(stakeholder weight × wind strength\).
              The total maps to a 1–5 score.
            </p>
          </div>
        </div>

        <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
          <span>{conditions.length} condition{conditions.length !== 1 ? "s" : ""}</span>
          <span>Sum: {computed.sum ?? "—"} (H=4, M=2, L=1)</span>
        </div>
      </div>

      <Collapsible open={showWeights} onOpenChange={setShowWeights}>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="stakeholder-weights">
          <CollapsibleTrigger asChild>
            <button className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="text-sm font-semibold text-gray-700">Advanced: stakeholder weights</div>
              <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", showWeights && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4 pt-1 space-y-3">
              <p className="text-xs text-gray-500">Defaults are pre-set. Edit only if needed.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[]).map((k) => (
                  <div key={k} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-800">{STAKEHOLDER_LABEL[k]}</div>
                    <HmlPicker value={(stakeholderWeights as any)[k] as Hml} onChange={(v) => setStakeholderWeights((prev) => ({ ...(prev as any), [k]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

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
                                Wind strength {c.windStrength}
                              </Badge>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-gray-600">Stakeholder group</Label>
                            <select
                              value={c.stakeholderGroup}
                              onChange={(e) => updateCondition(c.id, { stakeholderGroup: e.target.value as any })}
                              className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                            >
                              {(Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[]).map((k) => (
                                <option key={k} value={k}>
                                  {STAKEHOLDER_LABEL[k]}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-gray-600">Date logged</Label>
                            <input
                              type="date"
                              value={(c.dateLogged || "").slice(0, 10)}
                              onChange={(e) => updateCondition(c.id, { dateLogged: e.target.value })}
                              className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-gray-600">Direction</span>
                            <DirectionToggle value={c.direction} onChange={(v) => updateCondition(c.id, { direction: v })} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-gray-600">Wind strength</span>
                            <HmlPicker value={c.windStrength as any} onChange={(v) => updateCondition(c.id, { windStrength: v as any })} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-gray-600">Related Cs</Label>
                          <CsMultiSelect value={c.cs || []} onChange={(next) => updateCondition(c.id, { cs: next })} />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] text-gray-600">Description</Label>
                          <Textarea
                            value={c.description || ""}
                            onChange={(e) => updateCondition(c.id, { description: e.currentTarget.value })}
                            placeholder="Describe the condition…"
                            className="text-xs min-h-[70px] bg-white"
                          />
                        </div>

                        <Separator />
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>
                            Stakeholder weight: <span className="font-semibold">{(stakeholderWeights as any)[c.stakeholderGroup] || "M"}</span>
                          </span>
                          <span>
                            Contribution: <span className="font-semibold">{contrib}</span>
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

