"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import OctagonCard from "./octagon-card";
import {
  RingDataPreviewWindow,
  DATA_WINDOWS,
  type DataWindowKey,
  type Priority,
  aggregateLeaps,
  aggregateOutcomes,
  getSubcomponents,
  getSnapshotData,
  getKeyDriversData,
  KeyDriversDiagram,
  scoreBgCls,
  isLeapAimActive,
  isTargetingAimActive,
  getPracticesKeyItems,
  getToolsKeyItems,
  extractAllItemsFromBucket,
  buildExpertSources,
  buildAimSources,
  buildSnapshotSources,
} from "./ring-data-preview-window";
import { ALL_ELEMENTS } from "@/components/expert-view/expert-view-schema";
import type { DESubView } from "./designed-experience-card-content";
import type { RingSourceScope } from "./ring-data-preview-window";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Deep-link payload for the lower “scoped edit” control in Mode B (vs header = component overview). */
export interface RingScopedEditPayload {
  tab: "snapshot" | "designed-experience" | "status-and-health";
  deNav: DESubView | null;
  openSubId: string | null;
  initialSubId: string | null;
}

type ScopedEditBinder = (getter: () => RingScopedEditPayload) => void;

function payloadStatusHealth(): RingScopedEditPayload {
  return { tab: "status-and-health", deNav: null, openSubId: null, initialSubId: null };
}

function payloadDesignedExperienceRoot(): RingScopedEditPayload {
  return { tab: "designed-experience", deNav: null, openSubId: null, initialSubId: null };
}

function payloadLeaps(scope: RingSourceScope): RingScopedEditPayload {
  if (scope.kind === "adultSub") {
    return {
      tab: "designed-experience",
      deNav: { view: "adultSubManage", subId: scope.id },
      openSubId: null,
      initialSubId: null,
    };
  }
  const sid = scope.kind === "learnerSub" ? scope.id : null;
  return { tab: "designed-experience", deNav: { view: "leaps" }, openSubId: sid, initialSubId: sid };
}

function payloadOutcomes(scope: RingSourceScope): RingScopedEditPayload {
  if (scope.kind === "adultSub") {
    return {
      tab: "designed-experience",
      deNav: { view: "adultSubManage", subId: scope.id },
      openSubId: null,
      initialSubId: null,
    };
  }
  const sid = scope.kind === "learnerSub" ? scope.id : null;
  return { tab: "designed-experience", deNav: { view: "outcomes" }, openSubId: sid, initialSubId: sid };
}

function payloadSnapshot(scope: RingSourceScope): RingScopedEditPayload {
  if (scope.kind === "adultSub") {
    return {
      tab: "designed-experience",
      deNav: { view: "adultSubManage", subId: scope.id },
      openSubId: null,
      initialSubId: null,
    };
  }
  const sid = scope.kind === "learnerSub" ? scope.id : null;
  return { tab: "snapshot", deNav: null, openSubId: sid, initialSubId: sid };
}

function payloadPracticesTools(scope: RingSourceScope, elementId: string): RingScopedEditPayload {
  if (scope.kind === "adultSub") {
    return {
      tab: "designed-experience",
      deNav: { view: "adultSubManage", subId: scope.id },
      openSubId: null,
      initialSubId: null,
    };
  }
  const sid = scope.kind === "learnerSub" ? scope.id : null;
  return {
    tab: "designed-experience",
    deNav: { view: "designElement", elementId },
    openSubId: sid,
    initialSubId: sid,
  };
}

export interface RingNode {
  nodeId: string;
  rawComp: any;
  bgClassName: string;
}

export interface RingFullViewProps {
  comp: any;
  bgClassName: string;
  mode: "component" | "dataWindow";
  selectedDataWindow: DataWindowKey;
  onDataWindowChange: (w: DataWindowKey) => void;
  ringNodes: RingNode[];
  onNavigate: (node: RingNode) => void;
  onClose: () => void;
  /** Opens working panel on Journey & Overview (main component), regardless of current data window. */
  onOpenEdit: () => void;
  /** Opens working panel scoped to the current enlarged data (tabs, element, subcomponent). */
  onOpenScopedEdit: (payload: RingScopedEditPayload) => void;
  /** Called when a data window tile is expanded — switches right panel to Mode B. */
  onSwitchToDataWindow: (w: DataWindowKey) => void;
  /** Called from Mode B to contract back to Mode A (full octagon view). */
  onSwitchToComponent?: () => void;
}

// ─── Extended data helpers ────────────────────────────────────────────────────

