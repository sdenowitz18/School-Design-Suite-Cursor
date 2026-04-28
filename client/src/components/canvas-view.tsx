import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Bot, Library, X } from "lucide-react";
import { LearnerModuleLibraryProvider, useLearnerModuleLibrary } from "@/contexts/learner-module-library-context";
import LearnerModuleLibraryStrip from "@/components/learner-module-library-strip";
import { LML_STRIP_HEIGHT_CLAMP } from "@/lib/learner-module-library-layout";
import {
  DesignItemDropModal,
  type DesignItemDragPayload,
  type DropConfirmOpts,
  DESIGN_ITEM_DRAG_TYPE,
  decodeDesignItemPayload,
  type SubcomponentOption,
} from "./design-item-drop-modal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { componentQueries, useCreateComponent, useDeleteComponent, useSeedComponents, useUpdateComponent } from "@/lib/api";
import {
  addRingComponentFromCatalogPick,
  dataTransferHasLearnerModule,
  resolveCatalogPickFromDrop,
  subcomponentFromCatalogPick,
} from "@/lib/learner-module-drop";
import ComponentWorkingPanel from "./component-working-panel";
import ComponentWorkingSpaceOverlay from "./component-working-space-overlay";
import OctagonCard from "./octagon-card";
import {
  RingDataPreviewWindow,
  type DataWindowKey,
} from "./ring-data-preview-window";
import { RingFullView, type RingNode, type DrillTarget, type DimensionKey, type RingScopedEditPayload, scopedEditPayloadForDataWindow } from "./ring-full-view";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  JourneyOverviewCardContent,
  type JourneyOverviewCardRoute,
  type JourneyOverviewPreview,
} from "./journey-overview-card-content";
import {
  DesignedExperienceCardContent,
  EMPTY_DESIGNED_EXPERIENCE_PREVIEW,
  type DesignedExperienceCardRoute,
  type DesignedExperiencePreview,
  type HighlightProps,
} from "./designed-experience-card-content";
import { buildDesignedExperiencePreview } from "@/lib/designed-experience-preview";
import { CenterFullView, type CenterFullViewSlot } from "./center-full-view";

interface CanvasNode {
  id: string;
  nodeId: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  color: string;
  overviewContextPreview?: JourneyOverviewPreview;
  designedExperiencePreview?: DesignedExperiencePreview;
  stats: {
    left: string;
    right: string;
    leftLabel: string;
    rightLabel: string;
    leftScore: number | null;
    rightScore: number | null;
  };
}

const EMPTY_STAKEHOLDER = { populationSize: "", additionalContext: "", keyRepresentatives: "" };
const EMPTY_JOURNEY_PREVIEW: JourneyOverviewPreview = {
  schoolName: "",
  studentCount: "",
  mission: "",
  contextOverview: {
    communityOverview: { text: "", verified: false },
    policyConsiderations: { text: "", verified: false },
    historyOfChangeEfforts: { text: "", verified: false },
    otherContext: { text: "", verified: false },
  },
  studentDemographics: { currentAsOf: null, verified: false, hasData: false },
  publicAcademic: {
    collegePrep: { currentAsOf: null, verified: false, hasData: false },
    testScores: { currentAsOf: null, verified: false, hasData: false },
    raceEthnicity: { currentAsOf: null, verified: false, hasData: false },
    lowIncomeStudents: { currentAsOf: null, verified: false, hasData: false },
    studentsWithDisabilities: { currentAsOf: null, verified: false, hasData: false },
  },
  stakeholderMap: {
    students: { ...EMPTY_STAKEHOLDER, verified: false },
    families: { ...EMPTY_STAKEHOLDER },
    educatorsStaff: { ...EMPTY_STAKEHOLDER },
    administrationDistrict: { ...EMPTY_STAKEHOLDER, verified: false },
    administrationSchool: { ...EMPTY_STAKEHOLDER, verified: false },
    otherCommunityLeaders: { ...EMPTY_STAKEHOLDER },
  },
};

/** Center school node when the API is still loading, failed, or returned no rows yet (before seed+refetch). */
const SHELL_OVERALL_CANVAS_NODE: CanvasNode = {
  id: "shell-overall",
  nodeId: "overall",
  title: "Overall School",
  subtitle: "",
  x: 600,
  y: 300,
  color: "bg-white",
  stats: {
    left: "—",
    right: "—",
    leftLabel: "Learning & Adv.",
    rightLabel: "Wellbeing",
    leftScore: null,
    rightScore: null,
  },
};

function chartPreview(data: any): { currentAsOf: string | null; verified: boolean; hasData: boolean } {
  if (!data || typeof data !== "object") {
    return { currentAsOf: null, verified: false, hasData: false };
  }
  const currentAsOf = typeof data.currentAsOf === "string" && data.currentAsOf.trim() ? data.currentAsOf : null;
  const verified = !!data?.verification?.current?.verified;
  return { currentAsOf, verified, hasData: true };
}

function stakeholderPreview(item: any, tracksVerification: boolean): {
  populationSize: string;
  additionalContext: string;
  keyRepresentatives: string;
  verified?: boolean;
} {
  const populationSize = String(item?.populationSize || "");
  const additionalContext = String(item?.additionalContext || "");
  const keyRepresentatives = String(item?.keyRepresentatives || "");
  if (!tracksVerification) {
    return { populationSize, additionalContext, keyRepresentatives };
  }
  return { populationSize, additionalContext, keyRepresentatives, verified: !!item?.verified };
}

export function componentToCanvasNode(comp: any, allComponents?: any[]): CanvasNode {
  const snap = comp.snapshotData || {};
  const ocd: any = (snap as any).overviewContextData || {};
  const studentCount = ocd?.studentCount ?? ocd?.students ?? undefined;
  const mission = ocd?.mission ?? "";
  const cov = ocd?.contextOverview || {};
  const covVer = cov.verification || {};
  const sm = ocd?.stakeholderMap || {};
  const sd = ocd?.studentDemographics;

  const overviewContextPreview: JourneyOverviewPreview | undefined =
    comp.nodeId === "overall"
      ? {
          schoolName: String(ocd?.schoolName || comp.title || ""),
          studentCount: studentCount !== undefined && studentCount !== null ? String(studentCount) : "",
          mission: String(mission || ""),
          contextOverview: {
            communityOverview: {
              text: String(cov.communityOverviewText || ""),
              verified: !!covVer.communityOverview?.verified,
            },
            policyConsiderations: {
              text: String(cov.policyConsiderationsText || ""),
              verified: !!covVer.policyConsiderations?.verified,
            },
            historyOfChangeEfforts: {
              text: String(cov.historyOfChangeText || ""),
              verified: !!covVer.historyOfChange?.verified,
            },
            otherContext: {
              text: String(cov.otherContextText || ""),
              verified: !!covVer.otherContext?.verified,
            },
          },
          studentDemographics: {
            currentAsOf: typeof sd?.currentAsOf === "string" && sd.currentAsOf.trim() ? sd.currentAsOf : null,
            verified: !!sd?.verification?.current?.verified,
            hasData: !!sd,
          },
          publicAcademic: {
            collegePrep: chartPreview(ocd?.collegePrep),
            testScores: chartPreview(ocd?.testScores),
            raceEthnicity: chartPreview(ocd?.raceEthnicity),
            lowIncomeStudents: chartPreview(ocd?.lowIncomeStudents),
            studentsWithDisabilities: chartPreview(ocd?.studentsWithDisabilities),
          },
          stakeholderMap: {
            students: stakeholderPreview(sm.students, true),
            families: stakeholderPreview(sm.families, false),
            educatorsStaff: stakeholderPreview(sm.educatorsStaff, false),
            administrationDistrict: stakeholderPreview(sm.administrationDistrict, true),
            administrationSchool: stakeholderPreview(sm.administrationSchool, true),
            otherCommunityLeaders: stakeholderPreview(sm.otherCommunityLeaders, false),
          },
        }
      : undefined;

  const designedExperiencePreview: DesignedExperiencePreview | undefined =
    comp.nodeId === "overall" && Array.isArray(allComponents)
      ? buildDesignedExperiencePreview(allComponents, {
          studentDemographics: {
            currentAsOf: typeof sd?.currentAsOf === "string" && sd.currentAsOf.trim() ? sd.currentAsOf : null,
            verified: !!sd?.verification?.current?.verified,
            hasData: !!sd,
          },
        })
      : undefined;

  return {
    id: comp.id,
    nodeId: comp.nodeId,
    title: comp.title,
    subtitle: comp.subtitle,
    x: comp.canvasX,
    y: comp.canvasY,
    color: comp.color,
    overviewContextPreview,
    designedExperiencePreview,
    stats: (() => {
      const hd: any = (comp as any).healthData || {};
      const laRaw = hd.learningAdvancementOutcomeScoreData?.finalOutcomeScore ?? null;
      const wcRaw = hd.wellbeingConductOutcomeScoreData?.finalOutcomeScore ?? null;
      const laScore = typeof laRaw === "number" ? Math.round(laRaw) : null;
      const wcScore = typeof wcRaw === "number" ? Math.round(wcRaw) : null;
      return {
        left: laScore !== null ? String(laScore) : "—",
        right: wcScore !== null ? String(wcScore) : "—",
        leftLabel: "Learning & Adv.",
        rightLabel: "Wellbeing",
        leftScore: laScore,
        rightScore: wcScore,
      };
    })(),
  };
}

