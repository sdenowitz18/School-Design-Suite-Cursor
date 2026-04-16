import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import {
  YearTabs,
  YearKey,
  VerificationBadge,
  AsOfLabel,
  preserveOrSetCurrentAsOf,
  ReadOnlyBanner,
  BasedOnNotice,
  ChartDescription,
  BenchmarkBar,
  BenchmarkLegend,
  RatingBar,
  SubTabBar,
  DEFAULT_RACE_LABELS,
  BoldText,
} from "./academic-chart-shared";
import {
  GS_COPY,
} from "@/lib/greatschools-chart-narrative";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwoVal { school: number | null; stateAvg: number | null }

export interface RaceProgressRow { label: string; pctOfStudents: number | null; value: number | null }
export interface RaceGradRow { label: string; pctOfStudents: number | null; school: number | null; stateAvg: number | null }
export interface RaceTestRow { label: string; pctOfStudents: number | null; value: number | null }
export interface RaceTestSubjectRow { label: string; pctOfStudents: number | null; school: number | null; stateAvg: number | null }
export interface RaceDisciplineRow { label: string; pctOfStudents: number | null; value: number | null }

export interface RaceTestSubject {
  label: string;
  allStudents: TwoVal;
  byRace: RaceTestSubjectRow[];
}

export interface RaceEthnicityData {
  studentProgress: { allStudents: number | null; byRace: RaceProgressRow[] } | null;
  graduationRates: { allStudents: TwoVal; byRace: RaceGradRow[] } | null;
  testScores: {
    overview: { allStudents: number | null; byRace: RaceTestRow[] } | null;
    subjects: RaceTestSubject[];
  } | null;
  disciplineAttendance: {
    suspended: { allStudents: number | null; byRace: RaceDisciplineRow[] } | null;
    chronicallyAbsent: { allStudents: number | null; byRace: RaceDisciplineRow[] } | null;
  } | null;
  currentAsOf: string | null;
  verification: Record<string, { verified: boolean }>;
}

type TopTab = "studentProgress" | "graduationRates" | "testScores" | "disciplineAttendance";
type DiscoTab = "suspended" | "chronicallyAbsent";
type TestSubTab = "overview" | string;

// ─── Dummy data ────────────────────────────────────────────────────────────────

const DUMMY_RACES = ["White", "Asian", "Black", "Hispanic", "Two or more races"];

const DUMMY_2025: RaceEthnicityData = {
  studentProgress: {
    allStudents: 8,
    byRace: [
      { label: "White", pctOfStudents: 42, value: 8 },
      { label: "Asian", pctOfStudents: 18, value: 9 },
      { label: "Black", pctOfStudents: 22, value: 4 },
      { label: "Hispanic", pctOfStudents: 12, value: 4 },
      { label: "Two or more races", pctOfStudents: 6, value: 7 },
    ],
  },
  graduationRates: {
    allStudents: { school: 94, stateAvg: 87 },
    byRace: [
      { label: "White", pctOfStudents: 42, school: 97, stateAvg: 91 },
      { label: "Asian", pctOfStudents: 18, school: 98, stateAvg: 92 },
      { label: "Black", pctOfStudents: 22, school: 88, stateAvg: 79 },
      { label: "Hispanic", pctOfStudents: 12, school: 86, stateAvg: 77 },
      { label: "Two or more races", pctOfStudents: 6, school: 92, stateAvg: 85 },
    ],
  },
  testScores: {
    overview: {
      allStudents: 8,
      byRace: [
        { label: "White", pctOfStudents: 42, value: 9 },
        { label: "Asian", pctOfStudents: 18, value: 10 },
        { label: "Black", pctOfStudents: 22, value: 3 },
        { label: "Hispanic", pctOfStudents: 12, value: 3 },
        { label: "Two or more races", pctOfStudents: 6, value: 7 },
      ],
    },
    subjects: [
      {
        label: "Biology",
        allStudents: { school: 73, stateAvg: 51 },
        byRace: [
          { label: "White", pctOfStudents: 42, school: 78, stateAvg: 59 },
          { label: "Asian", pctOfStudents: 18, school: 90, stateAvg: 76 },
          { label: "Black", pctOfStudents: 22, school: 33, stateAvg: 22 },
          { label: "Hispanic", pctOfStudents: 12, school: 33, stateAvg: 29 },
          { label: "Two or more races", pctOfStudents: 6, school: 75, stateAvg: 45 },
        ],
      },
      {
        label: "Literature",
        allStudents: { school: 87, stateAvg: 63 },
        byRace: [
          { label: "White", pctOfStudents: 42, school: 91, stateAvg: 68 },
          { label: "Asian", pctOfStudents: 18, school: 94, stateAvg: 79 },
          { label: "Black", pctOfStudents: 22, school: 61, stateAvg: 48 },
          { label: "Hispanic", pctOfStudents: 12, school: 58, stateAvg: 44 },
          { label: "Two or more races", pctOfStudents: 6, school: 82, stateAvg: 61 },
        ],
      },
      {
        label: "Algebra I",
        allStudents: { school: 43, stateAvg: 42 },
        byRace: [
          { label: "White", pctOfStudents: 42, school: 50, stateAvg: 47 },
          { label: "Asian", pctOfStudents: 18, school: 62, stateAvg: 55 },
          { label: "Black", pctOfStudents: 22, school: 22, stateAvg: 30 },
          { label: "Hispanic", pctOfStudents: 12, school: 19, stateAvg: 28 },
          { label: "Two or more races", pctOfStudents: 6, school: 45, stateAvg: 41 },
        ],
      },
    ],
  },
  disciplineAttendance: {
    suspended: {
      allStudents: 2,
      byRace: [
        { label: "White", pctOfStudents: 42, value: 1 },
        { label: "Asian", pctOfStudents: 18, value: 0 },
        { label: "Black", pctOfStudents: 22, value: 4 },
        { label: "Hispanic", pctOfStudents: 12, value: 3 },
        { label: "Two or more races", pctOfStudents: 6, value: 2 },
      ],
    },
    chronicallyAbsent: {
      allStudents: 14,
      byRace: [
        { label: "White", pctOfStudents: 42, value: 12 },
        { label: "Asian", pctOfStudents: 18, value: 8 },
        { label: "Black", pctOfStudents: 22, value: 22 },
        { label: "Hispanic", pctOfStudents: 12, value: 20 },
        { label: "Two or more races", pctOfStudents: 6, value: 15 },
      ],
    },
  },
  currentAsOf: null,
  verification: { "2025": { verified: true } },
};

