"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PortraitOfGraduate, POGPriority, PortraitAttributeLink } from "./pog-types";
import { normKey } from "./pog-utils";
import PogOutcomePill from "./pog-outcome-pill";

type Area = { key: string; label: string };

function priorityButtonClass(active: boolean) {
  return cn(
    "h-7 px-2 text-xs",
    active ? "bg-slate-900 text-white hover:bg-slate-900" : "bg-background hover:bg-slate-50",
  );
}

export default function PogAttributeDetailView({
  portrait,
  attributeId,
  onChange,
  onBack,
  outcomeSchema,
}: {
  portrait: PortraitOfGraduate;
  attributeId: string;
  onChange: (next: PortraitOfGraduate) => void;
  onBack: () => void;
  outcomeSchema: Record<string, Record<string, string[]>>;
}) {
  const attr = (portrait.attributes || []).find((a) => a.id === attributeId) || null;
  const [search, setSearch] = useState("");
  const [activeArea, setActiveArea] = useState<string>("all");
  const [view, setView] = useState<"overview" | "editOutcomes">("overview");
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<{ icon: string; name: string; description: string }>(() => ({
    icon: attr?.icon || "★",
    name: attr?.name || "",
    description: attr?.description || "",
  }));

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

  const outcomeAreaByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const [area, subcats] of Object.entries(outcomeSchema || {})) {
      for (const items of Object.values(subcats || {})) {
        for (const label of Array.isArray(items) ? items : []) {
          const k = normKey(label);
          if (!k) continue;
          if (!m.has(k)) m.set(k, area);
        }
      }
    }
    return m;
  }, [outcomeSchema]);

  const allOutcomes = useMemo(() => {
    const items: { label: string; area: string; subcat: string }[] = [];
    for (const [area, subcats] of Object.entries(outcomeSchema || {})) {
      for (const [subcat, labels] of Object.entries(subcats || {})) {
        for (const label of Array.isArray(labels) ? labels : []) {
          const clean = String(label || "").trim();
          if (!clean) continue;
          items.push({ label: clean, area, subcat });
        }
      }
    }
    // stable sort
    items.sort((a, b) => a.label.localeCompare(b.label));
    return items;
  }, [outcomeSchema]);

  const links: PortraitAttributeLink[] = (portrait.linksByAttributeId?.[attributeId] || []) as any;
  const linkByKey = useMemo(() => {
    const m = new Map<string, PortraitAttributeLink>();
    for (const l of Array.isArray(links) ? links : []) {
      const k = normKey(l?.outcomeLabel);
      if (!k) continue;
      if (!m.has(k)) m.set(k, l);
    }
    return m;
  }, [links]);

  const filteredOutcomes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOutcomes.filter((o) => {
      if (activeArea !== "all" && o.area !== activeArea) return false;
      if (!q) return true;
      return o.label.toLowerCase().includes(q) || o.subcat.toLowerCase().includes(q);
    });
  }, [activeArea, allOutcomes, search]);

  const updateAttr = (patch: Partial<{ icon: string; name: string; description: string }>) => {
    if (!attr) return;
    const next = {
      ...portrait,
      attributes: (portrait.attributes || []).map((a) => (a.id === attributeId ? { ...a, ...patch } : a)),
    };
    onChange(next);
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

  const setLinked = (nextLinks: PortraitAttributeLink[]) => {
    onChange({
      ...portrait,
      linksByAttributeId: {
        ...(portrait.linksByAttributeId || {}),
        [attributeId]: nextLinks,
      },
    });
  };

  const toggleOutcome = (label: string) => {
    const k = normKey(label);
    const exists = linkByKey.has(k);
    if (exists) {
      setLinked((links || []).filter((l) => normKey(l.outcomeLabel) !== k));
      return;
    }
    setLinked([...(links || []), { outcomeLabel: label, priority: "M" }]);
  };

  const setPriority = (label: string, p: POGPriority) => {
    const k = normKey(label);
    setLinked(
      (links || []).map((l) => (normKey(l.outcomeLabel) === k ? { ...l, priority: p } : l)),
    );
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

  const linkedSorted = [...(links || [])].sort((a, b) => String(a.outcomeLabel).localeCompare(String(b.outcomeLabel)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-xs text-muted-foreground">
          Linked outcomes will be added to Whole School outcomes automatically (priority is not carried over).
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
            <Badge variant="secondary">{(links || []).length === 1 ? "1 linked outcome" : `${(links || []).length} linked outcomes`}</Badge>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Linked outcomes</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView((v) => (v === "overview" ? "editOutcomes" : "overview"))}
          >
            {view === "overview" ? "Edit outcomes" : "Done editing"}
          </Button>
        </div>

        {linkedSorted.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {linkedSorted.map((l) => (
              <PogOutcomePill key={l.outcomeLabel} label={l.outcomeLabel} meta={l.priority} className="max-w-[320px]" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border p-4 text-sm text-muted-foreground bg-background">
            No outcomes linked yet. Click <span className="font-medium text-foreground">Edit outcomes</span> to start linking.
          </div>
        )}
      </div>

      {view === "editOutcomes" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Edit linked outcomes</div>
            <div className="relative w-full max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground absolute left-2 top-2.5" />
              <Input
                className="pl-8"
                value={search}
                onChange={(e) => {
                  const v = e.currentTarget?.value ?? "";
                  setSearch(v);
                }}
                placeholder="Search outcomes…"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {L1_AREAS.map((a) => (
              <Button
                key={a.key}
                variant={activeArea === a.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveArea(a.key)}
              >
                {a.label}
              </Button>
            ))}
          </div>

          <div className="rounded-lg border bg-background">
            <div className="divide-y">
              {filteredOutcomes.map((o) => {
                const k = normKey(o.label);
                const link = linkByKey.get(k) || null;
                const checked = !!link;
                const area = outcomeAreaByKey.get(k) || o.area;
                return (
                  <div key={`${o.area}:${o.subcat}:${o.label}`} className="p-3 flex items-start justify-between gap-3">
                    <button className="text-left flex-1 min-w-0" onClick={() => toggleOutcome(o.label)}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            "h-4 w-4 rounded border shrink-0",
                            checked ? "bg-slate-900 border-slate-900" : "bg-background border-slate-300",
                          )}
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{o.label}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {area} · {o.subcat}
                          </div>
                        </div>
                      </div>
                    </button>

                    {checked ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className={priorityButtonClass((link?.priority || "M") === "H")}
                          onClick={() => setPriority(o.label, "H")}
                        >
                          H
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={priorityButtonClass((link?.priority || "M") === "M")}
                          onClick={() => setPriority(o.label, "M")}
                        >
                          M
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={priorityButtonClass((link?.priority || "M") === "L")}
                          onClick={() => setPriority(o.label, "L")}
                        >
                          L
                        </Button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground self-center">Not linked</div>
                    )}
                  </div>
                );
              })}

              {filteredOutcomes.length === 0 && <div className="p-6 text-sm text-muted-foreground">No outcomes match your filters.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

