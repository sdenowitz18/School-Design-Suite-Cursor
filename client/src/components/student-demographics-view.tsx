import React, { useState } from "react";
import { Pencil, Plus, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VerificationBadge, AsOfLabel, preserveOrSetCurrentAsOf } from "./academic-chart-shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RaceEntry = { label: string; pct: number | null };

export type StudentDemographicsData = {
  raceEthnicity: RaceEntry[];
  lowIncomePct: number | null;
  femalePct: number | null;
  currentAsOf?: string | null;
  verification?: Record<string, { verified: boolean }>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RACE_LABELS = [
  "White",
  "Asian or Pacific Islander",
  "Black",
  "Two or more races",
  "Hispanic",
  "Native Hawaiian or Other Pacific Islander",
  "Native American",
  "Unspecified",
];

const DUMMY_2025: StudentDemographicsData = {
  raceEthnicity: [
    { label: "White", pct: 42 },
    { label: "Asian or Pacific Islander", pct: 8 },
    { label: "Black", pct: 22 },
    { label: "Two or more races", pct: 7 },
    { label: "Hispanic", pct: 15 },
    { label: "Native Hawaiian or Other Pacific Islander", pct: 1 },
    { label: "Native American", pct: 2 },
    { label: "Unspecified", pct: 3 },
  ],
  lowIncomePct: 38,
  femalePct: 49,
};

const DUMMY_2026: StudentDemographicsData = {
  raceEthnicity: [
    { label: "White", pct: 40 },
    { label: "Asian or Pacific Islander", pct: 9 },
    { label: "Black", pct: 23 },
    { label: "Two or more races", pct: 8 },
    { label: "Hispanic", pct: 15 },
    { label: "Native Hawaiian or Other Pacific Islander", pct: 1 },
    { label: "Native American", pct: 2 },
    { label: "Unspecified", pct: 2 },
  ],
  lowIncomePct: 36,
  femalePct: 51,
};

function emptyCurrentData(): StudentDemographicsData {
  return {
    raceEthnicity: DEFAULT_RACE_LABELS.map((label) => ({ label, pct: null })),
    lowIncomePct: null,
    femalePct: null,
  };
}

// ─── SVG Donut chart (used for low-income) ───────────────────────────────────

function DonutChart({ pct, size = 52 }: { pct: number | null; size?: number }) {
  const filled = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const empty = 100 - filled;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className="shrink-0">
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="4" />
      {filled > 0 && (
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeDasharray={`${filled} ${empty}`}
          strokeDashoffset="25"
        />
      )}
      <text
        x="18"
        y="20.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill={pct === null ? "#9ca3af" : "#111827"}
      >
        {pct === null ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}

// ─── CSS Pie chart (used for male/female) ────────────────────────────────────

function PieChart({ femalePct, size = 52 }: { femalePct: number | null; size?: number }) {
  if (femalePct === null) {
    return (
      <div
        className="rounded-full shrink-0 border-2 border-dashed border-gray-300 bg-gray-50"
        style={{ width: size, height: size }}
      />
    );
  }
  const f = Math.max(0, Math.min(100, femalePct));
  const deg = f * 3.6;
  return (
    <div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#22c55e 0deg ${deg}deg, #166534 ${deg}deg 360deg)`,
      }}
    />
  );
}

// ─── Visual (read-only) view ──────────────────────────────────────────────────