const DUMMY_2026: RaceEthnicityData = {
  studentProgress: {
    allStudents: 8,
    byRace: [
      { label: "White", pctOfStudents: 41, value: 8 },
      { label: "Asian", pctOfStudents: 19, value: 9 },
      { label: "Black", pctOfStudents: 22, value: 5 },
      { label: "Hispanic", pctOfStudents: 12, value: 5 },
      { label: "Two or more races", pctOfStudents: 6, value: 7 },
    ],
  },
  graduationRates: {
    allStudents: { school: 95, stateAvg: 88 },
    byRace: [
      { label: "White", pctOfStudents: 41, school: 97, stateAvg: 92 },
      { label: "Asian", pctOfStudents: 19, school: 99, stateAvg: 93 },
      { label: "Black", pctOfStudents: 22, school: 90, stateAvg: 80 },
      { label: "Hispanic", pctOfStudents: 12, school: 88, stateAvg: 79 },
      { label: "Two or more races", pctOfStudents: 6, school: 93, stateAvg: 86 },
    ],
  },
  testScores: {
    overview: {
      allStudents: 8,
      byRace: [
        { label: "White", pctOfStudents: 41, value: 9 },
        { label: "Asian", pctOfStudents: 19, value: 10 },
        { label: "Black", pctOfStudents: 22, value: 4 },
        { label: "Hispanic", pctOfStudents: 12, value: 4 },
        { label: "Two or more races", pctOfStudents: 6, value: 7 },
      ],
    },
    subjects: [
      {
        label: "Biology",
        allStudents: { school: 76, stateAvg: 53 },
        byRace: [
          { label: "White", pctOfStudents: 41, school: 80, stateAvg: 61 },
          { label: "Asian", pctOfStudents: 19, school: 92, stateAvg: 78 },
          { label: "Black", pctOfStudents: 22, school: 36, stateAvg: 24 },
          { label: "Hispanic", pctOfStudents: 12, school: 35, stateAvg: 31 },
          { label: "Two or more races", pctOfStudents: 6, school: 77, stateAvg: 47 },
        ],
      },
      {
        label: "Literature",
        allStudents: { school: 85, stateAvg: 61 },
        byRace: [
          { label: "White", pctOfStudents: 41, school: 90, stateAvg: 67 },
          { label: "Asian", pctOfStudents: 19, school: 93, stateAvg: 77 },
          { label: "Black", pctOfStudents: 22, school: 63, stateAvg: 49 },
          { label: "Hispanic", pctOfStudents: 12, school: 60, stateAvg: 45 },
          { label: "Two or more races", pctOfStudents: 6, school: 83, stateAvg: 62 },
        ],
      },
      {
        label: "Algebra I",
        allStudents: { school: 48, stateAvg: 44 },
        byRace: [
          { label: "White", pctOfStudents: 41, school: 54, stateAvg: 49 },
          { label: "Asian", pctOfStudents: 19, school: 65, stateAvg: 57 },
          { label: "Black", pctOfStudents: 22, school: 25, stateAvg: 31 },
          { label: "Hispanic", pctOfStudents: 12, school: 22, stateAvg: 30 },
          { label: "Two or more races", pctOfStudents: 6, school: 47, stateAvg: 43 },
        ],
      },
    ],
  },
  disciplineAttendance: {
    suspended: {
      allStudents: 2,
      byRace: [
        { label: "White", pctOfStudents: 41, value: 1 },
        { label: "Asian", pctOfStudents: 19, value: 0 },
        { label: "Black", pctOfStudents: 22, value: 3 },
        { label: "Hispanic", pctOfStudents: 12, value: 3 },
        { label: "Two or more races", pctOfStudents: 6, value: 1 },
      ],
    },
    chronicallyAbsent: {
      allStudents: 13,
      byRace: [
        { label: "White", pctOfStudents: 41, value: 11 },
        { label: "Asian", pctOfStudents: 19, value: 7 },
        { label: "Black", pctOfStudents: 22, value: 21 },
        { label: "Hispanic", pctOfStudents: 12, value: 19 },
        { label: "Two or more races", pctOfStudents: 6, value: 14 },
      ],
    },
  },
  currentAsOf: null,
  verification: { "2026": { verified: false } },
};

