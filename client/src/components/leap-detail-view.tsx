"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { LEAP_DESCRIPTIONS } from "./designed-experience-schemas";
import OutcomesLearnMoreView from "./outcomes-learn-more-view";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function levelToAbbrev(level: unknown, override?: string | null): string {
  if (override === "H" || override === "M" || override === "L") return override;
  if (level === "High") return "H";
  if (level === "Low") return "L";
  return "M";
}

export default function LeapDetailView({
  nodeId,
  title,
  leapLabel,
  onBack,
}: {
  nodeId?: string;
  title?: string;
  leapLabel: string;
  onBack: () => void;
}) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const { data: allComponents } = useQuery(componentQueries.all);
  const updateMutation = useUpdateComponent();
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextNotesPersist = useRef(true);
  const [showLearnMore, setShowLearnMore] = useState(false);

  const isOverall = String(nodeId || "") === "overall" || String((comp as any)?.nodeId || "") === "overall";

  const leapAim = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return aims.find((a: any) => a?.type === "leap" && norm(a?.label) === norm(leapLabel)) || null;
  }, [comp, leapLabel]);

  const priority = leapAim?.overrideLevel ?? (leapAim?.level === "High" ? "H" : leapAim?.level === "Low" ? "L" : "M") ?? "M";

  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(String(leapAim?.notes ?? ""));
  }, [leapLabel, nodeId, leapAim?.notes]);

  const shortDescription =
    LEAP_DESCRIPTIONS[leapLabel] ||
    `${leapLabel.trim()} is a design principle for this component. Add notes below to clarify how it shows up in practice.`;

  const setPriority = useCallback(
    (p: "H" | "M" | "L") => {
      if (!nodeId || !comp) return;
      const de: any = (comp as any).designedExperienceData || {};
      const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
      const aims: any[] = kde.aims || [];
      const levelMap = { H: "High", M: "Medium", L: "Low" };
      const nextAims = aims.map((a: any) =>
        a?.type === "leap" && norm(a?.label) === norm(leapLabel)
          ? { ...a, overrideLevel: p, level: levelMap[p], levelMode: "override" }
          : a,
      );
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            keyDesignElements: { ...kde, aims: nextAims },
          },
        },
      });
    },
    [comp, leapLabel, nodeId, updateMutation],
  );

  const persistNotes = useCallback(
    (text: string) => {
      if (!nodeId || !comp) return;
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
                  a?.type === "leap" && norm(a?.label) === norm(leapLabel) ? { ...a, notes: text } : a,
                ),
              },
            },
          },
        });
      }, 500);
    },
    [comp, leapLabel, nodeId, updateMutation],
  );

  useEffect(() => {
    if (skipNextNotesPersist.current) {
      skipNextNotesPersist.current = false;
      return;
    }
    persistNotes(notes);
  }, [notes, persistNotes]);

  const leapMeasures = useMemo(() => {
    const esd: any = (comp as any)?.healthData?.experienceScoreData || {};
    const items: any[] = Array.isArray(esd?.leapItems) ? esd.leapItems : [];
    const row = items.find((li: any) => norm(String(li?.label || "")) === norm(leapLabel));
    return Array.isArray(row?.measures) ? row.measures : [];
  }, [comp, leapLabel]);

  const taggedSubRows = useMemo(() => {
    const subs: any[] = (comp as any)?.designedExperienceData?.subcomponents || [];
    return subs
      .map((s: any) => {
        const aim = (s?.aims || []).find((a: any) => a?.type === "leap" && norm(a?.label) === norm(leapLabel));
        if (!aim) return null;
        const abbrev = levelToAbbrev(aim.level, aim.overrideLevel);
        return { name: String(s?.name || "Untitled"), abbrev };
      })
      .filter(Boolean) as { name: string; abbrev: string }[];
  }, [comp, leapLabel]);

  const taggedComponents = useMemo(() => {
    if (!isOverall) return [];
    const list: any[] = Array.isArray(allComponents) ? allComponents : [];
    const key = norm(leapLabel);
    const out: { nodeId: string; title: string }[] = [];
    for (const c of list) {
      const cNodeId = String(c?.nodeId || "");
      if (!cNodeId || cNodeId === "overall") continue;
      const de: any = c?.designedExperienceData || {};
      const aims: any[] = de?.keyDesignElements?.aims || [];
      const hasAtComponent = aims.some((a: any) => a?.type === "leap" && norm(a?.label) === key);
      const subs: any[] = Array.isArray(de?.subcomponents) ? de.subcomponents : [];
      const hasAtSub = subs.some((s: any) => (s?.aims || []).some((a: any) => a?.type === "leap" && norm(a?.label) === key));
      if (hasAtComponent || hasAtSub) out.push({ nodeId: cNodeId, title: String(c?.title || cNodeId) });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }, [allComponents, isOverall, leapLabel]);

  const componentName = title || (comp as any)?.title || "this component";

  if (showLearnMore) {
    return (
      <OutcomesLearnMoreView mode="leap" leapLabel={leapLabel} onBack={() => setShowLearnMore(false)} />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 pb-16 space-y-8" data-testid="leap-detail-view">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{leapLabel}</h1>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-gray-600 shrink-0"
            onClick={() => setShowLearnMore(true)}
          >
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            Learn more
          </Button>
        </div>
        {(title || (comp as any)?.title) && <p className="text-sm text-gray-500">{title || (comp as any)?.title}</p>}
        <p className="text-sm text-gray-700 leading-relaxed">{shortDescription}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Priority</span>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {(["H", "M", "L"] as const).map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => setPriority(k)}
              className={cn(
                "px-3 py-1 text-xs font-semibold transition-colors",
                i > 0 && "border-l border-gray-200",
                priority === k ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {k === "H" ? "High" : k === "M" ? "Medium" : "Low"}
            </button>
          ))}
        </div>
      </div>

      <Collapsible defaultOpen={false} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50/80 [&[data-state=open]>svg]:rotate-180">
          How this applies to {componentName}
          <ChevronDown className="w-4 h-4 text-gray-500 transition-transform shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t border-gray-100">
            <Label className="text-[11px] text-gray-500 sr-only">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Describe how “${leapLabel}” shows up in this design…`}
              className="text-sm min-h-[88px] mt-2"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Measures</h2>
        <p className="text-xs text-gray-500">
          Measures for leaps are scored in Experience Score. Listed below is what exists for this leap on this component.
        </p>
        {leapMeasures.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No measures yet for this leap.</p>
        ) : (
          <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
            {leapMeasures.map((m: any) => (
              <li key={m.id} className="px-3 py-2 text-xs flex justify-between gap-2">
                <span className="font-medium text-gray-800 truncate">{m?.name || "Measure"}</span>
                <span className="text-gray-500 shrink-0">Priority {m?.priority || "M"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">{isOverall ? "Tagged components" : "Tagged subcomponents"}</h2>
        {isOverall ? (
          taggedComponents.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Not tagged on any ring components.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {taggedComponents.map((c) => (
                <Badge key={c.nodeId} variant="secondary" className="text-[11px] bg-gray-100 text-gray-800 border-gray-200">
                  {c.title}
                </Badge>
              ))}
            </div>
          )
        ) : taggedSubRows.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Not tagged on any subcomponents.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {taggedSubRows.map((row) => (
              <span
                key={row.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium bg-purple-50 text-purple-900 border-purple-200"
              >
                {row.name}
                <span className="text-[10px] font-bold px-1 rounded bg-white/80 border border-purple-200">{row.abbrev}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
