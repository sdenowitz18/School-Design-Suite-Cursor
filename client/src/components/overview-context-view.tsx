import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS: { value: string; label: string }[] = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

function parseMmDd(value: string): { mm: string; dd: string } {
  const v = String(value || "").trim();
  // Accept partial during editing:
  // - "09-05" (complete)
  // - "09-" (month only)
  // - "-05" (day only; uncommon but supported)
  if (/^\d{2}-\d{2}$/.test(v)) return { mm: v.slice(0, 2), dd: v.slice(3, 5) };
  if (/^\d{2}-$/.test(v)) return { mm: v.slice(0, 2), dd: "" };
  if (/^-\d{2}$/.test(v)) return { mm: "", dd: v.slice(1, 3) };
  return { mm: "", dd: "" };
}

function makeMmDd(mm: string, dd: string): string {
  if (!mm || !dd) return "";
  return `${mm}-${dd}`;
}

function makePartialMmDd(mm: string, dd: string): string {
  if (mm && dd) return `${mm}-${dd}`;
  if (mm && !dd) return `${mm}-`;
  if (!mm && dd) return `-${dd}`;
  return "";
}

function formatMmDd(value: string): string {
  const v = String(value || "").trim();
  if (!v) return "—";
  const { mm, dd } = parseMmDd(v);
  if (!mm || !dd) return "—";
  const mNum = Number(mm);
  const dNum = Number(dd);
  if (!mm || !dd || !Number.isFinite(mNum) || !Number.isFinite(dNum)) return v;
  const mLabel = MONTHS.find((m) => m.value === mm)?.label || mm;
  return `${mLabel} ${dNum}`;
}

function MonthDayPicker({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  testId: string;
}) {
  const parsed = parseMmDd(value);
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold text-gray-500">{label}</div>
      <div className="flex items-center gap-2">
        <select
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
          value={parsed.mm}
          onChange={(e) => {
            const nextMm = e.currentTarget.value;
            onChange(makePartialMmDd(nextMm, parsed.dd));
          }}
          data-testid={`${testId}-month`}
        >
          <option value="">Month</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
          value={parsed.dd}
          onChange={(e) => {
            const nextDd = e.currentTarget.value;
            onChange(makePartialMmDd(parsed.mm, nextDd));
          }}
          data-testid={`${testId}-day`}
        >
          <option value="">Day</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {Number(d)}
            </option>
          ))}
        </select>
        <div className="text-[11px] text-gray-400 w-20">{formatMmDd(value)}</div>
      </div>
    </div>
  );
}

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

export type OverallNavTarget =
  | { level: "L1" }
  | { level: "L2"; section: L2Section }
  | { level: "L3"; section: L3Section };

type Route =
  | { level: "L1" }
  | { level: "L2"; section: L2Section }
  | { level: "L3"; section: L3Section };