const DUMMY_VERIFIED = { "2025": { verified: true }, "2026": { verified: false } };

function emptyData(raceEntries?: { label: string; pct: number | null }[]): RaceEthnicityData {
  const raceLabels = raceEntries && raceEntries.length > 0
    ? raceEntries.map((r) => r.label)
    : DUMMY_RACES;

  const progressRows: RaceProgressRow[] = raceLabels.map((label) => {
    const pct = raceEntries?.find((r) => r.label === label)?.pct ?? null;
    return { label, pctOfStudents: pct, value: null };
  });

  const d26GradRows = DUMMY_2026.graduationRates!.byRace;
  const gradRows: RaceGradRow[] = raceLabels.map((label) => {
    const pct = raceEntries?.find((r) => r.label === label)?.pct ?? null;
    const d26 = d26GradRows.find((r) => r.label === label);
    return { label, pctOfStudents: pct, school: null, stateAvg: d26?.stateAvg ?? null };
  });

  const d26TsOverviewRows = DUMMY_2026.testScores!.overview!.byRace;
  const tsOverviewRows: RaceTestRow[] = raceLabels.map((label) => {
    const pct = raceEntries?.find((r) => r.label === label)?.pct ?? null;
    return { label, pctOfStudents: pct, value: null };
  });

  const tsSubjects: RaceTestSubject[] = DUMMY_2026.testScores!.subjects.map((sub) => ({
    label: sub.label,
    allStudents: { school: null, stateAvg: sub.allStudents.stateAvg },
    byRace: raceLabels.map((label) => {
      const pct = raceEntries?.find((r) => r.label === label)?.pct ?? null;
      const d26row = sub.byRace.find((r) => r.label === label);
      return { label, pctOfStudents: pct, school: null, stateAvg: d26row?.stateAvg ?? null };
    }),
  }));

  const discRows = (subKey: "suspended" | "chronicallyAbsent"): RaceDisciplineRow[] =>
    raceLabels.map((label) => {
      const pct = raceEntries?.find((r) => r.label === label)?.pct ?? null;
      return { label, pctOfStudents: pct, value: null };
    });

  const d26disc = DUMMY_2026.disciplineAttendance!;
  return {
    studentProgress: { allStudents: null, byRace: progressRows },
    graduationRates: { allStudents: { school: null, stateAvg: DUMMY_2026.graduationRates!.allStudents.stateAvg }, byRace: gradRows },
    testScores: { overview: { allStudents: null, byRace: tsOverviewRows }, subjects: tsSubjects },
    disciplineAttendance: {
      suspended: { allStudents: null, byRace: discRows("suspended") },
      chronicallyAbsent: { allStudents: null, byRace: discRows("chronicallyAbsent") },
    },
    currentAsOf: null,
    verification: {},
  };
}

function hasSaved(data: RaceEthnicityData | null | undefined): boolean {
  if (!data) return false;
  const sp = data.studentProgress;
  const gr = data.graduationRates;
  const ts = data.testScores;
  const da = data.disciplineAttendance;
  const discHas =
    (da?.suspended?.allStudents != null || da?.suspended?.byRace?.some((r) => r.value != null)) ||
    (da?.chronicallyAbsent?.allStudents != null ||
      da?.chronicallyAbsent?.byRace?.some((r) => r.value != null));
  return (
    discHas ||
    (sp?.allStudents != null || (sp?.byRace?.some((r) => r.value != null) ?? false)) ||
    (gr?.allStudents?.school != null || (gr?.byRace?.some((r) => r.school != null) ?? false)) ||
    (ts?.overview?.allStudents != null ||
      (ts?.subjects?.some((s) => s.allStudents.school != null) ?? false))
  );
}

function cloneRaceEthnicityData(source: RaceEthnicityData): RaceEthnicityData {
  return structuredClone(source);
}

