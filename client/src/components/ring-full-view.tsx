"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import OctagonCard from "./octagon-card";
import { scoreBgCls } from "@/lib/score-threshold-colors";
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
  isLeapAimActive,
  isTargetingAimActive,
  getPracticesKeyItems,
  getToolsKeyItems,
  extractAllItemsFromBucket,
  buildExpertSources,
  buildAimSources,
  buildSnapshotSources,
  buildPracticeDossier,
  getAllPracticeItems,
  mergeScheduleDurationFrequency,
  type PracticeDossier,
  type PracticeItem,
  type KDNodeKey,
} from "./ring-data-preview-window";
import { ALL_ELEMENTS } from "@/components/expert-view/expert-view-schema";
import type { DESubView } from "./designed-experience-card-content";
import type { RingSourceScope } from "./ring-data-preview-window";
import { DESIGN_SUBDIMENSION_TREE } from "@shared/design-subdimension-tree";
import { calcDesignDimensionScore } from "@shared/design-score-calc";
import { IMPLEMENTATION_SUBDIMENSION_TREE } from "@shared/implementation-subdimension-tree";
import { calcImplementationTopDimensionScore } from "@shared/implementation-score-calc";
import { experienceHealthSubdimensions, experienceWeightsForComponent } from "@shared/experience-subdimension-tree";
import { migrateLegacyExperienceScoreData } from "@shared/experience-score-calc";
import {
  LEARNING_ADVANCEMENT_OUTCOME_TREE,
  WELLBEING_CONDUCT_OUTCOME_TREE,
} from "@shared/outcome-subdimension-tree";
import { calcL1Score, calcMeasureScore } from "@shared/outcome-score-calc";
import {
  calculateRingConditionsScoreFromData,
  conditionMatchesStakeholder,
  getConditionStakeholderGroups,
} from "@shared/ring-conditions-score";
import type {
  OutcomeMeasure,
  RingConditionsCKey,
  RingConditionsStakeholderGroup,
} from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Deep-link payload for the lower “scoped edit” control in Mode B (vs header = component overview). */
export type StatusHealthPage = "design" | "conditions" | "implementation" | "experience" | "learningAdvancement" | "wellbeingConduct";

export interface RingScopedEditPayload {
  tab: "snapshot" | "designed-experience" | "status-and-health";
  deNav: DESubView | null;
  openSubId: string | null;
  initialSubId: string | null;
  /** When tab === "status-and-health", optionally jump straight to a specific dimension page. */
  shPage?: StatusHealthPage | null;
}

type ScopedEditBinder = (getter: () => RingScopedEditPayload) => void;

function payloadStatusHealth(page?: StatusHealthPage): RingScopedEditPayload {
  return { tab: "status-and-health", deNav: null, openSubId: null, initialSubId: null, shPage: page ?? null };
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

const DEFAULT_RING_SCOPE: RingSourceScope = { kind: "component" };

/**
 * Working-panel deep link for a data preview window at **component** scope
 * (matches enlarged Mode B defaults: first source tab, first key-element tab for practices/tools).
 */
export function scopedEditPayloadForDataWindow(w: DataWindowKey): RingScopedEditPayload {
  switch (w) {
    case "keyDrivers":
      return payloadStatusHealth();
    case "leaps":
      return payloadLeaps(DEFAULT_RING_SCOPE);
    case "outcomes":
      return payloadOutcomes(DEFAULT_RING_SCOPE);
    case "subcomponents":
      return payloadDesignedExperienceRoot();
    case "snapshot":
      return payloadSnapshot(DEFAULT_RING_SCOPE);
    case "practices":
    case "tools":
      return payloadPracticesTools(DEFAULT_RING_SCOPE, ALL_ELEMENTS[0]?.id ?? "schedule");
    case "embedded":
    default:
      return payloadDesignedExperienceRoot();
  }
}

/** One of the six health dimensions. */
export type DimensionKey =
  | "design"
  | "conditions"
  | "implementation"
  | "experience"
  | "learningAdvancement"
  | "wellbeingConduct";

/** Identifies what is being drilled into in Mode C. */
export type DrillTarget =
  | { kind: "leap"; label: string }
  | { kind: "outcome"; label: string }
  | { kind: "subcomponent"; name: string }
  | { kind: "practice"; item: PracticeItem }
  | { kind: "tool"; item: PracticeItem }
  | { kind: "dimension"; dimensionKey: DimensionKey };

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
  /** Opens working panel on Snapshot (main component), regardless of current data window. */
  onOpenEdit: () => void;
  /** Opens working panel scoped to the current enlarged data (tabs, element, subcomponent). */
  onOpenScopedEdit: (payload: RingScopedEditPayload) => void;
  /** Called when a data window tile is expanded — switches right panel to Mode B. */
  onSwitchToDataWindow: (w: DataWindowKey) => void;
  /** Called from Mode B to contract back to Mode A (full octagon view). */
  onSwitchToComponent?: () => void;
  /** When provided, DataWindowFullView opens directly into this drill target. */
  initialDrillTarget?: DrillTarget | null;
  /** Called when user clicks a dimension from Mode A — parent switches to Mode B + seeds drill. */
  onSwitchToDimension?: (key: DimensionKey) => void;
  /** Called when a line-item in a Mode-A card is clicked — parent switches to Mode B with a drill pre-set. */
  onSwitchToDataWindowWithDrill?: (w: DataWindowKey, drill: DrillTarget) => void;
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

// ─── Drill views (Mode C) ─────────────────────────────────────────────────────

function DrillBackBar({ onBack, onReturnToComponent }: { onBack: () => void; onReturnToComponent?: () => void }) {
  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/70">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-700 font-medium transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back
      </button>
      {onReturnToComponent && (
        <>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={onReturnToComponent}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-700 transition-colors"
          >
            <Minimize2 className="w-3 h-3" />
            Component view
          </button>
        </>
      )}
    </div>
  );
}

