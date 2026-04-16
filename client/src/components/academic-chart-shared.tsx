import React from "react";
import { CheckCircle2, XCircle, Lock, Info, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GS_STATE_TEST_MODAL_BODY } from "@/lib/greatschools-chart-narrative";

// ─── Types ────────────────────────────────────────────────────────────────────

export type YearKey = "2025" | "2026" | "current";

export const DEFAULT_RACE_LABELS = [
  "White",
  "Asian",
  "Black",
  "Hispanic",
  "Two or more races",
  "Unspecified",
];

// ─── Year tabs (matches Student Demographics style) ───────────────────────────

interface YearTabsProps {
  active: YearKey;
  onChange: (y: YearKey) => void;
}

export function YearTabs({ active, onChange }: YearTabsProps) {
  const years: YearKey[] = ["2025", "2026", "current"];
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
            active === y
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          {y === "current" ? "Current" : y}
        </button>
      ))}
    </div>
  );
}

// ─── Read-only lock notice ─────────────────────────────────────────────────────

export function ReadOnlyBanner({ year }: { year?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
      <Lock className="h-3 w-3 shrink-0" />
      {year ? `${year} data` : "Historical data"} — read only
    </div>
  );
}

// ─── "Showing 2026 as baseline" notice ────────────────────────────────────────

export function BasedOnNotice() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded px-2.5 py-1.5 border border-amber-200">
      <Info className="h-3 w-3 shrink-0" />
      Showing most recent year (2026) — click <strong className="font-semibold">Edit</strong> to update for the current year
    </div>
  );
}

// ─── Chart framing copy (normal body text — same weight as chart labels, not a callout) ─

export function ChartDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-gray-900 leading-relaxed space-y-3 max-w-3xl">
      {children}
    </div>
  );
}

/** Renders a string with **bold** markers as React nodes with <strong> tags. */
export function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Per subject row — opens modal with canonical state-test context (PA Keystone example). */
export function StateTestInfoButton({ subjectLabel }: { subjectLabel: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-full p-0.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors shrink-0"
          title="About this test"
          aria-label={`About ${subjectLabel} state test`}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">About state tests ({subjectLabel})</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">{GS_STATE_TEST_MODAL_BODY}</p>
      </DialogContent>
    </Dialog>
  );
}

// ─── Verification badge (hover swaps label) ───────────────────────────────────

interface VerificationBadgeProps {
  verified: boolean;
  onToggle: () => void;
  asOf?: string | null;
}

export function VerificationBadge({ verified, onToggle, asOf }: VerificationBadgeProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={onToggle}
        className={cn(
          "group flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors select-none",
          verified
            ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
            : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100",
        )}
      >
        {verified ? (
          <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-gray-400 shrink-0" />
        )}
        <span className="group-hover:hidden">
          {verified ? "Verified" : "Not Verified"}
        </span>
        <span className="hidden group-hover:inline">
          {verified ? "Click to unverify" : "Click to verify"}
        </span>
      </button>
      {asOf && <span className="text-[11px] text-gray-400">As of {asOf}</span>}
    </div>
  );
}

// ─── Current dataset creation date (shown on "Current" across chart views) ────

/** Set once when the school first saves "Current" data; keep the same date on later edits. */
export function preserveOrSetCurrentAsOf(existing: string | null | undefined): string {
  const s = existing != null ? String(existing).trim() : "";
  if (s !== "") return s;
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AsOfLabel({ asOf }: { asOf: string | null }) {
  if (!asOf) return null;
  return <span className="text-[11px] text-gray-400">Created {asOf}</span>;
}

// ─── Benchmark bar (single bar + state-avg marker + labels) ───────────────────
// This is the primary bar for academic charts — one filled bar with a thin
// vertical tick at the state average position.

interface BenchmarkBarProps {
  label: string;
  subLabel?: string | null;
  schoolValue: number | null;
  stateAvg: number | null;
  maxValue?: number;
  unit?: string;
  barColor?: string;
  labelWidth?: string;
  /** Shown inline after the label (e.g. state-test info control). */
  labelEnd?: React.ReactNode;
}

export function BenchmarkBar({
  label,
  subLabel,
  schoolValue,
  stateAvg,
  maxValue = 100,
  unit = "%",
  barColor = "bg-blue-500",
  labelWidth = "w-44",
  labelEnd,
}: BenchmarkBarProps) {
  const schoolWidth = schoolValue != null ? Math.min(100, (schoolValue / maxValue) * 100) : 0;
  const stateWidth = stateAvg != null ? Math.min(100, (stateAvg / maxValue) * 100) : null;
  const schoolDisplay = schoolValue != null ? `${schoolValue}${unit}` : "—";
  const avgDisplay = stateAvg != null ? `${stateAvg}${unit}` : "";

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={cn("shrink-0", labelWidth)}>
        <div className="flex items-start gap-1">
          <div className="text-sm text-gray-800 leading-snug min-w-0 flex-1">{label}</div>
          {labelEnd}
        </div>
        {subLabel && <div className="text-[11px] text-gray-400 mt-0.5">{subLabel}</div>}
      </div>
      <div className="w-14 text-right text-sm font-semibold text-gray-800 shrink-0 tabular-nums">
        {schoolDisplay}
      </div>
      {/* Bar track */}
      <div className="flex-1 relative h-4">
        <div className="absolute inset-0 bg-gray-100 rounded" />
        {schoolValue != null && (
          <div
            className={cn("absolute inset-y-0 left-0 rounded transition-all duration-200", barColor)}
            style={{ width: `${schoolWidth}%` }}
          />
        )}
        {/* State avg tick — extends slightly beyond bar bounds for visibility */}
        {stateWidth != null && (
          <div
            className="absolute w-0.5 bg-gray-500 z-10 rounded-full"
            style={{ left: `${stateWidth}%`, top: "-3px", bottom: "-3px" }}
          />
        )}
      </div>
      <div className="w-16 text-right text-xs text-gray-500 shrink-0 tabular-nums">
        {avgDisplay}
      </div>
    </div>
  );
}

