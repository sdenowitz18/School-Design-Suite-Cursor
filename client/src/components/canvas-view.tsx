import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Bot, Hand, Library, X } from "lucide-react";
import { LearnerModuleLibraryProvider, useLearnerModuleLibrary } from "@/contexts/learner-module-library-context";
import LearnerModuleLibraryStrip from "@/components/learner-module-library-strip";
import { LML_STRIP_HEIGHT_CLAMP } from "@/lib/learner-module-library-layout";
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
import { shouldIgnoreOutsideInteraction } from "@/lib/learner-module-library-dismiss-guard";

interface CanvasNode {
  id: string;
  nodeId: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  color: string;
  overviewContextPreview?: {
    schoolName?: string;
    studentCount?: string;
    mission?: string;
  };
  stats: {
    left: number;
    right: number;
    leftLabel: string;
    rightLabel: string;
  }
}

export function componentToCanvasNode(comp: any): CanvasNode {
  const snap = comp.snapshotData || {};
  const ocd: any = (snap as any).overviewContextData || {};
  const studentCount = ocd?.studentCount ?? ocd?.students ?? undefined;
  const mission = ocd?.mission ?? "";
  return {
    id: comp.id,
    nodeId: comp.nodeId,
    title: comp.title,
    subtitle: comp.subtitle,
    x: comp.canvasX,
    y: comp.canvasY,
    color: comp.color,
    overviewContextPreview:
      comp.nodeId === "overall"
        ? {
            schoolName: String(ocd?.schoolName || comp.title || ""),
            studentCount: studentCount !== undefined && studentCount !== null ? String(studentCount) : "",
            mission: String(mission || ""),
          }
        : undefined,
    stats: {
      left: (snap.subcomponents || []).length,
      right: (snap.primaryOutcomes || []).length,
      leftLabel: "Experiences",
      rightLabel: "Outcomes",
    },
  };
}

const FALLBACK_NODES: CanvasNode[] = [
  { id: "1", nodeId: "algebra", title: "Algebra", subtitle: "STEM Component", x: 600, y: 100, color: "bg-emerald-100", stats: { left: 3, right: 2, leftLabel: "Experiences", rightLabel: "Outcomes" } },
  { id: "2", nodeId: "math", title: "Math", subtitle: "STEM Component", x: 300, y: 450, color: "bg-emerald-100", stats: { left: 0, right: 0, leftLabel: "Experiences", rightLabel: "Outcomes" } },
  { id: "3", nodeId: "college_exposure", title: "College Exposure", subtitle: "Access & Opportunity", x: 900, y: 450, color: "bg-blue-100", stats: { left: 0, right: 0, leftLabel: "Experiences", rightLabel: "Outcomes" } },
  { id: "4", nodeId: "overall", title: "Overall School", subtitle: "", x: 600, y: 300, color: "bg-white", stats: { left: 0, right: 0, leftLabel: "Experiences", rightLabel: "Outcomes" } },
];

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
        | "enrollment.enrollmentComposition"
        | "publicAcademic.collegePrep"
        | "publicAcademic.collegeSuccess"
        | "publicAcademic.advancedCourses"
        | "publicAcademic.testScores"
        | "publicAcademic.raceEthnicity"
        | "publicAcademic.lowIncomeStudents"
        | "publicAcademic.studentsWithDisabilities"
        | "stakeholder.students"
        | "stakeholder.families"
        | "stakeholder.educatorsStaff"
        | "stakeholder.administration"
        | "stakeholder.otherCommunityLeaders";
    };

type OverallCardRoute = OverallNavTarget;

/** Matches `transform scale-90` on the canvas stage (tailwind scale-90 = 0.9). */
const CANVAS_STAGE_SCALE = 0.9;
const DRAG_THRESHOLD_PX = 8;

