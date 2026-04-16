"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Library, Plus, Sparkles, Trash2 } from "lucide-react";
import { componentQueries, useCreateComponent, useDeleteComponent, useUpdateComponent } from "@/lib/api";
import { PlainLanguageInput } from "@/components/expert-view/PlainLanguageInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { computeRingPositions, uniqueNodeIdFromLabel } from "@/lib/canvas-placement";
import {
  defaultSnapshotForLearnerComponent,
  LEARNER_COMPONENT_COLOR_ROTATION,
} from "@/lib/learner-experience-create";
import { useLearnerModuleLibrary } from "@/contexts/learner-module-library-context";
import { useMergedComponent } from "@/lib/useMergedComponent";
import { isAdultRingComponent } from "@/lib/ring-experience-audience";
import { scheduleMigrateLegacyOverallAdultSubcomponents } from "@/lib/legacy-overall-adult-subs-migration";

function prototypeGeneratedDescription(comp: any): string {
  const title = String(comp?.title || "Component");
  const sub = String(comp?.subtitle || "").trim();
  const de = comp?.designedExperienceData || {};
  const meta = de.adultExperienceCatalogMeta;
  const snap = comp?.snapshotData || {};
  const parts = [`${title} is a school-level adult experience module on the blueprint.`];
  if (sub) parts.push(`Stated focus: ${sub}.`);
  if (meta?.bucketId) parts.push(`Catalog dimension: ${String(meta.bucketId)}.`);
  if (meta?.primaryId) parts.push(`Primary tag: ${String(meta.primaryId)}.`);
  if (snap.componentType) parts.push(`Snapshot type: ${String(snap.componentType)}.`);
  parts.push("(Prototype — wire to your summarization model when ready.)");
  return parts.join(" ");
}

