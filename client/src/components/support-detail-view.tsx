import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { buildSupportUsageIndex, getSupportDetailsFromDesignedExperience, normKey } from "./supports-utils";

function genericSupportDescription(label: string): string {
  const clean = label.trim();
  const key = normKey(clean);
  if (!clean) return "This support represents a resource, routine, or enabling condition that helps the designed experience work reliably.";

  const LIB: Record<string, string> = {
    "high-quality aligned curriculum":
      "A high-quality aligned curriculum provides a coherent sequence of learning experiences, assessments, and materials that align to goals for learners and support consistent instructional practice across classrooms.",
    "rubrics & scoring guides":
      "Rubrics and scoring guides clarify expectations for quality work, support consistent feedback, and help educators and learners calibrate toward shared standards.",
    "coaching cycles":
      "Coaching cycles provide job-embedded learning for educators through observation, feedback, practice, and reflection—building consistency and continuous improvement over time.",
    "plc collaboration":
      "Professional learning community (PLC) collaboration structures time for educators to plan together, analyze student work, share strategies, and improve practice.",
    "learning management system":
      "A learning management system supports organizing content, distributing materials, tracking assignments, and communicating with learners and families.",
    "data dashboard":
      "A data dashboard consolidates key indicators so teams can monitor progress, identify patterns, and decide on next steps.",
    "tutoring program":
      "A tutoring program provides targeted additional learning time and support, often focusing on specific skills or goals for learners who benefit from extra practice.",
  };
  if (LIB[key]) return LIB[key];

  return `${clean} is a support that helps the designed experience work reliably across contexts. Use the notes below to clarify what “${clean}” means in this setting and what should stay consistent.`;
}

export default function SupportDetailView({
  nodeId,
  title,
  supportLabel,
  onBack,
}: {
  nodeId?: string;
  title?: string;
  supportLabel: string;
  onBack: () => void;
}) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const { data: allComponents } = useQuery(componentQueries.all);
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ key: string; keyGuidance: string }>({ key: "", keyGuidance: "" });
  const compRef = useRef<any>(null);

  const componentTitle = title || (comp as any)?.title || "Component";
  const key = normKey(supportLabel);

  const usageIndex = useMemo(() => {
    const list = Array.isArray(allComponents) ? allComponents : [];
    return buildSupportUsageIndex(list);
  }, [allComponents]);

  const usage = usageIndex.get(key);

  const [keyGuidance, setKeyGuidance] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    compRef.current = comp;
  }, [comp]);

  useEffect(() => {
    latestRef.current = { key, keyGuidance };
  }, [key, keyGuidance]);

  useEffect(() => {
    if (!comp || initialized) return;
    const de: any = (comp as any).designedExperienceData || {};
    const details = getSupportDetailsFromDesignedExperience(de);
    setKeyGuidance(String(details[key]?.keyConsistenciesGuidance || ""));
    setInitialized(true);
  }, [comp, initialized, key]);

  const commitSave = useCallback(
    (next: string) => {
      const c = compRef.current;
      if (!nodeId || !c) return;
      const de: any = (c as any).designedExperienceData || {};
      const details = getSupportDetailsFromDesignedExperience(de);
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            supportDetails: {
              ...details,
              [key]: { keyConsistenciesGuidance: next },
            },
          },
        },
      });
    },
    [key, nodeId, updateMutation],
  );

  const doSave = useCallback(
    (next: string) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        commitSave(next);
      }, 500);
    },
    [commitSave, nodeId],
  );

  useEffect(() => {
    if (!initialized) return;
    doSave(keyGuidance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, keyGuidance]);

  useEffect(() => {
    return () => {
      // Flush pending debounced save on navigation away.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const snap = latestRef.current;
        if (snap.key === key) commitSave(snap.keyGuidance);
      }
    };
  }, [commitSave, key]);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="support-detail-view">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{supportLabel}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{componentTitle}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-600 shrink-0" data-testid="support-usage-count">
            {usage?.count ?? 0} places
          </Badge>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-700 leading-relaxed">{genericSupportDescription(supportLabel)}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Key Consistencies and Guidance</div>
            <Textarea
              value={keyGuidance}
              onChange={(e) => setKeyGuidance(e.currentTarget.value)}
              placeholder="Capture what must stay consistent, guidance for implementation, and non-negotiables…"
              className="text-sm min-h-[140px] bg-white"
              data-testid="support-key-guidance"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Where this support is built</div>
            {usage?.components?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {usage.components.map((c) => (
                  <span key={c.nodeId} className={cn("text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200")}>
                    {c.title}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic">Not tagged in any components yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" className="h-8 text-xs" onClick={onBack}>
          Done
        </Button>
      </div>
    </div>
  );
}

