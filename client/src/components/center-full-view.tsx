/**
 * CenterFullView — side-by-side full-view panel for the overall (center) card.
 * Supports both Designed Experience (DE) and Journey & Overview (J&O) modes.
 */

import React, { useMemo, useState } from "react";
import { X, ChevronRight, ChevronDown, Home, Pencil, Star, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_ELEMENTS } from "@/components/expert-view/expert-view-schema";
import type {
  BucketDef,
  BucketValue,
  ElementDef,
  QuestionDef,
  TagDef,
  YearlyScheduleValue,
  MarkingPeriodsValue,
} from "@/components/expert-view/expert-view-types";
import {
  bucketKey,
  buildDesignElementHexIndex,
  resolveTagLabel,
  resolveSecLabel,
} from "@/lib/designed-experience-preview";
import type {
  DesignedExperienceCardRoute,
  DesignedExperiencePreview,
  DESubView,
  DesignElementKey,
  HighlightProps,
  OutcomeCategoryKey,
  OutcomeRow,
  LeapOrPrincipleRow,
  AdultRoleSummary,
  AdultBucketKey,
} from "@/components/designed-experience-card-content";
import { titleForDesignedRoute, DesignedExperienceCardContent } from "@/components/designed-experience-card-content";
import type {
  JourneyOverviewCardRoute,
  JourneyOverviewPreview,
  OverallNavTarget,
  ContextOverviewL4,
  PublicAcademicL4,
  StakeholderL4,
} from "@/components/journey-overview-card-content";
import {
  titleForJourneyRoute,
  workspaceTargetForRoute,
  JourneyOverviewCardContent,
} from "@/components/journey-overview-card-content";
import { COMMUNITY_REVIEWS_MOCK, type CommunityReview } from "@/components/community-reviews-view";
import {
  LEAP_DESCRIPTIONS,
  OUTCOME_DESCRIPTIONS,
} from "@/components/designed-experience-schemas";

// ─── Slot type (exported) ─────────────────────────────────────────────────────

export type CenterFullViewSlot =
  | { kind: "home" }
  | { kind: "status" }
  | { kind: "designed"; route: DesignedExperienceCardRoute }
  | { kind: "overview"; route: JourneyOverviewCardRoute };

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CenterFullViewProps {
  slot: CenterFullViewSlot;
  onNavigate: (slot: CenterFullViewSlot) => void;
  onClose: () => void;
  dePreview: DesignedExperiencePreview;
  joPreview?: JourneyOverviewPreview;
  rawOverallComp: any;
  ringComps: any[];
  ringHighlightSourceKey: string | null;
  onPinRingHighlight: (sourceKey: string, nodeIds: string[]) => void;
  onOpenWorkingSpace: (target: DESubView) => void;
  onOpenJOWorkingSpace: (target: OverallNavTarget) => void;
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function HexBadge({
  count,
  sourceKey,
  nodeIds,
  highlight,
}: {
  count: number;
  sourceKey?: string;
  nodeIds?: string[];
  highlight?: HighlightProps;
}) {
  const isInteractive =
    count > 0 && !!sourceKey && !!highlight && (nodeIds?.length ?? 0) > 0;
  const isActive = isInteractive && highlight!.activeSourceKey === sourceKey;
  const stroke = count === 0 ? "#fb923c" : isActive ? "#2563eb" : "#94a3b8";
  const fill = count === 0 ? "#fff7ed" : isActive ? "#3b82f6" : "#f1f5f9";
  const textColor = count === 0 ? "#9a3412" : isActive ? "#ffffff" : "#334155";
  const inner = (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        isActive && "ring-2 ring-blue-400 ring-offset-1 rounded-full",
      )}
      style={{ width: 18, height: 20 }}
    >
      <svg viewBox="0 0 24 28" width="18" height="20" aria-hidden>
        <polygon points="12,1 22,7 22,21 12,27 2,21 2,7" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <text x="12" y="18" textAnchor="middle" fontSize="10" fontWeight="700" fill={textColor} fontFamily="ui-sans-serif, system-ui, sans-serif">
          {count}
        </text>
      </svg>
    </span>
  );
  if (!isInteractive) return <span className="inline-flex items-center justify-center shrink-0">{inner}</span>;
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center shrink-0 rounded focus:outline-none"
      onClick={(e) => { e.stopPropagation(); highlight!.onPin(sourceKey!, nodeIds!); }}
      title={`${isActive ? "Clear" : "Highlight"} ${count} ring component${count === 1 ? "" : "s"}`}
      aria-pressed={isActive}
    >
      {inner}
    </button>
  );
}

function PriorityChip({ priority }: { priority: string | null }) {
  if (!priority || priority === "Absent") return null;
  const map: Record<string, string> = {
    H: "bg-red-100 text-red-700 border-red-200",
    M: "bg-amber-100 text-amber-700 border-amber-200",
    L: "bg-green-100 text-green-700 border-green-200",
    High: "bg-red-100 text-red-700 border-red-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-green-100 text-green-700 border-green-200",
  };
  const label: Record<string, string> = { H: "High", M: "Med", L: "Low", High: "High", Medium: "Med", Low: "Low" };
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0", map[priority] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
      {label[priority] ?? priority}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">
      {status}
    </span>
  );
}

/** Reusable 320×255 mini-card used in hub grid views. */
function MiniCard({
  title,
  onClick,
  children,
  accentColor = "blue",
}: {
  title: string;
  onClick?: () => void;
  children?: React.ReactNode;
  accentColor?: "blue" | "purple" | "emerald" | "amber";
}) {
  const borderActive: Record<string, string> = {
    blue: "hover:border-blue-400",
    purple: "hover:border-purple-400",
    emerald: "hover:border-emerald-400",
    amber: "hover:border-amber-400",
  };
  const arrowColor: Record<string, string> = {
    blue: "text-blue-500",
    purple: "text-purple-500",
    emerald: "text-emerald-500",
    amber: "text-amber-600",
  };
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={cn(
        "w-[320px] h-[255px] rounded-xl border-2 border-gray-200 bg-white shadow-md",
        "flex flex-col px-4 pt-3 pb-3 transition-all",
        onClick && `cursor-pointer hover:shadow-lg ${borderActive[accentColor]}`,
        !onClick && "cursor-default",
      )}
    >
      <div className="text-[13px] font-bold text-gray-800 mb-2 truncate">{title}</div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {onClick && (
        <div className="mt-2 text-right">
          <span className={cn("text-[10px] font-semibold", arrowColor[accentColor])}>View full detail →</span>
        </div>
      )}
    </div>
  );
}

function MiniCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex flex-wrap gap-4 justify-start">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-[11px] text-gray-400 italic">{text}</p>;
}

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <div key={i} className="relative h-3 w-3 shrink-0">
            <Star className="absolute inset-0 h-3 w-3 text-gray-300" strokeWidth={1.5} fill="currentColor" />
            <div className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>
              <Star className="h-3 w-3 shrink-0" strokeWidth={0} fill="currentColor" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotVerifiedBadge() {
  return (
    <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
      Not verified
    </span>
  );
}

/** Full-view hub list row — mirrors the card's ListRow at full-panel width. */
function FVListRow({
  label,
  onClick,
  leftAdornment,
  rightAdornment,
  first = false,
}: {
  label: string;
  onClick?: () => void;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "px-4 py-2.5 flex items-center gap-2",
        !first && "border-t border-gray-100",
        onClick && "cursor-pointer hover:bg-gray-50 active:bg-gray-100",
        !onClick && "cursor-default",
      )}
    >
      {leftAdornment && <div className="shrink-0 flex items-center gap-1.5">{leftAdornment}</div>}
      <span className={cn(
        "text-[12px] font-semibold flex-1 min-w-0 truncate",
        onClick ? "text-blue-700" : "text-gray-600",
      )}>
        {label}
      </span>
      {rightAdornment && <div className="shrink-0 flex items-center gap-1.5">{rightAdornment}</div>}
    </div>
  );
}

/** Small grey count badge for FVListRow right adornments. */
function CountBadge({ n }: { n: number }) {
  return (
    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded tabular-nums">{n}</span>
  );
}

/** Even-smaller count badge for use inside MiniCards. */
function SmallCountBadge({ n }: { n: number }) {
  return (
    <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded tabular-nums">{n}</span>
  );
}

/** Compact list row for inside 320×255 MiniCards. */
function CardListRow({
  label,
  onClick,
  rightAdornment,
  first = false,
}: {
  label: string;
  onClick?: () => void;
  rightAdornment?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "flex items-center gap-1 py-1 text-[11px]",
        !first && "border-t border-gray-100",
        onClick && "cursor-pointer hover:bg-gray-50 -mx-0.5 px-0.5 rounded",
      )}
    >
      <span className={cn("font-semibold flex-1 min-w-0 truncate", onClick ? "text-blue-700" : "text-gray-600")}>
        {label}
      </span>
      {rightAdornment && <div className="shrink-0 flex items-center gap-1">{rightAdornment}</div>}
    </div>
  );
}

/** Lightweight octagon tile for Student Experience group views. */
const OCTAGON_COLORS: [string, string][] = [
  ["#ede9fe", "#5b21b6"],
  ["#dbeafe", "#1e40af"],
  ["#d1fae5", "#065f46"],
  ["#fef3c7", "#92400e"],
  ["#fce7f3", "#9d174d"],
  ["#ccfbf1", "#0f766e"],
  ["#e0e7ff", "#3730a3"],
  ["#ffedd5", "#c2410c"],
];

function OctagonTile({
  nodeId,
  title,
  colorIndex,
  highlight,
}: {
  nodeId: string;
  title: string;
  colorIndex: number;
  highlight: HighlightProps;
}) {
  const [bg, text] = OCTAGON_COLORS[colorIndex % OCTAGON_COLORS.length];
  const isActive = highlight.activeSourceKey === `se-comp:${nodeId}`;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); highlight.onPin(`se-comp:${nodeId}`, [nodeId]); }}
      aria-pressed={isActive}
      className="relative focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 shrink-0"
      title={`${title} — click to highlight`}
      style={{ width: 112, height: 112 }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center p-3 transition-colors"
        style={{
          clipPath: "polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%)",
          backgroundColor: isActive ? "#3b82f6" : bg,
        }}
      >
        <span
          className="text-[10px] font-bold text-center leading-snug"
          style={{
            color: isActive ? "#ffffff" : text,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}
        >
          {title}
        </span>
      </div>
    </button>
  );
}

function categoryDisplayLabel(cat: OutcomeCategoryKey): string {
  return cat === "Conduct & Engagement" ? "Engagement" : cat;
}

/** Format an ISO date string (YYYY-MM-DD) as e.g. "Aug 25, 2026". */
function fmtCalendarDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface CalendarSummaryData {
  schoolYear: { start: string | null; end: string | null } | null;
  periodTypeLabel: string | null;
  periods: Array<{ name: string; start: string | null; end: string | null }>;
  /** True when no calendar info has been entered yet. */
  empty: boolean;
}

/** Build a structured calendar summary for the full view (School year + per-period rows). */
function buildCalendarSummary(yearly: YearlyScheduleValue, marking: MarkingPeriodsValue): CalendarSummaryData {
  const entries = yearly.entries ?? [];
  const yearEntry = entries.find((e) => /school.?year|academic.?year/i.test(e.label));
  const yearStart = yearEntry?.startDate ? fmtCalendarDate(yearEntry.startDate) : null;
  const yearEnd = yearEntry?.endDate ? fmtCalendarDate(yearEntry.endDate) : null;
  const schoolYear = yearStart || yearEnd ? { start: yearStart, end: yearEnd } : null;

  const periodType = marking.periodType;
  const periodTypeLabel = periodType
    ? periodType.charAt(0).toUpperCase() + periodType.slice(1)
    : null;

  const periodList = (marking.periods ?? []).map((p) => ({
    name: p.name || "",
    start: p.startDate ? fmtCalendarDate(p.startDate) : null,
    end: p.endDate ? fmtCalendarDate(p.endDate) : null,
  }));

  const empty = !schoolYear && !periodTypeLabel && periodList.length === 0;
  return { schoolYear, periodTypeLabel, periods: periodList, empty };
}

