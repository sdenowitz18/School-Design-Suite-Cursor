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
} from "./academic-chart-shared";
import { GS_COPY } from "@/lib/greatschools-chart-narrative";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollegePrepRow {
  label: string;
  value: number | null;
  stateAvg: number | null;
  type: "pct" | "sat" | "act";
}

export interface CollegePrepData {
  rows: CollegePrepRow[];
  currentAsOf: string | null;
  verification: Record<string, { verified: boolean }>;
}

// ─── Dummy data ────────────────────────────────────────────────────────────────

export const DUMMY_2025: CollegePrepRow[] = [
  { label: "4-year graduation rate", value: 94, stateAvg: 87, type: "pct" },
  { label: "Average SAT score", value: 1150, stateAvg: 1060, type: "sat" },
  { label: "Average ACT score", value: 24, stateAvg: 21, type: "act" },
  { label: "AP course participation", value: 42, stateAvg: 38, type: "pct" },
  { label: "Enrolled in Dual (9–12)", value: 18, stateAvg: 22, type: "pct" },
  { label: "Enrolled in IB (9–12)", value: 8, stateAvg: 5, type: "pct" },
];

export const DUMMY_2026: CollegePrepRow[] = [
  { label: "4-year graduation rate", value: 95, stateAvg: 88, type: "pct" },
  { label: "Average SAT score", value: 1175, stateAvg: 1070, type: "sat" },
  { label: "Average ACT score", value: 25, stateAvg: 22, type: "act" },
  { label: "AP course participation", value: 45, stateAvg: 39, type: "pct" },
  { label: "Enrolled in Dual (9–12)", value: 20, stateAvg: 23, type: "pct" },
  { label: "Enrolled in IB (9–12)", value: 9, stateAvg: 5, type: "pct" },
];

/** Fixed metric set for College Prep — labels, types, and row order are not user-editable. */
const COLLEGE_PREP_CANONICAL = DUMMY_2026;

function normalizeRowsToCanonical(rows: CollegePrepRow[]): CollegePrepRow[] {
  return COLLEGE_PREP_CANONICAL.map((template, i) => {
    const match = rows.find((r) => r.label === template.label) ?? rows[i];
    return {
      ...template,
      value: match?.value ?? null,
    };
  });
}

const DUMMY_VERIFIED = { "2025": { verified: true }, "2026": { verified: false } };

function barConfig(type: CollegePrepRow["type"]): { maxValue: number; unit: string } {
  if (type === "sat") return { maxValue: 1600, unit: "" };
  if (type === "act") return { maxValue: 36, unit: "" };
  return { maxValue: 100, unit: "%" };
}

// ─── Visual display ───────────────────────────────────────────────────────────

function CollegePrepVisual({ rows }: { rows: CollegePrepRow[] }) {
  return (
    <div>
      <BenchmarkLegend labelWidth="w-48" />
      <div className="space-y-0.5">
        {rows.map((row, i) => {
          const { maxValue, unit } = barConfig(row.type);
          return (
            <BenchmarkBar
              key={i}
              label={row.label}
              schoolValue={row.value}
              stateAvg={row.stateAvg}
              maxValue={maxValue}
              unit={unit}
              barColor="bg-blue-500"
              labelWidth="w-48"
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Edit form ─────────────────────────────────────────────────────────────────
// Metric names, types, and row order are fixed (canonical). State avg is read-only.
// Users edit only school values on Current.

interface EditFormProps {
  draft: CollegePrepRow[];
  onChange: (rows: CollegePrepRow[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

function pn(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function typeHint(t: CollegePrepRow["type"]): string {
  if (t === "sat") return "SAT";
  if (t === "act") return "ACT";
  return "%";
}

function EditForm({ draft, onChange, onSave, onCancel }: EditFormProps) {
  function updateValue(i: number, value: number | null) {
    onChange(draft.map((r, idx) => (idx === i ? { ...r, value } : r)));
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-400 font-medium">
        <div className="w-48 shrink-0">Metric</div>
        <div className="w-28 shrink-0">School value</div>
        <div className="flex-1 text-gray-300">State avg (read-only)</div>
      </div>

      {draft.map((row, i) => {
        const { maxValue, unit } = barConfig(row.type);
        const displayAvg = row.stateAvg;
        return (
          <div key={`${row.label}-${i}`} className="flex items-center gap-2 py-1 border-b border-gray-50">
            <div className="w-48 shrink-0 text-xs text-gray-800 leading-tight pr-1">{row.label}</div>
            <div className="flex items-center gap-1 w-28 shrink-0">
              <input
                type="number"
                min={0}
                max={maxValue}
                value={row.value != null ? String(row.value) : ""}
                onChange={(e) => updateValue(i, pn(e.target.value))}
                placeholder="—"
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums"
                aria-label={`${row.label} school value`}
              />
              <span className="text-[10px] text-gray-400 w-8 shrink-0" title="Scale">
                {unit || typeHint(row.type)}
              </span>
            </div>
            <span className="flex-1 text-[11px] text-gray-400 tabular-nums">
              {displayAvg != null ? `${displayAvg}${unit}` : "—"}
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

export interface CollegePrepViewProps {
  data: CollegePrepData | null | undefined;
  onChange: (next: CollegePrepData) => void;
}

export function CollegePrepView({ data, onChange }: CollegePrepViewProps) {
  const hasSavedCurrent = !!(data?.rows && data.rows.length > 0);

  const [activeYear, setActiveYear] = useState<YearKey>("current");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CollegePrepRow[]>([]);

  const saved = data ?? { rows: [], currentAsOf: null, verification: {} };
  const isHistorical = activeYear !== "current";

  // What rows to display (Current always uses canonical metric set)
  const displayRows =
    activeYear === "2025"
      ? DUMMY_2025
      : activeYear === "2026"
        ? DUMMY_2026
        : hasSavedCurrent
          ? normalizeRowsToCanonical(saved.rows)
          : DUMMY_2026;

  const showingBaseline = !isHistorical && !hasSavedCurrent;

  // Verification state for this tab
  const verificationForYear = (year: string) =>
    saved.verification[year] ?? DUMMY_VERIFIED[year as keyof typeof DUMMY_VERIFIED] ?? { verified: false };

  function handleEdit() {
    setDraft(normalizeRowsToCanonical(displayRows));
    setIsEditing(true);
  }

  function handleSave() {
    onChange({
      ...saved,
      rows: normalizeRowsToCanonical(draft),
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
      {/* ── Header row ─────────────────────────────────────────────── */}
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
        <p>{GS_COPY.collegePrep}</p>
      </ChartDescription>

      {/* ── Historical notice / baseline notice ────────────────────── */}
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
        <CollegePrepVisual rows={displayRows} />
      )}
    </div>
  );
}
