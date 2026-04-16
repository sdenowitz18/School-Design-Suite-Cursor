import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  BoldText,
} from "./academic-chart-shared";
import { GS_COPY, lowIncomeGraduationNarrative } from "@/lib/greatschools-chart-narrative";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwoVal {
  school: number | null;
  stateAvg: number | null;
}

export interface LisTestSubject {
  label: string;
  allStudents: TwoVal;
  lowIncome: TwoVal;
}

export interface LowIncomeStudentsData {
  lowIncomeLabel: string | null;
  studentProgress: { allStudents: number | null; lowIncome: number | null } | null;
  graduationRates: { allStudents: TwoVal; lowIncome: TwoVal } | null;
  testScores: {
    overview: { allStudents: number | null; lowIncome: number | null } | null;
    subjects: LisTestSubject[];
  } | null;
  currentAsOf: string | null;
  verification: Record<string, { verified: boolean }>;
}

type TopTab = "studentProgress" | "graduationRates" | "testScores";
type TestSubTab = "overview" | string;

// ─── Dummy data ────────────────────────────────────────────────────────────────

const DUMMY_2025: LowIncomeStudentsData = {
  lowIncomeLabel: "19% of students",
  studentProgress: { allStudents: 8, lowIncome: 5 },
  graduationRates: {
    allStudents: { school: 94, stateAvg: 87 },
    lowIncome: { school: 91, stateAvg: 83 },
  },
  testScores: {
    overview: { allStudents: 8, lowIncome: 5 },
    subjects: [
      { label: "Biology", allStudents: { school: 73, stateAvg: 51 }, lowIncome: { school: 52, stateAvg: 40 } },
      { label: "Literature", allStudents: { school: 87, stateAvg: 63 }, lowIncome: { school: 68, stateAvg: 52 } },
      { label: "Algebra I", allStudents: { school: 43, stateAvg: 42 }, lowIncome: { school: 28, stateAvg: 33 } },
    ],
  },
  currentAsOf: null,
  verification: { "2025": { verified: true } },
};

const DUMMY_2026: LowIncomeStudentsData = {
  lowIncomeLabel: "19% of students",
  studentProgress: { allStudents: 8, lowIncome: 6 },
  graduationRates: {
    allStudents: { school: 95, stateAvg: 88 },
    lowIncome: { school: 93, stateAvg: 84 },
  },
  testScores: {
    overview: { allStudents: 8, lowIncome: 6 },
    subjects: [
      { label: "Biology", allStudents: { school: 76, stateAvg: 53 }, lowIncome: { school: 55, stateAvg: 42 } },
      { label: "Literature", allStudents: { school: 85, stateAvg: 61 }, lowIncome: { school: 71, stateAvg: 54 } },
      { label: "Algebra I", allStudents: { school: 48, stateAvg: 44 }, lowIncome: { school: 31, stateAvg: 35 } },
    ],
  },
  currentAsOf: null,
  verification: { "2026": { verified: false } },
};

const DUMMY_VERIFIED = { "2025": { verified: true }, "2026": { verified: false } };

function emptyData(): LowIncomeStudentsData {
  return {
    lowIncomeLabel: null,
    studentProgress: { allStudents: null, lowIncome: null },
    graduationRates: {
      allStudents: { school: null, stateAvg: DUMMY_2026.graduationRates!.allStudents.stateAvg },
      lowIncome: { school: null, stateAvg: DUMMY_2026.graduationRates!.lowIncome.stateAvg },
    },
    testScores: {
      overview: { allStudents: null, lowIncome: null },
      subjects: DUMMY_2026.testScores!.subjects.map((s) => ({
        label: s.label,
        allStudents: { school: null, stateAvg: s.allStudents.stateAvg },
        lowIncome: { school: null, stateAvg: s.lowIncome.stateAvg },
      })),
    },
    currentAsOf: null,
    verification: {},
  };
}

function hasSaved(data: LowIncomeStudentsData | null | undefined): boolean {
  if (!data) return false;
  const sp = data.studentProgress;
  const gr = data.graduationRates;
  const ts = data.testScores;
  return (
    (sp != null && (sp.allStudents != null || sp.lowIncome != null)) ||
    (gr != null && (gr.allStudents.school != null || gr.lowIncome.school != null)) ||
    (ts != null && (ts.overview?.allStudents != null || (ts.subjects?.some((s) => s.allStudents.school != null))))
  );
}

