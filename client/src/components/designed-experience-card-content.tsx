import React from "react";
import { Lock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  COMMUNITY_ECOSYSTEM_DEFAULTS,
  type CommunityEcosystemStatusLabel,
} from "./community-ecosystem/community-ecosystem-types";
import {
  type DesignItemDragPayload,
  DESIGN_ITEM_DRAG_TYPE,
  encodeDesignItemPayload,
} from "./design-item-drop-modal";

// ─── Route types ──────────────────────────────────────────────────────────────
//
// The Designed Experience card mirrors the Journey & Overview card structure:
//   L1 — five tiles (Students, Targeted Impact, Student Experiences, Design Elements, Adults)
//   L2 — section hub (e.g. Targeted Impact list, Adults role list)
//   L3 — sub-list (e.g. STEM category list, Educator buckets)
//   L4 — terminal detail (e.g. POG attribute description, Community outcome detail)
//
// The Targeted Impact branch goes 4 levels deep; Student Experiences and Design Elements
// terminate at L3; Adults terminates at L4.

export type DesignedExperienceCardL1 = { level: "L1" };

export type DesignedExperienceL2Section =
  | "students"
  | "targetedImpact"
  | "studentExperiences"
  | "designElements"
  | "adults";

export type TargetedImpactL3 =
  | "targetedImpact.learningAdvancement"
  | "targetedImpact.wellbeingConduct"
  | "targetedImpact.portrait"
  | "targetedImpact.leaps"
  | "targetedImpact.community";

/** Seven canonical Student Experience groups (also used as Targeted Impact L3 categories). */
export type OutcomeCategoryKey =
  | "STEM"
  | "Arts & Humanities"
  | "Thinking & Relating"
  | "Professional & Practical"
  | "Advancement"
  | "Wellbeing"
  | "Conduct & Engagement";

export type DesignElementKey =
  | "schedule"
  | "learning"
  | "culture"
  | "facilitator"
  | "partnerships"
  | "ops"
  | "improvement";

export type AdultBucketKey =
  | "experiences"
  | "demographic"
  | "incomingSkills"
  | "background"
  | "staffing";

export type DesignedExperienceCardRoute =
  | DesignedExperienceCardL1
  | { level: "L2"; section: DesignedExperienceL2Section }
  | { level: "L3"; section: TargetedImpactL3 }
  | { level: "L3"; kind: "outcomeCategory"; category: OutcomeCategoryKey }
  | { level: "L3"; kind: "studentExperienceGroup"; category: OutcomeCategoryKey }
  | { level: "L3"; kind: "designElement"; element: DesignElementKey }
  | { level: "L3"; kind: "adultRole"; roleId: string }
  | { level: "L4"; kind: "portraitAttribute"; attributeId: string }
  | { level: "L4"; kind: "communityOutcome"; outcomeId: string }
  | { level: "L4"; kind: "adultBucket"; roleId: string; bucket: AdultBucketKey }
  | { level: "L4"; kind: "leapDetail"; label: string }
  | { level: "L4"; kind: "outcomeDetail"; outcomeKey: string; category: OutcomeCategoryKey };

// ─── Preview shape ────────────────────────────────────────────────────────────

export interface OutcomeRow {
  /** Stable key for React; either L2 label alone or `${l2}::${l3}`. */
  key: string;
  /** The label shown to the user — either the L2 label or the L3 label. */
  label: string;
  /**
   * Priority at the center/overall component level (H/M/L), or null when this
   * outcome is only present in ring components and not selected at the center.
   */
  priority: "H" | "M" | "L" | null;
  /** Number of unique ring components tagged at this specific outcome (any priority). */
  hex: number;
  /** NodeIds of the ring components counted by `hex`. */
  hexIds: string[];
}

export interface OutcomeCategorySummary {
  category: OutcomeCategoryKey;
  /** Number of selected outcome rows under this category at the center component. */
  selectedCount: number;
  /** Number of unique ring components with any outcome in this category. */
  hex: number;
  /** NodeIds of the ring components counted by `hex`. */
  hexIds: string[];
  /** The selected outcome rows for the L4 view. */
  outcomes: OutcomeRow[];
}

export interface LeapOrPrincipleRow {
  /** Display label of the leap/principle. */
  label: string;
  /** "H"/"M"/"L" if selected at the center component, otherwise "Absent". */
  priority: "H" | "M" | "L" | "Absent";
  /** Number of unique ring components tagged to this leap. */
  hex: number;
  /** NodeIds of the ring components counted by `hex`. */
  hexIds: string[];
}

// ─── Ring-highlight cross-link API ───────────────────────────────────────────

/**
 * Passed from canvas-view down through DesignedExperienceCardContent so that
 * clicking a hex/count badge can pin a ring-highlight on the canvas.
 */
export interface HighlightProps {
  /** Stable key of the currently pinned highlight (null = nothing pinned). */
  activeSourceKey: string | null;
  /** Toggle the highlight for `sourceKey`. Caller computes toggle logic. */
  onPin: (sourceKey: string, nodeIds: string[]) => void;
}

export interface PortraitAttributeSummary {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export interface CommunityOutcomeSummary {
  id: string;
  label: string;
  status: CommunityEcosystemStatusLabel;
  description: string;
  current: string;
  target: string;
  unitSuffix: string;
}

export interface ComponentRef {
  nodeId: string;
  title: string;
}

/** One display row for a design element in the center card standard view. */
export interface DesignElementTagRow {
  /** The display label — e.g. "Traditional school day & week", "Block scheduling", "Master scheduling systems". */
  label: string;
  /** Number of ring components that have this tag selected (any selection, not just key). */
  hexCount: number;
  /** Ring component nodeIds for hexagon highlight pinning. */
  hexIds: string[];
  /** When true, renders as "label …" — used for A5 free-text and School Calendar buckets. */
  isEllipsis?: boolean;
  /**
   * When true, the row is an A1/A2 tag-type item: render a HexBadge (always, even if count=0)
   * instead of a bullet dot. A3/A4/A5 value rows leave this false and keep the bullet.
   */
  isTagType?: boolean;
  /** When set, the row is draggable and carries this payload for drop-onto-component. */
  dragPayload?: DesignItemDragPayload;
}

export interface AdultRoleSummary {
  roleId: string;
  label: string;
  experiences: ComponentRef[];
  demographicTags: string[];
  incomingSkillsText: string;
  backgroundTags: string[];
  staffingText: string;
}

export interface DesignedExperiencePreview {
  /** Pulled straight from the J&O preview so Students reuses the same flow. */
  studentDemographics: { currentAsOf: string | null; verified: boolean; hasData: boolean };

  targetedImpact: {
    learningAdvancement: { selectedCount: number; categories: OutcomeCategorySummary[] };
    wellbeingConduct: { selectedCount: number; categories: OutcomeCategorySummary[] };
    portrait: { attributes: PortraitAttributeSummary[] };
    leaps: { rows: LeapOrPrincipleRow[] };
    community: { outcomes: CommunityOutcomeSummary[] };
  };

