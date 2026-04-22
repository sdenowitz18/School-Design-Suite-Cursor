import React from "react";
import { Bot, Lock, Pencil, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  COMMUNITY_REVIEWS_MOCK,
  type CommunityReview,
} from "./community-reviews-view";

// ─── Route types ──────────────────────────────────────────────────────────────
//
// Journey & Overview card navigation is structured as 4 levels:
//   L1 — card home (5 tiles)
//   L2 — Mission (terminal text card) OR School Overview (hub list)
//   L3 — inside a School Overview section (list, or terminal for Community Reviews)
//   L4 — the actual leaf card (text, chart preview, or stakeholder detail)

export type ContextOverviewL4 =
  | "schoolOverview.contextOverview.communityOverview"
  | "schoolOverview.contextOverview.policyConsiderations"
  | "schoolOverview.contextOverview.historyOfChangeEfforts"
  | "schoolOverview.contextOverview.otherContext";

export type PublicAcademicL4 =
  | "schoolOverview.publicAcademic.collegePrep"
  | "schoolOverview.publicAcademic.testScores"
  | "schoolOverview.publicAcademic.raceEthnicity"
  | "schoolOverview.publicAcademic.lowIncomeStudents"
  | "schoolOverview.publicAcademic.studentsWithDisabilities";

export type StakeholderL4 =
  | "schoolOverview.stakeholderMap.students"
  | "schoolOverview.stakeholderMap.families"
  | "schoolOverview.stakeholderMap.educatorsStaff"
  | "schoolOverview.stakeholderMap.administrationDistrict"
  | "schoolOverview.stakeholderMap.administrationSchool"
  | "schoolOverview.stakeholderMap.otherCommunityLeaders";

export type EnrollmentL4 = "schoolOverview.enrollment.studentDemographics";

export type JourneyOverviewCardRoute =
  | { level: "L1" }
  | { level: "L2"; section: "mission" | "schoolOverview" }
  | {
      level: "L3";
      section:
        | "schoolOverview.contextOverview"
        | "schoolOverview.enrollment"
        | "schoolOverview.publicAcademic"
        | "schoolOverview.communityReviews"
        | "schoolOverview.stakeholderMap";
    }
  | {
      level: "L4";
      section: ContextOverviewL4 | EnrollmentL4 | PublicAcademicL4 | StakeholderL4;
    };

/** Legacy navigation target used by right-click / cross-link into the working space. */
export type OverallNavTarget =
  | { level: "L1" }
  | {
      level: "L2";
      section: "mission" | "contextOverview" | "enrollment" | "publicAcademic" | "communityReviews" | "stakeholderMap";
    }
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

// ─── Preview data shape ───────────────────────────────────────────────────────

export interface ContextOverviewFieldPreview {
  text: string;
  verified: boolean;
}

export interface PublicAcademicChartPreview {
  currentAsOf: string | null;
  verified: boolean;
  hasData: boolean;
}

export interface StakeholderDetailPreview {
  populationSize: string;
  additionalContext: string;
  keyRepresentatives: string;
  /** undefined for roles that don't track verification yet. */
  verified?: boolean;
}

export interface JourneyOverviewPreview {
  schoolName: string;
  studentCount: string;
  mission: string;
  contextOverview: {
    communityOverview: ContextOverviewFieldPreview;
    policyConsiderations: ContextOverviewFieldPreview;
    historyOfChangeEfforts: ContextOverviewFieldPreview;
    otherContext: ContextOverviewFieldPreview;
  };
  studentDemographics: {
    currentAsOf: string | null;
    verified: boolean;
    hasData: boolean;
  };
  publicAcademic: Record<
    "collegePrep" | "testScores" | "raceEthnicity" | "lowIncomeStudents" | "studentsWithDisabilities",
    PublicAcademicChartPreview
  >;
  stakeholderMap: {
    students: StakeholderDetailPreview;
    families: StakeholderDetailPreview;
    educatorsStaff: StakeholderDetailPreview;
    administrationDistrict: StakeholderDetailPreview;
    administrationSchool: StakeholderDetailPreview;
    otherCommunityLeaders: StakeholderDetailPreview;
  };
}

