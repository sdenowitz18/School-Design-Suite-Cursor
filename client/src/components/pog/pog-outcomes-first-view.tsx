"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, ChevronDown, ChevronRight, X } from "lucide-react";
import type { PortraitOfGraduate, POGPriority, PortraitAttributeLink } from "./pog-types";
import { normKey } from "./pog-utils";
import PogOutcomePill from "./pog-outcome-pill";

type Area = { key: string; label: string };

function genAttrId() {
  return `pog_attr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function PogOutcomesFirstView({
  portrait,
  onChange,
  outcomeSchema,
  onBack,
  selectedKeys: selectedKeysProp,
  onSelectedKeysChange,
  step: stepProp,
  onStepChange,
  onOpenOutcome,
}: {
  portrait: PortraitOfGraduate;
  onChange: (next: PortraitOfGraduate) => void;
  outcomeSchema: Record<string, Record<string, string[]>>;
  onBack: () => void;
  selectedKeys?: string[];
  onSelectedKeysChange?: (next: string[]) => void;
  step?: 1 | 2;
  onStepChange?: (next: 1 | 2) => void;
  onOpenOutcome?: (label: string) => void;
}) {
  const [localStep, setLocalStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState("");
  const [activeArea, setActiveArea] = useState<string>("all");
  const [localSelectedKeys, setLocalSelectedKeys] = useState<string[]>([]);
  const [draggingOutcomeKey, setDraggingOutcomeKey] = useState<string | null>(null);
  const [expandedByAttrId, setExpandedByAttrId] = useState<Record<string, boolean>>({});

  const step = stepProp ?? localStep;
  const setStep = (next: 1 | 2) => {
    onStepChange?.(next);
    if (stepProp === undefined) setLocalStep(next);
  };

  const selectedKeys = selectedKeysProp ?? localSelectedKeys;
  const setSelectedKeys = (next: string[] | ((prev: string[]) => string[])) => {
    const resolved = typeof next === "function" ? (next as (prev: string[]) => string[])(selectedKeys) : next;
    onSelectedKeysChange?.(resolved);
    if (selectedKeysProp === undefined) setLocalSelectedKeys(resolved);
  };

  const L1_AREAS: Area[] = useMemo(
    () => [
      { key: "all", label: "All" },
      { key: "STEM", label: "STEM" },
      { key: "Humanities", label: "Arts & Humanities" },
      { key: "Cross-cutting", label: "Learning & Life" },
      { key: "Well-being", label: "Wellbeing" },
      { key: "Wayfinding", label: "Wayfinding" },
    ],
    [],
  );

  const allOutcomes = useMemo(() => {
    const items: { label: string; area: string; subcat: string; key: string }[] = [];
    const seen = new Set<string>();
    for (const [area, subcats] of Object.entries(outcomeSchema || {})) {
      for (const [subcat, labels] of Object.entries(subcats || {})) {
        for (const label of Array.isArray(labels) ? labels : []) {
          const clean = String(label || "").trim();
          if (!clean) continue;
          const key = normKey(clean);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          items.push({ label: clean, area, subcat, key });
        }
      }
    }
    items.sort((a, b) => a.label.localeCompare(b.label));
    return items;
  }, [outcomeSchema]);

  const outcomeByKey = useMemo(() => {
    const m = new Map<string, { label: string; area: string; subcat: string }>();
    for (const o of allOutcomes) m.set(o.key, { label: o.label, area: o.area, subcat: o.subcat });
    return m;
  }, [allOutcomes]);

  const filteredOutcomes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOutcomes.filter((o) => {
      if (activeArea !== "all" && o.area !== activeArea) return false;
      if (!q) return true;
      return o.label.toLowerCase().includes(q) || o.subcat.toLowerCase().includes(q);
    });
  }, [activeArea, allOutcomes, search]);

  const selectedItems = useMemo(
    () =>
      selectedKeys
        .map((k) => ({ key: k, info: outcomeByKey.get(k) }))
        .filter((x) => !!x.info)
        .map((x) => ({ key: x.key, label: x.info!.label })),
    [outcomeByKey, selectedKeys],
  );

  const linkedByOutcome = useMemo(() => {
    const m = new Map<string, { label: string; attrs: { attributeId: string; attributeName: string; priority: POGPriority }[] }>();
    const attrById = new Map((portrait.attributes || []).map((a) => [a.id, a]));
    for (const [attributeId, links] of Object.entries(portrait.linksByAttributeId || {})) {
      const attr = attrById.get(attributeId);
      const attrName = attr?.name || "Untitled attribute";
      for (const l of Array.isArray(links) ? links : []) {
        const label = String((l as any)?.outcomeLabel || "").trim();
        const key = normKey(label);
        if (!key) continue;
        const priority: POGPriority = (l as any)?.priority === "H" || (l as any)?.priority === "M" || (l as any)?.priority === "L" ? (l as any).priority : "M";
        const cur = m.get(key) || { label, attrs: [] };
        cur.attrs.push({ attributeId, attributeName: attrName, priority });
        m.set(key, cur);
      }
    }
    return m;
  }, [portrait.attributes, portrait.linksByAttributeId]);

  const linkedOutcomeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const links of Object.values(portrait.linksByAttributeId || {})) {
      for (const l of Array.isArray(links) ? links : []) {
        const k = normKey((l as any)?.outcomeLabel);
        if (k) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [portrait.linksByAttributeId]);

  // Always keep linked outcomes selected, regardless of entry path/navigation.
  useEffect(() => {
    if (linkedOutcomeKeys.length === 0) return;
    setSelectedKeys((prev) => {
      const merged = new Set<string>([...(prev || []), ...linkedOutcomeKeys]);
      if (merged.size === (prev || []).length) return prev;
      return Array.from(merged);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedOutcomeKeys.join("|")]);

  const removeOutcomeFromAllAttributes = (outcomeKey: string) => {
    const next: Record<string, PortraitAttributeLink[]> = {};
    for (const [attributeId, links] of Object.entries(portrait.linksByAttributeId || {})) {
      next[attributeId] = (Array.isArray(links) ? links : []).filter(
        (l: any) => normKey((l as any)?.outcomeLabel) !== outcomeKey,
      ) as PortraitAttributeLink[];
    }
    onChange({ ...portrait, linksByAttributeId: next });
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      if (!prev.includes(key)) return [...prev, key];
      const linked = linkedByOutcome.get(key);
      if (linked && linked.attrs.length > 0) {
        const confirmed = window.confirm(
          "This outcome is already linked to one or more attributes. Unchecking it will remove those links. Continue?",
        );
        if (!confirmed) return prev;
        removeOutcomeFromAllAttributes(key);
      }
      return prev.filter((k) => k !== key);
    });
  };

  const assignOutcomeToAttribute = (outcomeKey: string, attributeId: string) => {
    const info = outcomeByKey.get(outcomeKey);
    if (!info) return;
    const existing = portrait.linksByAttributeId?.[attributeId] || [];
    const existingByKey = new Map<string, PortraitAttributeLink>();
    for (const l of Array.isArray(existing) ? existing : []) {
      const k = normKey((l as any)?.outcomeLabel);
      if (!k) continue;
      existingByKey.set(k, l as PortraitAttributeLink);
    }
    if (!existingByKey.has(outcomeKey)) {
      existingByKey.set(outcomeKey, { outcomeLabel: info.label, priority: "M" });
    }
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: Array.from(existingByKey.values()),
      },
    });
  };

  const removeSelectedFromAll = () => {
    if (selectedKeys.length === 0) return;
    const confirmed = window.confirm("Remove selected outcomes from all POG attributes?");
    if (!confirmed) return;
    const selectedSet = new Set(selectedKeys);
    const next: Record<string, PortraitAttributeLink[]> = {};
    for (const [attributeId, links] of Object.entries(portrait.linksByAttributeId || {})) {
      next[attributeId] = (Array.isArray(links) ? links : []).filter((l: any) => !selectedSet.has(normKey(l?.outcomeLabel)));
    }
    onChange({ ...portrait, linksByAttributeId: next });
  };

  const createAttribute = () => {
    const id = genAttrId();
    const baseName = "New attribute";
    const existingNames = new Set((portrait.attributes || []).map((a) => String(a.name || "").trim().toLowerCase()));
    let name = baseName;
    let i = 2;
    while (existingNames.has(name.toLowerCase())) {
      name = `${baseName} ${i++}`;
    }
    onChange({
      ...portrait,
      attributes: [
        ...(portrait.attributes || []),
        { id, name, description: "", icon: "★" },
      ],
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [id]: [],
      },
    });
    setExpandedByAttrId((prev) => ({ ...prev, [id]: true }));
  };

  const updateAttributeMeta = (attributeId: string, patch: Partial<{ icon: string; name: string; description: string }>) => {
    onChange({
      ...portrait,
      attributes: (portrait.attributes || []).map((a) =>
        a.id === attributeId
          ? {
              ...a,
              ...patch,
              icon: patch.icon !== undefined ? ((patch.icon || "").trim() || "★") : a.icon,
            }
          : a,
      ),
    });
  };

  const deleteAttribute = (attributeId: string) => {
    const confirmed = window.confirm("Delete this attribute? This will also remove all linked outcomes from this attribute.");
    if (!confirmed) return;
    const next: PortraitOfGraduate = {
      ...portrait,
      attributes: (portrait.attributes || []).filter((a) => a.id !== attributeId),
      linksByAttributeId: { ...(portrait.linksByAttributeId || {}) },
    };
    delete next.linksByAttributeId[attributeId];
    onChange(next);
    setExpandedByAttrId((prev) => {
      const copy = { ...prev };
      delete copy[attributeId];
      return copy;
    });
  };

  const linksForAttribute = (attributeId: string): PortraitAttributeLink[] => {
    return (portrait.linksByAttributeId?.[attributeId] || []) as PortraitAttributeLink[];
  };

  const setLinkPriority = (attributeId: string, outcomeLabel: string, priority: POGPriority) => {
    const target = normKey(outcomeLabel);
    const nextLinks = linksForAttribute(attributeId).map((l) => {
      if (normKey((l as any)?.outcomeLabel) !== target) return l;
      return { ...l, priority };
    });
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: nextLinks,
      },
    });
  };

  const removeLink = (attributeId: string, outcomeLabel: string) => {
    const target = normKey(outcomeLabel);
    const nextLinks = linksForAttribute(attributeId).filter((l) => normKey((l as any)?.outcomeLabel) !== target);
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: nextLinks,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div />
        <div className="flex items-center gap-2">
          <Badge variant={step === 1 ? "default" : "secondary"}>Step 1: Select outcomes</Badge>
          <Badge variant={step === 2 ? "default" : "secondary"}>Step 2: Build & assign attributes</Badge>
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-background text-sm text-muted-foreground">
        Start by selecting outcomes, then move to a guided assignment screen where selected outcomes appear at the top and can be dragged into attributes.
      </div>

      {step === 1 ? (
      <div className="space-y-4">
        <div className="rounded-lg border p-3 bg-background space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Selected outcomes</div>
            <div className="text-xs text-muted-foreground">{selectedItems.length} selected</div>
          </div>
          {selectedItems.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedItems.map((it) => (
                <PogOutcomePill key={it.key} label={it.label} className="max-w-[320px]" />
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No outcomes selected yet.</div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedKeys([])} disabled={selectedItems.length === 0}>
              Clear
            </Button>
            <Button onClick={() => setStep(2)} disabled={selectedItems.length === 0}>
              Continue to Step 2
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-3 bg-background space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Choose outcomes to include</div>
          </div>
          <div className="relative w-full">
            <Search className="h-4 w-4 text-muted-foreground absolute left-2 top-2.5" />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => {
                const v = e.currentTarget?.value ?? "";
                setSearch(v);
              }}
              placeholder="Search outcomes..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {L1_AREAS.map((a) => (
              <Button key={a.key} variant={activeArea === a.key ? "default" : "outline"} size="sm" onClick={() => setActiveArea(a.key)}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-background max-h-[480px] overflow-auto">
          <div className="divide-y">
            {filteredOutcomes.map((o) => {
              const selected = selectedKeys.includes(o.key);
              const linked = linkedByOutcome.get(o.key);
              return (
                <div
                  key={o.key}
                  className="w-full text-left p-3 hover:bg-muted/40 transition-colors cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSelected(o.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSelected(o.key);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`h-4 w-4 rounded border ${selected ? "bg-slate-900 border-slate-900" : "bg-background border-slate-300"}`} />
                        <div className="font-medium truncate">{o.label}</div>
                      </div>
                      <div className="text-xs text-muted-foreground ml-6 truncate">
                        {o.area} · {o.subcat}
                      </div>
                      {linked && linked.attrs.length > 0 && (
                        <div className="ml-6 mt-1 text-[11px] text-muted-foreground">
                          Already assigned: {linked.attrs.map((a) => `${a.attributeName} (${a.priority})`).join(", ")}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0 py-0 text-xs shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenOutcome?.(o.label);
                      }}
                    >
                      Learn more
                    </Button>
                  </div>
                </div>
              );
            })}
            {filteredOutcomes.length === 0 && <div className="p-6 text-sm text-muted-foreground">No outcomes match your filters.</div>}
          </div>
        </div>
      </div>
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-12 space-y-3">
          <div className="rounded-lg border p-3 bg-background space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Step 2: Drag selected outcomes into attributes below</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                  Back to step 1
                </Button>
                <Button size="sm" onClick={onBack} className="bg-blue-600 text-white hover:bg-blue-700">
                  Done
                </Button>
              </div>
            </div>
            {selectedItems.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedItems.map((it) => (
                  <div
                    key={it.key}
                    draggable
                    onDragStart={() => setDraggingOutcomeKey(it.key)}
                    onDragEnd={() => setDraggingOutcomeKey(null)}
                  >
                    <PogOutcomePill label={it.label} className="max-w-[320px] cursor-grab" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No selected outcomes. Go back to step 1.</div>
            )}
          </div>
        </div>

        <div className="xl:col-span-12 space-y-3">
          <div className="rounded-lg border p-3 bg-background space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Build attributes and drop selected outcomes</div>
              <Button
                size="sm"
                variant="outline"
                onClick={createAttribute}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create attribute
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(portrait.attributes || []).map((a) => (
                <Collapsible
                  key={a.id}
                  open={expandedByAttrId[a.id] ?? false}
                  onOpenChange={(open) => setExpandedByAttrId((prev) => ({ ...prev, [a.id]: open }))}
                >
                  <div
                    className={`rounded-md border p-3 space-y-3 ${draggingOutcomeKey ? "ring-1 ring-slate-300" : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingOutcomeKey) assignOutcomeToAttribute(draggingOutcomeKey, a.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-6 w-6 rounded border flex items-center justify-center text-sm shrink-0">
                            {a.icon || "★"}
                          </div>
                          <div className="font-medium truncate">{a.name || "Untitled attribute"}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {linksForAttribute(a.id).length} linked outcomes
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => deleteAttribute(a.id)}>
                          Delete
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {(expandedByAttrId[a.id] ?? true) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <CollapsibleContent className="space-y-3">
                      <div className="grid grid-cols-12 gap-2">
                        <Input
                          className="col-span-2"
                          value={a.icon || "★"}
                          onChange={(e) => {
                            const v = e.currentTarget?.value ?? "";
                            updateAttributeMeta(a.id, { icon: v });
                          }}
                          placeholder="★"
                        />
                        <Input
                          className="col-span-10"
                          value={a.name || ""}
                          onChange={(e) => {
                            const v = e.currentTarget?.value ?? "";
                            updateAttributeMeta(a.id, { name: v });
                          }}
                          placeholder="Attribute name"
                        />
                      </div>
                      <Textarea
                        value={a.description || ""}
                        onChange={(e) => {
                          const v = e.currentTarget?.value ?? "";
                          updateAttributeMeta(a.id, { description: v });
                        }}
                        placeholder="Description"
                        rows={2}
                      />
                      <div className="space-y-2">
                        {linksForAttribute(a.id).map((l) => {
                          const label = String((l as any)?.outcomeLabel || "");
                          const p = ((l as any)?.priority === "H" || (l as any)?.priority === "M" || (l as any)?.priority === "L")
                            ? (l as any).priority
                            : "M";
                          return (
                            <div key={`${a.id}:${normKey(label)}:edit`} className="flex items-center justify-between gap-2 rounded-md border p-2">
                              <PogOutcomePill label={label} meta={p} className="max-w-[240px]" />
                              <div className="flex items-center gap-1">
                                {(["H", "M", "L"] as POGPriority[]).map((level) => (
                                  <Button
                                    key={level}
                                    variant="outline"
                                    size="sm"
                                    className={`h-7 px-2 text-xs ${p === level ? "bg-slate-900 text-white hover:bg-slate-900" : ""}`}
                                    onClick={() => setLinkPriority(a.id, label, level)}
                                  >
                                    {level}
                                  </Button>
                                ))}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLink(a.id, label)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                    {!(expandedByAttrId[a.id] ?? false) && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">{a.description || "No description yet."}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {linksForAttribute(a.id).length > 0 ? (
                            linksForAttribute(a.id).map((l) => (
                              <PogOutcomePill
                                key={`${a.id}:${normKey((l as any)?.outcomeLabel)}`}
                                label={String((l as any)?.outcomeLabel || "")}
                                meta={(l as any)?.priority || "M"}
                                className="max-w-[280px]"
                              />
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground">No linked outcomes yet. Drag outcomes here.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Collapsible>
              ))}
              {(portrait.attributes || []).length === 0 && (
                <div className="text-sm text-muted-foreground">No attributes yet. Create one below.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

