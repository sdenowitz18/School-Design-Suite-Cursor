"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type CommunityEcosystemMetricUnit,
  type CommunityEcosystemOutcome,
  communityEcosystemStatus,
} from "./community-ecosystem-types";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function CommunityEcosystemOutcomeDetailView({
  outcome,
  onBack,
  onSave,
  hideShellBackButton = false,
}: {
  outcome: CommunityEcosystemOutcome;
  onBack: () => void;
  onSave: (patch: Partial<CommunityEcosystemOutcome>) => void;
  hideShellBackButton?: boolean;
}) {
  const [description, setDescription] = useState(outcome.description ?? "");
  const [metricUnit, setMetricUnit] = useState<CommunityEcosystemMetricUnit>(outcome.metricUnit);
  const [currentStr, setCurrentStr] = useState(
    outcome.currentValue == null ? "" : String(outcome.currentValue),
  );
  const [targetStr, setTargetStr] = useState(outcome.targetValue == null ? "" : String(outcome.targetValue));

  useEffect(() => {
    setDescription(outcome.description ?? "");
    setMetricUnit(outcome.metricUnit);
    setCurrentStr(outcome.currentValue == null ? "" : String(outcome.currentValue));
    setTargetStr(outcome.targetValue == null ? "" : String(outcome.targetValue));
  }, [outcome.id, outcome.description, outcome.metricUnit, outcome.currentValue, outcome.targetValue]);

  const draft: CommunityEcosystemOutcome = useMemo(
    () => ({
      ...outcome,
      description,
      metricUnit,
      currentValue: parseOptionalNumber(currentStr),
      targetValue: parseOptionalNumber(targetStr),
    }),
    [outcome, description, metricUnit, currentStr, targetStr],
  );

  const status = communityEcosystemStatus(draft);

  const persistField = (patch: Partial<CommunityEcosystemOutcome>) => {
    onSave(patch);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      persistField({ artifactDataUrl: dataUrl, artifactFileName: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearArtifact = () => persistField({ artifactDataUrl: undefined, artifactFileName: undefined });

  return (
    <div className="min-h-screen bg-gray-50" data-testid="community-ecosystem-outcome-detail">
      <div className="max-w-2xl mx-auto px-6 py-6 pb-20 space-y-6">
        {!hideShellBackButton ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
        ) : null}

        <div>
          <h1 className="text-xl font-bold text-gray-900">{outcome.label}</h1>
          <p className="text-sm text-gray-500 mt-1">Community &amp; ecosystem outcome (school-wide)</p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
          <Label className="text-xs font-medium text-gray-700">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => persistField({ description })}
            placeholder="Describe this outcome and your goals…"
            rows={4}
            className="text-sm resize-y"
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Artifact (optional)</Label>
            {outcome.artifactFileName ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">{outcome.artifactFileName}</span>
                {outcome.artifactDataUrl?.startsWith("data:image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={outcome.artifactDataUrl} alt="" className="max-h-24 rounded border border-gray-100" />
                ) : null}
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={clearArtifact}>
                  Remove file
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer text-xs text-teal-700 hover:text-teal-900">
                <Upload className="w-4 h-4" />
                <span>Upload file</span>
                <input type="file" className="hidden" onChange={onFile} />
              </label>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Targets</h2>
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Unit</Label>
            <Select
              value={metricUnit}
              onValueChange={(v) => {
                const u = v === "percent" ? "percent" : "number";
                setMetricUnit(u);
                persistField({ metricUnit: u });
              }}
            >
              <SelectTrigger className="h-9 text-sm w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="percent">Percentage (0–100)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Current</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={currentStr}
                onChange={(e) => setCurrentStr(e.target.value)}
                onBlur={() => persistField({ currentValue: parseOptionalNumber(currentStr) })}
                placeholder="—"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Target</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={targetStr}
                onChange={(e) => setTargetStr(e.target.value)}
                onBlur={() => persistField({ targetValue: parseOptionalNumber(targetStr) })}
                placeholder="—"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium",
              status === "On track" && "bg-emerald-50 text-emerald-900 border border-emerald-200",
              status === "Off track" && "bg-amber-50 text-amber-900 border border-amber-200",
              status === "Set targets" && "bg-gray-50 text-gray-600 border border-gray-200",
            )}
          >
            {status}
          </div>
          <p className="text-[11px] text-gray-500">
            Higher is better: on track when current is greater than or equal to target (equal counts as on track).
          </p>
        </section>
      </div>
    </div>
  );
}