// ─── Breadcrumb + title helpers ───────────────────────────────────────────────

const SCHOOL_OVERVIEW_LABEL = "School Overview";

export function titleForJourneyRoute(route: JourneyOverviewCardRoute): string {
  if (route.level === "L1") return "Journey & Overview";
  if (route.level === "L2") return route.section === "mission" ? "Mission" : SCHOOL_OVERVIEW_LABEL;
  if (route.level === "L3") {
    switch (route.section) {
      case "schoolOverview.contextOverview":
        return "Context & Overview";
      case "schoolOverview.enrollment":
        return "Enrollment & Composition";
      case "schoolOverview.publicAcademic":
        return "Public Academic Profile";
      case "schoolOverview.communityReviews":
        return "Community Reviews";
      case "schoolOverview.stakeholderMap":
        return "Stakeholder Map";
    }
  }
  return leafLabel(route.section);
}

type L4Section = (JourneyOverviewCardRoute & { level: "L4" })["section"];

function leafLabel(section: L4Section): string {
  switch (section) {
    case "schoolOverview.contextOverview.communityOverview":
      return "Community Overview";
    case "schoolOverview.contextOverview.policyConsiderations":
      return "Policy Considerations";
    case "schoolOverview.contextOverview.historyOfChangeEfforts":
      return "History of Change Efforts";
    case "schoolOverview.contextOverview.otherContext":
      return "Other Context";
    case "schoolOverview.enrollment.studentDemographics":
      return "Student Demographics";
    case "schoolOverview.publicAcademic.collegePrep":
      return "College Prep";
    case "schoolOverview.publicAcademic.testScores":
      return "Test Scores";
    case "schoolOverview.publicAcademic.raceEthnicity":
      return "Race & Ethnicity";
    case "schoolOverview.publicAcademic.lowIncomeStudents":
      return "Low Income Students";
    case "schoolOverview.publicAcademic.studentsWithDisabilities":
      return "Students with Disabilities";
    case "schoolOverview.stakeholderMap.students":
      return "Students";
    case "schoolOverview.stakeholderMap.families":
      return "Families";
    case "schoolOverview.stakeholderMap.educatorsStaff":
      return "Educators / Staff";
    case "schoolOverview.stakeholderMap.administrationDistrict":
      return "Administration (District)";
    case "schoolOverview.stakeholderMap.administrationSchool":
      return "Administration (School)";
    case "schoolOverview.stakeholderMap.otherCommunityLeaders":
      return "Other Community Leaders";
  }
}

interface Crumb {
  label: string;
  to: JourneyOverviewCardRoute;
}

/** Breadcrumbs for display below the card title. Excludes the current leaf (which is the title itself). */
export function breadcrumbForJourneyRoute(route: JourneyOverviewCardRoute): Crumb[] {
  if (route.level === "L1") return [];
  if (route.level === "L2") return [{ label: "Journey & Overview", to: { level: "L1" } }];
  if (route.level === "L3") {
    return [
      { label: "Journey & Overview", to: { level: "L1" } },
      { label: SCHOOL_OVERVIEW_LABEL, to: { level: "L2", section: "schoolOverview" } },
    ];
  }
  const parentL3 = l3ParentForL4(route.section);
  return [
    { label: "Journey & Overview", to: { level: "L1" } },
    { label: SCHOOL_OVERVIEW_LABEL, to: { level: "L2", section: "schoolOverview" } },
    { label: titleForJourneyRoute({ level: "L3", section: parentL3 }), to: { level: "L3", section: parentL3 } },
  ];
}

type L3Section = (JourneyOverviewCardRoute & { level: "L3" })["section"];

function l3ParentForL4(section: (JourneyOverviewCardRoute & { level: "L4" })["section"]): L3Section {
  if (section.startsWith("schoolOverview.contextOverview.")) return "schoolOverview.contextOverview";
  if (section.startsWith("schoolOverview.enrollment.")) return "schoolOverview.enrollment";
  if (section.startsWith("schoolOverview.publicAcademic.")) return "schoolOverview.publicAcademic";
  return "schoolOverview.stakeholderMap";
}