type OverallCenterMode = "overview" | "designed" | "status";

type OverallNavTarget =
  | { level: "L1" }
  | { level: "L2"; section: "mission" | "contextOverview" | "enrollment" | "publicAcademic" | "communityReviews" | "stakeholderMap" }
  | {
      level: "L3";
      section:
        | "contextOverview.communityOverview"
        | "contextOverview.policyConsiderations"
        | "contextOverview.historyOfChangeEfforts"
        | "contextOverview.otherContext"
        | "enrollment.studentDemographics"
        | "publicAcademic.collegePrep"
        | "publicAcademic.testScores"
        | "publicAcademic.raceEthnicity"
        | "publicAcademic.lowIncomeStudents"
        | "publicAcademic.studentsWithDisabilities"
        | "stakeholder.students"
        | "stakeholder.families"
        | "stakeholder.educatorsStaff"
        | "stakeholder.administrationDistrict"
        | "stakeholder.administrationSchool"
        | "stakeholder.otherCommunityLeaders";
    };

type OverallCardRoute = JourneyOverviewCardRoute;

/** Matches `transform scale-90` on the canvas stage (tailwind scale-90 = 0.9). */
const CANVAS_STAGE_SCALE = 0.9;
const DRAG_THRESHOLD_PX = 8;
/** Mark octagon roots so blueprint pan only starts on empty canvas (pointerdown capture). */
const DATA_BLUEPRINT_NODE = "data-blueprint-node";

function DraggableRingOctagon({
  node,
  rawComp,
  canvasStageScale,
  onOpenFullView,
  onOpenWorkingPanel,
  onOpenDataPreviewFullView,
  onCommitCanvasPosition,
  onDeleteNode,
  isHighlighted = false,
  selectedDataWindow,
  onDataWindowChange,
  onDesignItemDrop,
  onDrill,
  onDimensionClick,
  onDoubleClickDataPreviewEdit,
  onDoubleClickItemEdit,
}: {
  node: CanvasNode;
  rawComp?: any;
  canvasStageScale: number;
  /** Single click (no drag): opens the split-screen full view. */
  onOpenFullView: () => void;
  /** Double click: opens the working panel (right split, same shell as full view). */
  onOpenWorkingPanel: () => void;
  /** Click on the ring border of the data preview window. */
  onOpenDataPreviewFullView: (w: DataWindowKey) => void;
  onCommitCanvasPosition: (nodeId: string, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  isHighlighted?: boolean;
  selectedDataWindow: DataWindowKey;
  onDataWindowChange: (w: DataWindowKey) => void;
  onDesignItemDrop?: (payload: DesignItemDragPayload) => void;
  onDrill?: (t: DrillTarget) => void;
  onDimensionClick?: (key: DimensionKey) => void;
  /** Double-click compact preview body → working panel scoped to current data window. */
  onDoubleClickDataPreviewEdit?: (nodeId: string) => void;
  /** Double-click a specific list item → working panel scoped to that item's edit page. */
  onDoubleClickItemEdit?: (nodeId: string, payload: RingScopedEditPayload) => void;
}) {
  const [draggingPos, setDraggingPos] = useState<{ x: number; y: number } | null>(null);
  const [isDesignDropTarget, setIsDesignDropTarget] = useState(false);
  const sessionRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayX = draggingPos?.x ?? node.x;
  const displayY = draggingPos?.y ?? node.y;

  const endDrag = (e: React.PointerEvent, el: HTMLElement) => {
    const s = sessionRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
    const dx = e.clientX - s.startClientX;
    const dy = e.clientY - s.startClientY;
    const moved = s.moved || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
    const nx = Math.round(s.originX + dx / canvasStageScale);
    const ny = Math.round(s.originY + dy / canvasStageScale);
    setDraggingPos(null);
    if (moved) {
      onCommitCanvasPosition(node.nodeId, nx, ny);
    } else {
      // Delay single-click action; cancel if a double-click fires within 280ms.
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onOpenFullView();
      }, 280);
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={draggingPos ? undefined : { scale: 1.04 }}
      className="group absolute z-[2] cursor-grab active:cursor-grabbing flex flex-col items-center justify-center w-[220px] h-[220px] touch-none select-none"
      style={{ left: displayX, top: displayY, transform: "translate(-50%, -50%)" }}
      {...{ [DATA_BLUEPRINT_NODE]: "" }}
      data-testid={`node-${node.nodeId}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-octagon-delete]")) return;
        if ((e.target as HTMLElement).closest("[data-preview-interactive]")) return;
        if ((e.target as HTMLElement).closest("[data-octagon-stat]")) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        sessionRef.current = {
          pointerId: e.pointerId,
          originX: node.x,
          originY: node.y,
          startClientX: e.clientX,
          startClientY: e.clientY,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const s = sessionRef.current;
        if (!s || s.pointerId !== e.pointerId) return;
        const dx = e.clientX - s.startClientX;
        const dy = e.clientY - s.startClientY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) s.moved = true;
        setDraggingPos({
          x: s.originX + dx / canvasStageScale,
          y: s.originY + dy / canvasStageScale,
        });
      }}
      onPointerUp={(e) => endDrag(e, e.currentTarget as HTMLElement)}
      onPointerCancel={(e) => {
        const s = sessionRef.current;
        if (!s || s.pointerId !== e.pointerId) return;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        sessionRef.current = null;
        setDraggingPos(null);
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-octagon-delete]")) return;
        if ((e.target as HTMLElement).closest("[data-preview-interactive]")) return;
        if ((e.target as HTMLElement).closest("[data-octagon-stat]")) return;
        // Cancel the pending single-click timer and open the working panel instead.
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        onOpenWorkingPanel();
      }}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes(DESIGN_ITEM_DRAG_TYPE)) return;
        e.preventDefault();
        setIsDesignDropTarget(true);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DESIGN_ITEM_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsDesignDropTarget(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDesignDropTarget(false);
        }
      }}
      onDrop={(e) => {
        setIsDesignDropTarget(false);
        const raw = e.dataTransfer.getData(DESIGN_ITEM_DRAG_TYPE);
        if (!raw) return;
        const payload = decodeDesignItemPayload(raw);
        if (!payload || !onDesignItemDrop) return;
        e.preventDefault();
        e.stopPropagation();
        onDesignItemDrop(payload);
      }}
    >
      <button
        type="button"
        data-octagon-delete
        title={`Remove ${node.title} from blueprint`}
        className={cn(
          "pointer-events-auto absolute -right-1 -top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full",
          "border border-red-200 bg-white text-red-600 shadow-md transition-opacity",
          "opacity-0 group-hover:opacity-100 hover:bg-red-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300",
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Remove “${node.title}” from the blueprint?`)) {
            onDeleteNode(node.nodeId);
          }
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {isHighlighted && (
        <div
          className="absolute pointer-events-none"
          style={{
            inset: -6,
            clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
            backgroundColor: "#3b82f6",
          }}
          aria-hidden="true"
        />
      )}
      {isDesignDropTarget && (
        <div
          className="absolute pointer-events-none z-30"
          style={{
            inset: -6,
            clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
            backgroundColor: "rgba(16,185,129,0.35)",
          }}
          aria-hidden="true"
        />
      )}
      <OctagonCard
        title={node.title}
        subtitle={node.subtitle}
        centerVariant="dataPreview"
        dataPreviewContent={
          rawComp ? (
            <RingDataPreviewWindow
              comp={rawComp}
              selectedWindow={selectedDataWindow}
              onWindowChange={onDataWindowChange}
              onOpenFullView={rawComp ? () => onOpenDataPreviewFullView(selectedDataWindow) : undefined}
              onDrill={onDrill}
              onDoubleClickItem={onDoubleClickItemEdit ? (e) => {
                let payload: RingScopedEditPayload | null = null;
                if (e.kind === "leap") {
                  payload = { tab: "designed-experience", deNav: { view: "leapDetail", label: e.label }, openSubId: null, initialSubId: null };
                } else if (e.kind === "outcome") {
                  payload = { tab: "designed-experience", deNav: { view: "outcomeDetail", l2: e.label }, openSubId: null, initialSubId: null };
                } else if (e.kind === "subcomponent") {
                  const allSubs: any[] = rawComp?.designedExperienceData?.subcomponents ?? [];
                  const adultSubs: any[] = rawComp?.designedExperienceData?.adultSubcomponents ?? [];
                  const found = [...allSubs, ...adultSubs].find((s: any) => s.name === e.name);
                  const isAdult = adultSubs.some((s: any) => s.name === e.name);
                  payload = isAdult
                    ? { tab: "designed-experience", deNav: { view: "adultSubManage", subId: found?.id ?? "" }, openSubId: null, initialSubId: null }
                    : { tab: "designed-experience", deNav: null, openSubId: found?.id ?? null, initialSubId: found?.id ?? null };
                } else if (e.kind === "practice" || e.kind === "tool") {
                  payload = { tab: "designed-experience", deNav: { view: "designElement", elementId: e.item.elementId }, openSubId: e.item.bucketCompositeKey, initialSubId: e.item.bucketCompositeKey };
                }
                if (payload) onDoubleClickItemEdit(node.nodeId, payload);
              } : undefined}
              onDimensionClick={onDimensionClick}
              onDoubleClickToEdit={
                onDoubleClickDataPreviewEdit ? () => onDoubleClickDataPreviewEdit(node.nodeId) : undefined
              }
            />
          ) : undefined
        }
        onOpenDataPreviewFullView={
          rawComp
            ? () => onOpenDataPreviewFullView(selectedDataWindow)
            : undefined
        }
        bgClassName={node.color}
        leftStat={{ label: node.stats.leftLabel, value: node.stats.left, score: node.stats.leftScore }}
        rightStat={{ label: node.stats.rightLabel, value: node.stats.right, score: node.stats.rightScore }}
        onLeftStatClick={onDimensionClick ? () => onDimensionClick("learningAdvancement") : undefined}
        onRightStatClick={onDimensionClick ? () => onDimensionClick("wellbeingConduct") : undefined}
        className="pointer-events-none"
      />
    </motion.div>
  );
}