function pn(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Latest published race/ethnicity % breakdown in dummy data (2026). */
function buildLatestReferenceRacePctMap(): Map<string, number | null> {
  return new Map(
    DUMMY_2026.studentProgress!.byRace.map((r) => [r.label.trim(), r.pctOfStudents]),
  );
}

type StudentDemoRaceInput = { raceEthnicity: { label: string; pct: number | null }[] } | null | undefined;

function demographicsRacePctMap(studentDemographics: StudentDemoRaceInput): Map<string, number | null> | null {
  const rows = studentDemographics?.raceEthnicity;
  if (!rows?.length) return null;
  const m = new Map<string, number | null>();
  for (const e of rows) {
    const lab = typeof e.label === "string" ? e.label.trim() : "";
    if (lab) m.set(lab, e.pct ?? null);
  }
  let hasAny = false;
  m.forEach((v) => {
    if (v != null) hasAny = true;
  });
  if (!hasAny) return null;
  return m;
}

/**
 * % of students under each race row: Student Demographics when the user has entered any race %,
 * else the latest reference breakdown (2026 dummy). Falls back to the row's embedded value.
 */
function makeRaceRowPctResolver(studentDemographics: StudentDemoRaceInput): (label: string, rowPct: number | null) => number | null {
  const latest = buildLatestReferenceRacePctMap();
  const demo = demographicsRacePctMap(studentDemographics);
  return (label, rowPct) => {
    const key = label.trim();
    if (demo) {
      if (demo.has(key)) {
        const v = demo.get(key)!;
        if (v != null) return v;
      }
      const fromLatest = latest.get(key);
      if (fromLatest != null) return fromLatest;
      return rowPct;
    }
    return latest.get(key) ?? rowPct;
  };
}

// ─── Shared race-row label ────────────────────────────────────────────────────

function RaceLabel({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="w-48 shrink-0">
      <div className="text-sm text-gray-800 leading-snug">{label}</div>
      {pct != null && <div className="text-[11px] text-gray-400 mt-0.5">{pct}% of students</div>}
    </div>
  );
}

// ─── Student Progress panel ───────────────────────────────────────────────────

function StudentProgressPanel({
  d,
  raceRowPct,
}: {
  d: RaceEthnicityData;
  raceRowPct: (label: string, rowPct: number | null) => number | null;
}) {
  const sp = d.studentProgress;
  return (
    <div className="space-y-0.5">
      <RatingBar label="All Students" value={sp?.allStudents ?? null} barColor="bg-purple-500" labelWidth="w-48" />
      {(sp?.byRace ?? []).map((r, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <RaceLabel label={r.label} pct={raceRowPct(r.label, r.pctOfStudents)} />
          <div className="w-14 text-right text-sm font-semibold text-gray-800 tabular-nums shrink-0">
            {r.value != null ? `${r.value}/10` : "—"}
          </div>
          <div className="flex-1 relative h-4 bg-gray-100 rounded overflow-hidden">
            {r.value != null && (
              <div className="absolute inset-y-0 left-0 bg-purple-400 rounded" style={{ width: `${(r.value / 10) * 100}%` }} />
            )}
          </div>
          <div className="w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Graduation Rates panel ───────────────────────────────────────────────────

function GraduationRatesPanel({
  d,
  raceRowPct,
}: {
  d: RaceEthnicityData;
  raceRowPct: (label: string, rowPct: number | null) => number | null;
}) {
  const gr = d.graduationRates;
  return (
    <div className="space-y-0.5">
      <BenchmarkLegend barColor="bg-blue-500" labelWidth="w-48" />
      <BenchmarkBar label="All Students" schoolValue={gr?.allStudents.school ?? null} stateAvg={gr?.allStudents.stateAvg ?? null} barColor="bg-blue-500" labelWidth="w-48" />
      {(gr?.byRace ?? []).map((r, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <RaceLabel label={r.label} pct={raceRowPct(r.label, r.pctOfStudents)} />
          <div className="w-14 text-right text-sm font-semibold text-gray-800 tabular-nums shrink-0">
            {r.school != null ? `${r.school}%` : "—"}
          </div>
          <div className="flex-1 relative h-4">
            <div className="absolute inset-0 bg-gray-100 rounded" />
            {r.school != null && (
              <div className="absolute inset-y-0 left-0 bg-blue-400 rounded" style={{ width: `${r.school}%` }} />
            )}
            {r.stateAvg != null && (
              <div className="absolute w-0.5 bg-gray-500 rounded-full z-10" style={{ left: `${r.stateAvg}%`, top: "-3px", bottom: "-3px" }} />
            )}
          </div>
          <div className="w-16 text-right text-xs text-gray-500 shrink-0 tabular-nums">
            {r.stateAvg != null ? `${r.stateAvg}%` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Test Scores panel ────────────────────────────────────────────────────────

function TestScoresPanel({
  d,
  activeSubTab,
  onSubTabChange,
  onAddSubject,
  isHistorical,
  raceRowPct,
}: {
  d: RaceEthnicityData;
  activeSubTab: TestSubTab;
  onSubTabChange: (t: TestSubTab) => void;
  onAddSubject: () => void;
  isHistorical: boolean;
  raceRowPct: (label: string, rowPct: number | null) => number | null;
}) {
  const ts = d.testScores;
  const subjectTabs = (ts?.subjects ?? []).map((s) => ({ key: s.label, label: s.label }));
  const allTabs = [{ key: "overview" as string, label: "Overview" }, ...subjectTabs];

  return (
    <div className="space-y-3">
      <SubTabBar
        tabs={allTabs}
        active={activeSubTab}
        onChange={onSubTabChange}
        onAdd={!isHistorical ? onAddSubject : undefined}
      />
      <ChartDescription>
        {activeSubTab === "overview" ? (
          <p>{GS_COPY.raceTestOverview}</p>
        ) : (
          <p>
            <BoldText text={GS_COPY.raceTestSubject(activeSubTab)} />
          </p>
        )}
      </ChartDescription>

      {activeSubTab === "overview" ? (
        <div className="space-y-0.5">
          <RatingBar label="All Students" value={ts?.overview?.allStudents ?? null} barColor="bg-purple-500" labelWidth="w-48" />
          {(ts?.overview?.byRace ?? []).map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <RaceLabel label={r.label} pct={raceRowPct(r.label, r.pctOfStudents)} />
              <div className="w-14 text-right text-sm font-semibold text-gray-800 tabular-nums shrink-0">
                {r.value != null ? `${r.value}/10` : "—"}
              </div>
              <div className="flex-1 relative h-4 bg-gray-100 rounded overflow-hidden">
                {r.value != null && (
                  <div className="absolute inset-y-0 left-0 bg-purple-400 rounded" style={{ width: `${(r.value / 10) * 100}%` }} />
                )}
              </div>
              <div className="w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        (() => {
          const sub = (ts?.subjects ?? []).find((s) => s.label === activeSubTab);
          if (!sub) return <div className="text-xs text-gray-400 py-4">No data for this subject.</div>;
          return (
            <div className="space-y-0.5">
              <BenchmarkLegend barColor="bg-teal-500" labelWidth="w-48" />
              <BenchmarkBar label="All Students" schoolValue={sub.allStudents.school} stateAvg={sub.allStudents.stateAvg} barColor="bg-teal-500" labelWidth="w-48" />
              {sub.byRace.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <RaceLabel label={r.label} pct={raceRowPct(r.label, r.pctOfStudents)} />
                  <div className="w-14 text-right text-sm font-semibold text-gray-800 tabular-nums shrink-0">
                    {r.school != null ? `${r.school}%` : "—"}
                  </div>
                  <div className="flex-1 relative h-4">
                    <div className="absolute inset-0 bg-gray-100 rounded" />
                    {r.school != null && (
                      <div className="absolute inset-y-0 left-0 bg-teal-400 rounded" style={{ width: `${r.school}%` }} />
                    )}
                    {r.stateAvg != null && (
                      <div className="absolute w-0.5 bg-gray-500 rounded-full z-10" style={{ left: `${r.stateAvg}%`, top: "-3px", bottom: "-3px" }} />
                    )}
                  </div>
                  <div className="w-16 text-right text-xs text-gray-500 shrink-0 tabular-nums">
                    {r.stateAvg != null ? `${r.stateAvg}%` : ""}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

// ─── Discipline & Attendance panel ────────────────────────────────────────────

function DisciplinePanel({
  d,
  activeSubTab,
  onSubTabChange,
  raceRowPct,
}: {
  d: RaceEthnicityData;
  activeSubTab: DiscoTab;
  onSubTabChange: (t: DiscoTab) => void;
  raceRowPct: (label: string, rowPct: number | null) => number | null;
}) {
  const da = d.disciplineAttendance;
  const subTabs = [
    { key: "suspended" as DiscoTab, label: "% Suspended" },
    { key: "chronicallyAbsent" as DiscoTab, label: "% Chronically Absent" },
  ];
  const activeData = activeSubTab === "suspended" ? da?.suspended : da?.chronicallyAbsent;

  return (
    <div className="space-y-3">
      <SubTabBar tabs={subTabs} active={activeSubTab} onChange={onSubTabChange} />
      <ChartDescription>
        <p>
          {activeSubTab === "suspended"
            ? GS_COPY.raceDiscSuspended
            : GS_COPY.raceDiscAbsent}
        </p>
      </ChartDescription>
      {activeData ? (
        <div className="space-y-0.5">
          {/* No state avg for discipline — single bar scaled ×3 for visibility */}
          <div className="flex items-center gap-3 py-1.5">
            <div className="w-48 shrink-0 text-sm text-gray-800">All Students</div>
            <div className="w-14 text-right text-sm font-semibold text-gray-800 tabular-nums shrink-0">
              {activeData.allStudents != null ? `${activeData.allStudents}%` : "—"}
            </div>
            <div className="flex-1 relative h-4 bg-gray-100 rounded overflow-hidden">
              {activeData.allStudents != null && (
                <div className="absolute inset-y-0 left-0 bg-red-400 rounded" style={{ width: `${Math.min(100, activeData.allStudents * 3)}%` }} />
              )}
            </div>
            <div className="w-16 shrink-0" />
          </div>
          {activeData.byRace.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <RaceLabel label={r.label} pct={raceRowPct(r.label, r.pctOfStudents)} />
              <div className="w-14 text-right text-sm font-semibold text-gray-800 tabular-nums shrink-0">
                {r.value != null ? `${r.value}%` : "—"}
              </div>
              <div className="flex-1 relative h-4 bg-gray-100 rounded overflow-hidden">
                {r.value != null && (
                  <div className="absolute inset-y-0 left-0 bg-red-300 rounded" style={{ width: `${Math.min(100, r.value * 3)}%` }} />
                )}
              </div>
              <div className="w-16 shrink-0" />
            </div>
          ))}
          <p className="text-[10px] text-gray-300 mt-1">Bar width scaled for visibility (max ~33%)</p>
        </div>
      ) : (
        <div className="text-xs text-gray-400 py-4">No data available.</div>
      )}
    </div>
  );
}

// ─── Edit forms ───────────────────────────────────────────────────────────────

interface EditFormProps {
  draft: RaceEthnicityData;
  activeTopTab: TopTab;
  activeTestSubTab: TestSubTab;
  raceRowPct: (label: string, rowPct: number | null) => number | null;
  onUpdate: (next: RaceEthnicityData) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ draft, activeTopTab, activeTestSubTab, raceRowPct, onUpdate, onSave, onCancel }: EditFormProps) {
  const SaveCancel = () => (
    <div className="flex gap-2 pt-3 border-t border-gray-100">
      <Button size="sm" onClick={onSave}>Save</Button>
      <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  );

  if (activeTopTab === "studentProgress") {
    const sp = draft.studentProgress ?? { allStudents: null, byRace: [] };
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 mb-2">Yearly growth score (out of 10)</div>
        <div className="flex items-center gap-2 border-b border-gray-50 pb-1.5">
          <label className="text-xs text-gray-600 w-48 shrink-0 font-medium">All Students</label>
          <input type="number" min={0} max={10} value={sp.allStudents ?? ""} placeholder="—"
            onChange={(e) => onUpdate({ ...draft, studentProgress: { ...sp, allStudents: pn(e.target.value) } })}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
          <span className="text-xs text-gray-400">/10</span>
        </div>
        {sp.byRace.map((r, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-48 shrink-0">
              <div className="text-xs text-gray-700">{r.label}</div>
              {(() => {
                const p = raceRowPct(r.label, r.pctOfStudents);
                return p != null ? <div className="text-[10px] text-gray-400">{p}% of students</div> : null;
              })()}
            </div>
            <input type="number" min={0} max={10} value={(r as RaceProgressRow).value ?? ""} placeholder="—"
              onChange={(e) => {
                const next = sp.byRace.map((row, idx) => idx === i ? { ...row, value: pn(e.target.value) } : row) as RaceProgressRow[];
                onUpdate({ ...draft, studentProgress: { ...sp, byRace: next } });
              }}
              className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
            <span className="text-xs text-gray-400">/10</span>
          </div>
        ))}
        <SaveCancel />
      </div>
    );
  }

  if (activeTopTab === "graduationRates") {
    const gr = draft.graduationRates ?? { allStudents: { school: null, stateAvg: DUMMY_2026.graduationRates!.allStudents.stateAvg }, byRace: [] };
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 mb-2">Graduation rate (%)</div>
        <div className="flex items-center gap-2 border-b border-gray-50 pb-1.5">
          <label className="text-xs text-gray-600 w-48 shrink-0 font-medium">All Students</label>
          <input type="number" min={0} max={100} value={gr.allStudents.school ?? ""} placeholder="School %"
            onChange={(e) => onUpdate({ ...draft, graduationRates: { ...gr, allStudents: { ...gr.allStudents, school: pn(e.target.value) } } })}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
          <span className="text-xs text-gray-400">%</span>
          <span className="text-[11px] text-gray-400 ml-2">State avg: {gr.allStudents.stateAvg != null ? `${gr.allStudents.stateAvg}%` : "—"} (2026)</span>
        </div>
        {gr.byRace.map((r, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-48 shrink-0">
              <div className="text-xs text-gray-700">{r.label}</div>
              {(() => {
                const p = raceRowPct(r.label, r.pctOfStudents);
                return p != null ? <div className="text-[10px] text-gray-400">{p}% of students</div> : null;
              })()}
            </div>
            <input type="number" min={0} max={100} value={r.school ?? ""} placeholder="School %"
              onChange={(e) => {
                const next = gr.byRace.map((row, idx) => idx === i ? { ...row, school: pn(e.target.value) } : row);
                onUpdate({ ...draft, graduationRates: { ...gr, byRace: next } });
              }}
              className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
            <span className="text-xs text-gray-400">%</span>
            <span className="text-[11px] text-gray-400 ml-1">State avg: {r.stateAvg != null ? `${r.stateAvg}%` : "—"} (2026)</span>
          </div>
        ))}
        <SaveCancel />
      </div>
    );
  }

  if (activeTopTab === "testScores") {
    const ts = draft.testScores ?? { overview: { allStudents: null, byRace: [] }, subjects: [] };

    if (activeTestSubTab === "overview") {
      const ov = ts.overview ?? { allStudents: null, byRace: [] };
      return (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 mb-2">Overview score (out of 10)</div>
          <div className="flex items-center gap-2 border-b border-gray-50 pb-1.5">
            <label className="text-xs text-gray-600 w-48 shrink-0 font-medium">All Students</label>
            <input type="number" min={0} max={10} value={ov.allStudents ?? ""} placeholder="—"
              onChange={(e) => onUpdate({ ...draft, testScores: { ...ts, overview: { ...ov, allStudents: pn(e.target.value) } } })}
              className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
            <span className="text-xs text-gray-400">/10</span>
          </div>
          {ov.byRace.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <div className="w-48 shrink-0">
                <div className="text-xs text-gray-700">{r.label}</div>
                {(() => {
                  const p = raceRowPct(r.label, r.pctOfStudents);
                  return p != null ? <div className="text-[10px] text-gray-400">{p}% of students</div> : null;
                })()}
              </div>
              <input type="number" min={0} max={10} value={(r as RaceTestRow).value ?? ""} placeholder="—"
                onChange={(e) => {
                  const next = ov.byRace.map((row, idx) => idx === i ? { ...row, value: pn(e.target.value) } : row) as RaceTestRow[];
                  onUpdate({ ...draft, testScores: { ...ts, overview: { ...ov, byRace: next } } });
                }}
                className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
              <span className="text-xs text-gray-400">/10</span>
            </div>
          ))}
          <SaveCancel />
        </div>
      );
    }

    // Subject sub-tab
    const subIdx = ts.subjects.findIndex((s) => s.label === activeTestSubTab);
    const sub = subIdx >= 0 ? ts.subjects[subIdx] : null;
    if (!sub) return null;

    const updateSub = (partial: Partial<RaceTestSubject>) => {
      const next = ts.subjects.map((s, i) => (i === subIdx ? { ...s, ...partial } : s));
      onUpdate({ ...draft, testScores: { ...ts, subjects: next } });
    };

    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 mb-2">{sub.label} — % proficient or above</div>
        <div className="flex items-center gap-2 border-b border-gray-50 pb-1.5">
          <label className="text-xs text-gray-600 w-48 shrink-0 font-medium">All Students</label>
          <input type="number" min={0} max={100} value={sub.allStudents.school ?? ""} placeholder="School %"
            onChange={(e) => updateSub({ allStudents: { ...sub.allStudents, school: pn(e.target.value) } })}
            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
          <span className="text-xs text-gray-400">%</span>
          <span className="text-[11px] text-gray-400 ml-2">State avg: {sub.allStudents.stateAvg != null ? `${sub.allStudents.stateAvg}%` : "—"} (2026)</span>
        </div>
        {sub.byRace.map((r, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-48 shrink-0">
              <div className="text-xs text-gray-700">{r.label}</div>
              {(() => {
                const p = raceRowPct(r.label, r.pctOfStudents);
                return p != null ? <div className="text-[10px] text-gray-400">{p}% of students</div> : null;
              })()}
            </div>
            <input type="number" min={0} max={100} value={r.school ?? ""} placeholder="School %"
              onChange={(e) => {
                const next = sub.byRace.map((row, idx) => idx === i ? { ...row, school: pn(e.target.value) } : row);
                updateSub({ byRace: next });
              }}
              className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
            <span className="text-xs text-gray-400">%</span>
            <span className="text-[11px] text-gray-400 ml-1">State avg: {r.stateAvg != null ? `${r.stateAvg}%` : "—"} (2026)</span>
          </div>
        ))}
        <SaveCancel />
      </div>
    );
  }

  // Discipline & Attendance — editable
  const da = draft.disciplineAttendance ?? { suspended: null, chronicallyAbsent: null };

  return (
    <div className="space-y-3">
      {(["suspended", "chronicallyAbsent"] as DiscoTab[]).map((key) => {
        const section = da[key] ?? { allStudents: null, byRace: [] };
        const sectionLabel = key === "suspended" ? "% Suspended" : "% Chronically Absent";
        return (
          <div key={key} className="rounded border border-gray-100 p-3 bg-gray-50 space-y-2">
            <div className="text-xs font-semibold text-gray-600">{sectionLabel}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-48 shrink-0">All Students</label>
              <input type="number" min={0} max={100} value={section.allStudents ?? ""} placeholder="—"
                onChange={(e) => {
                  onUpdate({ ...draft, disciplineAttendance: { ...da, [key]: { ...section, allStudents: pn(e.target.value) } } });
                }}
                className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
              <span className="text-xs text-gray-400">%</span>
            </div>
            {section.byRace.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-48 shrink-0">
                  <div className="text-xs text-gray-700">{r.label}</div>
                  {(() => {
                    const p = raceRowPct(r.label, r.pctOfStudents);
                    return p != null ? <div className="text-[10px] text-gray-400">{p}% of students</div> : null;
                  })()}
                </div>
                <input type="number" min={0} max={100} value={r.value ?? ""} placeholder="—"
                  onChange={(e) => {
                    const next = section.byRace.map((row, idx) => idx === i ? { ...row, value: pn(e.target.value) } : row);
                    onUpdate({ ...draft, disciplineAttendance: { ...da, [key]: { ...section, byRace: next } } });
                  }}
                  className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums" />
                <span className="text-xs text-gray-400">%</span>
              </div>
            ))}
          </div>
        );
      })}
      <SaveCancel />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface RaceEthnicityViewProps {
  data: RaceEthnicityData | null | undefined;
  onChange: (next: RaceEthnicityData) => void;
  /**
   * Student Demographics race/ethnicity breakdown. When any race % is set, those values
   * drive the “% of students” labels under each row; otherwise the latest reference (2026 dummy) is used.
   */
  studentDemographics?: { raceEthnicity: { label: string; pct: number | null }[] } | null;
}

export function RaceEthnicityView({ data, onChange, studentDemographics }: RaceEthnicityViewProps) {
  const isSaved = hasSaved(data);

  const [activeYear, setActiveYear] = useState<YearKey>(() => (isSaved ? "current" : "2026"));
  const [activeTopTab, setActiveTopTab] = useState<TopTab>("studentProgress");
  const [activeTestSubTab, setActiveTestSubTab] = useState<TestSubTab>("overview");
  const [activeDisciplineSubTab, setActiveDisciplineSubTab] = useState<DiscoTab>("suspended");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<RaceEthnicityData>(emptyData());

  const raceEntries = studentDemographics?.raceEthnicity;
  const raceRowPct = makeRaceRowPctResolver(studentDemographics);
  const isHistorical = activeYear !== "current";

  function getD(): RaceEthnicityData {
    if (activeYear === "2025") return DUMMY_2025;
    if (activeYear === "2026") return DUMMY_2026;
    return isSaved ? data! : DUMMY_2026;
  }

  const d = getD();
  const showingBaseline = !isHistorical && !isSaved;

  const verificationForYear = (year: string) => {
    const base = isSaved ? data! : { verification: {} } as RaceEthnicityData;
    return base.verification[year] ?? DUMMY_VERIFIED[year as keyof typeof DUMMY_VERIFIED] ?? { verified: false };
  };

  const canEdit = !isHistorical;

  function handleEdit() {
    // Always start from what the chart is showing (baseline dummy, saved current, or historical year).
    setDraft(cloneRaceEthnicityData(d));
    setIsEditing(true);
  }

  function handleSave() {
    onChange({
      ...draft,
      currentAsOf: preserveOrSetCurrentAsOf(draft.currentAsOf ?? (isSaved ? data!.currentAsOf : null)),
    });
    setIsEditing(false);
    setActiveYear("current");
  }

  function handleCancel() {
    setIsEditing(false);
  }

  function handleAddTestSubject() {
    const label = prompt("New subject name:");
    if (!label?.trim()) return;
    const base = cloneRaceEthnicityData(d);
    const ts = base.testScores ?? { overview: null, subjects: [] };
    const raceRows: RaceTestSubjectRow[] = (raceEntries ?? DUMMY_2026.testScores!.subjects[0].byRace).map((r) => {
      const label = "label" in r ? r.label : (r as { label: string }).label;
      const rowPct = "pct" in r ? (r as { pct: number | null }).pct : (r as RaceTestSubjectRow).pctOfStudents;
      return {
        label,
        pctOfStudents: raceRowPct(label, rowPct),
        school: null,
        stateAvg: null,
      };
    });
    const newSub: RaceTestSubject = { label: label.trim(), allStudents: { school: null, stateAvg: null }, byRace: raceRows };
    onChange({ ...base, testScores: { ...ts, subjects: [...(ts.subjects ?? []), newSub] } });
    setActiveTestSubTab(label.trim());
  }

  function toggleVerified(year: string) {
    const base = isSaved ? cloneRaceEthnicityData(data!) : cloneRaceEthnicityData(d);
    const prev = verificationForYear(year);
    onChange({ ...base, verification: { ...base.verification, [year]: { verified: !prev.verified } } });
  }

  const topTabs = [
    { key: "studentProgress" as TopTab, label: "Student Progress" },
    { key: "graduationRates" as TopTab, label: "Graduation Rates" },
    { key: "testScores" as TopTab, label: "Test Scores" },
    { key: "disciplineAttendance" as TopTab, label: "Discipline & Attendance" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <YearTabs
          active={activeYear}
          onChange={(y) => {
            setActiveYear(y);
            setIsEditing(false);
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {isHistorical && (
            <VerificationBadge
              verified={verificationForYear(activeYear).verified}
              onToggle={() => toggleVerified(activeYear)}
              asOf={`${activeYear} school year`}
            />
          )}
          {!isHistorical && isSaved && (data as RaceEthnicityData).currentAsOf && (
            <AsOfLabel asOf={(data as RaceEthnicityData).currentAsOf} />
          )}
          {canEdit && !isEditing && (
            <Button size="sm" variant="outline" className="h-8" onClick={handleEdit}>
              <Pencil className="h-3 w-3 mr-1.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {isHistorical && <ReadOnlyBanner year={activeYear} />}
      {showingBaseline && !isEditing && <BasedOnNotice />}

      {/* ── Top-level tabs ──────────────────────────────────────────── */}
      <SubTabBar
        tabs={topTabs}
        active={activeTopTab}
        onChange={(t) => {
          setActiveTopTab(t);
          setIsEditing(false);
        }}
      />

      {/* Description for tabs without sub-tabs (shown below top tab bar) */}
      {activeTopTab === "studentProgress" && !isEditing && (
        <ChartDescription>
          <p>{GS_COPY.raceStudentProgress}</p>
        </ChartDescription>
      )}
      {activeTopTab === "graduationRates" && !isEditing && (
        <ChartDescription>
          <p>{GS_COPY.raceGraduationLead}</p>
        </ChartDescription>
      )}

      {/* ── Content ────────────────────────────────────────────────── */}
      {isEditing ? (
        <EditForm
          draft={draft}
          activeTopTab={activeTopTab}
          activeTestSubTab={activeTestSubTab}
          raceRowPct={raceRowPct}
          onUpdate={setDraft}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : activeTopTab === "studentProgress" ? (
        <StudentProgressPanel d={d} raceRowPct={raceRowPct} />
      ) : activeTopTab === "graduationRates" ? (
        <GraduationRatesPanel d={d} raceRowPct={raceRowPct} />
      ) : activeTopTab === "testScores" ? (
        <TestScoresPanel
          d={d}
          activeSubTab={activeTestSubTab}
          onSubTabChange={setActiveTestSubTab}
          onAddSubject={handleAddTestSubject}
          isHistorical={isHistorical}
          raceRowPct={raceRowPct}
        />
      ) : (
        <DisciplinePanel
          d={d}
          activeSubTab={activeDisciplineSubTab}
          onSubTabChange={setActiveDisciplineSubTab}
          raceRowPct={raceRowPct}
        />
      )}
    </div>
  );
}
