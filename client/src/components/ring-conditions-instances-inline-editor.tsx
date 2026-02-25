"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RingConditionsInstance } from "@shared/schema";
import { UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import { minAsOfDate, toIsoDateString } from "@shared/marking-period";
import { Textarea } from "@/components/ui/textarea";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeInstance(partial?: Partial<RingConditionsInstance>): RingConditionsInstance {
  return {
    id: String((partial as any)?.id || genId()),
    actor: String((partial as any)?.actor || ""),
    asOfDate: String((partial as any)?.asOfDate || toIsoDateString(new Date())),
    windStrength:
      (partial as any)?.windStrength === "H" || (partial as any)?.windStrength === "M" || (partial as any)?.windStrength === "L"
        ? ((partial as any).windStrength as any)
        : ("M" as any),
    rationale: String((partial as any)?.rationale || ""),
  } as any;
}

export default function RingConditionsInstancesInlineEditor({
  instances,
  onChange,
  actors,
  onAddActor,
  className,
  testIdPrefix,
}: {
  instances: RingConditionsInstance[];
  onChange: (next: RingConditionsInstance[]) => void;
  actors: string[];
  onAddActor?: (label: string) => void;
  className?: string;
  testIdPrefix?: string;
}) {
  const list = useMemo(() => (Array.isArray(instances) ? instances.map((x) => normalizeInstance(x)) : []), [instances]);
  const minDate = useMemo(() => minAsOfDate(new Date(), 5), []);

  const add = () => onChange([...list, normalizeInstance()]);
  const remove = (id: string) => onChange(list.filter((i) => String((i as any)?.id) !== String(id)));
  const update = (id: string, patch: Partial<RingConditionsInstance>) =>
    onChange(list.map((i) => (String((i as any)?.id) === String(id) ? normalizeInstance({ ...(i as any), ...(patch as any) }) : i)));

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
  const [openRationale, setOpenRationale] = useState<Record<string, boolean>>({});

  return (
    <div className={cn("space-y-3", className)} data-testid={testIdPrefix ? `${testIdPrefix}-inline-editor` : undefined}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-gray-500">Instances</div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={add}>
          <Plus className="w-3.5 h-3.5" /> Add instance
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="text-xs text-gray-400 italic">No instances yet.</div>
      ) : (
        <div className="space-y-2">
          {list.map((inst: any) => {
            const instKey = String(inst?.id || "");
            const actorValue = normActor(inst?.actor);
            const isAdding = !!addingById[instKey];
            const rationaleOpen = !!openRationale[instKey];
            return (
              <div key={instKey} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
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
                        if (v === UNKNOWN_ACTOR_KEY) return update(instKey, { actor: "" } as any);
                        const label = actorLabelByKey.get(v) || String(v);
                        update(instKey, { actor: label } as any);
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
                          update(instKey, { actor: clean } as any);
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
                      className="h-8 w-[150px] text-xs bg-white"
                      value={String(inst?.asOfDate || "")}
                      min={minDate}
                      onChange={(e) => update(instKey, { asOfDate: e.currentTarget.value } as any)}
                      data-testid={testIdPrefix ? `${testIdPrefix}-date-${instKey}` : undefined}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-600">Wind</span>
                    <select
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
                      value={String(inst?.windStrength || "M")}
                      onChange={(e) => update(instKey, { windStrength: e.currentTarget.value as any } as any)}
                      data-testid={testIdPrefix ? `${testIdPrefix}-wind-${instKey}` : undefined}
                    >
                      <option value="H">H</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                    </select>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-8 px-2 text-gray-400 hover:text-red-600"
                    onClick={() => remove(instKey)}
                    data-testid={testIdPrefix ? `${testIdPrefix}-remove-${instKey}` : undefined}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setOpenRationale((prev) => ({ ...prev, [instKey]: !prev[instKey] }))}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                    data-testid={testIdPrefix ? `${testIdPrefix}-rationale-toggle-${instKey}` : undefined}
                  >
                    {rationaleOpen ? "Hide rationale" : inst?.rationale ? "Edit rationale" : "Add rationale"}
                  </button>
                  {rationaleOpen ? (
                    <div className="mt-2">
                      <Textarea
                        value={String(inst?.rationale || "")}
                        onChange={(e) => update(instKey, { rationale: e.currentTarget.value } as any)}
                        placeholder="Add rationale…"
                        className="text-xs min-h-[60px] bg-white"
                        data-testid={testIdPrefix ? `${testIdPrefix}-rationale-${instKey}` : undefined}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