  /** Seven groups; always present even when count = 0. Sorted alphabetically by label. */
  studentExperiences: Array<{
    category: OutcomeCategoryKey;
    components: ComponentRef[];
  }>;

  designElements: Array<{
    id: DesignElementKey;
    title: string;
    /** Key items to render in the center card's standard view — Practices & approaches section. */
    practices: DesignElementTagRow[];
    /** Key items to render in the center card's standard view — Tools & resources section. */
    tools: DesignElementTagRow[];
  }>;

  /** Selected adult roles for the center component (subset of the seven). */
  adults: AdultRoleSummary[];
}

// ─── Working-space nav target (DE additions) ─────────────────────────────────
//
// We extend the existing OverallNavTarget to allow Edit-pencil cross-links into
// the Designed Experience tab with optional deep-link sub-view targets.

/** Subset of the legacy `OverallNavTarget` used by the J&O card. */
type LegacyJourneyTarget =
  | { level: "L1" }
  | { level: "L2"; section: "mission" | "contextOverview" | "enrollment" | "publicAcademic" | "communityReviews" | "stakeholderMap" }
  | { level: "L3"; section: string };

/** Sub-view targets inside the Designed Experience tab. */
export type DESubView =
  | { view: "outcomes" }
  | { view: "outcomeDetail"; l2: string; l3?: string }
  | { view: "leaps" }
  | { view: "leapDetail"; label: string }
  | { view: "portrait" }
  | { view: "portraitAttribute"; attributeId: string }
  | { view: "community" }
  | { view: "communityOutcome"; outcomeId: string }
  | { view: "designElement"; elementId: string }
  | { view: "adults" }
  | { view: "adultRole"; roleId: string }
  /** Ring full view / deep link: open component adult experience manage for a specific adult sub. */
  | { view: "adultSubManage"; subId: string };

export type DesignedExperienceNavTarget =
  | LegacyJourneyTarget
  | { kind: "openDesignedTab"; deView?: DESubView };

// ─── Title + breadcrumb helpers ───────────────────────────────────────────────

const ROOT_LABEL = "Designed Experience";

const L2_LABELS: Record<DesignedExperienceL2Section, string> = {
  students: "Students",
  targetedImpact: "Targeted Impact",
  studentExperiences: "Student Experiences",
  designElements: "Design Elements",
  adults: "Adults & Adult Experiences",
};

const TARGETED_IMPACT_L3_LABELS: Record<TargetedImpactL3, string> = {
  "targetedImpact.learningAdvancement": "Learning & Advancement Outcomes",
  "targetedImpact.wellbeingConduct": "Wellbeing & Conduct Outcomes",
  "targetedImpact.portrait": "Portrait of a Graduate",
  "targetedImpact.leaps": "Leaps & Design Principles",
  "targetedImpact.community": "Community & Ecosystem Outcomes",
};

const ADULT_BUCKET_LABELS: Record<AdultBucketKey, string> = {
  experiences: "Experiences",
  demographic: "Demographic & Situational Variables",
  incomingSkills: "Incoming Skills & Mindsets",
  background: "Adult Background",
  staffing: "Approach to Staffing",
};

/** L&A categories (5) and W&C categories (2) — the user-defined split. */
const LEARNING_ADVANCEMENT_CATEGORIES: OutcomeCategoryKey[] = [
  "STEM",
  "Arts & Humanities",
  "Thinking & Relating",
  "Professional & Practical",
  "Advancement",
];

const WELLBEING_CONDUCT_CATEGORIES: OutcomeCategoryKey[] = [
  "Wellbeing",
  "Conduct & Engagement",
];

/** Reverse mapping from category to the targeted-impact L3 it lives under (for breadcrumbs). */
function categoryParentL3(category: OutcomeCategoryKey): TargetedImpactL3 {
  if ((WELLBEING_CONDUCT_CATEGORIES as string[]).includes(category)) {
    return "targetedImpact.wellbeingConduct";
  }
  return "targetedImpact.learningAdvancement";
}

/** Display label for category — user-facing rename of W&C's "Conduct & Engagement" → "Engagement". */
function categoryDisplayLabel(category: OutcomeCategoryKey): string {
  return category === "Conduct & Engagement" ? "Engagement" : category;
}

export function titleForDesignedRoute(
  route: DesignedExperienceCardRoute,
  preview: DesignedExperiencePreview,
): string {
  if (route.level === "L1") return ROOT_LABEL;
  if (route.level === "L2") return L2_LABELS[route.section];
  if (route.level === "L3") {
    if ("section" in route) return TARGETED_IMPACT_L3_LABELS[route.section];
    if (route.kind === "outcomeCategory") return categoryDisplayLabel(route.category);
    if (route.kind === "studentExperienceGroup") return categoryDisplayLabel(route.category);
    if (route.kind === "designElement") {
      const el = preview.designElements.find((e) => e.id === route.element);
      return el?.title ?? route.element;
    }
    if (route.kind === "adultRole") {
      const r = preview.adults.find((a) => a.roleId === route.roleId);
      return r?.label ?? route.roleId;
    }
  }
  if (route.level === "L4") {
    if (route.kind === "portraitAttribute") {
      const a = preview.targetedImpact.portrait.attributes.find((x) => x.id === route.attributeId);
      return a?.name ?? "Attribute";
    }
    if (route.kind === "communityOutcome") {
      const o = preview.targetedImpact.community.outcomes.find((x) => x.id === route.outcomeId);
      return o?.label ?? "Outcome";
    }
    if (route.kind === "adultBucket") {
      const r = preview.adults.find((a) => a.roleId === route.roleId);
      const bucket = ADULT_BUCKET_LABELS[route.bucket];
      // The role-experiences bucket reads as "{Role} Experiences" inside a role.
      if (route.bucket === "experiences" && r) return `${r.label} Experiences`;
      return bucket;
    }
    if (route.kind === "leapDetail") return route.label;
    if (route.kind === "outcomeDetail") {
      const allCats = [
        ...preview.targetedImpact.learningAdvancement.categories,
        ...preview.targetedImpact.wellbeingConduct.categories,
      ];
      return allCats.flatMap((c) => c.outcomes).find((o) => o.key === route.outcomeKey)?.label ?? route.outcomeKey;
    }
  }
  return ROOT_LABEL;
}

interface Crumb {
  label: string;
  to: DesignedExperienceCardRoute;
}

export function breadcrumbForDesignedRoute(
  route: DesignedExperienceCardRoute,
  preview: DesignedExperiencePreview,
): Crumb[] {
  if (route.level === "L1") return [];
  const root: Crumb = { label: ROOT_LABEL, to: { level: "L1" } };
  if (route.level === "L2") return [root];

  if (route.level === "L3") {
    if ("section" in route) {
      // Targeted Impact L3 list/hub.
      return [root, { label: L2_LABELS.targetedImpact, to: { level: "L2", section: "targetedImpact" } }];
    }
    if (route.kind === "outcomeCategory") {
      const parent = categoryParentL3(route.category);
      return [
        root,
        { label: L2_LABELS.targetedImpact, to: { level: "L2", section: "targetedImpact" } },
        { label: TARGETED_IMPACT_L3_LABELS[parent], to: { level: "L3", section: parent } },
      ];
    }
    if (route.kind === "studentExperienceGroup") {
      return [root, { label: L2_LABELS.studentExperiences, to: { level: "L2", section: "studentExperiences" } }];
    }
    if (route.kind === "designElement") {
      return [root, { label: L2_LABELS.designElements, to: { level: "L2", section: "designElements" } }];
    }
    if (route.kind === "adultRole") {
      return [root, { label: L2_LABELS.adults, to: { level: "L2", section: "adults" } }];
    }
  }

  if (route.level === "L4") {
    if (route.kind === "portraitAttribute") {
      return [
        root,
        { label: L2_LABELS.targetedImpact, to: { level: "L2", section: "targetedImpact" } },
        {
          label: TARGETED_IMPACT_L3_LABELS["targetedImpact.portrait"],
          to: { level: "L3", section: "targetedImpact.portrait" },
        },
      ];
    }
    if (route.kind === "communityOutcome") {
      return [
        root,
        { label: L2_LABELS.targetedImpact, to: { level: "L2", section: "targetedImpact" } },
        {
          label: TARGETED_IMPACT_L3_LABELS["targetedImpact.community"],
          to: { level: "L3", section: "targetedImpact.community" },
        },
      ];
    }
    if (route.kind === "adultBucket") {
      const role = preview.adults.find((a) => a.roleId === route.roleId);
      return [
        root,
        { label: L2_LABELS.adults, to: { level: "L2", section: "adults" } },
        {
          label: role?.label ?? route.roleId,
          to: { level: "L3", kind: "adultRole", roleId: route.roleId },
        },
      ];
    }
  }
  return [root];
}

export function parentDesignedRoute(route: DesignedExperienceCardRoute): DesignedExperienceCardRoute {
  if (route.level === "L1") return route;
  if (route.level === "L2") return { level: "L1" };
  if (route.level === "L3") {
    if ("section" in route) return { level: "L2", section: "targetedImpact" };
    if (route.kind === "outcomeCategory") return { level: "L3", section: categoryParentL3(route.category) };
    if (route.kind === "studentExperienceGroup") return { level: "L2", section: "studentExperiences" };
    if (route.kind === "designElement") return { level: "L2", section: "designElements" };
    if (route.kind === "adultRole") return { level: "L2", section: "adults" };
  }
  if (route.level === "L4") {
    if (route.kind === "portraitAttribute") return { level: "L3", section: "targetedImpact.portrait" };
    if (route.kind === "communityOutcome") return { level: "L3", section: "targetedImpact.community" };
    if (route.kind === "adultBucket") return { level: "L3", kind: "adultRole", roleId: route.roleId };
    if (route.kind === "leapDetail") return { level: "L3", section: "targetedImpact.leaps" };
    if (route.kind === "outcomeDetail") return { level: "L3", kind: "outcomeCategory", category: route.category };
  }
  return { level: "L1" };
}

// ─── Building-block UI bits ───────────────────────────────────────────────────

const PRIORITY_CHIP_STYLES: Record<"H" | "M" | "L", string> = {
  H: "bg-red-50 border-red-200 text-red-700",
  M: "bg-amber-50 border-amber-200 text-amber-700",
  L: "bg-green-50 border-green-200 text-green-700",
};

function PriorityChip({ priority }: { priority: "H" | "M" | "L" | "Absent" | null }) {
  if (priority === null) return null; // ring-only outcome — no center priority
  if (priority === "Absent") {
    return (
      <span className="inline-flex items-center text-[9px] font-semibold text-gray-400 italic px-1.5">
        (Absent)
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[9px] font-bold w-4 h-4 rounded border",
        PRIORITY_CHIP_STYLES[priority],
      )}
      title={priority === "H" ? "High priority" : priority === "L" ? "Low priority" : "Medium priority"}
    >
      {priority}
    </span>
  );
}

