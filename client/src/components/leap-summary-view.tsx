import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { LEAP_DESCRIPTIONS, LEAP_SCHEMA } from "./designed-experience-schemas";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

const FIXED_LEAPS: string[] = LEAP_SCHEMA["Level 1"] ?? [];

const PRIORITY_STYLES: Record<string, string> = {
  H: "bg-red-50 border-red-200 text-red-700",
  M: "bg-amber-50 border-amber-200 text-amber-700",
  L: "bg-green-50 border-green-200 text-green-700",
};

function PriorityPicker({
  value,
  onChange,
}: {
  value: "H" | "M" | "L" | null;
  onChange: (p: "H" | "M" | "L") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0">
      {(["H", "M", "L"] as const).map((p, i) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "px-3 py-0.5 text-[11px] font-bold transition-colors",
            i > 0 && "border-l border-gray-200",
            value === p ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
          )}
        >
          {p === "H" ? "High" : p === "M" ? "Med" : "Low"}
        </button>
      ))}
    </div>
  );
}

export interface LeapSummaryViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  /** When set, that leap/principle row starts expanded (e.g. deep link from Designed Experience pills). */
  focusLeapLabel?: string | null;
  /** Optional: open dedicated leap detail (e.g. from “View details” on a selected leap). */
  onOpenLeapDetail?: (label: string) => void;
}

