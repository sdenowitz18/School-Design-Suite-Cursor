"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, Library, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlainLanguageInput } from "@/components/expert-view/PlainLanguageInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMergedComponent } from "@/lib/useMergedComponent";
import { useUpdateComponent } from "@/lib/api";
import { useLearnerModuleLibraryOptional } from "@/contexts/learner-module-library-context";
import type { DESubcomponent } from "./designed-experience-view";

let subIdCounter = 0;
const newSubId = () => `de_sub_${Date.now()}_${++subIdCounter}`;

function normalizeSub(raw: any): DESubcomponent {
  return {
    ...raw,
    id: String(raw?.id || newSubId()),
    name: String(raw?.name || ""),
    description: String(raw?.description || ""),
    aims: Array.isArray(raw?.aims) ? raw.aims : [],
    practices: Array.isArray(raw?.practices) ? raw.practices : [],
    supports: Array.isArray(raw?.supports) ? raw.supports : [],
  };
}

function prototypeSubDescription(sub: DESubcomponent, componentTitle: string): string {
  const name = String(sub.name || "Subcomponent").trim() || "Subcomponent";
  return `${name} is an adult experience sub-area within ${componentTitle}. (Prototype — wire to summarization when ready.)`;
}

export default function ComponentAdultExperienceView({
  nodeId,
  componentTitle,
  initialAdultSubcomponents,
  focusSubId = null,
  onBack,
  onAdultSubcomponentsUpdated,
  hideShellBackButton = false,
}: {
  nodeId: string;
  componentTitle: string;
  initialAdultSubcomponents: DESubcomponent[];
  /** When set (e.g. opened from a Designed Experience pill), scroll this module into view. */
  focusSubId?: string | null;
  onBack: () => void;
  onAdultSubcomponentsUpdated?: (subs: DESubcomponent[]) => void;
  hideShellBackButton?: boolean;
}) {
  const comp = useMergedComponent(nodeId);
  const updateMutation = useUpdateComponent();
  const learnerModuleLibrary = useLearnerModuleLibraryOptional();

  const [localSubs, setLocalSubs] = useState<DESubcomponent[]>(() =>
    initialAdultSubcomponents.map((s) => normalizeSub(s)),
  );
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});
  const [draftDescs, setDraftDescs] = useState<Record<string, string>>({});
  const [componentDescribeDraft, setComponentDescribeDraft] = useState("");
  const [scratchName, setScratchName] = useState("");
  const [scratchDesc, setScratchDesc] = useState("");
  const [showScratchAdd, setShowScratchAdd] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const nextT: Record<string, string> = {};
    const nextD: Record<string, string> = {};
    for (const s of localSubs) {
      nextT[s.id] = s.name;
      nextD[s.id] = s.description;
    }
    setDraftTitles(nextT);
    setDraftDescs(nextD);
  }, [localSubs]);

  useEffect(() => {
    if (!focusSubId) return;
    const t = window.setTimeout(() => {
      const el = rowRefs.current[focusSubId];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [focusSubId, localSubs.length]);

  const persistSubs = (next: DESubcomponent[]) => {
    setLocalSubs(next);
    const de: any = (comp as any)?.designedExperienceData ?? {};
    updateMutation.mutate(
      {
        nodeId,
        data: { designedExperienceData: { ...de, adultSubcomponents: next } },
      },
      {
        onSuccess: () => onAdultSubcomponentsUpdated?.(next),
      },
    );
  };

  const addFromScratch = () => {
    const name = scratchName.trim();
    if (!name) return;
    const sub: DESubcomponent = {
      id: newSubId(),
      name,
      description: scratchDesc.trim(),
      aims: [],
      practices: [],
      supports: [],
    };
    persistSubs([...localSubs, sub]);
    setScratchName("");
    setScratchDesc("");
    setShowScratchAdd(false);
  };

  const updateSubField = (id: string, patch: Partial<DESubcomponent>) => {
    persistSubs(localSubs.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const openLibraryAdult = () => {
    learnerModuleLibrary?.setModuleLibraryAudience("adult");
    learnerModuleLibrary?.toggleLibrary();
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="component-adult-experience-view">
      <div className="max-w-4xl mx-auto px-6 py-6 pb-20 space-y-6">
        {!hideShellBackButton ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Designed Experience
          </button>
        ) : null}

        <div>
          <h1 className="text-xl font-bold text-gray-900">Adult experience — {componentTitle}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe adult experience for this component, then add modules from the library (strip on Adult, drag onto
            this panel) or add from scratch.
          </p>
        </div>

        <section className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Describe adult experience</h2>
          <PlainLanguageInput
            value={componentDescribeDraft}
            onChange={setComponentDescribeDraft}
            placeholder="Write or record how adults experience this component (prototype — not saved to the server yet)."
            showGenerateSummary={false}
          />
        </section>

        <section className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Add modules</h2>
          <p className="text-xs text-gray-600">
            {learnerModuleLibrary
              ? "Open the catalog on Adult and drag onto the working panel, or add from scratch."
              : "Add from scratch (module library is on the blueprint)."}
          </p>
          <div className="flex flex-wrap gap-2">
            {learnerModuleLibrary ? (
              <Button type="button" size="sm" className="h-9 gap-2 bg-violet-900 hover:bg-violet-800" onClick={openLibraryAdult}>
                <Library className="w-4 h-4" />
                Add from module library
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1 border-dashed border-violet-300"
              onClick={() => setShowScratchAdd((v) => !v)}
            >
              <Plus className="w-3 h-3" />
              {showScratchAdd ? "Hide add from scratch" : "Add module from scratch"}
            </Button>
          </div>
          {showScratchAdd ? (
            <div className="space-y-3 pt-2 border-t border-violet-100">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={scratchName}
                  onChange={(e) => setScratchName(e.target.value)}
                  placeholder="Module name"
                  className="h-9 text-sm flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1"
                  onClick={() => addFromScratch()}
                  disabled={!scratchName.trim() || updateMutation.isPending}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
              <Textarea
                value={scratchDesc}
                onChange={(e) => setScratchDesc(e.target.value)}
                placeholder="Short description (optional)"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Your adult modules ({localSubs.length})</h2>
          {localSubs.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No modules yet — use the module library or add from scratch.</p>
          ) : (
            <div className="space-y-3">
              {localSubs.map((s) => {
                const id = s.id;
                return (
                  <div
                    key={id}
                    ref={(el) => {
                      rowRefs.current[id] = el;
                    }}
                    id={`adult-module-row-${id}`}
                    className={cn(
                      "rounded-xl border bg-white p-4 shadow-sm space-y-2",
                      focusSubId === id ? "border-violet-400 ring-2 ring-violet-200" : "border-violet-100",
                    )}
                  >
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                      <Input
                        value={draftTitles[id] ?? ""}
                        onChange={(e) => setDraftTitles((prev) => ({ ...prev, [id]: e.target.value }))}
                        onBlur={() => {
                          const raw = draftTitles[id] ?? "";
                          const next = raw.trim();
                          if (!next) {
                            setDraftTitles((p) => ({ ...p, [id]: s.name }));
                            return;
                          }
                          if (next !== s.name) updateSubField(id, { name: next });
                        }}
                        className="h-9 text-sm font-medium flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Remove “${draftTitles[id] || id}”?`)) {
                            persistSubs(localSubs.filter((x) => x.id !== id));
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Description</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] gap-1 text-violet-700 hover:text-violet-900"
                          onClick={() => {
                            const text = prototypeSubDescription(s, componentTitle);
                            setDraftDescs((prev) => ({ ...prev, [id]: text }));
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          Generate description
                        </Button>
                      </div>
                      <Textarea
                        value={draftDescs[id] ?? ""}
                        onChange={(e) => setDraftDescs((prev) => ({ ...prev, [id]: e.target.value }))}
                        onBlur={() => {
                          const next = draftDescs[id] ?? "";
                          if (next !== s.description) updateSubField(id, { description: next });
                        }}
                        placeholder="Short description"
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