/**
 * Hex-shaped count badge. When `count = 0`, renders in orange (disabled).
 * When `sourceKey` + `highlight` are provided and count > 0, the badge becomes a
 * toggle button that pins a ring-highlight on the canvas.
 */
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
  const isZero = count === 0;
  const isInteractive = !isZero && !!sourceKey && !!highlight && (nodeIds?.length ?? 0) > 0;
  const isActive = isInteractive && highlight!.activeSourceKey === sourceKey;

  const stroke = isZero ? "#fb923c" : isActive ? "#2563eb" : "#94a3b8";
  const fill = isZero ? "#fff7ed" : isActive ? "#3b82f6" : "#f1f5f9";
  const textColor = isZero ? "#9a3412" : isActive ? "#ffffff" : "#334155";

  const innerBadge = (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        isActive && "ring-2 ring-blue-400 ring-offset-1 rounded-full",
      )}
      style={{ width: 18, height: 20 }}
    >
      <svg viewBox="0 0 24 28" width="18" height="20" aria-hidden="true">
        <polygon
          points="12,1 22,7 22,21 12,27 2,21 2,7"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        />
        <text
          x="12"
          y="18"
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill={textColor}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {count}
        </text>
      </svg>
    </span>
  );

  if (!isInteractive) {
    return (
      <span
        title={isZero ? "No ring components share this" : `${count} ring component${count === 1 ? "" : "s"}`}
      >
        {innerBadge}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
      aria-pressed={isActive}
      title={`${isActive ? "Clear" : "Highlight"} ${count} ring component${count === 1 ? "" : "s"}`}
      onClick={(e) => {
        e.stopPropagation();
        highlight!.onPin(sourceKey!, nodeIds!);
      }}
    >
      {innerBadge}
    </button>
  );
}

function NumberPill({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-1.5 min-w-[18px] h-[18px]">
      {n}
    </span>
  );
}

/**
 * A count pill that doubles as a ring-highlight toggle button when `highlight` is
 * provided. Used for Student Experience group counts and Adult Experience counts.
 */
function HighlightPill({
  n,
  sourceKey,
  nodeIds,
  highlight,
}: {
  n: number;
  sourceKey: string;
  nodeIds: string[];
  highlight: HighlightProps;
}) {
  const isActive = highlight.activeSourceKey === sourceKey;
  const isInteractive = nodeIds.length > 0;

  const baseClass = "inline-flex items-center justify-center text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px]";
  const activeClass = "bg-blue-500 text-white border border-blue-600 ring-2 ring-blue-400 ring-offset-1";
  const inactiveClass = "text-gray-700 bg-gray-100 border border-gray-200";

  if (!isInteractive) {
    return <span className={cn(baseClass, inactiveClass)}>{n}</span>;
  }

  return (
    <button
      type="button"
      className={cn(
        baseClass,
        isActive ? activeClass : inactiveClass,
        !isActive && "hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700",
        "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
      )}
      aria-pressed={isActive}
      title={`${isActive ? "Clear" : "Highlight"} ${n} ring component${n === 1 ? "" : "s"}`}
      onClick={(e) => {
        e.stopPropagation();
        highlight.onPin(sourceKey, nodeIds);
      }}
    >
      {n}
    </button>
  );
}

