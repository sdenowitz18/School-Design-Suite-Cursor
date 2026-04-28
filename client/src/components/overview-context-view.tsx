import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Info, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StudentDemographicsView, type StudentDemographicsData, DonutChart, PieChart } from "./student-demographics-view";
import { CollegePrepView, type CollegePrepData } from "./college-prep-view";
import { TestScoresView, type TestScoresData } from "./test-scores-view";
import { StudentsWithDisabilitiesView, type StudentsWithDisabilitiesData } from "./students-with-disabilities-view";
import { LowIncomeStudentsView, type LowIncomeStudentsData } from "./low-income-students-view";
import { RaceEthnicityView, type RaceEthnicityData } from "./race-ethnicity-view";
import { CommunityReviewsView } from "./community-reviews-view";
import { VerificationBadge } from "./academic-chart-shared";
import {
  type CalendarType,
  type CalendarMarkingPeriod,
  type SchoolCalendarData,
  CALENDAR_TYPE_OPTIONS,
  countWeekdays,
  fmtCalDate,
  emptySchoolCalendar,
  normalizeSchoolCalendar,
  buildDefaultPeriods,
} from "./school-calendar-shared";

// ─── Section types ────────────────────────────────────────────────────────────

type L2Section =
  | "mission"
  | "contextOverview"
  | "enrollment"
  | "publicAcademic"
  | "communityReviews"
  | "stakeholderMap"
  | "greatSchools";

type L3Section =
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

export type OverallNavTarget =
  | { level: "L1" }
  | { level: "L2"; section: L2Section }
  | { level: "L3"; section: L3Section };

type Route =
  | { level: "L1" }
  | { level: "L2"; section: L2Section }
  | { level: "L3"; section: L3Section };

const L3_SECTION_META: Record<L3Section, { parent: L2Section; label: string }> = {
  "contextOverview.communityOverview": { parent: "contextOverview", label: "Community overview" },
  "contextOverview.policyConsiderations": { parent: "contextOverview", label: "Policy considerations" },
  "contextOverview.historyOfChangeEfforts": { parent: "contextOverview", label: "History of change efforts" },
  "contextOverview.otherContext": { parent: "contextOverview", label: "Other context" },
  "enrollment.studentDemographics": { parent: "enrollment", label: "Student Demographics" },
  "publicAcademic.collegePrep": { parent: "publicAcademic", label: "College Prep" },
  "publicAcademic.testScores": { parent: "publicAcademic", label: "Test Scores" },
  "publicAcademic.raceEthnicity": { parent: "publicAcademic", label: "Race & Ethnicity" },
  "publicAcademic.lowIncomeStudents": { parent: "publicAcademic", label: "Low Income Students" },
  "publicAcademic.studentsWithDisabilities": { parent: "publicAcademic", label: "Students with Disabilities" },
  "stakeholder.students": { parent: "stakeholderMap", label: "Students" },
  "stakeholder.families": { parent: "stakeholderMap", label: "Families" },
  "stakeholder.educatorsStaff": { parent: "stakeholderMap", label: "Educators / Staff" },
  "stakeholder.administrationDistrict": { parent: "stakeholderMap", label: "Administration (District)" },
  "stakeholder.administrationSchool": { parent: "stakeholderMap", label: "Administration (School)" },
  "stakeholder.otherCommunityLeaders": { parent: "stakeholderMap", label: "Other Community Leaders" },
};

const L2_SECTION_LABEL: Record<L2Section, string> = {
  mission: "Mission",
  contextOverview: "Context & Overview",
  enrollment: "Enrollment & Composition",
  publicAcademic: "Public Academic Profile",
  communityReviews: "Community Reviews",
  stakeholderMap: "Stakeholder Map",
  greatSchools: "GreatSchools",
};

function getBreadcrumb(route: Route): string[] {
  if (route.level === "L1") return ["Journey and Overview"];
  if (route.level === "L2") {
    return ["Journey and Overview", L2_SECTION_LABEL[route.section]];
  }
  const l3 = L3_SECTION_META[route.section];
  const l2Crumb = getBreadcrumb({ level: "L2", section: l3.parent });
  return [...l2Crumb, l3.label];
}

/** GreatSchools chart pages — switch directly from the page title dropdown. */
const CHART_NAV_GROUPS: {
  groupLabel: string;
  items: { section: L3Section; label: string }[];
}[] = [
  {
    groupLabel: "Enrollment & Composition",
    items: [{ section: "enrollment.studentDemographics", label: "Student Demographics" }],
  },
  {
    groupLabel: "Public Academic Profile",
    items: [
      { section: "publicAcademic.collegePrep", label: "College Prep" },
      { section: "publicAcademic.testScores", label: "Test Scores" },
      { section: "publicAcademic.raceEthnicity", label: "Race & Ethnicity" },
      { section: "publicAcademic.lowIncomeStudents", label: "Low Income Students" },
      { section: "publicAcademic.studentsWithDisabilities", label: "Students with Disabilities" },
    ],
  },
];

function isChartSwitcherRoute(route: Route): boolean {
  if (route.level !== "L3") return false;
  return CHART_NAV_GROUPS.some((g) => g.items.some((i) => i.section === route.section));
}

function chartNavParent(section: L3Section): L2Section {
  if (section.startsWith("enrollment.")) return "enrollment";
  if (section.startsWith("publicAcademic.")) return "publicAcademic";
  return "enrollment";
}

function titleFromRoute(route: Route): string {
  const crumbs = getBreadcrumb(route);
  return crumbs[crumbs.length - 1] || "Journey and Overview";
}