function DrillScopedEditButton({ payload, onOpenScopedEdit }: { payload: RingScopedEditPayload; onOpenScopedEdit?: (p: RingScopedEditPayload) => void }) {
  if (!onOpenScopedEdit) return null;
  return (
    <button
      type="button"
      onClick={() => onOpenScopedEdit(payload)}
      title="Edit in working panel"
      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-purple-700 transition-colors shrink-0"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );
}

// ── Leap drill ──────────────────────────────────────────────────────────────

function LeapDrillView({
  comp,
  leapLabel,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  leapLabel: string;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const de = comp?.designedExperienceData || {};

  // Find this leap in the component and all subs
  const allSources: Array<{ name: string; isAdult: boolean; aims: any[] }> = [
    { name: "Component", isAdult: false, aims: de.keyDesignElements?.aims ?? [] },
    ...(de.subcomponents ?? []).map((s: any) => ({ name: s.name || "Sub", isAdult: false, aims: s.keyDesignElements?.aims ?? s.aims ?? [] })),
    ...(de.adultSubcomponents ?? []).map((s: any) => ({ name: s.name || "Adult Sub", isAdult: true, aims: s.keyDesignElements?.aims ?? s.aims ?? [] })),
  ];

  const leapAim = de.keyDesignElements?.aims?.find((a: any) => a.type === "leap" && a.label === leapLabel);
  const priority: Priority = leapAim?.overrideLevel ?? leapAim?.computedLevel ?? (leapAim?.level === "High" ? "H" : leapAim?.level === "Low" ? "L" : "M");
  const notes = (leapAim?.notes || "").trim();

  const subs = allSources
    .filter((src) => src.name !== "Component" && src.aims.some((a: any) => a.type === "leap" && a.label === leapLabel && isLeapAimActive(a)))
    .map((src) => ({ name: src.name, isAdult: src.isAdult }));

  const editPayload: RingScopedEditPayload = { tab: "designed-experience", deNav: { view: "leaps" }, openSubId: null, initialSubId: null };

  return (
    <div className="flex flex-col h-full">
      <DrillBackBar onBack={onBack} onReturnToComponent={onReturnToComponent} />
      <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Leap</p>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{leapLabel}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <PriorityBadge priority={priority} />
          <DrillScopedEditButton payload={editPayload} onOpenScopedEdit={onOpenScopedEdit} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">How it applies</p>
          {notes
            ? <p className="text-sm text-gray-700 leading-relaxed">{notes}</p>
            : <p className="text-sm text-gray-400 italic">No notes captured yet.</p>}
        </div>
        {subs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Relevant subcomponents</p>
            <div className="flex flex-wrap gap-1.5">
              {subs.map((s, i) => <SubPill key={i} name={s.isAdult ? `${s.name} (A)` : s.name} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Outcome drill ────────────────────────────────────────────────────────────

function OutcomeDrillView({
  comp,
  outcomeLabel,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  outcomeLabel: string;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const de = comp?.designedExperienceData || {};

  const aim = (de.keyDesignElements?.aims ?? []).find((a: any) => {
    if (a.type !== "outcome") return false;
    const subs: string[] = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
    return subs.includes(outcomeLabel) || a.label === outcomeLabel;
  });

  const isL3 = aim ? (Array.isArray(aim.subSelections) && aim.subSelections.filter(Boolean).includes(outcomeLabel)) : false;
  const parentLabel = (isL3 && aim) ? aim.label : null;

  const priority: Priority = (() => {
    if (!aim) return "M";
    if (isL3) {
      const raw = (aim.subPriorities ?? {})[outcomeLabel];
      return raw === "H" ? "H" : raw === "L" ? "L" : "M";
    }
    return aim.overrideLevel ?? aim.computedLevel ?? (aim.level === "High" ? "H" : aim.level === "Low" ? "L" : "M");
  })();

  const isPrimary = aim?.isPrimary || (isL3 && !!(aim?.subPrimaries ?? {})[outcomeLabel]);
  const notes = (aim?.notes || "").trim();

  const allSources: Array<{ name: string; isAdult: boolean; aims: any[] }> = [
    ...(de.subcomponents ?? []).map((s: any) => ({ name: s.name || "Sub", isAdult: false, aims: s.keyDesignElements?.aims ?? s.aims ?? [] })),
    ...(de.adultSubcomponents ?? []).map((s: any) => ({ name: s.name || "Adult Sub", isAdult: true, aims: s.keyDesignElements?.aims ?? s.aims ?? [] })),
  ];

  const subs = allSources
    .filter((src) => src.aims.some((a: any) => {
      if (a.type !== "outcome" || !isTargetingAimActive(a)) return false;
      const subs2: string[] = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
      return subs2.includes(outcomeLabel) || a.label === outcomeLabel;
    }))
    .map((src) => ({ name: src.name, isAdult: src.isAdult }));

  const editPayload: RingScopedEditPayload = { tab: "designed-experience", deNav: { view: "outcomes" }, openSubId: null, initialSubId: null };

  return (
    <div className="flex flex-col h-full">
      <DrillBackBar onBack={onBack} onReturnToComponent={onReturnToComponent} />
      <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
            Targeted Outcome{parentLabel ? ` · ${parentLabel}` : ""}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{outcomeLabel}</h2>
            {isPrimary && <span className="text-blue-600 text-sm font-semibold">★ Primary</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <PriorityBadge priority={priority} />
          <DrillScopedEditButton payload={editPayload} onOpenScopedEdit={onOpenScopedEdit} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">How it applies</p>
          {notes
            ? <p className="text-sm text-gray-700 leading-relaxed">{notes}</p>
            : <p className="text-sm text-gray-400 italic">No notes captured yet.</p>}
        </div>
        {subs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Relevant subcomponents</p>
            <div className="flex flex-wrap gap-1.5">
              {subs.map((s, i) => <SubPill key={i} name={s.isAdult ? `${s.name} (A)` : s.name} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subcomponent drill ───────────────────────────────────────────────────────

function SubDrillWindowTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-[90px] max-h-[180px] border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="shrink-0 bg-gray-50 border-b border-gray-200 px-2.5 py-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 text-[11px] text-gray-700">
        {children}
      </div>
    </div>
  );
}

function SubcomponentDrillView({
  comp,
  subName,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  subName: string;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const de = comp?.designedExperienceData || {};
  const allSubs = [...(de.subcomponents ?? []), ...(de.adultSubcomponents ?? [])];
  const sub = allSubs.find((s: any) => (s.name || "") === subName);
  const isAdult = !!(de.adultSubcomponents ?? []).find((s: any) => (s.name || "") === subName);
  const subId = sub ? String(sub.id) : null;

  const description = sub?.description || "";

  // Build a synthetic comp object for sub-level data helpers
  const syntheticComp = sub ? {
    snapshotData: sub.snapshotData ?? {},
    designedExperienceData: {
      keyDesignElements: sub.keyDesignElements ?? { aims: sub.aims ?? [] },
      elementsExpertData: sub.elementsExpertData ?? {},
      subcomponents: [],
      adultSubcomponents: [],
      learnersProfile: sub.learnersProfile,
      adultsProfile: sub.adultsProfile,
    },
    healthData: null,
  } : null;

  const leaps = syntheticComp ? aggregateLeaps(syntheticComp) : [];
  const outcomes = syntheticComp ? aggregateOutcomes(syntheticComp) : [];
  const practiceItems = syntheticComp ? getPracticesKeyItems(syntheticComp) : [];
  const toolItems = syntheticComp ? getToolsKeyItems(syntheticComp) : [];
  const snapshot = syntheticComp ? getSnapshotData(syntheticComp, comp) : null;

  const editPayload: RingScopedEditPayload = subId
    ? (isAdult
      ? { tab: "designed-experience", deNav: { view: "adultSubManage", subId }, openSubId: null, initialSubId: null }
      : { tab: "designed-experience", deNav: null, openSubId: subId, initialSubId: subId })
    : { tab: "designed-experience", deNav: null, openSubId: null, initialSubId: null };

  if (!sub) {
    return (
      <div className="flex flex-col h-full">
        <DrillBackBar onBack={onBack} onReturnToComponent={onReturnToComponent} />
        <p className="p-5 text-sm text-gray-400 italic">Subcomponent not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DrillBackBar onBack={onBack} onReturnToComponent={onReturnToComponent} />
      <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
            {isAdult ? "Adult Subcomponent" : "Subcomponent"}
          </p>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{subName}</h2>
        </div>
        <DrillScopedEditButton payload={editPayload} onOpenScopedEdit={onOpenScopedEdit} />
      </div>
      {description && (
        <p className="px-5 pb-3 text-sm text-gray-600 leading-relaxed shrink-0">{description}</p>
      )}
      <div className="flex-1 overflow-y-auto px-4 pb-5">
        <div className="grid grid-cols-2 gap-2.5">
          <SubDrillWindowTile label="Leaps">
            {leaps.length === 0
              ? <span className="text-gray-400 italic text-[10px]">None</span>
              : <ul className="space-y-0.5">{leaps.map((l) => <li key={l.label} className="text-[10px]">• {l.label} <span className="text-gray-400">({l.priority})</span></li>)}</ul>
            }
          </SubDrillWindowTile>
          <SubDrillWindowTile label="Targeted Outcomes">
            {outcomes.length === 0
              ? <span className="text-gray-400 italic text-[10px]">None</span>
              : <ul className="space-y-0.5">{outcomes.map((o) => <li key={o.label} className="text-[10px]">• {o.label} <span className="text-gray-400">({o.priority})</span></li>)}</ul>
            }
          </SubDrillWindowTile>
          <SubDrillWindowTile label="Practices & Approaches">
            {practiceItems.length === 0
              ? <span className="text-gray-400 italic text-[10px]">No key practices</span>
              : <ul className="space-y-0.5">{practiceItems.map((p, i) => <li key={i} className="text-[10px]">• {p}</li>)}</ul>
            }
          </SubDrillWindowTile>
          <SubDrillWindowTile label="Tools & Resources">
            {toolItems.length === 0
              ? <span className="text-gray-400 italic text-[10px]">No key tools</span>
              : <ul className="space-y-0.5">{toolItems.map((t, i) => <li key={i} className="text-[10px]">• {t}</li>)}</ul>
            }
          </SubDrillWindowTile>
          {snapshot && (
            <SubDrillWindowTile label="Snapshot">
              {[snapshot.primaryOutcomes, snapshot.teachers, snapshot.gradeBand, snapshot.enrollment, snapshot.duration].filter(Boolean).length === 0
                ? <span className="text-gray-400 italic text-[10px]">No snapshot data</span>
                : <ul className="space-y-0.5">
                  {[snapshot.primaryOutcomes, snapshot.teachers, snapshot.gradeBand, snapshot.enrollment, snapshot.duration].filter(Boolean).map((row, i) => (
                    <li key={i} className="text-[10px]">• {row}</li>
                  ))}
                </ul>
              }
            </SubDrillWindowTile>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Practice / Tool drill ────────────────────────────────────────────────────

function PracticeToolDrillView({
  comp,
  item,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  item: PracticeItem;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const dossier = useMemo(
    () => buildPracticeDossier(comp, item.section, item.elementId, item.bucketCompositeKey, item.label),
    [comp, item],
  );

  // For A4/A5 (free-text / structured), use the choice-bucket label as the page title
  // and render the user's text as body content instead.
  const displayTitle = item.isLongText ? item.bucketTitle : item.label;
  const freeTextBody = item.isLongText ? item.label : null;

  const editPayload: RingScopedEditPayload = {
    tab: "designed-experience",
    deNav: { view: "designElement", elementId: item.elementId },
    openSubId: null,
    initialSubId: null,
  };

  return (
    <div className="flex flex-col h-full">
      <DrillBackBar onBack={onBack} onReturnToComponent={onReturnToComponent} />
      <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
            {item.section === "practices" ? "Practice & Approach" : "Tool & Resource"}
            {" · "}
            {dossier?.elementShortTitle ?? item.elementId}
          </p>
          <h2 className="text-base font-bold text-gray-900 leading-tight">{displayTitle}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {item.isKey && (
            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
              KEY
            </span>
          )}
          <DrillScopedEditButton payload={editPayload} onOpenScopedEdit={onOpenScopedEdit} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        {dossier && (
          <>
            {/* For A4/A5, show the free-text as the primary content block */}
            {freeTextBody && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-sm text-gray-700 leading-relaxed">{freeTextBody}</p>
              </div>
            )}
            {/* For A1/A2/A3, show the choice-bucket label as context */}
            {!freeTextBody && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Choice bucket</p>
                <p className="text-sm text-gray-700">{dossier.bucketTitle}</p>
              </div>
            )}
            {/* Component-level notes (from root component attribution, if any) */}
            {(() => {
              const compAttr = dossier.attributions.find((a) => a.isComponent);
              if (!compAttr?.notes?.trim()) return null;
              return (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{compAttr.notes.trim()}</p>
                </div>
              );
            })()}
            {/* Subcomponent attributions */}
            {dossier.attributions.some((a) => !a.isComponent) && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Subcomponents it applies to
                </p>
                <div className="space-y-2">
                  {dossier.attributions.filter((a) => !a.isComponent).map((attr, i) => (
                    <div
                      key={i}
                      className="border border-gray-100 rounded-lg px-3 py-2 bg-gray-50/50"
                    >
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-medium text-sm text-gray-900">{attr.sourceName}</span>
                        {attr.isAdult && <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-px font-semibold">Adult</span>}
                        {attr.isKey && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-px font-semibold">Key</span>}
                      </div>
                      {attr.notes?.trim() && (
                        <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{attr.notes.trim()}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Dimension detail views (read-only health dimension panels) ───────────────

/** Shared read-only score chip for dimension panels (slightly larger than DrillView chips). */
function DimScoreChip({ score }: { score: number | null }) {
  return (
    <span className={cn("inline-flex items-center justify-center w-9 h-9 rounded-lg border-2 text-sm font-bold shrink-0", scoreBgCls(score))}>
      {score !== null ? Math.round(score) : "—"}
    </span>
  );
}

/** Shared header + scroll shell for all dimension detail views. */
function DimPanelShell({
  eyebrow,
  title,
  score,
  shPage,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
  children,
}: {
  eyebrow: string;
  title: string;
  score: number | null;
  shPage?: StatusHealthPage;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <DrillBackBar onBack={onBack} onReturnToComponent={onReturnToComponent} />
      <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{eyebrow}</p>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <DimScoreChip score={score} />
          <DrillScopedEditButton payload={payloadStatusHealth(shPage)} onOpenScopedEdit={onOpenScopedEdit} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4 min-h-0">
        {children}
      </div>
    </div>
  );
}

/** Default filter used for read-only score calculations (current year, latest instance). */
function defaultScoreFilter(): any {
  try {
    const y = new Date().getFullYear();
    return { mode: "year", yearKey: String(y), aggregation: "singleLatest" };
  } catch {
    return { mode: "all" };
  }
}

/** Read-only row for a single OutcomeMeasure with its instances. */
function DimMeasureRow({ measure, filter }: { measure: OutcomeMeasure; filter: any }) {
  const instances: any[] = (measure as any).instances ?? [];
  const filteredInsts = instances.slice().sort((a: any, b: any) => {
    const da = a.asOfDate ?? a.date ?? a.createdAt ?? "";
    const db = b.asOfDate ?? b.date ?? b.createdAt ?? "";
    return db.localeCompare(da);
  });

  const measureScore = useMemo(
    () => calcMeasureScore(measure, filter),
    [measure, filter],
  );

  const instanceSummary = () => {
    if (!filteredInsts.length) return "No instances";
    const first = filteredInsts[0];
    const actor = String(first?.actor ?? "").trim();
    const actorShort = actor ? (actor.length > 14 ? `${actor.slice(0, 14)}…` : actor) : "Unknown";
    const val = first?.score != null ? String(Math.round(Number(first.score))) : "—";
    const date = String(first?.asOfDate ?? first?.date ?? "").slice(0, 10) || "";
    const rest = filteredInsts.length - 1;
    const base = `${actorShort} · ${val}${date ? ` · ${date}` : ""}`;
    return rest > 0 ? `${base} +${rest}` : base;
  };

  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
      <DimScoreChip score={measureScore} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate" title={(measure as any).label ?? (measure as any).name ?? ""}>
          {(measure as any).label ?? (measure as any).name ?? "Unnamed measure"}
        </p>
        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{instanceSummary()}</p>
      </div>
    </div>
  );
}

/** Sub-dimension section tile + its measure rows. */
function DimSubDimSection({
  label,
  score,
  measures,
  filter,
}: {
  label: string;
  score: number | null;
  measures: OutcomeMeasure[];
  filter: any;
}) {
  return (
    <div>
      {/* Sub-dim tile */}
      <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-gray-50 border-gray-200 mb-2">
        <DimScoreChip score={score} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-800 line-clamp-2" title={label}>{label}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">
            {measures.length === 0
              ? "No measures tagged"
              : `${measures.length} measure${measures.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      {/* Measure rows */}
      {measures.length > 0 && (
        <div className="pl-3 border-l-2 border-gray-100">
          {measures.map((m, i) => (
            <DimMeasureRow key={(m as any).id ?? i} measure={m} filter={filter} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Design dimension view ─────────────────────────────────────────────────────

function DimViewDesign({
  comp,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const hd: any = comp?.healthData || {};
  const dsd: any = hd.designScoreData || {};
  const finalScore: number | null = typeof dsd.finalDesignScore === "number" ? dsd.finalDesignScore : null;
  const measures: OutcomeMeasure[] = Array.isArray(dsd.measures) ? dsd.measures : [];
  const overallMeasures: OutcomeMeasure[] = Array.isArray(dsd.overallMeasures) ? dsd.overallMeasures : [];
  const weights: Record<string, "H" | "M" | "L"> = dsd.subDimensionWeights ?? {};
  const filter = dsd.filter ?? defaultScoreFilter();

  const overallMs = [...measures.filter((m: any) => !m.subDimensionIds?.length), ...overallMeasures];

  return (
    <DimPanelShell
      eyebrow="Health Dimension"
      title="Design"
      score={finalScore}
      shPage="design"
      onBack={onBack}
      onReturnToComponent={onReturnToComponent}
      onOpenScopedEdit={onOpenScopedEdit}
    >
      {/* Per sub-dimension */}
      {DESIGN_SUBDIMENSION_TREE.map((top) => {
        const tagged = measures.filter((m: any) =>
          Array.isArray(m.subDimensionIds) && m.subDimensionIds.includes(top.id)
        );
        const score = calcDesignDimensionScore(top as any, measures, overallMeasures, weights, filter);
        return (
          <DimSubDimSection
            key={top.id}
            label={top.label}
            score={score}
            measures={tagged}
            filter={filter}
          />
        );
      })}
      {/* Overall (untagged) measures */}
      {overallMs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Overall Measures</p>
          <div className="pl-3 border-l-2 border-gray-100">
            {overallMs.map((m, i) => <DimMeasureRow key={(m as any).id ?? i} measure={m} filter={filter} />)}
          </div>
        </div>
      )}
      {measures.length === 0 && overallMs.length === 0 && (
        <p className="text-sm text-gray-400 italic">No measures recorded yet.</p>
      )}
    </DimPanelShell>
  );
}

// ── Implementation dimension view ─────────────────────────────────────────────

function DimViewImplementation({
  comp,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const hd: any = comp?.healthData || {};
  const isd: any = hd.implementationScoreData || {};
  const finalScore: number | null = typeof isd.finalImplementationScore === "number" ? isd.finalImplementationScore : null;
  const measures: OutcomeMeasure[] = Array.isArray(isd.measures) ? isd.measures : [];
  const overallMeasures: OutcomeMeasure[] = Array.isArray(isd.overallMeasures) ? isd.overallMeasures : [];
  const weights: Record<string, "H" | "M" | "L"> = isd.subDimensionWeights ?? {};
  const filter = isd.filter ?? defaultScoreFilter();

  const overallMs = [...measures.filter((m: any) => !m.subDimensionIds?.length), ...overallMeasures];

  return (
    <DimPanelShell
      eyebrow="Health Dimension"
      title="Implementation"
      score={finalScore}
      shPage="implementation"
      onBack={onBack}
      onReturnToComponent={onReturnToComponent}
      onOpenScopedEdit={onOpenScopedEdit}
    >
      {IMPLEMENTATION_SUBDIMENSION_TREE.map((top) => {
        const allIds = new Set([top.id, ...top.children.map((c) => c.id)]);
        const tagged = measures.filter((m: any) =>
          Array.isArray(m.subDimensionIds) && m.subDimensionIds.some((id: string) => allIds.has(id))
        );
        const score = calcImplementationTopDimensionScore(top, measures, overallMeasures, weights, filter);
        return (
          <DimSubDimSection
            key={top.id}
            label={top.label}
            score={score}
            measures={tagged}
            filter={filter}
          />
        );
      })}
      {overallMs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Overall Measures</p>
          <div className="pl-3 border-l-2 border-gray-100">
            {overallMs.map((m, i) => <DimMeasureRow key={(m as any).id ?? i} measure={m} filter={filter} />)}
          </div>
        </div>
      )}
      {measures.length === 0 && overallMs.length === 0 && (
        <p className="text-sm text-gray-400 italic">No measures recorded yet.</p>
      )}
    </DimPanelShell>
  );
}

// ── Experience dimension view ─────────────────────────────────────────────────

function DimViewExperience({
  comp,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const hd: any = comp?.healthData || {};
  const esd: any = hd.experienceScoreData || {};
  const finalScore: number | null = typeof esd.finalExperienceScore === "number" ? esd.finalExperienceScore : null;

  const deAims: any[] = comp?.designedExperienceData?.keyDesignElements?.aims ?? [];
  const migratedData = useMemo(() => migrateLegacyExperienceScoreData(esd, deAims), [esd, deAims]);
  const measures: OutcomeMeasure[] = Array.isArray(migratedData?.measures) ? migratedData.measures : [];
  const overallMeasures: OutcomeMeasure[] = Array.isArray(migratedData?.overallMeasures) ? migratedData.overallMeasures : [];
  const weights: Record<string, "H" | "M" | "L"> = migratedData?.subDimensionWeights ?? {};
  const filter = (esd as any)?.filter ?? (migratedData as any)?.filter ?? defaultScoreFilter();

  const tops = useMemo(() => experienceHealthSubdimensions(null), []);
  const compWeights = useMemo(() => experienceWeightsForComponent(comp, tops), [comp, tops]);
  const mergedWeights = { ...compWeights, ...weights };

  const overallMs = [...measures.filter((m: any) => !m.subDimensionIds?.length), ...overallMeasures];

  return (
    <DimPanelShell
      eyebrow="Health Dimension"
      title="Experience"
      score={finalScore}
      shPage="experience"
      onBack={onBack}
      onReturnToComponent={onReturnToComponent}
      onOpenScopedEdit={onOpenScopedEdit}
    >
      {tops.map((top) => {
        const tagged = measures.filter((m: any) =>
          Array.isArray(m.subDimensionIds) && m.subDimensionIds.includes(top.id)
        );
        const score = calcImplementationTopDimensionScore(top, measures, overallMeasures, mergedWeights, filter);
        return (
          <DimSubDimSection
            key={top.id}
            label={top.label}
            score={score}
            measures={tagged}
            filter={filter}
          />
        );
      })}
      {overallMs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Overall Measures</p>
          <div className="pl-3 border-l-2 border-gray-100">
            {overallMs.map((m, i) => <DimMeasureRow key={(m as any).id ?? i} measure={m} filter={filter} />)}
          </div>
        </div>
      )}
      {measures.length === 0 && overallMs.length === 0 && (
        <p className="text-sm text-gray-400 italic">No measures recorded yet.</p>
      )}
    </DimPanelShell>
  );
}

// ── Outcome dimension view (L&A + Wellbeing) ──────────────────────────────────

function DimViewOutcome({
  comp,
  dimensionKey,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  dimensionKey: "learningAdvancement" | "wellbeingConduct";
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const isLA = dimensionKey === "learningAdvancement";
  const hd: any = comp?.healthData || {};
  const osd: any = isLA
    ? (hd.learningAdvancementOutcomeScoreData ?? {})
    : (hd.wellbeingConductOutcomeScoreData ?? {});
  const finalScore: number | null =
    typeof osd.finalOutcomeScore === "number" ? osd.finalOutcomeScore : null;
  const measures: OutcomeMeasure[] = Array.isArray(osd.measures) ? osd.measures : [];
  const weights: Record<string, "H" | "M" | "L"> = osd.subDimensionWeights ?? {};
  const filter = osd.filter ?? defaultScoreFilter();

  const tree = isLA ? LEARNING_ADVANCEMENT_OUTCOME_TREE : WELLBEING_CONDUCT_OUTCOME_TREE;
  const title = isLA ? "Learning & Advancement" : "Wellbeing & Conduct";

  return (
    <DimPanelShell
      eyebrow="Health Dimension"
      title={title}
      score={finalScore}
      shPage={dimensionKey}
      onBack={onBack}
      onReturnToComponent={onReturnToComponent}
      onOpenScopedEdit={onOpenScopedEdit}
    >
      {tree.map((l1) => {
        const allIds = new Set([l1.id, ...l1.children.map((c) => c.id)]);
        const tagged = measures.filter((m: any) =>
          Array.isArray(m.subDimensionIds) && m.subDimensionIds.some((id: string) => allIds.has(id))
        );
        const overallMeasures: OutcomeMeasure[] = Array.isArray(osd.overallMeasures) ? osd.overallMeasures : [];
        const score = calcL1Score(l1, measures, overallMeasures, weights, filter);
        return (
          <DimSubDimSection
            key={l1.id}
            label={l1.label}
            score={score}
            measures={tagged}
            filter={filter}
          />
        );
      })}
      {/* Untagged measures */}
      {measures.filter((m: any) => !m.subDimensionIds?.length).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Overall Measures</p>
          <div className="pl-3 border-l-2 border-gray-100">
            {measures
              .filter((m: any) => !m.subDimensionIds?.length)
              .map((m, i) => <DimMeasureRow key={(m as any).id ?? i} measure={m} filter={filter} />)}
          </div>
        </div>
      )}
      {measures.length === 0 && (
        <p className="text-sm text-gray-400 italic">No measures recorded yet.</p>
      )}
    </DimPanelShell>
  );
}

// ── Conditions dimension view ─────────────────────────────────────────────────

const C_KEYS: RingConditionsCKey[] = ["Conviction", "Capacity", "Clarity", "Culture", "Coalition"];

const STAKEHOLDER_LABEL: Record<RingConditionsStakeholderGroup, string> = {
  students: "Students",
  families: "Families",
  educators_staff: "Educators / Staff",
  admin_district: "Admin (District)",
  admin_school: "Admin (School)",
  other_leaders: "Community Leaders",
};

function DimViewConditions({
  comp,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const hd: any = comp?.healthData || {};
  const csd: any = hd.ringConditionsScoreData || {};
  const finalScore: number | null =
    typeof csd.finalConditionsScore === "number" ? csd.finalConditionsScore : null;

  const conditions: any[] = Array.isArray(csd.conditions) ? csd.conditions : [];

  const [activeCs, setActiveCs] = useState<RingConditionsCKey[]>([]);
  const [activeStakeholders, setActiveStakeholders] = useState<RingConditionsStakeholderGroup[]>([]);

  const toggleC = (c: RingConditionsCKey) => {
    setActiveCs((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleStakeholder = (s: RingConditionsStakeholderGroup) => {
    setActiveStakeholders((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const visibleConditions = conditions.filter((cond) => {
    const passC =
      activeCs.length === 0 ||
      activeCs.some((c) => (cond.cs ?? []).includes(c));
    const passS =
      activeStakeholders.length === 0 ||
      activeStakeholders.some((s) => conditionMatchesStakeholder(cond, s));
    return passC && passS;
  });

  const allStakeholderKeys = Object.keys(STAKEHOLDER_LABEL) as RingConditionsStakeholderGroup[];

  return (
    <DimPanelShell
      eyebrow="Health Dimension"
      title="Conditions"
      score={finalScore}
      shPage="conditions"
      onBack={onBack}
      onReturnToComponent={onReturnToComponent}
      onOpenScopedEdit={onOpenScopedEdit}
    >
      {/* 5Cs filter */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Filter by 5Cs</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCs([])}
            className={cn(
              "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors",
              activeCs.length === 0
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
            )}
          >
            All
          </button>
          {C_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleC(c)}
              className={cn(
                "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors",
                activeCs.includes(c)
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Stakeholder filter */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Filter by Stakeholder</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveStakeholders([])}
            className={cn(
              "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors",
              activeStakeholders.length === 0
                ? "bg-violet-50 border-violet-200 text-violet-700"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
            )}
          >
            All
          </button>
          {allStakeholderKeys.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStakeholder(s)}
              className={cn(
                "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors",
                activeStakeholders.includes(s)
                  ? "bg-violet-50 border-violet-200 text-violet-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              {STAKEHOLDER_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Condition count */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400">
          {visibleConditions.length} of {conditions.length} condition{conditions.length !== 1 ? "s" : ""} shown
        </p>
        {(activeCs.length > 0 || activeStakeholders.length > 0) && (
          <button
            type="button"
            onClick={() => { setActiveCs([]); setActiveStakeholders([]); }}
            className="text-[10px] text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Condition list */}
      {conditions.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center">No conditions logged for this component.</p>
      ) : visibleConditions.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4 text-center">No conditions match these filters.</p>
      ) : (
        <div className="space-y-2">
          {visibleConditions.map((cond, i) => {
            const cTags: RingConditionsCKey[] = Array.isArray(cond.cs) ? cond.cs : [];
            const stakeholders = getConditionStakeholderGroups(cond);
            const direction: string = cond.direction ?? "";
            const windStrength: string = cond.windStrength ?? "";
            const description: string = (cond.description ?? "").trim();

            return (
              <div key={cond.id ?? i} className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                {/* Tags row */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {direction && (
                    <span className={cn(
                      "inline-flex items-center text-[10px] font-semibold px-1.5 py-px rounded border",
                      direction === "tailwind"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-red-100 text-red-700 border-red-200",
                    )}>
                      {direction === "tailwind" ? "Tailwind" : "Headwind"}
                    </span>
                  )}
                  {windStrength && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-px rounded border bg-gray-200 text-gray-700 border-gray-300">
                      {windStrength}
                    </span>
                  )}
                  {cTags.slice(0, 3).map((c) => (
                    <span key={c} className="inline-flex items-center text-[10px] font-semibold px-2 py-px rounded-full border bg-white text-gray-600 border-gray-200">
                      {c}
                    </span>
                  ))}
                  {cTags.length > 3 && (
                    <span className="text-[9px] text-gray-400 self-center">+{cTags.length - 3} C</span>
                  )}
                </div>
                {/* Description */}
                <p className={cn("text-xs leading-relaxed line-clamp-2", description ? "text-gray-700" : "text-gray-400 italic")}>
                  {description || "No description"}
                </p>
                {/* Stakeholders meta */}
                {stakeholders.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {STAKEHOLDER_LABEL[stakeholders[0] as RingConditionsStakeholderGroup] ?? stakeholders[0]}
                    {stakeholders.length > 1 && <span className="text-gray-400"> +{stakeholders.length - 1}</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DimPanelShell>
  );
}

// ── Master dimension drill view (routes to sub-views) ─────────────────────────

function DimensionDrillView({
  comp,
  dimensionKey,
  onBack,
  onReturnToComponent,
  onOpenScopedEdit,
}: {
  comp: any;
  dimensionKey: DimensionKey;
  onBack: () => void;
  onReturnToComponent?: () => void;
  onOpenScopedEdit?: (p: RingScopedEditPayload) => void;
}) {
  const shared = { comp, onBack, onReturnToComponent, onOpenScopedEdit };
  switch (dimensionKey) {
    case "design":           return <DimViewDesign {...shared} />;
    case "implementation":   return <DimViewImplementation {...shared} />;
    case "experience":       return <DimViewExperience {...shared} />;
    case "conditions":       return <DimViewConditions {...shared} />;
    case "learningAdvancement": return <DimViewOutcome {...shared} dimensionKey="learningAdvancement" />;
    case "wellbeingConduct":    return <DimViewOutcome {...shared} dimensionKey="wellbeingConduct" />;
  }
}

// ─── Enlarged window content (for Mode B) ─────────────────────────────────────

function EnlargedKeyDrivers({
  comp,
  bindScopedEdit,
  onDimensionClick,
}: {
  comp: any;
  bindScopedEdit?: ScopedEditBinder;
  onDimensionClick?: (dim: KDNodeKey) => void;
}) {
  useEffect(() => {
    bindScopedEdit?.(() => payloadStatusHealth());
  }, [comp, bindScopedEdit]);

  const data = getKeyDriversData(comp);
  return (
    <div style={{ width: "100%", height: 280 }}>
      <KeyDriversDiagram data={data} onNodeClick={onDimensionClick} />
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

function EnlargedLeaps({ comp, bindScopedEdit, onDrill }: { comp: any; bindScopedEdit?: ScopedEditBinder; onDrill?: (t: DrillTarget) => void }) {
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
                    {onDrill ? (
                      <button
                        type="button"
                        onClick={() => onDrill({ kind: "leap", label: leap.label })}
                        className="font-semibold text-gray-900 text-left hover:text-blue-700 hover:underline transition-colors"
                      >
                        {leap.label}
                      </button>
                    ) : (
                      <h3 className="font-semibold text-gray-900">{leap.label}</h3>
                    )}
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

function EnlargedOutcomes({ comp, bindScopedEdit, onDrill }: { comp: any; bindScopedEdit?: ScopedEditBinder; onDrill?: (t: DrillTarget) => void }) {
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
                    {onDrill ? (
                      <button
                        type="button"
                        onClick={() => onDrill({ kind: "outcome", label })}
                        className="font-semibold text-gray-900 text-left hover:text-blue-700 hover:underline transition-colors"
                      >
                        {label}
                        {o.isPrimary && <span className="ml-1.5 text-blue-600">★</span>}
                      </button>
                    ) : (
                      <h3 className="font-semibold text-gray-900">
                        {label}
                        {o.isPrimary && <span className="ml-1.5 text-blue-600">★</span>}
                      </h3>
                    )}
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

function EnlargedSubcomponents({ comp, bindScopedEdit, onDrill }: { comp: any; bindScopedEdit?: ScopedEditBinder; onDrill?: (t: DrillTarget) => void }) {
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
            {onDrill ? (
              <button
                type="button"
                onClick={() => onDrill({ kind: "subcomponent", name: sub.name })}
                className="font-semibold text-gray-900 text-left hover:text-blue-700 hover:underline transition-colors"
              >
                {sub.name}
              </button>
            ) : (
              <h3 className="font-semibold text-gray-900">{sub.name}</h3>
            )}
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
  // One arg only: each tab (component or sub) shows only that source's DE + snapshot data
  const data = getSnapshotData(src.comp);
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

function EnlargedExpertView({ comp, section, bindScopedEdit, onDrill }: { comp: any; section: "practices" | "tools"; bindScopedEdit?: ScopedEditBinder; onDrill?: (t: DrillTarget) => void }) {
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
    .flatMap((q) => q.buckets.map((b) => ({ bucket: b, bk: `${q.id}__${b.id}`, qid: q.id })));

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
          buckets.map(({ bucket, bk, qid }) => {
            const bv = (src.expertData as any)?.[element.id]?.[bk];
            const items = bv ? extractAllItemsFromBucket(bucket, bv) : [];
            return (
              <div key={bk}>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  {bucket.title}
                </h4>
                {items.length > 0 ? (
                  <ul className="space-y-1">
                    {items.map((item, i) => {
                      const practiceItem: PracticeItem = {
                        section,
                        elementId: element.id,
                        elementShortTitle: element.shortTitle,
                        bucketCompositeKey: bk,
                        bucketTitle: bucket.title,
                        label: item.label,
                        isKey: item.isKey,
                        // Full view always shows the real label — isLongText not needed here
                        isLongText: false,
                      };
                      return (
                        <li key={i} className="flex items-start gap-1.5 text-sm text-gray-800 leading-snug">
                          <span className="shrink-0 text-gray-400 mt-px">•</span>
                          {onDrill ? (
                            <button
                              type="button"
                              onClick={() => onDrill({ kind: section === "practices" ? "practice" : "tool", item: practiceItem })}
                              className="min-w-0 text-left hover:text-blue-700 hover:underline transition-colors"
                            >
                              {item.label}
                            </button>
                          ) : (
                            <span className="min-w-0">{item.label}</span>
                          )}
                          {item.isKey && (
                            <span className="shrink-0 text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 rounded px-1 py-px ml-1">KEY</span>
                          )}
                        </li>
                      );
                    })}
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
  onDrill,
}: {
  comp: any;
  windowKey: DataWindowKey;
  bindScopedEdit?: ScopedEditBinder;
  onDrill?: (t: DrillTarget) => void;
}) {
  switch (windowKey) {
    case "keyDrivers":
      return (
        <EnlargedKeyDrivers
          comp={comp}
          bindScopedEdit={bindScopedEdit}
          onDimensionClick={onDrill ? (dim) => onDrill({ kind: "dimension", dimensionKey: dim }) : undefined}
        />
      );
    case "leaps":          return <EnlargedLeaps comp={comp} bindScopedEdit={bindScopedEdit} onDrill={onDrill} />;
    case "outcomes":       return <EnlargedOutcomes comp={comp} bindScopedEdit={bindScopedEdit} onDrill={onDrill} />;
    case "subcomponents":  return <EnlargedSubcomponents comp={comp} bindScopedEdit={bindScopedEdit} onDrill={onDrill} />;
    case "snapshot":       return <EnlargedSnapshot comp={comp} bindScopedEdit={bindScopedEdit} />;
    case "practices":      return <EnlargedExpertView comp={comp} section="practices" bindScopedEdit={bindScopedEdit} onDrill={onDrill} />;
    case "tools":          return <EnlargedExpertView comp={comp} section="tools" bindScopedEdit={bindScopedEdit} onDrill={onDrill} />;
    case "embedded":       return <EnlargedComingSoon label="Embedded Locations" bindScopedEdit={bindScopedEdit} />;
  }
}

// ─── Card-sized content for Mode-A grid ───────────────────────────────────────

function CardKeyDrivers({ comp, onDimensionClick }: { comp: any; onDimensionClick?: (dim: KDNodeKey) => void }) {
  const data = getKeyDriversData(comp);
  return (
    <div className="w-full h-full" style={{ minHeight: 50 }}>
      <KeyDriversDiagram data={data} onNodeClick={onDimensionClick} />
    </div>
  );
}

function CardLeaps({ comp, onDrill, onDoubleClickEdit }: { comp: any; onDrill?: (t: DrillTarget) => void; onDoubleClickEdit?: (p: RingScopedEditPayload) => void }) {
  const leaps = aggregateLeaps(comp);
  if (!leaps.length) return <p className="text-[9px] text-gray-400 italic">No leaps defined</p>;
  return (
    <ul className="space-y-px">
      {leaps.map((l) => (
        <li key={l.label} className="flex items-start gap-1 text-[9px] leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          {onDrill ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDrill({ kind: "leap", label: l.label }); }}
              onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickEdit?.({ tab: "designed-experience", deNav: { view: "leapDetail", label: l.label }, openSubId: null, initialSubId: null }); }}
              className="min-w-0 text-left text-blue-700 hover:underline transition-colors"
              title="Click to view · Double-click to edit"
            >
              {l.label}{" "}
              <span className="text-gray-500 font-medium">({l.priority})</span>
            </button>
          ) : (
            <span className="min-w-0 text-gray-800">
              {l.label}{" "}
              <span className="text-gray-500 font-medium">({l.priority})</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CardOutcomes({ comp, onDrill, onDoubleClickEdit }: { comp: any; onDrill?: (t: DrillTarget) => void; onDoubleClickEdit?: (p: RingScopedEditPayload) => void }) {
  const outcomes = aggregateOutcomes(comp);
  if (!outcomes.length) return <p className="text-[9px] text-gray-400 italic">No outcomes defined</p>;
  return (
    <ul className="space-y-px">
      {outcomes.map((o) => (
        <li key={o.label} className="flex items-start gap-1 text-[9px] leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          {onDrill ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDrill({ kind: "outcome", label: o.label }); }}
              onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickEdit?.({ tab: "designed-experience", deNav: { view: "outcomeDetail", l2: o.label }, openSubId: null, initialSubId: null }); }}
              className="min-w-0 text-left text-blue-700 hover:underline transition-colors"
              title="Click to view · Double-click to edit"
            >
              {o.isPrimary && <span className="text-amber-500 mr-0.5">★</span>}
              {o.label}{" "}
              <span className="text-gray-500 font-medium">({o.priority})</span>
            </button>
          ) : (
            <span className="min-w-0 text-gray-800">
              {o.isPrimary && <span className="text-amber-500 mr-0.5">★</span>}
              {o.label}{" "}
              <span className="text-gray-500 font-medium">({o.priority})</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CardSubcomponents({ comp, onDrill, onDoubleClickEdit }: { comp: any; onDrill?: (t: DrillTarget) => void; onDoubleClickEdit?: (p: RingScopedEditPayload) => void }) {
  const subs = getSubcomponents(comp);
  if (!subs.length) return <p className="text-[9px] text-gray-400 italic">No subcomponents</p>;
  return (
    <ul className="space-y-px">
      {subs.map((s, i) => (
        <li key={i} className="flex items-start gap-1 text-[9px] leading-tight">
          <span className="shrink-0 text-gray-400">•</span>
          {onDrill ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDrill({ kind: "subcomponent", name: s.name }); }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!onDoubleClickEdit) return;
                const payload: RingScopedEditPayload = s.isAdult
                  ? { tab: "designed-experience", deNav: { view: "adultSubManage", subId: s.id }, openSubId: null, initialSubId: null }
                  : { tab: "designed-experience", deNav: null, openSubId: s.id, initialSubId: s.id };
                onDoubleClickEdit(payload);
              }}
              className="min-w-0 text-left text-blue-700 hover:underline transition-colors"
              title="Click to view · Double-click to edit"
            >
              {s.isAdult && <span className="text-purple-600 font-semibold mr-0.5">(A)</span>}
              {s.name}
            </button>
          ) : (
            <span className="min-w-0 text-gray-800">
              {s.isAdult && <span className="text-purple-600 font-semibold mr-0.5">(A)</span>}
              {s.name}
            </span>
          )}
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

function CardPractices({ comp, onDrill, onDoubleClickEdit }: { comp: any; onDrill?: (t: DrillTarget) => void; onDoubleClickEdit?: (p: RingScopedEditPayload) => void }) {
  const allItems = useMemo(() => getAllPracticeItems(comp, "practices"), [comp]);
  const keyItems = useMemo(() => mergeScheduleDurationFrequency(allItems.filter((i) => i.isKey)), [allItems]);
  if (!keyItems.length) return <p className="text-[9px] text-gray-400 italic">No key practices marked</p>;
  return (
    <ul className="space-y-px">
      {keyItems.map((item, i) => {
        const displayLabel = item.isLongText ? `… ${item.bucketTitle}` : item.label;
        return (
          <li key={i} className="flex items-start gap-1 text-[9px] leading-tight">
            <span className="shrink-0 text-gray-400">•</span>
            {onDrill ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDrill({ kind: "practice", item }); }}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickEdit?.({ tab: "designed-experience", deNav: { view: "designElement", elementId: item.elementId }, openSubId: item.bucketCompositeKey, initialSubId: item.bucketCompositeKey }); }}
                className="min-w-0 text-left text-blue-700 hover:underline transition-colors"
                title="Click to view · Double-click to edit"
              >
                {displayLabel}
              </button>
            ) : (
              <span className="min-w-0 text-gray-800">{displayLabel}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CardTools({ comp, onDrill, onDoubleClickEdit }: { comp: any; onDrill?: (t: DrillTarget) => void; onDoubleClickEdit?: (p: RingScopedEditPayload) => void }) {
  const allItems = useMemo(() => getAllPracticeItems(comp, "tools"), [comp]);
  const keyItems = allItems.filter((i) => i.isKey);
  if (!keyItems.length) return <p className="text-[9px] text-gray-400 italic">No key tools marked</p>;
  return (
    <ul className="space-y-px">
      {keyItems.map((item, i) => {
        const displayLabel = item.isLongText ? `… ${item.bucketTitle}` : item.label;
        return (
          <li key={i} className="flex items-start gap-1 text-[9px] leading-tight">
            <span className="shrink-0 text-gray-400">•</span>
            {onDrill ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDrill({ kind: "tool", item }); }}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClickEdit?.({ tab: "designed-experience", deNav: { view: "designElement", elementId: item.elementId }, openSubId: item.bucketCompositeKey, initialSubId: item.bucketCompositeKey }); }}
                className="min-w-0 text-left text-blue-700 hover:underline transition-colors"
                title="Click to view · Double-click to edit"
              >
                {displayLabel}
              </button>
            ) : (
              <span className="min-w-0 text-gray-800">{displayLabel}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CardComingSoon() {
  return <p className="text-[9px] text-gray-400 italic">Coming soon</p>;
}

function DataWindowCardContent({
  windowKey,
  comp,
  onDimensionClick,
  onDrill,
  onDoubleClickEdit,
}: {
  windowKey: DataWindowKey;
  comp: any;
  onDimensionClick?: (dim: KDNodeKey) => void;
  onDrill?: (t: DrillTarget) => void;
  onDoubleClickEdit?: (p: RingScopedEditPayload) => void;
}) {
  switch (windowKey) {
    case "keyDrivers":    return <CardKeyDrivers comp={comp} onDimensionClick={onDimensionClick} />;
    case "leaps":         return <CardLeaps comp={comp} onDrill={onDrill} onDoubleClickEdit={onDoubleClickEdit} />;
    case "outcomes":      return <CardOutcomes comp={comp} onDrill={onDrill} onDoubleClickEdit={onDoubleClickEdit} />;
    case "subcomponents": return <CardSubcomponents comp={comp} onDrill={onDrill} onDoubleClickEdit={onDoubleClickEdit} />;
    case "snapshot":      return <CardSnapshot comp={comp} />;
    case "practices":     return <CardPractices comp={comp} onDrill={onDrill} onDoubleClickEdit={onDoubleClickEdit} />;
    case "tools":         return <CardTools comp={comp} onDrill={onDrill} onDoubleClickEdit={onDoubleClickEdit} />;
    default:              return <CardComingSoon />;
  }
}

// ─── Individual data window card in the Mode-A grid ───────────────────────────

function DataWindowCard({
  windowKey,
  label,
  comp,
  onExpand,
  onDimensionClick,
}: {
  windowKey: DataWindowKey;
  label: string;
  comp: any;
  onExpand: () => void;
  onDimensionClick?: (dim: KDNodeKey) => void;
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
        <DataWindowCardContent windowKey={windowKey} comp={comp} onDimensionClick={onDimensionClick} />
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
  onDimensionClick,
  onDrill,
  onDoubleClickEdit,
  onHeaderDoubleClick,
  className,
}: {
  windowKey: DataWindowKey;
  label: string;
  comp: any;
  onExpand: () => void;
  onDimensionClick?: (dim: KDNodeKey) => void;
  onDrill?: (t: DrillTarget) => void;
  onDoubleClickEdit?: (p: RingScopedEditPayload) => void;
  onHeaderDoubleClick?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[2px] h-full min-h-0", className)}>
      {/* Label above the card — single click expands to Mode B; double-click opens manage page */}
      <button
        type="button"
        onClick={onExpand}
        onDoubleClick={(e) => { e.stopPropagation(); onHeaderDoubleClick?.(); }}
        className="shrink-0 text-[9px] font-semibold text-gray-600 text-left hover:text-blue-700 transition-colors truncate leading-tight"
        title={onHeaderDoubleClick ? `Expand ${label} · Double-click to manage` : `Expand ${label}`}
      >
        {label}
      </button>
      {/* Card body — clicking the background expands to Mode B; individual items intercept before bubble */}
      <div
        className="flex-1 min-h-0 bg-white/85 rounded border border-gray-300/50 overflow-y-auto cursor-pointer hover:border-blue-400/60 hover:bg-white transition-colors"
        onClick={windowKey === "keyDrivers" ? undefined : onExpand}
        style={{ padding: "4px 5px" }}
      >
        <DataWindowCardContent windowKey={windowKey} comp={comp} onDimensionClick={onDimensionClick} onDrill={onDrill} onDoubleClickEdit={onDoubleClickEdit} />
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
  onClick,
}: {
  label: string;
  scoreRaw: number | null;
  scoreStr: string;
  align: "left" | "right";
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={cn(
        "text-[8px] font-semibold leading-tight text-center w-full",
        onClick ? "text-blue-600 group-hover:text-blue-700" : "text-gray-500",
      )}>
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 text-base font-bold w-10 h-10 flex items-center justify-center rounded-xl border-2 shrink-0",
          scoreBgCls(scoreRaw),
          onClick && "group-hover:opacity-80 transition-opacity",
        )}
      >
        {scoreStr}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col shrink-0 w-[64px] items-center group cursor-pointer"
        title={`View ${label} details`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex flex-col shrink-0 w-[64px] items-center">
      {inner}
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
  onOpenScopedEdit,
  onSwitchToDataWindow,
  onSwitchToDimension,
  onSwitchToDataWindowWithDrill,
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

  function drillFromCard(w: DataWindowKey, target: DrillTarget) {
    onDataWindowChange(w);
    onSwitchToDataWindowWithDrill?.(w, target);
  }

  // Header double-click payloads: open the manage page for each section
  const headerDoubleClickPayload: Partial<Record<DataWindowKey, RingScopedEditPayload>> = {
    leaps:         { tab: "designed-experience", deNav: { view: "leaps" }, openSubId: null, initialSubId: null },
    outcomes:      { tab: "designed-experience", deNav: { view: "outcomes" }, openSubId: null, initialSubId: null },
    subcomponents: { tab: "designed-experience", deNav: null, openSubId: null, initialSubId: null },
    practices:     { tab: "designed-experience", deNav: { view: "designElement", elementId: "practices" }, openSubId: null, initialSubId: null },
    tools:         { tab: "designed-experience", deNav: { view: "designElement", elementId: "tools" }, openSubId: null, initialSubId: null },
    snapshot:      { tab: "designed-experience", deNav: null, openSubId: null, initialSubId: null },
  };

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] overflow-hidden">
      {/* ── Thin top bar: edit + close ── */}
      <div className="shrink-0 flex justify-end items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={onOpenEdit}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
          title="Edit component — Snapshot"
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
                <OctagonScoreBlock
                  label="Learning & Advancement"
                  scoreRaw={laRaw}
                  scoreStr={laStr}
                  align="left"
                  onClick={onSwitchToDimension ? () => onSwitchToDimension("learningAdvancement") : undefined}
                />
                <h2 className="flex-1 text-center font-extrabold text-gray-900 text-2xl leading-tight px-1">
                  {title}
                </h2>
                <OctagonScoreBlock
                  label="Engagement & Wellbeing"
                  scoreRaw={wcRaw}
                  scoreStr={wcStr}
                  align="right"
                  onClick={onSwitchToDimension ? () => onSwitchToDimension("wellbeingConduct") : undefined}
                />
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
                    onDimensionClick={k === "keyDrivers" && onSwitchToDimension
                      ? (dim) => onSwitchToDimension(dim as DimensionKey)
                      : undefined}
                    onDrill={onSwitchToDataWindowWithDrill
                      ? (target) => drillFromCard(k, target)
                      : undefined}
                    onDoubleClickEdit={onOpenScopedEdit
                      ? (p) => onOpenScopedEdit(p)
                      : undefined}
                    onHeaderDoubleClick={headerDoubleClickPayload[k]
                      ? () => onOpenScopedEdit(headerDoubleClickPayload[k]!)
                      : undefined}
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
  initialDrillTarget,
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

  // Mode C drill state — optionally pre-seeded from a compact canvas click
  const [drillTarget, setDrillTarget] = React.useState<DrillTarget | null>(initialDrillTarget ?? null);

  // Single effect handles both reset and seed cases:
  // - When component or window changes, reset to initialDrillTarget (or null if none).
  // - When initialDrillTarget itself changes (dimension/practice click), adopt new value immediately.
  // Skip first render so the initial state value survives mount.
  const drillResetMounted = useRef(false);
  useEffect(() => {
    if (!drillResetMounted.current) { drillResetMounted.current = true; return; }
    setDrillTarget(initialDrillTarget ?? null);
  }, [comp?.nodeId, selectedDataWindow, initialDrillTarget]);

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

  const handleDrill = useCallback((target: DrillTarget) => {
    setDrillTarget(target);
  }, []);

  const handleDimensionClick = useCallback((key: DimensionKey) => {
    setDrillTarget({ kind: "dimension", dimensionKey: key });
  }, []);

  // Translate a compact drill event into a working-space edit payload for double-click-to-edit
  const handleDoubleClickItem = useCallback((e: import("./ring-data-preview-window").CompactDrillEvent) => {
    let payload: RingScopedEditPayload;
    if (e.kind === "leap") {
      payload = { tab: "designed-experience", deNav: { view: "leapDetail", label: e.label }, openSubId: null, initialSubId: null };
    } else if (e.kind === "outcome") {
      payload = { tab: "designed-experience", deNav: { view: "outcomeDetail", l2: e.label }, openSubId: null, initialSubId: null };
    } else if (e.kind === "subcomponent") {
      const subs = getSubcomponents(comp);
      const found = subs.find((s) => s.name === e.name);
      payload = found?.isAdult
        ? { tab: "designed-experience", deNav: { view: "adultSubManage", subId: found.id }, openSubId: null, initialSubId: null }
        : { tab: "designed-experience", deNav: null, openSubId: found?.id ?? null, initialSubId: found?.id ?? null };
    } else if (e.kind === "practice" || e.kind === "tool") {
      payload = { tab: "designed-experience", deNav: { view: "designElement", elementId: e.item.elementId }, openSubId: e.item.bucketCompositeKey, initialSubId: e.item.bucketCompositeKey };
    } else {
      return;
    }
    onOpenScopedEdit(payload);
  }, [comp, onOpenScopedEdit]);

  const handleDrillBack = useCallback(() => {
    setDrillTarget(null);
  }, []);

  const returnToComponent = onSwitchToComponent ? () => { setDrillTarget(null); onSwitchToComponent(); } : undefined;

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
              onClick={() => { setDrillTarget(null); onSwitchToComponent(); }}
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
            title="Edit component — Snapshot"
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
          <NavArrow direction="prev" ringNodes={ringNodes} currentIndex={currentIndex} onNavigate={(n) => { setDrillTarget(null); onNavigate(n); }} />

          <div style={{ width: 220, height: 220, flexShrink: 0 }}>
            <OctagonCard
              title={title}
              subtitle={subtitle}
              centerVariant="dataPreview"
              dataPreviewContent={
                <RingDataPreviewWindow
                  comp={comp}
                  selectedWindow={selectedDataWindow}
                  onWindowChange={(w) => { setDrillTarget(null); onDataWindowChange(w); }}
                  onDrill={handleDrill}
                  onDoubleClickItem={handleDoubleClickItem}
                  onDimensionClick={handleDimensionClick}
                  onDoubleClickToEdit={() => onOpenScopedEdit(scopedGetterRef.current())}
                />
              }
              bgClassName={bgClassName}
              leftStat={{ label: "Learning & Adv.", value: laStr, score: typeof laRaw === "number" ? laRaw : null }}
              rightStat={{ label: "Wellbeing", value: wcStr, score: typeof wcRaw === "number" ? wcRaw : null }}
              onLeftStatClick={() => handleDimensionClick("learningAdvancement")}
              onRightStatClick={() => handleDimensionClick("wellbeingConduct")}
            />
          </div>

          <NavArrow direction="next" ringNodes={ringNodes} currentIndex={currentIndex} onNavigate={(n) => { setDrillTarget(null); onNavigate(n); }} />
        </div>

        {/* Enlarged window content or drill view */}
        <div className="w-full px-5 pb-4 flex-1 min-h-0 flex flex-col">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
            {drillTarget ? (
              // ── Mode C: drill view ──
              drillTarget.kind === "leap" ? (
                <LeapDrillView
                  comp={comp}
                  leapLabel={drillTarget.label}
                  onBack={handleDrillBack}
                  onReturnToComponent={returnToComponent}
                  onOpenScopedEdit={onOpenScopedEdit}
                />
              ) : drillTarget.kind === "outcome" ? (
                <OutcomeDrillView
                  comp={comp}
                  outcomeLabel={drillTarget.label}
                  onBack={handleDrillBack}
                  onReturnToComponent={returnToComponent}
                  onOpenScopedEdit={onOpenScopedEdit}
                />
              ) : drillTarget.kind === "subcomponent" ? (
                <SubcomponentDrillView
                  comp={comp}
                  subName={drillTarget.name}
                  onBack={handleDrillBack}
                  onReturnToComponent={returnToComponent}
                  onOpenScopedEdit={onOpenScopedEdit}
                />
              ) : (drillTarget.kind === "practice" || drillTarget.kind === "tool") ? (
                <PracticeToolDrillView
                  comp={comp}
                  item={drillTarget.item}
                  onBack={handleDrillBack}
                  onReturnToComponent={returnToComponent}
                  onOpenScopedEdit={onOpenScopedEdit}
                />
              ) : drillTarget.kind === "dimension" ? (
                <DimensionDrillView
                  comp={comp}
                  dimensionKey={drillTarget.dimensionKey}
                  onBack={handleDrillBack}
                  onReturnToComponent={returnToComponent}
                  onOpenScopedEdit={onOpenScopedEdit}
                />
              ) : null
            ) : (
              // ── Mode B: enlarged window ──
              <>
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
                  <EnlargedWindowContent
                    comp={comp}
                    windowKey={selectedDataWindow}
                    bindScopedEdit={bindScopedEdit}
                    onDrill={handleDrill}
                  />
                </div>
              </>
            )}
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