function EllipsisPill() {
  return (
    <span className="inline-flex items-center justify-center text-[11px] font-bold text-gray-500">
      (…)
    </span>
  );
}

function StatusPill({ status }: { status: CommunityEcosystemStatusLabel }) {
  const cls =
    status === "On track"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : status === "Off track"
        ? "bg-red-50 border-red-200 text-red-700"
        : "bg-gray-50 border-gray-200 text-gray-500";
  return (
    <span className={cn("inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border", cls)}>
      {status}
    </span>
  );
}

function StubBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded shrink-0">
      <Lock className="w-2.5 h-2.5" />
      Coming soon
    </span>
  );
}

function Breadcrumb({
  crumbs,
  onSetRoute,
}: {
  crumbs: Crumb[];
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
}) {
  if (crumbs.length === 0) return null;
  const visible: (Crumb | { ellipsis: true; firstHidden: Crumb })[] =
    crumbs.length <= 2
      ? crumbs
      : [{ ellipsis: true, firstHidden: crumbs[0] }, ...crumbs.slice(-2)];
  return (
    <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 min-w-0 w-full px-1">
      {visible.map((c, i) => {
        const isLast = i === visible.length - 1;
        if ("ellipsis" in c) {
          return (
            <React.Fragment key={`ell-${i}`}>
              <button
                type="button"
                className="hover:text-gray-700 hover:underline truncate max-w-[1.1em]"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetRoute(c.firstHidden.to);
                }}
                title={c.firstHidden.label}
              >
                …
              </button>
              {!isLast && <span className="text-gray-300">/</span>}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={`c-${i}-${c.label}`}>
            <button
              type="button"
              className="hover:text-gray-700 hover:underline truncate max-w-[10ch]"
              onClick={(e) => {
                e.stopPropagation();
                onSetRoute(c.to);
              }}
              title={c.label}
            >
              {c.label}
            </button>
            {!isLast && <span className="text-gray-300">/</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface ListRowProps {
  label: string;
  onClick?: () => void;
  onNavigate?: () => void;
  rightAdornment?: React.ReactNode;
  disabled?: boolean;
  first?: boolean;
  /** When true, label may wrap up to two lines and is truncated with "…" beyond that. */
  twoLineTruncate?: boolean;
  testId?: string;
  dragPayload?: DesignItemDragPayload;
}

function ListRow({
  label,
  onClick,
  onNavigate,
  rightAdornment,
  disabled = false,
  first = false,
  twoLineTruncate = false,
  testId,
  dragPayload,
}: ListRowProps) {
  const body = (
    <div
      className={cn(
        "px-3 py-2 flex items-center hover:bg-gray-50/70",
        !first && "border-t border-gray-100",
        disabled ? "opacity-60 cursor-not-allowed hover:bg-transparent" : "cursor-pointer",
        dragPayload && "cursor-grab active:cursor-grabbing",
      )}
      draggable={!!dragPayload}
      onDragStart={
        dragPayload
          ? (e) => {
              e.dataTransfer.setData(
                DESIGN_ITEM_DRAG_TYPE,
                encodeDesignItemPayload(dragPayload),
              );
              e.dataTransfer.effectAllowed = "copy";
              e.stopPropagation();
            }
          : undefined
      }
      onClick={(e) => {
        if (disabled || !onClick) return;
        e.stopPropagation();
        onClick();
      }}
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? -1 : 0}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2 w-full px-1 min-w-0">
        <div
          className={cn(
            "text-[12px] font-semibold text-blue-700 min-w-0 break-words",
            disabled && "text-gray-500",
            twoLineTruncate && "line-clamp-2",
            !twoLineTruncate && "truncate",
          )}
          title={label}
        >
          {label}
        </div>
        {rightAdornment ? <div className="shrink-0 flex items-center gap-1.5">{rightAdornment}</div> : null}
      </div>
    </div>
  );
  if (!onNavigate) return body;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{body}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onNavigate();
          }}
        >
          Navigate
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Compute the working-space nav target for the header Edit button based on the current route. */
function editNavTarget(route: DesignedExperienceCardRoute): DesignedExperienceNavTarget {
  // Students section cross-links to J&O student demographics.
  if (route.level === "L2" && route.section === "students") {
    return { level: "L3", section: "enrollment.studentDemographics" };
  }

  // L2 hubs
  if (route.level === "L2") {
    if (route.section === "targetedImpact") return { kind: "openDesignedTab", deView: { view: "outcomes" } };
    if (route.section === "adults") return { kind: "openDesignedTab", deView: { view: "adults" } };
    return { kind: "openDesignedTab" };
  }

  // L3 section routes (Targeted Impact sub-hubs)
  if (route.level === "L3" && "section" in route) {
    const s = route.section;
    if (s === "targetedImpact.learningAdvancement" || s === "targetedImpact.wellbeingConduct")
      return { kind: "openDesignedTab", deView: { view: "outcomes" } };
    if (s === "targetedImpact.portrait")
      return { kind: "openDesignedTab", deView: { view: "portrait" } };
    if (s === "targetedImpact.leaps")
      return { kind: "openDesignedTab", deView: { view: "leaps" } };
    if (s === "targetedImpact.community")
      return { kind: "openDesignedTab", deView: { view: "community" } };
    return { kind: "openDesignedTab" };
  }

  // L3 kind routes
  if (route.level === "L3" && !("section" in route)) {
    if (route.kind === "outcomeCategory")
      return { kind: "openDesignedTab", deView: { view: "outcomes" } };
    if (route.kind === "adultRole")
      return { kind: "openDesignedTab", deView: { view: "adultRole", roleId: route.roleId } };
    if (route.kind === "designElement")
      return { kind: "openDesignedTab", deView: { view: "designElement", elementId: route.element } };
    return { kind: "openDesignedTab" };
  }

  // L4 kind routes
  if (route.level === "L4") {
    if (route.kind === "portraitAttribute")
      return { kind: "openDesignedTab", deView: { view: "portraitAttribute", attributeId: route.attributeId } };
    if (route.kind === "communityOutcome")
      return { kind: "openDesignedTab", deView: { view: "communityOutcome", outcomeId: route.outcomeId } };
    if (route.kind === "adultBucket")
      return { kind: "openDesignedTab", deView: { view: "adultRole", roleId: route.roleId } };
    if (route.kind === "leapDetail")
      return { kind: "openDesignedTab", deView: { view: "leapDetail", label: route.label } };
    if (route.kind === "outcomeDetail") {
      const sep = route.outcomeKey.indexOf("::");
      const l2 = sep >= 0 ? route.outcomeKey.slice(0, sep) : route.outcomeKey;
      const l3 = sep >= 0 ? route.outcomeKey.slice(sep + 2) : undefined;
      return { kind: "openDesignedTab", deView: { view: "outcomeDetail", l2, l3 } };
    }
    return { kind: "openDesignedTab" };
  }

  return { kind: "openDesignedTab" };
}

// ─── L1 home (5 tiles) ────────────────────────────────────────────────────────

function L1Home({
  onSetRoute,
}: {
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
}) {
  return (
    <>
      <ListRow
        first
        label="Students"
        onClick={() => onSetRoute({ level: "L2", section: "students" })}
        testId="de-l1-students"
      />
      <ListRow
        label="Targeted Impact"
        onClick={() => onSetRoute({ level: "L2", section: "targetedImpact" })}
        testId="de-l1-targeted-impact"
      />
      <ListRow
        label="Student Experiences"
        onClick={() => onSetRoute({ level: "L2", section: "studentExperiences" })}
        testId="de-l1-student-experiences"
      />
      <ListRow
        label="Design Elements"
        onClick={() => onSetRoute({ level: "L2", section: "designElements" })}
        testId="de-l1-design-elements"
      />
      <ListRow
        label="Adults & Adult Experiences"
        onClick={() => onSetRoute({ level: "L2", section: "adults" })}
        testId="de-l1-adults"
      />
    </>
  );
}

// ─── L2 / L3 / L4 renderers ───────────────────────────────────────────────────

function L2Students({ preview }: { preview: DesignedExperiencePreview }) {
  const { currentAsOf } = preview.studentDemographics;
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Student Demographics</div>
      <div className="text-[11px] text-gray-600 leading-snug text-center bg-gray-50 border border-dashed border-gray-200 rounded px-2 py-3">
        GreatSchools chart
        <div className="mt-1 text-[10px] text-gray-400">
          Click <span className="font-semibold">Edit</span> to view the full chart.
        </div>
      </div>
      {currentAsOf ? <div className="text-[10px] text-gray-400 text-center">As of {currentAsOf}</div> : null}
    </div>
  );
}

function L2TargetedImpactHub({
  preview,
  onSetRoute,
}: {
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
}) {
  const ti = preview.targetedImpact;
  const portraitCount = ti.portrait.attributes.length;
  const leapsTotalSelected = ti.leaps.rows.filter((r) => r.priority !== "Absent").length;
  const communityCount = ti.community.outcomes.length;
  return (
    <>
      <ListRow
        first
        label="Learning & Advancement Outcomes"
        onClick={() => onSetRoute({ level: "L3", section: "targetedImpact.learningAdvancement" })}
        rightAdornment={<NumberPill n={ti.learningAdvancement.selectedCount} />}
        testId="de-ti-la"
      />
      <ListRow
        label="Wellbeing & Conduct Outcomes"
        onClick={() => onSetRoute({ level: "L3", section: "targetedImpact.wellbeingConduct" })}
        rightAdornment={<NumberPill n={ti.wellbeingConduct.selectedCount} />}
        testId="de-ti-wc"
      />
      <ListRow
        label="Portrait of a Graduate"
        onClick={() => onSetRoute({ level: "L3", section: "targetedImpact.portrait" })}
        rightAdornment={<NumberPill n={portraitCount} />}
        testId="de-ti-pog"
      />
      <ListRow
        label="Leaps & Design Principles"
        onClick={() => onSetRoute({ level: "L3", section: "targetedImpact.leaps" })}
        rightAdornment={<NumberPill n={leapsTotalSelected} />}
        testId="de-ti-leaps"
      />
      <ListRow
        label="Community & Ecosystem Outcomes"
        onClick={() => onSetRoute({ level: "L3", section: "targetedImpact.community" })}
        rightAdornment={<NumberPill n={communityCount} />}
        testId="de-ti-community"
      />
    </>
  );
}

function L3OutcomeCategoriesList({
  group,
  preview,
  onSetRoute,
  highlight,
}: {
  group: "learningAdvancement" | "wellbeingConduct";
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
  highlight?: HighlightProps;
}) {
  const cats = preview.targetedImpact[group].categories;
  return (
    <>
      {cats.map((c, i) => (
        <ListRow
          key={c.category}
          first={i === 0}
          label={categoryDisplayLabel(c.category)}
          onClick={() => onSetRoute({ level: "L3", kind: "outcomeCategory", category: c.category })}
          rightAdornment={
            <>
              <NumberPill n={c.selectedCount} />
              <HexBadge
                count={c.hex}
                sourceKey={`de-cat:${c.category}`}
                nodeIds={c.hexIds}
                highlight={highlight}
              />
            </>
          }
          testId={`de-cat-${c.category}`}
        />
      ))}
      {cats.length === 0 ? (
        <div className="px-3 py-3 text-[11px] text-gray-400 italic text-center">No categories.</div>
      ) : null}
    </>
  );
}

function L3OutcomeLeafList({
  category,
  preview,
  highlight,
  onSelectOutcome,
}: {
  category: OutcomeCategoryKey;
  preview: DesignedExperiencePreview;
  highlight?: HighlightProps;
  onSelectOutcome?: (l2: string, l3?: string) => void;
}) {
  // Find the category summary (it lives under either L&A or W&C).
  const all = [
    ...preview.targetedImpact.learningAdvancement.categories,
    ...preview.targetedImpact.wellbeingConduct.categories,
  ];
  const summary = all.find((c) => c.category === category);
  const outcomes = summary?.outcomes ?? [];
  return (
    <div>
      {outcomes.length === 0 ? (
        <div className="px-3 pb-3 text-[11px] text-gray-400 italic text-center">No outcomes selected.</div>
      ) : (
        outcomes.map((o, i) => {
          const sep = o.key.indexOf("::");
          const l2 = sep >= 0 ? o.key.slice(0, sep) : o.key;
          const l3 = sep >= 0 ? o.key.slice(sep + 2) : undefined;
          return (
            <ListRow
              key={o.key}
              first={i === 0}
              label={o.label}
              onClick={onSelectOutcome ? () => onSelectOutcome(l2, l3) : undefined}
              dragPayload={{ kind: "outcome", label: o.label, key: o.key }}
              rightAdornment={
                <>
                  <PriorityChip priority={o.priority} />
                  <HexBadge
                    count={o.hex}
                    sourceKey={`de-outcome:${o.key}`}
                    nodeIds={o.hexIds}
                    highlight={highlight}
                  />
                </>
              }
              testId={`de-outcome-${o.key}`}
            />
          );
        })
      )}
    </div>
  );
}

function L3PortraitList({
  preview,
  onSetRoute,
}: {
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
}) {
  const attrs = preview.targetedImpact.portrait.attributes;
  return (
    <div>
      {attrs.length === 0 ? (
        <div className="px-3 pb-3 text-[11px] text-gray-400 italic text-center">
          No Portrait of a Graduate attributes yet.
        </div>
      ) : (
        attrs.map((a, i) => (
          <ListRow
            key={a.id}
            first={i === 0}
            label={a.name}
            onClick={() => onSetRoute({ level: "L4", kind: "portraitAttribute", attributeId: a.id })}
            testId={`de-pog-attr-${a.id}`}
          />
        ))
      )}
    </div>
  );
}

function L4PortraitAttributeCard({
  attributeId,
  preview,
}: {
  attributeId: string;
  preview: DesignedExperiencePreview;
}) {
  const attr = preview.targetedImpact.portrait.attributes.find((a) => a.id === attributeId);
  return (
    <div className="p-3 flex flex-col gap-2">
      {attr ? (
        <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap line-clamp-6">
          {attr.description?.trim() || (
            <span className="italic text-gray-400">No description captured for this attribute.</span>
          )}
        </p>
      ) : (
        <p className="text-[11px] text-gray-400 italic text-center">Attribute not found.</p>
      )}
    </div>
  );
}

function L3LeapsList({
  preview,
  highlight,
  onSelectLeap,
}: {
  preview: DesignedExperiencePreview;
  highlight?: HighlightProps;
  onSelectLeap?: (label: string) => void;
}) {
  const rows = preview.targetedImpact.leaps.rows;
  return (
    <div>
      {rows.map((r, i) => (
        <ListRow
          key={r.label}
          first={i === 0}
          label={r.label}
          onClick={onSelectLeap ? () => onSelectLeap(r.label) : undefined}
          dragPayload={{ kind: "leap", label: r.label }}
          rightAdornment={
            <>
              <PriorityChip priority={r.priority} />
              <HexBadge
                count={r.hex}
                sourceKey={`de-leap:${r.label}`}
                nodeIds={r.hexIds}
                highlight={highlight}
              />
            </>
          }
          testId={`de-leap-${r.label}`}
        />
      ))}
    </div>
  );
}

function L3CommunityList({
  preview,
  onSetRoute,
}: {
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
}) {
  const outcomes = preview.targetedImpact.community.outcomes;
  return (
    <div>
      {outcomes.length === 0 ? (
        <div className="px-3 pb-3 text-[11px] text-gray-400 italic text-center">
          No community & ecosystem outcomes selected.
        </div>
      ) : (
        outcomes.map((o, i) => (
          <ListRow
            key={o.id}
            first={i === 0}
            label={o.label}
            onClick={() => onSetRoute({ level: "L4", kind: "communityOutcome", outcomeId: o.id })}
            rightAdornment={<StatusPill status={o.status} />}
            testId={`de-community-${o.id}`}
          />
        ))
      )}
    </div>
  );
}

function L4CommunityOutcomeCard({
  outcomeId,
  preview,
}: {
  outcomeId: string;
  preview: DesignedExperiencePreview;
}) {
  const o = preview.targetedImpact.community.outcomes.find((x) => x.id === outcomeId);
  return (
    <div className="p-3 flex flex-col gap-2">
      {o ? <StatusPill status={o.status} /> : null}
      {o ? (
        <div className="space-y-1.5 text-left">
          <div>
            <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Description</div>
            <div className="text-[11px] text-gray-700 line-clamp-3">
              {o.description?.trim() || <span className="italic text-gray-400">—</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Current</div>
              <div className="text-[12px] font-semibold text-gray-900">
                {o.current || "—"}
                {o.current ? <span className="text-[10px] text-gray-500 ml-0.5">{o.unitSuffix}</span> : null}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Target</div>
              <div className="text-[12px] font-semibold text-gray-900">
                {o.target || "—"}
                {o.target ? <span className="text-[10px] text-gray-500 ml-0.5">{o.unitSuffix}</span> : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 italic text-center">Outcome not found.</p>
      )}
    </div>
  );
}

function L2StudentExperiencesHub({
  preview,
  onSetRoute,
  highlight,
}: {
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
  highlight?: HighlightProps;
}) {
  // Sort alphabetically by display label so "Conduct & Engagement" → "Engagement" lands in E.
  const sorted = [...preview.studentExperiences].sort((a, b) =>
    categoryDisplayLabel(a.category).localeCompare(categoryDisplayLabel(b.category)),
  );
  return (
    <>
      {sorted.map((g, i) => {
        const nodeIds = g.components.map((c) => c.nodeId);
        return (
          <ListRow
            key={g.category}
            first={i === 0}
            label={categoryDisplayLabel(g.category)}
            onClick={() => onSetRoute({ level: "L3", kind: "studentExperienceGroup", category: g.category })}
            rightAdornment={
              highlight ? (
                <HighlightPill
                  n={g.components.length}
                  sourceKey={`de-seg:${g.category}`}
                  nodeIds={nodeIds}
                  highlight={highlight}
                />
              ) : (
                <NumberPill n={g.components.length} />
              )
            }
            testId={`de-se-${g.category}`}
          />
        );
      })}
    </>
  );
}

function L3StudentExperienceGroup({
  category,
  preview,
  onOpenRingComponent,
}: {
  category: OutcomeCategoryKey;
  preview: DesignedExperiencePreview;
  onOpenRingComponent: (nodeId: string) => void;
}) {
  const group = preview.studentExperiences.find((g) => g.category === category);
  const components = [...(group?.components ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  if (components.length === 0) {
    return (
      <div className="px-3 py-3 text-[11px] text-gray-400 italic text-center">
        No ring components have a primary outcome in this group.
      </div>
    );
  }
  return (
    <>
      {components.map((c, i) => (
        <ListRow
          key={c.nodeId}
          first={i === 0}
          label={c.title}
          onClick={() => onOpenRingComponent(c.nodeId)}
          testId={`de-se-comp-${c.nodeId}`}
        />
      ))}
    </>
  );
}

function L2DesignElementsHub({
  preview,
  onSetRoute,
}: {
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
}) {
  return (
    <>
      {preview.designElements.map((el, i) => (
        <ListRow
          key={el.id}
          first={i === 0}
          label={el.title}
          twoLineTruncate
          onClick={() => onSetRoute({ level: "L3", kind: "designElement", element: el.id })}
          testId={`de-de-${el.id}`}
        />
      ))}
    </>
  );
}

function DesignElementRowItem({
  row,
  highlight,
}: {
  row: DesignElementTagRow;
  highlight?: HighlightProps;
}) {
  const isDraggable = !!row.dragPayload;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 py-0.5",
        isDraggable && "cursor-grab active:cursor-grabbing",
      )}
      draggable={isDraggable}
      onDragStart={
        isDraggable && row.dragPayload
          ? (e) => {
              e.dataTransfer.setData(
                DESIGN_ITEM_DRAG_TYPE,
                encodeDesignItemPayload(row.dragPayload!),
              );
              e.dataTransfer.effectAllowed = "copy";
            }
          : undefined
      }
    >
      {row.isTagType ? (
        <HexBadge
          count={row.hexCount}
          sourceKey={`de-el:${row.label}`}
          nodeIds={row.hexIds}
          highlight={highlight}
        />
      ) : (
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-500 mt-px" />
      )}
      <span className="text-[11px] text-gray-800 flex-1 min-w-0 leading-snug">
        {row.label}
        {row.isEllipsis && <span className="text-gray-400 ml-0.5">…</span>}
      </span>
    </div>
  );
}

function L3DesignElementCard({
  element,
  preview,
  highlight,
}: {
  element: DesignElementKey;
  preview: DesignedExperiencePreview;
  highlight?: HighlightProps;
}) {
  const el = preview.designElements.find((e) => e.id === element);
  if (!el) return null;

  const hasPractices = el.practices.length > 0;

  return (
    <div className="px-3 pt-2 pb-3 space-y-3">
      {hasPractices ? (
        <div className="space-y-0.5">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide pb-0.5">
            Practices &amp; approaches
          </div>
          {el.practices.map((row, i) => (
            <DesignElementRowItem key={i} row={row} highlight={highlight} />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide pb-0.5">
            Practices &amp; approaches
          </div>
          <p className="text-[11px] text-gray-400 italic pl-3.5">
            No key items defined yet.
          </p>
        </div>
      )}
      <div className="space-y-0.5">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide pb-0.5">
          Tools &amp; resources
        </div>
        {el.tools.map((row, i) => (
          <DesignElementRowItem key={i} row={row} highlight={highlight} />
        ))}
      </div>
    </div>
  );
}

function L2AdultsHub({
  preview,
  onSetRoute,
}: {
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
}) {
  if (preview.adults.length === 0) {
    return (
      <div className="px-3 py-3 text-[11px] text-gray-400 italic text-center">
        No adult roles selected for the center component yet.
      </div>
    );
  }
  return (
    <>
      {preview.adults.map((r, i) => (
        <ListRow
          key={r.roleId}
          first={i === 0}
          label={r.label}
          onClick={() => onSetRoute({ level: "L3", kind: "adultRole", roleId: r.roleId })}
          testId={`de-adult-${r.roleId}`}
        />
      ))}
    </>
  );
}

function L3AdultRoleBuckets({
  roleId,
  preview,
  onSetRoute,
  highlight,
}: {
  roleId: string;
  preview: DesignedExperiencePreview;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
  highlight?: HighlightProps;
}) {
  const role = preview.adults.find((a) => a.roleId === roleId);
  if (!role) {
    return <div className="px-3 py-3 text-[11px] text-gray-400 italic text-center">Role not found.</div>;
  }
  const expCount = role.experiences.length;
  const expNodeIds = role.experiences.map((c) => c.nodeId);
  const demoCount = role.demographicTags.length;
  const bgCount = role.backgroundTags.length;
  const hasIncoming = role.incomingSkillsText.trim().length > 0;
  const hasStaffing = role.staffingText.trim().length > 0;
  return (
    <>
      <ListRow
        first
        label={`${role.label} Experiences`}
        onClick={() => onSetRoute({ level: "L4", kind: "adultBucket", roleId, bucket: "experiences" })}
        rightAdornment={
          highlight ? (
            <HighlightPill
              n={expCount}
              sourceKey={`de-adult-exp:${roleId}`}
              nodeIds={expNodeIds}
              highlight={highlight}
            />
          ) : (
            <NumberPill n={expCount} />
          )
        }
        testId={`de-adult-${roleId}-exp`}
      />
      <ListRow
        label="Demographic & Situational Variables"
        onClick={() => onSetRoute({ level: "L4", kind: "adultBucket", roleId, bucket: "demographic" })}
        rightAdornment={<NumberPill n={demoCount} />}
        testId={`de-adult-${roleId}-demo`}
      />
      <ListRow
        label="Incoming Skills & Mindsets"
        onClick={() => onSetRoute({ level: "L4", kind: "adultBucket", roleId, bucket: "incomingSkills" })}
        rightAdornment={hasIncoming ? <EllipsisPill /> : <NumberPill n={0} />}
        testId={`de-adult-${roleId}-incoming`}
      />
      <ListRow
        label="Adult Background"
        onClick={() => onSetRoute({ level: "L4", kind: "adultBucket", roleId, bucket: "background" })}
        rightAdornment={<NumberPill n={bgCount} />}
        testId={`de-adult-${roleId}-background`}
      />
      <ListRow
        label="Approach to Staffing"
        onClick={() => onSetRoute({ level: "L4", kind: "adultBucket", roleId, bucket: "staffing" })}
        rightAdornment={hasStaffing ? <EllipsisPill /> : <NumberPill n={0} />}
        testId={`de-adult-${roleId}-staffing`}
      />
    </>
  );
}

function L4AdultBucketCard({
  roleId,
  bucket,
  preview,
  onOpenRingComponent,
}: {
  roleId: string;
  bucket: AdultBucketKey;
  preview: DesignedExperiencePreview;
  onOpenRingComponent: (nodeId: string) => void;
}) {
  const role = preview.adults.find((a) => a.roleId === roleId);
  if (!role) {
    return <div className="px-3 py-3 text-[11px] text-gray-400 italic text-center">Role not found.</div>;
  }
  if (bucket === "experiences") {
    const components = [...role.experiences].sort((a, b) => a.title.localeCompare(b.title));
    if (components.length === 0) {
      return (
        <div className="px-3 py-3 text-[11px] text-gray-400 italic text-center">
          No adult-focused ring components for this role yet.
        </div>
      );
    }
    return (
      <>
        {components.map((c, i) => (
          <ListRow
            key={c.nodeId}
            first={i === 0}
            label={c.title}
            onClick={() => onOpenRingComponent(c.nodeId)}
            testId={`de-adult-${roleId}-comp-${c.nodeId}`}
          />
        ))}
      </>
    );
  }

  if (bucket === "demographic" || bucket === "background") {
    const tags = bucket === "demographic" ? role.demographicTags : role.backgroundTags;
    return (
      <div className="px-3 py-2">
        {tags.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic text-center">Nothing selected for this section yet.</p>
        ) : (
          <ul className="space-y-1">
            {tags.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-500" />
                <span className="text-[11px] text-gray-800">{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // incomingSkills or staffing — text card.
  const text = bucket === "incomingSkills" ? role.incomingSkillsText : role.staffingText;
  return (
    <div className="p-3 flex flex-col gap-2">
      {text.trim() ? (
        <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap line-clamp-6">{text}</p>
      ) : (
        <p className="text-[11px] text-gray-400 italic text-center">Nothing captured here yet.</p>
      )}
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export interface DesignedExperienceCardContentProps {
  route: DesignedExperienceCardRoute;
  onSetRoute: (r: DesignedExperienceCardRoute) => void;
  onNavigateOverall: (target: DesignedExperienceNavTarget) => void;
  onOpenRingComponent: (nodeId: string) => void;
  preview: DesignedExperiencePreview;
  schoolName: string;
  avatarPillClassName: string;
  /** When provided, hex and count badges become interactive ring-highlight toggles. */
  highlight?: HighlightProps;
}

export function DesignedExperienceCardContent({
  route,
  onSetRoute,
  onNavigateOverall,
  onOpenRingComponent,
  preview,
  schoolName,
  avatarPillClassName,
  highlight,
}: DesignedExperienceCardContentProps) {
  const title = titleForDesignedRoute(route, preview);
  const crumbs = breadcrumbForDesignedRoute(route, preview);
  const showBack = route.level !== "L1";
  const goBack = () => onSetRoute(parentDesignedRoute(route));

  return (
    <>
      {/* Header: Back | Title | Avatar */}
      <div className="relative text-center space-y-0.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className={cn(
              "text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1",
              !showBack && "opacity-0 pointer-events-none",
            )}
            onClick={(e) => {
              e.stopPropagation();
              goBack();
            }}
            data-testid="overall-card-back"
          >
            Back
          </button>
          <div className="text-base font-extrabold text-gray-900 truncate max-w-[190px] min-w-0 mx-1" title={title}>
            {title}
          </div>
          <div className="w-12 flex justify-end">
            <button
              type="button"
              className={cn(
                "shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border hover:opacity-80 transition-opacity",
                avatarPillClassName,
              )}
              onClick={(e) => {
                e.stopPropagation();
                onNavigateOverall(editNavTarget(route));
              }}
              title="Open in workspace"
              data-testid="de-header-edit"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          </div>
        </div>
        {route.level === "L1" ? (
          <div className="text-[11px] text-gray-500 truncate" title={schoolName}>
            {schoolName || "Designed Experience overview"}
          </div>
        ) : (
          <Breadcrumb crumbs={crumbs} onSetRoute={onSetRoute} />
        )}
      </div>

      {/* Content box */}
      <div className="bg-white/70 border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0 mt-2">
        <div className="max-h-[150px] overflow-y-auto">
          {route.level === "L1" && <L1Home onSetRoute={onSetRoute} />}

          {/* L2 */}
          {route.level === "L2" && route.section === "students" && (
            <L2Students preview={preview} />
          )}
          {route.level === "L2" && route.section === "targetedImpact" && (
            <L2TargetedImpactHub preview={preview} onSetRoute={onSetRoute} />
          )}
          {route.level === "L2" && route.section === "studentExperiences" && (
            <L2StudentExperiencesHub preview={preview} onSetRoute={onSetRoute} highlight={highlight} />
          )}
          {route.level === "L2" && route.section === "designElements" && (
            <L2DesignElementsHub preview={preview} onSetRoute={onSetRoute} />
          )}
          {route.level === "L2" && route.section === "adults" && (
            <L2AdultsHub preview={preview} onSetRoute={onSetRoute} />
          )}

          {/* L3 — Targeted Impact hubs/lists */}
          {route.level === "L3" && "section" in route && route.section === "targetedImpact.learningAdvancement" && (
            <L3OutcomeCategoriesList group="learningAdvancement" preview={preview} onSetRoute={onSetRoute} highlight={highlight} />
          )}
          {route.level === "L3" && "section" in route && route.section === "targetedImpact.wellbeingConduct" && (
            <L3OutcomeCategoriesList group="wellbeingConduct" preview={preview} onSetRoute={onSetRoute} highlight={highlight} />
          )}
          {route.level === "L3" && "section" in route && route.section === "targetedImpact.portrait" && (
            <L3PortraitList preview={preview} onSetRoute={onSetRoute} />
          )}
          {route.level === "L3" && "section" in route && route.section === "targetedImpact.leaps" && (
            <L3LeapsList
              preview={preview}
              highlight={highlight}
              onSelectLeap={(label) => onNavigateOverall({ kind: "openDesignedTab", deView: { view: "leapDetail", label } })}
            />
          )}
          {route.level === "L3" && "section" in route && route.section === "targetedImpact.community" && (
            <L3CommunityList preview={preview} onSetRoute={onSetRoute} />
          )}

          {/* L3 — outcome category leaf list */}
          {route.level === "L3" && !("section" in route) && route.kind === "outcomeCategory" && (
            <L3OutcomeLeafList
              category={route.category}
              preview={preview}
              highlight={highlight}
              onSelectOutcome={(l2, l3) => onNavigateOverall({ kind: "openDesignedTab", deView: { view: "outcomeDetail", l2, l3 } })}
            />
          )}
          {/* L3 — student experience group component list */}
          {route.level === "L3" && !("section" in route) && route.kind === "studentExperienceGroup" && (
            <L3StudentExperienceGroup
              category={route.category}
              preview={preview}
              onOpenRingComponent={onOpenRingComponent}
            />
          )}
          {/* L3 — design element coming soon */}
          {route.level === "L3" && !("section" in route) && route.kind === "designElement" && (
            <L3DesignElementCard element={route.element} preview={preview} highlight={highlight} />
          )}
          {/* L3 — adult role bucket list */}
          {route.level === "L3" && !("section" in route) && route.kind === "adultRole" && (
            <L3AdultRoleBuckets
              roleId={route.roleId}
              preview={preview}
              onSetRoute={onSetRoute}
              highlight={highlight}
            />
          )}

          {/* L4 */}
          {route.level === "L4" && route.kind === "portraitAttribute" && (
            <L4PortraitAttributeCard
              attributeId={route.attributeId}
              preview={preview}
            />
          )}
          {route.level === "L4" && route.kind === "communityOutcome" && (
            <L4CommunityOutcomeCard
              outcomeId={route.outcomeId}
              preview={preview}
            />
          )}
          {route.level === "L4" && route.kind === "adultBucket" && (
            <L4AdultBucketCard
              roleId={route.roleId}
              bucket={route.bucket}
              preview={preview}
              onOpenRingComponent={onOpenRingComponent}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Empty / default preview helper ───────────────────────────────────────────

export const EMPTY_DESIGNED_EXPERIENCE_PREVIEW: DesignedExperiencePreview = {
  studentDemographics: { currentAsOf: null, verified: false, hasData: false },
  targetedImpact: {
    learningAdvancement: { selectedCount: 0, categories: [] },
    wellbeingConduct: { selectedCount: 0, categories: [] },
    portrait: { attributes: [] },
    leaps: { rows: [] },
    community: { outcomes: [] },
  },
  studentExperiences: [],
  designElements: [],
  adults: [],
};

/** Defaults for community ecosystem outcomes — used when we haven't computed live data yet. */
export const COMMUNITY_OUTCOME_DEFAULT_LABELS: readonly { id: string; label: string }[] = COMMUNITY_ECOSYSTEM_DEFAULTS;