function getBreadcrumb(route: Route): string[] {
  if (route.level === "L1") return ["Overview & Context"];
  if (route.level === "L2") {
    const map: Record<L2Section, string> = {
      mission: "Mission",
      contextOverview: "Context & Overview",
      enrollment: "Enrollment & Composition",
      publicAcademic: "Public Academic Profile",
      communityReviews: "Community Reviews",
      stakeholderMap: "Stakeholder Map",
      greatSchools: "GreatSchools",
    };
    return ["Overview & Context", map[route.section]];
  }

  const labelMap: Record<L3Section, { parent: L2Section; label: string }> = {
    "contextOverview.communityOverview": { parent: "contextOverview", label: "Community overview" },
    "contextOverview.policyConsiderations": { parent: "contextOverview", label: "Policy considerations" },
    "contextOverview.historyOfChangeEfforts": { parent: "contextOverview", label: "History of change efforts" },
    "contextOverview.otherContext": { parent: "contextOverview", label: "Other context" },
    "enrollment.studentDemographics": { parent: "enrollment", label: "Student demographics" },
    "enrollment.enrollmentComposition": { parent: "enrollment", label: "Enrollment & composition" },
    "publicAcademic.collegePrep": { parent: "publicAcademic", label: "College Prep" },
    "publicAcademic.collegeSuccess": { parent: "publicAcademic", label: "College Success" },
    "publicAcademic.advancedCourses": { parent: "publicAcademic", label: "Advanced Courses" },
    "publicAcademic.testScores": { parent: "publicAcademic", label: "Test Scores" },
    "publicAcademic.raceEthnicity": { parent: "publicAcademic", label: "Race & Ethnicity" },
    "publicAcademic.lowIncomeStudents": { parent: "publicAcademic", label: "Low Income Students" },
    "publicAcademic.studentsWithDisabilities": { parent: "publicAcademic", label: "Students with Disabilities" },
    "stakeholder.students": { parent: "stakeholderMap", label: "Students" },
    "stakeholder.families": { parent: "stakeholderMap", label: "Families" },
    "stakeholder.educatorsStaff": { parent: "stakeholderMap", label: "Educators & Staff" },
    "stakeholder.administration": { parent: "stakeholderMap", label: "Administration" },
    "stakeholder.otherCommunityLeaders": { parent: "stakeholderMap", label: "Other Community Leaders" },
  };
  const l3 = labelMap[route.section];
  const l2Crumb = getBreadcrumb({ level: "L2", section: l3.parent });
  return [...l2Crumb, l3.label];
}

function titleFromRoute(route: Route): string {
  const crumbs = getBreadcrumb(route);
  return crumbs[crumbs.length - 1] || "Overview & Context";
}