// ─── Rating bar (X/10, no state avg) ─────────────────────────────────────────

interface RatingBarProps {
  label: string;
  subLabel?: string | null;
  value: number | null;
  maxValue?: number;
  barColor?: string;
  labelWidth?: string;
}

export function RatingBar({
  label,
  subLabel,
  value,
  maxValue = 10,
  barColor = "bg-purple-500",
  labelWidth = "w-44",
}: RatingBarProps) {
  const width = value != null ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={cn("shrink-0", labelWidth)}>
        <div className="text-sm text-gray-800 leading-snug">{label}</div>
        {subLabel && <div className="text-[11px] text-gray-400 mt-0.5">{subLabel}</div>}
      </div>
      <div className="w-14 text-right text-sm font-semibold text-gray-800 shrink-0 tabular-nums">
        {value != null ? `${value}/${maxValue}` : "—"}
      </div>
      <div className="flex-1 relative h-4 bg-gray-100 rounded overflow-hidden">
        {value != null && (
          <div
            className={cn("absolute inset-y-0 left-0 rounded transition-all duration-200", barColor)}
            style={{ width: `${width}%` }}
          />
        )}
      </div>
      {/* Spacer aligns with BenchmarkBar's avg column */}
      <div className="w-16 shrink-0" />
    </div>
  );
}

// ─── Sub-tab bar ──────────────────────────────────────────────────────────────

interface SubTabBarProps<T extends string> {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (t: T) => void;
  onAdd?: () => void;
  addLabel?: string;
}

export function SubTabBar<T extends string>({
  tabs,
  active,
  onChange,
  onAdd,
  addLabel = "+ Add",
}: SubTabBarProps<T>) {
  return (
    <div className="flex items-center gap-0 flex-wrap border-b border-gray-100 mb-4">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
            active === t.key
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700",
          )}
        >
          {t.label}
        </button>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          className="px-3 py-2 text-xs text-blue-500 hover:text-blue-700 border-b-2 border-transparent -mb-px"
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}

// ─── Chart legend row (columns line up with BenchmarkBar / RatingBar) ─────────

interface BenchmarkLegendProps {
  barColor?: string;
  /** Must match BenchmarkBar `labelWidth` so labels sit over the correct columns. */
  labelWidth?: string;
}

export function BenchmarkLegend({ barColor = "bg-blue-500", labelWidth = "w-44" }: BenchmarkLegendProps) {
  return (
    <div className="flex items-end gap-3 pb-1 pt-0.5 text-[11px] text-gray-500">
      <div className={cn("shrink-0", labelWidth)} aria-hidden />
      <div className="w-14 shrink-0 flex justify-end items-center gap-1.5 min-h-4">
        <div className={cn("w-3 h-2 rounded shrink-0", barColor)} />
        <span className="text-right leading-tight">School</span>
      </div>
      <div className="flex-1 min-h-4" aria-hidden />
      <div className="w-16 shrink-0 flex justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-gray-500 rounded-full shrink-0" />
          <span className="text-right leading-tight">State avg</span>
        </div>
      </div>
    </div>
  );
}

// ─── Section edit row (label + editable value + read-only avg) ───────────────

interface EditRowProps {
  label: string;
  value: number | null;
  stateAvg: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  readOnlyLabel?: boolean;
  onLabelChange?: (s: string) => void;
  onDelete?: () => void;
}

export function EditRow({
  label,
  value,
  stateAvg,
  onChange,
  min = 0,
  max = 100,
  unit = "%",
  placeholder = "—",
  readOnlyLabel = true,
  onLabelChange,
  onDelete,
}: EditRowProps) {
  function pn(s: string): number | null {
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  return (
    <div className="flex items-center gap-2 py-1">
      {readOnlyLabel ? (
        <div className="w-44 shrink-0 text-xs text-gray-700 font-medium">{label}</div>
      ) : (
        <input
          value={label}
          onChange={(e) => onLabelChange?.(e.target.value)}
          className="w-44 shrink-0 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Label"
        />
      )}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(pn(e.target.value))}
          placeholder={placeholder}
          className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums"
        />
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
      <div className="text-[11px] text-gray-400 ml-2 shrink-0">
        {stateAvg != null ? `Avg ${stateAvg}${unit} (2026)` : ""}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="ml-auto text-gray-300 hover:text-red-400 transition-colors"
          title="Remove row"
        >
          ×
        </button>
      )}
    </div>
  );
}