const OctagonNode = ({
  node,
  rawComp,
  onClick,
  onOpenFullView,
  onOpenDataPreviewFullView,
  overallCenterMode,
  onSetOverallCenterMode,
  onNavigateOverall,
  onOpenOverallTab,
  onSetDeNavTarget,
  onOpenRingComponent,
  overallCardRoute,
  onSetOverallCardRoute,
  designedCardRoute,
  onSetDesignedCardRoute,
  ringHighlightSourceKey,
  onPinRingHighlight,
  isHighlighted = false,
  persistLayout = false,
  canvasStageScale = CANVAS_STAGE_SCALE,
  onCommitCanvasPosition,
  onDeleteNode,
  selectedDataWindow,
  onDataWindowChange,
  onDesignItemDrop,
  onOpenCenterFullView,
  onDrill,
  onDimensionClick,
  onDoubleClickDataPreviewEdit,
  onDoubleClickItemEdit,
}: {
  node: CanvasNode;
  rawComp?: any;
  onClick: () => void;
  /** Single-click → open split-screen full view. */
  onOpenFullView?: (nodeId: string) => void;
  /** Ring-border click → open enlarged data preview window. */
  onOpenDataPreviewFullView?: (nodeId: string, w: DataWindowKey) => void;
  overallCenterMode: OverallCenterMode;
  onSetOverallCenterMode: (mode: OverallCenterMode) => void;
  onNavigateOverall: (target: OverallNavTarget) => void;
  onOpenOverallTab: (tab: "overview-and-context" | "designed-experience" | "status-and-health") => void;
  onSetDeNavTarget?: (target: import("./designed-experience-card-content").DESubView) => void;
  onOpenRingComponent: (nodeId: string) => void;
  overallCardRoute: OverallCardRoute;
  onSetOverallCardRoute: (route: OverallCardRoute) => void;
  designedCardRoute: DesignedExperienceCardRoute;
  onSetDesignedCardRoute: (route: DesignedExperienceCardRoute) => void;
  ringHighlightSourceKey: string | null;
  onPinRingHighlight: (sourceKey: string, nodeIds: string[]) => void;
  isHighlighted?: boolean;
  persistLayout?: boolean;
  canvasStageScale?: number;
  onCommitCanvasPosition?: (nodeId: string, x: number, y: number) => void;
  onDeleteNode?: (nodeId: string) => void;
  selectedDataWindow?: DataWindowKey;
  onDataWindowChange?: (w: DataWindowKey) => void;
  onDesignItemDrop?: (payload: DesignItemDragPayload) => void;
  /** Open center full view with the given slot (designed or overview). */
  onOpenCenterFullView?: (slot: CenterFullViewSlot) => void;
  /** Compact canvas drill — clicking an item opens full view + drill for that item. */
  onDrill?: (nodeId: string, t: DrillTarget) => void;
  /** Clicking a dimension node/stat opens the full view scoped to that dimension. */
  onDimensionClick?: (nodeId: string, key: DimensionKey) => void;
  /** Double-click preview body → working panel scoped to current global data window. */
  onDoubleClickDataPreviewEdit?: (nodeId: string) => void;
  /** Double-click a specific list item → working panel scoped to that item's edit page. */
  onDoubleClickItemEdit?: (nodeId: string, payload: RingScopedEditPayload) => void;
}) => {
  const isOverall = node.nodeId === "overall";

  if (isOverall) {
     const mode = overallCenterMode;
     const preview = node.overviewContextPreview ?? EMPTY_JOURNEY_PREVIEW;

     const modeStyleFor = (m: OverallCenterMode) =>
       m === "overview"
         ? { border: "border-orange-200", bg: "bg-orange-50/70", pill: "bg-orange-100 text-orange-800 border-orange-200" }
         : m === "designed"
           ? { border: "border-blue-200", bg: "bg-blue-50/60", pill: "bg-blue-100 text-blue-800 border-blue-200" }
           : { border: "border-emerald-200", bg: "bg-emerald-50/60", pill: "bg-emerald-100 text-emerald-800 border-emerald-200" };

     const modeStyles = modeStyleFor(mode);
     const otherModes = (["overview", "designed", "status"] as OverallCenterMode[]).filter((m) => m !== mode);

     const route = overallCardRoute || { level: "L1" };
     const setRoute = onSetOverallCardRoute;

     return (
        <div
          className="absolute z-[2] w-[320px] h-[255px]"
          style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
          {...{ [DATA_BLUEPRINT_NODE]: "" }}
          data-testid={`node-${node.nodeId}`}
        >
          {/* Two cards behind (clickable to switch back) */}
          {(() => {
            const back2 = otherModes[1];
            const back1 = otherModes[0];
            const s2 = back2 ? modeStyleFor(back2) : null;
            const s1 = back1 ? modeStyleFor(back1) : null;
            return (
              <>
                {back2 && s2 && (
                  <button
                    type="button"
                    className={cn(
                      "absolute inset-x-0 top-0 h-[220px] rounded-xl border-2 shadow-md translate-x-3 translate-y-3",
                      s2.border,
                      s2.bg,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetOverallCenterMode(back2);
                      onOpenOverallTab(back2 === "overview" ? "overview-and-context" : back2 === "designed" ? "designed-experience" : "status-and-health");
                    }}
                    aria-label={`Switch to ${back2}`}
                  />
                )}
                {back1 && s1 && (
                  <button
                    type="button"
                    className={cn(
                      "absolute inset-x-0 top-0 h-[220px] rounded-xl border-2 shadow-md translate-x-1.5 translate-y-1.5",
                      s1.border,
                      s1.bg,
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetOverallCenterMode(back1);
                      onOpenOverallTab(back1 === "overview" ? "overview-and-context" : back1 === "designed" ? "designed-experience" : "status-and-health");
                    }}
                    aria-label={`Switch to ${back1}`}
                  />
                )}
              </>
            );
          })()}

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.01 }}
                className={cn(
                  "relative cursor-pointer flex flex-col items-center justify-center w-full h-[220px] rounded-xl shadow-lg border-2 px-4 pt-4 pb-3 transition-colors",
                  "bg-white",
                  modeStyles.border,
                  modeStyles.bg,
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (mode === "status") {
                    onSetOverallCenterMode("overview");
                  } else if (mode === "designed" && onOpenCenterFullView) {
                    onOpenCenterFullView({ kind: "designed", route: designedCardRoute });
                  } else if (mode === "overview" && onOpenCenterFullView) {
                    onOpenCenterFullView({ kind: "overview", route });
                  }
                }}
              >
            <div className="flex flex-col w-full h-full justify-between">
              {mode === "overview" ? (
                <JourneyOverviewCardContent
                  route={route}
                  onSetRoute={setRoute}
                  onNavigateOverall={onNavigateOverall}
                  preview={preview}
                  avatarPillClassName={modeStyles.pill}
                />
              ) : mode === "designed" ? (
                <DesignedExperienceCardContent
                  route={designedCardRoute}
                  onSetRoute={onSetDesignedCardRoute}
                  onNavigateOverall={(target) => {
                    if ("kind" in target && target.kind === "openDesignedTab") {
                      onOpenOverallTab("designed-experience");
                      if (target.deView) onSetDeNavTarget?.(target.deView);
                    } else {
                      // Reuse the J&O working-space deep-linker for cross-links into Journey & Overview.
                      onNavigateOverall(target as OverallNavTarget);
                    }
                  }}
                  onOpenRingComponent={onOpenRingComponent}
                  preview={node.designedExperiencePreview ?? EMPTY_DESIGNED_EXPERIENCE_PREVIEW}
                  schoolName={preview.schoolName || node.title}
                  avatarPillClassName={modeStyles.pill}
                  highlight={{ activeSourceKey: ringHighlightSourceKey, onPin: onPinRingHighlight }}
                />
              ) : (
                <div className="space-y-2">
                  <div className="relative text-center space-y-1">
                    <div className="text-base font-extrabold text-gray-900">Performance & Status</div>
                    <div className="text-[11px] text-gray-500">{preview.schoolName || node.title}</div>
                    <div className="absolute right-0 top-0">
                      <div className={cn("shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center", modeStyles.pill)}>
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/70 border border-gray-200 rounded-lg p-3">
                    <div className="text-xs font-bold text-gray-800">Jump into Status & Health</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">View performance, design, implementation, and conditions summaries.</div>
                  </div>
                </div>
              )}

            </div>
              </motion.div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onNavigateOverall({ level: "L1" });
                }}
              >
                Navigate
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {/* Bottom bar (attached): show the *other* two cards so you can get back */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gray-200 text-gray-700 text-[11px] font-semibold px-6 py-1 rounded-full shadow-sm border border-gray-300 flex items-center gap-3">
            {(() => {
              const left = otherModes[0];
              const right = otherModes[1];
              const label = (m: OverallCenterMode) => (m === "overview" ? "Journey and Overview" : m === "designed" ? "Designed Experience" : "Performance Status");
              const color = (m: OverallCenterMode) => (m === "overview" ? "text-orange-700" : m === "designed" ? "text-blue-700" : "text-emerald-700");
              const toTab = (m: OverallCenterMode) => (m === "overview" ? "overview-and-context" : m === "designed" ? "designed-experience" : "status-and-health");
              return (
                <>
                  <button
                    type="button"
                    className={cn(color(left), "hover:underline")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetOverallCenterMode(left);
                      onOpenOverallTab(toTab(left));
                    }}
                    data-testid={`overall-bottom-${left}`}
                  >
                    {label(left)}
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    type="button"
                    className={cn(color(right), "hover:underline")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetOverallCenterMode(right);
                      onOpenOverallTab(toTab(right));
                    }}
                    data-testid={`overall-bottom-${right}`}
                  >
                    {label(right)}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
     );
  }

  if (persistLayout && onCommitCanvasPosition && onDeleteNode) {
    return (
      <DraggableRingOctagon
        node={node}
        rawComp={rawComp}
        canvasStageScale={canvasStageScale}
        onOpenFullView={() => onOpenFullView?.(node.nodeId)}
        onOpenWorkingPanel={onClick}
        onOpenDataPreviewFullView={(w) => onOpenDataPreviewFullView?.(node.nodeId, w)}
        onCommitCanvasPosition={onCommitCanvasPosition}
        onDeleteNode={onDeleteNode}
        isHighlighted={isHighlighted}
        selectedDataWindow={selectedDataWindow ?? "keyDrivers"}
        onDataWindowChange={onDataWindowChange ?? (() => {})}
        onDesignItemDrop={onDesignItemDrop}
        onDrill={onDrill ? (t) => onDrill(node.nodeId, t) : undefined}
        onDimensionClick={onDimensionClick ? (key) => onDimensionClick(node.nodeId, key) : undefined}
        onDoubleClickDataPreviewEdit={onDoubleClickDataPreviewEdit}
        onDoubleClickItemEdit={onDoubleClickItemEdit}
      />
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className="absolute z-[2] cursor-pointer flex flex-col items-center justify-center w-[220px] h-[220px] transition-all"
      style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
      {...{ [DATA_BLUEPRINT_NODE]: "" }}
      data-testid={`node-${node.nodeId}`}
    >
      {isHighlighted && (
        <div
          className="absolute pointer-events-none"
          style={{
            inset: -6,
            clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
            backgroundColor: "#3b82f6",
          }}
          aria-hidden="true"
        />
      )}
      <OctagonCard
        title={node.title}
        subtitle={node.subtitle}
        centerVariant="dataPreview"
        dataPreviewContent={
          rawComp ? (
            <RingDataPreviewWindow
              comp={rawComp}
              selectedWindow={selectedDataWindow ?? "keyDrivers"}
              onWindowChange={onDataWindowChange ?? (() => {})}
              onOpenFullView={rawComp ? () => onOpenDataPreviewFullView?.(node.nodeId, selectedDataWindow ?? "keyDrivers") : undefined}
              onDimensionClick={onDimensionClick ? (key) => onDimensionClick(node.nodeId, key) : undefined}
              onDoubleClickItem={onDoubleClickItemEdit ? (e) => {
                let payload: RingScopedEditPayload | null = null;
                if (e.kind === "leap") {
                  payload = { tab: "designed-experience", deNav: { view: "leapDetail", label: e.label }, openSubId: null, initialSubId: null };
                } else if (e.kind === "outcome") {
                  payload = { tab: "designed-experience", deNav: { view: "outcomeDetail", l2: e.label }, openSubId: null, initialSubId: null };
                } else if (e.kind === "subcomponent") {
                  const allSubs: any[] = rawComp?.designedExperienceData?.subcomponents ?? [];
                  const adultSubs: any[] = rawComp?.designedExperienceData?.adultSubcomponents ?? [];
                  const found = [...allSubs, ...adultSubs].find((s: any) => s.name === e.name);
                  const isAdult = adultSubs.some((s: any) => s.name === e.name);
                  payload = isAdult
                    ? { tab: "designed-experience", deNav: { view: "adultSubManage", subId: found?.id ?? "" }, openSubId: null, initialSubId: null }
                    : { tab: "designed-experience", deNav: null, openSubId: found?.id ?? null, initialSubId: found?.id ?? null };
                } else if (e.kind === "practice" || e.kind === "tool") {
                  payload = { tab: "designed-experience", deNav: { view: "designElement", elementId: e.item.elementId }, openSubId: e.item.bucketCompositeKey, initialSubId: e.item.bucketCompositeKey };
                }
                if (payload) onDoubleClickItemEdit(node.nodeId, payload);
              } : undefined}
              onDoubleClickToEdit={
                onDoubleClickDataPreviewEdit ? () => onDoubleClickDataPreviewEdit(node.nodeId) : undefined
              }
            />
          ) : undefined
        }
        onOpenDataPreviewFullView={
          rawComp
            ? () => onOpenDataPreviewFullView?.(node.nodeId, selectedDataWindow ?? "keyDrivers")
            : undefined
        }
        bgClassName={node.color}
        leftStat={{ label: node.stats.leftLabel, value: node.stats.left, score: node.stats.leftScore }}
        rightStat={{ label: node.stats.rightLabel, value: node.stats.right, score: node.stats.rightScore }}
        onLeftStatClick={onDimensionClick ? () => onDimensionClick(node.nodeId, "learningAdvancement") : undefined}
        onRightStatClick={onDimensionClick ? () => onDimensionClick(node.nodeId, "wellbeingConduct") : undefined}
        onClick={onClick}
      />
    </motion.div>
  );
};

/** Shared drag handle between canvas and ring / center / working right panes. */
function RightPaneResizeDivider({
  dividerDragRef,
  fullViewWidthPct,
  setFullViewWidthPct,
}: {
  dividerDragRef: React.MutableRefObject<{ startX: number; startPct: number } | null>;
  fullViewWidthPct: number;
  setFullViewWidthPct: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div
      className="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors select-none touch-none z-20"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const containerW = (e.currentTarget.parentElement as HTMLElement | null)?.offsetWidth ?? window.innerWidth;
        dividerDragRef.current = { startX: e.clientX, startPct: fullViewWidthPct };
        (dividerDragRef.current as { _containerW?: number })._containerW = containerW;
      }}
      onPointerMove={(e) => {
        const d = dividerDragRef.current;
        if (!d) return;
        const containerW = (d as { _containerW?: number })._containerW ?? window.innerWidth;
        const deltaPct = ((d.startX - e.clientX) / containerW) * 100;
        const next = Math.min(80, Math.max(20, d.startPct + deltaPct));
        setFullViewWidthPct(next);
      }}
      onPointerUp={(e) => {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        dividerDragRef.current = null;
      }}
      onPointerCancel={(e) => {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        dividerDragRef.current = null;
      }}
      title="Drag to resize"
    />
  );
}