function getDeepTextKey(route: Route): "communityOverviewText" | "policyConsiderationsText" | "historyOfChangeText" | "otherContextText" | null {
  if (route.level !== "L3") return null;
  if (route.section === "contextOverview.communityOverview") return "communityOverviewText";
  if (route.section === "contextOverview.policyConsiderations") return "policyConsiderationsText";
  if (route.section === "contextOverview.historyOfChangeEfforts") return "historyOfChangeText";
  if (route.section === "contextOverview.otherContext") return "otherContextText";
  return null;
}

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
    studentCount,
    mission: typeof ocd.mission === "string" ? ocd.mission : "",
    schedule: {
      // Stored as generic MM-DD strings (e.g. "09-05"), not specific years.
      schoolYearStart: String(ocd?.schedule?.schoolYearStart || ""),
      schoolYearEnd: String(ocd?.schedule?.schoolYearEnd || ""),
      semester1Start: String(ocd?.schedule?.semester1Start || ""),
      semester1End: String(ocd?.schedule?.semester1End || ""),
      semester2Start: String(ocd?.schedule?.semester2Start || ""),
      semester2End: String(ocd?.schedule?.semester2End || ""),
    },
    timeModel: {
      daysPerYear: String(ocd?.timeModel?.daysPerYear || ""),
      hoursPerDay: String(ocd?.timeModel?.hoursPerDay || ""),
    },
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
    },
    stakeholderMap: {
      students: {
        populationSize: String(ocd?.stakeholderMap?.students?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.students?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.students?.keyRepresentatives || ""),
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
      administration: {
        populationSize: String(ocd?.stakeholderMap?.administration?.populationSize || ""),
        additionalContext: String(ocd?.stakeholderMap?.administration?.additionalContext || ""),
        keyRepresentatives: String(ocd?.stakeholderMap?.administration?.keyRepresentatives || ""),
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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [timeModelOpen, setTimeModelOpen] = useState(false);

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

  const header = (
    <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
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

          <button
            type="button"
            className="text-lg font-bold text-gray-900 truncate mt-1 hover:underline text-left"
            onClick={goHome}
            data-testid="oc-title-home"
          >
            {titleFromRoute(currentRoute)}
          </button>
        </div>
        <div className="shrink-0 flex items-center gap-2">
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

      const scheduleSummary = (() => {
        const s = ocd.schedule;
        const MMDD = /^\d{2}-\d{2}$/;
        const isComplete = (v: string) => MMDD.test(String(v || "").trim());
        const hasAny =
          !!String(s.schoolYearStart || "").trim() ||
          !!String(s.schoolYearEnd || "").trim() ||
          !!String(s.semester1Start || "").trim() ||
          !!String(s.semester1End || "").trim() ||
          !!String(s.semester2Start || "").trim() ||
          !!String(s.semester2End || "").trim();
        const year =
          isComplete(s.schoolYearStart) && isComplete(s.schoolYearEnd)
            ? `${formatMmDd(s.schoolYearStart)} → ${formatMmDd(s.schoolYearEnd)}`
            : hasAny
              ? "Partially set"
              : "Not set";
        const sem1 =
          isComplete(s.semester1Start) && isComplete(s.semester1End)
            ? `${formatMmDd(s.semester1Start)} → ${formatMmDd(s.semester1End)}`
            : s.semester1Start || s.semester1End
              ? "Partially set"
              : "—";
        const sem2 =
          isComplete(s.semester2Start) && isComplete(s.semester2End)
            ? `${formatMmDd(s.semester2Start)} → ${formatMmDd(s.semester2End)}`
            : s.semester2Start || s.semester2End
              ? "Partially set"
              : "—";
        return {
          year,
          sem1,
          sem2,
          hasSemesters: !!(s.semester1Start || s.semester1End || s.semester2Start || s.semester2End),
          isSaved: isComplete(s.schoolYearStart) && isComplete(s.schoolYearEnd),
        };
      })();

      const scheduleHasAny = scheduleSummary.year !== "Not set";

      const timeModelSummary = (() => {
        const tm = ocd.timeModel || { daysPerYear: "", hoursPerDay: "" };
        const days = String(tm.daysPerYear || "").trim();
        const hours = String(tm.hoursPerDay || "").trim();
        const isSaved = !!(days && hours);
        return {
          isSaved,
          label: isSaved ? `${days} days • ${hours} hours/day` : days || hours ? "Partially set" : "Not set",
        };
      })();

      const who = ocd.whoWeServe || { compFRL: 45, compIEP: 12, compELL: 8, compFemale: 50 };
      const setWho = (patch: Partial<typeof who>) =>
        setOcd((prev) => ({ ...prev, whoWeServe: { ...(prev as any).whoWeServe, ...patch } }));

      const stakeholderLinks: { key: L3Section; label: string; preview: string }[] = [
        {
          key: "stakeholder.students",
          label: "Students",
          preview: `${ocd.stakeholderMap.students.populationSize || "—"} • ${ocd.stakeholderMap.students.keyRepresentatives || "—"}`,
        },
        {
          key: "stakeholder.families",
          label: "Families",
          preview: `${ocd.stakeholderMap.families.populationSize || "—"} • ${ocd.stakeholderMap.families.keyRepresentatives || "—"}`,
        },
        {
          key: "stakeholder.educatorsStaff",
          label: "Educators & Staff",
          preview: `${ocd.stakeholderMap.educatorsStaff.populationSize || "—"} • ${ocd.stakeholderMap.educatorsStaff.keyRepresentatives || "—"}`,
        },
        {
          key: "stakeholder.administration",
          label: "Administration",
          preview: `${ocd.stakeholderMap.administration.populationSize || "—"} • ${ocd.stakeholderMap.administration.keyRepresentatives || "—"}`,
        },
        {
          key: "stakeholder.otherCommunityLeaders",
          label: "Other Community Leaders",
          preview: `${ocd.stakeholderMap.otherCommunityLeaders.populationSize || "—"} • ${ocd.stakeholderMap.otherCommunityLeaders.keyRepresentatives || "—"}`,
        },
      ];

      return (
        <div className="p-6 space-y-5">
          {/* 1) General */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4" data-testid="oc-section-general">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">General</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">School name</div>
                <Input
                  value={schoolName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOcd((prev) => ({ ...prev, schoolName: v }));
                  }}
                  placeholder="Overall School"
                  className="h-9"
                  data-testid="oc-school-name"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">School type</div>
                <select
                  className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700"
                  value={schoolType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOcd((prev) => ({ ...prev, schoolType: v }));
                  }}
                  data-testid="oc-school-type"
                >
                  <option value="">Select…</option>
                  <option value="Elementary School">Elementary School</option>
                  <option value="Middle School">Middle School</option>
                  <option value="High School">High School</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">District</div>
                <Input
                  value={district}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOcd((prev) => ({ ...prev, district: v }));
                  }}
                  placeholder="e.g., Springfield Public Schools"
                  className="h-9"
                  data-testid="oc-district"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide"># students</div>
                <Input
                  value={String(ocd.studentCount ?? "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOcd((prev) => ({ ...prev, studentCount: v }));
                  }}
                  placeholder="e.g., 500"
                  className="h-9"
                  data-testid="oc-student-count"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mission</div>
                {mission ? (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{missionPreview}</div>
                ) : (
                  <div className="text-sm text-gray-400 italic">—</div>
                )}
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => pushRoute({ level: "L2", section: "mission" })}
                    data-testid="oc-edit-mission"
                  >
                    Edit mission
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 2) How it's structured */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4" data-testid="oc-section-structure">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">How it’s structured</div>

            {/* Schedule */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Schedule</div>
                <Collapsible open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="oc-toggle-schedule">
                      {scheduleOpen ? "Hide schedule" : "Set schedule"}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>

              {!scheduleOpen ? (
                <div
                  className={cn(
                    "rounded-lg border p-3 text-xs space-y-1",
                    scheduleHasAny ? "bg-blue-50/40 border-blue-200 text-gray-700" : "bg-gray-50 border-gray-200 text-gray-500",
                  )}
                  data-testid="oc-schedule-summary"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-700">School year:</span> {scheduleSummary.year}
                    </div>
                    {scheduleSummary.isSaved ? (
                      <span className="shrink-0 text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                        Saved
                      </span>
                    ) : null}
                  </div>
                  {scheduleSummary.hasSemesters && (
                    <>
                      <div>
                        <span className="font-semibold text-gray-700">Semester 1:</span> {scheduleSummary.sem1}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Semester 2:</span> {scheduleSummary.sem2}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">School year</div>
                    <div className="text-[11px] text-gray-500">Auto-saves as you edit. Generic month/day (no year).</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <MonthDayPicker
                        label="Start"
                        value={ocd.schedule.schoolYearStart}
                        onChange={(next) =>
                          setOcd((prev) => ({ ...prev, schedule: { ...(prev as any).schedule, schoolYearStart: next } }))
                        }
                        testId="oc-schoolyear-start"
                      />
                      <MonthDayPicker
                        label="End"
                        value={ocd.schedule.schoolYearEnd}
                        onChange={(next) =>
                          setOcd((prev) => ({ ...prev, schedule: { ...(prev as any).schedule, schoolYearEnd: next } }))
                        }
                        testId="oc-schoolyear-end"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Semesters (optional)</div>
                    <div className="text-[11px] text-gray-500">Auto-saves as you edit. Generic month/day (no year).</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-700">Semester 1</div>
                        <div className="grid grid-cols-2 gap-3">
                          <MonthDayPicker
                            label="Start"
                            value={ocd.schedule.semester1Start}
                            onChange={(next) =>
                              setOcd((prev) => ({ ...prev, schedule: { ...(prev as any).schedule, semester1Start: next } }))
                            }
                            testId="oc-sem1-start"
                          />
                          <MonthDayPicker
                            label="End"
                            value={ocd.schedule.semester1End}
                            onChange={(next) =>
                              setOcd((prev) => ({ ...prev, schedule: { ...(prev as any).schedule, semester1End: next } }))
                            }
                            testId="oc-sem1-end"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-gray-700">Semester 2</div>
                        <div className="grid grid-cols-2 gap-3">
                          <MonthDayPicker
                            label="Start"
                            value={ocd.schedule.semester2Start}
                            onChange={(next) =>
                              setOcd((prev) => ({ ...prev, schedule: { ...(prev as any).schedule, semester2Start: next } }))
                            }
                            testId="oc-sem2-start"
                          />
                          <MonthDayPicker
                            label="End"
                            value={ocd.schedule.semester2End}
                            onChange={(next) =>
                              setOcd((prev) => ({ ...prev, schedule: { ...(prev as any).schedule, semester2End: next } }))
                            }
                            testId="oc-sem2-end"
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500">Tip: Semesters typically sit within the school year range.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Time model */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Time model</div>
                <Collapsible open={timeModelOpen} onOpenChange={setTimeModelOpen}>
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="oc-toggle-time-model">
                      {timeModelOpen ? "Hide time model" : "Set time model"}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>

              {!timeModelOpen ? (
                <div
                  className={cn(
                    "rounded-lg border p-3 text-xs",
                    timeModelSummary.isSaved ? "bg-blue-50/40 border-blue-200 text-gray-700" : "bg-gray-50 border-gray-200 text-gray-500",
                  )}
                  data-testid="oc-time-model-summary"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-700">Summary:</span> {timeModelSummary.label}
                    </div>
                    {timeModelSummary.isSaved ? (
                      <span className="shrink-0 text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                        Saved
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Calendar model</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-gray-500">Days per year</div>
                        <Input
                          value={String(ocd.timeModel?.daysPerYear ?? "")}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            setOcd((prev) => ({ ...prev, timeModel: { ...(prev as any).timeModel, daysPerYear: v } }));
                          }}
                          placeholder="e.g., 180"
                          className="h-9"
                          data-testid="oc-time-days-per-year"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-gray-500">Hours per day</div>
                        <Input
                          value={String(ocd.timeModel?.hoursPerDay ?? "")}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            setOcd((prev) => ({ ...prev, timeModel: { ...(prev as any).timeModel, hoursPerDay: v } }));
                          }}
                          placeholder="e.g., 6.5"
                          className="h-9"
                          data-testid="oc-time-hours-per-day"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3) Who we serve / reach */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4" data-testid="oc-section-who">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Who we serve / reach</div>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">School population composition</div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 font-medium">Gender (Female / Male)</span>
                    <span className="text-gray-900">{who.compFemale}% / {100 - who.compFemale}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex relative">
                    <div className="h-full bg-pink-400 transition-all duration-200" style={{ width: `${who.compFemale}%` }} />
                    <div className="h-full bg-blue-400 transition-all duration-200 flex-1" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={who.compFemale}
                      onChange={(e) => setWho({ compFemale: Number(e.target.value) })}
                      className="absolute inset-0 opacity-0 cursor-ew-resize"
                      data-testid="oc-who-female"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { key: "compFRL" as const, label: "FRL", color: "bg-amber-500" },
                    { key: "compIEP" as const, label: "IEP", color: "bg-purple-500" },
                    { key: "compELL" as const, label: "ELL", color: "bg-emerald-500" },
                  ].map((row) => {
                    const value = who[row.key];
                    return (
                      <div key={row.key} className="space-y-1.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-600 font-medium">{row.label}</span>
                          <span className="text-gray-900">{value}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                          <div className={cn("h-full transition-all duration-200", row.color)} style={{ width: `${value}%` }} />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={value}
                            onChange={(e) => setWho({ [row.key]: Number(e.target.value) } as any)}
                            className="absolute inset-0 opacity-0 cursor-ew-resize"
                            data-testid={`oc-who-${row.key}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[10px] text-gray-400">Drag bars to adjust percentages.</div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Key stakeholders</div>
                <div className="space-y-2">
                  {stakeholderLinks.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => pushRoute({ level: "L3", section: s.key })}
                      className="w-full flex items-center justify-between text-left px-3 py-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                      data-testid={`oc-stakeholder-link-${s.key}`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-900">{s.label}</div>
                        <div className="text-[11px] text-gray-500 truncate">{s.preview}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => pushRoute({ level: "L2", section: "stakeholderMap" })}
                    data-testid="oc-open-stakeholder-map"
                  >
                    Open stakeholder map
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Links to other context */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3" data-testid="oc-section-context-links">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Links to other context</div>
            <div className="space-y-2">
              {(
                [
                  { key: "contextOverview.communityOverview" as const, label: "Community Overview" },
                  { key: "contextOverview.policyConsiderations" as const, label: "Policy Considerations" },
                  { key: "contextOverview.historyOfChangeEfforts" as const, label: "History of Change Efforts" },
                  { key: "contextOverview.otherContext" as const, label: "Other Context" },
                ] as const
              ).map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => pushRoute({ level: "L3", section: it.key })}
                  className="w-full flex items-center justify-between text-left px-3 py-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                  data-testid={`oc-context-link-${it.key}`}
                >
                  <div className="text-xs font-semibold text-gray-900">{it.label}</div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
            <div className="text-[11px] text-gray-500">
              These link to the same pages available from the center card (and right-click → Navigate).
            </div>
          </div>

          {/* 4) Link to GreatSchool Data */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3" data-testid="oc-section-greatschools">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Link to GreatSchool Data</div>
            <button
              type="button"
              onClick={() => pushRoute({ level: "L2", section: "greatSchools" as const })}
              className="w-full flex items-center justify-between text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              data-testid="oc-link-greatschools"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">GreatSchools data</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">Enrollment, academics, and community reviews</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 ml-auto shrink-0" />
            </button>
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
              label="Student demographics"
              preview="Summary of GreatSchools data"
              onNavigate={() => pushRoute({ level: "L3", section: "enrollment.studentDemographics" })}
              testId="oc-l2-enrollment-demographics"
            />
            <L1Item
              label="Enrollment & composition"
              preview="Summary of GreatSchools data"
              onNavigate={() => pushRoute({ level: "L3", section: "enrollment.enrollmentComposition" })}
              testId="oc-l2-enrollment-composition"
            />
          </div>
        );
      }

      if (currentRoute.section === "publicAcademic") {
        const items: { key: L3Section; label: string }[] = [
          { key: "publicAcademic.collegePrep", label: "College Prep" },
          { key: "publicAcademic.collegeSuccess", label: "College Success" },
          { key: "publicAcademic.advancedCourses", label: "Advanced Courses" },
          { key: "publicAcademic.testScores", label: "Test Scores" },
          { key: "publicAcademic.raceEthnicity", label: "Race & Ethnicity" },
          { key: "publicAcademic.lowIncomeStudents", label: "Low Income Students" },
          { key: "publicAcademic.studentsWithDisabilities", label: "Students with Disabilities" },
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
        return <div className="p-6">{placeholder("Community Reviews")}</div>;
      }

      if (currentRoute.section === "stakeholderMap") {
        const items: { key: L3Section; label: string }[] = [
          { key: "stakeholder.students", label: "Students" },
          { key: "stakeholder.families", label: "Families" },
          { key: "stakeholder.educatorsStaff", label: "Educators & Staff" },
          { key: "stakeholder.administration", label: "Administration" },
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
        return (
          <div className="p-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</div>
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
        return (
          <div className="p-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
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
                  <Input
                    value={item.keyRepresentatives}
                    onChange={(e) =>
                      setOcd((prev) => ({
                        ...prev,
                        stakeholderMap: {
                          ...prev.stakeholderMap,
                          [key]: { ...prev.stakeholderMap[key], keyRepresentatives: e.target.value },
                        },
                      }))
                    }
                    placeholder="Names…"
                    className="h-9"
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

      // Placeholders (GreatSchools-driven)
      if (currentRoute.section.startsWith("enrollment.")) return <div className="p-6">{placeholder("Enrollment & Composition")}</div>;
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

