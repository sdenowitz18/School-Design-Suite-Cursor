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
  SubTabBar,
  BoldText,
} from "./academic-chart-shared";
import { GS_COPY } from "@/lib/greatschools-chart-narrative";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwdSubject {
  label: string;
  allStudents: { school: number | null; stateAvg: number | null };
  swd: { school: number | null; stateAvg: number | null };
}

export interface StudentsWithDisabilitiesData {
  swdLabel: string | null;
  subjects: SwdSubject[];
  currentAsOf: string | null;
  verification: Record<string, { verified: boolean }>;
}

// ─── Dummy data ────────────────────────────────────────────────────────────────

const DUMMY_2025: SwdSubject[] = [
  { label: "Biology", allStudents: { school: 73, stateAvg: 51 }, swd: { school: 38, stateAvg: 29 } },
  { label: "Literature", allStudents: { school: 87, stateAvg: 63 }, swd: { school: 52, stateAvg: 44 } },
  { label: "Algebra I", allStudents: { school: 43, stateAvg: 42 }, swd: { school: 24, stateAvg: 30 } },
];

const DUMMY_2026: SwdSubject[] = [
  { label: "Biology", allStudents: { school: 76, stateAvg: 53 }, swd: { school: 41, stateAvg: 31 } },
  { label: "Literature", allStudents: { school: 85, stateAvg: 61 }, swd: { school: 55, stateAvg: 46 } },
  { label: "Algebra I", allStudents: { school: 48, stateAvg: 44 }, swd: { school: 28, stateAvg: 32 } },
];

const DUMMY_VERIFIED = { "2025": { verified: true }, "2026": { verified: false } };

function emptySubjects(): SwdSubject[] {
  return DUMMY_2026.map((s) => ({
    label: s.label,
    allStudents: { school: null, stateAvg: s.allStudents.stateAvg },
    swd: { school: null, stateAvg: s.swd.stateAvg },
  }));
}

function pn(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.max(0, Math.min(100, n));
}

// ─── Visual display for one subject ──────────────────────────────────────────

interface SubjectVisualProps {
  subject: SwdSubject;
  swdLabel: string | null;
}

function SubjectVisual({ subject, swdLabel }: SubjectVisualProps) {
  return (
    <div className="space-y-0.5">
      <BenchmarkLegend barColor="bg-blue-500" labelWidth="w-52" />
      <BenchmarkBar
        label="All Students"
        schoolValue={subject.allStudents.school}
        stateAvg={subject.allStudents.stateAvg}
        barColor="bg-blue-500"
        labelWidth="w-52"
      />
      <BenchmarkBar
        label="Students with Disabilities"
        subLabel={swdLabel ?? undefined}
        schoolValue={subject.swd.school}
        stateAvg={subject.swd.stateAvg}
        barColor="bg-orange-400"
        labelWidth="w-52"
      />
    </div>
  );
}

// ─── Edit form for one subject ────────────────────────────────────────────────