export default function LeapSummaryView({ nodeId, title, onBack, focusLeapLabel, onOpenLeapDetail }: LeapSummaryViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const isOverall = String(nodeId || "") === "overall" || String((comp as any)?.nodeId || "") === "overall";
  const { data: allComponents } = useQuery({ ...(componentQueries.all as any), enabled: isOverall } as any);
  const updateMutation = useUpdateComponent();
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [notesByKey, setNotesByKey] = useState<Record<string, string>>({});
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [newPrincipleText, setNewPrincipleText] = useState("");
  const [addingPrinciple, setAddingPrinciple] = useState(false);

  // ── Derived data ───────────────────────────────────────────
  const deAims = React.useMemo(() => {
    const de: any = (comp as any)?.designedExperienceData || {};
    const kde = de.keyDesignElements || {};
    return Array.isArray(kde.aims) ? kde.aims : [];
  }, [comp]);

  const deLeaps = React.useMemo(
    () => deAims.filter((a: any) => a?.type === "leap"),
    [deAims],
  );

  const ringComponents = React.useMemo(() => {
    if (!isOverall || !allComponents) return [];
    return (Array.isArray(allComponents) ? allComponents : []).filter(
      (c: any) => String(c?.nodeId || c?.node_id || "") !== "overall",
    );
  }, [isOverall, allComponents]);

  useEffect(() => {
    if (!focusLeapLabel) return;
    setExpandedDescriptions((prev) => new Set(prev).add(norm(focusLeapLabel)));
  }, [focusLeapLabel]);

  // ── Sync notes from server ──────────────────────────────────
  useEffect(() => {
    if (notesInitialized || deLeaps.length === 0) return;
    const initial: Record<string, string> = {};
    for (const a of deLeaps) {
      if (a?.label && a?.notes) initial[norm(a.label)] = a.notes;
    }
    setNotesByKey(initial);
    setNotesInitialized(true);
  }, [deLeaps, notesInitialized]);

  // ── Helpers ─────────────────────────────────────────────────
  function getLeapAim(label: string): any | undefined {
    return deLeaps.find((a: any) => norm(a.label) === norm(label));
  }

  function isSelected(label: string): boolean {
    return !!getLeapAim(label);
  }

  function getPriority(label: string): "H" | "M" | "L" | null {
    return getLeapAim(label)?.overrideLevel ?? null;
  }

  function getAssigned(label: string): string[] {
    return getLeapAim(label)?.assignedComponents ?? [];
  }

  // ── Write helpers ───────────────────────────────────────────
  const writeAims = useCallback(
    (newAims: any[]) => {
      if (!nodeId || !comp) return;
      const de: any = (comp as any).designedExperienceData || {};
      const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            keyDesignElements: { ...kde, aims: newAims },
          },
        },
      });
    },
    [nodeId, comp, updateMutation],
  );

  function toggleLeap(label: string, isCustom = false) {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];

    if (isSelected(label)) {
      writeAims(aims.filter((a: any) => !(a?.type === "leap" && norm(a.label) === norm(label))));
    } else {
      const newAim = {
        id: `leap_aim_${Date.now()}`,
        type: "leap",
        label: label.trim(),
        level: "Medium",
        levelMode: "override",
        overrideLevel: "M" as const,
        notes: "",
        assignedComponents: [],
        ...(isCustom ? { isCustom: true } : {}),
      };
      writeAims([...aims, newAim]);
    }
  }

  function handleSetPriority(label: string, p: "H" | "M" | "L") {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];
    const levelMap = { H: "High", M: "Medium", L: "Low" };
    writeAims(
      aims.map((a: any) =>
        a?.type === "leap" && norm(a.label) === norm(label)
          ? { ...a, overrideLevel: p, level: levelMap[p], levelMode: "override" }
          : a,
      ),
    );
  }

  function handleSetNotes(label: string, text: string) {
    if (!nodeId || !comp) return;
    setNotesByKey((prev) => ({ ...prev, [norm(label)]: text }));
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      const de: any = (comp as any).designedExperienceData || {};
      const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
      const aims: any[] = kde.aims || [];
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            keyDesignElements: {
              ...kde,
              aims: aims.map((a: any) =>
                a?.type === "leap" && norm(a.label) === norm(label) ? { ...a, notes: text } : a,
              ),
            },
          },
        },
      });
    }, 500);
  }

  function handleToggleAssignment(label: string, componentId: string) {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];
    const aim = getLeapAim(label);
    const current: string[] = aim?.assignedComponents ?? [];
    const next = current.includes(componentId)
      ? current.filter((id) => id !== componentId)
      : [...current, componentId];

    // Push/remove this leap from the target ring component too
    for (const rc of ringComponents) {
      const rcId = String((rc as any)?.nodeId || (rc as any)?.node_id || "");
      if (rcId !== componentId) continue;
      const rcDe: any = (rc as any)?.designedExperienceData || {};
      const rcKde = rcDe.keyDesignElements || { aims: [], practices: [], supports: [] };
      const rcAims: any[] = rcKde.aims || [];
      const alreadyOnRing = rcAims.some((a: any) => a?.type === "leap" && norm(a.label) === norm(label));
      let newRcAims: any[];
      if (!alreadyOnRing && !current.includes(componentId)) {
        newRcAims = [
          ...rcAims,
          {
            id: `leap_aim_${Date.now()}_ring`,
            type: "leap",
            label: label.trim(),
            level: aim?.level ?? "Medium",
            levelMode: "override",
            overrideLevel: aim?.overrideLevel ?? "M",
            notes: aim?.notes ?? "",
            assignedComponents: [],
          },
        ];
      } else if (alreadyOnRing && current.includes(componentId)) {
        newRcAims = rcAims.filter((a: any) => !(a?.type === "leap" && norm(a.label) === norm(label)));
      } else {
        newRcAims = rcAims;
      }
      updateMutation.mutate({
        nodeId: rcId,
        data: {
          designedExperienceData: {
            ...rcDe,
            keyDesignElements: { ...rcKde, aims: newRcAims },
          },
        },
      });
    }

    writeAims(
      aims.map((a: any) =>
        a?.type === "leap" && norm(a.label) === norm(label)
          ? { ...a, assignedComponents: next }
          : a,
      ),
    );
  }

  function handleAddPrinciple() {
    const trimmed = newPrincipleText.trim();
    if (!trimmed || isSelected(trimmed)) return;
    toggleLeap(trimmed, true);
    setNewPrincipleText("");
    setAddingPrinciple(false);
  }

  function handleRemovePrinciple(label: string) {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];
    writeAims(aims.filter((a: any) => !(a?.type === "leap" && norm(a.label) === norm(label))));
  }

  const customPrinciples = deLeaps.filter((a: any) => a?.isCustom);

  const componentName = title || (comp as any)?.title || "this component";

  // ── Render a leap/principle card ───────────────────────────
  function LeapCard({ label, isCustom = false }: { label: string; isCustom?: boolean }) {
    const selected = isSelected(label);
    const priority = getPriority(label);
    const assigned = getAssigned(label);
    const description = LEAP_DESCRIPTIONS[label];
    const showDesc = expandedDescriptions.has(label);
    const notesValue = notesByKey[norm(label)] ?? "";

    return (
      <div
        className={cn(
          "bg-white border rounded-xl shadow-sm overflow-hidden transition-colors",
          selected ? "border-purple-200" : "border-gray-200",
        )}
      >
        {/* Header row */}
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Checkbox */}
          <button
            type="button"
            aria-label={selected ? `Deselect ${label}` : `Select ${label}`}
            onClick={() => toggleLeap(label, isCustom)}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
              selected ? "bg-purple-600 border-purple-600" : "bg-white border-gray-300 hover:border-purple-400",
            )}
          >
            {selected && <Check className="w-3 h-3 text-white" />}
          </button>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <div className={cn("text-sm font-semibold leading-snug", selected ? "text-gray-900" : "text-gray-700")}>
              {label}
            </div>
            {isCustom && (
              <div className="text-[10px] text-purple-400 mt-0.5 font-medium">Design Principle</div>
            )}
          </div>

          {/* Priority badge (when selected) */}
          {selected && priority && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", PRIORITY_STYLES[priority])}>
              {priority}
            </span>
          )}

          {/* Description toggle (fixed leaps only) */}
          {description && (
            <button
              type="button"
              onClick={() =>
                setExpandedDescriptions((prev) => {
                  const next = new Set(prev);
                  next.has(label) ? next.delete(label) : next.add(label);
                  return next;
                })
              }
              title="About this leap"
              className="shrink-0 p-1 rounded text-gray-400 hover:text-purple-600 transition-colors"
            >
              {showDesc ? <ChevronUp className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
            </button>
          )}

          {/* Remove custom principle */}
          {isCustom && (
            <button
              type="button"
              onClick={() => handleRemovePrinciple(label)}
              title="Remove design principle"
              className="shrink-0 p-1 rounded text-gray-300 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Description panel */}
        {showDesc && description && (
          <div className="px-4 pb-3 pt-0">
            <p className="text-xs text-gray-500 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100 leading-relaxed">
              {description}
            </p>
          </div>
        )}

            {/* Inline detail panel (selected) */}
        {selected && (
          <div className="border-t border-purple-100 bg-purple-50/25 px-4 py-4 space-y-4">
            {onOpenLeapDetail ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenLeapDetail(label)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
                >
                  View details
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
            {/* Priority */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-gray-600 shrink-0 w-14">Priority</span>
              <PriorityPicker value={priority} onChange={(p) => handleSetPriority(label, p)} />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-gray-600">
                How this applies to {componentName}
              </Label>
              <Textarea
                value={notesValue}
                onChange={(e) => handleSetNotes(label, e.currentTarget?.value ?? "")}
                placeholder={`Describe how "${label}" shows up in this component…`}
                className="text-xs min-h-[64px] bg-white resize-none"
              />
            </div>

            {/* Center component: push to ring components */}
            {isOverall && ringComponents.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-gray-600">
                  Push to ring components{" "}
                  <span className="text-gray-400 font-normal">
                    — adds this leap to selected components
                  </span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {ringComponents.map((rc: any) => {
                    const rcNodeId = String(rc?.nodeId || rc?.node_id || "");
                    const isAssigned = assigned.includes(rcNodeId);
                    return (
                      <button
                        key={rcNodeId}
                        type="button"
                        onClick={() => handleToggleAssignment(label, rcNodeId)}
                        className={cn(
                          "px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors flex items-center gap-1.5",
                          isAssigned
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700",
                        )}
                      >
                        {isAssigned && <Check className="w-3 h-3" />}
                        {String(rc?.title || rcNodeId)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 pb-16 space-y-5" data-testid="leap-summary-view">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Manage Leaps &amp; Design Principles</h2>
            {(title || (comp as any)?.title) && (
              <p className="text-sm text-gray-500 mt-0.5">{title || (comp as any)?.title}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-2.5 text-xs text-gray-500 border-b border-gray-100">
          Select which leaps this component embodies, then add priority and notes for each.
          {isOverall && " As the center component, you can push leaps directly to ring components."}
          {" "}Click <BookOpen className="w-3 h-3 inline" /> on any leap to read its description.
        </div>

        {/* Selected summary chips */}
        {deLeaps.length > 0 ? (
          <div className="px-5 py-3 flex flex-wrap gap-1.5">
            {deLeaps.map((a: any) => {
              const p = getPriority(a.label);
              return (
                <span
                  key={a.id ?? a.label}
                  className="inline-flex items-center gap-1 px-2.5 py-1 border rounded-full text-[11px] font-medium bg-purple-50 border-purple-200 text-purple-800"
                >
                  {a.label}
                  {p && (
                    <span className={cn("text-[9px] font-bold px-1 rounded border", PRIORITY_STYLES[p])}>{p}</span>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-3 text-xs text-gray-400 italic">
            No leaps selected yet — use the cards below to add some.
          </div>
        )}
      </div>

      {/* Fixed leaps */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-1">
          The 6 Leaps
        </div>
        {FIXED_LEAPS.map((label) => (
          <LeapCard key={label} label={label} />
        ))}
      </div>

      {/* Custom design principles */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-1">
          Design Principles
        </div>

        {customPrinciples.length > 0 && (
          <div className="space-y-2.5">
            {customPrinciples.map((a: any) => (
              <LeapCard key={a.id ?? a.label} label={a.label} isCustom />
            ))}
          </div>
        )}

        {/* Add button / input */}
        {addingPrinciple ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={newPrincipleText}
              onChange={(e) => setNewPrincipleText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddPrinciple();
                if (e.key === "Escape") { setAddingPrinciple(false); setNewPrincipleText(""); }
              }}
              placeholder="Name your design principle…"
              className="flex-1 text-sm outline-none placeholder-gray-400"
            />
            <button
              type="button"
              onClick={handleAddPrinciple}
              disabled={!newPrincipleText.trim()}
              className="px-3 py-1 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setAddingPrinciple(false); setNewPrincipleText(""); }}
              className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingPrinciple(true)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-white border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add a Design Principle
          </button>
        )}
      </div>
    </div>
  );
}