/** Structured calendar block: School Year line + period list. */
function CalendarSummaryBlock({ summary }: { summary: CalendarSummaryData }) {
  if (summary.empty) return null;
  const { schoolYear, periodTypeLabel, periods } = summary;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100/60 border-b border-amber-200">
        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">School Calendar</span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {schoolYear ? (
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide w-[78px] shrink-0">School Year</span>
            <span className="text-[12px] font-medium text-amber-900">
              {schoolYear.start && schoolYear.end
                ? `${schoolYear.start} – ${schoolYear.end}`
                : schoolYear.start
                ? `Starts ${schoolYear.start}`
                : `Ends ${schoolYear.end}`}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide w-[78px] shrink-0">School Year</span>
            <span className="text-[11px] italic text-amber-700/70">No dates entered</span>
          </div>
        )}

        {periodTypeLabel && (
          <div className="pt-1 border-t border-amber-200/60">
            <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
              {periodTypeLabel}{periods.length === 1 ? "" : "s"}
            </div>
            {periods.length === 0 ? (
              <p className="text-[11px] italic text-amber-700/70 ml-1">No {periodTypeLabel.toLowerCase()}s defined</p>
            ) : (
              <ul className="space-y-0.5 ml-1">
                {periods.map((p, i) => {
                  const range = p.start && p.end
                    ? `${p.start} – ${p.end}`
                    : p.start
                    ? `Starts ${p.start}`
                    : p.end
                    ? `Ends ${p.end}`
                    : null;
                  return (
                    <li key={i} className="flex items-baseline gap-2 text-[12px] text-amber-900">
                      <span className="text-amber-500">•</span>
                      <span className="font-semibold">{p.name || `${periodTypeLabel} ${i + 1}`}</span>
                      {range ? (
                        <span className="text-amber-800">{range}</span>
                      ) : (
                        <span className="italic text-amber-700/70 text-[11px]">No dates entered</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DE Breadcrumb helpers ────────────────────────────────────────────────────

type DECrumb = { label: string; route: DesignedExperienceCardRoute };

const DE_L2_LABELS: Record<string, string> = {
  students: "Students",
  targetedImpact: "Targeted Impact",
  studentExperiences: "Student Experiences",
  designElements: "Design Elements",
  adults: "Adults & Adult Experiences",
};

const DE_TI_L3_LABELS: Record<string, string> = {
  "targetedImpact.learningAdvancement": "Learning & Advancement Outcomes",
  "targetedImpact.wellbeingConduct": "Wellbeing & Conduct Outcomes",
  "targetedImpact.portrait": "Portrait of a Graduate",
  "targetedImpact.leaps": "Leaps & Design Principles",
  "targetedImpact.community": "Community & Ecosystem Outcomes",
};

function buildDEBreadcrumbs(
  route: DesignedExperienceCardRoute,
  preview: DesignedExperiencePreview,
): DECrumb[] {
  const L1: DECrumb = { label: "Designed Experience", route: { level: "L1" } };
  if (route.level === "L1") return [L1];

  if (route.level === "L2") {
    const label = "section" in route ? DE_L2_LABELS[route.section] ?? route.section : "Section";
    return [L1, { label, route }];
  }

  if (route.level === "L3") {
    if ("section" in route) {
      const l2: DECrumb = { label: "Targeted Impact", route: { level: "L2", section: "targetedImpact" } };
      const label = DE_TI_L3_LABELS[route.section] ?? route.section;
      return [L1, l2, { label, route }];
    }
    if (route.kind === "designElement") {
      const l2: DECrumb = { label: "Design Elements", route: { level: "L2", section: "designElements" } };
      const el = preview.designElements.find((e) => e.id === route.element);
      return [L1, l2, { label: el?.title ?? route.element, route }];
    }
    if (route.kind === "outcomeCategory") {
      const isWellbeing = ["Wellbeing", "Conduct & Engagement"].includes(route.category);
      const l2: DECrumb = { label: "Targeted Impact", route: { level: "L2", section: "targetedImpact" } };
      const l3Section: DesignedExperienceCardRoute = {
        level: "L3",
        section: isWellbeing ? "targetedImpact.wellbeingConduct" : "targetedImpact.learningAdvancement",
      };
      const l3Label = isWellbeing ? "Wellbeing & Conduct Outcomes" : "Learning & Advancement Outcomes";
      const catLabel = categoryDisplayLabel(route.category);
      return [L1, l2, { label: l3Label, route: l3Section }, { label: catLabel, route }];
    }
    if (route.kind === "adultRole") {
      const l2: DECrumb = { label: "Adults & Adult Experiences", route: { level: "L2", section: "adults" } };
      const role = preview.adults.find((a) => a.roleId === route.roleId);
      return [L1, l2, { label: role?.label ?? route.roleId, route }];
    }
    if (route.kind === "studentExperienceGroup") {
      const l2: DECrumb = { label: "Student Experiences", route: { level: "L2", section: "studentExperiences" } };
      return [L1, l2, { label: categoryDisplayLabel(route.category), route }];
    }
    return [L1, { label: titleForDesignedRoute(route, preview), route }];
  }

  if (route.level === "L4") {
    if (route.kind === "portraitAttribute") {
      const l2: DECrumb = { label: "Targeted Impact", route: { level: "L2", section: "targetedImpact" } };
      const l3: DECrumb = { label: "Portrait of a Graduate", route: { level: "L3", section: "targetedImpact.portrait" } };
      const attr = preview.targetedImpact.portrait.attributes.find((a) => a.id === route.attributeId);
      return [L1, l2, l3, { label: attr?.name ?? "Attribute", route }];
    }
    if (route.kind === "communityOutcome") {
      const l2: DECrumb = { label: "Targeted Impact", route: { level: "L2", section: "targetedImpact" } };
      const l3: DECrumb = { label: "Community & Ecosystem Outcomes", route: { level: "L3", section: "targetedImpact.community" } };
      const o = preview.targetedImpact.community.outcomes.find((x) => x.id === route.outcomeId);
      return [L1, l2, l3, { label: o?.label ?? "Outcome", route }];
    }
    if (route.kind === "adultBucket") {
      const l2: DECrumb = { label: "Adults & Adult Experiences", route: { level: "L2", section: "adults" } };
      const role = preview.adults.find((a) => a.roleId === route.roleId);
      return [L1, l2, { label: role?.label ?? route.roleId, route: { level: "L3", kind: "adultRole", roleId: route.roleId } }, { label: titleForDesignedRoute(route, preview), route }];
    }
    if (route.kind === "leapDetail") {
      const l2: DECrumb = { label: "Targeted Impact", route: { level: "L2", section: "targetedImpact" } };
      const l3: DECrumb = { label: "Leaps & Design Principles", route: { level: "L3", section: "targetedImpact.leaps" } };
      return [L1, l2, l3, { label: route.label, route }];
    }
    if (route.kind === "outcomeDetail") {
      const l2: DECrumb = { label: "Targeted Impact", route: { level: "L2", section: "targetedImpact" } };
      const isWellbeing = ["Wellbeing", "Conduct & Engagement"].includes(route.category);
      const l3Route: DesignedExperienceCardRoute = isWellbeing
        ? { level: "L3", section: "targetedImpact.wellbeingConduct" }
        : { level: "L3", section: "targetedImpact.learningAdvancement" };
      const l3Label = isWellbeing ? "Wellbeing & Conduct Outcomes" : "Learning & Advancement Outcomes";
      const l3: DECrumb = { label: l3Label, route: l3Route };
      const catRoute: DesignedExperienceCardRoute = { level: "L3", kind: "outcomeCategory", category: route.category };
      const cat: DECrumb = { label: categoryDisplayLabel(route.category), route: catRoute };
      const allCats = [...preview.targetedImpact.learningAdvancement.categories, ...preview.targetedImpact.wellbeingConduct.categories];
      const outcomeLabel = allCats.flatMap((c) => c.outcomes).find((o) => o.key === route.outcomeKey)?.label ?? route.outcomeKey;
      return [L1, l2, l3, cat, { label: outcomeLabel, route }];
    }
    return [L1, { label: titleForDesignedRoute(route, preview), route }];
  }

  return [L1, { label: titleForDesignedRoute(route, preview), route }];
}

// ─── J&O Breadcrumb helpers ───────────────────────────────────────────────────

type JOCrumb = { label: string; route: JourneyOverviewCardRoute };

function buildJOBreadcrumbs(route: JourneyOverviewCardRoute): JOCrumb[] {
  const L1: JOCrumb = { label: "Journey and Overview", route: { level: "L1" } };
  if (route.level === "L1") return [L1];

  if (route.level === "L2") {
    const label = route.section === "mission" ? "Mission" : "School Overview";
    return [L1, { label, route }];
  }

  const L2: JOCrumb = { label: "School Overview", route: { level: "L2", section: "schoolOverview" } };

  if (route.level === "L3") {
    return [L1, L2, { label: titleForJourneyRoute(route), route }];
  }

  // L4 — find L3 parent
  const s = route.section;
  let l3Route: JourneyOverviewCardRoute;
  let l3Label: string;
  if (s.startsWith("schoolOverview.contextOverview.")) {
    l3Route = { level: "L3", section: "schoolOverview.contextOverview" };
    l3Label = "Context & Overview";
  } else if (s.startsWith("schoolOverview.enrollment.")) {
    l3Route = { level: "L3", section: "schoolOverview.enrollment" };
    l3Label = "Enrollment & Composition";
  } else if (s.startsWith("schoolOverview.publicAcademic.")) {
    l3Route = { level: "L3", section: "schoolOverview.publicAcademic" };
    l3Label = "Public Academic Profile";
  } else {
    l3Route = { level: "L3", section: "schoolOverview.stakeholderMap" };
    l3Label = "Stakeholder Map";
  }
  const L3: JOCrumb = { label: l3Label, route: l3Route };
  return [L1, L2, L3, { label: titleForJourneyRoute(route), route }];
}

// ─── Breadcrumb sibling dropdowns ─────────────────────────────────────────────
//
// `getSiblingsForSlot` returns the list of sibling slots for a breadcrumb
// pointing at `slot` (so the user can quickly hop between peers at the same
// level). The current slot is included in the returned list. Cross-section
// jumps always reset to that section's L1 — they never preserve depth from the
// prior section.

const SECTION_SIBLINGS: ReadonlyArray<{ label: string; slot: CenterFullViewSlot }> = [
  { label: "Designed Experience", slot: { kind: "designed", route: { level: "L1" } } },
  { label: "Journey and Overview", slot: { kind: "overview", route: { level: "L1" } } },
  { label: "Performance & Status", slot: { kind: "status" } },
];

const DE_TI_L3_ORDER: Array<{ key: string; label: string }> = [
  { key: "targetedImpact.learningAdvancement", label: "Learning & Advancement Outcomes" },
  { key: "targetedImpact.wellbeingConduct", label: "Wellbeing & Conduct Outcomes" },
  { key: "targetedImpact.portrait", label: "Portrait of a Graduate" },
  { key: "targetedImpact.leaps", label: "Leaps & Design Principles" },
  { key: "targetedImpact.community", label: "Community & Ecosystem Outcomes" },
];

const ADULT_BUCKET_ORDER: Array<{ key: AdultBucketKey; label: string }> = [
  { key: "experiences", label: "Experiences" },
  { key: "demographic", label: "Demographic & Situational Variables" },
  { key: "incomingSkills", label: "Incoming Skills & Mindsets" },
  { key: "background", label: "Adult Background" },
  { key: "staffing", label: "Approach to Staffing" },
];

function getSiblingsForSlot(
  slot: CenterFullViewSlot,
  dePreview: DesignedExperiencePreview,
  joPreview: JourneyOverviewPreview | undefined,
): Array<{ label: string; slot: CenterFullViewSlot }> {
  // Top-level: any L1 / status / home crumb shows the section selector.
  if (slot.kind === "status") return SECTION_SIBLINGS.slice();
  if (slot.kind === "home") return SECTION_SIBLINGS.slice();
  if (slot.kind === "designed" && slot.route.level === "L1") return SECTION_SIBLINGS.slice();
  if (slot.kind === "overview" && slot.route.level === "L1") {
    return joPreview ? SECTION_SIBLINGS.slice() : SECTION_SIBLINGS.filter((s) => s.slot.kind !== "overview");
  }

  if (slot.kind === "designed") {
    const r = slot.route;
    if (r.level === "L2" && "section" in r) {
      return Object.entries(DE_L2_LABELS).map(([section, label]) => ({
        label,
        slot: { kind: "designed", route: { level: "L2", section: section as any } } as CenterFullViewSlot,
      }));
    }
    if (r.level === "L3") {
      if ("section" in r) {
        // Targeted Impact L3
        return DE_TI_L3_ORDER.map(({ key, label }) => ({
          label,
          slot: { kind: "designed", route: { level: "L3", section: key as any } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "designElement") {
        return dePreview.designElements.map((e) => ({
          label: e.title,
          slot: { kind: "designed", route: { level: "L3", kind: "designElement", element: e.id } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "outcomeCategory") {
        const isWellbeing = ["Wellbeing", "Conduct & Engagement"].includes(r.category);
        const cats = isWellbeing
          ? dePreview.targetedImpact.wellbeingConduct.categories
          : dePreview.targetedImpact.learningAdvancement.categories;
        return cats.map((c) => ({
          label: categoryDisplayLabel(c.category),
          slot: { kind: "designed", route: { level: "L3", kind: "outcomeCategory", category: c.category } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "adultRole") {
        return dePreview.adults.map((a) => ({
          label: a.label,
          slot: { kind: "designed", route: { level: "L3", kind: "adultRole", roleId: a.roleId } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "studentExperienceGroup") {
        return dePreview.studentExperiences.map((g) => ({
          label: categoryDisplayLabel(g.category),
          slot: { kind: "designed", route: { level: "L3", kind: "studentExperienceGroup", category: g.category } } as CenterFullViewSlot,
        }));
      }
    }
    if (r.level === "L4") {
      if (r.kind === "portraitAttribute") {
        return dePreview.targetedImpact.portrait.attributes.map((a) => ({
          label: a.name,
          slot: { kind: "designed", route: { level: "L4", kind: "portraitAttribute", attributeId: a.id } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "communityOutcome") {
        return dePreview.targetedImpact.community.outcomes.map((o) => ({
          label: o.label,
          slot: { kind: "designed", route: { level: "L4", kind: "communityOutcome", outcomeId: o.id } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "adultBucket") {
        const roleId = r.roleId;
        return ADULT_BUCKET_ORDER.map(({ key, label }) => ({
          label,
          slot: { kind: "designed", route: { level: "L4", kind: "adultBucket", roleId, bucket: key } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "leapDetail") {
        return dePreview.targetedImpact.leaps.rows.map((row) => ({
          label: row.label,
          slot: { kind: "designed", route: { level: "L4", kind: "leapDetail", label: row.label } } as CenterFullViewSlot,
        }));
      }
      if (r.kind === "outcomeDetail") {
        const cat = r.category;
        const cats = [...dePreview.targetedImpact.learningAdvancement.categories, ...dePreview.targetedImpact.wellbeingConduct.categories];
        const sameCat = cats.find((c) => c.category === cat);
        if (!sameCat) return [];
        return sameCat.outcomes.map((o) => ({
          label: o.label,
          slot: { kind: "designed", route: { level: "L4", kind: "outcomeDetail", outcomeKey: o.key, category: cat } } as CenterFullViewSlot,
        }));
      }
    }
  }

  if (slot.kind === "overview") {
    const r = slot.route;
    if (r.level === "L2") {
      return [
        { label: "Mission", slot: { kind: "overview", route: { level: "L2", section: "mission" } } as CenterFullViewSlot },
        { label: "School Overview", slot: { kind: "overview", route: { level: "L2", section: "schoolOverview" } } as CenterFullViewSlot },
      ];
    }
    if (r.level === "L3") {
      const L3s: Array<{ key: string; label: string }> = [
        { key: "schoolOverview.contextOverview", label: "Context & Overview" },
        { key: "schoolOverview.enrollment", label: "Enrollment & Composition" },
        { key: "schoolOverview.publicAcademic", label: "Public Academic Profile" },
        { key: "schoolOverview.communityReviews", label: "Community Reviews" },
        { key: "schoolOverview.stakeholderMap", label: "Stakeholder Map" },
      ];
      return L3s.map(({ key, label }) => ({
        label,
        slot: { kind: "overview", route: { level: "L3", section: key as any } } as CenterFullViewSlot,
      }));
    }
    // L4 siblings within the same L3 parent are heterogeneous; skip dropdown.
    return [];
  }

  return [];
}

/** True when two slots refer to the same place (used to mark current sibling). */
function slotsEqual(a: CenterFullViewSlot, b: CenterFullViewSlot): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "home" || a.kind === "status") return true;
  return JSON.stringify((a as any).route) === JSON.stringify((b as any).route);
}

// ─── DE: Row types + extraction logic ────────────────────────────────────────

interface FullViewRowData {
  label: string;
  isKey: boolean;
  isRingOnly: boolean;
  hexCount: number;
  hexIds: string[];
  isTagType: boolean;
}

function getQuestionData(
  elementData: Record<string, BucketValue>,
  questionId: string,
): Record<string, BucketValue> {
  const result: Record<string, BucketValue> = {};
  const prefix = `${questionId}__`;
  for (const [k, v] of Object.entries(elementData)) {
    if (k.startsWith(prefix)) {
      result[k.slice(prefix.length)] = v as BucketValue;
    }
  }
  return result;
}

function extractFullBucketRows(
  bucket: BucketDef,
  questionData: Record<string, BucketValue>,
  hexIndex: Map<string, Set<string>>,
  elementId: string,
  questionId: string,
  showOnlyKey: boolean,
): FullViewRowData[] {
  const bv: BucketValue = questionData[bucket.id] ?? {};
  const hexPrefix = `${elementId}::${bucketKey(questionId, bucket.id)}::`;

  function hexFor(tagId: string): { hexCount: number; hexIds: string[] } {
    const s = hexIndex.get(hexPrefix + tagId);
    return s ? { hexCount: s.size, hexIds: Array.from(s) } : { hexCount: 0, hexIds: [] };
  }

  const effectiveTags: TagDef[] | undefined =
    bucket.tags ?? (bucket.disciplineGroups ? bucket.disciplineGroups.flatMap((g) => g.tags) : undefined);

  const rows: FullViewRowData[] = [];

  if (bucket.ringOnly) {
    const allTagIds = new Set<string>();
    Array.from(hexIndex.keys()).forEach((k) => {
      if (k.startsWith(hexPrefix)) {
        const tagId = k.slice(hexPrefix.length);
        if (tagId && tagId !== "__value__") allTagIds.add(tagId);
      }
    });
    Array.from(allTagIds).forEach((tagId) => {
      const hex = hexFor(tagId);
      if (hex.hexCount === 0) return;
      const label = resolveTagLabel(tagId, false, undefined, effectiveTags);
      rows.push({ label, isKey: false, isRingOnly: true, ...hex, isTagType: true });
    });
    const valueHex = hexIndex.get(hexPrefix + "__value__");
    if (valueHex && valueHex.size > 0) {
      rows.push({ label: bucket.title, isKey: false, isRingOnly: true, hexCount: valueHex.size, hexIds: Array.from(valueHex), isTagType: false });
    }
    return rows;
  }

  if (bv.archetypeA1) {
    for (const sel of bv.archetypeA1.selections ?? []) {
      if (showOnlyKey && !sel.isKey) continue;
      const primaryTag = effectiveTags?.find((t) => t.id === sel.tagId);
      const primaryLabel = resolveTagLabel(sel.tagId, sel.isCustom, sel.customLabel, effectiveTags);
      const selectedSecs = sel.selectedSecondaries ?? [];
      const hex = hexFor(sel.tagId);
      if (selectedSecs.length > 0) {
        if (bucket.groupedSecondaryDisplay) {
          const secLabels = selectedSecs.map((s) => resolveSecLabel(s.tagId, primaryTag));
          const label = `${primaryLabel} (${secLabels.join(", ")})`;
          rows.push({ label, isKey: sel.isKey, isRingOnly: false, ...hex, isTagType: true });
        } else {
          for (const sec of selectedSecs) {
            if (showOnlyKey && !sec.isKey) continue;
            const secLabel = resolveSecLabel(sec.tagId, primaryTag);
            rows.push({ label: secLabel, isKey: sec.isKey, isRingOnly: false, ...hexFor(sec.tagId), isTagType: true });
          }
        }
      } else {
        rows.push({ label: primaryLabel, isKey: sel.isKey, isRingOnly: false, ...hex, isTagType: true });
      }
    }
  } else if (bv.archetypeA2) {
    const a2 = bv.archetypeA2;
    if (a2.selectedId && (!showOnlyKey || a2.isKey)) {
      const label = resolveTagLabel(a2.selectedId, a2.isCustom, a2.customLabel, effectiveTags);
      rows.push({ label, isKey: a2.isKey ?? false, isRingOnly: false, ...hexFor(a2.selectedId), isTagType: true });
    }
  } else if (bv.archetypeA3) {
    const a3 = bv.archetypeA3;
    if (!showOnlyKey || a3.isKey) {
      const label = a3.description?.trim() || bucket.title;
      if (label) {
        rows.push({ label, isKey: a3.isKey ?? false, isRingOnly: false, hexCount: 0, hexIds: [], isTagType: false });
      }
    }
  } else if (bv.archetypeA5) {
    const a5 = bv.archetypeA5;
    if (a5.text?.trim() && (!showOnlyKey || a5.isKey)) {
      rows.push({ label: a5.text.trim(), isKey: a5.isKey ?? false, isRingOnly: false, hexCount: 0, hexIds: [], isTagType: false });
    }
  }

  return rows;
}

// ─── FullViewRowItem ──────────────────────────────────────────────────────────

function FullViewRowItem({
  row,
  highlight,
  sourceKey,
}: {
  row: FullViewRowData;
  highlight?: HighlightProps;
  sourceKey?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {row.isTagType ? (
        <HexBadge count={row.hexCount} sourceKey={sourceKey} nodeIds={row.hexIds} highlight={highlight} />
      ) : (
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-px" />
      )}
      <span className="text-[11px] text-gray-800 flex-1 min-w-0 leading-snug">
        {row.label}
      </span>
      {row.isKey && !row.isRingOnly && (
        <span className="text-amber-500 text-[9px] shrink-0">★</span>
      )}
      {row.isRingOnly && (
        <span className="text-[9px] text-blue-400 shrink-0 font-medium">roll-up</span>
      )}
    </div>
  );
}

// ─── DE: Design Element full view ─────────────────────────────────────────────

function DesignElementFullView({
  elementId,
  elementData,
  hexIndex,
  highlight,
  showAll,
  onEditClick,
}: {
  elementId: DesignElementKey;
  elementData: Record<string, BucketValue>;
  hexIndex: Map<string, Set<string>>;
  highlight: HighlightProps;
  showAll: boolean;
  onEditClick: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"practices" | "tools">("practices");
  const el: ElementDef | undefined = ALL_ELEMENTS.find((e) => e.id === elementId);

  if (!el) {
    return <div className="flex items-center justify-center h-full text-[12px] text-gray-400 italic">Element not found.</div>;
  }

  const showOnlyKey = !showAll;

  const tabQuestions = (targetTab: "practices" | "tools"): QuestionDef[] =>
    el.questions.filter((q) => q.section === targetTab);

  // Pull school calendar data (stored outside regular bucket keys)
  const yearlyScheduleValue: YearlyScheduleValue =
    (elementData["schedule-q2__yearly-schedule"] as any)?.yearlySchedule ?? { entries: [] };
  const markingPeriodsValue: MarkingPeriodsValue =
    (elementData["schedule-q2__marking-periods"] as any)?.markingPeriods ?? { periodType: null, periods: [] };

  const renderQuestion = (q: QuestionDef) => {
    const questionData = getQuestionData(elementData, q.id);
    // Plain language answer is stored as { plainLanguageAnswer: string } on the __plain__ key
    const plainAnswer = questionData["__plain__"]?.plainLanguageAnswer?.trim() ?? "";

    // Visible buckets — skip hideAtCenter ones in the full view
    const visibleBuckets = q.buckets.filter((b) => !b.hideAtCenter);

    // Always include every visible bucket — empty ones render with "No data".
    const bucketItems = visibleBuckets.map((bucket) => ({
      bucket,
      rows: extractFullBucketRows(bucket, questionData, hexIndex, elementId, q.id, showOnlyKey),
    }));

    // For schedule Q2 (school day layout), also inject the structured calendar block
    const calendarSummary =
      elementId === "schedule" && q.id === "schedule-q2"
        ? buildCalendarSummary(yearlyScheduleValue, markingPeriodsValue)
        : null;
    const hasCalendar = !!calendarSummary && !calendarSummary.empty;

    // If the question has no visible buckets at all and no plain/calendar content, skip it.
    if (visibleBuckets.length === 0 && !plainAnswer && !hasCalendar) return null;

    return (
      <div key={q.id} className="space-y-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
        {/* Question prompt — prominent styling */}
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-block w-1 h-4 rounded-sm bg-blue-500 shrink-0" />
          <p className="text-[13px] font-bold text-gray-800 leading-snug">
            {q.question}
          </p>
        </div>
        {/* Plain language answer */}
        {plainAnswer && (
          <p className="text-[12px] text-gray-700 italic leading-relaxed bg-blue-50 border border-blue-100 rounded px-3 py-2">
            {plainAnswer}
          </p>
        )}
        {/* Structured calendar block for schedule Q2 */}
        {hasCalendar && <CalendarSummaryBlock summary={calendarSummary!} />}
        {/* Bucket rows */}
        {bucketItems.map(({ bucket, rows }) => (
          <div key={bucket.id} className="space-y-1 pl-2 border-l-2 border-gray-100">
            <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {bucket.title}
            </div>
            {rows.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic">No data</p>
            ) : (
              rows.map((row, i) => (
                <FullViewRowItem
                  key={i}
                  row={row}
                  highlight={highlight}
                  sourceKey={`de-el:${elementId}::${bucketKey(q.id, bucket.id)}::${row.label}`}
                />
              ))
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="shrink-0 flex border-b border-gray-200 bg-gray-50">
        {(["practices", "tools"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-[11px] font-semibold border-b-2 transition-colors",
              activeTab === tab
                ? "border-blue-500 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {tab === "practices" ? "Practices & Approaches" : "Tools & Resources"}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {tabQuestions(activeTab).length === 0 ? (
          <EmptyState text={`No ${activeTab === "practices" ? "practices & approaches" : "tools & resources"} defined for this element.`} />
        ) : (
          tabQuestions(activeTab).map((q) => renderQuestion(q))
        )}
      </div>
    </div>
  );
}

// ─── DE: Design Element mini-card (hub grid) ──────────────────────────────────

function DesignElementCard({
  el,
  preview,
  highlight,
  onNavigate,
}: {
  el: ElementDef;
  preview: DesignedExperiencePreview;
  highlight: HighlightProps;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  const dePreview = preview.designElements.find((e) => e.id === el.id);
  const practicesCount = dePreview?.practices.length ?? 0;
  const toolsCount = dePreview?.tools.length ?? 0;
  const hasContent = practicesCount > 0 || toolsCount > 0;

  const renderRow = (row: NonNullable<typeof dePreview>["practices"][number], i: number) => (
    <div key={i} className="text-[11px] text-gray-700 py-0.5 flex items-center gap-1 min-w-0">
      {row.isTagType ? (
        <HexBadge
          count={row.hexCount}
          sourceKey={`de-el:${el.id}::${row.label}`}
          nodeIds={row.hexIds}
          highlight={highlight}
        />
      ) : (
        <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
      )}
      <span className="truncate">{row.label}</span>
    </div>
  );

  return (
    <MiniCard
      title={el.title}
      onClick={() => onNavigate({ level: "L3", kind: "designElement", element: el.id as DesignElementKey })}
    >
      {!hasContent ? (
        <EmptyState text="No key items defined" />
      ) : (
        <div className="space-y-1">
          {practicesCount > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Practices & Approaches</div>
              {(dePreview?.practices ?? []).slice(0, 4).map((row, i) => renderRow(row, i))}
              {practicesCount > 4 && <div className="text-[10px] text-blue-500 font-medium">+{practicesCount - 4} more</div>}
            </div>
          )}
          {toolsCount > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5 mt-1">Tools & Resources</div>
              {(dePreview?.tools ?? []).slice(0, 3).map((row, i) => renderRow(row, i))}
              {toolsCount > 3 && <div className="text-[10px] text-emerald-600 font-medium">+{toolsCount - 3} more</div>}
            </div>
          )}
        </div>
      )}
    </MiniCard>
  );
}

function DesignElementsHubView({
  preview,
  highlight,
  onNavigate,
}: {
  preview: DesignedExperiencePreview;
  highlight: HighlightProps;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  return (
    <MiniCardGrid>
      {ALL_ELEMENTS.map((el) => (
        <DesignElementCard key={el.id} el={el} preview={preview} highlight={highlight} onNavigate={onNavigate} />
      ))}
    </MiniCardGrid>
  );
}

// ─── DE: L1 Home hub ─────────────────────────────────────────────────────────

function DEL1HomeView({
  preview,
  onNavigate,
}: {
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  const ti = preview.targetedImpact;
  const totalLeaps = ti.leaps.rows.filter((r) => r.priority !== "Absent").length;

  return (
    <MiniCardGrid>
      {/* Students */}
      <MiniCard
        title="Students"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L2", section: "students" })}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="bg-gray-100 rounded w-full h-20 flex items-center justify-center mb-1.5">
            <span className="text-[10px] text-gray-400">GreatSchools chart</span>
          </div>
          {preview.studentDemographics.currentAsOf && (
            <div className="text-[9px] text-gray-400">As of {preview.studentDemographics.currentAsOf}</div>
          )}
        </div>
      </MiniCard>

      {/* Targeted Impact */}
      <MiniCard
        title="Targeted Impact"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L2", section: "targetedImpact" })}
      >
        <CardListRow first label="Learning & Advancement" rightAdornment={<SmallCountBadge n={ti.learningAdvancement.selectedCount} />} />
        <CardListRow label="Wellbeing & Conduct" rightAdornment={<SmallCountBadge n={ti.wellbeingConduct.selectedCount} />} />
        <CardListRow label="Portrait of Graduate" rightAdornment={<SmallCountBadge n={ti.portrait.attributes.length} />} />
        <CardListRow label="Leaps & Design Principles" rightAdornment={<SmallCountBadge n={totalLeaps} />} />
        <CardListRow label="Community & Ecosystem" rightAdornment={<SmallCountBadge n={ti.community.outcomes.length} />} />
      </MiniCard>

      {/* Student Experiences */}
      <MiniCard
        title="Student Experiences"
        accentColor="emerald"
        onClick={() => onNavigate({ level: "L2", section: "studentExperiences" })}
      >
        {preview.studentExperiences.length === 0 ? (
          <EmptyState text="No groups configured." />
        ) : (
          preview.studentExperiences.map((g, i) => (
            <CardListRow
              key={g.category}
              first={i === 0}
              label={categoryDisplayLabel(g.category)}
              rightAdornment={<SmallCountBadge n={g.components.length} />}
            />
          ))
        )}
      </MiniCard>

      {/* Design Elements */}
      <MiniCard
        title="Design Elements"
        accentColor="amber"
        onClick={() => onNavigate({ level: "L2", section: "designElements" })}
      >
        {preview.designElements.map((el, i) => (
          <CardListRow
            key={el.id}
            first={i === 0}
            label={el.title}
            rightAdornment={<SmallCountBadge n={el.practices.length + el.tools.length} />}
          />
        ))}
      </MiniCard>

      {/* Adults */}
      <MiniCard
        title="Adults & Adult Experiences"
        accentColor="purple"
        onClick={() => onNavigate({ level: "L2", section: "adults" })}
      >
        {preview.adults.length === 0 ? (
          <EmptyState text="No adult roles selected." />
        ) : (
          preview.adults.map((r, i) => (
            <CardListRow key={r.roleId} first={i === 0} label={r.label} />
          ))
        )}
      </MiniCard>
    </MiniCardGrid>
  );
}

// ─── DE: Students full view ───────────────────────────────────────────────────

function DEStudentsView({
  preview,
  onEditClick,
}: {
  preview: DesignedExperiencePreview;
  onEditClick: () => void;
}) {
  const { currentAsOf } = preview.studentDemographics;
  return (
    <div className="p-6 flex flex-col gap-3 max-w-xl">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-gray-800">Student Demographics</div>
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg px-6 py-12 text-center">
        <div className="text-[13px] text-gray-500 font-semibold">GreatSchools Chart</div>
        <div className="text-[11px] text-gray-400 mt-1">Click Edit above to view or update the full chart.</div>
      </div>
      {currentAsOf && <div className="text-[10px] text-gray-400 text-center">As of {currentAsOf}</div>}
    </div>
  );
}

// ─── DE: Targeted Impact hub ──────────────────────────────────────────────────

function DETargetedImpactHubView({
  preview,
  onNavigate,
  highlight,
}: {
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
  highlight: HighlightProps;
}) {
  const ti = preview.targetedImpact;
  const selectedLeaps = ti.leaps.rows.filter((r) => r.priority !== "Absent");

  return (
    <MiniCardGrid>
      {/* Learning & Advancement Outcomes */}
      <MiniCard
        title="Learning & Advancement Outcomes"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L3", section: "targetedImpact.learningAdvancement" })}
      >
        {ti.learningAdvancement.categories.length === 0 ? (
          <EmptyState text="No outcomes selected." />
        ) : (
          ti.learningAdvancement.categories.map((c, i) => (
            <CardListRow
              key={c.category}
              first={i === 0}
              label={categoryDisplayLabel(c.category)}
              rightAdornment={
                <>
                  <SmallCountBadge n={c.selectedCount} />
                  <HexBadge count={c.hex} sourceKey={`de-cat:${c.category}`} nodeIds={c.hexIds} highlight={highlight} />
                </>
              }
            />
          ))
        )}
      </MiniCard>

      {/* Wellbeing & Conduct Outcomes */}
      <MiniCard
        title="Wellbeing & Conduct Outcomes"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L3", section: "targetedImpact.wellbeingConduct" })}
      >
        {ti.wellbeingConduct.categories.length === 0 ? (
          <EmptyState text="No outcomes selected." />
        ) : (
          ti.wellbeingConduct.categories.map((c, i) => (
            <CardListRow
              key={c.category}
              first={i === 0}
              label={categoryDisplayLabel(c.category)}
              rightAdornment={
                <>
                  <SmallCountBadge n={c.selectedCount} />
                  <HexBadge count={c.hex} sourceKey={`de-cat:${c.category}`} nodeIds={c.hexIds} highlight={highlight} />
                </>
              }
            />
          ))
        )}
      </MiniCard>

      {/* Portrait of a Graduate */}
      <MiniCard
        title="Portrait of a Graduate"
        accentColor="purple"
        onClick={() => onNavigate({ level: "L3", section: "targetedImpact.portrait" })}
      >
        {ti.portrait.attributes.length === 0 ? (
          <EmptyState text="No attributes defined." />
        ) : (
          ti.portrait.attributes.map((a, i) => (
            <CardListRow
              key={a.id}
              first={i === 0}
              label={a.icon ? `${a.icon}  ${a.name}` : a.name}
            />
          ))
        )}
      </MiniCard>

      {/* Leaps & Design Principles */}
      <MiniCard
        title="Leaps & Design Principles"
        accentColor="emerald"
        onClick={() => onNavigate({ level: "L3", section: "targetedImpact.leaps" })}
      >
        {selectedLeaps.length === 0 ? (
          <EmptyState text="No LEAPs selected." />
        ) : (
          selectedLeaps.map((r, i) => (
            <CardListRow
              key={r.label}
              first={i === 0}
              label={r.label}
              rightAdornment={
                <>
                  <PriorityChip priority={r.priority} />
                  <HexBadge count={r.hex} sourceKey={`de-leap:${r.label}`} nodeIds={r.hexIds} highlight={highlight} />
                </>
              }
            />
          ))
        )}
      </MiniCard>

      {/* Community & Ecosystem Outcomes */}
      <MiniCard
        title="Community & Ecosystem Outcomes"
        accentColor="amber"
        onClick={() => onNavigate({ level: "L3", section: "targetedImpact.community" })}
      >
        {ti.community.outcomes.length === 0 ? (
          <EmptyState text="No outcomes selected." />
        ) : (
          ti.community.outcomes.map((o, i) => (
            <CardListRow
              key={o.id}
              first={i === 0}
              label={o.label}
              rightAdornment={<StatusPill status={o.status} />}
            />
          ))
        )}
      </MiniCard>
    </MiniCardGrid>
  );
}

// ─── DE: Learning & Advancement / Wellbeing & Conduct hubs ───────────────────

function DEOutcomeGroupHubView({
  group,
  preview,
  onNavigate,
  highlight,
}: {
  group: "learningAdvancement" | "wellbeingConduct";
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
  highlight: HighlightProps;
}) {
  const cats = preview.targetedImpact[group].categories;
  if (cats.length === 0) {
    return <div className="p-6 text-[12px] text-gray-400 italic text-center">No categories found.</div>;
  }
  return (
    <MiniCardGrid>
      {cats.map((c) => (
        <MiniCard
          key={c.category}
          title={categoryDisplayLabel(c.category)}
          accentColor="blue"
          onClick={() => onNavigate({ level: "L3", kind: "outcomeCategory", category: c.category })}
        >
          {c.outcomes.length === 0 ? (
            <EmptyState text="No outcomes selected." />
          ) : (
            c.outcomes.map((o, i) => (
              <CardListRow
                key={o.key}
                first={i === 0}
                label={o.label}
                rightAdornment={
                  <>
                    <PriorityChip priority={o.priority} />
                    <HexBadge count={o.hex} sourceKey={`de-outcome:${o.key}`} nodeIds={o.hexIds} highlight={highlight} />
                  </>
                }
              />
            ))
          )}
        </MiniCard>
      ))}
    </MiniCardGrid>
  );
}

// ─── DE: Outcome category full view ──────────────────────────────────────────

function DEOutcomeCategoryView({
  category,
  preview,
  highlight,
  onNavigate,
}: {
  category: OutcomeCategoryKey;
  preview: DesignedExperiencePreview;
  highlight: HighlightProps;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  const allCats = [
    ...preview.targetedImpact.learningAdvancement.categories,
    ...preview.targetedImpact.wellbeingConduct.categories,
  ];
  const summary = allCats.find((c) => c.category === category);
  const outcomes = summary?.outcomes ?? [];
  if (outcomes.length === 0) {
    return (
      <div className="p-4 overflow-y-auto h-full">
        <EmptyState text="No outcomes selected in this category." />
      </div>
    );
  }
  return (
    <div className="overflow-y-auto h-full">
      {outcomes.map((o, i) => (
        <FVListRow
          key={o.key}
          first={i === 0}
          label={o.label}
          onClick={() => onNavigate({ level: "L4", kind: "outcomeDetail", outcomeKey: o.key, category })}
          leftAdornment={
            <HexBadge count={o.hex} sourceKey={`de-outcome:${o.key}`} nodeIds={o.hexIds} highlight={highlight} />
          }
          rightAdornment={<PriorityChip priority={o.priority} />}
        />
      ))}
    </div>
  );
}

// ─── DE: Portrait hub ─────────────────────────────────────────────────────────

function DEPortraitHubView({
  preview,
  onNavigate,
}: {
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  const attrs = preview.targetedImpact.portrait.attributes;
  if (attrs.length === 0) {
    return (
      <div className="p-6 text-[12px] text-gray-400 italic text-center">No Portrait of a Graduate attributes defined yet.</div>
    );
  }
  return (
    <MiniCardGrid>
      {attrs.map((a) => (
        <MiniCard
          key={a.id}
          title={a.icon ? `${a.icon}  ${a.name}` : a.name}
          accentColor="purple"
          onClick={() => onNavigate({ level: "L4", kind: "portraitAttribute", attributeId: a.id })}
        >
          {a.description?.trim() ? (
            <p className="text-[11px] text-gray-600 leading-snug line-clamp-6">{a.description}</p>
          ) : (
            <EmptyState text="No description captured." />
          )}
        </MiniCard>
      ))}
    </MiniCardGrid>
  );
}

function DEPortraitAttributeView({
  attributeId,
  preview,
}: {
  attributeId: string;
  preview: DesignedExperiencePreview;
}) {
  const attr = preview.targetedImpact.portrait.attributes.find((a) => a.id === attributeId);
  if (!attr) return <div className="p-6"><EmptyState text="Attribute not found." /></div>;
  return (
    <div className="p-6 max-w-xl space-y-3">
      {attr.icon && (
        <div className="text-4xl leading-none">{attr.icon}</div>
      )}
      <div className="text-[18px] font-bold text-gray-900">{attr.name}</div>
      {attr.description?.trim() ? (
        <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{attr.description}</p>
      ) : (
        <EmptyState text="No description captured for this attribute." />
      )}
    </div>
  );
}

// ─── DE: LEAPs full view ──────────────────────────────────────────────────────

function DELeapsFullView({
  preview,
  highlight,
  onNavigate,
}: {
  preview: DesignedExperiencePreview;
  highlight: HighlightProps;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  const rows = preview.targetedImpact.leaps.rows;
  if (rows.length === 0) {
    return (
      <div className="p-6 text-[12px] text-gray-400 italic text-center">No LEAPs or design principles configured.</div>
    );
  }
  return (
    <div className="overflow-y-auto h-full">
      {rows.map((r, i) => (
        <FVListRow
          key={r.label}
          first={i === 0}
          label={r.label}
          onClick={() => onNavigate({ level: "L4", kind: "leapDetail", label: r.label })}
          leftAdornment={
            <HexBadge count={r.hex} sourceKey={`de-leap:${r.label}`} nodeIds={r.hexIds} highlight={highlight} />
          }
          rightAdornment={<PriorityChip priority={r.priority} />}
        />
      ))}
    </div>
  );
}

// ─── DE: Community hub + detail ───────────────────────────────────────────────

function DECommunityHubView({
  preview,
  onNavigate,
}: {
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  const outcomes = preview.targetedImpact.community.outcomes;
  if (outcomes.length === 0) {
    return (
      <div className="p-6 text-[12px] text-gray-400 italic text-center">No community & ecosystem outcomes selected.</div>
    );
  }
  return (
    <MiniCardGrid>
      {outcomes.map((o) => (
        <MiniCard
          key={o.id}
          title={o.label}
          accentColor="emerald"
          onClick={() => onNavigate({ level: "L4", kind: "communityOutcome", outcomeId: o.id })}
        >
          <div className="flex flex-col gap-1.5">
            <StatusPill status={o.status} />
            {o.description?.trim() && (
              <p className="text-[11px] text-gray-600 leading-snug line-clamp-5 mt-1">{o.description}</p>
            )}
          </div>
        </MiniCard>
      ))}
    </MiniCardGrid>
  );
}

function DECommunityOutcomeView({
  outcomeId,
  preview,
}: {
  outcomeId: string;
  preview: DesignedExperiencePreview;
}) {
  const o = preview.targetedImpact.community.outcomes.find((x) => x.id === outcomeId);
  if (!o) return <div className="p-6 text-[12px] text-gray-400 italic">Outcome not found.</div>;
  return (
    <div className="p-6 max-w-xl space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-[13px] font-bold text-gray-800 flex-1">{o.label}</div>
        <StatusPill status={o.status} />
      </div>
      {o.description?.trim() && (
        <div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
          <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">{o.description}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Current</div>
          <div className="text-[14px] font-bold text-gray-900">
            {o.current || "—"}
            {o.current && o.unitSuffix && <span className="text-[11px] text-gray-500 ml-1">{o.unitSuffix}</span>}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Target</div>
          <div className="text-[14px] font-bold text-gray-900">
            {o.target || "—"}
            {o.target && o.unitSuffix && <span className="text-[11px] text-gray-500 ml-1">{o.unitSuffix}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DE: LEAP detail (L4) ─────────────────────────────────────────────────────

/** Read-only priority pill row showing all three options with the active one highlighted. */
function PriorityRow({ value }: { value: string | null }) {
  const opts: Array<{ key: string; label: string; activeCls: string; inactiveCls: string }> = [
    { key: "L", label: "Low", activeCls: "bg-green-600 text-white border-green-600", inactiveCls: "bg-white text-gray-500 border-gray-200" },
    { key: "M", label: "Medium", activeCls: "bg-amber-500 text-white border-amber-500", inactiveCls: "bg-white text-gray-500 border-gray-200" },
    { key: "H", label: "High", activeCls: "bg-red-600 text-white border-red-600", inactiveCls: "bg-white text-gray-500 border-gray-200" },
  ];
  const norm = value === "High" ? "H" : value === "Medium" ? "M" : value === "Low" ? "L" : value;
  return (
    <div className="flex items-center gap-1.5">
      {opts.map((o) => {
        const active = norm === o.key;
        return (
          <span
            key={o.key}
            className={cn(
              "inline-flex items-center justify-center text-[10px] font-semibold border rounded-md px-2 py-0.5",
              active ? o.activeCls : o.inactiveCls,
            )}
          >
            {o.label}
          </span>
        );
      })}
    </div>
  );
}

/** List of ring components linked to a given source via hexIndex/hexIds. */
function TaggedComponents({
  nodeIds,
  ringComps,
  sourceKey,
  highlight,
}: {
  nodeIds: string[] | undefined;
  ringComps: any[];
  sourceKey: string;
  highlight: HighlightProps;
}) {
  const ids = nodeIds ?? [];
  const titlesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of ringComps ?? []) {
      const id = String((c as any)?.nodeId ?? (c as any)?.id ?? "");
      if (id) m.set(id, String((c as any)?.title ?? "Untitled"));
    }
    return m;
  }, [ringComps]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Tagged components
        </div>
        <HexBadge count={ids.length} sourceKey={sourceKey} nodeIds={ids} highlight={highlight} />
      </div>
      {ids.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">No ring components are tagged with this yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const title = titlesById.get(id) ?? "Untitled";
            return (
              <button
                type="button"
                key={id}
                onClick={(e) => { e.stopPropagation(); highlight.onPin(sourceKey, [id]); }}
                className="text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full px-2.5 py-0.5 transition-colors"
                title="Highlight on canvas"
              >
                {title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DELeapDetailView({
  label,
  preview,
  rawOverallComp,
  ringComps,
  highlight,
}: {
  label: string;
  preview: DesignedExperiencePreview;
  rawOverallComp: any;
  ringComps: any[];
  highlight: HighlightProps;
}) {
  const row = preview.targetedImpact.leaps.rows.find((r) => r.label === label);
  const description =
    LEAP_DESCRIPTIONS[label] ||
    `${label.trim()} is a design principle for this school.`;
  const aims: any[] = rawOverallComp?.designedExperienceData?.keyDesignElements?.aims ?? [];
  const norm = (s: string) => String(s ?? "").trim().toLowerCase();
  const aim = aims.find((a: any) => a?.type === "leap" && norm(a?.label) === norm(label));
  const notes = String(aim?.notes ?? "").trim();
  const priority = row?.priority ?? "Absent";
  const isAbsent = priority === "Absent";

  return (
    <div className="p-6 max-w-2xl space-y-5 overflow-y-auto h-full">
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Leap / Design Principle • Overall School
        </div>
        <h2 className="text-[20px] font-bold text-gray-900 leading-tight">{label}</h2>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
        <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Priority for the overall school
        </div>
        {isAbsent ? (
          <span className="text-[11px] text-gray-400 italic">Not selected at the overall-school level</span>
        ) : (
          <PriorityRow value={priority} />
        )}
      </div>

      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          How this leap applies to the overall school
        </div>
        {notes ? (
          <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            {notes}
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 italic">No notes captured yet.</p>
        )}
      </div>

      <TaggedComponents
        nodeIds={row?.hexIds}
        ringComps={ringComps}
        sourceKey={`de-leap:${label}`}
        highlight={highlight}
      />
    </div>
  );
}

// ─── DE: Outcome detail (L4) ──────────────────────────────────────────────────

function DEOutcomeDetailView({
  outcomeKey,
  preview,
  rawOverallComp,
  ringComps,
  highlight,
}: {
  outcomeKey: string;
  preview: DesignedExperiencePreview;
  rawOverallComp: any;
  ringComps: any[];
  highlight: HighlightProps;
}) {
  const allCats = [
    ...preview.targetedImpact.learningAdvancement.categories,
    ...preview.targetedImpact.wellbeingConduct.categories,
  ];
  const outcome = allCats.flatMap((c) => c.outcomes).find((o) => o.key === outcomeKey);
  if (!outcome) return <div className="p-6"><EmptyState text="Outcome not found." /></div>;

  // Find which category this outcome belongs to (for context heading)
  const categorySummary = allCats.find((c) => c.outcomes.some((o) => o.key === outcomeKey));

  const description = OUTCOME_DESCRIPTIONS[outcome.label] ?? "";

  // Robust aim lookup that handles both L2 outcomes and L3 sub-outcomes.
  const sep = outcomeKey.indexOf("::");
  const l2Label = sep >= 0 ? outcomeKey.slice(0, sep) : outcomeKey;
  const l3Label = sep >= 0 ? outcomeKey.slice(sep + 2) : "";
  const norm = (s: string) => String(s ?? "").trim().toLowerCase();
  const aims: any[] = rawOverallComp?.designedExperienceData?.keyDesignElements?.aims ?? [];

  const aim = aims.find((a: any) => {
    if (a?.type === "leap") return false;
    if (norm(a?.label) !== norm(l2Label)) return false;
    if (!l3Label) return true;
    const subs: string[] = Array.isArray(a?.subSelections) ? a.subSelections : [];
    return subs.some((s) => norm(s) === norm(l3Label));
  });

  // Notes can live either at the aim level or per-L3 in `subNotes` if the working
  // space supports per-sub notes; fall back to aim-level notes.
  let notes = "";
  if (aim) {
    const subNotes = (aim?.subNotes ?? {}) as Record<string, string>;
    if (l3Label && subNotes && typeof subNotes === "object") {
      const match = Object.entries(subNotes).find(([k]) => norm(k) === norm(l3Label));
      if (match && match[1]) notes = String(match[1]).trim();
    }
    if (!notes) notes = String(aim?.notes ?? "").trim();
  }

  return (
    <div className="p-6 max-w-2xl space-y-5 overflow-y-auto h-full">
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {categorySummary ? `${categoryDisplayLabel(categorySummary.category)} • Overall School` : "Overall School"}
        </div>
        <h2 className="text-[20px] font-bold text-gray-900 leading-tight">{outcome.label}</h2>
        {l3Label && (
          <div className="text-[11px] text-gray-500 mt-0.5">in {l2Label}</div>
        )}
      </div>

      {description && (
        <div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
          <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
        </div>
      )}

      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Priority for the overall school
        </div>
        {outcome.priority ? (
          <PriorityRow value={outcome.priority} />
        ) : (
          <span className="text-[11px] text-gray-400 italic">Not selected at the overall-school level — appears here as a roll-up from ring components.</span>
        )}
      </div>

      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          How this outcome applies to the overall school
        </div>
        {notes ? (
          <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            {notes}
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 italic">No notes captured yet.</p>
        )}
      </div>

      <TaggedComponents
        nodeIds={outcome.hexIds}
        ringComps={ringComps}
        sourceKey={`de-outcome:${outcomeKey}`}
        highlight={highlight}
      />
    </div>
  );
}

// ─── DE: Student Experiences hub ─────────────────────────────────────────────

function DEStudentExperiencesHubView({
  preview,
  onNavigate,
  highlight,
}: {
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
  highlight: HighlightProps;
}) {
  const sorted = [...preview.studentExperiences].sort((a, b) =>
    categoryDisplayLabel(a.category).localeCompare(categoryDisplayLabel(b.category)),
  );
  return (
    <MiniCardGrid>
      {sorted.map((g) => {
        const nodeIds = g.components.map((c) => c.nodeId);
        return (
          <MiniCard
            key={g.category}
            title={categoryDisplayLabel(g.category)}
            accentColor="emerald"
            onClick={() => onNavigate({ level: "L3", kind: "studentExperienceGroup", category: g.category })}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-gray-600">{g.components.length} component{g.components.length !== 1 ? "s" : ""}</span>
              </div>
              {g.components.slice(0, 6).map((c) => (
                <div key={c.nodeId} className="text-[11px] text-gray-700 truncate flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                  {c.title}
                </div>
              ))}
              {g.components.length > 6 && (
                <div className="text-[10px] text-emerald-600 font-medium">+{g.components.length - 6} more</div>
              )}
            </div>
          </MiniCard>
        );
      })}
      {sorted.length === 0 && (
        <div className="text-[12px] text-gray-400 italic p-6">No student experience groups configured.</div>
      )}
    </MiniCardGrid>
  );
}

function DEStudentExperienceGroupView({
  category,
  preview,
  highlight,
}: {
  category: OutcomeCategoryKey;
  preview: DesignedExperiencePreview;
  highlight: HighlightProps;
}) {
  const group = preview.studentExperiences.find((g) => g.category === category);
  const components = [...(group?.components ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {components.length} ring component{components.length !== 1 ? "s" : ""} — click to highlight on canvas
      </div>
      {components.length === 0 ? (
        <EmptyState text="No ring components have a primary outcome in this group." />
      ) : (
        <div className="flex flex-wrap gap-4">
          {components.map((c, idx) => (
            <OctagonTile
              key={c.nodeId}
              nodeId={c.nodeId}
              title={c.title}
              colorIndex={idx}
              highlight={highlight}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DE: Adults hub + role view ───────────────────────────────────────────────

function DEAdultsHubView({
  preview,
  onNavigate,
}: {
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  if (preview.adults.length === 0) {
    return (
      <div className="p-6 text-[12px] text-gray-400 italic text-center">No adult roles selected for this component yet.</div>
    );
  }
  return (
    <MiniCardGrid>
      {preview.adults.map((r) => (
        <MiniCard
          key={r.roleId}
          title={r.label}
          accentColor="purple"
          onClick={() => onNavigate({ level: "L3", kind: "adultRole", roleId: r.roleId })}
        >
          <CardListRow
            first
            label={`${r.label} Experiences`}
            rightAdornment={<SmallCountBadge n={r.experiences.length} />}
          />
          <CardListRow
            label="Demographic & Situational Variables"
            rightAdornment={<SmallCountBadge n={r.demographicTags.length} />}
          />
          <CardListRow
            label="Incoming Skills & Mindsets"
            rightAdornment={r.incomingSkillsText.trim() ? <span className="text-[9px] text-gray-400">…</span> : <SmallCountBadge n={0} />}
          />
          <CardListRow
            label="Adult Background"
            rightAdornment={<SmallCountBadge n={r.backgroundTags.length} />}
          />
          <CardListRow
            label="Approach to Staffing"
            rightAdornment={r.staffingText.trim() ? <span className="text-[9px] text-gray-400">…</span> : <SmallCountBadge n={0} />}
          />
        </MiniCard>
      ))}
    </MiniCardGrid>
  );
}

/** L3 role view: bucket list (same as card's L3AdultRoleBuckets). */
function DEAdultRoleView({
  roleId,
  preview,
  onNavigate,
}: {
  roleId: string;
  preview: DesignedExperiencePreview;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
}) {
  const role = preview.adults.find((a) => a.roleId === roleId);
  if (!role) return <div className="p-6 text-[12px] text-gray-400 italic">Role not found.</div>;
  return (
    <div className="overflow-y-auto h-full">
      <FVListRow
        first
        label={`${role.label} Experiences`}
        onClick={() => onNavigate({ level: "L4", kind: "adultBucket", roleId, bucket: "experiences" })}
        rightAdornment={<CountBadge n={role.experiences.length} />}
      />
      <FVListRow
        label="Demographic & Situational Variables"
        onClick={() => onNavigate({ level: "L4", kind: "adultBucket", roleId, bucket: "demographic" })}
        rightAdornment={<CountBadge n={role.demographicTags.length} />}
      />
      <FVListRow
        label="Incoming Skills & Mindsets"
        onClick={() => onNavigate({ level: "L4", kind: "adultBucket", roleId, bucket: "incomingSkills" })}
        rightAdornment={
          role.incomingSkillsText.trim()
            ? <span className="text-[10px] text-gray-400">…</span>
            : <CountBadge n={0} />
        }
      />
      <FVListRow
        label="Adult Background"
        onClick={() => onNavigate({ level: "L4", kind: "adultBucket", roleId, bucket: "background" })}
        rightAdornment={<CountBadge n={role.backgroundTags.length} />}
      />
      <FVListRow
        label="Approach to Staffing"
        onClick={() => onNavigate({ level: "L4", kind: "adultBucket", roleId, bucket: "staffing" })}
        rightAdornment={
          role.staffingText.trim()
            ? <span className="text-[10px] text-gray-400">…</span>
            : <CountBadge n={0} />
        }
      />
    </div>
  );
}

/** L4 adult bucket detail — shows actual content of the selected bucket. */
function DEAdultBucketDetailView({
  roleId,
  bucket,
  preview,
}: {
  roleId: string;
  bucket: AdultBucketKey;
  preview: DesignedExperiencePreview;
}) {
  const role = preview.adults.find((a) => a.roleId === roleId);
  if (!role) return <div className="p-5"><EmptyState text="Role not found." /></div>;

  if (bucket === "experiences") {
    const comps = [...role.experiences].sort((a, b) => a.title.localeCompare(b.title));
    return (
      <div className="p-5 overflow-y-auto h-full">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {role.label} Experiences ({comps.length})
        </div>
        {comps.length === 0 ? (
          <EmptyState text="No adult-focused ring components for this role." />
        ) : (
          <div className="space-y-1">
            {comps.map((c) => (
              <div key={c.nodeId} className="text-[12px] text-gray-800 py-1.5 border-b border-gray-100 last:border-0 pl-1">
                {c.title}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (bucket === "demographic" || bucket === "background") {
    const tags = bucket === "demographic" ? role.demographicTags : role.backgroundTags;
    const title = bucket === "demographic" ? "Demographic & Situational Variables" : "Adult Background";
    return (
      <div className="p-5 overflow-y-auto h-full">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</div>
        {tags.length === 0 ? (
          <EmptyState text="Nothing selected here yet." />
        ) : (
          <ul className="space-y-1">
            {tags.map((t) => (
              <li key={t} className="flex items-center gap-2 py-0.5">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="text-[12px] text-gray-700">{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const text = bucket === "incomingSkills" ? role.incomingSkillsText : role.staffingText;
  const title = bucket === "incomingSkills" ? "Incoming Skills & Mindsets" : "Approach to Staffing";
  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</div>
      {text.trim() ? (
        <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>
      ) : (
        <EmptyState text="Nothing captured here yet." />
      )}
    </div>
  );
}

// ─── DE: Main content dispatcher ─────────────────────────────────────────────

function CenterFullViewDEContent({
  route,
  onNavigate,
  preview,
  rawOverallComp,
  ringComps,
  hexIndex,
  highlight,
  showAll,
  onEditClick,
}: {
  route: DesignedExperienceCardRoute;
  onNavigate: (route: DesignedExperienceCardRoute) => void;
  preview: DesignedExperiencePreview;
  rawOverallComp: any;
  ringComps: any[];
  hexIndex: Map<string, Set<string>>;
  highlight: HighlightProps;
  showAll: boolean;
  onEditClick: () => void;
}) {
  // L1
  if (route.level === "L1") {
    return <DEL1HomeView preview={preview} onNavigate={onNavigate} />;
  }

  // L2 section routes
  if (route.level === "L2" && "section" in route) {
    switch (route.section) {
      case "students":
        return <DEStudentsView preview={preview} onEditClick={onEditClick} />;
      case "targetedImpact":
        return <DETargetedImpactHubView preview={preview} onNavigate={onNavigate} highlight={highlight} />;
      case "studentExperiences":
        return <DEStudentExperiencesHubView preview={preview} onNavigate={onNavigate} highlight={highlight} />;
      case "designElements":
        return <DesignElementsHubView preview={preview} highlight={highlight} onNavigate={onNavigate} />;
      case "adults":
        return <DEAdultsHubView preview={preview} onNavigate={onNavigate} />;
    }
  }

  // L3 section routes (Targeted Impact sub-hubs)
  if (route.level === "L3" && "section" in route) {
    switch (route.section) {
      case "targetedImpact.learningAdvancement":
        return <DEOutcomeGroupHubView group="learningAdvancement" preview={preview} onNavigate={onNavigate} highlight={highlight} />;
      case "targetedImpact.wellbeingConduct":
        return <DEOutcomeGroupHubView group="wellbeingConduct" preview={preview} onNavigate={onNavigate} highlight={highlight} />;
      case "targetedImpact.portrait":
        return <DEPortraitHubView preview={preview} onNavigate={onNavigate} />;
      case "targetedImpact.leaps":
        return <DELeapsFullView preview={preview} highlight={highlight} onNavigate={onNavigate} />;
      case "targetedImpact.community":
        return <DECommunityHubView preview={preview} onNavigate={onNavigate} />;
    }
  }

  // L3 kind routes
  if (route.level === "L3" && "kind" in route) {
    if (route.kind === "designElement") {
      const elementData: Record<string, BucketValue> =
        (rawOverallComp?.designedExperienceData?.elementsExpertData?.[route.element] as any) ?? {};
      return (
        <DesignElementFullView
          elementId={route.element as DesignElementKey}
          elementData={elementData}
          hexIndex={hexIndex}
          highlight={highlight}
          showAll={showAll}
          onEditClick={onEditClick}
        />
      );
    }
    if (route.kind === "outcomeCategory") {
      return <DEOutcomeCategoryView category={route.category} preview={preview} highlight={highlight} onNavigate={onNavigate} />;
    }
    if (route.kind === "adultRole") {
      return <DEAdultRoleView roleId={route.roleId} preview={preview} onNavigate={onNavigate} />;
    }
    if (route.kind === "studentExperienceGroup") {
      return <DEStudentExperienceGroupView category={route.category} preview={preview} highlight={highlight} />;
    }
  }

  // L4 kind routes
  if (route.level === "L4" && "kind" in route) {
    if (route.kind === "portraitAttribute") {
      return <DEPortraitAttributeView attributeId={route.attributeId} preview={preview} />;
    }
    if (route.kind === "communityOutcome") {
      return <DECommunityOutcomeView outcomeId={route.outcomeId} preview={preview} />;
    }
    if (route.kind === "adultBucket") {
      return <DEAdultBucketDetailView roleId={route.roleId} bucket={route.bucket} preview={preview} />;
    }
    if (route.kind === "leapDetail") {
      return <DELeapDetailView label={route.label} preview={preview} rawOverallComp={rawOverallComp} ringComps={ringComps} highlight={highlight} />;
    }
    if (route.kind === "outcomeDetail") {
      return <DEOutcomeDetailView outcomeKey={route.outcomeKey} preview={preview} rawOverallComp={rawOverallComp} ringComps={ringComps} highlight={highlight} />;
    }
  }

  return <ComingSoonView title={titleForDesignedRoute(route, preview)} />;
}

// ─── J&O: Content views ───────────────────────────────────────────────────────

function JOL1HomeView({
  preview,
  onNavigate,
}: {
  preview: JourneyOverviewPreview;
  onNavigate: (route: JourneyOverviewCardRoute) => void;
}) {
  const ctxCount = Object.values(preview.contextOverview).filter((f) => f.text.trim().length > 0).length;
  const pubCount = Object.values(preview.publicAcademic).filter((c) => c.hasData).length;

  return (
    <MiniCardGrid>
      {/* Mission */}
      <MiniCard
        title="Mission"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L2", section: "mission" })}
      >
        {preview.mission.trim() ? (
          <p className="text-[11px] text-gray-700 leading-snug line-clamp-7">{preview.mission}</p>
        ) : (
          <EmptyState text="No mission captured yet." />
        )}
      </MiniCard>

      {/* School Overview */}
      <MiniCard
        title="School Overview"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L2", section: "schoolOverview" })}
      >
        <CardListRow first label="Context & Overview" rightAdornment={<SmallCountBadge n={ctxCount} />} />
        <CardListRow label="Enrollment & Composition" />
        <CardListRow label="Public Academic Profile" rightAdornment={<SmallCountBadge n={pubCount} />} />
        <CardListRow label="Community Reviews" rightAdornment={<span className="text-[9px] text-gray-400">{COMMUNITY_REVIEWS_MOCK.averageRating.toFixed(1)}★</span>} />
        <CardListRow label="Stakeholder Map" />
      </MiniCard>
    </MiniCardGrid>
  );
}

function JOMissionView({
  preview,
  onEditClick,
}: {
  preview: JourneyOverviewPreview;
  onEditClick: () => void;
}) {
  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Mission Statement</div>
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      {preview.mission.trim() ? (
        <p className="text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap">{preview.mission}</p>
      ) : (
        <EmptyState text="No mission captured yet." />
      )}
    </div>
  );
}

function JOSchoolOverviewHubView({
  preview,
  onNavigate,
}: {
  preview: JourneyOverviewPreview;
  onNavigate: (route: JourneyOverviewCardRoute) => void;
}) {
  const ctxUnverified = Object.values(preview.contextOverview).some((f) => !f.verified && f.text.trim().length > 0);
  const pubUnverified = Object.values(preview.publicAcademic).some((c) => !c.verified && c.hasData);
  const enrUnverified = preview.studentDemographics.hasData && !preview.studentDemographics.verified;

  const ctxFields: { key: keyof JourneyOverviewPreview["contextOverview"]; label: string }[] = [
    { key: "communityOverview", label: "Community Overview" },
    { key: "policyConsiderations", label: "Policy Considerations" },
    { key: "historyOfChangeEfforts", label: "History of Change Efforts" },
    { key: "otherContext", label: "Other Context" },
  ];

  const pubCharts: { key: keyof JourneyOverviewPreview["publicAcademic"]; label: string }[] = [
    { key: "collegePrep", label: "College Prep" },
    { key: "testScores", label: "Test Scores" },
    { key: "raceEthnicity", label: "Race & Ethnicity" },
    { key: "lowIncomeStudents", label: "Low Income Students" },
    { key: "studentsWithDisabilities", label: "Students with Disabilities" },
  ];

  return (
    <MiniCardGrid>
      {/* Context & Overview */}
      <MiniCard
        title="Context & Overview"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L3", section: "schoolOverview.contextOverview" })}
      >
        <div className="flex flex-col gap-0.5">
          {ctxUnverified && <NotVerifiedBadge />}
          {ctxFields.map((f, i) => {
            const field = preview.contextOverview[f.key];
            return (
              <CardListRow
                key={f.key}
                first={i === 0}
                label={f.label}
                rightAdornment={field.text.trim() ? undefined : <span className="text-[9px] text-gray-300 italic">empty</span>}
              />
            );
          })}
        </div>
      </MiniCard>

      {/* Enrollment & Composition */}
      <MiniCard
        title="Enrollment & Composition"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L3", section: "schoolOverview.enrollment" })}
      >
        <div className="flex flex-col gap-1.5">
          {enrUnverified && <NotVerifiedBadge />}
          <div className="bg-gray-100 rounded w-full h-20 flex items-center justify-center">
            <span className="text-[10px] text-gray-400">GreatSchools chart</span>
          </div>
          {preview.studentDemographics.currentAsOf && (
            <div className="text-[9px] text-gray-400">As of {preview.studentDemographics.currentAsOf}</div>
          )}
        </div>
      </MiniCard>

      {/* Public Academic Profile */}
      <MiniCard
        title="Public Academic Profile"
        accentColor="blue"
        onClick={() => onNavigate({ level: "L3", section: "schoolOverview.publicAcademic" })}
      >
        <div className="flex flex-col gap-0.5">
          {pubUnverified && <NotVerifiedBadge />}
          {pubCharts.map((c, i) => {
            const chart = preview.publicAcademic[c.key];
            return (
              <CardListRow
                key={c.key}
                first={i === 0}
                label={c.label}
                rightAdornment={!chart.verified && chart.hasData ? <NotVerifiedBadge /> : undefined}
              />
            );
          })}
        </div>
      </MiniCard>

      {/* Community Reviews */}
      <MiniCard
        title="Community Reviews"
        accentColor="emerald"
        onClick={() => onNavigate({ level: "L3", section: "schoolOverview.communityReviews" })}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[20px] font-bold text-gray-900">{COMMUNITY_REVIEWS_MOCK.averageRating.toFixed(1)}</span>
            <MiniStars rating={COMMUNITY_REVIEWS_MOCK.averageRating} />
          </div>
          <div className="text-[11px] text-gray-500">{COMMUNITY_REVIEWS_MOCK.reviews.length} reviews</div>
          {COMMUNITY_REVIEWS_MOCK.reviews.slice(0, 2).map((r, i) => (
            <p key={i} className="text-[10px] text-gray-600 leading-snug line-clamp-2 italic">"{r.body}"</p>
          ))}
        </div>
      </MiniCard>

      {/* Stakeholder Map */}
      <MiniCard
        title="Stakeholder Map"
        accentColor="amber"
        onClick={() => onNavigate({ level: "L3", section: "schoolOverview.stakeholderMap" })}
      >
        <EmptyState text="Stakeholder map coming soon." />
      </MiniCard>
    </MiniCardGrid>
  );
}

function JOContextOverviewHubView({
  preview,
  onNavigate,
}: {
  preview: JourneyOverviewPreview;
  onNavigate: (route: JourneyOverviewCardRoute) => void;
}) {
  const fields: { key: keyof JourneyOverviewPreview["contextOverview"]; label: string; section: ContextOverviewL4 }[] = [
    { key: "communityOverview", label: "Community Overview", section: "schoolOverview.contextOverview.communityOverview" },
    { key: "policyConsiderations", label: "Policy Considerations", section: "schoolOverview.contextOverview.policyConsiderations" },
    { key: "historyOfChangeEfforts", label: "History of Change Efforts", section: "schoolOverview.contextOverview.historyOfChangeEfforts" },
    { key: "otherContext", label: "Other Context", section: "schoolOverview.contextOverview.otherContext" },
  ];
  return (
    <MiniCardGrid>
      {fields.map((f) => {
        const field = preview.contextOverview[f.key];
        const text = field.text.trim();
        return (
          <MiniCard
            key={f.key}
            title={f.label}
            onClick={() => onNavigate({ level: "L4", section: f.section })}
          >
            {text ? (
              <p className="text-[11px] text-gray-700 leading-snug line-clamp-7">{text}</p>
            ) : (
              <EmptyState text="Nothing captured yet." />
            )}
            {!field.verified && text && <NotVerifiedBadge />}
          </MiniCard>
        );
      })}
    </MiniCardGrid>
  );
}

function JOContextOverviewFieldView({
  section,
  preview,
  onEditClick,
}: {
  section: ContextOverviewL4;
  preview: JourneyOverviewPreview;
  onEditClick: () => void;
}) {
  const leafKey = section.slice("schoolOverview.contextOverview.".length) as keyof JourneyOverviewPreview["contextOverview"];
  const field = preview.contextOverview[leafKey];
  const text = field.text.trim();
  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center justify-between mb-3">
        {!field.verified && text ? <NotVerifiedBadge /> : <span />}
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      {text ? (
        <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
      ) : (
        <EmptyState text="Nothing captured yet for this section." />
      )}
    </div>
  );
}

function JOEnrollmentView({
  preview,
  onEditClick,
}: {
  preview: JourneyOverviewPreview;
  onEditClick: () => void;
}) {
  const { currentAsOf, verified, hasData } = preview.studentDemographics;
  return (
    <div className="p-6 flex flex-col gap-3 max-w-xl">
      <div className="flex items-center justify-between">
        {hasData && !verified ? <NotVerifiedBadge /> : <span />}
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg px-6 py-12 text-center">
        <div className="text-[13px] text-gray-500 font-semibold">GreatSchools Chart</div>
        <div className="text-[11px] text-gray-400 mt-1">Click Edit above to view or update the full chart.</div>
      </div>
      {currentAsOf && <div className="text-[10px] text-gray-400 text-center">As of {currentAsOf}</div>}
    </div>
  );
}

function JOPublicAcademicHubView({
  preview,
  onNavigate,
}: {
  preview: JourneyOverviewPreview;
  onNavigate: (route: JourneyOverviewCardRoute) => void;
}) {
  const charts: { key: keyof JourneyOverviewPreview["publicAcademic"]; label: string; section: PublicAcademicL4 }[] = [
    { key: "collegePrep", label: "College Prep", section: "schoolOverview.publicAcademic.collegePrep" },
    { key: "testScores", label: "Test Scores", section: "schoolOverview.publicAcademic.testScores" },
    { key: "raceEthnicity", label: "Race & Ethnicity", section: "schoolOverview.publicAcademic.raceEthnicity" },
    { key: "lowIncomeStudents", label: "Low Income Students", section: "schoolOverview.publicAcademic.lowIncomeStudents" },
    { key: "studentsWithDisabilities", label: "Students with Disabilities", section: "schoolOverview.publicAcademic.studentsWithDisabilities" },
  ];
  return (
    <MiniCardGrid>
      {charts.map((c) => {
        const chart = preview.publicAcademic[c.key];
        const showUnverified = chart.hasData && !chart.verified;
        return (
          <MiniCard key={c.key} title={c.label} onClick={() => onNavigate({ level: "L4", section: c.section })}>
            <div className="space-y-1">
              {showUnverified && <NotVerifiedBadge />}
              <div className="bg-gray-100 rounded h-24 flex items-center justify-center">
                <span className="text-[10px] text-gray-400">GreatSchools chart</span>
              </div>
              {chart.currentAsOf && <div className="text-[10px] text-gray-400">As of {chart.currentAsOf}</div>}
            </div>
          </MiniCard>
        );
      })}
    </MiniCardGrid>
  );
}

function JOPublicAcademicChartView({
  section,
  preview,
  onEditClick,
}: {
  section: PublicAcademicL4;
  preview: JourneyOverviewPreview;
  onEditClick: () => void;
}) {
  const leafKey = section.slice("schoolOverview.publicAcademic.".length) as keyof JourneyOverviewPreview["publicAcademic"];
  const chart = preview.publicAcademic[leafKey];
  return (
    <div className="p-6 flex flex-col gap-3 max-w-xl">
      <div className="flex items-center justify-between">
        {chart.hasData && !chart.verified ? <NotVerifiedBadge /> : <span />}
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg px-6 py-16 text-center">
        <div className="text-[13px] text-gray-500 font-semibold">GreatSchools Chart</div>
        <div className="text-[11px] text-gray-400 mt-1">Click Edit above to view or update the full chart.</div>
      </div>
      {chart.currentAsOf && <div className="text-[10px] text-gray-400 text-center">As of {chart.currentAsOf}</div>}
    </div>
  );
}

function JOCommunityReviewsView({ onEditClick }: { onEditClick: () => void }) {
  const summary = COMMUNITY_REVIEWS_MOCK;
  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-[20px] font-bold text-gray-900 tabular-nums">{summary.averageRating.toFixed(1)}</div>
          <MiniStars rating={summary.averageRating} />
          <div className="text-[12px] text-gray-500">{summary.reviews.length} reviews</div>
        </div>
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div className="space-y-2">
        {summary.reviews.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">{r.role}</div>
            <p className="text-[12px] text-gray-700 leading-snug mt-0.5">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JOStakeholderHubView({
  preview,
  onNavigate,
}: {
  preview: JourneyOverviewPreview;
  onNavigate: (route: JourneyOverviewCardRoute) => void;
}) {
  const stakeholders: { key: keyof JourneyOverviewPreview["stakeholderMap"]; label: string; section: StakeholderL4 }[] = [
    { key: "students", label: "Students", section: "schoolOverview.stakeholderMap.students" },
    { key: "families", label: "Families", section: "schoolOverview.stakeholderMap.families" },
    { key: "educatorsStaff", label: "Educators / Staff", section: "schoolOverview.stakeholderMap.educatorsStaff" },
    { key: "administrationDistrict", label: "Administration (District)", section: "schoolOverview.stakeholderMap.administrationDistrict" },
    { key: "administrationSchool", label: "Administration (School)", section: "schoolOverview.stakeholderMap.administrationSchool" },
    { key: "otherCommunityLeaders", label: "Other Community Leaders", section: "schoolOverview.stakeholderMap.otherCommunityLeaders" },
  ];
  return (
    <MiniCardGrid>
      {stakeholders.map((stk) => {
        const s = preview.stakeholderMap[stk.key];
        const hasText = !!(s.populationSize.trim() || s.additionalContext.trim() || s.keyRepresentatives.trim());
        const showUnverified = s.verified === false && hasText;
        return (
          <MiniCard key={stk.key} title={stk.label} onClick={() => onNavigate({ level: "L4", section: stk.section })}>
            {showUnverified && <NotVerifiedBadge />}
            {hasText ? (
              <div className="space-y-1.5 mt-1">
                {s.populationSize.trim() && (
                  <div>
                    <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Population size</div>
                    <div className="text-[12px] font-semibold text-gray-900">{s.populationSize}</div>
                  </div>
                )}
                {s.keyRepresentatives.trim() && (
                  <div>
                    <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Key representatives</div>
                    <div className="text-[11px] text-gray-700 line-clamp-2">{s.keyRepresentatives}</div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState text="No data captured yet." />
            )}
          </MiniCard>
        );
      })}
    </MiniCardGrid>
  );
}

function JOStakeholderDetailView({
  section,
  preview,
  onEditClick,
}: {
  section: StakeholderL4;
  preview: JourneyOverviewPreview;
  onEditClick: () => void;
}) {
  const leafKey = section.slice("schoolOverview.stakeholderMap.".length) as keyof JourneyOverviewPreview["stakeholderMap"];
  const s = preview.stakeholderMap[leafKey];
  const hasText = !!(s.populationSize.trim() || s.additionalContext.trim() || s.keyRepresentatives.trim());
  const showUnverified = s.verified === false && hasText;
  return (
    <div className="p-6 max-w-xl space-y-3">
      <div className="flex items-center justify-between">
        {showUnverified ? <NotVerifiedBadge /> : <span />}
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div>
        <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Population size</div>
        <div className="text-[14px] font-semibold text-gray-900">{s.populationSize.trim() || "—"}</div>
      </div>
      <div>
        <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Key representatives</div>
        <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap mt-1">{s.keyRepresentatives.trim() || "—"}</p>
      </div>
      <div>
        <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Additional context</div>
        <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap mt-1">{s.additionalContext.trim() || "—"}</p>
      </div>
    </div>
  );
}

// ─── J&O: Main content dispatcher ────────────────────────────────────────────

function CenterFullViewJOContent({
  route,
  onNavigate,
  preview,
  onEditClick,
}: {
  route: JourneyOverviewCardRoute;
  onNavigate: (route: JourneyOverviewCardRoute) => void;
  preview: JourneyOverviewPreview;
  onEditClick: () => void;
}) {
  if (route.level === "L1") return <JOL1HomeView preview={preview} onNavigate={onNavigate} />;

  if (route.level === "L2") {
    if (route.section === "mission") return <JOMissionView preview={preview} onEditClick={onEditClick} />;
    if (route.section === "schoolOverview") return <JOSchoolOverviewHubView preview={preview} onNavigate={onNavigate} />;
  }

  if (route.level === "L3") {
    switch (route.section) {
      case "schoolOverview.contextOverview":
        return <JOContextOverviewHubView preview={preview} onNavigate={onNavigate} />;
      case "schoolOverview.enrollment":
        return <JOEnrollmentView preview={preview} onEditClick={onEditClick} />;
      case "schoolOverview.publicAcademic":
        return <JOPublicAcademicHubView preview={preview} onNavigate={onNavigate} />;
      case "schoolOverview.communityReviews":
        return <JOCommunityReviewsView onEditClick={onEditClick} />;
      case "schoolOverview.stakeholderMap":
        return <JOStakeholderHubView preview={preview} onNavigate={onNavigate} />;
    }
  }

  if (route.level === "L4") {
    if (route.section.startsWith("schoolOverview.contextOverview.")) {
      return <JOContextOverviewFieldView section={route.section as ContextOverviewL4} preview={preview} onEditClick={onEditClick} />;
    }
    if (route.section === "schoolOverview.enrollment.studentDemographics") {
      return <JOEnrollmentView preview={preview} onEditClick={onEditClick} />;
    }
    if (route.section.startsWith("schoolOverview.publicAcademic.")) {
      return <JOPublicAcademicChartView section={route.section as PublicAcademicL4} preview={preview} onEditClick={onEditClick} />;
    }
    if (route.section.startsWith("schoolOverview.stakeholderMap.")) {
      return <JOStakeholderDetailView section={route.section as StakeholderL4} preview={preview} onEditClick={onEditClick} />;
    }
  }

  return <ComingSoonView title={titleForJourneyRoute(route)} />;
}

// ─── Top-level Home view (3 cards) ────────────────────────────────────────────

/**
 * Home view that renders the three real center cards exactly as they appear on
 * the canvas (Designed Experience, Journey & Overview, Performance & Status),
 * stacked vertically. Internal row clicks drill the right panel into the
 * appropriate section route; clicking the empty area of a card drills into L1.
 */
function CenterHomeView({
  onSelect,
  dePreview,
  joPreview,
  rawOverallComp,
  highlight,
}: {
  onSelect: (slot: CenterFullViewSlot) => void;
  dePreview: DesignedExperiencePreview;
  joPreview?: JourneyOverviewPreview;
  rawOverallComp: any;
  highlight: HighlightProps;
}) {
  // Each card uses its own internal route state so the user can drill in like
  // they do on the canvas. We mirror the route into the panel on every change so
  // navigation feels immediate without a flash.
  const [deRoute, setDeRoute] = useState<DesignedExperienceCardRoute>({ level: "L1" });
  const [joRoute, setJoRoute] = useState<JourneyOverviewCardRoute>({ level: "L1" });

  const schoolName: string =
    (joPreview?.schoolName?.trim() ||
      rawOverallComp?.title ||
      "Overall School");

  return (
    <div className="h-full overflow-y-auto bg-gray-50/50">
      <div className="flex flex-col items-center gap-4 py-6 px-4">
        {/* Designed Experience */}
        <button
          type="button"
          onClick={() => onSelect({ kind: "designed", route: deRoute })}
          className="relative w-[320px] h-[220px] rounded-xl shadow-md border-2 border-blue-200 bg-blue-50/60 hover:border-blue-300 hover:shadow-lg transition-all px-4 pt-4 pb-3 text-left"
          title="Open Designed Experience full view"
        >
          <div className="flex flex-col w-full h-full justify-between">
            <DesignedExperienceCardContent
              route={deRoute}
              onSetRoute={(r) => {
                setDeRoute(r);
                onSelect({ kind: "designed", route: r });
              }}
              onNavigateOverall={() => onSelect({ kind: "designed", route: { level: "L1" } })}
              onOpenRingComponent={() => {/* no-op in full-view home */}}
              preview={dePreview}
              schoolName={schoolName}
              avatarPillClassName="bg-blue-100 text-blue-800 border-blue-200"
              highlight={highlight}
            />
          </div>
        </button>

        {/* Journey & Overview */}
        {joPreview ? (
          <button
            type="button"
            onClick={() => onSelect({ kind: "overview", route: joRoute })}
            className="relative w-[320px] h-[220px] rounded-xl shadow-md border-2 border-orange-200 bg-orange-50/70 hover:border-orange-300 hover:shadow-lg transition-all px-4 pt-4 pb-3 text-left"
            title="Open Journey and Overview full view"
          >
            <div className="flex flex-col w-full h-full justify-between">
              <JourneyOverviewCardContent
                route={joRoute}
                onSetRoute={(r) => {
                  setJoRoute(r);
                  onSelect({ kind: "overview", route: r });
                }}
                onNavigateOverall={() => onSelect({ kind: "overview", route: { level: "L1" } })}
                preview={joPreview}
                avatarPillClassName="bg-orange-100 text-orange-800 border-orange-200"
              />
            </div>
          </button>
        ) : (
          <div
            className="relative w-[320px] h-[220px] rounded-xl shadow-md border-2 border-orange-200 bg-orange-50/40 px-4 pt-4 pb-3 flex items-center justify-center text-center opacity-70"
            title="Journey and Overview is not configured for this school yet"
          >
            <div className="text-[12px] text-orange-700/80">
              <div className="font-semibold mb-1">Journey and Overview</div>
              <div className="text-[11px] italic">Not configured for this school yet</div>
            </div>
          </div>
        )}

        {/* Performance & Status */}
        <button
          type="button"
          onClick={() => onSelect({ kind: "status" })}
          className="relative w-[320px] h-[220px] rounded-xl shadow-md border-2 border-emerald-200 bg-emerald-50/60 hover:border-emerald-300 hover:shadow-lg transition-all px-4 pt-4 pb-3 text-left"
          title="Open Performance & Status full view"
        >
          <div className="flex flex-col w-full h-full items-center justify-center text-center gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Performance &amp; Status
            </span>
            <div className="text-[15px] font-bold text-emerald-900">{schoolName}</div>
            <div className="text-[11px] text-emerald-700/80 italic">Full view coming soon</div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function ComingSoonView({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <span className="text-2xl">🗂️</span>
      </div>
      <div className="text-sm font-semibold text-gray-500">{title}</div>
      <div className="text-xs text-gray-400">Full view coming soon</div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function CenterFullView({
  slot: initialSlot,
  onNavigate: onExternalNavigate,
  onClose,
  dePreview,
  joPreview,
  rawOverallComp,
  ringComps,
  ringHighlightSourceKey,
  onPinRingHighlight,
  onOpenWorkingSpace,
  onOpenJOWorkingSpace,
}: CenterFullViewProps) {
  const [localSlot, setLocalSlot] = useState<CenterFullViewSlot>(initialSlot);
  const [showAll, setShowAll] = useState(true);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setLocalSlot(initialSlot);
  }, [initialSlot]);

  // Close any open breadcrumb dropdown on outside click or escape.
  React.useEffect(() => {
    if (openDropdownIdx === null) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownIdx(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenDropdownIdx(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openDropdownIdx]);

  const hexIndex = useMemo(() => buildDesignElementHexIndex(ringComps), [ringComps]);

  const highlight: HighlightProps = {
    activeSourceKey: ringHighlightSourceKey,
    onPin: onPinRingHighlight,
  };

  function navigate(slot: CenterFullViewSlot) {
    setLocalSlot(slot);
    onExternalNavigate(slot);
  }

  function navigateDE(route: DesignedExperienceCardRoute) {
    navigate({ kind: "designed", route });
  }

  function navigateJO(route: JourneyOverviewCardRoute) {
    navigate({ kind: "overview", route });
  }

  // ── Breadcrumbs ───────────────────────────────────────────────────────────
  const crumbs: Array<{ label: string; slot: CenterFullViewSlot }> =
    localSlot.kind === "designed"
      ? buildDEBreadcrumbs(localSlot.route, dePreview).map((c) => ({
          label: c.label,
          slot: { kind: "designed", route: c.route },
        }))
      : localSlot.kind === "overview"
      ? buildJOBreadcrumbs(localSlot.route).map((c) => ({
          label: c.label,
          slot: { kind: "overview", route: c.route },
        }))
      : localSlot.kind === "status"
      ? [{ label: "Performance & Status", slot: { kind: "status" } as CenterFullViewSlot }]
      : [];

  // ── Edit button logic ─────────────────────────────────────────────────────
  const deEditTarget: DESubView | null = (() => {
    if (localSlot.kind !== "designed") return null;
    const route = localSlot.route;
    if (route.level === "L3" && "kind" in route) {
      if (route.kind === "designElement") return { view: "designElement", elementId: route.element };
      if (route.kind === "outcomeCategory") return { view: "outcomes" };
      if (route.kind === "adultRole") return { view: "adultRole", roleId: route.roleId };
    }
    if (route.level === "L2" && "section" in route) {
      if (route.section === "designElements") return { view: "designElement", elementId: "schedule" };
      if (route.section === "targetedImpact") return { view: "outcomes" };
      if (route.section === "adults") return { view: "adults" };
      if (route.section === "students") return { view: "students" as any };
    }
    if (route.level === "L4" && "kind" in route) {
      if (route.kind === "portraitAttribute") return { view: "portraitAttribute", attributeId: route.attributeId };
      if (route.kind === "communityOutcome") return { view: "communityOutcome", outcomeId: route.outcomeId };
      if (route.kind === "adultBucket") return { view: "adultRole", roleId: route.roleId };
      if (route.kind === "leapDetail") return { view: "leapDetail", label: route.label };
      if (route.kind === "outcomeDetail") {
        const sep = route.outcomeKey.indexOf("::");
        const l2 = sep >= 0 ? route.outcomeKey.slice(0, sep) : route.outcomeKey;
        const l3 = sep >= 0 ? route.outcomeKey.slice(sep + 2) : undefined;
        return { view: "outcomeDetail", l2, l3 };
      }
    }
    return null;
  })();

  const joEditTarget: OverallNavTarget | null = (() => {
    if (localSlot.kind !== "overview") return null;
    return workspaceTargetForRoute(localSlot.route);
  })();

  const showEditButton = localSlot.kind === "designed" ? deEditTarget !== null : joEditTarget !== null;

  const handleEdit = () => {
    if (localSlot.kind === "designed" && deEditTarget) onOpenWorkingSpace(deEditTarget);
    else if (localSlot.kind === "overview" && joEditTarget) onOpenJOWorkingSpace(joEditTarget);
  };

  const showAllKeyToggle =
    localSlot.kind === "designed" &&
    localSlot.route.level === "L3" &&
    "kind" in localSlot.route &&
    localSlot.route.kind === "designElement";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
        {/* Breadcrumbs */}
        <div className="flex-1 flex items-center gap-1 min-w-0 flex-wrap">
          <button
            type="button"
            className={cn(
              "shrink-0 rounded p-0.5 transition-colors",
              localSlot.kind === "home"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-400 hover:text-gray-600",
            )}
            onClick={() => navigate({ kind: "home" })}
            title="Overall school home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            const siblings = getSiblingsForSlot(crumb.slot, dePreview, joPreview);
            // Only show the caret when there is at least one alternative sibling.
            const showCaret =
              siblings.length > 1 ||
              (siblings.length === 1 && !slotsEqual(siblings[0]!.slot, crumb.slot));
            return (
              <React.Fragment key={i}>
                <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
                <div className="relative inline-flex items-center" ref={openDropdownIdx === i ? dropdownRef : undefined}>
                  {isLast ? (
                    <span className="text-[12px] font-semibold text-gray-800 truncate max-w-[160px]">
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(crumb.slot)}
                      className="text-[12px] text-gray-500 hover:text-gray-700 hover:underline truncate max-w-[120px]"
                    >
                      {crumb.label}
                    </button>
                  )}
                  {showCaret && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownIdx((cur) => (cur === i ? null : i));
                      }}
                      className={cn(
                        "ml-0.5 shrink-0 rounded p-0.5 transition-colors",
                        openDropdownIdx === i ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100",
                      )}
                      aria-haspopup="menu"
                      aria-expanded={openDropdownIdx === i}
                      title="Switch to a sibling"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                  {openDropdownIdx === i && showCaret && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-w-[280px] max-h-[320px] overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg py-1"
                    >
                      {siblings.map((s, j) => {
                        const isCurrent = slotsEqual(s.slot, crumb.slot);
                        return (
                          <button
                            key={j}
                            type="button"
                            onClick={() => {
                              setOpenDropdownIdx(null);
                              navigate(s.slot);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between gap-2 transition-colors",
                              isCurrent
                                ? "bg-blue-50 text-blue-700 font-semibold"
                                : "text-gray-700 hover:bg-gray-50",
                            )}
                          >
                            <span className="truncate">{s.label}</span>
                            {isCurrent && <span className="text-[10px] text-blue-500">●</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          {showAllKeyToggle && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={cn(
                "text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors",
                showAll
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-amber-50 text-amber-700 border-amber-200",
              )}
              title={showAll ? "Showing all — click for Key only" : "Showing key items — click for All"}
            >
              {showAll ? "All" : "Key ★"}
            </button>
          )}

          {showEditButton && (
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 transition-colors"
              title="Open in workspace"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 rounded-md p-1 hover:bg-gray-100 transition-colors"
            title="Close full view"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {localSlot.kind === "home" ? (
          <CenterHomeView
            onSelect={navigate}
            dePreview={dePreview}
            joPreview={joPreview}
            rawOverallComp={rawOverallComp}
            highlight={highlight}
          />
        ) : localSlot.kind === "status" ? (
          <ComingSoonView title="Performance & Status" />
        ) : localSlot.kind === "designed" ? (
          <CenterFullViewDEContent
            route={localSlot.route}
            onNavigate={navigateDE}
            preview={dePreview}
            rawOverallComp={rawOverallComp}
            ringComps={ringComps}
            hexIndex={hexIndex}
            highlight={highlight}
            showAll={showAll}
            onEditClick={handleEdit}
          />
        ) : joPreview ? (
          <CenterFullViewJOContent
            route={localSlot.route}
            onNavigate={navigateJO}
            preview={joPreview}
            onEditClick={handleEdit}
          />
        ) : (
          <ComingSoonView title="Journey and Overview" />
        )}
      </div>
    </div>
  );
}