export function parentJourneyRoute(route: JourneyOverviewCardRoute): JourneyOverviewCardRoute {
  if (route.level === "L1") return route;
  if (route.level === "L2") return { level: "L1" };
  if (route.level === "L3") return { level: "L2", section: "schoolOverview" };
  return { level: "L3", section: l3ParentForL4(route.section) };
}

/** Map an in-card route to the legacy working-space nav target (for Edit pencil / cross-link). */
export function workspaceTargetForRoute(route: JourneyOverviewCardRoute): OverallNavTarget | null {
  if (route.level === "L1") return { level: "L1" };
  if (route.level === "L2") {
    if (route.section === "mission") return { level: "L2", section: "mission" };
    return { level: "L1" };
  }
  if (route.level === "L3") {
    switch (route.section) {
      case "schoolOverview.contextOverview":
        return { level: "L2", section: "contextOverview" };
      case "schoolOverview.enrollment":
        return { level: "L2", section: "enrollment" };
      case "schoolOverview.publicAcademic":
        return { level: "L2", section: "publicAcademic" };
      case "schoolOverview.communityReviews":
        return { level: "L2", section: "communityReviews" };
      case "schoolOverview.stakeholderMap":
        return { level: "L2", section: "stakeholderMap" };
    }
  }
  // L4 → flatten to the working-space's L3 identifier.
  const s = route.section;
  if (s.startsWith("schoolOverview.contextOverview.")) {
    const leaf = s.slice("schoolOverview.contextOverview.".length);
    return { level: "L3", section: `contextOverview.${leaf}` as any };
  }
  if (s.startsWith("schoolOverview.enrollment.")) {
    const leaf = s.slice("schoolOverview.enrollment.".length);
    return { level: "L3", section: `enrollment.${leaf}` as any };
  }
  if (s.startsWith("schoolOverview.publicAcademic.")) {
    const leaf = s.slice("schoolOverview.publicAcademic.".length);
    return { level: "L3", section: `publicAcademic.${leaf}` as any };
  }
  if (s.startsWith("schoolOverview.stakeholderMap.")) {
    const leaf = s.slice("schoolOverview.stakeholderMap.".length);
    return { level: "L3", section: `stakeholder.${leaf}` as any };
  }
  return null;
}

// ─── Building-block UI bits ───────────────────────────────────────────────────