function getDeepTextKey(route: Route): "communityOverviewText" | "policyConsiderationsText" | "historyOfChangeText" | "otherContextText" | null {
  if (route.level !== "L3") return null;
  if (route.section === "contextOverview.communityOverview") return "communityOverviewText";
  if (route.section === "contextOverview.policyConsiderations") return "policyConsiderationsText";
  if (route.section === "contextOverview.historyOfChangeEfforts") return "historyOfChangeText";
  if (route.section === "contextOverview.otherContext") return "otherContextText";
  return null;
}

function verificationBucketForDeepKey(
  deepKey: "communityOverviewText" | "policyConsiderationsText" | "historyOfChangeText" | "otherContextText",
): "communityOverview" | "policyConsiderations" | "historyOfChange" | "otherContext" {
  if (deepKey === "communityOverviewText") return "communityOverview";
  if (deepKey === "policyConsiderationsText") return "policyConsiderations";
  if (deepKey === "historyOfChangeText") return "historyOfChange";
  return "otherContext";
}

function normalizeContextOverviewVerification(raw: unknown): Record<string, { verified: boolean }> {
  const keys = ["communityOverview", "policyConsiderations", "historyOfChange", "otherContext"] as const;
  const src = raw && typeof raw === "object" ? (raw as Record<string, { verified?: boolean }>) : {};
  const out: Record<string, { verified: boolean }> = {};
  for (const k of keys) {
    out[k] = { verified: !!src[k]?.verified };
  }
  return out;
}

const STAKEHOLDER_KEYS_WITH_VERIFICATION = new Set([
  "students",
  "administrationDistrict",
  "administrationSchool",
]);

function normalizeOcd(raw: any) {
  const ocd = raw && typeof raw === "object" ? raw : {};
  const studentCount = ocd.studentCount ?? ocd.students ?? "";
  return {
    schoolName: typeof ocd.schoolName === "string" ? ocd.schoolName : "",
    schoolType:
      ocd.schoolType === "Elementary School" || ocd.schoolType === "Middle School" || ocd.schoolType === "High School"
        ? ocd.schoolType
        : "",
    district: typeof ocd.district === "string" ? ocd.district : "",
    state: typeof ocd.state === "string" ? ocd.state : "",
    studentCount,
    mission: typeof ocd.mission === "string" ? ocd.mission : "",
    schoolCalendar: normalizeSchoolCalendar(ocd.schoolCalendar),
    whoWeServe: {
      compFRL: Number.isFinite(Number(ocd?.whoWeServe?.compFRL)) ? Math.max(0, Math.min(100, Math.round(Number(ocd?.whoWeServe?.compFRL)))) : 45,
      compIEP: Number.isFinite(Number(ocd?.whoWeServe?.compIEP)) ? Math.max(0, Math.min(100, Math.round(Number(ocd?.whoWeServe?.compIEP)))) : 12,
      compELL: Number.isFinite(Number(ocd?.whoWeServe?.compELL)) ? Math.max(0, Math.min(100, Math.round(Number(ocd?.whoWeServe?.compELL)))) : 8,
      compFemale: Number.isFinite(Number(ocd?.whoWeServe?.compFemale)) ? Math.max(0, Math.min(100, Math.round(Number(ocd?.whoWeServe?.compFemale)))) : 50,
    },
    contextOverview: {
      communityOverviewText: String(ocd?.contextOverview?.communityOverviewText || ""),
      policyConsiderationsText: String(ocd?.contextOverview?.policyConsiderationsText || ""),
      historyOfChangeText: String(ocd?.contextOverview?.historyOfChangeText || ""),
      otherContextText: String(ocd?.contextOverview?.otherContextText || ""),
      verification: normalizeContextOverviewVerification(ocd?.contextOverview?.verification),
    },
    studentDemographics: (() => {
      const sd = ocd?.studentDemographics;
      if (!sd || typeof sd !== "object") return null;
      return {
        raceEthnicity: Array.isArray(sd.raceEthnicity)
          ? (sd.raceEthnicity as any[]).map((e) => ({
              label: typeof e.label === "string" ? e.label : "",
              pct: typeof e.pct === "number" ? e.pct : null,
            }))
          : [],
        lowIncomePct: typeof sd.lowIncomePct === "number" ? sd.lowIncomePct : null,
        femalePct: typeof sd.femalePct === "number" ? sd.femalePct : null,
      } as StudentDemographicsData;
    })(),
    stakeholderMap: {
      students: {
        populationSize: String(ocd?.stakeholderMap?.students?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.students?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.students?.keyRepresentatives || ""),
        verified: !!ocd?.stakeholderMap?.students?.verified,
      },
      families: {
        populationSize: String(ocd?.stakeholderMap?.families?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.families?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.families?.keyRepresentatives || ""),
      },
      educatorsStaff: {
        populationSize: String(ocd?.stakeholderMap?.educatorsStaff?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.educatorsStaff?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.educatorsStaff?.keyRepresentatives || ""),
      },
      administrationDistrict: {
        populationSize: String(ocd?.stakeholderMap?.administrationDistrict?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.administrationDistrict?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.administrationDistrict?.keyRepresentatives || ""),
        verified: !!ocd?.stakeholderMap?.administrationDistrict?.verified,
      },
      administrationSchool: {
        populationSize: String(ocd?.stakeholderMap?.administrationSchool?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.administrationSchool?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.administrationSchool?.keyRepresentatives || ""),
        verified: !!ocd?.stakeholderMap?.administrationSchool?.verified,
      },
      otherCommunityLeaders: {
        populationSize: String(ocd?.stakeholderMap?.otherCommunityLeaders?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.otherCommunityLeaders?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.otherCommunityLeaders?.keyRepresentatives || ""),
      },
    },
  };
}