function pn(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Student Progress panel ───────────────────────────────────────────────────

function StudentProgressPanel({
  d,
  lowIncomeLabel,
}: {
  d: LowIncomeStudentsData;
  lowIncomeLabel: string | null;
}) {
  const sp = d.studentProgress;
  return (
    <div className="space-y-0.5">
      <RatingBar label="All Students" value={sp?.allStudents ?? null} barColor="bg-blue-500" />
      <RatingBar
        label="Low-income Students"
        subLabel={lowIncomeLabel}
        value={sp?.lowIncome ?? null}
        barColor="bg-amber-500"
      />
    </div>
  );
}

// ─── Graduation Rates panel ───────────────────────────────────────────────────

function GraduationRatesPanel({
  d,
  lowIncomeLabel,
}: {
  d: LowIncomeStudentsData;
  lowIncomeLabel: string | null;
}) {
  const gr = d.graduationRates;
  return (
    <div className="space-y-0.5">
      <BenchmarkLegend barColor="bg-blue-500" labelWidth="w-52" />
      <BenchmarkBar
        label="All Students"
        schoolValue={gr?.allStudents.school ?? null}
        stateAvg={gr?.allStudents.stateAvg ?? null}
        barColor="bg-blue-500"
        labelWidth="w-52"
      />
      <BenchmarkBar
        label="Low-income Students"
        subLabel={lowIncomeLabel}
        schoolValue={gr?.lowIncome.school ?? null}
        stateAvg={gr?.lowIncome.stateAvg ?? null}
        barColor="bg-amber-500"
        labelWidth="w-52"
      />
    </div>
  );
}

// ─── Test Scores panel ────────────────────────────────────────────────────────

function TestScoresPanel({
  d,
  lowIncomeLabel,
  activeSubTab,
  onSubTabChange,
  onAddSubject,
  isHistorical,
}: {
  d: LowIncomeStudentsData;
  lowIncomeLabel: string | null;
  activeSubTab: TestSubTab;
  onSubTabChange: (t: TestSubTab) => void;
  onAddSubject: () => void;
  isHistorical: boolean;
}) {
  const ts = d.testScores;
  const subjectTabs = (ts?.subjects ?? []).map((s) => ({ key: s.label, label: s.label }));
  const allTabs = [{ key: "overview" as string, label: "Overview" }, ...subjectTabs];

  return (
    <div>
      <SubTabBar
        tabs={allTabs}
        active={activeSubTab}
        onChange={onSubTabChange}
        onAdd={!isHistorical ? onAddSubject : undefined}
      />
      <ChartDescription>
        <p>
          <BoldText
            text={
              activeSubTab === "overview"
                ? GS_COPY.lowIncomeTestScoresOverview
                : GS_COPY.lowIncomeTestScoresSubject(activeSubTab)
            }
          />
        </p>
      </ChartDescription>
      {activeSubTab === "overview" ? (
        <div className="space-y-0.5">
          <RatingBar label="All Students" value={ts?.overview?.allStudents ?? null} barColor="bg-blue-500" />
          <RatingBar
            label="Low-income Students"
            subLabel={lowIncomeLabel}
            value={ts?.overview?.lowIncome ?? null}
            barColor="bg-amber-500"
          />
        </div>
      ) : (
        (() => {
          const sub = (ts?.subjects ?? []).find((s) => s.label === activeSubTab);
          if (!sub) return <div className="text-xs text-gray-400 py-4">No data for this subject.</div>;
          return (
            <div className="space-y-0.5">
              <BenchmarkLegend barColor="bg-blue-500" labelWidth="w-52" />
              <BenchmarkBar
                label="All Students"
                schoolValue={sub.allStudents.school}
                stateAvg={sub.allStudents.stateAvg}
                barColor="bg-blue-500"
                labelWidth="w-52"
              />
              <BenchmarkBar
                label="Low-income Students"
                subLabel={lowIncomeLabel}
                schoolValue={sub.lowIncome.school}
                stateAvg={sub.lowIncome.stateAvg}
                barColor="bg-amber-500"
                labelWidth="w-52"
              />
            </div>
          );
        })()
      )}
    </div>
  );
}

// ─── Edit form ─────────────────────────────────────────────────────────────────

interface EditFormProps {
  draft: LowIncomeStudentsData;
  activeTopTab: TopTab;
  activeSubTab: TestSubTab;
  onUpdate: (next: LowIncomeStudentsData) => void;
  onSave: () => void;
  onCancel: () => void;
  lowIncomePct: number | null;
}

function EditForm({ draft, activeTopTab, activeSubTab, onUpdate, onSave, onCancel, lowIncomePct }: EditFormProps) {
  // The low income label comes from Student Demographics, shown read-only
  const liLabel = lowIncomePct != null ? `${lowIncomePct}% of students` : (draft.lowIncomeLabel ?? "—");

  function InfoRow({ label }: { label: string }) {
    return (
      <div className="text-[11px] text-gray-400 mb-3">
        Low-income students: <strong className="font-medium text-gray-600">{liLabel}</strong>
        {" "}(from Student Demographics)
      </div>
    );
  }

  if (activeTopTab === "studentProgress") {
    const sp = draft.studentProgress ?? { allStudents: null, lowIncome: null };
    return (
      <div className="space-y-3">
        <InfoRow label={liLabel} />
        <div className="text-xs font-semibold text-gray-500 mb-2">Yearly growth score (out of 10)</div>
        {(["allStudents", "lowIncome"] as const).map((key) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-48 shrink-0">
              {key === "allStudents" ? "All Students" : "Low-income Students"}
            </label>
            <input
              type="number" min={0} max={10}
              value={sp[key] != null ? String(sp[key]) : ""}
              onChange={(e) => onUpdate({ ...draft, studentProgress: { ...sp, [key]: pn(e.target.value) } })}
              placeholder="—"
              className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums"
            />
            <span className="text-xs text-gray-400">/10</span>
          </div>
        ))}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button size="sm" onClick={onSave}>Save</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (activeTopTab === "graduationRates") {
    const gr = draft.graduationRates ?? {
      allStudents: { school: null, stateAvg: DUMMY_2026.graduationRates!.allStudents.stateAvg },
      lowIncome: { school: null, stateAvg: DUMMY_2026.graduationRates!.lowIncome.stateAvg },
    };
    return (
      <div className="space-y-3">
        <InfoRow label={liLabel} />
        {(["allStudents", "lowIncome"] as const).map((group) => {
          const d26val = group === "allStudents"
            ? DUMMY_2026.graduationRates!.allStudents.stateAvg
            : DUMMY_2026.graduationRates!.lowIncome.stateAvg;
          return (
            <div key={group} className="rounded border border-gray-100 p-3 bg-gray-50 space-y-2">
              <div className="text-xs font-semibold text-gray-600">
                {group === "allStudents" ? "All Students" : "Low-income Students"}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-28 shrink-0">School %</label>
                <input
                  type="number" min={0} max={100}
                  value={gr[group].school != null ? String(gr[group].school) : ""}
                  onChange={(e) =>
                    onUpdate({ ...draft, graduationRates: { ...gr, [group]: { ...gr[group], school: pn(e.target.value) } } })
                  }
                  placeholder="—"
                  className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums"
                />
                <span className="text-[11px] text-gray-400 ml-2">
                  State avg: {d26val != null ? `${d26val}%` : "—"} (2026, read-only)
                </span>
              </div>
            </div>
          );
        })}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button size="sm" onClick={onSave}>Save</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  // Test Scores
  const ts = draft.testScores ?? { overview: { allStudents: null, lowIncome: null }, subjects: [] };

  if (activeSubTab === "overview") {
    const ov = ts.overview ?? { allStudents: null, lowIncome: null };
    return (
      <div className="space-y-3">
        <InfoRow label={liLabel} />
        <div className="text-xs font-semibold text-gray-500 mb-2">Overview score (out of 10)</div>
        {(["allStudents", "lowIncome"] as const).map((key) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-48 shrink-0">
              {key === "allStudents" ? "All Students" : "Low-income Students"}
            </label>
            <input
              type="number" min={0} max={10}
              value={ov[key] != null ? String(ov[key]) : ""}
              onChange={(e) => onUpdate({ ...draft, testScores: { ...ts, overview: { ...ov, [key]: pn(e.target.value) } } })}
              placeholder="—"
              className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums"
            />
            <span className="text-xs text-gray-400">/10</span>
          </div>
        ))}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button size="sm" onClick={onSave}>Save</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  // Subject sub-tab
  const subIdx = (ts.subjects ?? []).findIndex((s) => s.label === activeSubTab);
  const sub = subIdx >= 0 ? ts.subjects[subIdx] : null;
  if (!sub) return null;

  const d26sub = DUMMY_2026.testScores!.subjects.find((s) => s.label === sub.label);

  function updateSub(partial: Partial<LisTestSubject>) {
    const next = ts.subjects.map((s, i) => (i === subIdx ? { ...s, ...partial } : s));
    onUpdate({ ...draft, testScores: { ...ts, subjects: next } });
  }

  return (
    <div className="space-y-3">
      <InfoRow label={liLabel} />
      {(["allStudents", "lowIncome"] as const).map((group) => {
        const d26avg = group === "allStudents"
          ? d26sub?.allStudents.stateAvg
          : d26sub?.lowIncome.stateAvg;
        return (
          <div key={group} className="rounded border border-gray-100 p-3 bg-gray-50 space-y-2">
            <div className="text-xs font-semibold text-gray-600">
              {group === "allStudents" ? "All Students" : "Low-income Students"}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-28 shrink-0">School %</label>
              <input
                type="number" min={0} max={100}
                value={sub[group].school != null ? String(sub[group].school) : ""}
                onChange={(e) => updateSub({ [group]: { ...sub[group], school: pn(e.target.value) } })}
                placeholder="—"
                className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none tabular-nums"
              />
              <span className="text-[11px] text-gray-400 ml-2">
                State avg: {d26avg != null ? `${d26avg}%` : "—"} (2026, read-only)
              </span>
            </div>
          </div>
        );
      })}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <Button size="sm" onClick={onSave}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface LowIncomeStudentsViewProps {
  data: LowIncomeStudentsData | null | undefined;
  onChange: (next: LowIncomeStudentsData) => void;
  /** Low-income % pulled from Student Demographics */
  lowIncomePct?: number | null;
}

export function LowIncomeStudentsView({ data, onChange, lowIncomePct }: LowIncomeStudentsViewProps) {
  const isSaved = hasSaved(data);

  const [activeYear, setActiveYear] = useState<YearKey>(() => (isSaved ? "current" : "2026"));
  const [activeTopTab, setActiveTopTab] = useState<TopTab>("studentProgress");
  const [activeSubTab, setActiveSubTab] = useState<TestSubTab>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<LowIncomeStudentsData>(emptyData());

  const saved = isSaved ? data! : emptyData();
  const isHistorical = activeYear !== "current";

  function getD(): LowIncomeStudentsData {
    if (activeYear === "2025") return DUMMY_2025;
    if (activeYear === "2026") return DUMMY_2026;
    return isSaved ? saved : DUMMY_2026;
  }

  const d = getD();
  const showingBaseline = !isHistorical && !isSaved;

  // Low income label: prefer from Demographics prop, else from data
  const lowIncomeLabel =
    lowIncomePct != null ? `${lowIncomePct}% of students` :
    isHistorical ? d.lowIncomeLabel :
    (saved.lowIncomeLabel ?? DUMMY_2026.lowIncomeLabel);

  const verificationForYear = (year: string) =>
    saved.verification[year] ?? DUMMY_VERIFIED[year as keyof typeof DUMMY_VERIFIED] ?? { verified: false };

  const topTabs = [
    { key: "studentProgress" as TopTab, label: "Student Progress" },
    { key: "graduationRates" as TopTab, label: "Graduation Rates" },
    { key: "testScores" as TopTab, label: "Test Scores" },
  ];

  function handleEdit() {
    setDraft({ ...d, lowIncomeLabel: lowIncomeLabel });
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

  function handleAddSubject() {
    const label = prompt("New subject name:");
    if (!label?.trim()) return;
    const base = isSaved ? saved : emptyData();
    const ts = base.testScores ?? { overview: null, subjects: [] };
    const newSub: LisTestSubject = {
      label: label.trim(),
      allStudents: { school: null, stateAvg: null },
      lowIncome: { school: null, stateAvg: null },
    };
    onChange({ ...base, testScores: { ...ts, subjects: [...(ts.subjects ?? []), newSub] } });
    setActiveSubTab(label.trim());
  }

  function toggleVerified(year: string) {
    const prev = verificationForYear(year);
    onChange({ ...saved, verification: { ...saved.verification, [year]: { verified: !prev.verified } } });
  }

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
          {!isHistorical && isSaved && saved.currentAsOf && (
            <AsOfLabel asOf={saved.currentAsOf} />
          )}
          {!isHistorical && !isEditing && (
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

      {/* Description for tabs without sub-tabs */}
      {activeTopTab === "studentProgress" && !isEditing && (
        <ChartDescription>
          <p>{GS_COPY.lowIncomeStudentProgress}</p>
        </ChartDescription>
      )}
      {activeTopTab === "graduationRates" && !isEditing && (() => {
        const gr = d.graduationRates;
        const nar = gr && lowIncomeGraduationNarrative(gr.lowIncome.school, gr.allStudents.stateAvg);
        return (
          <ChartDescription>
            <p>
              At this school, low-income students are graduating compared to the state average for all
              students.
            </p>
            {nar && (
              <p>
                <BoldText text={nar} />
              </p>
            )}
          </ChartDescription>
        );
      })()}

      {/* ── Content ────────────────────────────────────────────────── */}
      {isEditing ? (
        <EditForm
          draft={draft}
          activeTopTab={activeTopTab}
          activeSubTab={activeSubTab}
          onUpdate={setDraft}
          onSave={handleSave}
          onCancel={handleCancel}
          lowIncomePct={lowIncomePct ?? null}
        />
      ) : activeTopTab === "studentProgress" ? (
        <StudentProgressPanel d={d} lowIncomeLabel={lowIncomeLabel} />
      ) : activeTopTab === "graduationRates" ? (
        <GraduationRatesPanel d={d} lowIncomeLabel={lowIncomeLabel} />
      ) : (
        <TestScoresPanel
          d={d}
          lowIncomeLabel={lowIncomeLabel}
          activeSubTab={activeSubTab}
          onSubTabChange={setActiveSubTab}
          onAddSubject={handleAddSubject}
          isHistorical={isHistorical}
        />
      )}
    </div>
  );
}
