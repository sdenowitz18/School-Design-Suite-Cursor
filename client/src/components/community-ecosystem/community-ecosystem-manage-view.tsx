"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { PlainLanguageInput } from "@/components/expert-view/PlainLanguageInput";
import {
  COMMUNITY_ECOSYSTEM_DEFAULTS,
  type CommunityEcosystemOutcome,
} from "./community-ecosystem-types";

let customIdCounter = 0;
function newCustomId() {
  return `ceo_custom_${Date.now()}_${++customIdCounter}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function CommunityEcosystemManageView({
  plainText,
  onPlainTextChange,
  outcomes,
  onChange,
  onPatchOutcome,
  onManageDetails,
  onBack,
  hideShellBackButton = false,
}: {
  plainText: string;
  onPlainTextChange: (v: string) => void;
  outcomes: CommunityEcosystemOutcome[];
  onChange: (next: CommunityEcosystemOutcome[]) => void;
  onPatchOutcome: (id: string, patch: Partial<CommunityEcosystemOutcome>) => void;
  onManageDetails: (id: string) => void;
  onBack: () => void;
  hideShellBackButton?: boolean;
}) {
  const [customLabel, setCustomLabel] = useState("");
  const [showCustomAdd, setShowCustomAdd] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(outcomes.map((o) => [o.id, o])), [outcomes]);

  const toggleDefault = (id: string, label: string) => {
    if (byId.has(id)) {
      setRemoveId(id);
      return;
    }
    const next: CommunityEcosystemOutcome = {
      id,
      label,
      kind: "default",
      description: "",
      metricUnit: "number",
      currentValue: null,
      targetValue: null,
    };
    onChange([...outcomes, next]);
  };

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const next: CommunityEcosystemOutcome = {
      id: newCustomId(),
      label,
      kind: "custom",
      description: "",
      metricUnit: "number",
      currentValue: null,
      targetValue: null,
    };
    onChange([...outcomes, next]);
    setCustomLabel("");
    setShowCustomAdd(false);
  };

  const confirmRemove = () => {
    if (!removeId) return;
    onChange(outcomes.filter((o) => o.id !== removeId));
    setRemoveId(null);
  };

  const removingLabel = removeId ? byId.get(removeId)?.label ?? removeId : "";

  const onRowFile = async (outcomeId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const artifactDataUrl = await readFileAsDataUrl(file);
      onPatchOutcome(outcomeId, { artifactDataUrl, artifactFileName: file.name });
    } catch {
      /* ignore */
    }
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="community-ecosystem-manage-view">
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
          <h1 className="text-xl font-bold text-gray-900">Community &amp; ecosystem outcomes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe your school context in plain language, then select common outcomes or add your own. Manage details
            for description, targets, and artifacts.
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Describe community &amp; ecosystem outcomes</h2>
          <p className="text-xs text-gray-500">
            Type or record in plain language. Future: AI may suggest outcomes from this text — not wired yet.
          </p>
          <PlainLanguageInput
            value={plainText}
            onChange={onPlainTextChange}
            indicativeOnly
            showGenerateSummary
            placeholder="e.g. We prioritize stable enrollment, strong staff retention, and caregiver trust…"
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Common community and ecosystem outcomes</h2>
          <p className="text-xs text-gray-500">
            Click to add or remove common outcomes (remove asks for confirmation). Add a custom label below.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {COMMUNITY_ECOSYSTEM_DEFAULTS.map((d) => {
              const on = byId.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDefault(d.id, d.label)}
                  className={cn(
                    "text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors",
                    on
                      ? "bg-teal-50 text-teal-900 border-teal-300 hover:bg-teal-100"
                      : "bg-white text-gray-600 border-gray-200 hover:border-teal-200 hover:bg-gray-50",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
            {!showCustomAdd ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[34px] gap-1 border-dashed rounded-full"
                onClick={() => setShowCustomAdd(true)}
                data-testid="button-add-custom-community-outcome"
              >
                <Plus className="w-3 h-3" />
                Add custom outcome
              </Button>
            ) : null}
          </div>
          {showCustomAdd ? (
            <div className="pt-1 space-y-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-700 pt-2">Custom outcome</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Chronic absenteeism rate"
                  className="h-9 text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustom();
                  }}
                  autoFocus
                />
                <Button type="button" size="sm" className="h-9 gap-1" onClick={addCustom} disabled={!customLabel.trim()}>
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setShowCustomAdd(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Selected ({outcomes.length})</h2>
          {outcomes.length === 0 ? (
            <p className="text-xs text-gray-400 italic">None selected yet.</p>
          ) : (
            <ul className="space-y-3">
              {outcomes.map((o) => (
                <li
                  key={o.id}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-gray-800 font-medium">{o.label}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-teal-700 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{o.artifactFileName ? "Replace artifact" : "Upload artifact"}</span>
                        <input type="file" className="hidden" onChange={(e) => void onRowFile(o.id, e)} />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => onManageDetails(o.id)}
                        data-testid={`button-manage-details-${o.id}`}
                      >
                        Manage details
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-red-600"
                        onClick={() => setRemoveId(o.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  {o.artifactFileName ? (
                    <p className="text-[11px] text-gray-500">
                      Artifact: {o.artifactFileName}
                      {o.artifactDataUrl ? (
                        <button
                          type="button"
                          className="ml-2 text-sky-600 hover:underline"
                          onClick={() =>
                            onPatchOutcome(o.id, { artifactDataUrl: undefined, artifactFileName: undefined })
                          }
                        >
                          Clear
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog open={!!removeId} onOpenChange={(open) => !open && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this outcome?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete &quot;{removingLabel}&quot; and all saved details (description, targets, artifact) for
              it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