interface EditFormProps {
  subject: SwdSubject;
  swdLabel: string;
  onSwdLabelChange: (v: string) => void;
  onUpdate: (next: SwdSubject) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ subject, swdLabel, onSwdLabelChange, onUpdate, onSave, onCancel }: EditFormProps) {
  function set(group: "allStudents" | "swd", field: "school" | "stateAvg", val: string) {
    onUpdate({ ...subject, [group]: { ...subject[group], [field]: pn(val) } });
  }

  return (
    <div className="space-y-4">
      {/* SWD label */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600 w-52 shrink-0">
          % of students with disabilities
        </label>
        <input
          value={swdLabel}
          onChange={(e) => onSwdLabelChange(e.target.value)}
          placeholder="e.g. 14% of students"
          className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300"
        />
      </div>

      {/* All Students */}
      <div className="rounded border border-gray-100 p-3 bg-gray-50 space-y-2">
        <div className="text-xs font-semibold text-gray-600">All Students</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-28 shrink-0">School %</label>
          <input
            type="number" min={0} max={100}
            value={subject.allStudents.school != null ? String(subject.allStudents.school) : ""}
            onChange={(e) => set("allStudents", "school", e.target.value)}
            placeholder="—"
            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums"
          />
          <span className="text-[11px] text-gray-400 ml-2">
            State avg: {subject.allStudents.stateAvg != null ? `${subject.allStudents.stateAvg}%` : "—"} (2026, read-only)
          </span>
        </div>
      </div>

      {/* Students with Disabilities */}
      <div className="rounded border border-gray-100 p-3 bg-gray-50 space-y-2">
        <div className="text-xs font-semibold text-gray-600">Students with Disabilities</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-28 shrink-0">School %</label>
          <input
            type="number" min={0} max={100}
            value={subject.swd.school != null ? String(subject.swd.school) : ""}
            onChange={(e) => set("swd", "school", e.target.value)}
            placeholder="—"
            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 tabular-nums"
          />
          <span className="text-[11px] text-gray-400 ml-2">
            State avg: {subject.swd.stateAvg != null ? `${subject.swd.stateAvg}%` : "—"} (2026, read-only)
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <Button size="sm" onClick={onSave}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface StudentsWithDisabilitiesViewProps {
  data: StudentsWithDisabilitiesData | null | undefined;
  onChange: (next: StudentsWithDisabilitiesData) => void;
}

export function StudentsWithDisabilitiesView({ data, onChange }: StudentsWithDisabilitiesViewProps) {
  const hasSavedCurrent = !!(data?.subjects && data.subjects.length > 0);

  const [activeYear, setActiveYear] = useState<YearKey>("current");
  const [activeSubject, setActiveSubject] = useState("Biology");
  const [isEditing, setIsEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState<SwdSubject | null>(null);
  const [draftSwdLabel, setDraftSwdLabel] = useState("");

  const saved = data ?? { swdLabel: null, subjects: [], currentAsOf: null, verification: {} };
  const isHistorical = activeYear !== "current";

  // Current subjects: use saved if available, else start from 2026 template
  const currentSubjects = hasSavedCurrent ? saved.subjects : emptySubjects();

  const displaySubjects =
    activeYear === "2025" ? DUMMY_2025 :
    activeYear === "2026" ? DUMMY_2026 :
    currentSubjects;

  const displaySwdLabel =
    isHistorical ? "14% of students" : (saved.swdLabel ?? "");

  const showingBaseline = !isHistorical && !hasSavedCurrent;

  const subjectTabs = displaySubjects.map((s) => ({ key: s.label, label: s.label }));

  const verificationForYear = (year: string) =>
    saved.verification[year] ?? DUMMY_VERIFIED[year as keyof typeof DUMMY_VERIFIED] ?? { verified: false };

  function handleEdit() {
    const sub = displaySubjects.find((s) => s.label === activeSubject) ?? displaySubjects[0];
    if (!sub) return;
    setDraftSubject({ ...sub, allStudents: { ...sub.allStudents }, swd: { ...sub.swd } });
    setDraftSwdLabel(saved.swdLabel ?? "");
    setIsEditing(true);
  }

  function handleSave() {
    if (!draftSubject) return;
    const base = hasSavedCurrent ? saved.subjects : emptySubjects();
    const next = base.map((s) => (s.label === draftSubject.label ? draftSubject : s));
    onChange({
      ...saved,
      subjects: next,
      swdLabel: draftSwdLabel || null,
      currentAsOf: preserveOrSetCurrentAsOf(saved.currentAsOf),
    });
    setIsEditing(false);
  }

  function handleCancel() {
    setIsEditing(false);
  }

  function handleAddSubject() {
    const label = prompt("New subject name:");
    if (!label?.trim()) return;
    const newSub: SwdSubject = {
      label: label.trim(),
      allStudents: { school: null, stateAvg: null },
      swd: { school: null, stateAvg: null },
    };
    onChange({ ...saved, subjects: [...currentSubjects, newSub] });
    setActiveSubject(label.trim());
  }

  function toggleVerified(year: string) {
    const prev = verificationForYear(year);
    onChange({ ...saved, verification: { ...saved.verification, [year]: { verified: !prev.verified } } });
  }

  const activeSubjectData = displaySubjects.find((s) => s.label === activeSubject) ?? displaySubjects[0];

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

      {isHistorical && <ReadOnlyBanner year={activeYear} />}
      {showingBaseline && !isEditing && <BasedOnNotice />}

      {/* ── Subject tabs ────────────────────────────────────────────── */}
      <SubTabBar
        tabs={subjectTabs}
        active={activeSubject}
        onChange={(t) => {
          setActiveSubject(t);
          if (isEditing) {
            const sub = displaySubjects.find((s) => s.label === t) ?? displaySubjects[0];
            if (sub) {
              setDraftSubject({ ...sub, allStudents: { ...sub.allStudents }, swd: { ...sub.swd } });
            }
          }
        }}
        onAdd={!isHistorical ? handleAddSubject : undefined}
      />

      {/* ── Description (below subject tab) ────────────────────────── */}
      {!isEditing && (
        <ChartDescription>
          <p>
            <BoldText text={GS_COPY.swdLead(activeSubjectData?.label ?? activeSubject)} />
          </p>
        </ChartDescription>
      )}

      {/* ── Content ────────────────────────────────────────────────── */}
      {isEditing && draftSubject ? (
        <EditForm
          subject={draftSubject}
          swdLabel={draftSwdLabel}
          onSwdLabelChange={setDraftSwdLabel}
          onUpdate={setDraftSubject}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : activeSubjectData ? (
        <SubjectVisual subject={activeSubjectData} swdLabel={displaySwdLabel} />
      ) : null}
    </div>
  );
}
