import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import type { ScoreFilter } from "@shared/schema";
import OutcomesLearnMoreView from "./outcomes-learn-more-view";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

/** Keep on-screen outcome blurbs to at most two sentences. */
function clipSentences(text: string, maxSentences: number): string {
  const t = (text || "").trim();
  if (!t) return t;
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= maxSentences) return t;
  return parts.slice(0, maxSentences).join(" ");
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

function levelToAbbrev(level: unknown): string {
  if (level === "High") return "H";
  if (level === "Low") return "L";
  return "M";
}

function genericOutcomeDescription(label: string): string {
  const clean = label.trim();
  const key = norm(clean);
  if (!clean) return "Target result for learners in this component.";

  const LIB: Record<string, string> = {
    algebra:
      "Patterns and relationships with symbols and equations; students model situations and solve multi-step problems.",
    geometry:
      "Shapes, space, and measurement with visual reasoning and justified arguments.",
    calculus: "Change and accumulation: rates, growth, and optimization.",
    physics: "Matter, energy, and forces—models, evidence, and how the physical world behaves.",
    chemistry: "Substances and reactions, from structure to observable changes.",
    biology: "Living systems from cells to ecosystems using models and evidence.",
    "computer science": "Algorithms, data, and programming to design and reason about systems.",
    "ai literacy": "How AI uses data and models, plus responsible evaluation and use.",
    robotics: "Design, mechanics, and programming to build and test working systems.",
    reading: "Interpret texts, evaluate claims, and build knowledge from evidence.",
    writing: "Clear communication for audience and purpose with structure and revision.",
    literature: "Close reading of complex texts across themes and perspectives.",
    collaboration: "Shared responsibility, communication, and coordination in teams.",
    communication: "Express ideas clearly and listen across audiences and contexts.",
    leadership: "Guide and support teams—lead when needed and contribute constructively.",
    "identity & purpose": "Sense of self, values, and direction that supports motivation.",
    "goal-setting": "Plan, monitor, and reflect to build persistence and improvement.",
    attendance: "Consistent engagement—often tied to access, belonging, and progress.",
    "postsecondary plan":
      "Clarify goals after graduation and map applications, requirements, and timelines.",
    "postsecondary enrollment": "Transition into college or other continuing education after graduation.",
    "continuing-education / post-secondary knowledge & exposure":
      "Awareness and readiness for options after high school.",
  };

  const body =
    LIB[key] ||
    `${clean} is a focus area here—use the section below to spell out what it looks like in practice.`;
  return clipSentences(body, 2);
}

export interface OutcomeDetailViewProps {
  nodeId?: string;
  title?: string;
  outcomeLabel: string;
  onBack: () => void;
  onOpenOutcomeScore?: () => void;
  /** @deprecated No longer used on this page; kept for call-site compatibility. */
  sourceFilter?: ScoreFilter;
  /** @deprecated No longer used on this page. */
  onFilterChange?: (next: ScoreFilter) => void;
}