/** Manage school-level adult experience as blueprint ring components (octagons), not center subcomponents. */
export default function SchoolAdultExperienceView({
  onBack,
  onOpenComponent,
  hideShellBackButton = false,
}: {
  onBack: () => void;
  onOpenComponent: (nodeId: string) => void;
  hideShellBackButton?: boolean;
}) {
  const { toggleLibrary, setModuleLibraryAudience } = useLearnerModuleLibrary();
  const { data: componentsRaw } = useQuery(componentQueries.all);
  const comp = useMergedComponent("overall");
  const createMutation = useCreateComponent();
  const deleteMutation = useDeleteComponent();
  const updateMutation = useUpdateComponent();

  const ringComponents = useMemo(
    () =>
      Array.isArray(componentsRaw)
        ? componentsRaw.filter(
            (c: any) => String(c?.nodeId || "") !== "overall" && isAdultRingComponent(c),
          )
        : [],
    [componentsRaw],
  );

  const [scratchName, setScratchName] = useState("");
  const [scratchDesc, setScratchDesc] = useState("");
  const [showScratchAdd, setShowScratchAdd] = useState(false);
  const [schoolDescribeDraft, setSchoolDescribeDraft] = useState("");
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});
  const [draftDescs, setDraftDescs] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextT: Record<string, string> = {};
    const nextD: Record<string, string> = {};
    for (const c of ringComponents) {
      const id = String(c.nodeId);
      nextT[id] = String(c.title || "");
      nextD[id] = String((c as any)?.designedExperienceData?.description || (c as any)?.snapshotData?.description || "");
    }
    setDraftTitles(nextT);
    setDraftDescs(nextD);
  }, [ringComponents]);

  const allRings = useMemo(
    () =>
      Array.isArray(componentsRaw)
        ? componentsRaw.filter((c: any) => String(c?.nodeId || "") !== "overall")
        : [],
    [componentsRaw],
  );

  useEffect(() => {
    const de = (comp as any)?.designedExperienceData;
    scheduleMigrateLegacyOverallAdultSubcomponents({
      overallDesignedExperience: de,
      allRings,
      createMutateAsync: (body) => createMutation.mutateAsync(body),
      updateMutateAsync: (args) => updateMutation.mutateAsync(args),
    });
  }, [comp, allRings, createMutation, updateMutation]);

  const addFromScratch = async () => {
    const name = scratchName.trim();
    if (!name) return;
    const start = allRings.length;
    const pos = computeRingPositions(start, 1)[0]!;
    const idSet = new Set(allRings.map((c: any) => String(c.nodeId)));
    const nodeId = uniqueNodeIdFromLabel(name, idSet);
    const color = LEARNER_COMPONENT_COLOR_ROTATION[start % LEARNER_COMPONENT_COLOR_ROTATION.length];
    const base = defaultSnapshotForLearnerComponent(name);
    await createMutation.mutateAsync({
      nodeId,
      title: name,
      subtitle: "",
      color,
      canvasX: pos.canvasX,
      canvasY: pos.canvasY,
      snapshotData: { ...base, description: scratchDesc.trim() || base.description },
      designedExperienceData: { description: scratchDesc.trim(), experienceAudience: "adult" },
      healthData: {},
    });
    setScratchName("");
    setScratchDesc("");
    setShowScratchAdd(false);
  };

  const persistTitle = (nodeId: string, title: string) => {
    updateMutation.mutate({ nodeId, data: { title } });
  };

  const persistDescription = (nodeId: string, description: string) => {
    const c = ringComponents.find((x: any) => x.nodeId === nodeId);
    const de = (c as any)?.designedExperienceData || {};
    const snap = (c as any)?.snapshotData || {};
    updateMutation.mutate({
      nodeId,
      data: {
        designedExperienceData: { ...de, description },
        snapshotData: { ...snap, description },
      },
    });
  };

  const openLibraryAdult = () => {
    setModuleLibraryAudience("adult");
    toggleLibrary();
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="school-adult-experience-view">
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
          <h1 className="text-xl font-bold text-gray-900">Adult experience (whole school)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Adult-facing modules appear as octagons on the blueprint. Open the catalog on Adult and drag onto the blueprint
            or this panel, or add from scratch below.
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
          <h2 className="text-sm font-semibold text-gray-800">Add components</h2>
          <p className="text-xs text-gray-600">
            Open the catalog on Adult, then drag a module onto the blueprint or this screen while the school overview is
            open, or add a custom component from scratch.
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
              {showScratchAdd ? "Hide add from scratch" : "Add component from scratch"}
            </Button>
          </div>
          {showScratchAdd ? (
            <div className="space-y-3 pt-2 border-t border-violet-100">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={scratchName}
                  onChange={(e) => setScratchName(e.target.value)}
                  placeholder="Component name"
                  className="h-9 text-sm flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1"
                  onClick={() => void addFromScratch()}
                  disabled={!scratchName.trim() || createMutation.isPending}
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
          <h2 className="text-sm font-semibold text-gray-800">Your adult components ({ringComponents.length})</h2>
          {ringComponents.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No adult components yet — use the module library or add from scratch.</p>
          ) : (
            <div className="space-y-3">
              {ringComponents.map((c: any) => {
                const id = String(c.nodeId);
                return (
                  <div key={id} className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                      <Input
                        value={draftTitles[id] ?? ""}
                        onChange={(e) => setDraftTitles((prev) => ({ ...prev, [id]: e.target.value }))}
                        onBlur={() => persistTitle(id, draftTitles[id] ?? "")}
                        className="h-9 text-sm font-medium flex-1"
                      />
                      <div className="flex gap-2 shrink-0">
                        <Button type="button" size="sm" variant="secondary" className="h-9 text-xs" onClick={() => onOpenComponent(id)}>
                          Open component
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete “${draftTitles[id] || id}” from the canvas?`)) {
                              deleteMutation.mutate(id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
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
                            const text = prototypeGeneratedDescription(c);
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
                        onBlur={() => persistDescription(id, draftDescs[id] ?? "")}
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
