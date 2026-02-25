import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, Check, Search, ArrowRight, BookOpen, Star } from "lucide-react";
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
import { OUTCOME_SCHEMA } from "./designed-experience-schemas";
import OutcomeDetailView from "./outcome-detail-view";
import OutcomesLearnMoreView from "./outcomes-learn-more-view";
import { buildOutcomeUsageIndexFromComponents, buildSubcomponentOutcomeIndex, normOutcomeKey } from "./outcomes-utils";

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
  const isOverall = String(nodeId || "") === "overall" || String((comp as any)?.nodeId || "") === "overall";
  const { data: allComponents } = useQuery({ ...(componentQueries.all as any), enabled: isOverall } as any);
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const L1_AREAS = useMemo(
    () =>
      [
        { key: "STEM", label: "STEM" },
        { key: "Humanities", label: "Arts & Humanities" },
        { key: "Cross-cutting", label: "Learning & Life" },
        { key: "Well-being", label: "Wellbeing" },
        { key: "Wayfinding", label: "Wayfinding" },
      ] as const,
    [],
  );

  const outcomeAreaByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const [area, subcats] of Object.entries(OUTCOME_SCHEMA || {})) {
      for (const items of Object.values(subcats || {})) {
        for (const label of Array.isArray(items) ? items : []) {
          const k = normOutcomeKey(label);
          if (!k) continue;
          if (!m.has(k)) m.set(k, area);
        }
      }
    }
    return m;
  }, []);

  const [activeAreaKey, setActiveAreaKey] = useState<string | null>(null);

  const deOutcomes = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return (Array.isArray(aims) ? aims : []).filter((a: any) => a?.type === "outcome" && typeof a?.label === "string");
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

  const keyAimKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const a of deOutcomes) {
      const k = normOutcomeKey(a?.label);
      if (k) set.add(k);
    }
    return set;
  }, [deOutcomes]);

  const keyAimTagByKey = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of deOutcomes) {
      const label = String(a?.label || "").trim();
      const k = normOutcomeKey(label);
      if (!k) continue;
      if (!m.has(k)) m.set(k, a);
    }
    return m;
  }, [deOutcomes]);

  const scoringKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const o of Array.isArray(targeted) ? targeted : []) {
      const label = String(o?.outcomeName || "").trim();
      const k = normOutcomeKey(label);
      if (k) set.add(k);
    }
    return set;
  }, [targeted]);

  const sectionA = useMemo(() => {
    const order: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    const add = (label: unknown) => {
      const clean = String(label ?? "").trim();
      const k = normOutcomeKey(clean);
      if (!k) return;
      if (seen.has(k)) return;
      seen.add(k);
      order.push({ key: k, label: clean });
    };
    for (const a of deOutcomes) add(a?.label);
    for (const o of Array.isArray(targeted) ? targeted : []) add(o?.outcomeName);
    order.sort((a, b) => a.label.localeCompare(b.label));
    return order;
  }, [deOutcomes, targeted]);

  const filteredSectionA = useMemo(() => {
    if (!activeAreaKey) return sectionA;
    return sectionA.filter((o) => outcomeAreaByKey.get(o.key) === activeAreaKey);
  }, [activeAreaKey, outcomeAreaByKey, sectionA]);

  const subcomponentOnly = useMemo(() => {
    if (isOverall) return [];
    const subs: any[] = (comp as any)?.designedExperienceData?.subcomponents || [];
    const idx = buildSubcomponentOutcomeIndex(subs);
    const out: Array<{ key: string; label: string; subs: { id: string; name: string; priority: "H" | "M" | "L" }[] }> = [];
    for (const [k, v] of Array.from(idx.entries())) {
      if (keyAimKeySet.has(k)) continue;
      if (scoringKeySet.has(k)) continue;
      out.push({ key: k, label: v.label, subs: v.subcomponents });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [comp, isOverall, keyAimKeySet, scoringKeySet]);

  const subcomponentsIndexAll = useMemo(() => {
    if (isOverall) return null;
    const subs: any[] = (comp as any)?.designedExperienceData?.subcomponents || [];
    return buildSubcomponentOutcomeIndex(subs);
  }, [comp, isOverall]);

  const componentsIndexAll = useMemo(() => {
    if (!isOverall) return null;
    const list = Array.isArray(allComponents) ? allComponents : [];
    const other = list.filter((c: any) => String(c?.nodeId || "") !== "overall");
    return buildOutcomeUsageIndexFromComponents(other);
  }, [allComponents, isOverall]);

  const filteredSubcomponentOnly = useMemo(() => {
    if (!activeAreaKey) return subcomponentOnly;
    return subcomponentOnly.filter((o) => outcomeAreaByKey.get(o.key) === activeAreaKey);
  }, [activeAreaKey, outcomeAreaByKey, subcomponentOnly]);

  const componentOnly = useMemo(() => {
    if (!isOverall) return [];
    const list = Array.isArray(allComponents) ? allComponents : [];
    const other = list.filter((c: any) => String(c?.nodeId || "") !== "overall");
    const idx = buildOutcomeUsageIndexFromComponents(other);
    const out: Array<{ key: string; label: string; comps: { nodeId: string; title: string }[] }> = [];
    for (const [k, v] of Array.from(idx.entries())) {
      if (keyAimKeySet.has(k)) continue;
      if (scoringKeySet.has(k)) continue;
      out.push({ key: k, label: v.label, comps: v.components });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [allComponents, isOverall, keyAimKeySet, scoringKeySet]);

  const filteredComponentOnly = useMemo(() => {
    if (!activeAreaKey) return componentOnly;
    return componentOnly.filter((o) => outcomeAreaByKey.get(o.key) === activeAreaKey);
  }, [activeAreaKey, componentOnly, outcomeAreaByKey]);

  useEffect(() => {
    if (!comp || initialized) return;
    const initial: Record<string, string> = {};
    for (const a of sectionA) {
      initial[a.key] = String(notes[a.key]?.appliesDescription || "");
    }
    setAppliesByKey(initial);
    setInitialized(true);
  }, [comp, initialized, notes, sectionA]);

  useEffect(() => {
    if (!initialized) return;
    const missing = sectionA.filter((a) => appliesByKey[a.key] === undefined);
    if (missing.length === 0) return;
    setAppliesByKey((prev) => {
      const next = { ...prev };
      for (const a of missing) next[a.key] = String(notes[a.key]?.appliesDescription || "");
      return next;
    });
  }, [appliesByKey, initialized, notes, sectionA]);

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
  const [showLearnMore, setShowLearnMore] = useState(false);
  if (showLearnMore) {
    return <OutcomesLearnMoreView mode="schema" onBack={() => setShowLearnMore(false)} />;
  }
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

  // Note: adding outcomes to the Outcome Score happens on the Outcome Score page.

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
            <Button size="sm" variant="ghost" className="h-8 text-xs text-gray-500" onClick={() => setShowLearnMore(true)} data-testid="outcomes-learn-more">
              <BookOpen className="w-3.5 h-3.5 mr-1" />
              Learn more
            </Button>
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
          <div className="text-sm font-bold text-gray-900">Filter outcomes</div>
          <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
            {activeAreaKey ? (L1_AREAS.find((a) => a.key === activeAreaKey)?.label || activeAreaKey) : "All"}
          </Badge>
        </div>
        <div className="p-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <button
              type="button"
              onClick={() => setActiveAreaKey(null)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors",
                !activeAreaKey ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:text-gray-900",
              )}
            >
              All
            </button>
            {L1_AREAS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setActiveAreaKey((prev) => (prev === a.key ? null : a.key))}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors",
                  activeAreaKey === a.key ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:text-gray-900",
                )}
                data-testid={`outcome-area-pill-${a.key}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">{isOverall ? "Whole School Targeted Outcomes" : "Outcomes for this component"}</h3>
          <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
            {filteredSectionA.length}
          </Badge>
        </div>
        <div className="p-4 space-y-3">
          {filteredSectionA.length === 0 ? (
            <div className="text-xs text-gray-400 italic">No outcomes selected yet. Use “Add outcomes” to select from the schema.</div>
          ) : (
            filteredSectionA.map((o) => {
              const label = String(o.label || "");
              const key = o.key;
              const aimTag = keyAimTagByKey.get(key) || null;
              const inKeyAims = !!aimTag;
              const p = inKeyAims ? levelToPriority(aimTag?.level) : null;
              const row = getOutcomeRow(label) || (Array.isArray(targeted) ? targeted.find((x: any) => normOutcomeKey(x?.outcomeName) === key) : null);
              const score = row?.calculatedScore ?? null;
              const measures: any[] = row?.measures || [];
              const rated = measures.filter((m) => m?.rating !== null && !m?.skipped).length;
              const applies = appliesByKey[key] || "";
              const inScoring = scoringKeySet.has(key);
              const isPrimary = !!aimTag?.isPrimary;
              const originSubs = subcomponentsIndexAll?.get(key)?.subcomponents || [];
              const originComps = componentsIndexAll?.get(key)?.components || [];
              return (
                <div key={key} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="min-w-0 text-left flex-1" onClick={() => setSelectedOutcome(label)}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-6 rounded flex items-center justify-center text-xs font-bold border shrink-0", scoreColor(score))}>
                          {score !== null ? String(Math.max(1, Math.min(5, Math.round(score)))) : "—"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{label}</div>
                          <div className="text-[10px] text-gray-500">
                            {inScoring ? `${rated}/${measures.length} measures rated` : "Not in Outcome Score yet"}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {isOverall ? (
                              <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                                Whole School
                              </Badge>
                            ) : inKeyAims ? (
                              <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                                From: {componentName}
                              </Badge>
                            ) : null}
                            {originComps.map((c: any) => (
                              <Badge key={String(c.nodeId)} variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                                From: {String(c.title)}
                              </Badge>
                            ))}
                            {originSubs.map((s: any) => (
                              <Badge key={String(s.id)} variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                                From: {String(s.name)} ({String(s.priority)})
                              </Badge>
                            ))}
                            {isPrimary ? (
                              <Badge variant="secondary" className="text-[9px] h-5 bg-yellow-50 text-yellow-700 border border-yellow-200 gap-1">
                                <Star className="w-3 h-3 fill-current" /> Primary
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {inKeyAims ? (
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
                      ) : null}
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
                      onChange={(e) => {
                        const v = e.currentTarget?.value ?? "";
                        setAppliesByKey((prev) => ({ ...prev, [key]: v }));
                      }}
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

      {!isOverall && subcomponentOnly.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="outcomes-from-subcomponents">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Outcomes from subcomponents</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              {filteredSubcomponentOnly.length}
            </Badge>
          </div>
          <div className="p-4 space-y-2">
            {filteredSubcomponentOnly.length === 0 ? (
              <div className="text-xs text-gray-400 italic">No subcomponent outcomes match this filter.</div>
            ) : (
              filteredSubcomponentOnly.map((o) => (
              <div key={o.key} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{o.label}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {o.subs.map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                        From: {s.name} ({s.priority})
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-900" onClick={() => setSelectedOutcome(o.label)}>
                    Details <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {isOverall && componentOnly.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" data-testid="outcomes-from-components">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Outcomes from components</h3>
            <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
              {filteredComponentOnly.length}
            </Badge>
          </div>
          <div className="p-4 space-y-2">
            {filteredComponentOnly.length === 0 ? (
              <div className="text-xs text-gray-400 italic">No component outcomes match this filter.</div>
            ) : (
              filteredComponentOnly.map((o) => (
              <div key={o.key} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{o.label}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {o.comps.map((c) => (
                      <Badge key={c.nodeId} variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-700">
                        From: {c.title}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-900" onClick={() => setSelectedOutcome(o.label)}>
                    Details <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

