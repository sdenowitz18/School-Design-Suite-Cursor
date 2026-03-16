"use client";

import React, { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SchemaPickerSheet } from "@/components/de-schema-picker-sheet";
import { OUTCOME_SCHEMA } from "@/components/designed-experience-schemas";
import type { PortraitOfGraduate, PortraitAttribute } from "./pog-types";
import { normKey } from "./pog-utils";
import PogOutcomePill from "./pog-outcome-pill";
import PogLearnMoreView from "./pog-learn-more-view";

function genId() {
  return `pog_attr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function priorityToLevel(priority: unknown): "High" | "Medium" | "Low" {
  if (priority === "H") return "High";
  if (priority === "L") return "Low";
  return "Medium";
}

function levelToPriority(level: unknown): "H" | "M" | "L" {
  if (level === "High") return "H";
  if (level === "Low") return "L";
  return "M";
}

export default function PogHubView({
  portrait,
  onChange,
  onOpenAttribute,
  onStartWithOutcomes,
  onViewAll,
}: {
  portrait: PortraitOfGraduate;
  onChange: (next: PortraitOfGraduate) => void;
  onOpenAttribute: (attributeId: string) => void;
  onStartWithOutcomes: () => void;
  onViewAll: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [draft, setDraft] = useState<{ icon: string; name: string; description: string }>({ icon: "★", name: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ icon: string; name: string; description: string }>({ icon: "★", name: "", description: "" });

  const linksCountByAttrId = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of portrait.attributes || []) {
      const n = (portrait.linksByAttributeId?.[a.id] || []).length;
      m.set(a.id, n);
    }
    return m;
  }, [portrait.attributes, portrait.linksByAttributeId]);

  const linkedOutcomesByAttrId = useMemo(() => {
    const m = new Map<string, { label: string; priority: string }[]>();
    for (const a of portrait.attributes || []) {
      const raw = portrait.linksByAttributeId?.[a.id] || [];
      const seen = new Set<string>();
      const uniq: { label: string; priority: string }[] = [];
      for (const l of Array.isArray(raw) ? raw : []) {
        const label = String((l as any)?.outcomeLabel || "").trim();
        if (!label) continue;
        const k = normKey(label);
        if (!k) continue;
        if (seen.has(k)) continue;
        seen.add(k);
        const p = (l as any)?.priority;
        const priority = p === "H" || p === "M" || p === "L" ? p : "M";
        uniq.push({ label, priority });
      }
      m.set(a.id, uniq);
    }
    return m;
  }, [portrait.attributes, portrait.linksByAttributeId]);

  if (showLearnMore) {
    return <PogLearnMoreView onBack={() => setShowLearnMore(false)} />;
  }

  const startEdit = (a: PortraitAttribute) => {
    setEditingId(a.id);
    setEditDraft({ icon: a.icon || "★", name: a.name || "", description: a.description || "" });
  };

  const applyEdit = () => {
    if (!editingId) return;
    const nextName = editDraft.name.trim();
    if (!nextName) return;
    const next: PortraitOfGraduate = {
      ...portrait,
      attributes: (portrait.attributes || []).map((a) =>
        a.id === editingId
          ? { ...a, icon: (editDraft.icon || "★").trim() || "★", name: nextName, description: editDraft.description }
          : a,
      ),
    };
    onChange(next);
    setEditingId(null);
  };

  const removeAttr = (id: string) => {
    const confirmed = window.confirm("Delete this attribute? This will also remove all linked outcomes from this attribute.");
    if (!confirmed) return;
    const next: PortraitOfGraduate = {
      ...portrait,
      attributes: (portrait.attributes || []).filter((a) => a.id !== id),
      linksByAttributeId: { ...(portrait.linksByAttributeId || {}) },
    };
    delete next.linksByAttributeId[id];
    onChange(next);
    if (editingId === id) setEditingId(null);
  };

  const addAttr = () => {
    const name = draft.name.trim();
    if (!name) return;
    const id = genId();
    const next: PortraitOfGraduate = {
      ...portrait,
      attributes: [
        ...(portrait.attributes || []),
        { id, icon: (draft.icon || "★").trim() || "★", name, description: draft.description } as PortraitAttribute,
      ],
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [id]: [],
      },
    };
    onChange(next);
    setDraft({ icon: "★", name: "", description: "" });
    setAdding(false);
  };

  const linksForAttr = (attributeId: string): { outcomeLabel: string; priority: "H" | "M" | "L" }[] =>
    ((portrait.linksByAttributeId?.[attributeId] || []) as any[]) || [];

  const toggleAttrOutcome = (attributeId: string, label: string) => {
    const key = normKey(label);
    const current = linksForAttr(attributeId);
    const exists = current.some((l) => normKey(l?.outcomeLabel) === key);
    const next = exists
      ? current.filter((l) => normKey(l?.outcomeLabel) !== key)
      : [...current, { outcomeLabel: label, priority: "M" as const }];
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: next,
      },
    });
  };

  const getAttrOutcomeLevel = (attributeId: string, label: string): "High" | "Medium" | "Low" | undefined => {
    const key = normKey(label);
    const link = linksForAttr(attributeId).find((l) => normKey((l as any)?.outcomeLabel) === key);
    if (!link) return undefined;
    return priorityToLevel((link as any)?.priority);
  };

  const setAttrOutcomeLevel = (attributeId: string, label: string, level: "High" | "Medium" | "Low") => {
    const key = normKey(label);
    const next = linksForAttr(attributeId).map((l) =>
      normKey((l as any)?.outcomeLabel) === key
        ? { ...(l as any), priority: levelToPriority(level) }
        : l,
    );
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: next as any,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">Portrait of a Graduate</div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowLearnMore(true)}>
              <BookOpen className="h-4 w-4 mr-1.5" />
              Learn more
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Create attributes that describe your graduate vision, then connect each attribute to outcomes. Linked outcomes are automatically added to Whole
            School outcomes (priority is derived from POG links).
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onStartWithOutcomes}>
              Start with outcomes
            </Button>
            <Button size="sm" variant="outline" onClick={onViewAll}>
              View all
            </Button>
          </div>
        </div>
        <Button onClick={() => setAdding(true)} className={cn(adding && "opacity-60")} disabled={adding}>
          <Plus className="h-4 w-4 mr-2" />
          Add attribute
        </Button>
      </div>

      {adding && (
        <div className="rounded-lg border p-4 space-y-3 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">Icon</div>
              <Input
                value={draft.icon}
                onChange={(e) => {
                  const v = e.currentTarget?.value ?? "";
                  setDraft((d) => ({ ...d, icon: v }));
                }}
                placeholder="★"
              />
            </div>
            <div className="md:col-span-10">
              <div className="text-xs text-muted-foreground mb-1">Name</div>
              <Input
                value={draft.name}
                onChange={(e) => {
                  const v = e.currentTarget?.value ?? "";
                  setDraft((d) => ({ ...d, name: v }));
                }}
                placeholder="Resilient achiever"
              />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Description</div>
            <Textarea
              value={draft.description}
              onChange={(e) => {
                const v = e.currentTarget?.value ?? "";
                setDraft((d) => ({ ...d, description: v }));
              }}
              placeholder="What does this look like for graduates?"
              rows={3}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={addAttr} disabled={!draft.name.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(portrait.attributes || []).map((a) => {
          const n = linksCountByAttrId.get(a.id) || 0;
          const linked = linkedOutcomesByAttrId.get(a.id) || [];
          const preview = linked.slice(0, 6);
          const extra = Math.max(0, linked.length - preview.length);
          const isEditing = editingId === a.id;
          return (
            <div key={a.id} className="rounded-lg border p-4 bg-background space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-md border flex items-center justify-center text-base shrink-0">{a.icon || "★"}</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{n === 1 ? "1 linked outcome" : `${n} linked outcomes`}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => onOpenAttribute(a.id)}>
                    Open <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>

              {!isEditing ? (
                <>
                  {a.description ? <div className="text-sm text-muted-foreground whitespace-pre-wrap">{a.description}</div> : <div className="text-sm text-muted-foreground">No description yet.</div>}

                  {linked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {preview.map((it) => (
                        <PogOutcomePill key={it.label} label={it.label} meta={it.priority} className="max-w-[240px]" />
                      ))}
                      {extra > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{extra} more
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="pt-1">
                    <SchemaPickerSheet
                      title={`Add outcomes to ${a.name || "this attribute"}`}
                      description="Selections here are unique to this Portrait attribute and do not mirror Key Design Elements selections."
                      schema={OUTCOME_SCHEMA}
                      selectedLabels={(linksForAttr(a.id) || []).map((l: any) => String(l?.outcomeLabel || ""))}
                      onToggle={(label) => toggleAttrOutcome(a.id, label)}
                      getLevel={(label) => getAttrOutcomeLevel(a.id, label)}
                      onSetLevel={(label, level) => setAttrOutcomeLevel(a.id, label, level as any)}
                      type="outcome"
                      triggerLabel="Outcomes"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] font-medium border border-dashed rounded-full px-2 py-0.5 transition-colors text-indigo-600 border-indigo-300 hover:text-indigo-700 hover:border-indigo-400"
                      >
                        <Plus className="w-3 h-3" />
                        + Outcomes
                      </button>
                    </SchemaPickerSheet>
                  </div>

                  {linked.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      No outcomes linked yet. Open this attribute to add outcomes.
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Attribute</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeAttr(a.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Icon</div>
                      <Input
                        value={editDraft.icon}
                        onChange={(e) => {
                          const v = e.currentTarget?.value ?? "";
                          setEditDraft((d) => ({ ...d, icon: v }));
                        }}
                      />
                    </div>
                    <div className="md:col-span-10">
                      <div className="text-xs text-muted-foreground mb-1">Name</div>
                      <Input
                        value={editDraft.name}
                        onChange={(e) => {
                          const v = e.currentTarget?.value ?? "";
                          setEditDraft((d) => ({ ...d, name: v }));
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Description</div>
                    <Textarea
                      value={editDraft.description}
                      onChange={(e) => {
                        const v = e.currentTarget?.value ?? "";
                        setEditDraft((d) => ({ ...d, description: v }));
                      }}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button onClick={applyEdit} disabled={!editDraft.name.trim()}>
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(portrait.attributes || []).length === 0 && !adding && (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground bg-background">
          No Portrait attributes yet. Click <span className="font-medium text-foreground">Add attribute</span> to start.
        </div>
      )}
    </div>
  );
}

