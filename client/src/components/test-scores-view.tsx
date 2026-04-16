import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
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

interface EditFormProps {
  draft: TestScoresSubject[];
  onChange: (rows: TestScoresSubject[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ draft, onChange, onSave, onCancel }: EditFormProps) {
  function update(i: number, partial: Partial<TestScoresSubject>) {
    onChange(draft.map((r, idx) => (idx === i ? { ...r, ...partial } : r)));
  }

  return (
    <div className="space-y-1">
      {/* Column headers */}
      <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-400 font-medium">
        <div className="w-44 shrink-0">Subject</div>
        <div className="w-24 shrink-0">School %</div>
        <div className="flex-1 text-gray-300">State avg (2026, read-only)</div>
      </div>

      {draft.map((s, i) => {
        const d26 = DUMMY_2026.find((r) => r.label === s.label);
        const displayAvg = d26?.stateAvg ?? s.stateAvg;
        return (
          <div key={i} className="flex items-center gap-2 py-1 border-b border-gray-50">
            <input
              value={s.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="w-44 shrink-0 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
              placeholder="Subject name"
            />
            <div className="flex items-center gap-1 w-24 shrink-0">
              <input
                type="number"
                min={0}
                max={100}
                value={s.schoolPct != null ? String(s.schoolPct) : ""}
                onChange={(e) => update(i, { schoolPct: pn(e.target.value), stateAvg: displayAvg })}
                placeholder="—"
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400 tabular-nums"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
            <span className="flex-1 text-[11px] text-gray-400 tabular-nums">
              {displayAvg != null ? `${displayAvg}%` : "—"}
            </span>
            <button
              onClick={() => onChange(draft.filter((_, idx) => idx !== i))}
              className="text-gray-300 hover:text-red-400 transition-colors ml-1 shrink-0"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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

  const [activeYear, setActiveYear] = useState<YearKey>(() =>
    hasSavedCurrent ? "current" : "2026",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<TestScoresSubject[]>([]);

  const saved = data ?? { subjects: [], currentAsOf: null, verification: {} };
  const isHistorical = activeYear !== "current";

  const displaySubjects =
    activeYear === "2025" ? DUMMY_2025 :
    activeYear === "2026" ? DUMMY_2026 :
    hasSavedCurrent ? saved.subjects : DUMMY_2026;

  const showingBaseline = !isHistorical && !hasSavedCurrent;

  const verificationForYear = (year: string) =>
    saved.verification[year] ?? DUMMY_VERIFIED[year as keyof typeof DUMMY_VERIFIED] ?? { verified: false };

  function handleEdit() {
    setDraft(displaySubjects.map((s) => ({ ...s })));
    setIsEditing(true);
  }

  function handleSave() {
    onChange({
      ...saved,
      subjects: draft,
      currentAsOf: preserveOrSetCurrentAsOf(saved.currentAsOf),
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
          {isHistorical && (
            <VerificationBadge
              verified={verificationForYear(activeYear).verified}
              onToggle={() => toggleVerified(activeYear)}
              asOf={`${activeYear} school year`}
            />
          )}
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