function NotVerifiedBadge() {
  return (
    <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
      Not verified
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

/** Compact breadcrumb shown below the title on L2+ routes. Truncates earlier segments with an ellipsis. */
function Breadcrumb({
  crumbs,
  onSetRoute,
}: {
  crumbs: Crumb[];
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
}) {
  if (crumbs.length === 0) return null;
  // Tight space: when 3+ crumbs, collapse everything before the last two into an ellipsis.
  const visible: (Crumb | { ellipsis: true; firstHidden: Crumb })[] =
    crumbs.length <= 2
      ? crumbs
      : [
          { ellipsis: true, firstHidden: crumbs[0] },
          ...crumbs.slice(-2),
        ];
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
  /** When true, clicking the Navigate context-menu item should route in the working space. */
  onNavigate?: () => void;
  rightAdornment?: React.ReactNode;
  disabled?: boolean;
  first?: boolean;
  testId?: string;
}

function ListRow({ label, onClick, onNavigate, rightAdornment, disabled = false, first = false, testId }: ListRowProps) {
  const body = (
    <div
      className={cn(
        "px-3 py-2 flex items-center hover:bg-gray-50/70",
        !first && "border-t border-gray-100",
        disabled ? "opacity-60 cursor-not-allowed hover:bg-transparent" : "cursor-pointer",
      )}
      onClick={(e) => {
        if (disabled || !onClick) return;
        e.stopPropagation();
        onClick();
      }}
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? -1 : 0}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap w-full px-1">
        <div className={cn("text-[12px] font-semibold text-purple-700 truncate", disabled && "text-gray-500")}>{label}</div>
        {rightAdornment}
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

// ─── Mini Community Reviews view ──────────────────────────────────────────────

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5`}>
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

function CommunityReviewRow({ r }: { r: CommunityReview }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50/70 px-2 py-1.5">
      <div className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">{r.role}</div>
      <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{r.body}</p>
    </div>
  );
}

// ─── Edit pencil row ──────────────────────────────────────────────────────────

function EditPencil({ onClick, testId }: { onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800 px-1.5 py-0.5 rounded hover:bg-gray-100"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Open in workspace"
      data-testid={testId}
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function L1Home({
  mission,
  onSetRoute,
  onNavigateOverall,
}: {
  mission: string;
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  return (
    <>
      <ListRow
        label="Mission"
        first
        onClick={() => onSetRoute({ level: "L2", section: "mission" })}
        onNavigate={() => onNavigateOverall({ level: "L2", section: "mission" })}
        testId="jo-l1-mission"
        rightAdornment={
          !mission.trim() ? (
            <span className="text-[9px] font-semibold text-gray-400">Empty</span>
          ) : null
        }
      />
      <ListRow
        label={SCHOOL_OVERVIEW_LABEL}
        onClick={() => onSetRoute({ level: "L2", section: "schoolOverview" })}
        testId="jo-l1-school-overview"
      />
      <ListRow label="Journey Map & Plan" disabled rightAdornment={<StubBadge />} testId="jo-l1-journey-map" />
      <ListRow label="To-Do List" disabled rightAdornment={<StubBadge />} testId="jo-l1-todo" />
      <ListRow label="Journey Artifact Repository" disabled rightAdornment={<StubBadge />} testId="jo-l1-artifact" />
    </>
  );
}

function L2Mission({
  mission,
  onNavigateOverall,
}: {
  mission: string;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const text = mission.trim();
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Mission statement</div>
        <EditPencil onClick={() => onNavigateOverall({ level: "L2", section: "mission" })} testId="jo-mission-edit" />
      </div>
      {text ? (
        <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap line-clamp-6">{text}</p>
      ) : (
        <p className="text-[11px] text-gray-400 italic">No mission captured yet.</p>
      )}
    </div>
  );
}

function L2SchoolOverviewHub({
  preview,
  onSetRoute,
  onNavigateOverall,
}: {
  preview: JourneyOverviewPreview;
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  // Aggregate "any child not-verified" to surface on the hub row.
  const ctxUnverified = Object.values(preview.contextOverview).some((f) => !f.verified && f.text.trim().length > 0);
  const pubUnverified = Object.values(preview.publicAcademic).some((c) => !c.verified && c.hasData);
  const enrUnverified = preview.studentDemographics.hasData && !preview.studentDemographics.verified;
  const stkUnverified = Object.values(preview.stakeholderMap).some(
    (s) =>
      s.verified === false &&
      (s.populationSize.trim().length > 0 ||
        s.additionalContext.trim().length > 0 ||
        s.keyRepresentatives.trim().length > 0),
  );
  return (
    <>
      <ListRow
        first
        label="Context & Overview"
        onClick={() => onSetRoute({ level: "L3", section: "schoolOverview.contextOverview" })}
        onNavigate={() => onNavigateOverall({ level: "L2", section: "contextOverview" })}
        rightAdornment={ctxUnverified ? <NotVerifiedBadge /> : null}
        testId="jo-so-context"
      />
      <ListRow
        label="Enrollment & Composition"
        onClick={() => onSetRoute({ level: "L3", section: "schoolOverview.enrollment" })}
        onNavigate={() => onNavigateOverall({ level: "L2", section: "enrollment" })}
        rightAdornment={enrUnverified ? <NotVerifiedBadge /> : null}
        testId="jo-so-enrollment"
      />
      <ListRow
        label="Public Academic Profile"
        onClick={() => onSetRoute({ level: "L3", section: "schoolOverview.publicAcademic" })}
        onNavigate={() => onNavigateOverall({ level: "L2", section: "publicAcademic" })}
        rightAdornment={pubUnverified ? <NotVerifiedBadge /> : null}
        testId="jo-so-public"
      />
      <ListRow
        label="Community Reviews"
        onClick={() => onSetRoute({ level: "L3", section: "schoolOverview.communityReviews" })}
        onNavigate={() => onNavigateOverall({ level: "L2", section: "communityReviews" })}
        testId="jo-so-reviews"
      />
      <ListRow
        label="Stakeholder Map"
        onClick={() => onSetRoute({ level: "L3", section: "schoolOverview.stakeholderMap" })}
        onNavigate={() => onNavigateOverall({ level: "L2", section: "stakeholderMap" })}
        rightAdornment={stkUnverified ? <NotVerifiedBadge /> : null}
        testId="jo-so-stakeholders"
      />
    </>
  );
}

function L3ContextOverviewList({
  preview,
  onSetRoute,
  onNavigateOverall,
}: {
  preview: JourneyOverviewPreview;
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const rows: { key: keyof JourneyOverviewPreview["contextOverview"]; label: string; target: ContextOverviewL4; navLegacy: OverallNavTarget }[] = [
    {
      key: "communityOverview",
      label: "Community Overview",
      target: "schoolOverview.contextOverview.communityOverview",
      navLegacy: { level: "L3", section: "contextOverview.communityOverview" },
    },
    {
      key: "policyConsiderations",
      label: "Policy Considerations",
      target: "schoolOverview.contextOverview.policyConsiderations",
      navLegacy: { level: "L3", section: "contextOverview.policyConsiderations" },
    },
    {
      key: "historyOfChangeEfforts",
      label: "History of Change Efforts",
      target: "schoolOverview.contextOverview.historyOfChangeEfforts",
      navLegacy: { level: "L3", section: "contextOverview.historyOfChangeEfforts" },
    },
    {
      key: "otherContext",
      label: "Other Context",
      target: "schoolOverview.contextOverview.otherContext",
      navLegacy: { level: "L3", section: "contextOverview.otherContext" },
    },
  ];
  return (
    <>
      {rows.map((r, i) => {
        const f = preview.contextOverview[r.key];
        const showUnverified = !!f.text.trim() && !f.verified;
        return (
          <ListRow
            key={r.key}
            label={r.label}
            first={i === 0}
            onClick={() => onSetRoute({ level: "L4", section: r.target })}
            onNavigate={() => onNavigateOverall(r.navLegacy)}
            rightAdornment={showUnverified ? <NotVerifiedBadge /> : null}
            testId={`jo-ctx-${r.key}`}
          />
        );
      })}
    </>
  );
}

function L4ContextOverviewCard({
  section,
  preview,
  onNavigateOverall,
}: {
  section: ContextOverviewL4;
  preview: JourneyOverviewPreview;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const leafKey = section.slice("schoolOverview.contextOverview.".length) as keyof JourneyOverviewPreview["contextOverview"];
  const f = preview.contextOverview[leafKey];
  const text = f.text.trim();
  const showUnverified = !!text && !f.verified;
  const legacyLeaf = leafKey === "policyConsiderations"
    ? "contextOverview.policyConsiderations"
    : leafKey === "historyOfChangeEfforts"
      ? "contextOverview.historyOfChangeEfforts"
      : leafKey === "otherContext"
        ? "contextOverview.otherContext"
        : "contextOverview.communityOverview";
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {showUnverified ? <NotVerifiedBadge /> : <span />}
        <EditPencil
          onClick={() => onNavigateOverall({ level: "L3", section: legacyLeaf as any })}
          testId={`jo-ctx-edit-${leafKey}`}
        />
      </div>
      {text ? (
        <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap line-clamp-6">{text}</p>
      ) : (
        <p className="text-[11px] text-gray-400 italic">Nothing captured yet for this section.</p>
      )}
    </div>
  );
}

function L3EnrollmentList({
  preview,
  onSetRoute,
  onNavigateOverall,
}: {
  preview: JourneyOverviewPreview;
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const showUnverified = preview.studentDemographics.hasData && !preview.studentDemographics.verified;
  return (
    <ListRow
      first
      label="Student Demographics"
      onClick={() => onSetRoute({ level: "L4", section: "schoolOverview.enrollment.studentDemographics" })}
      onNavigate={() => onNavigateOverall({ level: "L3", section: "enrollment.studentDemographics" })}
      rightAdornment={showUnverified ? <NotVerifiedBadge /> : null}
      testId="jo-enr-student-demographics"
    />
  );
}

function L4StudentDemographicsCard({
  preview,
  onNavigateOverall,
}: {
  preview: JourneyOverviewPreview;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const { currentAsOf, verified, hasData } = preview.studentDemographics;
  const showUnverified = hasData && !verified;
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {showUnverified ? <NotVerifiedBadge /> : <span />}
        <EditPencil
          onClick={() => onNavigateOverall({ level: "L3", section: "enrollment.studentDemographics" })}
          testId="jo-enr-edit-demographics"
        />
      </div>
      <div className="text-[11px] text-gray-600 leading-snug text-center bg-gray-50 border border-dashed border-gray-200 rounded px-2 py-3">
        GreatSchools chart
        <div className="mt-1 text-[10px] text-gray-400">Click <span className="font-semibold">Edit</span> to view the full chart.</div>
      </div>
      {currentAsOf ? <div className="text-[10px] text-gray-400 text-center">As of {currentAsOf}</div> : null}
    </div>
  );
}

function L3PublicAcademicList({
  preview,
  onSetRoute,
  onNavigateOverall,
}: {
  preview: JourneyOverviewPreview;
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const rows: { key: keyof JourneyOverviewPreview["publicAcademic"]; label: string; target: PublicAcademicL4; navLegacy: OverallNavTarget }[] = [
    { key: "collegePrep", label: "College Prep", target: "schoolOverview.publicAcademic.collegePrep", navLegacy: { level: "L3", section: "publicAcademic.collegePrep" } },
    { key: "testScores", label: "Test Scores", target: "schoolOverview.publicAcademic.testScores", navLegacy: { level: "L3", section: "publicAcademic.testScores" } },
    { key: "raceEthnicity", label: "Race & Ethnicity", target: "schoolOverview.publicAcademic.raceEthnicity", navLegacy: { level: "L3", section: "publicAcademic.raceEthnicity" } },
    { key: "lowIncomeStudents", label: "Low Income Students", target: "schoolOverview.publicAcademic.lowIncomeStudents", navLegacy: { level: "L3", section: "publicAcademic.lowIncomeStudents" } },
    { key: "studentsWithDisabilities", label: "Students with Disabilities", target: "schoolOverview.publicAcademic.studentsWithDisabilities", navLegacy: { level: "L3", section: "publicAcademic.studentsWithDisabilities" } },
  ];
  return (
    <>
      {rows.map((r, i) => {
        const chart = preview.publicAcademic[r.key];
        const showUnverified = chart.hasData && !chart.verified;
        return (
          <ListRow
            key={r.key}
            label={r.label}
            first={i === 0}
            onClick={() => onSetRoute({ level: "L4", section: r.target })}
            onNavigate={() => onNavigateOverall(r.navLegacy)}
            rightAdornment={showUnverified ? <NotVerifiedBadge /> : null}
            testId={`jo-pub-${r.key}`}
          />
        );
      })}
    </>
  );
}

function L4PublicAcademicCard({
  section,
  preview,
  onNavigateOverall,
}: {
  section: PublicAcademicL4;
  preview: JourneyOverviewPreview;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const leafKey = section.slice("schoolOverview.publicAcademic.".length) as keyof JourneyOverviewPreview["publicAcademic"];
  const chart = preview.publicAcademic[leafKey];
  const showUnverified = chart.hasData && !chart.verified;
  const legacyTarget: OverallNavTarget = {
    level: "L3",
    section: `publicAcademic.${leafKey}` as any,
  };
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {showUnverified ? <NotVerifiedBadge /> : <span />}
        <EditPencil onClick={() => onNavigateOverall(legacyTarget)} testId={`jo-pub-edit-${leafKey}`} />
      </div>
      <div className="text-[11px] text-gray-600 leading-snug text-center bg-gray-50 border border-dashed border-gray-200 rounded px-2 py-3">
        GreatSchools chart
        <div className="mt-1 text-[10px] text-gray-400">Click <span className="font-semibold">Edit</span> to view the full chart.</div>
      </div>
      {chart.currentAsOf ? <div className="text-[10px] text-gray-400 text-center">As of {chart.currentAsOf}</div> : null}
    </div>
  );
}

function L3CommunityReviewsTerminal({
  onNavigateOverall,
}: {
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const summary = COMMUNITY_REVIEWS_MOCK;
  const avg = summary.averageRating;
  const count = summary.reviews.length;
  const preview = summary.reviews.slice(0, 3);
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[14px] font-bold text-gray-900 tabular-nums leading-none">{avg.toFixed(1)}</div>
          <MiniStars rating={avg} />
          <div className="text-[10px] text-gray-500">{count} reviews</div>
        </div>
        <EditPencil onClick={() => onNavigateOverall({ level: "L2", section: "communityReviews" })} testId="jo-reviews-edit" />
      </div>
      <div className="space-y-1.5">
        {preview.map((r) => (
          <CommunityReviewRow key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

function L3StakeholderList({
  preview,
  onSetRoute,
  onNavigateOverall,
}: {
  preview: JourneyOverviewPreview;
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const rows: { key: keyof JourneyOverviewPreview["stakeholderMap"]; label: string; target: StakeholderL4; navLegacy: OverallNavTarget }[] = [
    { key: "students", label: "Students", target: "schoolOverview.stakeholderMap.students", navLegacy: { level: "L3", section: "stakeholder.students" } },
    { key: "families", label: "Families", target: "schoolOverview.stakeholderMap.families", navLegacy: { level: "L3", section: "stakeholder.families" } },
    { key: "educatorsStaff", label: "Educators / Staff", target: "schoolOverview.stakeholderMap.educatorsStaff", navLegacy: { level: "L3", section: "stakeholder.educatorsStaff" } },
    { key: "administrationDistrict", label: "Administration (District)", target: "schoolOverview.stakeholderMap.administrationDistrict", navLegacy: { level: "L3", section: "stakeholder.administrationDistrict" } },
    { key: "administrationSchool", label: "Administration (School)", target: "schoolOverview.stakeholderMap.administrationSchool", navLegacy: { level: "L3", section: "stakeholder.administrationSchool" } },
    { key: "otherCommunityLeaders", label: "Other Community Leaders", target: "schoolOverview.stakeholderMap.otherCommunityLeaders", navLegacy: { level: "L3", section: "stakeholder.otherCommunityLeaders" } },
  ];
  return (
    <>
      {rows.map((r, i) => {
        const s = preview.stakeholderMap[r.key];
        const hasText = !!(s.populationSize.trim() || s.additionalContext.trim() || s.keyRepresentatives.trim());
        const showUnverified = s.verified === false && hasText;
        return (
          <ListRow
            key={r.key}
            label={r.label}
            first={i === 0}
            onClick={() => onSetRoute({ level: "L4", section: r.target })}
            onNavigate={() => onNavigateOverall(r.navLegacy)}
            rightAdornment={showUnverified ? <NotVerifiedBadge /> : null}
            testId={`jo-stk-${r.key}`}
          />
        );
      })}
    </>
  );
}

function L4StakeholderCard({
  section,
  preview,
  onNavigateOverall,
}: {
  section: StakeholderL4;
  preview: JourneyOverviewPreview;
  onNavigateOverall: (t: OverallNavTarget) => void;
}) {
  const leafKey = section.slice("schoolOverview.stakeholderMap.".length) as keyof JourneyOverviewPreview["stakeholderMap"];
  const s = preview.stakeholderMap[leafKey];
  const hasText = !!(s.populationSize.trim() || s.additionalContext.trim() || s.keyRepresentatives.trim());
  const showUnverified = s.verified === false && hasText;
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {showUnverified ? <NotVerifiedBadge /> : <span />}
        <EditPencil
          onClick={() => onNavigateOverall({ level: "L3", section: `stakeholder.${leafKey}` as any })}
          testId={`jo-stk-edit-${leafKey}`}
        />
      </div>
      <div className="space-y-1.5 text-left">
        <div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Population size</div>
          <div className="text-[12px] font-semibold text-gray-900">{s.populationSize.trim() || "—"}</div>
        </div>
        <div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Key representatives</div>
          <div className="text-[11px] text-gray-700 line-clamp-2">{s.keyRepresentatives.trim() || <span className="italic text-gray-400">—</span>}</div>
        </div>
        <div>
          <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Additional context</div>
          <div className="text-[11px] text-gray-700 line-clamp-3">{s.additionalContext.trim() || <span className="italic text-gray-400">—</span>}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export interface JourneyOverviewCardContentProps {
  route: JourneyOverviewCardRoute;
  onSetRoute: (r: JourneyOverviewCardRoute) => void;
  onNavigateOverall: (target: OverallNavTarget) => void;
  preview: JourneyOverviewPreview;
  /** Avatar pill styles (inherited from the overview color scheme). */
  avatarPillClassName: string;
}

export function JourneyOverviewCardContent({
  route,
  onSetRoute,
  onNavigateOverall,
  preview,
  avatarPillClassName,
}: JourneyOverviewCardContentProps) {
  const title = titleForJourneyRoute(route);
  const crumbs = breadcrumbForJourneyRoute(route);
  const showBack = route.level !== "L1";
  const goBack = () => onSetRoute(parentJourneyRoute(route));

  return (
    <>
      {/* Header row: Back | Title + subtitle/breadcrumb | Avatar */}
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
            <div className={cn("shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center", avatarPillClassName)}>
              <Bot className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
        {route.level === "L1" ? (
          <div className="text-[11px] text-gray-500">
            {preview.studentCount ? `${preview.studentCount} student school` : "— student school"}
          </div>
        ) : (
          <Breadcrumb crumbs={crumbs} onSetRoute={onSetRoute} />
        )}
      </div>

      {/* Content box */}
      <div className="bg-white/70 border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0 mt-2">
        <div className="max-h-[150px] overflow-y-auto">
          {/* L1 */}
          {route.level === "L1" && (
            <L1Home mission={preview.mission} onSetRoute={onSetRoute} onNavigateOverall={onNavigateOverall} />
          )}

          {/* L2 */}
          {route.level === "L2" && route.section === "mission" && (
            <L2Mission mission={preview.mission} onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L2" && route.section === "schoolOverview" && (
            <L2SchoolOverviewHub preview={preview} onSetRoute={onSetRoute} onNavigateOverall={onNavigateOverall} />
          )}

          {/* L3 lists */}
          {route.level === "L3" && route.section === "schoolOverview.contextOverview" && (
            <L3ContextOverviewList preview={preview} onSetRoute={onSetRoute} onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L3" && route.section === "schoolOverview.enrollment" && (
            <L3EnrollmentList preview={preview} onSetRoute={onSetRoute} onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L3" && route.section === "schoolOverview.publicAcademic" && (
            <L3PublicAcademicList preview={preview} onSetRoute={onSetRoute} onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L3" && route.section === "schoolOverview.communityReviews" && (
            <L3CommunityReviewsTerminal onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L3" && route.section === "schoolOverview.stakeholderMap" && (
            <L3StakeholderList preview={preview} onSetRoute={onSetRoute} onNavigateOverall={onNavigateOverall} />
          )}

          {/* L4 cards */}
          {route.level === "L4" && route.section.startsWith("schoolOverview.contextOverview.") && (
            <L4ContextOverviewCard section={route.section as ContextOverviewL4} preview={preview} onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L4" && route.section === "schoolOverview.enrollment.studentDemographics" && (
            <L4StudentDemographicsCard preview={preview} onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L4" && route.section.startsWith("schoolOverview.publicAcademic.") && (
            <L4PublicAcademicCard section={route.section as PublicAcademicL4} preview={preview} onNavigateOverall={onNavigateOverall} />
          )}
          {route.level === "L4" && route.section.startsWith("schoolOverview.stakeholderMap.") && (
            <L4StakeholderCard section={route.section as StakeholderL4} preview={preview} onNavigateOverall={onNavigateOverall} />
          )}
        </div>
      </div>
    </>
  );
}
