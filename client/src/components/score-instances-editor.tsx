"use client";

import React, { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ScoreInstance } from "@shared/schema";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeInstance(partial?: Partial<ScoreInstance>): ScoreInstance {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return {
    id: partial?.id || genId(),
    actor: String(partial?.actor || ""),
    asOfDate: String(partial?.asOfDate || `${yyyy}-${mm}-${dd}`),
    score: partial?.score ?? null,
    weight: (partial?.weight === "H" || partial?.weight === "M" || partial?.weight === "L" ? partial.weight : "M") as any,
    rationale: String((partial as any)?.rationale || ""),
  };
}

function WeightPills({
  value,
  onChange,
}: {
  value: "H" | "M" | "L";
  onChange: (v: "H" | "M" | "L") => void;
}) {
  const pill = (v: "H" | "M" | "L", label: string) => (
    <button
      type="button"
      className={cn(
        "px-2 py-1 rounded-full border text-[11px] font-bold transition-colors",
        value === v ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
      )}
      onClick={() => onChange(v)}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      {pill("H", "High")}
      {pill("M", "Med")}
      {pill("L", "Low")}
    </div>
  );
}

export default function ScoreInstancesEditor({
  label,
  instances,
  onChange,
  compact = false,
}: {
  label: string;
  instances: ScoreInstance[];
  onChange: (next: ScoreInstance[]) => void;
  compact?: boolean;
}) {
  const list = useMemo(() => (Array.isArray(instances) ? instances.map((x) => normalizeInstance(x)) : []), [instances]);

  const add = () => onChange([...list, normalizeInstance()]);
  const remove = (id: string) => onChange(list.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<ScoreInstance>) =>
    onChange(list.map((i) => (i.id === id ? normalizeInstance({ ...i, ...patch }) : i)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</div>
        <Button size="sm" variant="outline" className="h-8 gap-2" onClick={add} type="button">
          <Plus className="w-4 h-4" /> Add instance
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="text-sm text-gray-500">No instances yet.</div>
      ) : (
        <div className={cn("space-y-3", compact && "space-y-2")}>
          {list.map((inst) => (
            <div key={inst.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-gray-700">Instance</div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => remove(inst.id)}
                  type="button"
                  title="Remove instance"
                >
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </Button>
              </div>

              <div className={cn("mt-3 grid grid-cols-1 md:grid-cols-2 gap-3", compact && "md:grid-cols-3")}>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Actor</Label>
                  <Input value={inst.actor} onChange={(e) => update(inst.id, { actor: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">As of date</Label>
                  <Input
                    type="date"
                    value={inst.asOfDate}
                    onChange={(e) => update(inst.id, { asOfDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Score (1–5)</Label>
                  <Input
                    inputMode="numeric"
                    value={inst.score === null ? "" : String(inst.score)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) return update(inst.id, { score: null });
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      const i = Math.round(n);
                      if (i < 1 || i > 5) return;
                      update(inst.id, { score: i as any });
                    }}
                    placeholder="1–5"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs text-gray-500">Instance weight</Label>
                  <WeightPills value={inst.weight as any} onChange={(v) => update(inst.id, { weight: v as any })} />
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <Label className="text-xs text-gray-500">Rationale</Label>
                <Textarea
                  value={(inst as any).rationale || ""}
                  onChange={(e) => update(inst.id, { rationale: e.target.value } as any)}
                  className="min-h-[72px]"
                  placeholder="Why this score?"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

