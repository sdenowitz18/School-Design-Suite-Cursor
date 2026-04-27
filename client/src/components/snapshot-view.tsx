import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Users,
  X,
  Check,
  Star,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { OUTCOME_SCHEMA, LEAP_SCHEMA } from "./designed-experience-schemas";
import { LEARNER_SECTIONS } from "./learner-design-schema";
import { ADULT_ROLE_SECTIONS } from "./adult-design-schema";

// ─── Helpers ────────────────────────────────────────────────────────────────

const Section = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-4 pt-6 first:pt-0", className)}>
    <h3 className="text-base font-semibold text-gray-900 border-b pb-2 flex items-center justify-between">
      {title}
    </h3>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const FieldGroup = ({ label, helper, children, required, className }: { label: string; helper?: string; children: React.ReactNode; required?: boolean; className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <div className="flex items-center justify-between">
      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
    </div>
    {children}
    {helper && <p className="text-xs text-gray-400">{helper}</p>}
  </div>
);

// ─── Outcome helpers ────────────────────────────────────────────────────────
//
// Outcome primary IDs use one of two formats:
//   - `${L1}::${L2}`        → an L2-whole primary (the entire L2 domain)
//   - `${L1}::${L2}::${L3}` → an L3-specific primary (a single L3 area)
//
// They are kept bidirectionally in sync with `keyDesignElements.aims`:
//   - Aim with empty subSelections + isPrimary=true → L2-whole primary
//   - Aim with subSelections + subPrimaries[L3]=true → L3-specific primary

const L1_AREAS = Object.keys(OUTCOME_SCHEMA).map((key) => ({ key, label: key }));

const norm = (s: string) => (s || "").trim().toLowerCase();

function findL1ByL2(l2Label: string): string | null {
  const target = norm(l2Label);
  for (const [l1, domains] of Object.entries(OUTCOME_SCHEMA)) {
    for (const domain of Object.keys(domains)) {
      if (norm(domain) === target) return l1;
    }
  }
  return null;
}

function findL1L2ByL3(l3Label: string): { l1: string; l2: string } | null {
  const target = norm(l3Label);
  for (const [l1, domains] of Object.entries(OUTCOME_SCHEMA)) {
    for (const [l2, l3s] of Object.entries(domains)) {
      for (const l3 of l3s) {
        if (norm(l3) === target) return { l1, l2 };
      }
    }
  }
  return null;
}

function parseOutcomeId(id: string): { l1: string; l2: string; l3?: string } {
  const parts = id.split("::");
  return { l1: parts[0] ?? "", l2: parts[1] ?? "", l3: parts[2] };
}

function outcomeIdLabel(id: string): string {
  const p = parseOutcomeId(id);
  return p.l3 || p.l2;
}

function outcomeIdL1(id: string): string {
  return parseOutcomeId(id).l1;
}

// ─── LEAP helpers ───────────────────────────────────────────────────────────

const CORE_LEAPS: string[] = Object.values(LEAP_SCHEMA).flat();

// ─── Priority helpers ───────────────────────────────────────────────────────

type PriorityLevel = "H" | "M" | "L";

function priorityFields(p: PriorityLevel) {
  const levelMap = { H: "High", M: "Medium", L: "Low" } as const;
  return { overrideLevel: p, level: levelMap[p], levelMode: "override" as const };
}

function PriorityPicker({
  value,
  onChange,
  size = "sm",
}: {
  value: PriorityLevel | null;
  onChange: (p: PriorityLevel) => void;
  size?: "xs" | "sm";
}) {
  const cls = size === "xs"
    ? "px-1.5 py-0 text-[9px]"
    : "px-2 py-0.5 text-[10px]";
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white shrink-0">
      {(["H", "M", "L"] as const).map((p, i) => (
        <button
          key={p}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(p); }}
          className={cn(
            cls,
            "font-bold transition-colors leading-tight",
            i > 0 && "border-l border-gray-200",
            value === p ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ─── Specific times constants (matching A4Bucket) ───────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RECURRENCE_OPTIONS = ["Daily", "Weekly", "Bi-weekly", "Monthly"];

// ─── Grade band helpers ─────────────────────────────────────────────────────

const GRADE_BAND_BUCKET = LEARNER_SECTIONS[0]?.buckets.find((b) => b.id === "grade_band");
const GRADE_BAND_PRIMARIES = (GRADE_BAND_BUCKET?.primaries ?? []).map((p) => {
  if (p.id === "grade_preschool") return { ...p, secondaries: undefined };
  return p;
});

interface GradeBandLine {
  id: string;
  participation: "required" | "optional" | "targeted";
  gating: string;
}

interface GradeBandEntry {
  gradeBandId: string;
  secondaryId?: string;
  isKey?: boolean;
  lines: GradeBandLine[];
}

let _lineIdCounter = 0;
const genLineId = () => `gl_${Date.now()}_${++_lineIdCounter}`;

// ─── Selection gating options ───────────────────────────────────────────────

const GATING_OPTIONS = [
  { value: "universal", label: "Universal (all students)" },
  { value: "open_opt_in", label: "Open opt-in" },
  { value: "course_prerequisites", label: "Course pre-requisites" },
  { value: "high_perf_invite", label: "High-performance-based invitation / honors" },
  { value: "low_perf_invite", label: "Low-performance-based invitation / remediation" },
  { value: "specific_populations", label: "For specific populations (ELLs, IEPs, etc.)" },
];

// ─── Adult role helpers ─────────────────────────────────────────────────────

const ADULT_ROLES = ADULT_ROLE_SECTIONS[0]?.buckets[0]?.primaries ?? [];

interface AdultInvolved {
  roleId: string;
  names: string;
}

// ─── Specific time entry ────────────────────────────────────────────────────

interface SpecificTimeEntry {
  id: string;
  days: string[];
  time: string;
  recurrence: string;
  notes: string;
}

let _timeIdCounter = 0;
const genTimeId = () => `st_${Date.now()}_${++_timeIdCounter}`;

// ─── Main component ─────────────────────────────────────────────────────────

interface SnapshotViewProps {
  nodeId?: string;
  title?: string;
  color?: string;
  /** When rendering for a subcomponent, pass its id — data is read/written within the parent's DE subcomponents array. */
  subcomponentId?: string;
}

export default function SnapshotView({ nodeId, title, color, subcomponentId }: SnapshotViewProps) {
  const { data: componentData, isLoading } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();

  // ── Type of experience ──
  const [experienceType, setExperienceType] = useState<"adult" | "learner" | "">("");
  const [primaryAdultGroup, setPrimaryAdultGroup] = useState<string>("");

  // ── Description ──
  const [description, setDescription] = useState("");
  const [showHelper, setShowHelper] = useState(false);

  // ── Targeted impact (up to 2 primary outcome ids synced with DE aims) ──
  const [primaryOutcomeIds, setPrimaryOutcomeIds] = useState<string[]>([]);
  const [outcomeLevels, setOutcomeLevels] = useState<Record<string, PriorityLevel>>({});
  const [activeL1, setActiveL1] = useState(L1_AREAS[0]?.key ?? "");
  const [selectedLeaps, setSelectedLeaps] = useState<string[]>([]);
  const [leapLevels, setLeapLevels] = useState<Record<string, PriorityLevel>>({});
  const [customPrinciples, setCustomPrinciples] = useState<string[]>([]);
  const [principleLevels, setPrincipleLevels] = useState<Record<string, PriorityLevel>>({});
  const [newPrincipleText, setNewPrincipleText] = useState("");

  // ── Inline collapsible state for outcomes & LEAPs pickers ──
  const [outcomePickerOpen, setOutcomePickerOpen] = useState(false);
  const [leapPickerOpen, setLeapPickerOpen] = useState(false);

  // ── Confirmation modal for 3rd outcome ──
  const [replaceConfirm, setReplaceConfirm] = useState<{ pendingId: string; existingIds: string[] } | null>(null);

  // ── Who's involved: Students ──
  const [gradeBandEntries, setGradeBandEntries] = useState<GradeBandEntry[]>([]);
  const [amountStudents, setAmountStudents] = useState("0");
  const [amountClassrooms, setAmountClassrooms] = useState("0");

  // ── Who's involved: Adults ──
  const [adultsInvolved, setAdultsInvolved] = useState<AdultInvolved[]>([]);

  // ── Time model ──
  const [durationValue, setDurationValue] = useState("");
  const [durationUnit, setDurationUnit] = useState("min");
  const [frequencyValue, setFrequencyValue] = useState("");
  const [frequencyUnit, setFrequencyUnit] = useState("per week");
  const [specificTimes, setSpecificTimes] = useState<SpecificTimeEntry[]>([]);

  // ── Collapsible state ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`openSections_${nodeId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { students: true, adults: true, time_model: true };
  });
  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(`openSections_${nodeId}`, JSON.stringify(next));
      return next;
    });
  };

  // Guard: skip auto-save until initial hydration is complete
  const hydratedRef = useRef(false);
  useEffect(() => { hydratedRef.current = false; }, [nodeId, subcomponentId]);

  // ── Resolve data source: top-level component vs embedded subcomponent ──
  const resolveData = useCallback((): { s: any; de: any } => {
    if (!componentData) return { s: {}, de: {} };
    if (subcomponentId) {
      const parentDE = (componentData as any).designedExperienceData || {};
      const allSubs: any[] = [...(parentDE.subcomponents || []), ...(parentDE.adultSubcomponents || [])];
      const sub = allSubs.find((sc: any) => sc.id === subcomponentId);
      if (!sub) return { s: {}, de: {} };
      return { s: sub.snapshotData || {}, de: sub };
    }
    return { s: (componentData as any).snapshotData || {}, de: (componentData as any).designedExperienceData || {} };
  }, [componentData, subcomponentId]);

  // ── Hydrate from server ──
  useEffect(() => {
    if (!componentData) return;
    const { s, de } = resolveData();

    setDescription(s.description || "");

    // Experience type
    const savedAudience = de?.experienceAudience;
    if (savedAudience === "adult" || savedAudience === "learner") {
      setExperienceType(savedAudience);
    } else {
      setExperienceType("");
    }
    setPrimaryAdultGroup(s.primaryAdultGroup || "");

    // Primary outcomes — read from DE aims, supporting both L2-whole and L3-specific primaries.
    const aims: any[] = de?.keyDesignElements?.aims ?? [];
    const ids: string[] = [];
    const oLevels: Record<string, PriorityLevel> = {};
    for (const aim of aims) {
      if (!aim || aim.type !== "outcome") continue;
      const l2 = String(aim.label || "").trim();
      if (!l2) continue;
      const l1 = findL1ByL2(l2);
      if (!l1) continue;
      const subs: string[] = Array.isArray(aim.subSelections) ? aim.subSelections : [];
      const subPrimaries: Record<string, boolean> = aim.subPrimaries ?? {};
      const subPriorities: Record<string, string> = aim.subPriorities ?? {};

      if (subs.length === 0) {
        if (aim.isPrimary === true) {
          const id = `${l1}::${l2}`;
          ids.push(id);
          const lvl = aim.overrideLevel as PriorityLevel | undefined;
          if (lvl === "H" || lvl === "M" || lvl === "L") oLevels[id] = lvl;
        }
      } else {
        for (const l3 of subs) {
          if (subPrimaries[l3] === true) {
            const id = `${l1}::${l2}::${l3}`;
            ids.push(id);
            const sub = subPriorities[l3];
            if (sub === "H" || sub === "M" || sub === "L") {
              oLevels[id] = sub as PriorityLevel;
            } else {
              const lvl = aim.overrideLevel as PriorityLevel | undefined;
              if (lvl === "H" || lvl === "M" || lvl === "L") oLevels[id] = lvl;
            }
          }
        }
      }
    }
    setPrimaryOutcomeIds(ids);
    setOutcomeLevels(oLevels);

    // LEAPs and custom design principles — read from DE aims
    const leapAims = aims.filter((a: any) => a.type === "leap");
    const coreSelected: string[] = [];
    const customs: string[] = [];
    const leapLvls: Record<string, PriorityLevel> = {};
    const principleLvls: Record<string, PriorityLevel> = {};
    for (const la of leapAims) {
      const label = String(la.label || "").trim();
      if (!label) continue;
      const lvl = la.overrideLevel as PriorityLevel | undefined;
      if (CORE_LEAPS.includes(label)) {
        coreSelected.push(label);
        if (lvl === "H" || lvl === "M" || lvl === "L") leapLvls[label] = lvl;
      } else {
        customs.push(label);
        if (lvl === "H" || lvl === "M" || lvl === "L") principleLvls[label] = lvl;
      }
    }
    setSelectedLeaps(coreSelected);
    setLeapLevels(leapLvls);
    setCustomPrinciples(customs);
    setPrincipleLevels(principleLvls);

    // Grade bands — prefer snapshotData, but fall back to learnersProfile selections.
    // Either way, merge isKey from learnersProfile.selections so the two stay in sync.
    {
      const lpSels: any[] = de?.learnersProfile?.selections ?? [];
      const lpKeyMap = new Map<string, { primaryKey: boolean; secKeys: Record<string, boolean> }>();
      for (const sel of lpSels) {
        const pid = String(sel.primaryId || "");
        if (!GRADE_BAND_PRIMARIES.some((p) => p.id === pid)) continue;
        lpKeyMap.set(pid, {
          primaryKey: !!sel.isKey,
          secKeys: sel.secondaryKeys ?? {},
        });
      }

      if (Array.isArray(s.gradeBandEntries) && s.gradeBandEntries.length > 0) {
        const merged = (s.gradeBandEntries as GradeBandEntry[]).map((entry) => {
          const info = lpKeyMap.get(entry.gradeBandId);
          if (!info) return entry;
          const lpIsKey = entry.secondaryId ? !!info.secKeys[entry.secondaryId] : info.primaryKey;
          if (lpIsKey !== !!entry.isKey) return { ...entry, isKey: lpIsKey };
          return entry;
        });
        setGradeBandEntries(merged);
      } else {
        const migrated: GradeBandEntry[] = [];
        for (const sel of lpSels) {
          const pid = String(sel.primaryId || "");
          const match = GRADE_BAND_PRIMARIES.find((p) => p.id === pid);
          if (!match) continue;
          const secIds: string[] = Array.isArray(sel.secondaryIds) ? sel.secondaryIds : [];
          const info = lpKeyMap.get(pid);
          if (secIds.length === 0) {
            migrated.push({ gradeBandId: pid, isKey: !!info?.primaryKey, lines: [{ id: genLineId(), participation: "required", gating: "universal" }] });
          } else {
            for (const sid of secIds) {
              migrated.push({ gradeBandId: pid, secondaryId: sid, isKey: !!info?.secKeys[sid], lines: [{ id: genLineId(), participation: "required", gating: "universal" }] });
            }
          }
        }
        setGradeBandEntries(migrated);
      }
    }
    setAmountStudents(s.amountStudents || "0");
    setAmountClassrooms(s.amountClassrooms || "0");

    // Adults involved — always merge from adultsProfile.selections so that roles
    // selected on the DE Adults tab are visible here even if snapshotData was
    // previously saved with an empty array.
    {
      const snapAdults: AdultInvolved[] = Array.isArray(s.adultsInvolved) ? s.adultsInvolved : [];
      const adultSels: any[] = de?.adultsProfile?.selections ?? [];
      const sliceDetail: Record<string, any> = de?.adultsProfile?.sliceDetail ?? {};
      const merged = new Map<string, string>();
      for (const ai of snapAdults) merged.set(ai.roleId, ai.names);
      for (const sel of adultSels) {
        const rid = sel.primaryId;
        if (!merged.has(rid)) {
          merged.set(rid, sliceDetail[rid]?.name?.text || "");
        }
      }
      const result: AdultInvolved[] = [];
      merged.forEach((names, roleId) => result.push({ roleId, names }));
      setAdultsInvolved(result);
    }

    // Time model — read from elementsExpertData.schedule if available
    const schedData = de?.elementsExpertData?.schedule ?? {};
    const dur = schedData["schedule-q1__duration"]?.archetypeA3;
    const freq = schedData["schedule-q1__frequency"]?.archetypeA3;
    setDurationValue(dur?.value != null ? String(dur.value) : s.durationValue || "");
    setDurationUnit(dur?.unit || s.durationUnit || "min");
    setFrequencyValue(freq?.value != null ? String(freq.value) : s.frequencyValue || "");
    setFrequencyUnit(freq?.unit || s.frequencyUnit || "per week");

    const times = schedData["schedule-q1__specific-times"]?.archetypeA4;
    if (times && Array.isArray(times.days)) {
      setSpecificTimes([{
        id: genTimeId(),
        days: times.days,
        time: times.time || "",
        recurrence: times.recurrence || "",
        notes: times.notes || "",
      }]);
    } else if (Array.isArray(s.specificTimes) && s.specificTimes.length > 0) {
      setSpecificTimes(s.specificTimes.map((st: any) => ({
        ...st,
        days: Array.isArray(st.days) ? st.days : (typeof st.days === "string" ? st.days.split(",").map((d: string) => d.trim()).filter(Boolean) : []),
        notes: st.notes || "",
      })));
    } else {
      setSpecificTimes([]);
    }

    // Mark hydration complete so auto-save can start
    requestAnimationFrame(() => { hydratedRef.current = true; });
  }, [componentData]);

  // ── Save ──
  const save = useCallback(() => {
    if (!nodeId) return;

    const { s: existingSnap, de: existingDE } = resolveData();

    // Build snapshot data
    const snapshotData = {
      ...existingSnap,
      description,
      primaryAdultGroup,
      gradeBandEntries,
      amountStudents,
      amountClassrooms,
      adultsInvolved,
      durationValue,
      durationUnit,
      frequencyValue,
      frequencyUnit,
      specificTimes,
    };

    // Sync primary outcomes to DE aims, supporting L2-whole and L3-specific primaries.
    const kde = existingDE.keyDesignElements || {};
    let aims: any[] = Array.isArray(kde.aims) ? [...kde.aims] : [];

    // Group primary IDs by L2 label so we can write each aim correctly.
    type Group = {
      l1: string;
      l2: string;
      l2Primary: boolean;
      l2Level?: PriorityLevel;
      l3Primaries: Record<string, PriorityLevel | true>;
    };
    const byL2: Map<string, Group> = new Map();
    for (const id of primaryOutcomeIds) {
      const { l1, l2, l3 } = parseOutcomeId(id);
      if (!l1 || !l2) continue;
      const key = norm(l2);
      const g = byL2.get(key) ?? { l1, l2, l2Primary: false, l3Primaries: {} };
      const lvl = outcomeLevels[id];
      if (l3) {
        g.l3Primaries[l3] = lvl ?? true;
      } else {
        g.l2Primary = true;
        if (lvl) g.l2Level = lvl;
      }
      byL2.set(key, g);
    }

    // Clear all primary flags on outcome aims first (preserve subSelections).
    aims = aims.map((a: any) => {
      if (a?.type !== "outcome") return a;
      return {
        ...a,
        isPrimary: false,
        primarySelectedAt: undefined,
        subPrimaries: {},
        subPrimaryTimestamps: {},
      };
    });

    // Apply each group to its aim (creating if missing).
    const now = Date.now();
    let groupOffset = 0;
    byL2.forEach((g) => {
      const idx = aims.findIndex(
        (a: any) => a?.type === "outcome" && norm(a.label || "") === norm(g.l2),
      );
      const baseAim: any = idx >= 0 ? { ...aims[idx] } : {
        id: `snap_outcome_${g.l2.replace(/[^a-zA-Z0-9]/g, "_")}`,
        type: "outcome",
        label: g.l2,
        notes: "",
        selected: true,
      };

      let subSelections: string[] = Array.isArray(baseAim.subSelections) ? [...baseAim.subSelections] : [];
      let subPriorities: Record<string, string> = { ...(baseAim.subPriorities ?? {}) };
      const subPrimaries: Record<string, boolean> = {};
      const subPrimaryTimestamps: Record<string, number> = {};

      // L3-specific primaries: ensure each L3 is in subSelections and marked primary.
      const l3Keys = Object.keys(g.l3Primaries);
      for (const l3 of l3Keys) {
        if (!subSelections.includes(l3)) subSelections.push(l3);
        subPrimaries[l3] = true;
        subPrimaryTimestamps[l3] = now + groupOffset++;
        const lvl = g.l3Primaries[l3];
        if (lvl !== true) subPriorities[l3] = lvl;
      }

      const newAim: any = {
        ...baseAim,
        label: g.l2,
      };

      if (g.l2Primary) {
        // L2-whole primary: OutcomeSummaryView's count logic only treats isPrimary as
        // meaningful when subSelections is empty, so clear them here. This is the user's
        // explicit choice to mark the entire L2 domain as primary.
        newAim.subSelections = [];
        newAim.subPriorities = {};
        newAim.subPrimaries = {};
        newAim.subPrimaryTimestamps = {};
        newAim.isPrimary = true;
        newAim.primarySelectedAt = now + groupOffset++;
        if (g.l2Level) Object.assign(newAim, priorityFields(g.l2Level));
      } else {
        newAim.subSelections = subSelections;
        newAim.subPriorities = subPriorities;
        newAim.subPrimaries = subPrimaries;
        newAim.subPrimaryTimestamps = subPrimaryTimestamps;
        newAim.isPrimary = false;
        newAim.primarySelectedAt = undefined;
      }

      if (idx >= 0) aims[idx] = newAim;
      else aims.push(newAim);
    });

    // Sync LEAPs and custom design principles to DE aims, preserving notes if present.
    const existingLeapAims: any[] = aims.filter((a: any) => a.type === "leap");
    aims = aims.filter((a: any) => a.type !== "leap");
    for (const label of selectedLeaps) {
      const existing = existingLeapAims.find((a: any) => norm(a.label) === norm(label));
      const lvl = leapLevels[label];
      const next: any = {
        ...(existing || {
          id: `leap_${label.replace(/[^a-zA-Z0-9]/g, "_")}`,
          notes: "",
          selected: true,
        }),
        type: "leap",
        label,
      };
      if (lvl) Object.assign(next, priorityFields(lvl));
      aims.push(next);
    }
    for (const label of customPrinciples) {
      const existing = existingLeapAims.find((a: any) => norm(a.label) === norm(label));
      const lvl = principleLevels[label];
      const next: any = {
        ...(existing || {
          id: `principle_${label.replace(/[^a-zA-Z0-9]/g, "_")}`,
          notes: "",
          selected: true,
        }),
        type: "leap",
        label,
      };
      if (lvl) Object.assign(next, priorityFields(lvl));
      aims.push(next);
    }

    // Sync adults to adultsProfile
    const existingAdultsProfile = existingDE.adultsProfile || {};
    const existingSelections: any[] = existingAdultsProfile.selections || [];
    const existingSliceDetail: Record<string, any> = existingAdultsProfile.sliceDetail || {};

    // Build new selections from adultsInvolved, preserving existing secondary data
    const newSelections = adultsInvolved.map((ai) => {
      const existing = existingSelections.find((s: any) => s.primaryId === ai.roleId);
      return existing || { primaryId: ai.roleId };
    });

    // Build new sliceDetail, preserving existing data and updating names
    const newSliceDetail: Record<string, any> = { ...existingSliceDetail };
    for (const ai of adultsInvolved) {
      newSliceDetail[ai.roleId] = {
        ...(newSliceDetail[ai.roleId] || {}),
        name: { text: ai.names, isKey: false },
      };
    }

    // Sync time model to schedule expert data
    const existingExpert = existingDE.elementsExpertData || {};
    const existingSched = existingExpert.schedule || {};
    const newSched = { ...existingSched };

    if (durationValue) {
      newSched["schedule-q1__duration"] = {
        ...(existingSched["schedule-q1__duration"] || {}),
        archetypeA3: {
          value: Number(durationValue) || null,
          unit: durationUnit,
          description: "",
          isKey: false,
        },
      };
    }
    if (frequencyValue) {
      newSched["schedule-q1__frequency"] = {
        ...(existingSched["schedule-q1__frequency"] || {}),
        archetypeA3: {
          value: Number(frequencyValue) || null,
          unit: frequencyUnit,
          description: "",
          isKey: false,
        },
      };
    }
    if (specificTimes.length > 0) {
      const first = specificTimes[0];
      newSched["schedule-q1__specific-times"] = {
        ...(existingSched["schedule-q1__specific-times"] || {}),
        archetypeA4: {
          days: first.days,
          time: first.time,
          recurrence: first.recurrence,
          notes: first.notes || "",
          isKey: false,
        },
      };
    }

    // Sync students/classrooms to schedule expert data
    if (amountStudents || amountClassrooms) {
      newSched["schedule-q1__number-of-classrooms-and-students"] = {
        ...(existingSched["schedule-q1__number-of-classrooms-and-students"] || {}),
        archetypeA3Pair: {
          first: { value: Number(amountClassrooms) || null, unit: "classrooms", description: "", isKey: false },
          second: { value: Number(amountStudents) || null, unit: "students", description: "", isKey: false },
          isKey: false,
        },
      };
    }

    // Sync grade band entries to learnersProfile.selections
    const existingLearnerProfile = existingDE.learnersProfile || {};
    const existingLearnerSels: any[] = existingLearnerProfile.selections || [];

    // Build learner selections from grade band entries, grouping by gradeBandId
    // and syncing isKey / secondaryKeys from gradeBandEntries.
    const gradeBandMap = new Map<string, { secIds: string[]; isKeyPrimary: boolean; secKeys: Record<string, boolean> }>();
    for (const entry of gradeBandEntries) {
      const existing = gradeBandMap.get(entry.gradeBandId) || { secIds: [], isKeyPrimary: false, secKeys: {} };
      if (entry.secondaryId) {
        existing.secIds.push(entry.secondaryId);
        if (entry.isKey) existing.secKeys[entry.secondaryId] = true;
      } else {
        if (entry.isKey) existing.isKeyPrimary = true;
      }
      gradeBandMap.set(entry.gradeBandId, existing);
    }
    // Preserve non-grade-band selections from learner profile
    const nonGradeBandSels = existingLearnerSels.filter((sel: any) => {
      return !GRADE_BAND_PRIMARIES.some((p) => p.id === sel.primaryId);
    });
    const newLearnerSels = [...nonGradeBandSels];
    gradeBandMap.forEach((info, primaryId) => {
      const existingSel = existingLearnerSels.find((s: any) => s.primaryId === primaryId);
      const hasSecKeys = Object.keys(info.secKeys).length > 0;
      newLearnerSels.push({
        ...(existingSel || {}),
        primaryId,
        secondaryIds: info.secIds.length > 0 ? info.secIds : undefined,
        isKey: info.secIds.length === 0 ? info.isKeyPrimary : false,
        secondaryKeys: hasSecKeys ? info.secKeys : undefined,
      });
    });

    const designedExperienceData = {
      ...existingDE,
      ...(experienceType ? { experienceAudience: experienceType } : {}),
      keyDesignElements: { ...kde, aims },
      adultsProfile: {
        ...existingAdultsProfile,
        selections: newSelections,
        sliceDetail: newSliceDetail,
      },
      learnersProfile: {
        ...existingLearnerProfile,
        selections: newLearnerSels,
      },
      elementsExpertData: {
        ...existingExpert,
        schedule: newSched,
      },
    };

    if (subcomponentId) {
      const parentDE = (componentData as any)?.designedExperienceData || {};
      const updateSub = (arr: any[] | undefined): any[] =>
        (arr || []).map((sc: any) =>
          sc.id === subcomponentId
            ? { ...sc, ...designedExperienceData, snapshotData }
            : sc,
        );
      const newParentDE = {
        ...parentDE,
        subcomponents: updateSub(parentDE.subcomponents),
        adultSubcomponents: updateSub(parentDE.adultSubcomponents),
      };
      updateMutation.mutate({ nodeId, data: { designedExperienceData: newParentDE } });
    } else {
      updateMutation.mutate({ nodeId, data: { snapshotData, designedExperienceData } });
    }
  }, [
    nodeId, subcomponentId, description, experienceType, primaryAdultGroup, primaryOutcomeIds,
    outcomeLevels, selectedLeaps, leapLevels, customPrinciples, principleLevels,
    gradeBandEntries, amountStudents, amountClassrooms, adultsInvolved,
    durationValue, durationUnit, frequencyValue, frequencyUnit, specificTimes,
    componentData, resolveData,
  ]);

  // Auto-save on change (skipped until hydration is complete)
  useEffect(() => {
    if (!nodeId || !componentData || !hydratedRef.current) return;
    const timer = setTimeout(() => save(), 1000);
    return () => clearTimeout(timer);
  }, [
    description, experienceType, primaryAdultGroup, primaryOutcomeIds,
    outcomeLevels, selectedLeaps, leapLevels, customPrinciples, principleLevels,
    gradeBandEntries, amountStudents, amountClassrooms, adultsInvolved,
    durationValue, durationUnit, frequencyValue, frequencyUnit, specificTimes,
  ]);

  // ── Outcome picker helpers (inline, operates on real state) ──
  const toggleOutcome = (id: string) => {
    if (primaryOutcomeIds.includes(id)) {
      setPrimaryOutcomeIds((prev) => prev.filter((x) => x !== id));
      setOutcomeLevels((lv) => { const next = { ...lv }; delete next[id]; return next; });
      return;
    }
    const target = parseOutcomeId(id);
    const filtered = primaryOutcomeIds.filter((existing) => {
      const e = parseOutcomeId(existing);
      if (norm(e.l2) !== norm(target.l2)) return true;
      return target.l3 ? !!e.l3 : false;
    });
    if (filtered.length >= 2) {
      setReplaceConfirm({ pendingId: id, existingIds: [...filtered] });
      return;
    }
    setPrimaryOutcomeIds([...filtered, id]);
  };

  const confirmReplace = (removeId: string) => {
    if (!replaceConfirm) return;
    const kept = replaceConfirm.existingIds.filter((x) => x !== removeId);
    setPrimaryOutcomeIds([...kept, replaceConfirm.pendingId]);
    setOutcomeLevels((lv) => { const next = { ...lv }; delete next[removeId]; return next; });
    setReplaceConfirm(null);
  };

  const setOutcomeLevel = (id: string, lvl: PriorityLevel) => {
    setOutcomeLevels((prev) => ({ ...prev, [id]: lvl }));
  };

  // ── LEAPs & Design Principles helpers (inline, operates on real state) ──
  const toggleLeap = (label: string) => {
    if (selectedLeaps.includes(label)) {
      setSelectedLeaps((prev) => prev.filter((l) => l !== label));
      setLeapLevels((lv) => { const next = { ...lv }; delete next[label]; return next; });
    } else {
      setSelectedLeaps((prev) => [...prev, label]);
    }
  };

  const addPrinciple = () => {
    const name = newPrincipleText.trim();
    if (!name || customPrinciples.includes(name)) return;
    setCustomPrinciples((prev) => [...prev, name]);
    setNewPrincipleText("");
  };

  const removePrinciple = (label: string) => {
    setCustomPrinciples((prev) => prev.filter((p) => p !== label));
    setPrincipleLevels((lv) => { const next = { ...lv }; delete next[label]; return next; });
  };

  const setLeapLevel = (label: string, lvl: PriorityLevel) => {
    setLeapLevels((prev) => ({ ...prev, [label]: lvl }));
  };

  const setPrincipleLevel = (label: string, lvl: PriorityLevel) => {
    setPrincipleLevels((prev) => ({ ...prev, [label]: lvl }));
  };

  // ── Grade band helpers ──
  const addGradeBand = (gradeBandId: string, secondaryId?: string) => {
    const exists = gradeBandEntries.some(
      (e) => e.gradeBandId === gradeBandId && e.secondaryId === secondaryId,
    );
    if (exists) return;

    setGradeBandEntries((prev) => {
      let next = [...prev];
      if (secondaryId) {
        // Selecting a specific grade removes the parent "all" entry for that band
        next = next.filter(
          (e) => !(e.gradeBandId === gradeBandId && !e.secondaryId),
        );
      } else {
        // Selecting the parent "all" removes all individual grades for that band
        next = next.filter((e) => e.gradeBandId !== gradeBandId);
      }
      return [
        ...next,
        { gradeBandId, secondaryId, lines: [{ id: genLineId(), participation: "required", gating: "universal" }] },
      ];
    });
  };

  const removeGradeBand = (gradeBandId: string, secondaryId?: string) => {
    setGradeBandEntries((prev) =>
      prev.filter((e) => !(e.gradeBandId === gradeBandId && e.secondaryId === secondaryId)),
    );
  };

  const addLine = (entryIdx: number) => {
    setGradeBandEntries((prev) => {
      const next = [...prev];
      next[entryIdx] = {
        ...next[entryIdx],
        lines: [...next[entryIdx].lines, { id: genLineId(), participation: "required", gating: "universal" }],
      };
      return next;
    });
  };

  const updateLine = (entryIdx: number, lineIdx: number, patch: Partial<GradeBandLine>) => {
    setGradeBandEntries((prev) => {
      const next = [...prev];
      const entry = { ...next[entryIdx] };
      const lines = [...entry.lines];
      lines[lineIdx] = { ...lines[lineIdx], ...patch };
      entry.lines = lines;
      next[entryIdx] = entry;
      return next;
    });
  };

  const removeLine = (entryIdx: number, lineIdx: number) => {
    setGradeBandEntries((prev) => {
      const next = [...prev];
      const entry = { ...next[entryIdx] };
      entry.lines = entry.lines.filter((_, i) => i !== lineIdx);
      next[entryIdx] = entry;
      return next;
    });
  };

  const toggleGradeBandKey = (entryIdx: number) => {
    setGradeBandEntries((prev) => {
      const next = [...prev];
      next[entryIdx] = { ...next[entryIdx], isKey: !next[entryIdx].isKey };
      return next;
    });
  };

  // ── Adults helpers ──
  const toggleAdult = (roleId: string) => {
    setAdultsInvolved((prev) => {
      if (prev.some((a) => a.roleId === roleId)) {
        return prev.filter((a) => a.roleId !== roleId);
      }
      return [...prev, { roleId, names: "" }];
    });
  };

  const updateAdultNames = (roleId: string, names: string) => {
    setAdultsInvolved((prev) =>
      prev.map((a) => (a.roleId === roleId ? { ...a, names } : a)),
    );
  };

  // ── Label helpers ──
  const gradeBandLabel = (gradeBandId: string, secondaryId?: string): string => {
    const primary = GRADE_BAND_PRIMARIES.find((p) => p.id === gradeBandId);
    if (!primary) return gradeBandId;
    if (secondaryId) {
      const sec = primary.secondaries?.find((s) => s.id === secondaryId);
      return sec?.label || secondaryId;
    }
    return primary.label;
  };

  const adultRoleLabel = (roleId: string): string => {
    return ADULT_ROLES.find((r) => r.id === roleId)?.label || roleId;
  };

  // ── Grade band selector ──
  const [gradeBandPickerOpen, setGradeBandPickerOpen] = useState(false);
  const [expandedBands, setExpandedBands] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">Loading component data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 px-6 md:px-10">
      {/* ── Description ── */}
      <div className="py-6 space-y-4">
        <div className="space-y-3">
          <div className="relative group">
            <Textarea
              placeholder="In 1–3 sentences, what is this component and why does it exist?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px] text-lg text-gray-600 border-none px-0 shadow-none focus-visible:ring-0 leading-relaxed bg-transparent -ml-1 p-1 resize-y"
              data-testid="input-description"
            />
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600" onClick={() => setShowHelper(!showHelper)}>
                {showHelper ? "Hide prompts" : "Helper prompts"}
              </Button>
            </div>
            {showHelper && (
              <div className="bg-blue-50/50 p-3 rounded-md text-xs text-blue-800 space-y-1 mt-2 border border-blue-100">
                <p>• What should students reliably get from this?</p>
                <p>• How does it differ from current/previous practice?</p>
              </div>
            )}
          </div>

        </div>
      </div>

      <Separator className="mb-6" />

      <div className="grid grid-cols-1 gap-6">
        {/* ══════════════════════════════════════════════════════════════════
           § Type of Experience
        ══════════════════════════════════════════════════════════════════ */}
        <Section title="Type of Experience">
          <div className="space-y-4">
            <FieldGroup label="Type of Experience">
              <Select
                value={experienceType || "__placeholder__"}
                onValueChange={(v) => {
                  const val = v === "__placeholder__" ? "" : (v as "adult" | "learner");
                  setExperienceType(val);
                  if (val !== "adult") setPrimaryAdultGroup("");
                }}
              >
                <SelectTrigger className="w-full h-9 bg-white border-gray-200" data-testid="select-experience-type">
                  <SelectValue placeholder="Select type of experience..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__placeholder__" disabled className="text-gray-400">Select type of experience...</SelectItem>
                  <SelectItem value="adult">Adult Experience</SelectItem>
                  <SelectItem value="learner">Learner Experience</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>

            {experienceType === "adult" && (
              <FieldGroup label="Primary Adult Group">
                <Select value={primaryAdultGroup || "__placeholder__"} onValueChange={(v) => setPrimaryAdultGroup(v === "__placeholder__" ? "" : v)}>
                  <SelectTrigger className="w-full h-9 bg-white border-gray-200" data-testid="select-primary-adult-group">
                    <SelectValue placeholder="Select primary adult group..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__placeholder__" disabled className="text-gray-400">Select primary adult group...</SelectItem>
                    <SelectItem value="educators">Educators</SelectItem>
                    <SelectItem value="caregivers_families">Caregivers and Families</SelectItem>
                    <SelectItem value="school_leaders_administrators">School Leadership and Administrators</SelectItem>
                    <SelectItem value="student_support_wellbeing_staff">School Support and Well-Being Staff</SelectItem>
                    <SelectItem value="school_operations_support_staff">School Operations and Support Staff</SelectItem>
                    <SelectItem value="district_leaders_staff">District Leadership and Staff</SelectItem>
                    <SelectItem value="other_adults">Other Adults</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>
            )}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
           § Targeted Impact
        ══════════════════════════════════════════════════════════════════ */}
        <Section title="Targeted Impact">
          <p className="text-xs text-gray-500 -mt-2">
            Primary outcomes, LEAPs, and design principles. Synced with the Designed Experience tab.
          </p>

          {/* ── Primary Outcomes ── */}
          <FieldGroup label="Primary Outcomes">
            {primaryOutcomeIds.length > 0 && !outcomePickerOpen && (
              <div className="flex flex-wrap gap-2 mb-2">
                {primaryOutcomeIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium"
                  >
                    <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                    {outcomeIdLabel(id)}
                    <PriorityPicker
                      value={outcomeLevels[id] ?? null}
                      onChange={(p) => setOutcomeLevel(id, p)}
                      size="xs"
                    />
                  </span>
                ))}
              </div>
            )}
            {primaryOutcomeIds.length === 0 && !outcomePickerOpen && (
              <p className="text-xs text-gray-400 italic mb-2">No primary outcomes selected.</p>
            )}

            {!outcomePickerOpen ? (
              <button
                type="button"
                onClick={() => setOutcomePickerOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 px-2.5 py-1.5 rounded-md border border-dashed border-blue-300 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {primaryOutcomeIds.length > 0 ? "Edit Primary Outcomes" : "Add Primary Outcomes"}
              </button>
            ) : (
              <div className="border border-blue-200 rounded-xl bg-white shadow-sm">
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Select up to 2 primary outcomes</span>
                    {primaryOutcomeIds.length > 0 && (
                      <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                        {primaryOutcomeIds.length}/2 selected
                      </span>
                    )}
                  </div>

                  {/* L1 category tabs */}
                  <div className="overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-max">
                      {L1_AREAS.map((area) => {
                        const count = primaryOutcomeIds.filter((id) => outcomeIdL1(id) === area.key).length;
                        return (
                          <button
                            key={area.key}
                            type="button"
                            onClick={() => setActiveL1(area.key)}
                            className={cn(
                              "px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5",
                              activeL1 === area.key
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900",
                            )}
                          >
                            {area.label}
                            {count > 0 && (
                              <span className={cn(
                                "min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center",
                                activeL1 === area.key ? "bg-blue-600 text-white" : "bg-emerald-100 text-emerald-700",
                              )}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* L2 / L3 cards */}
                  <div className="space-y-2">
                    {Object.entries(OUTCOME_SCHEMA[activeL1] ?? {}).map(([l2Name, l3Items]) => {
                      const l2Id = `${activeL1}::${l2Name}`;
                      const isL2Selected = primaryOutcomeIds.includes(l2Id);
                      const l3List = l3Items as string[];
                      const selectedL3s = primaryOutcomeIds.filter((id) => {
                        const p = parseOutcomeId(id);
                        return norm(p.l2) === norm(l2Name) && !!p.l3;
                      });
                      const hasL3Primary = selectedL3s.length > 0;
                      const anySelected = isL2Selected || hasL3Primary;

                      return (
                        <div
                          key={l2Name}
                          className={cn(
                            "border rounded-lg overflow-hidden transition-colors",
                            anySelected ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200 bg-white",
                          )}
                        >
                          <div className="px-3 py-2.5 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleOutcome(l2Id)}
                              className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                isL2Selected
                                  ? "bg-emerald-600 border-emerald-600"
                                  : "bg-white border-gray-300 hover:border-emerald-400",
                              )}
                            >
                              {isL2Selected && <Check className="w-3 h-3 text-white" />}
                            </button>
                            <span className={cn("text-sm font-semibold flex-1", anySelected ? "text-gray-900" : "text-gray-700")}>
                              {l2Name}
                              {hasL3Primary && (
                                <span className="ml-2 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                  {selectedL3s.length} area{selectedL3s.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </span>
                            {isL2Selected && <Star className="w-4 h-4 fill-emerald-500 text-emerald-500 shrink-0" />}
                          </div>

                          {l3List.length > 0 && (
                            <div className="px-3 pb-3 border-t border-gray-100">
                              <div className="pt-2">
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                  Specific areas
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {l3List.map((l3Name) => {
                                    const l3Id = `${activeL1}::${l2Name}::${l3Name}`;
                                    const isL3Primary = primaryOutcomeIds.includes(l3Id);
                                    return (
                                      <button
                                        key={l3Name}
                                        type="button"
                                        onClick={() => toggleOutcome(l3Id)}
                                        className={cn(
                                          "text-[11px] px-2 py-0.5 rounded-full border transition-colors inline-flex items-center gap-1",
                                          isL3Primary
                                            ? "bg-emerald-100 border-emerald-400 text-emerald-800 font-medium"
                                            : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer",
                                        )}
                                      >
                                        {isL3Primary && <Star className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />}
                                        {l3Name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end px-3 pb-3">
                  <Button size="sm" onClick={() => setOutcomePickerOpen(false)}>Save</Button>
                </div>
              </div>
            )}
          </FieldGroup>

          {/* ── LEAPs & Design Principles ── */}
          <FieldGroup label="LEAPs & Design Principles">
            {(selectedLeaps.length > 0 || customPrinciples.length > 0) && !leapPickerOpen && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedLeaps.map((leap) => (
                  <span
                    key={leap}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium"
                  >
                    {leap}
                    <PriorityPicker
                      value={leapLevels[leap] ?? null}
                      onChange={(p) => setLeapLevel(leap, p)}
                      size="xs"
                    />
                  </span>
                ))}
                {customPrinciples.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-xs font-medium"
                  >
                    {p}
                    <PriorityPicker
                      value={principleLevels[p] ?? null}
                      onChange={(lvl) => setPrincipleLevel(p, lvl)}
                      size="xs"
                    />
                  </span>
                ))}
              </div>
            )}
            {(selectedLeaps.length === 0 && customPrinciples.length === 0) && !leapPickerOpen && (
              <p className="text-xs text-gray-400 italic mb-2">No LEAPs or design principles selected.</p>
            )}

            {!leapPickerOpen ? (
              <button
                type="button"
                onClick={() => setLeapPickerOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 px-2.5 py-1.5 rounded-md border border-dashed border-blue-300 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {(selectedLeaps.length + customPrinciples.length) > 0 ? "Edit LEAPs & Design Principles" : "Add LEAPs & Design Principles"}
              </button>
            ) : (
              <div className="border border-blue-200 rounded-xl bg-white shadow-sm">
                <div className="p-3 space-y-4">
                  {/* Core LEAPs */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LEAPs</h4>
                    <div className="flex flex-wrap gap-2">
                      {CORE_LEAPS.map((leap) => {
                        const isSelected = selectedLeaps.includes(leap);
                        return (
                          <span
                            key={leap}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer",
                              isSelected
                                ? "bg-amber-50 border-amber-300 text-amber-800"
                                : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50",
                            )}
                          >
                            <button type="button" onClick={() => toggleLeap(leap)} className="inline-flex items-center gap-1.5">
                              {isSelected && <Check className="w-3 h-3" />}
                              {leap}
                            </button>
                            {isSelected && (
                              <PriorityPicker
                                value={leapLevels[leap] ?? null}
                                onChange={(p) => setLeapLevel(leap, p)}
                                size="xs"
                              />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Design Principles */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Design Principles</h4>
                    {customPrinciples.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {customPrinciples.map((p) => (
                          <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-xs font-medium">
                            {p}
                            <PriorityPicker
                              value={principleLevels[p] ?? null}
                              onChange={(lvl) => setPrincipleLevel(p, lvl)}
                              size="xs"
                            />
                            <button type="button" onClick={() => removePrinciple(p)} className="text-purple-400 hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newPrincipleText}
                        onChange={(e) => setNewPrincipleText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPrinciple(); } }}
                        placeholder="Add a design principle..."
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addPrinciple}
                        disabled={!newPrincipleText.trim()}
                        className="h-8 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end px-3 pb-3">
                  <Button size="sm" onClick={() => setLeapPickerOpen(false)}>Save</Button>
                </div>
              </div>
            )}
          </FieldGroup>
        </Section>

        {/* ── Replace-outcome confirmation modal (only modal that remains) ── */}
        <Dialog open={!!replaceConfirm} onOpenChange={(open) => { if (!open) setReplaceConfirm(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Replace a Primary Outcome?
              </DialogTitle>
              <DialogDescription>
                You already have 2 primary outcomes. Adding <strong>{replaceConfirm ? outcomeIdLabel(replaceConfirm.pendingId) : ""}</strong> requires removing one. Which would you like to replace?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {replaceConfirm?.existingIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => confirmReplace(id)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors text-sm flex items-center justify-between group"
                >
                  <span className="font-medium text-gray-700 group-hover:text-red-700">{outcomeIdLabel(id)}</span>
                  <span className="text-xs text-gray-400 group-hover:text-red-500">Replace this</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setReplaceConfirm(null)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════
           § Who's Involved
        ══════════════════════════════════════════════════════════════════ */}
        <Section title="Who's Involved?">
          {/* ── Students ── */}
          <Collapsible open={openSections.students !== false} onOpenChange={() => toggleSection("students")}>
            <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700">Students</span>
                    {gradeBandEntries.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-100 text-blue-700">
                        {gradeBandEntries.length} grade band{gradeBandEntries.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-4">
                  {/* Counts */}
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Total Students">
                      <Input
                        value={amountStudents}
                        onChange={(e) => setAmountStudents(e.target.value)}
                        className="h-9 bg-white font-medium"
                        data-testid="input-amount-students"
                      />
                    </FieldGroup>
                    <FieldGroup label="Classrooms">
                      <Input
                        value={amountClassrooms}
                        onChange={(e) => setAmountClassrooms(e.target.value)}
                        className="h-9 bg-white font-medium"
                      />
                    </FieldGroup>
                  </div>

                  <Separator />

                  {/* Grade band selector */}
                  <FieldGroup label="Grade Bands" helper="Select grade bands and define participation for each.">
                    <div className="space-y-3">
                      {/* Add grade band picker */}
                      <Collapsible open={gradeBandPickerOpen} onOpenChange={setGradeBandPickerOpen}>
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                            <Plus className="w-3 h-3" /> Add grade band
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg space-y-1">
                            {GRADE_BAND_PRIMARIES.map((primary) => {
                              const hasSec = primary.secondaries && primary.secondaries.length > 0;
                              const isExpanded = !!expandedBands[primary.id];
                              const primaryAlreadySelected = gradeBandEntries.some(
                                (e) => e.gradeBandId === primary.id && !e.secondaryId,
                              );
                              const anyChildSelected = hasSec && primary.secondaries!.some((sec) =>
                                gradeBandEntries.some((e) => e.gradeBandId === primary.id && e.secondaryId === sec.id),
                              );
                              const isActive = primaryAlreadySelected || anyChildSelected;
                              return (
                                <div key={primary.id} className="rounded-md">
                                  <div className="flex items-center gap-1">
                                    {hasSec && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedBands((prev) => ({ ...prev, [primary.id]: !prev[primary.id] }))}
                                        className="p-0.5 text-gray-400 hover:text-gray-600"
                                      >
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (hasSec) {
                                          if (primaryAlreadySelected) {
                                            removeGradeBand(primary.id);
                                          } else {
                                            addGradeBand(primary.id);
                                          }
                                          setExpandedBands((prev) => ({ ...prev, [primary.id]: true }));
                                        } else if (primaryAlreadySelected) {
                                          removeGradeBand(primary.id);
                                        } else {
                                          addGradeBand(primary.id);
                                        }
                                      }}
                                      className={cn(
                                        "text-xs font-medium px-2 py-1 rounded transition-colors inline-flex items-center gap-1",
                                        isActive
                                          ? "text-blue-700 bg-blue-50"
                                          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer",
                                      )}
                                    >
                                      {primaryAlreadySelected && <Check className="w-3 h-3" />}
                                      {primary.label}
                                      {anyChildSelected && !primaryAlreadySelected && (
                                        <span className="text-[9px] text-blue-600 bg-blue-100 px-1 rounded-full">
                                          {primary.secondaries!.filter((sec) =>
                                            gradeBandEntries.some((e) => e.gradeBandId === primary.id && e.secondaryId === sec.id),
                                          ).length}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                  {hasSec && isExpanded && (
                                    <div className="ml-7 flex flex-wrap gap-1.5 py-1.5">
                                      {primary.secondaries!.map((sec) => {
                                        const already = gradeBandEntries.some(
                                          (e) => e.gradeBandId === primary.id && e.secondaryId === sec.id,
                                        );
                                        return (
                                          <button
                                            key={sec.id}
                                            type="button"
                                            onClick={() => already
                                              ? removeGradeBand(primary.id, sec.id)
                                              : addGradeBand(primary.id, sec.id)}
                                            className={cn(
                                              "text-[11px] px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1",
                                              already
                                                ? "bg-blue-100 border-blue-400 text-blue-800 hover:bg-blue-200"
                                                : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 cursor-pointer",
                                            )}
                                          >
                                            {already && <Check className="w-2.5 h-2.5" />}
                                            {sec.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Selected grade bands */}
                      {gradeBandEntries.map((entry, entryIdx) => (
                        <div key={`${entry.gradeBandId}-${entry.secondaryId || "all"}`} className={cn("border rounded-lg bg-white p-3 space-y-2", entry.isKey ? "border-amber-300 bg-amber-50/30" : "border-gray-200")}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleGradeBandKey(entryIdx)}
                                title={entry.isKey ? "Unmark as Key" : "Mark as Key"}
                                className={cn(
                                  "shrink-0 transition-colors",
                                  entry.isKey ? "text-amber-500" : "text-gray-300 hover:text-amber-400",
                                )}
                              >
                                <Star className={cn("w-4 h-4", entry.isKey && "fill-amber-500")} />
                              </button>
                              <span className="text-sm font-medium text-gray-800">
                                {gradeBandLabel(entry.gradeBandId, entry.secondaryId)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeGradeBand(entry.gradeBandId, entry.secondaryId)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {entry.lines.map((line, lineIdx) => (
                            <div key={line.id} className="flex items-center gap-2 pl-2">
                              <Select
                                value={line.participation}
                                onValueChange={(v) => updateLine(entryIdx, lineIdx, { participation: v as any })}
                              >
                                <SelectTrigger className="h-7 text-xs bg-gray-50 border-gray-200 w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="required">Required</SelectItem>
                                  <SelectItem value="optional">Optional</SelectItem>
                                  <SelectItem value="targeted">Targeted</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={line.gating}
                                onValueChange={(v) => updateLine(entryIdx, lineIdx, { gating: v })}
                              >
                                <SelectTrigger className="h-7 text-xs bg-gray-50 border-gray-200 flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GATING_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {entry.lines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLine(entryIdx, lineIdx)}
                                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addLine(entryIdx)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium pl-2"
                          >
                            <Plus className="w-3 h-3" /> Add line
                          </button>
                        </div>
                      ))}
                    </div>
                  </FieldGroup>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* ── Adults Involved ── */}
          <Collapsible open={openSections.adults !== false} onOpenChange={() => toggleSection("adults")}>
            <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-semibold text-gray-700">Adults Involved</span>
                    {adultsInvolved.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-violet-100 text-violet-700">
                        {adultsInvolved.length}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  {/* Role toggle pills */}
                  <div className="flex flex-wrap gap-2">
                    {ADULT_ROLES.map((role) => {
                      const isSelected = adultsInvolved.some((a) => a.roleId === role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => toggleAdult(role.id)}
                          className={cn(
                            "text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
                            isSelected
                              ? "bg-violet-50 border-violet-300 text-violet-800"
                              : "bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50",
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                          {role.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Names for each selected role */}
                  {adultsInvolved.map((ai) => (
                    <div key={ai.roleId} className="border border-gray-200 rounded-lg bg-white p-3 space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {adultRoleLabel(ai.roleId)} — Names
                      </label>
                      <Input
                        value={ai.names}
                        onChange={(e) => updateAdultNames(ai.roleId, e.target.value)}
                        placeholder="Add names (e.g. Ms. Smith, Mr. Jones)..."
                        className="h-8 text-sm bg-gray-50"
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
           § Time Model
        ══════════════════════════════════════════════════════════════════ */}
        <Section title="Time Model">
          <p className="text-xs text-gray-500 -mt-2">
            Duration, frequency, and specific meeting times. Synced with the Schedule &amp; Use of Time design element.
          </p>
          <div className="space-y-4">
            {/* Duration & Frequency combined */}
            <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Duration &amp; Frequency</h4>
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Duration">
                  <div className="flex items-center gap-2">
                    <Input
                      value={durationValue}
                      onChange={(e) => setDurationValue(e.target.value)}
                      placeholder="e.g. 50"
                      className="h-8 text-xs bg-gray-50 w-20"
                    />
                    <Select value={durationUnit} onValueChange={setDurationUnit}>
                      <SelectTrigger className="h-8 text-xs bg-gray-50 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="min">minutes</SelectItem>
                        <SelectItem value="hrs">hours</SelectItem>
                        <SelectItem value="days">days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </FieldGroup>
                <FieldGroup label="Frequency">
                  <div className="flex items-center gap-2">
                    <Input
                      value={frequencyValue}
                      onChange={(e) => setFrequencyValue(e.target.value)}
                      placeholder="e.g. 5"
                      className="h-8 text-xs bg-gray-50 w-20"
                    />
                    <Select value={frequencyUnit} onValueChange={setFrequencyUnit}>
                      <SelectTrigger className="h-8 text-xs bg-gray-50 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per day">per day</SelectItem>
                        <SelectItem value="per week">per week</SelectItem>
                        <SelectItem value="per month">per month</SelectItem>
                        <SelectItem value="per quarter">per quarter</SelectItem>
                        <SelectItem value="per year">per year</SelectItem>
                        <SelectItem value="overall student experience">overall</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </FieldGroup>
              </div>
            </div>

            {/* Specific times — matches A4Bucket design from Schedule & Use of Time */}
            <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Specific Times</h4>
                {specificTimes.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setSpecificTimes([{ id: genTimeId(), days: [], time: "", recurrence: "", notes: "" }])}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus className="w-3 h-3" /> Add schedule
                  </button>
                )}
              </div>

              {specificTimes.length === 0 && (
                <p className="text-xs text-gray-400 italic">No specific times set.</p>
              )}

              {specificTimes.map((entry, idx) => (
                <div key={entry.id} className="space-y-4">
                  {/* Days of week — toggle buttons */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Days of the week</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS.map((day) => {
                        const isActive = entry.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const next = [...specificTimes];
                              const nextDays = isActive
                                ? entry.days.filter((d) => d !== day)
                                : [...entry.days, day];
                              next[idx] = { ...entry, days: nextDays };
                              setSpecificTimes(next);
                            }}
                            className={cn(
                              "w-10 h-10 rounded-full text-xs font-medium border transition-colors",
                              isActive
                                ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                                : "bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50",
                            )}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time of day */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Time of day</p>
                    <input
                      type="time"
                      value={entry.time}
                      onChange={(e) => {
                        const next = [...specificTimes];
                        next[idx] = { ...entry, time: e.target.value };
                        setSpecificTimes(next);
                      }}
                      className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white text-gray-700"
                    />
                  </div>

                  {/* Recurrence — pill buttons */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Recurrence</p>
                    <div className="flex gap-2 flex-wrap">
                      {RECURRENCE_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const next = [...specificTimes];
                            next[idx] = { ...entry, recurrence: entry.recurrence === opt ? "" : opt };
                            setSpecificTimes(next);
                          }}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-full border transition-colors",
                            entry.recurrence === opt
                              ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                              : "bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50",
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <textarea
                    value={entry.notes}
                    onChange={(e) => {
                      const next = [...specificTimes];
                      next[idx] = { ...entry, notes: e.target.value };
                      setSpecificTimes(next);
                    }}
                    placeholder="Additional notes on timing (optional)..."
                    rows={2}
                    className="w-full text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white"
                  />

                  {/* Remove button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSpecificTimes((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
