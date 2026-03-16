"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, Pencil, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries } from "@/lib/api";
import { SchemaPickerSheet } from "@/components/de-schema-picker-sheet";
import { OUTCOME_SCHEMA } from "@/components/designed-experience-schemas";
import type { PortraitOfGraduate } from "./pog-types";
import { buildWhereBuiltForOutcomeKeys, normKey } from "./pog-utils";
import PogOutcomePill from "./pog-outcome-pill";

function scoreChipClass(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-500 border-gray-200";
  if (score >= 4) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

export default function PogAttributeDetailView({
  portrait,
  attributeId,
  onChange,
  onBack,
}: {
  portrait: PortraitOfGraduate;
  attributeId: string;
  onChange: (next: PortraitOfGraduate) => void;
  onBack: () => void;
}) {
  const { data: allComponents } = useQuery(componentQueries.all);
  const attr = (portrait.attributes || []).find((a) => a.id === attributeId) || null;
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<{ icon: string; name: string; description: string }>(() => ({
    icon: attr?.icon || "★",
    name: attr?.name || "",
    description: attr?.description || "",
  }));

  const links = ((portrait.linksByAttributeId?.[attributeId] || []) as any[]) || [];
  const linkedSorted = useMemo(
    () => [...links].sort((a, b) => String(a?.outcomeLabel || "").localeCompare(String(b?.outcomeLabel || ""))),
    [links],
  );
  const linkByKey = useMemo(() => {
    const m = new Map<string, any>();
    for (const l of linkedSorted) {
      const k = normKey(l?.outcomeLabel);
      if (!k) continue;
      if (!m.has(k)) m.set(k, l);
    }
    return m;
  }, [linkedSorted]);

  const toggleOutcome = (label: string) => {
    const key = normKey(label);
    const exists = links.some((l: any) => normKey(l?.outcomeLabel) === key);
    const next = exists
      ? links.filter((l: any) => normKey(l?.outcomeLabel) !== key)
      : [...links, { outcomeLabel: label, priority: "M" as const }];
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: next,
      },
    });
  };

  const getOutcomeLevel = (label: string): "High" | "Medium" | "Low" | undefined => {
    const key = normKey(label);
    const link = links.find((l: any) => normKey(l?.outcomeLabel) === key);
    if (!link) return undefined;
    if ((link as any)?.priority === "H") return "High";
    if ((link as any)?.priority === "L") return "Low";
    return "Medium";
  };

  const setOutcomeLevel = (label: string, level: "High" | "Medium" | "Low") => {
    const key = normKey(label);
    const next = links.map((l: any) =>
      normKey(l?.outcomeLabel) === key
        ? { ...l, priority: level === "High" ? "H" : level === "Low" ? "L" : "M" }
        : l,
    );
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: next,
      },
    });
  };

  const linkedOutcomeKeys = useMemo(
    () => new Set(linkedSorted.map((l) => normKey(l?.outcomeLabel)).filter(Boolean)),
    [linkedSorted],
  );
  const whereBuilt = useMemo(
    () => buildWhereBuiltForOutcomeKeys((allComponents as any[]) || [], linkedOutcomeKeys),
    [allComponents, linkedOutcomeKeys],
  );

  const updateAttr = (
    patch: Partial<{
      icon: string;
      name: string;
      description: string;
      score1to5: 1 | 2 | 3 | 4 | 5 | null;
      builtPercent: 0 | 25 | 50 | 75 | 100 | null;
    }>,
  ) => {
    if (!attr) return;
    onChange({
      ...portrait,
      attributes: (portrait.attributes || []).map((a) => (a.id === attributeId ? { ...a, ...patch } : a)),
    });
  };

  const applyDetailsDraft = () => {
    if (!attr) return;
    const name = detailsDraft.name.trim();
    if (!name) return;
    updateAttr({
      icon: (detailsDraft.icon || "★").trim() || "★",
      name,
      description: detailsDraft.description,
    });
    setEditingDetails(false);
  };

  const deleteAttribute = () => {
    const confirmed = window.confirm("Delete this attribute? This will also remove all linked outcomes from this attribute.");
    if (!confirmed) return;
    const next: PortraitOfGraduate = {
      ...portrait,
      attributes: (portrait.attributes || []).filter((a) => a.id !== attributeId),
      linksByAttributeId: { ...(portrait.linksByAttributeId || {}) },
    };
    delete next.linksByAttributeId[attributeId];
    onChange(next);
    onBack();
  };

  if (!attr) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="mt-4 text-sm text-muted-foreground">Attribute not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-xs text-muted-foreground">
          Linked outcomes are added to Whole School outcomes automatically (priority is derived from POG links).
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-background space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md border flex items-center justify-center text-lg shrink-0">{attr.icon || "★"}</div>
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{attr.name}</div>
              {attr.description ? (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{attr.description}</div>
              ) : (
                <div className="text-sm text-muted-foreground">No description yet.</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">
              {linkedSorted.length === 1 ? "1 linked outcome" : `${linkedSorted.length} linked outcomes`}
            </Badge>
            <Button variant="outline" size="sm" onClick={deleteAttribute}>
              Delete attribute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsDraft({ icon: attr.icon || "★", name: attr.name || "", description: attr.description || "" });
                setEditingDetails(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit details
            </Button>
          </div>
        </div>

        {editingDetails && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Icon</div>
                <Input
                  value={detailsDraft.icon}
                  onChange={(e) => {
                    const v = e.currentTarget?.value ?? "";
                    setDetailsDraft((d) => ({ ...d, icon: v }));
                  }}
                />
              </div>
              <div className="md:col-span-10">
                <div className="text-xs text-muted-foreground mb-1">Name</div>
                <Input
                  value={detailsDraft.name}
                  onChange={(e) => {
                    const v = e.currentTarget?.value ?? "";
                    setDetailsDraft((d) => ({ ...d, name: v }));
                  }}
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Description</div>
              <Textarea
                value={detailsDraft.description}
                onChange={(e) => {
                  const v = e.currentTarget?.value ?? "";
                  setDetailsDraft((d) => ({ ...d, description: v }));
                }}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingDetails(false)}>
                Cancel
              </Button>
              <Button onClick={applyDetailsDraft} disabled={!detailsDraft.name.trim()}>
                Save
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-3 bg-background">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="font-medium text-foreground">Scores</div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">1-5</span>
            <select
              className={cn("h-7 rounded-full border px-2 text-xs", scoreChipClass((attr as any)?.score1to5 ?? null))}
              value={(attr as any)?.score1to5 ?? ""}
              onChange={(e) => {
                const raw = e.currentTarget?.value ?? "";
                const v = raw ? Number(raw) : null;
                updateAttr({
                  score1to5: v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? (v as 1 | 2 | 3 | 4 | 5) : null,
                });
              }}
            >
              <option value="">—</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Built %</span>
            <select
              className="h-7 rounded-full border px-2 text-xs"
              value={(attr as any)?.builtPercent ?? ""}
              onChange={(e) => {
                const raw = e.currentTarget?.value ?? "";
                const v = raw ? Number(raw) : null;
                updateAttr({
                  builtPercent: v === 0 || v === 25 || v === 50 || v === 75 || v === 100 ? (v as 0 | 25 | 50 | 75 | 100) : null,
                });
              }}
            >
              <option value="">—</option>
              <option value="0">0%</option>
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
              <option value="100">100%</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Linked outcomes</div>
          <SchemaPickerSheet
            title={`Add outcomes to ${attr.name || "this attribute"}`}
            description="Selections here are unique to this Portrait attribute and do not mirror Key Design Elements selections."
            schema={OUTCOME_SCHEMA}
            selectedLabels={(links || []).map((l: any) => String(l?.outcomeLabel || ""))}
            onToggle={toggleOutcome}
            getLevel={getOutcomeLevel}
            onSetLevel={(label, level) => setOutcomeLevel(label, level as any)}
            type="outcome"
            triggerLabel="Outcomes"
            triggerIcon={Target}
          />
        </div>
        {linkedSorted.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {linkedSorted.map((l: any) => (
              <PogOutcomePill key={String(l?.outcomeLabel)} label={String(l?.outcomeLabel || "")} meta={String(l?.priority || "M")} className="max-w-[320px]" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border p-4 text-sm text-muted-foreground bg-background">
            No outcomes linked yet.
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 bg-background space-y-3">
        <div className="text-sm font-medium">Where it&apos;s built (key aims only)</div>
        {whereBuilt.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {whereBuilt.map((wb) => (
              <div key={wb.nodeId} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div
                    className="w-9 h-9 shrink-0 border bg-muted/20"
                    style={{ clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{wb.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {wb.outcomes.length} referenced outcome{wb.outcomes.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wb.outcomes.map((label) => {
                    const priority = (linkByKey.get(normKey(label)) as any)?.priority || "M";
                    return (
                      <PogOutcomePill
                        key={`${wb.nodeId}:${label}`}
                        label={label}
                        meta={priority}
                        className="max-w-[240px]"
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No key-aim references found yet for these linked outcomes.</div>
        )}
      </div>
    </div>
  );
}

