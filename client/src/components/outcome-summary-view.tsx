import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, Check, Search, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { OUTCOME_SCHEMA } from "./designed-experience-view";
import OutcomeDetailView from "./outcome-detail-view";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function levelToPriority(level: unknown): "H" | "M" | "L" {
  if (level === "High") return "H";
  if (level === "Low") return "L";
  return "M";
}

function priorityToLevel(p: "H" | "M" | "L"): "High" | "Medium" | "Low" {
  if (p === "H") return "High";
  if (p === "L") return "Low";
  return "Medium";
}

function scoreColor(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-400 border-gray-200";
  if (score >= 4) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

export interface OutcomeSummaryViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  onOpenOutcomeScore?: () => void;
}

export default function OutcomeSummaryView({ nodeId, title, onBack, onOpenOutcomeScore }: OutcomeSummaryViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deOutcomes = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return aims.filter((a: any) => a?.type === "outcome" && typeof a?.label === "string");
  }, [comp]);

  const osd = useMemo(() => ((comp as any)?.healthData?.outcomeScoreData || {}) as any, [comp]);
  const targeted: any[] = osd?.targetedOutcomes || [];
  const notes: any = osd?.outcomeNotes || {};

  const getOutcomeRow = useCallback(
    (label: string) => targeted.find((o: any) => norm(o?.outcomeName) === norm(label)) || null,
    [targeted],
  );

  const [appliesByKey, setAppliesByKey] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const componentName = title || comp?.title || "this component";

  useEffect(() => {
    if (!comp || initialized) return;
    const initial: Record<string, string> = {};
    for (const a of deOutcomes) {
      initial[norm(a.label)] = String(notes[norm(a.label)]?.appliesDescription || "");
    }
    setAppliesByKey(initial);
    setInitialized(true);
  }, [comp, deOutcomes, initialized, notes]);

  const saveNotes = useCallback(
    (next: Record<string, string>) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = comp?.healthData || {};
        const existingOsd: any = existing.outcomeScoreData || {};
        const merged: any = { ...(existingOsd.outcomeNotes || {}) };
        for (const [k, v] of Object.entries(next)) {
          merged[k] = { appliesDescription: v };
        }
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              outcomeScoreData: {
                ...existingOsd,
                outcomeNotes: merged,
              },
            },
          },
        });
      }, 500);
    },
    [comp, nodeId, updateMutation],
  );

  useEffect(() => {
    if (!initialized) return;
    saveNotes(appliesByKey);
  }, [appliesByKey, initialized, saveNotes]);

  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  if (selectedOutcome) {
    return (
      <OutcomeDetailView
        nodeId={nodeId}
        title={title}
        outcomeLabel={selectedOutcome}
        onBack={() => setSelectedOutcome(null)}
        onOpenOutcomeScore={onOpenOutcomeScore}
      />
    );
  }

  const updateOutcomePriority = (label: string, p: "H" | "M" | "L") => {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];
    const updated = aims.map((a: any) =>
      a?.type === "outcome" && norm(a?.label) === norm(label) ? { ...a, level: priorityToLevel(p) } : a,
    );
    updateMutation.mutate({
      nodeId,
      data: {
        designedExperienceData: {
          ...de,
          keyDesignElements: { ...kde, aims: updated },
        },
      },
    });
  };

  const removeOutcome = (label: string) => {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];
    const updated = aims.filter((a: any) => !(a?.type === "outcome" && norm(a?.label) === norm(label)));
    updateMutation.mutate({
      nodeId,
      data: {
        designedExperienceData: {
          ...de,
          keyDesignElements: { ...kde, aims: updated },
        },
      },
    });
  };

  const addOutcome = (label: string) => {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];
    const exists = aims.some((a: any) => a?.type === "outcome" && norm(a?.label) === norm(label));
    if (exists) return;
    const newAim = { id: `aim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: "outcome", label: label.trim(), level: "Medium" };
    updateMutation.mutate({
      nodeId,
      data: {
        designedExperienceData: {
          ...de,
          keyDesignElements: { ...kde, aims: [...aims, newAim] },
        },
      },
    });
  };

  const OutcomePickerSheet = () => {
    const [search, setSearch] = useState("");
    const searchLower = search.toLowerCase();
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50" data-testid="button-add-outcome-from-schema">
            <Plus className="w-3.5 h-3.5" />
            Add outcomes
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto bg-white">
          <SheetHeader>
            <SheetTitle>Select outcomes</SheetTitle>
            <SheetDescription>Add or remove outcome aims for this component.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search outcomes..." className="pl-8 h-9 text-sm" />
            </div>
            {Object.entries(OUTCOME_SCHEMA).map(([category, subcategories]) => {
              const hasMatch = !search || Object.values(subcategories).some((items) => items.some((i) => i.toLowerCase().includes(searchLower)));
              if (!hasMatch) return null;
              return (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-900 border-b pb-1">{category}</h4>
                  <div className="space-y-3 pl-1">
                    {Object.entries(subcategories).map(([subcategory, items]) => {
                      const filtered = search ? items.filter((i) => i.toLowerCase().includes(searchLower)) : items;
                      if (filtered.length === 0) return null;
                      return (
                        <div key={subcategory} className="space-y-1">
                          <h5 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{subcategory}</h5>
                          {filtered.map((item) => {
                            const selected = deOutcomes.some((a: any) => norm(a.label) === norm(item));
                            return (
                              <button
                                type="button"
                                key={item}
                                onClick={() => (selected ? removeOutcome(item) : addOutcome(item))}
                                className={cn(
                                  "w-full flex items-center justify-between gap-2 p-2 rounded border transition-colors text-xs text-left",
                                  selected ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "hover:bg-gray-50 border-transparent hover:border-gray-100 text-gray-700",
                                )}
                              >
                                <span className="truncate min-w-0">{item}</span>
                                {selected ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5 text-gray-300" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="outcome-summary-view">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Outcomes</h2>
            {(title || comp?.title) && <p className="text-sm text-gray-500 mt-0.5">{title || comp?.title}</p>}
          </div>
          <div className="flex items-center gap-2">
            <OutcomePickerSheet />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenOutcomeScore} disabled={!onOpenOutcomeScore}>
              Open Outcomes Score
            </Button>
          </div>
        </div>
        <div className="p-4 text-xs text-gray-600">
          These are the outcomes selected for this component. You can adjust priority and add private notes about how each outcome applies here.
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Selected outcomes</h3>
          <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
            {deOutcomes.length}
          </Badge>
        </div>
        <div className="p-4 space-y-3">
          {deOutcomes.length === 0 ? (
            <div className="text-xs text-gray-400 italic">No outcomes selected yet. Use “Add outcomes” to select from the schema.</div>
          ) : (
            deOutcomes.map((a: any) => {
              const label = String(a.label || "");
              const p = levelToPriority(a.level);
              const row = getOutcomeRow(label);
              const score = row?.calculatedScore ?? null;
              const measures: any[] = row?.measures || [];
              const rated = measures.filter((m) => m?.rating !== null && !m?.skipped).length;
              const key = norm(label);
              const applies = appliesByKey[key] || "";
              return (
                <div key={a.id || label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="min-w-0 text-left flex-1" onClick={() => setSelectedOutcome(label)}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-6 rounded flex items-center justify-center text-xs font-bold border shrink-0", scoreColor(score))}>
                          {score !== null ? (Math.round(score * 10) / 10).toFixed(1) : "—"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{label}</div>
                          <div className="text-[10px] text-gray-500">
                            {rated}/{measures.length} measures rated
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white">
                        {(["H", "M", "L"] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => updateOutcomePriority(label, k)}
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold transition-colors",
                              k !== "H" && "border-l border-gray-200",
                              p === k ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-800",
                            )}
                            aria-pressed={p === k}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-900" onClick={() => setSelectedOutcome(label)}>
                        Details <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-gray-600">How this outcome applies to {componentName}</Label>
                    <Textarea
                      value={applies}
                      onChange={(e) => setAppliesByKey((prev) => ({ ...prev, [key]: e.currentTarget.value }))}
                      placeholder="Describe how this outcome applies in this component…"
                      className="text-xs min-h-[70px] bg-white"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