function leapNotes(comp: any, leapLabel: string): string {
  const aims: any[] = comp?.designedExperienceData?.keyDesignElements?.aims || [];
  return (aims.find((a) => a.type === "leap" && a.label === leapLabel)?.notes || "").trim();
}

function subsWithLeap(comp: any, leapLabel: string): string[] {
  const de = comp?.designedExperienceData || {};
  return [...(de.subcomponents || []), ...(de.adultSubcomponents || [])]
    .filter((sub) => {
      const subAims: any[] = sub.keyDesignElements?.aims || sub.aims || [];
      return subAims.some((a) => a.type === "leap" && a.label === leapLabel && isLeapAimActive(a));
    })
    .map((sub) => sub.name || "")
    .filter(Boolean);
}

function outcomeNotes(comp: any, outcomeLabel: string): string {
  const aims: any[] = comp?.designedExperienceData?.keyDesignElements?.aims || [];
  for (const a of aims) {
    if (a.type !== "outcome") continue;
    const subs: string[] = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
    if (subs.includes(outcomeLabel) || a.label === outcomeLabel) return (a.notes || "").trim();
  }
  return "";
}

function subsWithOutcome(comp: any, outcomeLabel: string): string[] {
  const de = comp?.designedExperienceData || {};
  return [...(de.subcomponents || []), ...(de.adultSubcomponents || [])]
    .filter((sub) => {
      const subAims: any[] = sub.keyDesignElements?.aims || sub.aims || [];
      return subAims.some((a) => {
        if (a.type !== "outcome" || !isTargetingAimActive(a)) return false;
        const subs2: string[] = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
        return subs2.includes(outcomeLabel) || a.label === outcomeLabel;
      });
    })
    .map((sub) => sub.name || "")
    .filter(Boolean);
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

const PRIORITY_CLS: Record<Priority, string> = {
  H: "bg-red-50 text-red-700 border-red-200",
  M: "bg-amber-50 text-amber-700 border-amber-200",
  L: "bg-green-50 text-green-700 border-green-200",
};

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn("inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", PRIORITY_CLS[priority])}>
      {priority}
    </span>
  );
}

function SubPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center text-[10px] bg-gray-100 text-gray-700 border border-gray-200 rounded-full px-2 py-0.5 font-medium">
      {name}
    </span>
  );
}

function SectionDivider() {
  return <div className="h-px bg-gray-100 my-3" />;
}

// ─── Enlarged window content (for Mode B) ─────────────────────────────────────

function EnlargedKeyDrivers({ comp, bindScopedEdit }: { comp: any; bindScopedEdit?: ScopedEditBinder }) {
  useEffect(() => {
    bindScopedEdit?.(() => payloadStatusHealth());
  }, [comp, bindScopedEdit]);

  const data = getKeyDriversData(comp);
  return (
    <div style={{ width: "100%", height: 280 }}>
      <KeyDriversDiagram data={data} />
    </div>
  );
}

// ─── Shared source-tab strip ──────────────────────────────────────────────────

