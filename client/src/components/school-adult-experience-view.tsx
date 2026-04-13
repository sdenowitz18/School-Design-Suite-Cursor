"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Library, Plus, Sparkles, Trash2 } from "lucide-react";
import { PlainLanguageInput } from "@/components/expert-view/PlainLanguageInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMergedComponent } from "@/lib/useMergedComponent";
import { useUpdateComponent } from "@/lib/api";
import { useLearnerModuleLibrary } from "@/contexts/learner-module-library-context";
import type { DESubcomponent } from "./designed-experience-view";

let subIdCounter = 0;
const newSubId = () => `de_sub_${Date.now()}_${++subIdCounter}`;

function normalizeAdultSub(raw: any): DESubcomponent {
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

function prototypeAdultDescription(sub: DESubcomponent): string {
  const name = String(sub.name || "Module").trim() || "Module";
  return `${name} is a whole-school adult experience module. (Prototype — wire to summarization when ready.)`;
}

/** Manage school-level adult experience modules (stored on the overall component as adultSubcomponents). */
export default function SchoolAdultExperienceView({
  onBack,
}: {
  onBack: () => void;
}) {
  const { toggleLibrary, setModuleLibraryAudience } = useLearnerModuleLibrary();
  const comp = useMergedComponent("overall");
  const updateMutation = useUpdateComponent();

  const adultSubRaw = (comp as any)?.designedExperienceData?.adultSubcomponents;
  const serverSubs: DESubcomponent[] = useMemo(
    () => (Array.isArray(adultSubRaw) ? adultSubRaw.map((s: any) => normalizeAdultSub(s)) : []),
    [adultSubRaw],
  );

  const [localSubs, setLocalSubs] = useState<DESubcomponent[]>([]);
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});
  const [draftDescs, setDraftDescs] = useState<Record<string, string>>({});
  const [schoolDescribeDraft, setSchoolDescribeDraft] = useState("");
  const [scratchName, setScratchName] = useState("");
  const [scratchDesc, setScratchDesc] = useState("");
  const [showScratchAdd, setShowScratchAdd] = useState(false);

  useEffect(() => {
    setLocalSubs(serverSubs);
  }, [serverSubs]);

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

  const persistSubs = (next: DESubcomponent[]) => {
    setLocalSubs(next);
    const de: any = (comp as any)?.designedExperienceData ?? {};
    updateMutation.mutate({
      nodeId: "overall",
      data: { designedExperienceData: { ...de, adultSubcomponents: next } },
    });
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
    setModuleLibraryAudience("adult");
    toggleLibrary();
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="school-adult-experience-view">
      <div className="max-w-4xl mx-auto px-6 py-6 pb-20 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Designed Experience
        </button>

        <div>
          <h1 className="text-xl font-bold text-gray-900">Adult experience (whole school)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe and manage school-level adult experience modules. Use the module library on Adult, then drag onto
            this overview panel, or add from scratch below.
          </p>
        </div>

        <section className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Describe adult experience at your school</h2>
          <PlainLanguageInput
            value={schoolDescribeDraft}
            onChange={setSchoolDescribeDraft}
            placeholder="Write or record how adult experiences show up school-wide (prototype — not saved to the server yet)."
            showGenerateSummary={false}
          />
        </section>

        <section className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Add modules</h2>
          <p className="text-xs text-gray-600">
            Open the catalog on Adult, then drag modules here while the overview panel is open, or add from scratch.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-9 gap-2 bg-violet-900 hover:bg-violet-800" onClick={openLibraryAdult}>
              <Library className="w-4 h-4" />
              Add from module library
            </Button>
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
                  <div key={id} className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm space-y-2">
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
                            const text = prototypeAdultDescription(s);
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
