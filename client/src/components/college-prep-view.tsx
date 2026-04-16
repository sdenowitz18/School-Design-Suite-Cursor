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
} from "./academic-chart-shared";
import { cn } from "@/lib/utils";
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
// State avg is read-only (pulled from DUMMY_2026). Users edit only school values.

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

const TYPE_OPTIONS: { value: CollegePrepRow["type"]; label: string }[] = [
  { value: "pct", label: "%" },
  { value: "sat", label: "SAT (0–1600)" },
  { value: "act", label: "ACT (0–36)" },
];

/** Standard metrics shipped with the chart — type stays fixed so bars/scales stay correct. */
const CANONICAL_LABELS = new Set(DUMMY_2026.map((r) => r.label));

function EditForm({ draft, onChange, onSave, onCancel }: EditFormProps) {
  function update(i: number, partial: Partial<CollegePrepRow>) {
    onChange(draft.map((r, idx) => (idx === i ? { ...r, ...partial } : r)));
  }

  return (
    <div className="space-y-1">
      {/* Column headers */}
      <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-400 font-medium">
        <div className="w-48 shrink-0">Metric</div>
        <div className="w-24 shrink-0">School value</div>
        <div className="w-24 shrink-0">Type</div>
        <div className="flex-1 text-gray-300">State avg (2026, read-only)</div>
      </div>

      {draft.map((row, i) => {
        const { maxValue, unit } = barConfig(row.type);
        // Find matching row in DUMMY_2026 for the state avg display
        const d26 = DUMMY_2026.find((r) => r.label === row.label);
        const displayAvg = d26?.stateAvg ?? row.stateAvg;
        const typeLocked = CANONICAL_LABELS.has(row.label);
        return (
          <div key={i} className="flex items-center gap-2 py-1 border-b border-gray-50">
            <input
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="w-48 shrink-0 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="Metric name"
            />
            <div className="flex items-center gap-1 w-24 shrink-0">
              <input
                type="number"
                min={0}
                max={maxValue}
                value={row.value != null ? String(row.value) : ""}
                onChange={(e) => update(i, { value: pn(e.target.value), stateAvg: displayAvg })}
                placeholder="—"
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums"
              />
              <span className="text-xs text-gray-400">{unit}</span>
            </div>
            <select
              value={row.type}
              disabled={typeLocked}
              title={typeLocked ? "Type is fixed for standard College Prep metrics" : undefined}
              onChange={(e) => update(i, { type: e.target.value as CollegePrepRow["type"] })}
              className={cn(
                "w-24 shrink-0 rounded border border-gray-200 px-1 py-1 text-xs focus:outline-none",
                typeLocked && "bg-gray-50 text-gray-600 cursor-not-allowed",
              )}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="flex-1 text-[11px] text-gray-400 tabular-nums">
              {displayAvg != null ? `${displayAvg}${unit}` : "—"}
            </span>
            <button
              onClick={() => onChange(draft.filter((_, idx) => idx !== i))}
              className="text-gray-300 hover:text-red-400 transition-colors ml-1 shrink-0"
              title="Remove row"
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

export interface CollegePrepViewProps {
  data: CollegePrepData | null | undefined;
  onChange: (next: CollegePrepData) => void;
}

export function CollegePrepView({ data, onChange }: CollegePrepViewProps) {
  const hasSavedCurrent = !!(data?.rows && data.rows.length > 0);

  const [activeYear, setActiveYear] = useState<YearKey>(() =>
    hasSavedCurrent ? "current" : "2026",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CollegePrepRow[]>([]);

  const saved = data ?? { rows: [], currentAsOf: null, verification: {} };
  const isHistorical = activeYear !== "current";

  // What rows to display
  const displayRows =
    activeYear === "2025" ? DUMMY_2025 :
    activeYear === "2026" ? DUMMY_2026 :
    hasSavedCurrent ? saved.rows : DUMMY_2026;

  const showingBaseline = !isHistorical && !hasSavedCurrent;

  // Verification state for this tab
  const verificationForYear = (year: string) =>
    saved.verification[year] ?? DUMMY_VERIFIED[year as keyof typeof DUMMY_VERIFIED] ?? { verified: false };

  function handleEdit() {
    // Pre-fill from current display data (saved if exists, else 2026 baseline)
    setDraft(displayRows.map((r) => ({ ...r })));
    setIsEditing(true);
  }

  function handleSave() {
    onChange({
      ...saved,
      rows: draft,
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