function CanvasViewInner() {
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [activeTab, setActiveTab] = useState("snapshot");
  const [initialSubId, setInitialSubId] = useState<string | null>(null);
  const [openSubId, setOpenSubId] = useState<string | null>(null);
  const [isExpandedWorkingSpace, setIsExpandedWorkingSpace] = useState(false);
  const [overallCenterMode, setOverallCenterMode] = useState<OverallCenterMode>("overview");
  const [overallNavTarget, setOverallNavTarget] = useState<OverallNavTarget | null>(null);
  const [overallCardRoute, setOverallCardRoute] = useState<OverallCardRoute>({ level: "L1" });
  const [designedCardRoute, setDesignedCardRoute] = useState<DesignedExperienceCardRoute>({ level: "L1" });
  const [ringHighlight, setRingHighlight] = useState<{ sourceKey: string; nodeIds: Set<string> } | null>(null);
  const [deNavTarget, setDeNavTarget] = useState<import("./designed-experience-card-content").DESubView | null>(null);
  const [shPage, setShPage] = useState<import("./component-health-view").StatusHealthPage | null>(null);
  const [selectedDataWindow, setSelectedDataWindow] = useState<DataWindowKey>("keyDrivers");
  const [ringFullViewState, setRingFullViewState] = useState<{
    nodeId: string;
    rawComp: any;
    bgClassName: string;
    mode: "component" | "dataWindow";
    initialDrillTarget?: DrillTarget | null;
  } | null>(null);
  const [centerFullViewRoute, setCenterFullViewRoute] =
    useState<CenterFullViewSlot | null>(null);
  const [fullViewWidthPct, setFullViewWidthPct] = useState(44);

  // ── Design-item drag-and-drop onto ring components ─────────────────────────
  const [dropConfirm, setDropConfirm] = useState<{
    payload: DesignItemDragPayload;
    targetNodeId: string;
    targetName: string;
    rawComp: any;
  } | null>(null);
  const queryClient = useQueryClient();
  const dividerDragRef = useRef<{ startX: number; startPct: number } | null>(null);

  const pinHighlight = useCallback((sourceKey: string, nodeIds: string[]) => {
    setRingHighlight((prev) =>
      prev?.sourceKey === sourceKey ? null : { sourceKey, nodeIds: new Set(nodeIds) },
    );
  }, []);

  const { open: libraryOpen, toggleLibrary, moduleLibraryAudience } = useLearnerModuleLibrary();
  const [blueprintDropActive, setBlueprintDropActive] = useState(false);
  const [sheetPanelDropActive, setSheetPanelDropActive] = useState(false);
  const [blueprintPan, setBlueprintPan] = useState({ x: 0, y: 0 });
  const blueprintPanSessionRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const { data: componentsRaw, isSuccess } = useQuery(componentQueries.all);
  const seedMutation = useSeedComponents();
  const updateMutation = useUpdateComponent();
  const createMutation = useCreateComponent();
  const deleteMutation = useDeleteComponent();
  const autoSeedAttempted = useRef(false);

  const handleDropConfirm = useCallback(
    (targetSubId: string | null, opts: DropConfirmOpts) => {
      if (!dropConfirm) return;
      const { payload, targetNodeId } = dropConfirm;

      const cached: any =
        queryClient.getQueryData(["components", targetNodeId]) ??
        (Array.isArray(componentsRaw)
          ? componentsRaw.find((c: any) => String(c?.nodeId) === targetNodeId)
          : undefined);

      const de: any = { ...(cached?.designedExperienceData ?? {}) };
      const idCounter = { n: Date.now() };
      const genId = () => `de_${idCounter.n++}_drop`;

      if (payload.kind === "outcome" || payload.kind === "leap") {
        const priority = "priority" in opts ? opts.priority : "Medium";
        const overrideLevel = priority === "High" ? "H" : priority === "Low" ? "L" : "M";

        // For outcomes, parse the structured key ("L2::L3" or just "L2") so we save
        // the aim in the same shape the manage-outcomes page uses:
        //   { type: "outcome", label: <L2>, subSelections: [<L3>], subPriorities: { [L3]: overrideLevel } }
        // This is required for buildHexIndex / expandOutcomeAims to map the aim to a category
        // and increment hex counts correctly.
        let aimLabel = payload.label;
        let subSelections: string[] | undefined;
        let subPriorities: Record<string, string> | undefined;
        if (payload.kind === "outcome" && "key" in payload) {
          const key = String((payload as any).key ?? "");
          const sep = key.indexOf("::");
          if (sep >= 0) {
            aimLabel = key.slice(0, sep);           // L2 label (e.g. "Natural Sciences")
            const l3 = key.slice(sep + 2);          // L3 label (e.g. "Chemistry Knowledge and Skills")
            subSelections = [l3];
            subPriorities = { [l3]: overrideLevel };
          } else if (key) {
            aimLabel = key;                          // Pure L2 drop
          }
        }

        const newAim: any = {
          id: genId(),
          type: payload.kind === "outcome" ? "outcome" : "leap",
          label: aimLabel,
          level: priority,
          levelMode: "override",
          overrideLevel,
          ...(subSelections ? { subSelections, subPriorities, isPrimary: false } : {}),
        };

        // Duplicate guard: for L3 outcomes check the L2 aim already contains that L3 subSelection.
        const l3Check = subSelections?.[0]?.toLowerCase();
        const isDuplicate = (existingAims: any[]) =>
          existingAims.some((a: any) => {
            if (a.type !== newAim.type) return false;
            if (String(a.label).toLowerCase() !== String(aimLabel).toLowerCase()) return false;
            if (!l3Check) return !a.subSelections || a.subSelections.length === 0;
            return Array.isArray(a.subSelections) &&
              a.subSelections.some((s: any) => String(s).toLowerCase() === l3Check);
          });

        if (targetSubId) {
          const subs: any[] = Array.isArray(de.subcomponents) ? [...de.subcomponents] : [];
          const adultSubs: any[] = Array.isArray(de.adultSubcomponents) ? [...de.adultSubcomponents] : [];
          const subIdx = subs.findIndex((s: any) => s.id === targetSubId);
          const aSubIdx = adultSubs.findIndex((s: any) => s.id === targetSubId);
          if (subIdx >= 0) {
            const sub = { ...subs[subIdx] };
            const existingAims: any[] = Array.isArray(sub.aims) ? sub.aims : [];
            if (!isDuplicate(existingAims)) {
              sub.aims = [...existingAims, newAim];
              if (sub.keyDesignElements) sub.keyDesignElements = { ...sub.keyDesignElements, aims: sub.aims };
            }
            subs[subIdx] = sub;
            de.subcomponents = subs;
          } else if (aSubIdx >= 0) {
            const sub = { ...adultSubs[aSubIdx] };
            const existingAims: any[] = Array.isArray(sub.aims) ? sub.aims : [];
            if (!isDuplicate(existingAims)) {
              sub.aims = [...existingAims, newAim];
              if (sub.keyDesignElements) sub.keyDesignElements = { ...sub.keyDesignElements, aims: sub.aims };
            }
            adultSubs[aSubIdx] = sub;
            de.adultSubcomponents = adultSubs;
          }
        } else {
          const kde: any = { ...(de.keyDesignElements ?? { aims: [], practices: [], supports: [] }) };
          const existingAims: any[] = Array.isArray(kde.aims) ? kde.aims : [];
          if (!isDuplicate(existingAims)) {
            kde.aims = [...existingAims, newAim];
            de.keyDesignElements = kde;
          }
        }
      } else if (payload.kind === "designElement") {
        const markAsKey = "markAsKey" in opts ? opts.markAsKey : false;
        const { elementId, bucketKey: bk, tagId, archetype } = payload;

        const patchExpert = (expertData: any): any => {
          const updated = { ...(expertData ?? {}) };
          const elData = { ...(updated[elementId] ?? {}) };
          const bv: any = { ...(elData[bk] ?? {}) };
          if (archetype === "A1") {
            const a1 = { ...(bv.archetypeA1 ?? {}) };
            const sels: any[] = Array.isArray(a1.selections) ? [...a1.selections] : [];
            const alreadyIn = sels.some((s: any) => s.tagId === tagId);
            if (!alreadyIn) {
              a1.selections = [...sels, { tagId, isKey: markAsKey }];
              bv.archetypeA1 = a1;
            } else if (markAsKey) {
              a1.selections = sels.map((s: any) => s.tagId === tagId ? { ...s, isKey: true } : s);
              bv.archetypeA1 = a1;
            }
          } else {
            const a2: any = { ...(bv.archetypeA2 ?? {}) };
            if (!a2.selectedId) {
              a2.selectedId = tagId;
              if (markAsKey) a2.isKey = true;
              bv.archetypeA2 = a2;
            }
          }
          elData[bk] = bv;
          updated[elementId] = elData;
          return updated;
        };

        if (targetSubId) {
          const subs: any[] = Array.isArray(de.subcomponents) ? [...de.subcomponents] : [];
          const adultSubs: any[] = Array.isArray(de.adultSubcomponents) ? [...de.adultSubcomponents] : [];
          const subIdx = subs.findIndex((s: any) => s.id === targetSubId);
          const aSubIdx = adultSubs.findIndex((s: any) => s.id === targetSubId);
          if (subIdx >= 0) {
            subs[subIdx] = { ...subs[subIdx], elementsExpertData: patchExpert(subs[subIdx].elementsExpertData) };
            de.subcomponents = subs;
          } else if (aSubIdx >= 0) {
            adultSubs[aSubIdx] = { ...adultSubs[aSubIdx], elementsExpertData: patchExpert(adultSubs[aSubIdx].elementsExpertData) };
            de.adultSubcomponents = adultSubs;
          }
        } else {
          de.elementsExpertData = patchExpert(de.elementsExpertData);
        }
      }

      updateMutation.mutate({ nodeId: targetNodeId, data: { designedExperienceData: de } });
      setDropConfirm(null);
    },
    [dropConfirm, componentsRaw, queryClient, updateMutation],
  );

  /** Use last good list whenever present — don't require isSuccess (refetch errors would hide real nodes). */
  const componentsList = Array.isArray(componentsRaw) ? componentsRaw : [];
  const hasComponentRows = componentsList.length > 0;

  const persistRingLayout = hasComponentRows;

  const nodes: CanvasNode[] = hasComponentRows
    ? componentsList.map((c) => componentToCanvasNode(c, componentsList))
    : [SHELL_OVERALL_CANVAS_NODE];

  const derivedNodes: CanvasNode[] = useMemo(() => {
    const list = [...nodes];
    // Overall uses its stored canvas position only — never re-anchor to ring centroid when ring nodes move.
    list.sort((a, b) => (a.nodeId === "overall" ? 1 : 0) - (b.nodeId === "overall" ? 1 : 0));
    return list;
  }, [nodes]);

  useEffect(() => {
    if (!isSuccess || !Array.isArray(componentsRaw) || componentsRaw.length > 0) return;
    if (autoSeedAttempted.current) return;
    autoSeedAttempted.current = true;
    seedMutation.mutate(undefined, {
      onError: () => {
        autoSeedAttempted.current = false;
      },
    });
    // seedMutation.mutate is stable; omit from deps to avoid re-running on mutation identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, componentsRaw]);

  useEffect(() => {
    if (selectedNode?.nodeId === "overall") {
      // Default to Journey & Overview tab for the center component.
      if (activeTab === "snapshot") setActiveTab("overview-and-context");
    }
  }, [activeTab, selectedNode?.nodeId]);

  useEffect(() => {
    if (selectedNode?.nodeId !== "overall") return;
    if (activeTab === "overview-and-context") setOverallCenterMode("overview");
    if (activeTab === "designed-experience") setOverallCenterMode("designed");
    if (activeTab === "status-and-health") setOverallCenterMode("status");
  }, [activeTab, selectedNode?.nodeId]);

  // Clear ring highlight on any navigation change.
  useEffect(() => {
    setRingHighlight(null);
  }, [designedCardRoute, overallCardRoute, overallCenterMode, activeTab, isExpandedWorkingSpace]);

  // Clear ring highlight on Esc key.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRingHighlight(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--lml-strip-offset", libraryOpen ? LML_STRIP_HEIGHT_CLAMP : "0px");
    return () => {
      document.documentElement.style.removeProperty("--lml-strip-offset");
    };
  }, [libraryOpen]);

  const ringListForDrop = useMemo(
    () => (Array.isArray(componentsRaw) ? componentsRaw.filter((c: any) => String(c?.nodeId || "") !== "overall") : []),
    [componentsRaw],
  );

  const onBlueprintDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setBlueprintDropActive(false);
    const resolved = resolveCatalogPickFromDrop(e.dataTransfer);
    if (!resolved) return;
    const idSet = new Set(ringListForDrop.map((c: any) => String(c.nodeId)));
    const slot = ringListForDrop.length;
    await addRingComponentFromCatalogPick(
      resolved.pick,
      (body) => createMutation.mutateAsync(body),
      {
        slot,
        existingNodeIds: idSet,
        colorIndex: slot,
      },
      resolved.audience,
    );
  };

  const onSheetPanelDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setSheetPanelDropActive(false);
    const resolved = resolveCatalogPickFromDrop(e.dataTransfer);
    if (!resolved || !selectedNode) return;

    if (selectedNode.nodeId === "overall") {
      const idSet = new Set(ringListForDrop.map((c: any) => String(c.nodeId)));
      const slot = ringListForDrop.length;
      await addRingComponentFromCatalogPick(
        resolved.pick,
        (body) => createMutation.mutateAsync(body),
        { slot, existingNodeIds: idSet, colorIndex: slot },
        resolved.audience,
      );
      return;
    }

    const raw = Array.isArray(componentsRaw)
      ? componentsRaw.find((c: any) => String(c?.nodeId) === selectedNode.nodeId)
      : undefined;
    if (!raw) return;
    const de: any = raw.designedExperienceData || {};
    if (resolved.audience === "adult") {
      const adultSubs = [...(de.adultSubcomponents || [])];
      adultSubs.push(subcomponentFromCatalogPick(resolved.pick, "adult"));
      updateMutation.mutate({
        nodeId: selectedNode.nodeId,
        data: { designedExperienceData: { ...de, adultSubcomponents: adultSubs } },
      });
    } else {
      const subs = [...(de.subcomponents || [])];
      subs.push(subcomponentFromCatalogPick(resolved.pick, "learner"));
      updateMutation.mutate({
        nodeId: selectedNode.nodeId,
        data: { designedExperienceData: { ...de, subcomponents: subs } },
      });
    }
  };

  // Build the list of ring nodes for full-view navigation (all non-overall components)
  const ringNodeList: RingNode[] = React.useMemo(() => {
    if (!Array.isArray(componentsRaw)) return [];
    return (componentsRaw as any[])
      .filter((c) => c?.nodeId !== "overall" && c?.nodeId != null)
      .map((c) => {
        const canvasNode = derivedNodes.find((n) => n.nodeId === String(c.nodeId));
        return { nodeId: String(c.nodeId), rawComp: c, bgClassName: canvasNode?.color ?? "bg-gray-100" };
      });
  }, [componentsRaw, derivedNodes]);

  return (
    <div className="w-full h-screen bg-[#F8F9FA] flex flex-col overflow-hidden font-sans">
      <LearnerModuleLibraryStrip />
      <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* ── Left: Canvas ── */}
      <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
      <div className="absolute top-4 left-0 right-0 px-6 flex justify-between items-center z-10">
         <div className="flex items-center gap-2">
           <button
             type="button"
             onClick={toggleLibrary}
             className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
             title="Open or close learner module library"
           >
             <Library className="w-3.5 h-3.5" />
             Module library
           </button>
         </div>
         
         <div className="bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
            Steven Test Blueprint #2
         </div>
         
         <div className="bg-gray-900 text-white p-2 rounded-lg shadow-lg flex gap-4">
             <div className="w-4 h-4 rounded-full border border-gray-500" />
             <div className="w-4 h-4 rounded-full border border-gray-500" />
             <div className="w-4 h-4 rounded-full border border-gray-500" />
             <div className="w-px h-4 bg-gray-700" />
             <div className="w-4 h-4 rounded-full border border-gray-500" />
         </div>
      </div>

      <div className="absolute left-4 top-20 bottom-20 w-12 bg-blue-900 rounded-full flex flex-col items-center py-6 gap-6 shadow-xl z-10">
         <div className="w-2 h-2 rounded-full bg-white/50" />
         <div className="w-2 h-2 rounded-full bg-white/50" />
         <div className="w-2 h-2 rounded-full bg-white" />
         <div className="w-2 h-2 rounded-full bg-white/50" />
      </div>

      <div
        className={cn(
          "absolute inset-0 cursor-grab touch-none select-none overflow-hidden transition-[box-shadow] rounded-[inherit] active:cursor-grabbing",
          blueprintDropActive && "ring-4 ring-emerald-500 ring-offset-2 ring-offset-[#F8F9FA]",
        )}
        onPointerDownCapture={(e) => {
          if (!(e.target as HTMLElement).closest(`[${DATA_BLUEPRINT_NODE}]`)) {
            setRingHighlight(null);
          }
          if (e.button !== 0) return;
          if ((e.target as HTMLElement).closest(`[${DATA_BLUEPRINT_NODE}]`)) return;
          const host = e.currentTarget as HTMLElement;
          host.setPointerCapture(e.pointerId);
          blueprintPanSessionRef.current = {
            pointerId: e.pointerId,
            lastX: e.clientX,
            lastY: e.clientY,
          };
        }}
        onPointerMove={(e) => {
          const s = blueprintPanSessionRef.current;
          if (!s || s.pointerId !== e.pointerId) return;
          const dx = e.clientX - s.lastX;
          const dy = e.clientY - s.lastY;
          s.lastX = e.clientX;
          s.lastY = e.clientY;
          setBlueprintPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        }}
        onPointerUp={(e) => {
          const s = blueprintPanSessionRef.current;
          if (!s || s.pointerId !== e.pointerId) return;
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          blueprintPanSessionRef.current = null;
        }}
        onPointerCancel={(e) => {
          const s = blueprintPanSessionRef.current;
          if (!s || s.pointerId !== e.pointerId) return;
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          blueprintPanSessionRef.current = null;
        }}
        onDragEnter={(e) => {
          if (!dataTransferHasLearnerModule(e.dataTransfer)) return;
          e.preventDefault();
          setBlueprintDropActive(true);
        }}
        onDragOver={(e) => {
          if (!dataTransferHasLearnerModule(e.dataTransfer)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setBlueprintDropActive(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setBlueprintDropActive(false);
        }}
        onDrop={onBlueprintDrop}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${blueprintPan.x}px, ${blueprintPan.y}px) scale(${CANVAS_STAGE_SCALE})`,
            transformOrigin: "center center",
          }}
        >
          {blueprintDropActive ? (
            <div className="pointer-events-none absolute top-8 left-1/2 z-20 -translate-x-1/2 rounded-full border border-emerald-400 bg-white/95 px-4 py-2 text-center text-xs font-semibold text-emerald-900 shadow-md">
              Drop to add component to blueprint
            </div>
          ) : null}
          {derivedNodes.map((node) => (
            <OctagonNode
              key={node.nodeId}
              node={node}
              rawComp={
                node.nodeId !== "overall"
                  ? (Array.isArray(componentsRaw)
                      ? componentsRaw.find((c: any) => String(c?.nodeId) === node.nodeId)
                      : undefined)
                  : undefined
              }
              onClick={() => {
                // Double-click → open working panel. Closes full view if open.
                if (node.nodeId === "overall") return;
                setRingFullViewState(null);
                setSelectedNode(node);
              }}
              onOpenFullView={(nodeId) => {
                if (nodeId === "overall") return;
                const raw = Array.isArray(componentsRaw)
                  ? componentsRaw.find((c: any) => String(c?.nodeId) === nodeId)
                  : undefined;
                const canvasNode = derivedNodes.find((n) => n.nodeId === nodeId);
                if (raw && canvasNode) {
                  // Close the working panel before opening full view.
                  setSelectedNode(null);
                  setOpenSubId(null);
                  setIsExpandedWorkingSpace(false);
                  setRingFullViewState({ nodeId, rawComp: raw, bgClassName: canvasNode.color, mode: "component" });
                }
              }}
              onOpenDataPreviewFullView={(nodeId, _w) => {
                if (nodeId === "overall") return;
                const raw = Array.isArray(componentsRaw)
                  ? componentsRaw.find((c: any) => String(c?.nodeId) === nodeId)
                  : undefined;
                const canvasNode = derivedNodes.find((n) => n.nodeId === nodeId);
                if (raw && canvasNode) {
                  // Close the working panel before opening full view.
                  setSelectedNode(null);
                  setOpenSubId(null);
                  setIsExpandedWorkingSpace(false);
                  setRingFullViewState({ nodeId, rawComp: raw, bgClassName: canvasNode.color, mode: "dataWindow" });
                }
              }}
              onDrill={(nodeId, drillTarget) => {
                if (nodeId === "overall") return;
                const raw = Array.isArray(componentsRaw)
                  ? componentsRaw.find((c: any) => String(c?.nodeId) === nodeId)
                  : undefined;
                const canvasNode = derivedNodes.find((n) => n.nodeId === nodeId);
                if (raw && canvasNode) {
                  setSelectedNode(null);
                  setOpenSubId(null);
                  setIsExpandedWorkingSpace(false);
                  setRingFullViewState({ nodeId, rawComp: raw, bgClassName: canvasNode.color, mode: "dataWindow", initialDrillTarget: drillTarget });
                }
              }}
              onDimensionClick={(nodeId, dimensionKey) => {
                if (nodeId === "overall") return;
                const raw = Array.isArray(componentsRaw)
                  ? componentsRaw.find((c: any) => String(c?.nodeId) === nodeId)
                  : undefined;
                const canvasNode = derivedNodes.find((n) => n.nodeId === nodeId);
                if (raw && canvasNode) {
                  setSelectedNode(null);
                  setOpenSubId(null);
                  setIsExpandedWorkingSpace(false);
                  setRingFullViewState({
                    nodeId,
                    rawComp: raw,
                    bgClassName: canvasNode.color,
                    mode: "dataWindow",
                    initialDrillTarget: { kind: "dimension", dimensionKey },
                  });
                }
              }}
              onDoubleClickDataPreviewEdit={(nodeId) => {
                if (nodeId === "overall") return;
                const targetNode = derivedNodes.find((n) => n.nodeId === nodeId);
                if (!targetNode) return;
                const payload = scopedEditPayloadForDataWindow(selectedDataWindow);
                setRingFullViewState(null);
                setSelectedNode(targetNode);
                setActiveTab(payload.tab);
                setOpenSubId(payload.openSubId ?? null);
                setInitialSubId(payload.initialSubId ?? null);
                setDeNavTarget(payload.deNav ?? null);
                setIsExpandedWorkingSpace(false);
              }}
              onDoubleClickItemEdit={(nodeId, payload) => {
                if (nodeId === "overall") return;
                const targetNode = derivedNodes.find((n) => n.nodeId === nodeId);
                if (!targetNode) return;
                setRingFullViewState(null);
                setSelectedNode(targetNode);
                setActiveTab(payload.tab);
                setOpenSubId(payload.openSubId ?? null);
                setInitialSubId(payload.initialSubId ?? null);
                setDeNavTarget(payload.deNav ?? null);
                setShPage(payload.shPage ?? null);
                setIsExpandedWorkingSpace(false);
              }}
              overallCenterMode={overallCenterMode}
              onSetOverallCenterMode={setOverallCenterMode}
              onNavigateOverall={(target) => {
                const overallNode = derivedNodes.find((n) => n.nodeId === "overall") || node;
                setRingFullViewState(null);
                setSelectedNode(overallNode);
                setOpenSubId(null);
                setActiveTab("overview-and-context");
                setOverallNavTarget(target);
              }}
              onOpenOverallTab={(tab) => {
                const overallNode = derivedNodes.find((n) => n.nodeId === "overall") || node;
                setRingFullViewState(null);
                setSelectedNode(overallNode);
                setOpenSubId(null);
                setActiveTab(tab);
              }}
              onSetDeNavTarget={setDeNavTarget}
              overallCardRoute={overallCardRoute}
              onSetOverallCardRoute={setOverallCardRoute}
              designedCardRoute={designedCardRoute}
              onSetDesignedCardRoute={setDesignedCardRoute}
              ringHighlightSourceKey={ringHighlight?.sourceKey ?? null}
              onPinRingHighlight={pinHighlight}
              isHighlighted={ringHighlight?.nodeIds.has(node.nodeId) ?? false}
              onOpenRingComponent={(targetNodeId) => {
                const raw = Array.isArray(componentsRaw)
                  ? componentsRaw.find((c: any) => String(c?.nodeId) === targetNodeId)
                  : undefined;
                if (raw) {
                  setRingFullViewState(null);
                  setSelectedNode(componentToCanvasNode(raw, componentsList));
                  setActiveTab("snapshot");
                  setOpenSubId(null);
                }
              }}
              persistLayout={persistRingLayout && node.nodeId !== "overall"}
              canvasStageScale={CANVAS_STAGE_SCALE}
              onCommitCanvasPosition={(nodeId, x, y) => {
                updateMutation.mutate({ nodeId, data: { canvasX: x, canvasY: y } });
              }}
              onDeleteNode={(nodeId) => {
                deleteMutation.mutate(nodeId, {
                  onSuccess: () => {
                    setSelectedNode((prev) => (prev?.nodeId === nodeId ? null : prev));
                  },
                });
              }}
              selectedDataWindow={selectedDataWindow}
              onDataWindowChange={setSelectedDataWindow}
              onDesignItemDrop={node.nodeId !== "overall" ? (payload) => {
                const rawComp = Array.isArray(componentsRaw)
                  ? componentsRaw.find((c: any) => String(c?.nodeId) === node.nodeId)
                  : undefined;
                setDropConfirm({
                  payload,
                  targetNodeId: node.nodeId,
                  targetName: node.title,
                  rawComp,
                });
              } : undefined}
              onOpenCenterFullView={node.nodeId === "overall" ? (slot) => {
                // Close ring split and working panel — same exclusivity as ring full view.
                setRingFullViewState(null);
                setSelectedNode(null);
                setOpenSubId(null);
                setInitialSubId(null);
                setIsExpandedWorkingSpace(false);
                setDeNavTarget(null);
                setOverallNavTarget(null);
                setShPage(null);
                setCenterFullViewRoute(slot);
              } : undefined}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-row-reverse items-center gap-3">
        <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-200 px-2 py-2 gap-1">
          <button type="button" className="px-2 text-gray-500 hover:text-gray-900 font-bold">
            -
          </button>
          <span className="text-xs font-medium text-gray-600 min-w-[2.5rem] text-center">50%</span>
          <button type="button" className="px-2 text-gray-500 hover:text-gray-900 font-bold">
            +
          </button>
        </div>
        <button
          type="button"
          title="AI companion (prototype)"
          className="shrink-0 bg-blue-900 text-white p-3 rounded-full shadow-lg cursor-pointer hover:bg-blue-800 transition-colors"
          data-testid="button-ai-companion-fab"
        >
          <Bot className="w-5 h-5" />
        </button>
      </div>

      <ComponentWorkingSpaceOverlay
        open={!!selectedNode && isExpandedWorkingSpace}
        onOpenChange={(open) => setIsExpandedWorkingSpace(open)}
        selectedNode={selectedNode ? { nodeId: selectedNode.nodeId, title: selectedNode.title, color: selectedNode.color } : null}
        componentsRaw={componentsRaw}
        activeTab={activeTab}
        onActiveTabChange={(tab) => setActiveTab(tab)}
        initialSubId={initialSubId}
        onInitialSubIdConsumed={() => setInitialSubId(null)}
        openSubId={openSubId}
        onOpenSubIdChange={setOpenSubId}
        overallNavTarget={overallNavTarget}
        onOverallNavTargetConsumed={() => setOverallNavTarget(null)}
        deNavTarget={deNavTarget}
        onDeNavTargetConsumed={() => setDeNavTarget(null)}
        onRequestOpenComponent={(targetNodeId) => {
          const raw = Array.isArray(componentsRaw) ? componentsRaw.find((c: any) => String(c?.nodeId) === targetNodeId) : undefined;
          if (raw) {
            setRingFullViewState(null);
            setCenterFullViewRoute(null);
            setSelectedNode(componentToCanvasNode(raw, componentsList));
            setActiveTab("snapshot");
            setOpenSubId(null);
          }
        }}
        onRequestNavigateToStudentDemographics={() => {
          setOpenSubId(null);
          setActiveTab("overview-and-context");
          setOverallNavTarget({ level: "L3", section: "enrollment.studentDemographics" });
        }}
      />

      </div>{/* end canvas left panel */}

      {/* ── Right: Working panel (same split + resize as full view) ── */}
      {selectedNode && !isExpandedWorkingSpace && !ringFullViewState && !centerFullViewRoute && (
        <>
          <RightPaneResizeDivider
            dividerDragRef={dividerDragRef}
            fullViewWidthPct={fullViewWidthPct}
            setFullViewWidthPct={setFullViewWidthPct}
          />
          <div
            className="shrink-0 min-h-0 flex flex-col overflow-hidden bg-[#F8F9FA] shadow-[-4px_0_16px_rgba(0,0,0,0.08)]"
            style={{ width: `${fullViewWidthPct}%` }}
          >
            <div
              className={cn(
                "relative flex h-full min-h-0 flex-1 flex-col transition-[box-shadow,background-color]",
                sheetPanelDropActive && selectedNode?.nodeId && "ring-4 ring-inset ring-sky-500 bg-sky-50/30",
              )}
              onDragEnter={(e) => {
                if (!dataTransferHasLearnerModule(e.dataTransfer) || !selectedNode?.nodeId) return;
                e.preventDefault();
                setSheetPanelDropActive(true);
              }}
              onDragOver={(e) => {
                if (!dataTransferHasLearnerModule(e.dataTransfer) || !selectedNode?.nodeId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setSheetPanelDropActive(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setSheetPanelDropActive(false);
              }}
              onDrop={onSheetPanelDrop}
            >
              {sheetPanelDropActive && selectedNode?.nodeId ? (
                <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-4">
                  <div className="rounded-full border border-sky-300 bg-white/95 px-4 py-2 text-center text-xs font-semibold text-sky-900 shadow-md">
                    {selectedNode.nodeId === "overall"
                      ? `Drop to add ${moduleLibraryAudience === "adult" ? "adult" : "learner"} experience component to the blueprint`
                      : moduleLibraryAudience === "adult"
                        ? `Drop to add adult subcomponent to “${selectedNode.title}”`
                        : `Drop to add learner subcomponent to “${selectedNode.title}”`}
                  </div>
                </div>
              ) : null}
              <ComponentWorkingPanel
                selectedNode={selectedNode ? { nodeId: selectedNode.nodeId, title: selectedNode.title, color: selectedNode.color } : null}
                componentsRaw={componentsRaw}
                activeTab={activeTab}
                onActiveTabChange={(tab) => { setActiveTab(tab); if (tab !== "status-and-health") setShPage(null); }}
                initialSubId={initialSubId}
                onInitialSubIdConsumed={() => setInitialSubId(null)}
                openSubId={openSubId}
                onOpenSubIdChange={setOpenSubId}
                overallNavTarget={overallNavTarget}
                onOverallNavTargetConsumed={() => setOverallNavTarget(null)}
                deNavTarget={deNavTarget}
                onDeNavTargetConsumed={() => setDeNavTarget(null)}
                shPage={shPage}
                onClose={() => {
                  setSelectedNode(null);
                  setOpenSubId(null);
                  setIsExpandedWorkingSpace(false);
                }}
                onExpand={() => setIsExpandedWorkingSpace(true)}
                showExpandButton
                onRequestOpenComponent={(targetNodeId) => {
                  const raw = Array.isArray(componentsRaw) ? componentsRaw.find((c: any) => String(c?.nodeId) === targetNodeId) : undefined;
                  if (raw) {
                    setRingFullViewState(null);
                    setCenterFullViewRoute(null);
                    setSelectedNode(componentToCanvasNode(raw, componentsList));
                    setActiveTab("snapshot");
                    setOpenSubId(null);
                  }
                }}
                onRequestNavigateToStudentDemographics={() => {
                  setOpenSubId(null);
                  setActiveTab("overview-and-context");
                  setOverallNavTarget({ level: "L3", section: "enrollment.studentDemographics" });
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Right: Full View panel (true side-by-side) ── */}
      {ringFullViewState && (
        <>
          <RightPaneResizeDivider
            dividerDragRef={dividerDragRef}
            fullViewWidthPct={fullViewWidthPct}
            setFullViewWidthPct={setFullViewWidthPct}
          />
          {/* Full view panel */}
          <div
            className="shrink-0 min-h-0 overflow-hidden shadow-[-4px_0_16px_rgba(0,0,0,0.08)]"
            style={{ width: `${fullViewWidthPct}%` }}
          >
            <RingFullView
              comp={ringFullViewState.rawComp}
              bgClassName={ringFullViewState.bgClassName}
              mode={ringFullViewState.mode}
              initialDrillTarget={ringFullViewState.initialDrillTarget}
              selectedDataWindow={selectedDataWindow}
              onDataWindowChange={(w) => {
                setSelectedDataWindow(w);
                setRingFullViewState((prev) => prev ? { ...prev, initialDrillTarget: null } : null);
              }}
              ringNodes={ringNodeList}
              onNavigate={(node) => {
                setRingFullViewState((prev) =>
                  prev ? { ...prev, nodeId: node.nodeId, rawComp: node.rawComp, bgClassName: node.bgClassName, initialDrillTarget: null } : null,
                );
              }}
              onClose={() => setRingFullViewState(null)}
              onSwitchToDataWindow={(w) => {
                setSelectedDataWindow(w);
                setRingFullViewState((prev) => prev ? { ...prev, mode: "dataWindow", initialDrillTarget: null } : null);
              }}
              onSwitchToComponent={() => {
                setRingFullViewState((prev) => prev ? { ...prev, mode: "component", initialDrillTarget: null } : null);
              }}
              onSwitchToDimension={(dimensionKey) => {
                setRingFullViewState((prev) =>
                  prev
                    ? { ...prev, mode: "dataWindow", initialDrillTarget: { kind: "dimension", dimensionKey } }
                    : null
                );
              }}
              onSwitchToDataWindowWithDrill={(w, drillTarget) => {
                setSelectedDataWindow(w);
                setRingFullViewState((prev) => prev ? { ...prev, mode: "dataWindow", initialDrillTarget: drillTarget } : null);
              }}
              onOpenEdit={() => {
                const state = ringFullViewState;
                if (!state) return;
                const targetNode = derivedNodes.find((n) => n.nodeId === state.nodeId);
                if (!targetNode) return;
                // Header pencil: always open main component at Journey & Overview.
                setRingFullViewState(null);
                setSelectedNode(targetNode);
                setActiveTab("snapshot");
                setOpenSubId(null);
                setInitialSubId(null);
                setDeNavTarget(null);
                setIsExpandedWorkingSpace(false);
              }}
              onOpenScopedEdit={(payload) => {
                const state = ringFullViewState;
                if (!state) return;
                const targetNode = derivedNodes.find((n) => n.nodeId === state.nodeId);
                if (!targetNode) return;
                setRingFullViewState(null);
                setSelectedNode(targetNode);
                setActiveTab(payload.tab);
                setOpenSubId(payload.openSubId ?? null);
                setInitialSubId(payload.initialSubId ?? null);
                setDeNavTarget(payload.deNav ?? null);
                setShPage(payload.shPage ?? null);
                setIsExpandedWorkingSpace(false);
              }}
            />
          </div>
        </>
      )}
      {/* ── Right: Center Full View panel ── */}
      {centerFullViewRoute && !ringFullViewState && (
        <>
          <RightPaneResizeDivider
            dividerDragRef={dividerDragRef}
            fullViewWidthPct={fullViewWidthPct}
            setFullViewWidthPct={setFullViewWidthPct}
          />
          {/* Center full view panel */}
          <div
            className="shrink-0 min-h-0 overflow-hidden shadow-[-4px_0_16px_rgba(0,0,0,0.08)]"
            style={{ width: `${fullViewWidthPct}%` }}
          >
            {(() => {
              const overallRaw = Array.isArray(componentsRaw)
                ? (componentsRaw as any[]).find((c) => c?.nodeId === "overall")
                : undefined;
              const ringRaw = Array.isArray(componentsRaw)
                ? (componentsRaw as any[]).filter((c) => c?.nodeId !== "overall" && c?.nodeId != null)
                : [];
              const overallNode = derivedNodes.find((n) => n.nodeId === "overall");
              const dePreview = overallNode?.designedExperiencePreview ?? EMPTY_DESIGNED_EXPERIENCE_PREVIEW;
              const joPreview = overallNode?.overviewContextPreview;
              return (
                <CenterFullView
                  slot={centerFullViewRoute!}
                  onNavigate={(s) => setCenterFullViewRoute(s)}
                  onClose={() => setCenterFullViewRoute(null)}
                  dePreview={dePreview}
                  joPreview={joPreview}
                  rawOverallComp={overallRaw}
                  ringComps={ringRaw}
                  ringHighlightSourceKey={ringHighlight?.sourceKey ?? null}
                  onPinRingHighlight={pinHighlight}
                  onOpenWorkingSpace={(target) => {
                    setCenterFullViewRoute(null);
                    setIsExpandedWorkingSpace(false);
                    setActiveTab("designed-experience");
                    setDeNavTarget(target);
                    const overallNode2 = derivedNodes.find((n) => n.nodeId === "overall");
                    if (overallNode2) setSelectedNode(overallNode2);
                  }}
                  onOpenJOWorkingSpace={(target) => {
                    setCenterFullViewRoute(null);
                    setIsExpandedWorkingSpace(false);
                    const overallNode2 = derivedNodes.find((n) => n.nodeId === "overall");
                    if (overallNode2) setSelectedNode(overallNode2);
                    setRingFullViewState(null);
                    setOpenSubId(null);
                    setActiveTab("overview-and-context");
                    setOverallNavTarget(target);
                  }}
                />
              );
            })()}
          </div>
        </>
      )}

      </div>{/* end flex row */}

      {/* Design-item drop confirmation modal */}
      {dropConfirm && (() => {
        const de: any = dropConfirm.rawComp?.designedExperienceData ?? {};
        const subs: SubcomponentOption[] = [
          ...((de.subcomponents ?? []) as any[]).map((s: any) => ({ id: s.id, name: s.name || "Learner experience", kind: "learner" as const })),
          ...((de.adultSubcomponents ?? []) as any[]).map((s: any) => ({ id: s.id, name: s.name || "Adult experience", kind: "adult" as const })),
        ];
        return (
          <DesignItemDropModal
            payload={dropConfirm.payload}
            targetName={dropConfirm.targetName}
            subcomponents={subs}
            onConfirm={handleDropConfirm}
            onCancel={() => setDropConfirm(null)}
          />
        );
      })()}
    </div>
  );
}

export default function CanvasView() {
  return (
    <LearnerModuleLibraryProvider>
      <CanvasViewInner />
    </LearnerModuleLibraryProvider>
  );
}