function DemographicsVisual({
  data,
  isUnset,
}: {
  data: StudentDemographicsData;
  isUnset: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-0.5">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
          Student Demographics
        </div>
        <div className="text-xs text-gray-500">
          Schools that create a positive culture help all students thrive.
        </div>
      </div>

      {/* Empty state banner */}
      {isUnset && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-xs text-gray-400 text-center">
          No data set yet — click <span className="font-semibold text-gray-500">Edit</span> to add data
        </div>
      )}

      {/* Race / Ethnicity bars */}
      <div className="space-y-2">
        {data.raceEthnicity.map((entry, idx) => {
          const hasValue = entry.pct !== null;
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="text-xs text-gray-700 w-40 shrink-0 leading-tight">{entry.label}</div>
              <div
                className={cn(
                  "text-xs font-semibold w-8 shrink-0 text-right",
                  hasValue ? "text-gray-900" : "text-gray-400",
                )}
              >
                {hasValue ? `${entry.pct}%` : "—"}
              </div>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                {hasValue && (entry.pct ?? 0) > 0 && (
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${entry.pct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Low income */}
      <div className="flex items-center gap-3 pt-1">
        <DonutChart pct={data.lowIncomePct} />
        <div className="text-sm text-gray-700">
          {data.lowIncomePct !== null ? (
            <>
              <span className="font-bold text-gray-900">{data.lowIncomePct}%</span>{" "}
              Students from low income family
            </>
          ) : (
            <span className="text-gray-400 italic">Low income — not set</span>
          )}
        </div>
      </div>

      {/* Male / Female */}
      <div className="flex items-center gap-3">
        <PieChart femalePct={data.femalePct} />
        <div className="text-sm space-y-0.5">
          {data.femalePct !== null ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
                <span className="text-gray-700">{data.femalePct}% Female</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-900 shrink-0" />
                <span className="text-gray-700">{100 - data.femalePct}% Male</span>
              </div>
            </>
          ) : (
            <span className="text-gray-400 italic">Male / Female — not set</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit form (Current tab only) ────────────────────────────────────────────

function DemographicsEditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: StudentDemographicsData;
  setDraft: React.Dispatch<React.SetStateAction<StudentDemographicsData>>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const raceTotal = draft.raceEthnicity.reduce(
    (sum, e) => sum + (e.pct !== null ? e.pct : 0),
    0,
  );
  const totalOk = raceTotal === 100;

  const updateLabel = (idx: number, label: string) =>
    setDraft((prev) => {
      const next = [...prev.raceEthnicity];
      next[idx] = { ...next[idx], label };
      return { ...prev, raceEthnicity: next };
    });

  const updatePct = (idx: number, raw: string) => {
    const pct =
      raw === "" ? null : Math.max(0, Math.min(100, Math.round(Number(raw))));
    setDraft((prev) => {
      const next = [...prev.raceEthnicity];
      next[idx] = { ...next[idx], pct };
      return { ...prev, raceEthnicity: next };
    });
  };

  const deleteEntry = (idx: number) =>
    setDraft((prev) => ({
      ...prev,
      raceEthnicity: prev.raceEthnicity.filter((_, i) => i !== idx),
    }));

  const addEntry = () =>
    setDraft((prev) => ({
      ...prev,
      raceEthnicity: [...prev.raceEthnicity, { label: "", pct: null }],
    }));

  return (
    <div className="space-y-6">
      {/* Race / Ethnicity */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Race / Ethnicity
        </div>

        <div className="space-y-2">
          {draft.raceEthnicity.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={entry.label}
                onChange={(e) => updateLabel(idx, e.target.value)}
                placeholder="Category name"
                className="h-8 text-xs flex-1 min-w-0"
              />
              <div className="relative shrink-0">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={entry.pct === null ? "" : entry.pct}
                  onChange={(e) => updatePct(idx, e.target.value)}
                  placeholder="—"
                  className="h-8 text-xs w-16 pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={() => deleteEntry(idx)}
                className="text-gray-400 hover:text-red-500 transition-colors shrink-0 p-0.5"
                aria-label="Delete category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          Add category
        </button>

        {/* Running total */}
        <div
          className={cn(
            "flex items-center justify-between rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
            totalOk
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-red-300 bg-red-50 text-red-600",
          )}
        >
          <span>Total</span>
          <span>
            {raceTotal}%{" "}
            {totalOk ? "✓" : "— does not equal 100%"}
          </span>
        </div>
      </div>

      {/* Low income */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Students from Low Income Family
        </div>
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <Input
              type="number"
              min="0"
              max="100"
              value={draft.lowIncomePct === null ? "" : draft.lowIncomePct}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((prev) => ({
                  ...prev,
                  lowIncomePct:
                    v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v)))),
                }));
              }}
              placeholder="—"
              className="h-8 text-xs w-20 pr-6"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">
              %
            </span>
          </div>
          <span className="text-xs text-gray-500">of students from a low income family</span>
        </div>
      </div>

      {/* Male / Female */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Male / Female
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-12 shrink-0">Female</span>
            <input
              type="range"
              min="0"
              max="100"
              value={draft.femalePct ?? 50}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, femalePct: Number(e.target.value) }))
              }
              className="flex-1 h-2 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-gray-900 w-8 text-right shrink-0">
              {draft.femalePct !== null ? `${draft.femalePct}%` : "50%"}
            </span>
          </div>
          <div className="text-[11px] text-gray-400 pl-[3.75rem]">
            {draft.femalePct !== null ? `${100 - draft.femalePct}% Male` : "50% Male (drag to set)"}
          </div>
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <Button
          size="sm"
          onClick={onSave}
          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-8 text-xs">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function StudentDemographicsView({
  data,
  onChange,
}: {
  data: StudentDemographicsData | null | undefined;
  onChange: (next: StudentDemographicsData) => void;
}) {
  const [activeTab, setActiveTab] = useState<"2025" | "2026" | "current">("current");
  const [isEditing, setIsEditing] = useState(false);

  const currentData: StudentDemographicsData = data ?? emptyCurrentData();

  const isCurrentUnset =
    currentData.raceEthnicity.every((e) => e.pct === null) &&
    currentData.lowIncomePct === null &&
    currentData.femalePct === null;

  const [draft, setDraft] = useState<StudentDemographicsData>(currentData);

  const displayData =
    activeTab === "2025" ? DUMMY_2025 : activeTab === "2026" ? DUMMY_2026 : currentData;

  const handleEdit = () => {
    setDraft(currentData);
    setIsEditing(true);
  };

  const handleSave = () => {
    onChange({
      ...draft,
      currentAsOf: preserveOrSetCurrentAsOf(draft.currentAsOf ?? currentData.currentAsOf),
    });
    setIsEditing(false);
  };

  const toggleVerified = (year: string) => {
    const prev = (currentData.verification ?? {})[year] ?? { verified: false };
    onChange({ ...currentData, verification: { ...(currentData.verification ?? {}), [year]: { verified: !prev.verified } } });
  };

  const getVerification = (year: string) => (currentData.verification ?? {})[year] ?? { verified: false };

  const handleCancel = () => {
    setDraft(currentData);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Tab bar + Edit button + verification */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(["2025", "2026", "current"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                if (tab !== "current") setIsEditing(false);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                activeTab === tab
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {tab === "current" ? "Current" : tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== "current" && (
            <VerificationBadge
              verified={getVerification(activeTab).verified}
              onToggle={() => toggleVerified(activeTab)}
              asOf={`${activeTab} school year`}
            />
          )}
          {activeTab === "current" && currentData.currentAsOf && (
            <AsOfLabel asOf={currentData.currentAsOf} />
          )}
          {activeTab === "current" && !isEditing && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEdit}
              className="h-8 text-xs shrink-0"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Locked notice for historical tabs */}
      {activeTab !== "current" && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Lock className="w-3 h-3 shrink-0" />
          {activeTab} data — read only
        </div>
      )}

      {/* Content */}
      {isEditing && activeTab === "current" ? (
        <DemographicsEditForm
          draft={draft}
          setDraft={setDraft}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <DemographicsVisual
          data={displayData}
          isUnset={activeTab === "current" && isCurrentUnset}
        />
      )}
    </div>
  );
}