export default function OutcomeDetailView({
  nodeId,
  title,
  outcomeLabel,
  onBack,
  onOpenOutcomeScore,
}: OutcomeDetailViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const { data: allComponents } = useQuery(componentQueries.all);
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOverall = String(nodeId || "") === "overall";

  const [showLearnMore, setShowLearnMore] = useState(false);

  const outcomeAim = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return aims.find((a: any) => a?.type === "outcome" && norm(a?.label) === norm(outcomeLabel)) || null;
  }, [comp, outcomeLabel]);

  const priority = useMemo(() => levelToPriority(outcomeAim?.level), [outcomeAim?.level]);

  const taggedSubRows = useMemo(() => {
    const subs: any[] = (comp as any)?.designedExperienceData?.subcomponents || [];
    return subs
      .map((s: any) => {
        const aim = (s?.aims || []).find((a: any) => a?.type === "outcome" && norm(a?.label) === norm(outcomeLabel));
        if (!aim) return null;
        return { name: String(s?.name || "Untitled"), abbrev: levelToAbbrev(aim.level) };
      })
      .filter(Boolean) as { name: string; abbrev: string }[];
  }, [comp, outcomeLabel]);

  const taggedComponents = useMemo(() => {
    if (!isOverall) return [];
    const list: any[] = Array.isArray(allComponents) ? allComponents : [];
    const key = norm(outcomeLabel);
    const out: { nodeId: string; title: string }[] = [];

    for (const c of list) {
      const cNodeId = String(c?.nodeId || "");
      if (!cNodeId || cNodeId === "overall") continue;

      const de: any = c?.designedExperienceData || {};
      const aims: any[] = de?.keyDesignElements?.aims || [];
      const hasAtComponent = aims.some((a: any) => a?.type === "outcome" && norm(a?.label) === key);

      const subs: any[] = Array.isArray(de?.subcomponents) ? de.subcomponents : [];
      const hasAtSub = subs.some((s: any) => (s?.aims || []).some((a: any) => a?.type === "outcome" && norm(a?.label) === key));

      if (hasAtComponent || hasAtSub) out.push({ nodeId: cNodeId, title: String(c?.title || cNodeId) });
    }

    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }, [allComponents, isOverall, outcomeLabel]);

  const [appliesDescription, setAppliesDescription] = useState("");
  const [initialized, setInitialized] = useState(false);
  const componentName = title || (comp as any)?.title || "this component";

  const setPriority = useCallback(
    (p: "H" | "M" | "L") => {
      if (!nodeId || !comp) return;

      const de: any = (comp as any).designedExperienceData || {};
      const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
      const aims: any[] = kde.aims || [];
      const nextAims = aims.map((a: any) =>
        a?.type === "outcome" && norm(a?.label) === norm(outcomeLabel) ? { ...a, level: priorityToLevel(p) } : a,
      );

      const existingHd: any = (comp as any).healthData || {};
      const osd: any = existingHd.outcomeScoreData || {};
      const targeted: any[] = osd.targetedOutcomes || [];
      const nextTargeted = targeted.map((o: any) =>
        norm(o?.outcomeName) === norm(outcomeLabel) ? { ...o, priority: p } : o,
      );

      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            keyDesignElements: { ...kde, aims: nextAims },
          },
          healthData: {
            ...existingHd,
            outcomeScoreData: {
              ...osd,
              targetedOutcomes: nextTargeted,
            },
          },
        },
      });
    },
    [comp, nodeId, outcomeLabel, updateMutation],
  );

  useEffect(() => {
    if (!comp || initialized) return;
    const osd: any = (comp as any)?.healthData?.outcomeScoreData || {};
    const notes: any = osd.outcomeNotes || {};
    setAppliesDescription(String(notes[norm(outcomeLabel)]?.appliesDescription || ""));
    setInitialized(true);
  }, [comp, initialized, outcomeLabel]);

  const doSaveNotes = useCallback(
    (desc: string) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = comp?.healthData || {};
        const osd: any = existing.outcomeScoreData || {};
        const outcomeNotes: any = osd.outcomeNotes || {};
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              outcomeScoreData: {
                ...osd,
                outcomeNotes: {
                  ...outcomeNotes,
                  [norm(outcomeLabel)]: { appliesDescription: desc },
                },
              },
            },
          },
        });
      }, 500);
    },
    [comp, nodeId, outcomeLabel, updateMutation],
  );

  useEffect(() => {
    if (!initialized) return;
    doSaveNotes(appliesDescription);
  }, [appliesDescription, doSaveNotes, initialized]);

  if (showLearnMore) {
    return <OutcomesLearnMoreView mode="outcome" outcomeLabel={outcomeLabel} onBack={() => setShowLearnMore(false)} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 pb-16 space-y-8" data-testid="outcome-detail-view">
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{outcomeLabel}</h1>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-gray-600 shrink-0"
            onClick={() => setShowLearnMore(true)}
            data-testid="outcome-learn-more"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            Learn more
          </Button>
        </div>
        {(title || (comp as any)?.title) && <p className="text-sm text-gray-500">{title || (comp as any)?.title}</p>}
        <p className="text-sm text-gray-700 leading-relaxed">{genericOutcomeDescription(outcomeLabel)}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
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
                priority === k ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50",
              )}
              aria-pressed={priority === k}
              data-testid={`outcome-detail-priority-${k}`}
            >
              {k === "H" ? "High" : k === "M" ? "Medium" : "Low"}
            </button>
          ))}
        </div>
      </div>

      {onOpenOutcomeScore ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-600">Measures and scored instances live in Outcome Score.</p>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onOpenOutcomeScore}>
            Open Outcome Score
          </Button>
        </div>
      ) : null}

      <Collapsible defaultOpen={false} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50/80 [&[data-state=open]>svg]:rotate-180">
          How this outcome applies to {componentName}
          <ChevronDown className="w-4 h-4 text-gray-500 transition-transform shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t border-gray-100">
            <Textarea
              value={appliesDescription}
              onChange={(e) => setAppliesDescription(e.currentTarget.value)}
              placeholder={`Describe how “${outcomeLabel}” shows up in this design…`}
              className="text-sm min-h-[88px] mt-2"
              data-testid="outcome-applies-description"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium bg-emerald-50 text-emerald-900 border-emerald-200"
              >
                {row.name}
                <span className="text-[10px] font-bold px-1 rounded bg-white/80 border border-emerald-200">{row.abbrev}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
