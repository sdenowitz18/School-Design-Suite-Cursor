import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
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
  StateTestInfoButton,
} from "./academic-chart-shared";
import { GS_COPY } from "@/lib/greatschools-chart-narrative";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestScoresSubject {
  label: string;
  schoolPct: number | null;
  stateAvg: number | null;
}

export interface TestScoresData {
  subjects: TestScoresSubject[];
  currentAsOf: string | null;
  verification: Record<string, { verified: boolean }>;
}

// ─── Dummy data ────────────────────────────────────────────────────────────────

export const DUMMY_2025: TestScoresSubject[] = [
  { label: "Biology", schoolPct: 73, stateAvg: 51 },
  { label: "Literature", schoolPct: 87, stateAvg: 63 },
  { label: "Algebra I", schoolPct: 43, stateAvg: 42 },
];

export const DUMMY_2026: TestScoresSubject[] = [
  { label: "Biology", schoolPct: 76, stateAvg: 53 },
  { label: "Literature", schoolPct: 85, stateAvg: 61 },
  { label: "Algebra I", schoolPct: 48, stateAvg: 44 },
];

/** Fixed subject list from GreatSchools / state feed — labels are not user-editable. */
const TEST_SCORES_CANONICAL = DUMMY_2026;

function normalizeSubjectsToCanonical(subjects: TestScoresSubject[]): TestScoresSubject[] {
  return TEST_SCORES_CANONICAL.map((template, i) => {
    const match = subjects.find((r) => r.label === template.label) ?? subjects[i];
    return {
      ...template,
      schoolPct: match?.schoolPct ?? null,
    };
  });
}

const DUMMY_VERIFIED = { "2025": { verified: true }, "2026": { verified: false } };

function pn(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.max(0, Math.min(100, n));
}

// ─── Visual display ───────────────────────────────────────────────────────────

function TestScoresVisual({ subjects }: { subjects: TestScoresSubject[] }) {
  return (
    <div>
      <BenchmarkLegend barColor="bg-teal-500" labelWidth="w-44" />
      <div className="space-y-0.5">
        {subjects.map((s, i) => (
          <BenchmarkBar
            key={i}
            label={s.label}
            schoolValue={s.schoolPct}
            stateAvg={s.stateAvg}
            barColor="bg-teal-500"
            labelWidth="w-44"
            labelEnd={<StateTestInfoButton subjectLabel={s.label} />}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Edit form ─────────────────────────────────────────────────────────────────
// Subject names and row order are fixed (canonical). State avg is read-only.

interface EditFormProps {
  draft: TestScoresSubject[];
  onChange: (rows: TestScoresSubject[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ draft, onChange, onSave, onCancel }: EditFormProps) {
  function updateSchoolPct(i: number, schoolPct: number | null) {
    onChange(draft.map((r, idx) => (idx === i ? { ...r, schoolPct } : r)));
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-400 font-medium">
        <div className="w-44 shrink-0">Subject</div>
        <div className="w-24 shrink-0">School %</div>
        <div className="flex-1 text-gray-300">State avg (read-only)</div>
      </div>

      {draft.map((s, i) => {
        const displayAvg = s.stateAvg;
        return (
          <div key={`${s.label}-${i}`} className="flex items-center gap-2 py-1 border-b border-gray-50">
            <div className="w-44 shrink-0 text-xs text-gray-800 leading-tight pr-1">{s.label}</div>
            <div className="flex items-center gap-1 w-24 shrink-0">
              <input
                type="number"
                min={0}
                max={100}
                value={s.schoolPct != null ? String(s.schoolPct) : ""}
                onChange={(e) => updateSchoolPct(i, pn(e.target.value))}
                placeholder="—"
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400 tabular-nums"
                aria-label={`${s.label} school percent proficient`}
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
            <span className="flex-1 text-[11px] text-gray-400 tabular-nums">
              {displayAvg != null ? `${displayAvg}%` : "—"}
            </span>
          </div>
        );
      })}

      <div className="flex gap-2 pt-3 mt-1 border-t border-gray-100">
        <Button size="sm" onClick={onSave}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface TestScoresViewProps {
  data: TestScoresData | null | undefined;
  onChange: (next: TestScoresData) => void;
}

export function TestScoresView({ data, onChange }: TestScoresViewProps) {
  const hasSavedCurrent = !!(data?.subjects && data.subjects.length > 0);

  const [activeYear, setActiveYear] = useState<YearKey>("current");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<TestScoresSubject[]>([]);

  const saved = data ?? { subjects: [], currentAsOf: null, verification: {} };
  const isHistorical = activeYear !== "current";

  const displaySubjects =
    activeYear === "2025"
      ? DUMMY_2025
      : activeYear === "2026"
        ? DUMMY_2026
        : hasSavedCurrent
          ? normalizeSubjectsToCanonical(saved.subjects)
          : DUMMY_2026;

  const showingBaseline = !isHistorical && !hasSavedCurrent;

  const verificationForYear = (year: string) =>
    saved.verification[year] ?? DUMMY_VERIFIED[year as keyof typeof DUMMY_VERIFIED] ?? { verified: false };

  function handleEdit() {
    setDraft(normalizeSubjectsToCanonical(displaySubjects));
    setIsEditing(true);
  }

  function handleSave() {
    onChange({
      ...saved,
      subjects: normalizeSubjectsToCanonical(draft),
      currentAsOf: preserveOrSetCurrentAsOf(saved.currentAsOf),
      verification: { ...saved.verification, current: { verified: false } },
    });
    setIsEditing(false);
    setActiveYear("current");
  }

  function handleCancel() {
    setIsEditing(false);
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
          <VerificationBadge
            verified={verificationForYear(isHistorical ? activeYear : "current").verified}
            onToggle={() => toggleVerified(isHistorical ? activeYear : "current")}
            asOf={isHistorical ? `${activeYear} school year` : undefined}
          />
          {!isHistorical && hasSavedCurrent && saved.currentAsOf && (
            <AsOfLabel asOf={saved.currentAsOf} />
          )}
          {!isHistorical && !isEditing && (
            <Button size="sm" variant="outline" className="h-8" onClick={handleEdit}>
              <Pencil className="h-3 w-3 mr-1.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* ── Description ────────────────────────────────────────────── */}
      <ChartDescription>
        <p>{GS_COPY.testScoresIntro}</p>
      </ChartDescription>

      {isHistorical && <ReadOnlyBanner year={activeYear} />}
      {showingBaseline && !isEditing && <BasedOnNotice />}

      {/* ── Content ────────────────────────────────────────────────── */}
      {isEditing ? (
        <EditForm
          draft={draft}
          onChange={setDraft}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <TestScoresVisual subjects={displaySubjects} />
      )}
    </div>
  );
}