function SourceTabStrip({
  sources,
  selectedIdx,
  onSelect,
}: {
  sources: Array<{ name: string; isAdult: boolean }>;
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  if (sources.length <= 1) return null;
  return (
    <div className="shrink-0 flex overflow-x-auto border-b border-gray-200 bg-white">
      {sources.map((src, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={cn(
            "shrink-0 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
            selectedIdx === i
              ? "border-blue-500 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700",
          )}
        >
          {src.name}
          {src.isAdult && <span className="ml-1 text-[9px] text-purple-600">(A)</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Enlarged: Leaps ─────────────────────────────────────────────────────────

function EnlargedLeaps({ comp, bindScopedEdit }: { comp: any; bindScopedEdit?: ScopedEditBinder }) {
  const [srcIdx, setSrcIdx] = React.useState(0);
  const sources = useMemo(() => buildAimSources(comp), [comp]);
  const src = sources[Math.min(srcIdx, sources.length - 1)];

  useEffect(() => {
    bindScopedEdit?.(() => {
      const scope = sources[Math.min(srcIdx, Math.max(0, sources.length - 1))]?.scope ?? { kind: "component" as const };
      return payloadLeaps(scope);
    });
  }, [bindScopedEdit, srcIdx, sources]);
  const leaps = (src.aims ?? []).filter((a: any) => a?.type === "leap" && isLeapAimActive(a));

  return (
    <div className="flex flex-col h-full">
      <SourceTabStrip sources={sources} selectedIdx={srcIdx} onSelect={setSrcIdx} />
      <div className="flex-1 overflow-y-auto p-5">
        {!leaps.length ? (
          <p className="text-sm text-gray-400 italic">No leaps defined for this source.</p>
        ) : (
          <div className="space-y-1">
            {leaps.map((leap: any, i: number) => {
              const priority: Priority =
                leap.overrideLevel ?? leap.computedLevel ?? (leap.level === "High" ? "H" : leap.level === "Low" ? "L" : "M");
              const notes = (leap.notes || "").trim();
              return (
                <div key={leap.label ?? i}>
                  {i > 0 && <SectionDivider />}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-gray-900">{leap.label}</h3>
                    <PriorityBadge priority={priority} />
                  </div>
                  {notes
                    ? <p className="mt-1.5 text-sm text-gray-700 leading-relaxed">{notes}</p>
                    : <p className="mt-1.5 text-sm text-gray-400 italic">No notes captured yet.</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Enlarged: Outcomes ───────────────────────────────────────────────────────

function EnlargedOutcomes({ comp, bindScopedEdit }: { comp: any; bindScopedEdit?: ScopedEditBinder }) {
  const [srcIdx, setSrcIdx] = React.useState(0);
  const sources = useMemo(() => buildAimSources(comp), [comp]);
  const src = sources[Math.min(srcIdx, sources.length - 1)];

  useEffect(() => {
    bindScopedEdit?.(() => {
      const scope = sources[Math.min(srcIdx, Math.max(0, sources.length - 1))]?.scope ?? { kind: "component" as const };
      return payloadOutcomes(scope);
    });
  }, [bindScopedEdit, srcIdx, sources]);
  const outcomes = (src.aims ?? []).filter((a: any) => a?.type === "outcome" && isTargetingAimActive(a));

  return (
    <div className="flex flex-col h-full">
      <SourceTabStrip sources={sources} selectedIdx={srcIdx} onSelect={setSrcIdx} />
      <div className="flex-1 overflow-y-auto p-5">
        {!outcomes.length ? (
          <p className="text-sm text-gray-400 italic">No targeted outcomes for this source.</p>
        ) : (
          <div className="space-y-1">
            {outcomes.map((o: any, i: number) => {
              const priority: Priority =
                o.overrideLevel ?? o.computedLevel ?? (o.level === "High" ? "H" : o.level === "Low" ? "L" : "M");
              const notes = (o.notes || "").trim();
              const subs: string[] = Array.isArray(o.subSelections) ? o.subSelections.filter(Boolean) : [];
              const labels = subs.length ? subs : [o.label];
              return labels.map((label: string, li: number) => (
                <div key={`${i}-${li}`}>
                  {(i > 0 || li > 0) && <SectionDivider />}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-gray-900">
                      {label}
                      {o.isPrimary && <span className="ml-1.5 text-blue-600">★</span>}
                    </h3>
                    <PriorityBadge priority={priority} />
                  </div>
                  {notes
                    ? <p className="mt-1.5 text-sm text-gray-700 leading-relaxed">{notes}</p>
                    : <p className="mt-1.5 text-sm text-gray-400 italic">No notes captured yet.</p>}
                </div>
              ));
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Enlarged: Subcomponents ─────────────────────────────────────────────────

function EnlargedSubcomponents({ comp, bindScopedEdit }: { comp: any; bindScopedEdit?: ScopedEditBinder }) {
  useEffect(() => {
    bindScopedEdit?.(() => payloadDesignedExperienceRoot());
  }, [comp, bindScopedEdit]);

  const subs = getSubcomponents(comp);
  if (!subs.length) return <p className="text-sm text-gray-400 italic">No subcomponents defined.</p>;
  return (
    <div className="space-y-4 p-5">
      {subs.map((sub, i) => (
        <div key={i}>
          {i > 0 && <SectionDivider />}
          <div className="flex items-center gap-2">
            {sub.isAdult && (
              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5 font-semibold">Adult</span>
            )}
            <h3 className="font-semibold text-gray-900">{sub.name}</h3>
          </div>
          {sub.description
            ? <p className="mt-1 text-sm text-gray-600 leading-relaxed">{sub.description}</p>
            : <p className="mt-1 text-sm text-gray-400 italic">No description captured.</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Enlarged: Snapshot ───────────────────────────────────────────────────────

function EnlargedSnapshot({ comp, bindScopedEdit }: { comp: any; bindScopedEdit?: ScopedEditBinder }) {
  const [srcIdx, setSrcIdx] = React.useState(0);
  const sources = useMemo(() => buildSnapshotSources(comp), [comp]);
  const src = sources[Math.min(srcIdx, sources.length - 1)];

  useEffect(() => {
    bindScopedEdit?.(() => {
      const scope = sources[Math.min(srcIdx, Math.max(0, sources.length - 1))]?.scope ?? { kind: "component" as const };
      return payloadSnapshot(scope);
    });
  }, [bindScopedEdit, srcIdx, sources]);
  const data = getSnapshotData(src.comp, comp);
  const rows = [
    { label: "Primary Outcomes", value: data.primaryOutcomes },
    { label: "Educators", value: data.teachers },
    { label: "Grade Band", value: data.gradeBand },
    { label: "Classrooms & students", value: data.enrollment },
    { label: "Duration & Frequency", value: data.duration },
  ].filter((r) => r.value);

  return (
    <div className="flex flex-col h-full">
      <SourceTabStrip sources={sources} selectedIdx={srcIdx} onSelect={setSrcIdx} />
      <div className="flex-1 overflow-y-auto p-5">
        {!rows.length ? (
          <p className="text-sm text-gray-400 italic">No snapshot data captured yet.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.label}>
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{row.label}</div>
                <div className="text-sm text-gray-900">{row.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Enlarged: Practices & Approaches / Tools & Resources ────────────────────

function EnlargedExpertView({ comp, section, bindScopedEdit }: { comp: any; section: "practices" | "tools"; bindScopedEdit?: ScopedEditBinder }) {
  const [srcIdx, setSrcIdx] = React.useState(0);
  const [elemIdx, setElemIdx] = React.useState(0);

  const sources = useMemo(() => buildExpertSources(comp), [comp]);
  const src = sources[Math.min(srcIdx, sources.length - 1)];
  const element = ALL_ELEMENTS[Math.min(elemIdx, ALL_ELEMENTS.length - 1)];

  useEffect(() => {
    bindScopedEdit?.(() => {
      const scope = sources[Math.min(srcIdx, Math.max(0, sources.length - 1))]?.scope ?? { kind: "component" as const };
      const el = ALL_ELEMENTS[Math.min(elemIdx, ALL_ELEMENTS.length - 1)];
      return payloadPracticesTools(scope, el.id);
    });
  }, [bindScopedEdit, srcIdx, elemIdx, sources, section]);
  // Keep the question.id so we can build the composite storage key: questionId__bucketId
  const buckets = element.questions
    .filter((q) => q.section === section)
    .flatMap((q) => q.buckets.map((b) => ({ bucket: b, bk: `${q.id}__${b.id}` })));

  return (
    <div className="flex flex-col h-full">
      {/* Row 1: component / subcomponent tabs */}
      <SourceTabStrip sources={sources} selectedIdx={srcIdx} onSelect={(i) => { setSrcIdx(i); }} />

      {/* Row 2: element category tabs */}
      <div className="shrink-0 flex overflow-x-auto border-b border-gray-100 bg-gray-50">
        {ALL_ELEMENTS.map((el, i) => (
          <button
            key={el.id}
            type="button"
            onClick={() => setElemIdx(i)}
            className={cn(
              "shrink-0 px-3 py-1.5 text-[10px] font-medium border-b-2 whitespace-nowrap transition-colors",
              elemIdx === i
                ? "border-purple-500 text-purple-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {el.shortTitle}
          </button>
        ))}
      </div>

      {/* Content: buckets as headers, items below (empty state per bucket if no data) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {buckets.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No {section} questions in this category.</p>
        ) : (
          buckets.map(({ bucket, bk }) => {
            const bv = (src.expertData as any)?.[element.id]?.[bk];
            const items = bv ? extractAllItemsFromBucket(bucket, bv) : [];
            return (
              <div key={bk}>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  {bucket.title}
                </h4>
                {items.length > 0 ? (
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-800 leading-snug">
                        <span className="shrink-0 text-gray-400 mt-px">•</span>
                        <span className="min-w-0">{item.label}</span>
                        {item.isKey && (
                          <span className="shrink-0 text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 rounded px-1 py-px ml-1">KEY</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 italic pl-3">No data entered</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function EnlargedComingSoon({ label, bindScopedEdit }: { label: string; bindScopedEdit?: ScopedEditBinder }) {
  useEffect(() => {
    bindScopedEdit?.(() => payloadDesignedExperienceRoot());
  }, [bindScopedEdit]);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <div className="text-2xl">🔜</div>
      <p className="text-sm font-semibold text-gray-600">{label}</p>
      <p className="text-xs text-gray-400">Content for this section is coming soon.</p>
    </div>
  );
}

function EnlargedWindowContent({
  comp,
  windowKey,
  bindScopedEdit,
}: {
  comp: any;
  windowKey: DataWindowKey;
  bindScopedEdit?: ScopedEditBinder;
}) {
  switch (windowKey) {
    case "keyDrivers":     return <EnlargedKeyDrivers comp={comp} bindScopedEdit={bindScopedEdit} />;
    case "leaps":          return <EnlargedLeaps comp={comp} bindScopedEdit={bindScopedEdit} />;
    case "outcomes":       return <EnlargedOutcomes comp={comp} bindScopedEdit={bindScopedEdit} />;
    case "subcomponents":  return <EnlargedSubcomponents comp={comp} bindScopedEdit={bindScopedEdit} />;
    case "snapshot":       return <EnlargedSnapshot comp={comp} bindScopedEdit={bindScopedEdit} />;
    case "practices":      return <EnlargedExpertView comp={comp} section="practices" bindScopedEdit={bindScopedEdit} />;
    case "tools":          return <EnlargedExpertView comp={comp} section="tools" bindScopedEdit={bindScopedEdit} />;
    case "embedded":       return <EnlargedComingSoon label="Embedded Locations" bindScopedEdit={bindScopedEdit} />;
  }
}

// ─── Card-sized content for Mode-A grid ───────────────────────────────────────

function CardKeyDrivers({ comp }: { comp: any }) {
  const data = getKeyDriversData(comp);
  return (
    <div className="w-full h-full" style={{ minHeight: 50 }}>
      <KeyDriversDiagram data={data} />
    </div>
  );
}

function CardLeaps({ comp }: { comp: any }) {
  const leaps = aggregateLeaps(comp);
  if (!leaps.length) return <p className="text-[9px] text-gray-400 italic">No leaps defined</p>;
  return (
    <ul className="space-y-px">
      {leaps.map((l) => (
        <li key={l.label} className="flex items-start gap-1 text-[9px] text-gray-800 leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          <span className="min-w-0">
            {l.label}{" "}
            <span className="text-gray-500 font-medium">({l.priority})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CardOutcomes({ comp }: { comp: any }) {
  const outcomes = aggregateOutcomes(comp);
  if (!outcomes.length) return <p className="text-[9px] text-gray-400 italic">No outcomes defined</p>;
  return (
    <ul className="space-y-px">
      {outcomes.map((o) => (
        <li key={o.label} className="flex items-start gap-1 text-[9px] text-gray-800 leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          <span className="min-w-0">
            {o.isPrimary && <span className="text-blue-600 mr-0.5">★</span>}
            {o.label}{" "}
            <span className="text-gray-500 font-medium">({o.priority})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CardSubcomponents({ comp }: { comp: any }) {
  const subs = getSubcomponents(comp);
  if (!subs.length) return <p className="text-[9px] text-gray-400 italic">No subcomponents</p>;
  return (
    <ul className="space-y-px">
      {subs.map((s, i) => (
        <li key={i} className="flex items-start gap-1 text-[9px] text-gray-800 leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          <span className="min-w-0">
            {s.isAdult && <span className="text-purple-600 font-semibold mr-0.5">(A)</span>}
            {s.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CardSnapshot({ comp }: { comp: any }) {
  const data = getSnapshotData(comp);
  const rows = [
    data.primaryOutcomes,
    data.teachers,
    data.gradeBand,
    data.enrollment,
    data.duration,
  ].filter(Boolean);
  if (!rows.length) return <p className="text-[9px] text-gray-400 italic">No snapshot data</p>;
  return (
    <ul className="space-y-px">
      {rows.map((r, i) => (
        <li key={i} className="flex items-start gap-1 text-[9px] text-gray-800 leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          <span className="min-w-0">{r}</span>
        </li>
      ))}
    </ul>
  );
}

function CardPractices({ comp }: { comp: any }) {
  const items = getPracticesKeyItems(comp);
  if (!items.length) return <p className="text-[9px] text-gray-400 italic">No key practices marked</p>;
  return (
    <ul className="space-y-px">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1 text-[9px] text-gray-800 leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CardTools({ comp }: { comp: any }) {
  const items = getToolsKeyItems(comp);
  if (!items.length) return <p className="text-[9px] text-gray-400 italic">No key tools marked</p>;
  return (
    <ul className="space-y-px">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1 text-[9px] text-gray-800 leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CardComingSoon() {
  return <p className="text-[9px] text-gray-400 italic">Coming soon</p>;
}

function DataWindowCardContent({ windowKey, comp }: { windowKey: DataWindowKey; comp: any }) {
  switch (windowKey) {
    case "keyDrivers":    return <CardKeyDrivers comp={comp} />;
    case "leaps":         return <CardLeaps comp={comp} />;
    case "outcomes":      return <CardOutcomes comp={comp} />;
    case "subcomponents": return <CardSubcomponents comp={comp} />;
    case "snapshot":      return <CardSnapshot comp={comp} />;
    case "practices":     return <CardPractices comp={comp} />;
    case "tools":         return <CardTools comp={comp} />;
    default:              return <CardComingSoon />;
  }
}

// ─── Individual data window card in the Mode-A grid ───────────────────────────

function DataWindowCard({
  windowKey,
  label,
  comp,
  onExpand,
}: {
  windowKey: DataWindowKey;
  label: string;
  comp: any;
  onExpand: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden hover:border-blue-300 hover:shadow-md transition-all group">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <button
          type="button"
          onClick={onExpand}
          className="text-[11px] font-bold text-gray-700 uppercase tracking-wide group-hover:text-blue-700 transition-colors text-left hover:underline"
          title={`Open full view of ${label}`}
        >
          {label}
        </button>
        <button
          type="button"
          onClick={onExpand}
          className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          title={`Expand ${label}`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Card body */}
      <div className="flex-1 overflow-y-auto p-3 min-h-[110px]">
        <DataWindowCardContent windowKey={windowKey} comp={comp} />
      </div>
    </div>
  );
}

// ─── Navigation arrows ─────────────────────────────────────────────────────────

function NavArrow({
  direction,
  ringNodes,
  currentIndex,
  onNavigate,
}: {
  direction: "prev" | "next";
  ringNodes: RingNode[];
  currentIndex: number;
  onNavigate: (node: RingNode) => void;
}) {
  const disabled = ringNodes.length <= 1;
  const targetIndex =
    direction === "prev"
      ? currentIndex > 0 ? currentIndex - 1 : ringNodes.length - 1
      : currentIndex < ringNodes.length - 1 ? currentIndex + 1 : 0;
  const targetNode = ringNodes[targetIndex];
  const targetName = targetNode?.rawComp?.snapshotData?.name || targetNode?.rawComp?.title || "";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && targetNode && onNavigate(targetNode)}
      className={cn(
        "flex items-center gap-1 shrink-0 transition-colors px-1 py-1 rounded hover:bg-gray-100",
        disabled ? "text-gray-200 cursor-not-allowed" : "text-gray-500 hover:text-gray-900",
      )}
      title={targetName || undefined}
    >
      {direction === "prev" && <ChevronLeft className="w-4 h-4" />}
      <span className="text-[10px] max-w-[60px] line-clamp-1 hidden sm:block">{targetName}</span>
      {direction === "next" && <ChevronRight className="w-4 h-4" />}
    </button>
  );
}

// ─── Window tile inside the large Mode-A octagon ─────────────────────────────

function OctagonWindowTile({
  windowKey,
  label,
  comp,
  onExpand,
  className,
}: {
  windowKey: DataWindowKey;
  label: string;
  comp: any;
  onExpand: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[2px] h-full min-h-0", className)}>
      {/* Label above the card — clicking expands to Mode B */}
      <button
        type="button"
        onClick={onExpand}
        className="shrink-0 text-[9px] font-semibold text-gray-600 text-left hover:text-blue-700 transition-colors truncate leading-tight"
        title={`Expand ${label}`}
      >
        {label}
      </button>
      {/* Card body — scrollable, fills its row */}
      <div
        className="flex-1 min-h-0 bg-white/85 rounded border border-gray-300/50 overflow-y-auto cursor-pointer hover:border-blue-400/60 hover:bg-white transition-colors"
        onClick={onExpand}
        style={{ padding: "4px 5px" }}
      >
        <DataWindowCardContent windowKey={windowKey} comp={comp} />
      </div>
    </div>
  );
}

// ─── Score block shown in the octagon header corners ─────────────────────────

function OctagonScoreBlock({
  label,
  scoreRaw,
  scoreStr,
  align,
}: {
  label: string;
  scoreRaw: number | null;
  scoreStr: string;
  align: "left" | "right";
}) {
  return (
    <div className="flex flex-col shrink-0 w-[64px] items-center">
      <span className="text-[8px] font-semibold text-gray-500 leading-tight text-center w-full">
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 text-base font-bold w-10 h-10 flex items-center justify-center rounded-xl border-2 shrink-0",
          scoreBgCls(scoreRaw),
        )}
      >
        {scoreStr}
      </span>
    </div>
  );
}

// ─── Mode A: Component Full View ──────────────────────────────────────────────

function ComponentFullView({
  comp,
  bgClassName,
  ringNodes,
  selectedDataWindow,
  onDataWindowChange,
  onNavigate,
  onClose,
  onOpenEdit,
  onSwitchToDataWindow,
}: Omit<RingFullViewProps, "mode">) {
  const title: string = comp?.snapshotData?.name || comp?.title || "Component";
  const subtitle: string = comp?.snapshotData?.subtitle || comp?.subtitle || "";
  const hd: any = comp?.healthData || {};
  const laRaw: number | null = typeof hd.learningAdvancementOutcomeScoreData?.finalOutcomeScore === "number"
    ? hd.learningAdvancementOutcomeScoreData.finalOutcomeScore : null;
  const wcRaw: number | null = typeof hd.wellbeingConductOutcomeScoreData?.finalOutcomeScore === "number"
    ? hd.wellbeingConductOutcomeScoreData.finalOutcomeScore : null;
  const laStr = laRaw !== null ? String(Math.round(laRaw)) : "—";
  const wcStr = wcRaw !== null ? String(Math.round(wcRaw)) : "—";

  const nodeId = String(comp?.nodeId ?? "");
  const currentIndex = ringNodes.findIndex((n) => n.nodeId === nodeId);

  // DATA_WINDOWS layout inside octagon: 3 + 3 + 2 (6-col grid)
  const ROW1: DataWindowKey[] = ["keyDrivers", "leaps", "outcomes"];
  const ROW2: DataWindowKey[] = ["subcomponents", "practices", "tools"];
  const ROW3: DataWindowKey[] = ["snapshot", "embedded"];

  const windowLabel = (k: DataWindowKey) => DATA_WINDOWS.find((w) => w.key === k)?.label ?? k;

  function expand(w: DataWindowKey) {
    onDataWindowChange(w);
    onSwitchToDataWindow(w);
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] overflow-hidden">
      {/* ── Thin top bar: edit + close ── */}
      <div className="shrink-0 flex justify-end items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={onOpenEdit}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
          title="Edit component — Journey & Overview"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-gray-200" title="Close">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* ── Octagon + side nav arrows ── */}
      {/*
        Sizing: octagon fills the smaller of (panel width - arrows) or (panel height).
        aspectRatio keeps it square; maxHeight constrains when panel is short.
        Corner math: 18% clips end at y=18%h. Top padding 18.5% clears corners.
        Bottom corners end at y=82%h. Bottom padding 14% → content ends at y=86%,
        safe (at y=86%, horizontal edge is at 18%*(86-82)/18 = 4% from sides, well
        within 13% side padding).
      */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-1 py-1 overflow-hidden">
        <div className="flex items-center gap-1 h-full w-full justify-center">
          {/* Left nav arrow */}
          <NavArrow direction="prev" ringNodes={ringNodes} currentIndex={currentIndex} onNavigate={onNavigate} />

          {/* ── Large Octagon ── */}
          <div
            className={cn("relative shrink-0", bgClassName)}
            style={{
              /* Fill as much of the panel as possible — constrained by both width and height */
              width: "min(calc(100% - 68px), calc(100vh - 160px), 720px)",
              aspectRatio: "1 / 1",
              maxHeight: "calc(100% - 8px)",
              clipPath: "polygon(18% 0%, 82% 0%, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0% 82%, 0% 18%)",
            }}
          >
            <div
              className="absolute inset-0 flex flex-col"
              style={{ padding: "7% 13% 14% 13%" }}
            >
              {/* Scores + Name — first thing at the top padding line */}
              <div className="shrink-0 flex items-start justify-between gap-1 mb-0.5">
                <OctagonScoreBlock label="Learning & Advancement" scoreRaw={laRaw} scoreStr={laStr} align="left" />
                <h2 className="flex-1 text-center font-extrabold text-gray-900 text-2xl leading-tight px-1">
                  {title}
                </h2>
                <OctagonScoreBlock label="Engagement & Wellbeing" scoreRaw={wcRaw} scoreStr={wcStr} align="right" />
              </div>

              {/* Phase dots */}
              <div className="shrink-0 flex justify-center gap-1 mb-px">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400/50" />
                ))}
              </div>

              {/* Subject subtitle + description — compact single line below dots */}
              <div className="shrink-0 text-center text-[8px] text-gray-500 leading-none mb-1 truncate">
                {subtitle || (comp?.snapshotData?.description || comp?.description) || ""}
              </div>

              {/* Data window grid: 3 equal cols, rows fill remaining space */}
              <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-3 gap-1.5">
                {[...ROW1, ...ROW2, ...ROW3].map((k) => (
                  <OctagonWindowTile
                    key={k} windowKey={k} label={windowLabel(k)} comp={comp}
                    onExpand={() => expand(k)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right nav arrow */}
          <NavArrow direction="next" ringNodes={ringNodes} currentIndex={currentIndex} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

// ─── Mode B: Data Window Full View ────────────────────────────────────────────

function DataWindowFullView({
  comp,
  bgClassName,
  ringNodes,
  selectedDataWindow,
  onDataWindowChange,
  onNavigate,
  onClose,
  onOpenEdit,
  onOpenScopedEdit,
  onSwitchToComponent,
}: Omit<RingFullViewProps, "mode">) {
  const title: string = comp?.snapshotData?.name || comp?.title || "Component";
  const subtitle: string = comp?.snapshotData?.subtitle || comp?.subtitle || "";
  const hd: any = comp?.healthData || {};
  const laRaw = hd.learningAdvancementOutcomeScoreData?.finalOutcomeScore;
  const wcRaw = hd.wellbeingConductOutcomeScoreData?.finalOutcomeScore;
  const laStr = typeof laRaw === "number" ? String(Math.round(laRaw)) : "—";
  const wcStr = typeof wcRaw === "number" ? String(Math.round(wcRaw)) : "—";

  const nodeId = String(comp?.nodeId ?? "");
  const currentIndex = ringNodes.findIndex((n) => n.nodeId === nodeId);
  const currentWindowLabel = DATA_WINDOWS.find((w) => w.key === selectedDataWindow)?.label ?? "";

  const scopedGetterRef = useRef<() => RingScopedEditPayload>(() => ({
    tab: "snapshot",
    deNav: null,
    openSubId: null,
    initialSubId: null,
  }));

  const bindScopedEdit = useCallback((getter: () => RingScopedEditPayload) => {
    scopedGetterRef.current = getter;
  }, []);

  useEffect(() => {
    scopedGetterRef.current = () => ({
      tab: selectedDataWindow === "keyDrivers" ? "status-and-health" : "designed-experience",
      deNav: null,
      openSubId: null,
      initialSubId: null,
    });
  }, [selectedDataWindow, comp?.nodeId]);

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900 text-xl leading-tight truncate">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{currentWindowLabel}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Contract: go back to full octagon (Mode A) */}
          {onSwitchToComponent && (
            <button
              type="button"
              onClick={onSwitchToComponent}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              title="Back to full component view"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenEdit}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title="Edit component — Journey & Overview"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-gray-100" title="Close">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 flex flex-col items-center py-4 gap-4 overflow-y-auto">
        {/* Navigation row + Normal-size Octagon */}
        <div className="flex items-center gap-5 shrink-0">
          <NavArrow direction="prev" ringNodes={ringNodes} currentIndex={currentIndex} onNavigate={onNavigate} />

          <div style={{ width: 220, height: 220, flexShrink: 0 }}>
            <OctagonCard
              title={title}
              subtitle={subtitle}
              centerVariant="dataPreview"
              dataPreviewContent={
                <RingDataPreviewWindow
                  comp={comp}
                  selectedWindow={selectedDataWindow}
                  onWindowChange={onDataWindowChange}
                />
              }
              bgClassName={bgClassName}
              leftStat={{ label: "Learning & Adv.", value: laStr }}
              rightStat={{ label: "Wellbeing", value: wcStr }}
            />
          </div>

          <NavArrow direction="next" ringNodes={ringNodes} currentIndex={currentIndex} onNavigate={onNavigate} />
        </div>

        {/* Enlarged window content */}
        <div className="w-full px-5 pb-4 flex-1 min-h-0 flex flex-col">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0 flex items-start justify-between gap-2">
              <h3 className="font-bold text-gray-900 min-w-0">{currentWindowLabel}</h3>
              <button
                type="button"
                onClick={() => onOpenScopedEdit(scopedGetterRef.current())}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-purple-700 transition-colors shrink-0"
                title="Edit this section in the working panel"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <EnlargedWindowContent comp={comp} windowKey={selectedDataWindow} bindScopedEdit={bindScopedEdit} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function RingFullView(props: RingFullViewProps) {
  if (props.mode === "component") {
    return <ComponentFullView {...props} />;
  }
  return <DataWindowFullView {...props} />;
}