export default function OverviewContextView({
  nodeId,
  initialRoute,
  onRouteConsumed,
}: {
  nodeId: string;
  initialRoute: OverallNavTarget | null;
  onRouteConsumed: () => void;
}) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compRef = useRef<any>(null);
  const ocdRef = useRef<any>(normalizeOcd(null));

  const [initialized, setInitialized] = useState(false);
  const [ocd, setOcd] = useState(() => normalizeOcd(null));
  const [routeStack, setRouteStack] = useState<Route[]>([{ level: "L1" }]);
  const [calendarEditing, setCalendarEditing] = useState(false);

  useEffect(() => {
    compRef.current = comp;
  }, [comp]);

  useEffect(() => {
    ocdRef.current = ocd;
  }, [ocd]);

  useEffect(() => {
    if (!comp || initialized) return;
    const snap: any = (comp as any).snapshotData || {};
    const next = normalizeOcd(snap.overviewContextData);
    setOcd(next);
    setInitialized(true);
  }, [comp, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (!initialRoute) return;
    const next: Route =
      initialRoute.level === "L1"
        ? { level: "L1" }
        : initialRoute.level === "L2"
          ? { level: "L2", section: initialRoute.section }
          : { level: "L3", section: initialRoute.section };
    setRouteStack([next]);
    onRouteConsumed();
  }, [initialized, initialRoute, onRouteConsumed]);

  const currentRoute = routeStack[routeStack.length - 1] || { level: "L1" };
  const crumbs = useMemo(() => getBreadcrumb(currentRoute), [currentRoute]);

  const pushRoute = (r: Route) => setRouteStack((prev) => [...prev, r]);
  const goHome = () => setRouteStack([{ level: "L1" }]);
  const goBack = () => setRouteStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const jumpToCrumb = useCallback(
    (index: number) => {
      if (index >= crumbs.length - 1) return;
      if (index === 0) {
        goHome();
        return;
      }
      if (currentRoute.level === "L3") {
        const meta = L3_SECTION_META[currentRoute.section];
        setRouteStack([{ level: "L1" }, { level: "L2", section: meta.parent }]);
        return;
      }
      if (currentRoute.level === "L2") {
        goHome();
      }
    },
    [crumbs.length, currentRoute, goHome],
  );

  const jumpToChart = useCallback((section: L3Section) => {
    const parent = chartNavParent(section);
    setRouteStack([
      { level: "L1" },
      { level: "L2", section: parent },
      { level: "L3", section },
    ]);
  }, []);

  const commitSnapshot = useCallback(
    (next: any) => {
      const c = compRef.current;
      if (!c) return;
      const existingSnap: any = (c as any).snapshotData || {};
      updateMutation.mutate({
        nodeId,
        data: {
          snapshotData: {
            ...existingSnap,
            overviewContextData: next,
          },
        },
      });
    },
    [nodeId, updateMutation],
  );

  const doSave = useCallback(
    (next: any) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        commitSnapshot(next);
      }, 600);
    },
    [commitSnapshot],
  );

  useEffect(() => {
    if (!initialized) return;
    doSave(ocd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, ocd]);

  useEffect(() => {
    return () => {
      // Flush any pending debounced save when unmounting the panel.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        commitSnapshot(ocdRef.current);
      }
    };
  }, [commitSnapshot]);

  const chartSwitcherMenuContent = (
    <DropdownMenuContent
      align="start"
      className={cn(
        "min-w-[16rem] max-w-[min(100vw-2rem,24rem)] w-max max-h-[min(32rem,80vh)] overflow-y-auto",
        "bg-white text-gray-900 border border-gray-200 shadow-lg",
      )}
    >
      <DropdownMenuItem
        className="cursor-pointer focus:bg-gray-100 focus:text-gray-900"
        onClick={() => goHome()}
      >
        Journey and Overview
      </DropdownMenuItem>
      <DropdownMenuSeparator className="bg-gray-200" />
      {CHART_NAV_GROUPS.map((group, gi) => (
        <React.Fragment key={group.groupLabel}>
          {gi > 0 ? <DropdownMenuSeparator className="bg-gray-200" /> : null}
          <DropdownMenuLabel className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
            {group.groupLabel}
          </DropdownMenuLabel>
          {group.items.map((item) => {
            const isActive = currentRoute.level === "L3" && currentRoute.section === item.section;
            return (
              <DropdownMenuItem
                key={item.section}
                className={cn(
                  "cursor-pointer whitespace-normal focus:bg-gray-100 focus:text-gray-900",
                  isActive && "bg-gray-50 font-semibold",
                )}
                onClick={() => jumpToChart(item.section)}
              >
                <span className="flex-1">{item.label}</span>
                {isActive ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : null}
              </DropdownMenuItem>
            );
          })}
        </React.Fragment>
      ))}
    </DropdownMenuContent>
  );

  const showBreadcrumb = crumbs.length >= 2;

  const header = (
    <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 pr-2">
          <button
            className={cn(
              "flex items-center gap-1.5 text-xs text-gray-500 font-semibold hover:text-gray-800",
              routeStack.length <= 1 && "opacity-50 pointer-events-none",
            )}
            onClick={goBack}
            type="button"
            data-testid="oc-back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {showBreadcrumb ? (
            <Breadcrumb className="mt-2">
              <BreadcrumbList className="flex-nowrap gap-0.5 sm:gap-1 text-xs text-gray-500">
                {crumbs.map((crumbLabel, i) => (
                  <React.Fragment key={`${i}-${crumbLabel}`}>
                    {i > 0 ? (
                      <BreadcrumbSeparator className="px-0.5 [&>svg]:size-3.5 text-gray-300" />
                    ) : null}
                    <BreadcrumbItem className="min-w-0">
                      {i < crumbs.length - 1 ? (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            className="font-medium text-gray-500 hover:text-gray-900 max-w-[12rem] sm:max-w-none truncate"
                            onClick={() => jumpToCrumb(i)}
                            data-testid={i === 0 ? "oc-crumb-root" : `oc-crumb-${i}`}
                          >
                            {crumbLabel}
                          </button>
                        </BreadcrumbLink>
                      ) : isChartSwitcherRoute(currentRoute) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 max-w-full rounded-md font-semibold text-gray-900 -mx-1 px-1 py-0.5 text-left hover:bg-gray-50"
                              data-testid="oc-chart-title-dropdown"
                            >
                              <span className="whitespace-normal break-words leading-snug min-w-0">
                                {crumbLabel}
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                            </button>
                          </DropdownMenuTrigger>
                          {chartSwitcherMenuContent}
                        </DropdownMenu>
                      ) : (
                        <BreadcrumbPage className="font-semibold text-gray-900 whitespace-normal break-words leading-snug">
                          {crumbLabel}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          ) : (
            <>
              {isChartSwitcherRoute(currentRoute) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="text-lg font-bold text-gray-900 mt-1 text-left inline-flex items-start gap-1.5 rounded-md hover:bg-gray-50 -mx-1 px-1 py-0.5 w-full"
                      data-testid="oc-chart-title-dropdown"
                    >
                      <span className="whitespace-normal break-words leading-snug flex-1 min-w-0">
                        {titleFromRoute(currentRoute)}
                      </span>
                      <ChevronDown className="h-5 w-5 shrink-0 text-gray-500 mt-0.5" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  {chartSwitcherMenuContent}
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  className="text-lg font-bold text-gray-900 mt-1 hover:underline text-left whitespace-normal break-words leading-snug w-full"
                  onClick={goHome}
                  data-testid="oc-title-home"
                >
                  {titleFromRoute(currentRoute)}
                </button>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2 self-center">
          <div className="text-[10px] px-2 py-1 rounded-md border bg-gray-50 text-gray-500 font-bold">Overall</div>
        </div>
      </div>
    </div>
  );

  const L1Item = ({
    label,
    preview,
    onNavigate,
    testId,
  }: {
    label: string;
    preview: string;
    onNavigate: () => void;
    testId: string;
  }) => {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={onNavigate}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3"
            data-testid={testId}
          >
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900">{label}</div>
              {preview ? <div className="text-xs text-gray-500 mt-0.5 truncate">{preview}</div> : null}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 ml-auto shrink-0" />
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={(e) => { e.preventDefault(); onNavigate(); }}>Navigate</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const placeholder = (title: string) => (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-bold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500 mt-0.5">Summary of GreatSchools data coming here.</div>
        </div>
      </div>
    </div>
  );

  const stakeholderKeyFromL3 = (section: L3Section) => {
    if (!section.startsWith("stakeholder.")) return null;
    return section.split(".")[1] as keyof typeof ocd.stakeholderMap;
  };

  const body = (() => {
    if (currentRoute.level === "L1") {
      const schoolName = (ocd.schoolName || (comp as any)?.title || "").trim();
      const schoolType = String(ocd.schoolType || "").trim();
      const mission = (ocd.mission || "").trim();
      const missionPreview = mission ? (mission.length > 160 ? `${mission.slice(0, 160).trim()}…` : mission) : "";
      const studentCount = ocd.studentCount !== undefined && ocd.studentCount !== null && String(ocd.studentCount).trim() ? String(ocd.studentCount).trim() : "—";
      const district = String(ocd.district || "").trim();
      const state = String(ocd.state || "").trim();

      const cal = ocd.schoolCalendar;
      const calAutoWeekdays = countWeekdays(cal.schoolYearStart, cal.schoolYearEnd);
      const calInstructionalDays = cal.instructionalDays ?? (calAutoWeekdays || null);
      const calHasData = !!(cal.schoolYearStart && cal.schoolYearEnd);
      const calTypeLabel = CALENDAR_TYPE_OPTIONS.find((o) => o.id === cal.calendarType)?.label ?? "";

      const stakeholderCards: { key: L3Section; ocdKey: keyof typeof ocd.stakeholderMap; label: string; showReps?: boolean }[] = [
        { key: "stakeholder.students", ocdKey: "students", label: "Students" },
        { key: "stakeholder.families", ocdKey: "families", label: "Families" },
        { key: "stakeholder.educatorsStaff", ocdKey: "educatorsStaff", label: "Educators / Staff" },
        { key: "stakeholder.administrationDistrict", ocdKey: "administrationDistrict", label: "Admin (District)", showReps: true },
        { key: "stakeholder.administrationSchool", ocdKey: "administrationSchool", label: "Admin (School)", showReps: true },
        { key: "stakeholder.otherCommunityLeaders", ocdKey: "otherCommunityLeaders", label: "Community Leaders", showReps: true },
      ];

      const demoData = ocd.studentDemographics;

      const updateCalendar = (patch: Partial<SchoolCalendarData>) => {
        setOcd((prev) => ({ ...prev, schoolCalendar: { ...prev.schoolCalendar, ...patch } }));
      };
      const setCalType = (type: CalendarType) => {
        updateCalendar({ calendarType: type, markingPeriods: buildDefaultPeriods(type) });
      };
      const updatePeriod = (id: string, patch: Partial<CalendarMarkingPeriod>) => {
        updateCalendar({ markingPeriods: cal.markingPeriods.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
      };
      const removePeriod = (id: string) => {
        updateCalendar({ markingPeriods: cal.markingPeriods.filter((p) => p.id !== id) });
      };

      return (
        <div className="max-w-5xl mx-auto pb-24 px-6 md:px-10">
          <div className="grid grid-cols-1 gap-6 pt-6">

            {/* ── General ── */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b pb-2">General</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School name</div>
                    <div className="text-sm text-gray-900" data-testid="oc-school-name">{schoolName || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">District</div>
                    <div className="text-sm text-gray-900" data-testid="oc-district">{district || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">State</div>
                    <div className="text-sm text-gray-900" data-testid="oc-state">{state || "—"}</div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School type</div>
                    <select
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
                      value={schoolType}
                      onChange={(e) => setOcd((prev) => ({ ...prev, schoolType: e.target.value }))}
                      data-testid="oc-school-type"
                    >
                      <option value="">Select…</option>
                      <option value="Elementary School">Elementary School</option>
                      <option value="Middle School">Middle School</option>
                      <option value="High School">High School</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Mission ── */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b pb-2 flex items-center justify-between">
                Mission
                <button type="button" onClick={() => pushRoute({ level: "L2", section: "mission" })} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" data-testid="oc-edit-mission" title="Edit mission">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </h3>
              <div>
                {mission ? (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{missionPreview}</div>
                ) : (
                  <div className="text-sm text-gray-400 italic">No mission statement yet.</div>
                )}
              </div>
            </div>

            {/* ── Who's Involved ── */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b pb-2">Who's Involved</h3>
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {stakeholderCards.map((s) => {
                    const item = ocd.stakeholderMap[s.ocdKey];
                    const pop = item?.populationSize;
                    const reps = item?.keyRepresentatives?.trim();
                    const repNames = reps ? reps.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean) : [];
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => pushRoute({ level: "L3", section: s.key })}
                        className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-300 transition-colors text-left group"
                        data-testid={`oc-stakeholder-card-${s.ocdKey}`}
                      >
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 leading-tight">{s.label}</span>
                        {s.showReps ? (
                          repNames.length > 0 && (
                            <div className="space-y-0.5 mt-0.5">
                              {repNames.slice(0, 3).map((name, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                                  <span className="text-[11px] text-gray-500 leading-tight truncate">{name}</span>
                                </div>
                              ))}
                              {repNames.length > 3 && <span className="text-[10px] text-gray-400">+{repNames.length - 3} more</span>}
                            </div>
                          )
                        ) : (
                          pop && <span className="text-lg font-bold text-gray-900 leading-none">{pop}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Demographics</div>
                    <button type="button" onClick={() => pushRoute({ level: "L3", section: "enrollment.studentDemographics" })} className="text-[11px] text-purple-600 hover:text-purple-800 font-medium" data-testid="oc-enroll-student-demographics">
                      Edit
                    </button>
                  </div>
                  {demoData && (demoData.raceEthnicity?.some((e) => e.pct !== null) || demoData.lowIncomePct !== null || demoData.femalePct !== null) ? (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
                      <div className="space-y-1.5">
                        {(demoData.raceEthnicity ?? []).map((entry, idx) => {
                          const hasValue = entry.pct !== null;
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <div className="text-[11px] text-gray-600 w-32 shrink-0 leading-tight truncate">{entry.label}</div>
                              <div className={cn("text-[11px] font-semibold w-7 shrink-0 text-right", hasValue ? "text-gray-900" : "text-gray-400")}>
                                {hasValue ? `${entry.pct}%` : "—"}
                              </div>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                {hasValue && (entry.pct ?? 0) > 0 && (
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${entry.pct}%` }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-col gap-3 min-w-[140px]">
                        <div className="flex items-center gap-2.5">
                          <DonutChart pct={demoData.lowIncomePct} size={40} />
                          <div className="text-[11px] text-gray-600 leading-tight">
                            {demoData.lowIncomePct !== null ? (<><span className="font-bold text-gray-900">{demoData.lowIncomePct}%</span> Low income</>) : (<span className="text-gray-400 italic">Not set</span>)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <PieChart femalePct={demoData.femalePct} size={40} />
                          <div className="text-[11px] leading-tight space-y-0.5">
                            {demoData.femalePct !== null ? (
                              <>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-500" /><span className="text-gray-600">{demoData.femalePct}% F</span></div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-900" /><span className="text-gray-600">{100 - demoData.femalePct}% M</span></div>
                              </>
                            ) : (<span className="text-gray-400 italic">Not set</span>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No demographics data yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── School Calendar ── */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  School Calendar
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs font-normal" onClick={() => setCalendarEditing(!calendarEditing)} data-testid="oc-toggle-calendar-edit">
                  {calendarEditing ? (<><Check className="w-3.5 h-3.5 mr-1" />Done</>) : (<><Pencil className="w-3.5 h-3.5 mr-1" />Edit Calendar</>)}
                </Button>
              </h3>

              {!calendarEditing ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Year</div>
                      <div className="text-sm text-gray-900">{calHasData ? `${fmtCalDate(cal.schoolYearStart)} – ${fmtCalDate(cal.schoolYearEnd)}` : "Not set"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Instructional Days</div>
                      <div className="text-sm text-gray-900">{calInstructionalDays ?? "—"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendar Type</div>
                      <div className="text-sm text-gray-900">{calTypeLabel || "—"}</div>
                    </div>
                  </div>

                  {cal.markingPeriods.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Marking Periods</div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[1fr_1.5fr_auto] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Period</div>
                          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Date Range</div>
                          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Instructional Days</div>
                        </div>
                        {cal.markingPeriods.map((period, idx) => {
                          const pDays = countWeekdays(period.startDate, period.endDate);
                          return (
                            <div key={period.id} className={cn("grid grid-cols-[1fr_1.5fr_auto] gap-4 px-4 py-3 items-center", idx < cal.markingPeriods.length - 1 && "border-b border-gray-100")}>
                              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" /><span className="text-sm font-medium text-gray-900">{period.name}</span></div>
                              <div className="text-sm text-gray-700">{period.startDate && period.endDate ? `${fmtCalDate(period.startDate)} – ${fmtCalDate(period.endDate)}` : "—"}</div>
                              <div className="text-sm font-medium text-gray-900 text-right min-w-[60px]">{pDays || "—"}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!calHasData && cal.markingPeriods.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No calendar set up yet. Click "Edit Calendar" to get started.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-xs text-gray-500 -mt-2">Set your school year dates and marking periods.</p>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">School Year</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Starts</div>
                        <input type="date" value={cal.schoolYearStart} onChange={(e) => updateCalendar({ schoolYearStart: e.target.value, instructionalDays: null })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" data-testid="oc-cal-year-start" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Ends</div>
                        <input type="date" value={cal.schoolYearEnd} onChange={(e) => updateCalendar({ schoolYearEnd: e.target.value, instructionalDays: null })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" data-testid="oc-cal-year-end" />
                      </div>
                    </div>
                    {calAutoWeekdays > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-medium">Instructional Days:</span>
                        <Input type="number" value={String(cal.instructionalDays ?? calAutoWeekdays)} onChange={(e) => { const v = e.target.value.trim(); updateCalendar({ instructionalDays: v ? Number(v) : null }); }} className="h-7 w-20 text-xs" data-testid="oc-cal-instructional-days" />
                        {cal.instructionalDays !== null && cal.instructionalDays !== calAutoWeekdays && (
                          <button type="button" onClick={() => updateCalendar({ instructionalDays: null })} className="text-[11px] text-purple-600 hover:underline">Reset to auto ({calAutoWeekdays})</button>
                        )}
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Marking Periods</h4>
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendar Type</div>
                      <select className="h-9 w-full max-w-[200px] rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700" value={cal.calendarType ?? ""} onChange={(e) => { const v = e.target.value as CalendarType; if (v) setCalType(v); }} data-testid="oc-cal-type">
                        <option value="">Select…</option>
                        {CALENDAR_TYPE_OPTIONS.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
                      </select>
                    </div>
                    {cal.markingPeriods.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center mb-1 pl-1">
                          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Name</span>
                          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">Start Date</span>
                          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">End Date</span>
                          <span className="w-8" />
                        </div>
                        {cal.markingPeriods.map((period) => (
                          <div key={period.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center p-2 rounded-lg border border-gray-200 bg-gray-50/50">
                            <input type="text" value={period.name} onChange={(e) => updatePeriod(period.id, { name: e.target.value })} className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 w-full" />
                            <input type="date" value={period.startDate} onChange={(e) => updatePeriod(period.id, { startDate: e.target.value })} className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" />
                            <input type="date" value={period.endDate} onChange={(e) => updatePeriod(period.id, { endDate: e.target.value })} className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" />
                            <button onClick={() => removePeriod(period.id)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Context & Overview ── */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b pb-2">Context & Overview</h3>
              <div className="space-y-1">
                {([
                  { key: "contextOverview.communityOverview" as const, label: "Community Overview" },
                  { key: "contextOverview.policyConsiderations" as const, label: "Policy Considerations" },
                  { key: "contextOverview.historyOfChangeEfforts" as const, label: "History of Change Efforts" },
                  { key: "contextOverview.otherContext" as const, label: "Other Context" },
                ] as const).map((it) => (
                  <button key={it.key} type="button" onClick={() => pushRoute({ level: "L3", section: it.key })} className="flex items-center justify-between w-full text-left py-2 group" data-testid={`oc-context-link-${it.key}`}>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{it.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* ── Public Academic Profile ── */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b pb-2">Public Academic Profile</h3>
              <div className="space-y-1">
                {([
                  { key: "publicAcademic.collegePrep" as const, label: "College Prep" },
                  { key: "publicAcademic.testScores" as const, label: "Test Scores" },
                  { key: "publicAcademic.raceEthnicity" as const, label: "Race & Ethnicity" },
                  { key: "publicAcademic.studentsWithDisabilities" as const, label: "Students with Disabilities" },
                  { key: "publicAcademic.lowIncomeStudents" as const, label: "Low Income Students" },
                ] as const).map((it) => (
                  <button key={it.key} type="button" onClick={() => pushRoute({ level: "L3", section: it.key })} className="flex items-center justify-between w-full text-left py-2 group" data-testid={`oc-public-${it.key}`}>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{it.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* ── Community Reviews ── */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 border-b pb-2">Community Reviews</h3>
              <div className="space-y-1">
                <button type="button" onClick={() => pushRoute({ level: "L2", section: "communityReviews" as const })} className="flex items-center justify-between w-full text-left py-2 group" data-testid="oc-community-reviews">
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Community Reviews</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
                </button>
              </div>
            </div>

          </div>
        </div>
      );
    }


    if (currentRoute.level === "L2") {
      if (currentRoute.section === "mission") {
        return (
          <div className="p-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mission statement</div>
              <Textarea
                value={ocd.mission}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setOcd((prev) => ({ ...prev, mission: v }));
                }}
                placeholder="Add the school mission…"
                className="min-h-[160px] text-sm"
                data-testid="oc-mission-text"
              />
            </div>
          </div>
        );
      }

      if (currentRoute.section === "contextOverview") {
        const items: { key: L3Section; label: string; preview: string }[] = [
          { key: "contextOverview.communityOverview", label: "Community overview", preview: ocd.contextOverview.communityOverviewText || "Add text…" },
          { key: "contextOverview.policyConsiderations", label: "Policy considerations", preview: ocd.contextOverview.policyConsiderationsText || "Add text…" },
          { key: "contextOverview.historyOfChangeEfforts", label: "History of change efforts", preview: ocd.contextOverview.historyOfChangeText || "Add text…" },
          { key: "contextOverview.otherContext", label: "Other context", preview: ocd.contextOverview.otherContextText || "Add text…" },
        ];
        return (
          <div className="p-6 space-y-3">
            {items.map((it) => (
              <L1Item
                key={it.key}
                label={it.label}
                preview={it.preview}
                onNavigate={() => pushRoute({ level: "L3", section: it.key })}
                testId={`oc-l2-context-${it.key}`}
              />
            ))}
          </div>
        );
      }

      if (currentRoute.section === "enrollment") {
        return (
          <div className="p-6 space-y-3">
            <L1Item
              label="Student Demographics"
              preview="Summary of GreatSchools data"
              onNavigate={() => pushRoute({ level: "L3", section: "enrollment.studentDemographics" })}
              testId="oc-l2-enrollment-demographics"
            />
          </div>
        );
      }

      if (currentRoute.section === "publicAcademic") {
        const items: { key: L3Section; label: string }[] = [
          { key: "publicAcademic.collegePrep", label: "College Prep" },
          { key: "publicAcademic.testScores", label: "Test Scores" },
          { key: "publicAcademic.raceEthnicity", label: "Race & Ethnicity" },
          { key: "publicAcademic.studentsWithDisabilities", label: "Students with Disabilities" },
          { key: "publicAcademic.lowIncomeStudents", label: "Low Income Students" },
        ];
        return (
          <div className="p-6 space-y-3">
            {items.map((it) => (
              <L1Item
                key={it.key}
                label={it.label}
                preview="Summary of GreatSchools data"
                onNavigate={() => pushRoute({ level: "L3", section: it.key })}
                testId={`oc-l2-public-${it.key}`}
              />
            ))}
          </div>
        );
      }

      if (currentRoute.section === "communityReviews") {
        return (
          <div className="p-6">
            <CommunityReviewsView />
          </div>
        );
      }

      if (currentRoute.section === "stakeholderMap") {
        const items: { key: L3Section; label: string }[] = [
          { key: "stakeholder.students", label: "Students" },
          { key: "stakeholder.families", label: "Families" },
          { key: "stakeholder.educatorsStaff", label: "Educators / Staff" },
          { key: "stakeholder.administrationDistrict", label: "Administration (District)" },
          { key: "stakeholder.administrationSchool", label: "Administration (School)" },
          { key: "stakeholder.otherCommunityLeaders", label: "Other Community Leaders" },
        ];
        return (
          <div className="p-6 space-y-3">
            {items.map((it) => (
              <L1Item
                key={it.key}
                label={it.label}
                preview="Population size, additional context, key representatives"
                onNavigate={() => pushRoute({ level: "L3", section: it.key })}
                testId={`oc-l2-stakeholder-${it.key}`}
              />
            ))}
          </div>
        );
      }

      if (currentRoute.section === "greatSchools") {
        return (
          <div className="p-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-gray-900">GreatSchools data</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Links below will open the relevant GreatSchools-driven pages.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pages</div>
              <div className="space-y-2">
                {[
                  { label: "Enrollment & Composition", onClick: () => pushRoute({ level: "L2", section: "enrollment" as const }), testId: "oc-gs-enrollment" },
                  { label: "Public Academic Profile", onClick: () => pushRoute({ level: "L2", section: "publicAcademic" as const }), testId: "oc-gs-public" },
                  { label: "Community Reviews", onClick: () => pushRoute({ level: "L2", section: "communityReviews" as const }), testId: "oc-gs-reviews" },
                ].map((l) => (
                  <button
                    key={l.label}
                    type="button"
                    onClick={l.onClick}
                    className="w-full flex items-center justify-between text-left text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline py-1"
                    data-testid={l.testId}
                  >
                    <span>{l.label}</span>
                    <ChevronRight className="w-4 h-4 text-blue-300" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      }
    }

    if (currentRoute.level === "L3") {
      const deepKey = getDeepTextKey(currentRoute);
      if (deepKey) {
        const value = ocd.contextOverview[deepKey];
        const vBucket = verificationBucketForDeepKey(deepKey);
        const verified = !!(ocd.contextOverview as any).verification?.[vBucket]?.verified;
        return (
          <div className="p-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</div>
                <VerificationBadge
                  verified={verified}
                  onToggle={() =>
                    setOcd((prev) => {
                      const ver = { ...(prev.contextOverview as any).verification };
                      const b = verificationBucketForDeepKey(deepKey);
                      ver[b] = { verified: !ver[b]?.verified };
                      return {
                        ...prev,
                        contextOverview: { ...prev.contextOverview, verification: ver },
                      };
                    })
                  }
                />
              </div>
              <Textarea
                value={value}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setOcd((prev) => ({
                    ...prev,
                    contextOverview: { ...prev.contextOverview, [deepKey]: v },
                  }));
                }}
                placeholder="Add notes…"
                className="min-h-[220px] text-sm"
                data-testid={`oc-context-text-${deepKey}`}
              />
            </div>
          </div>
        );
      }

      if (currentRoute.section.startsWith("stakeholder.")) {
        const key = stakeholderKeyFromL3(currentRoute.section);
        const item = key ? (ocd.stakeholderMap as any)[key] : null;
        if (!key || !item) return null;
        const showStakeholderVerify = STAKEHOLDER_KEYS_WITH_VERIFICATION.has(String(key));
        const stakeholderVerified = !!(item as any).verified;
        return (
          <div className="p-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
              {showStakeholderVerify ? (
                <div className="flex justify-end">
                  <VerificationBadge
                    verified={stakeholderVerified}
                    onToggle={() =>
                      setOcd((prev) => ({
                        ...prev,
                        stakeholderMap: {
                          ...prev.stakeholderMap,
                          [key]: {
                            ...(prev.stakeholderMap as any)[key],
                            verified: !stakeholderVerified,
                          },
                        },
                      }))
                    }
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Population size</div>
                  <Input
                    value={item.populationSize}
                    onChange={(e) =>
                      setOcd((prev) => ({
                        ...prev,
                        stakeholderMap: {
                          ...prev.stakeholderMap,
                          [key]: { ...prev.stakeholderMap[key], populationSize: e.target.value },
                        },
                      }))
                    }
                    placeholder="e.g., 850"
                    className="h-9"
                    data-testid="oc-stakeholder-population"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Key representatives</div>
                  <Textarea
                    value={item.keyRepresentatives}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setOcd((prev) => ({
                        ...prev,
                        stakeholderMap: {
                          ...prev.stakeholderMap,
                          [key]: { ...prev.stakeholderMap[key], keyRepresentatives: v },
                        },
                      }));
                    }}
                    placeholder="One per line…"
                    className="min-h-[80px] text-sm"
                    style={{ listStyleType: "disc" }}
                    data-testid="oc-stakeholder-reps"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Additional context</div>
                <Textarea
                  value={item.additionalContext}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setOcd((prev) => ({
                      ...prev,
                      stakeholderMap: {
                        ...prev.stakeholderMap,
                        [key]: { ...prev.stakeholderMap[key], additionalContext: v },
                      },
                    }));
                  }}
                  placeholder="Add context…"
                  className="min-h-[160px] text-sm"
                  data-testid="oc-stakeholder-context"
                />
              </div>
            </div>
          </div>
        );
      }

      // Enrollment pages
      if (currentRoute.section === "enrollment.studentDemographics") {
        return (
          <div className="p-6">
            <StudentDemographicsView
              data={ocd.studentDemographics}
              onChange={(next) =>
                setOcd((prev) => ({ ...prev, studentDemographics: next }))
              }
            />
          </div>
        );
      }
      if (currentRoute.section.startsWith("enrollment.")) return <div className="p-6">{placeholder("Enrollment & Composition")}</div>;

      // Public Academic Profile pages
      if (currentRoute.section === "publicAcademic.collegePrep") {
        return (
          <div className="p-6">
            <CollegePrepView
              data={(ocd as any).collegePrep as CollegePrepData | null | undefined}
              onChange={(next) => setOcd((prev: any) => ({ ...prev, collegePrep: next }))}
            />
          </div>
        );
      }
      if (currentRoute.section === "publicAcademic.testScores") {
        return (
          <div className="p-6">
            <TestScoresView
              data={(ocd as any).testScores as TestScoresData | null | undefined}
              onChange={(next) => setOcd((prev: any) => ({ ...prev, testScores: next }))}
            />
          </div>
        );
      }
      if (currentRoute.section === "publicAcademic.raceEthnicity") {
        return (
          <div className="p-6">
            <RaceEthnicityView
              data={(ocd as any).raceEthnicity as RaceEthnicityData | null | undefined}
              onChange={(next) => setOcd((prev: any) => ({ ...prev, raceEthnicity: next }))}
              studentDemographics={(ocd as any).studentDemographics}
            />
          </div>
        );
      }
      if (currentRoute.section === "publicAcademic.lowIncomeStudents") {
        return (
          <div className="p-6">
            <LowIncomeStudentsView
              data={(ocd as any).lowIncomeStudents as LowIncomeStudentsData | null | undefined}
              onChange={(next) => setOcd((prev: any) => ({ ...prev, lowIncomeStudents: next }))}
              lowIncomePct={(ocd as any).studentDemographics?.lowIncomePct ?? null}
            />
          </div>
        );
      }
      if (currentRoute.section === "publicAcademic.studentsWithDisabilities") {
        return (
          <div className="p-6">
            <StudentsWithDisabilitiesView
              data={(ocd as any).studentsWithDisabilities as StudentsWithDisabilitiesData | null | undefined}
              onChange={(next) => setOcd((prev: any) => ({ ...prev, studentsWithDisabilities: next }))}
            />
          </div>
        );
      }
      if (currentRoute.section.startsWith("publicAcademic.")) return <div className="p-6">{placeholder("Public Academic Profile")}</div>;
    }

    return null;
  })();

  return (
    <div className="min-h-full">
      {header}
      {body}
    </div>
  );
}

