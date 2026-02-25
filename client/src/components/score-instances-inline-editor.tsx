"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ScoreInstance } from "@shared/schema";
import { UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import { minAsOfDate, toIsoDateString } from "@shared/marking-period";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeInstance(partial?: Partial<ScoreInstance>): ScoreInstance {
  return {
    id: partial?.id || genId(),
    actor: String(partial?.actor || ""),
    asOfDate: String(partial?.asOfDate || toIsoDateString(new Date())),
    score: partial?.score ?? null,
    weight: (partial?.weight === "H" || partial?.weight === "M" || partial?.weight === "L" ? partial.weight : "M") as any,
    rationale: String((partial as any)?.rationale || ""),
  };
}

export default function ScoreInstancesInlineEditor({
  instances,
  onChange,
  actors,
  onAddActor,
  label = "Instances",
  className,
  testIdPrefix,
  showRationale = true,
}: {
  instances: ScoreInstance[];
  onChange: (next: ScoreInstance[]) => void;
  actors: string[];
  onAddActor?: (label: string) => void;
  label?: string;
  className?: string;
  testIdPrefix?: string;
  showRationale?: boolean;
}) {
  const list = useMemo(() => (Array.isArray(instances) ? instances.map((x) => normalizeInstance(x)) : []), [instances]);
  const minDate = useMemo(() => minAsOfDate(new Date(), 5), []);

  const [openRationale, setOpenRationale] = useState<Record<string, boolean>>({});

  const update = (id: string, patch: Partial<ScoreInstance>) => {
    onChange(list.map((i) => (i.id === id ? normalizeInstance({ ...i, ...patch }) : i)));
  };

  const add = () => {
    onChange([...list, normalizeInstance()]);
  };

  const remove = (id: string) => {
    onChange(list.filter((i) => i.id !== id));
  };

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
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [addingById, setAddingById] = useState<Record<string, boolean>>({});

  return (
    <div className={cn("space-y-3", className)} data-testid={testIdPrefix ? `${testIdPrefix}-inline-editor` : undefined}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-gray-500">{label}</div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={add}>
          <Plus className="w-3.5 h-3.5" /> Add instance
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="text-xs text-gray-400 italic">No instances yet.</div>
      ) : (
        <div className="space-y-2">
          {list.map((inst) => {
            const instKey = String(inst?.id || "");
            const actorValue = normActor(inst?.actor);
            const rationaleOpen = !!openRationale[instKey];
            const isAdding = !!addingById[instKey];
            return (
              <div key={instKey} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-600">Actor</span>
                    <select
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                      value={isAdding ? ADD_NEW_KEY : actorValue}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        if (v === ADD_NEW_KEY) {
                          setAddingById((prev) => ({ ...prev, [instKey]: true }));
                          return;
                        }
                        setAddingById((prev) => ({ ...prev, [instKey]: false }));
                        if (v === UNKNOWN_ACTOR_KEY) return update(instKey, { actor: "" });
                        const label = actorLabelByKey.get(v) || String(v);
                        update(instKey, { actor: label });
                      }}
                      data-testid={testIdPrefix ? `${testIdPrefix}-actor-${instKey}` : undefined}
                    >
                      <option value={UNKNOWN_ACTOR_KEY}>Unknown</option>
                      {actorOptions.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                      {onAddActor ? <option value={ADD_NEW_KEY}>Add new…</option> : null}
                    </select>
                  </div>

                  {isAdding && onAddActor ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={draftById[instKey] || ""}
                        onChange={(e) => {
                          const v = e.currentTarget?.value ?? "";
                          setDraftById((prev) => ({ ...prev, [instKey]: v }));
                        }}
                        placeholder="New actor…"
                        className="h-8 w-[150px] text-xs bg-white"
                        data-testid={testIdPrefix ? `${testIdPrefix}-actor-draft-${instKey}` : undefined}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px]"
                        onClick={() => {
                          const clean = String(draftById[instKey] || "").trim();
                          if (!clean) return;
                          onAddActor(clean);
                          update(instKey, { actor: clean });
                          setDraftById((prev) => ({ ...prev, [instKey]: "" }));
                          setAddingById((prev) => ({ ...prev, [instKey]: false }));
                        }}
                        data-testid={testIdPrefix ? `${testIdPrefix}-actor-add-${instKey}` : undefined}
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[11px] text-gray-500"
                        onClick={() => {
                          setDraftById((prev) => ({ ...prev, [instKey]: "" }));
                          setAddingById((prev) => ({ ...prev, [instKey]: false }));
                        }}
                        data-testid={testIdPrefix ? `${testIdPrefix}-actor-cancel-${instKey}` : undefined}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-600">As-of</span>
                    <Input
                      type="date"
                      className="h-8 w-[150px] text-xs"
                      value={String(inst?.asOfDate || "")}
                      min={minDate}
                      onChange={(e) => update(instKey, { asOfDate: e.currentTarget.value })}
                      data-testid={testIdPrefix ? `${testIdPrefix}-date-${instKey}` : undefined}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-600">Score</span>
                    <select
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                      value={inst?.score === null || inst?.score === undefined ? "" : String(inst.score)}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        update(instKey, { score: v ? (Number(v) as any) : null });
                      }}
                      data-testid={testIdPrefix ? `${testIdPrefix}-score-${instKey}` : undefined}
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={String(n)}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-600">Weight</span>
                    <select
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                      value={String(inst?.weight || "M")}
                      onChange={(e) => update(instKey, { weight: e.currentTarget.value as any })}
                      data-testid={testIdPrefix ? `${testIdPrefix}-weight-${instKey}` : undefined}
                    >
                      <option value="H">H</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                    </select>
                  </div>

                  {showRationale ? (
                    <button
                      type="button"
                      className={cn(
                        "ml-auto h-8 px-2 text-[10px] font-semibold rounded-md border transition-colors inline-flex items-center gap-1",
                        rationaleOpen ? "bg-white border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-500 hover:text-gray-900",
                      )}
                      onClick={() => setOpenRationale((prev) => ({ ...prev, [instKey]: !prev[instKey] }))}
                      data-testid={testIdPrefix ? `${testIdPrefix}-rationale-toggle-${instKey}` : undefined}
                      aria-expanded={rationaleOpen}
                    >
                      Rationale
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", rationaleOpen && "rotate-180")} />
                    </button>
                  ) : null}

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-gray-400 hover:text-red-600"
                    onClick={() => remove(instKey)}
                    data-testid={testIdPrefix ? `${testIdPrefix}-remove-${instKey}` : undefined}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {showRationale && rationaleOpen ? (
                  <div className="pt-1">
                    <Textarea
                      value={String((inst as any)?.rationale || "")}
                      onChange={(e) => update(instKey, { rationale: e.currentTarget.value } as any)}
                      className="min-h-[72px] text-xs bg-white"
                      placeholder="Why this score?"
                      data-testid={testIdPrefix ? `${testIdPrefix}-rationale-${instKey}` : undefined}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