function DraggableRingOctagon({
  node,
  canvasStageScale,
  onOpenPanel,
  onCommitCanvasPosition,
  onDeleteNode,
}: {
  node: CanvasNode;
  canvasStageScale: number;
  onOpenPanel: () => void;
  onCommitCanvasPosition: (nodeId: string, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [draggingPos, setDraggingPos] = useState<{ x: number; y: number } | null>(null);
  const sessionRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);

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
      onOpenPanel();
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={draggingPos ? undefined : { scale: 1.04 }}
      className="group absolute cursor-grab active:cursor-grabbing flex flex-col items-center justify-center w-[220px] h-[220px] touch-none select-none"
      style={{ left: displayX, top: displayY, transform: "translate(-50%, -50%)" }}
      data-testid={`node-${node.nodeId}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-octagon-delete]")) return;
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
      <OctagonCard
        title={node.title}
        subtitle={node.subtitle}
        centerVariant="pill"
        centerText={node.stats.left > 0 ? `${node.stats.left} subcomponents` : "No subcomponents"}
        bgClassName={node.color}
        leftStat={{ label: node.stats.leftLabel, value: String(node.stats.left) }}
        rightStat={{ label: node.stats.rightLabel, value: String(node.stats.right) }}
        className="pointer-events-none"
      />
    </motion.div>
  );
}

const OctagonNode = ({
  node,
  onClick,
  overallCenterMode,
  onSetOverallCenterMode,
  onNavigateOverall,
  onOpenOverallTab,
  overallCardRoute,
  onSetOverallCardRoute,
  persistLayout = false,
  canvasStageScale = CANVAS_STAGE_SCALE,
  onCommitCanvasPosition,
  onDeleteNode,
}: {
  node: CanvasNode;
  onClick: () => void;
  overallCenterMode: OverallCenterMode;
  onSetOverallCenterMode: (mode: OverallCenterMode) => void;
  onNavigateOverall: (target: OverallNavTarget) => void;
  onOpenOverallTab: (tab: "overview-and-context" | "designed-experience" | "status-and-health") => void;
  overallCardRoute: OverallCardRoute;
  onSetOverallCardRoute: (route: OverallCardRoute) => void;
  persistLayout?: boolean;
  canvasStageScale?: number;
  onCommitCanvasPosition?: (nodeId: string, x: number, y: number) => void;
  onDeleteNode?: (nodeId: string) => void;
}) => {
  const isOverall = node.nodeId === "overall";

  if (isOverall) {
     const mode = overallCenterMode;
     const preview = node.overviewContextPreview || {};
     const missionSnippet = (preview.mission || "").trim();
     const missionShort =
       missionSnippet.length > 70 ? `${missionSnippet.slice(0, 70).trim()}…` : missionSnippet;

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

     const titleForRoute = () => {
       if (route.level === "L1") return "Overview & Context";
       if (route.level === "L2") {
         return route.section === "mission"
           ? "Mission"
           : route.section === "contextOverview"
             ? "Context & Overview"
             : route.section === "enrollment"
               ? "Enrollment & Composition"
               : route.section === "publicAcademic"
                 ? "Public Academic Profile"
                 : route.section === "communityReviews"
                   ? "Community Reviews"
                   : "Stakeholder Map";
       }
       const s = route.section;
       if (s.startsWith("contextOverview.")) return "Context & Overview";
       if (s.startsWith("enrollment.")) return "Enrollment & Composition";
       if (s.startsWith("publicAcademic.")) return "Public Academic Profile";
       if (s.startsWith("stakeholder.")) return "Stakeholder Map";
       return "Overview & Context";
     };

     const showBack = route.level !== "L1";

     const drillToL2 = (section: OverallNavTarget extends any ? any : never) => {
       setRoute({ level: "L2", section } as any);
     };

     const drillToL3 = (section: any) => {
       setRoute({ level: "L3", section } as any);
     };

     return (
        <div
          className="absolute w-[320px] h-[255px] z-30"
          style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
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
                  onSetOverallCenterMode("overview");
                }}
              >
            <div className="flex flex-col w-full h-full justify-between">
              <div className="space-y-2">
                {mode === "overview" ? (
                  <div className="relative text-center space-y-1">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className={cn(
                          "text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1",
                          !showBack && "opacity-0 pointer-events-none",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoute({ level: "L1" });
                        }}
                        data-testid="overall-card-back"
                      >
                        Back
                      </button>
                      <div className="text-base font-extrabold text-gray-900">{titleForRoute()}</div>
                      <div className="w-12 flex justify-end">
                        <div className={cn("shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center", modeStyles.pill)}>
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {preview.studentCount ? `${preview.studentCount} student school` : "— student school"}
                    </div>
                  </div>
                ) : (
                  <div className="relative text-center space-y-1">
                    <div className="text-base font-extrabold text-gray-900">
                      {mode === "designed" ? "Designed Experience" : "Performance & Status"}
                    </div>
                    <div className="text-[11px] text-gray-500">{preview.schoolName || node.title}</div>
                    <div className="absolute right-0 top-0">
                      <div className={cn("shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center", modeStyles.pill)}>
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                )}

                {mode === "overview" ? (
                  <div className="bg-white/70 border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
                    <div className="max-h-[150px] overflow-y-auto">
                      {route.level === "L1" && (
                        <>
                          {[
                            { key: "mission", label: "Mission", section: "mission" as const },
                            { key: "context", label: "Context & Overview", section: "contextOverview" as const },
                            { key: "enrollment", label: "Enrollment & Composition", section: "enrollment" as const },
                            { key: "profile", label: "Public Academic Profile", section: "publicAcademic" as const },
                            { key: "reviews", label: "Community Reviews", section: "communityReviews" as const },
                            { key: "stakeholders", label: "Stakeholder Map", section: "stakeholderMap" as const },
                          ].map((row, idx) => (
                            <ContextMenu key={row.key}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn(
                                    "px-3 py-2 flex items-center justify-center hover:bg-gray-50/70",
                                    idx !== 0 && "border-t border-gray-100",
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    drillToL2(row.section);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  data-testid={`overall-l1-${row.key}`}
                                >
                                  <div className="text-[13px] font-semibold text-purple-700">{row.label}</div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    onNavigateOverall({ level: "L2", section: row.section } as any);
                                  }}
                                >
                                  Navigate
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </>
                      )}

                      {route.level === "L2" && route.section === "mission" && (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="p-4 text-sm text-gray-700 min-h-[120px] whitespace-pre-wrap">
                              {missionShort || ""}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                onNavigateOverall({ level: "L2", section: "mission" });
                              }}
                            >
                              Navigate
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )}

                      {route.level === "L2" && route.section === "contextOverview" && (
                        <>
                          {[
                            { key: "community", label: "Community overview", section: "contextOverview.communityOverview" as const },
                            { key: "policy", label: "Policy considerations", section: "contextOverview.policyConsiderations" as const },
                            { key: "history", label: "History of change efforts", section: "contextOverview.historyOfChangeEfforts" as const },
                            { key: "other", label: "Other context", section: "contextOverview.otherContext" as const },
                          ].map((row, idx) => (
                            <ContextMenu key={row.key}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn("px-3 py-2 flex items-center justify-center hover:bg-gray-50/70", idx !== 0 && "border-t border-gray-100")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    drillToL3(row.section);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="text-[12px] font-semibold text-purple-700">{row.label}</div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    onNavigateOverall({ level: "L3", section: row.section } as any);
                                  }}
                                >
                                  Navigate
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </>
                      )}

                      {route.level === "L2" && route.section === "enrollment" && (
                        <>
                          {[
                            { key: "demo", label: "Student demographics", section: "enrollment.studentDemographics" as const },
                            { key: "comp", label: "Enrollment & composition", section: "enrollment.enrollmentComposition" as const },
                          ].map((row, idx) => (
                            <ContextMenu key={row.key}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn("px-3 py-2 flex items-center justify-center hover:bg-gray-50/70", idx !== 0 && "border-t border-gray-100")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    drillToL3(row.section);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="text-[12px] font-semibold text-purple-700">{row.label}</div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    onNavigateOverall({ level: "L3", section: row.section } as any);
                                  }}
                                >
                                  Navigate
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </>
                      )}

                      {route.level === "L2" && route.section === "publicAcademic" && (
                        <>
                          {[
                            { key: "prep", label: "College Prep", section: "publicAcademic.collegePrep" as const },
                            { key: "succ", label: "College Success", section: "publicAcademic.collegeSuccess" as const },
                            { key: "adv", label: "Advanced Courses", section: "publicAcademic.advancedCourses" as const },
                            { key: "test", label: "Test Scores", section: "publicAcademic.testScores" as const },
                            { key: "race", label: "Race & Ethnicity", section: "publicAcademic.raceEthnicity" as const },
                            { key: "low", label: "Low Income Students", section: "publicAcademic.lowIncomeStudents" as const },
                            { key: "dis", label: "Students with Disabilities", section: "publicAcademic.studentsWithDisabilities" as const },
                          ].map((row, idx) => (
                            <ContextMenu key={row.key}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn("px-3 py-2 flex items-center justify-center hover:bg-gray-50/70", idx !== 0 && "border-t border-gray-100")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    drillToL3(row.section);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="text-[12px] font-semibold text-purple-700">{row.label}</div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    onNavigateOverall({ level: "L3", section: row.section } as any);
                                  }}
                                >
                                  Navigate
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </>
                      )}

                      {route.level === "L2" && route.section === "communityReviews" && (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="p-4 text-sm text-gray-500 min-h-[120px]">Populated with GreatSchools data</div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                onNavigateOverall({ level: "L2", section: "communityReviews" });
                              }}
                            >
                              Navigate
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )}

                      {route.level === "L2" && route.section === "stakeholderMap" && (
                        <>
                          {[
                            { key: "students", label: "Students", section: "stakeholder.students" as const },
                            { key: "families", label: "Families", section: "stakeholder.families" as const },
                            { key: "staff", label: "Educators & Staff", section: "stakeholder.educatorsStaff" as const },
                            { key: "admin", label: "Administration", section: "stakeholder.administration" as const },
                            { key: "other", label: "Other Community Leaders", section: "stakeholder.otherCommunityLeaders" as const },
                          ].map((row, idx) => (
                            <ContextMenu key={row.key}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn("px-3 py-2 flex items-center justify-center hover:bg-gray-50/70", idx !== 0 && "border-t border-gray-100")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    drillToL3(row.section);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="text-[12px] font-semibold text-purple-700">{row.label}</div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    onNavigateOverall({ level: "L3", section: row.section } as any);
                                  }}
                                >
                                  Navigate
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                ) : mode === "designed" ? (
                  <div className="bg-white/70 border border-gray-200 rounded-lg p-3">
                    <div className="text-xs font-bold text-gray-800">Jump into Designed Experience</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Key aims, practices & supports for the whole school.</div>
                  </div>
                ) : (
                  <div className="bg-white/70 border border-gray-200 rounded-lg p-3">
                    <div className="text-xs font-bold text-gray-800">Jump into Status & Health</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">View performance, design, implementation, and conditions summaries.</div>
                  </div>
                )}
              </div>

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
              const label = (m: OverallCenterMode) => (m === "overview" ? "Overview & Context" : m === "designed" ? "Designed Experience" : "Performance Status");
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
        canvasStageScale={canvasStageScale}
        onOpenPanel={onClick}
        onCommitCanvasPosition={onCommitCanvasPosition}
        onDeleteNode={onDeleteNode}
      />
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className="absolute cursor-pointer flex flex-col items-center justify-center w-[220px] h-[220px] transition-all"
      style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
      data-testid={`node-${node.nodeId}`}
    >
      <OctagonCard
        title={node.title}
        subtitle={node.subtitle}
        centerVariant="pill"
        centerText={node.stats.left > 0 ? `${node.stats.left} subcomponents` : "No subcomponents"}
        bgClassName={node.color}
        leftStat={{ label: node.stats.leftLabel, value: String(node.stats.left) }}
        rightStat={{ label: node.stats.rightLabel, value: String(node.stats.right) }}
        onClick={onClick}
      />
    </motion.div>
  );
};

function CanvasViewInner() {
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [activeTab, setActiveTab] = useState("snapshot");
  const [initialSubId, setInitialSubId] = useState<string | null>(null);
  const [openSubId, setOpenSubId] = useState<string | null>(null);
  const [isExpandedWorkingSpace, setIsExpandedWorkingSpace] = useState(false);
  const [overallCenterMode, setOverallCenterMode] = useState<OverallCenterMode>("overview");
  const [overallNavTarget, setOverallNavTarget] = useState<OverallNavTarget | null>(null);
  const [overallCardRoute, setOverallCardRoute] = useState<OverallCardRoute>({ level: "L1" });

  const { open: libraryOpen, toggleLibrary, moduleLibraryAudience } = useLearnerModuleLibrary();
  const [blueprintDropActive, setBlueprintDropActive] = useState(false);
  const [sheetPanelDropActive, setSheetPanelDropActive] = useState(false);
  const [handToolActive, setHandToolActive] = useState(false);
  const [blueprintPan, setBlueprintPan] = useState({ x: 0, y: 0 });
  const blueprintPanSessionRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const { data: componentsRaw, isSuccess } = useQuery(componentQueries.all);
  const seedMutation = useSeedComponents();
  const updateMutation = useUpdateComponent();
  const createMutation = useCreateComponent();
  const deleteMutation = useDeleteComponent();
  const autoSeedAttempted = useRef(false);

  const persistRingLayout = Boolean(isSuccess && Array.isArray(componentsRaw) && componentsRaw.length > 0);

  const nodes: CanvasNode[] = componentsRaw && Array.isArray(componentsRaw) && componentsRaw.length > 0
    ? componentsRaw.map(componentToCanvasNode)
    : FALLBACK_NODES;

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
      // Default to Overview & Context tab for the center component.
      if (activeTab === "snapshot") setActiveTab("overview-and-context");
    }
  }, [activeTab, selectedNode?.nodeId]);

  useEffect(() => {
    if (selectedNode?.nodeId !== "overall") return;
    if (activeTab === "overview-and-context") setOverallCenterMode("overview");
    if (activeTab === "designed-experience") setOverallCenterMode("designed");
    if (activeTab === "status-and-health") setOverallCenterMode("status");
  }, [activeTab, selectedNode?.nodeId]);

  useEffect(() => {
    document.documentElement.style.setProperty("--lml-strip-offset", libraryOpen ? LML_STRIP_HEIGHT_CLAMP : "0px");
    return () => {
      document.documentElement.style.removeProperty("--lml-strip-offset");
    };
  }, [libraryOpen]);

  useEffect(() => {
    if (!handToolActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHandToolActive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handToolActive]);

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

  return (
    <div className="w-full h-screen bg-[#F8F9FA] flex flex-col overflow-hidden font-sans">
      <LearnerModuleLibraryStrip />
      <div className="relative flex-1 min-h-0 overflow-hidden">
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
          "absolute inset-0 overflow-hidden transition-[box-shadow] rounded-[inherit]",
          blueprintDropActive && "ring-4 ring-emerald-500 ring-offset-2 ring-offset-[#F8F9FA]",
        )}
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
        {handToolActive ? (
          <div
            className="absolute inset-0 z-0 cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
          />
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
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
              onClick={() => {
                // For center card, clicks drill down within the card. Working space is opened via right-click Navigate.
                if (node.nodeId === "overall") return;
                setSelectedNode(node);
              }}
              overallCenterMode={overallCenterMode}
              onSetOverallCenterMode={setOverallCenterMode}
              onNavigateOverall={(target) => {
                const overallNode = derivedNodes.find((n) => n.nodeId === "overall") || node;
                setSelectedNode(overallNode);
                setOpenSubId(null);
                setActiveTab("overview-and-context");
                setOverallNavTarget(target);
              }}
              onOpenOverallTab={(tab) => {
                const overallNode = derivedNodes.find((n) => n.nodeId === "overall") || node;
                setSelectedNode(overallNode);
                setOpenSubId(null);
                setActiveTab(tab);
              }}
              overallCardRoute={overallCardRoute}
              onSetOverallCardRoute={setOverallCardRoute}
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
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-row-reverse items-center gap-3">
        <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-200 px-2 py-2 gap-1">
          <button
            type="button"
            title={handToolActive ? "Pan the blueprint (Esc to exit)" : "Pan the blueprint — drag empty space"}
            aria-pressed={handToolActive}
            onClick={() => setHandToolActive((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              handToolActive
                ? "bg-sky-100 text-sky-900 ring-2 ring-sky-400 shadow-inner"
                : "text-gray-600 hover:bg-gray-100",
            )}
            data-testid="button-blueprint-hand-tool"
          >
            <Hand className="h-4 w-4" />
          </button>
          <div className="mx-1 h-6 w-px bg-gray-200" />
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

      <Sheet
        open={!!selectedNode && !isExpandedWorkingSpace}
        modal={false}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNode(null);
            setOpenSubId(null);
            setIsExpandedWorkingSpace(false);
          }
        }}
      >
        <SheetContent
          className={cn(
            "w-full sm:max-w-[800px] p-0 border-l border-gray-200 shadow-2xl flex flex-col bg-white !inset-y-auto !right-0 !bottom-0 !top-[var(--lml-strip-offset,0px)] !h-[calc(100vh-var(--lml-strip-offset,0px))] !max-h-[calc(100vh-var(--lml-strip-offset,0px))]",
          )}
          side="right"
          onPointerDownOutside={(e) => {
            if (shouldIgnoreOutsideInteraction(e)) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (shouldIgnoreOutsideInteraction(e)) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (shouldIgnoreOutsideInteraction(e)) e.preventDefault();
          }}
        >
          <div
            className={cn(
              "relative flex h-full min-h-0 flex-col transition-[box-shadow,background-color]",
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
            onActiveTabChange={(tab) => setActiveTab(tab)}
            initialSubId={initialSubId}
            onInitialSubIdConsumed={() => setInitialSubId(null)}
            openSubId={openSubId}
            onOpenSubIdChange={setOpenSubId}
            overallNavTarget={overallNavTarget}
            onOverallNavTargetConsumed={() => setOverallNavTarget(null)}
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
                setSelectedNode(componentToCanvasNode(raw));
                setActiveTab("snapshot");
                setOpenSubId(null);
              }
            }}
          />
          </div>
        </SheetContent>
      </Sheet>

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
        onRequestOpenComponent={(targetNodeId) => {
          const raw = Array.isArray(componentsRaw) ? componentsRaw.find((c: any) => String(c?.nodeId) === targetNodeId) : undefined;
          if (raw) {
            setSelectedNode(componentToCanvasNode(raw));
            setActiveTab("snapshot");
            setOpenSubId(null);
          }
        }}
      />
      </div>
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
