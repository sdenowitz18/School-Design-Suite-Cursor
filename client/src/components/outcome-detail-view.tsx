import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Info, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function scoreChip(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-400 border-gray-200";
  if (score >= 4) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
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

function genericOutcomeDescription(label: string): string {
  const clean = label.trim();
  const key = norm(clean);
  if (!clean) return "This outcome represents a target result for learners in this component.";

  const LIB: Record<string, string> = {
    algebra:
      "Algebra is the study of patterns and relationships using symbols and equations, building students’ ability to think abstractly, model real-world situations, and solve multi-step problems.",
    geometry:
      "Geometry explores shapes, space, and measurement, helping students reason visually, construct and justify arguments, and connect spatial relationships to real-world contexts.",
    calculus:
      "Calculus focuses on change and accumulation, giving students tools to analyze functions, model dynamic systems, and reason about rates, growth, and optimization.",
    physics:
      "Physics examines matter, energy, and forces, supporting students to build models, test hypotheses, and explain how the physical world works.",
    chemistry:
      "Chemistry studies substances and how they interact, helping students explain material properties, analyze reactions, and connect molecular structure to observable outcomes.",
    biology:
      "Biology investigates living systems, enabling students to explain life processes, analyze evidence, and reason about ecosystems, genetics, and evolution.",
    "computer science":
      "Computer science develops computational thinking through algorithms, data, and programming, helping students design solutions, debug systems, and understand how technology works.",
    "ai literacy":
      "AI literacy helps students understand how AI systems are built and used, including data, models, and impacts—so they can evaluate, apply, and question AI responsibly.",
    robotics:
      "Robotics integrates design, mechanics, and programming, supporting students to build prototypes, test systems, and iterate toward reliable performance.",
    reading:
      "Reading focuses on comprehension and analysis, helping students interpret texts, evaluate claims, and build knowledge through evidence and context.",
    writing:
      "Writing develops students’ ability to communicate clearly for purpose and audience, using structure, evidence, and revision to strengthen ideas.",
    literature:
      "Literature supports close reading and interpretation of complex texts, helping students analyze themes, craft, and perspectives across genres and cultures.",
    collaboration:
      "Collaboration builds students’ ability to work effectively with others—sharing responsibility, communicating clearly, and coordinating toward shared goals.",
    communication:
      "Communication develops students’ capacity to express ideas clearly, listen actively, and adapt messages to different audiences and contexts.",
    leadership:
      "Leadership & followership develops students’ ability to guide and support teams—setting direction when needed and contributing constructively in shared work.",
    "identity & purpose":
      "Identity & purpose helps students develop a sense of self, values, and direction, strengthening motivation and meaning-making in learning and life.",
    "goal-setting":
      "Goal-setting helps students plan, monitor progress, and reflect—building habits that support persistence and continuous improvement.",
    attendance:
      "Attendance reflects consistent engagement with learning opportunities and is often a leading indicator of access, belonging, and academic progress.",
    "postsecondary plan":
      "Postsecondary planning supports students to clarify goals after graduation and map concrete next steps, including applications, requirements, timelines, and supports.",
    "postsecondary enrollment":
      "Postsecondary enrollment reflects students successfully transitioning into college or other continuing education pathways after graduation.",
    "continuing-education / post-secondary knowledge & exposure":
      "Postsecondary knowledge & exposure helps students understand pathways after high school by building awareness, familiarity, and readiness for available options.",
  };

  if (LIB[key]) return LIB[key];

  // Fallback: keep it neutral and specific without over-claiming.
  return `${clean} is an outcome focus area for this component, describing what learners should develop over time. Use the notes below to clarify what “${clean}” looks like in practice here.`;
}

export interface OutcomeDetailViewProps {
  nodeId?: string;
  title?: string;
  outcomeLabel: string;
  onBack: () => void;
  onOpenOutcomeScore?: () => void;
}

export default function OutcomeDetailView({ nodeId, title, outcomeLabel, onBack, onOpenOutcomeScore }: OutcomeDetailViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outcomeAim = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return aims.find((a: any) => a?.type === "outcome" && norm(a?.label) === norm(outcomeLabel)) || null;
  }, [comp, outcomeLabel]);

  const priority = useMemo(() => levelToPriority(outcomeAim?.level), [outcomeAim?.level]);

  const outcomeRow = useMemo(() => {
    const osd: any = (comp as any)?.healthData?.outcomeScoreData || {};
    const list: any[] = osd.targetedOutcomes || [];
    return list.find((o: any) => norm(o?.outcomeName) === norm(outcomeLabel)) || null;
  }, [comp, outcomeLabel]);

  const outcomeScore = outcomeRow?.calculatedScore ?? null;
  const measures: any[] = outcomeRow?.measures || [];
  const ratedCount = measures.filter((m) => m?.rating !== null && !m?.skipped).length;

  const subcomponentTags = useMemo(() => {
    const subs: any[] = (comp as any)?.designedExperienceData?.subcomponents || [];
    const tagged = subs
      .filter((s: any) => (s?.aims || []).some((a: any) => a?.type === "outcome" && norm(a?.label) === norm(outcomeLabel)))
      .map((s: any) => String(s?.name || "Untitled"));
    return tagged;
  }, [comp, outcomeLabel]);

  const [appliesDescription, setAppliesDescription] = useState("");
  const [initialized, setInitialized] = useState(false);
  const componentName = title || comp?.title || "this component";

  const setPriority = useCallback(
    (p: "H" | "M" | "L") => {
      if (!nodeId || !comp) return;

      // 1) Update Designed Experience aim level (source of truth for priority).
      const de: any = (comp as any).designedExperienceData || {};
      const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
      const aims: any[] = kde.aims || [];
      const nextAims = aims.map((a: any) =>
        a?.type === "outcome" && norm(a?.label) === norm(outcomeLabel) ? { ...a, level: priorityToLevel(p) } : a,
      );

      // 2) Also update Outcome Score targetedOutcomes priority so Status & Health reflects immediately.
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

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="outcome-detail-view">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{outcomeLabel}</h2>
              {(title || comp?.title) && <p className="text-sm text-gray-500 mt-0.5">{title || comp?.title}</p>}
            </div>
            <div className={cn("w-16 h-12 rounded-md flex items-center justify-center font-bold text-2xl border", scoreChip(outcomeScore))}>
              {outcomeScore !== null ? (Math.round(outcomeScore * 10) / 10).toFixed(1) : "—"}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-700 leading-relaxed">{genericOutcomeDescription(outcomeLabel)}</p>
          </div>
        </div>

        <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Priority</span>
            <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white">
              {(["H", "M", "L"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPriority(k)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold transition-colors",
                    k !== "H" && "border-l border-gray-200",
                    priority === k ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-800",
                  )}
                  aria-pressed={priority === k}
                  data-testid={`outcome-detail-priority-${k}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <span>
            Measures: {ratedCount}/{measures.length} rated
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">How this outcome applies to {componentName}</h3>
        </div>
        <div className="p-4 space-y-2">
          <Textarea
            value={appliesDescription}
            onChange={(e) => setAppliesDescription(e.currentTarget.value)}
            placeholder="Describe how this outcome applies in this component…"
            className="text-sm min-h-[90px] bg-white"
            data-testid="outcome-applies-description"
          />
          <p className="text-[10px] text-gray-400">Shown on the Outcomes summary and Outcome detail pages.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-gray-900">Measures (read-only)</h3>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onOpenOutcomeScore} disabled={!onOpenOutcomeScore}>
            Open Outcomes Score
          </Button>
        </div>
        <div className="p-4 space-y-3">
          {measures.length === 0 ? (
            <div className="text-xs text-gray-400 italic">No measures yet. Add measures in the Outcomes Score page.</div>
          ) : (
            <div className="space-y-2">
              {measures.map((m: any) => {
                const rating = m?.rating ?? null;
                const ratingLabel = rating !== null ? String(rating) : "—";
                return (
                  <div key={m.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900 truncate">{m?.name || "Untitled measure"}</div>
                      <div className="text-[10px] text-gray-500">
                        Priority {m?.priority || "M"} • Confidence {m?.confidence || "M"}
                        {m?.skipped ? " • Skipped" : ""}
                      </div>
                    </div>
                    <div className={cn("w-8 h-6 rounded flex items-center justify-center text-xs font-bold border", scoreChip(rating))}>
                      {ratingLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Tagged subcomponents</h3>
        </div>
        <div className="p-4">
          {subcomponentTags.length === 0 ? (
            <div className="text-xs text-gray-400 italic">Not tagged to any subcomponents.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subcomponentTags.map((n) => (
                <Badge key={n} variant="secondary" className="bg-gray-100 text-gray-700 border border-gray-200 text-[11px]">
                  {n}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

