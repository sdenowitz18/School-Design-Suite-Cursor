import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, Minus, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { outcomeHealthBucketForLabel } from "@/lib/outcome-health-bucket";
import { OUTCOME_SCHEMA } from "./designed-experience-schemas";
import OutcomeDetailView from "./outcome-detail-view";
import OutcomesLearnMoreView from "./outcomes-learn-more-view";
import { DrilldownNavBar } from "./drilldown-nav-bar";
import { PlainLanguageInput } from "./expert-view/PlainLanguageInput";
import { normOutcomeKey } from "./outcomes-utils";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function aimPriorityFields(p: "H" | "M" | "L") {
  return {
    overrideLevel: p,
    levelMode: "override" as const,
    level: p === "H" ? "High" : p === "M" ? "Medium" : "Low",
  };
}

/** Effective aims on a learner/adult sub for ring UI (aligns with DE: kde when non-empty, else top-level). */
export function listSubcomponentAims(sub: any): any[] {
  if (!sub) return [];
  const kdeAims = sub.keyDesignElements?.aims;
  const topAims = sub.aims;
  if (Array.isArray(kdeAims) && kdeAims.length > 0) return kdeAims;
  if (Array.isArray(topAims) && topAims.length > 0) return topAims;
  if (Array.isArray(kdeAims)) return kdeAims;
  return Array.isArray(topAims) ? topAims : [];
}

const L1_AREAS = Object.keys(OUTCOME_SCHEMA).map((key) => ({ key, label: key }));

/** When set, Manage edits this learner/adult sub's aims only (same nodeId = parent ring). */
export type DesignedExperienceManageSubScope = { flavor: "learner" | "adult"; subId: string };

export function readScopedKeyDesignAims(comp: any, manageSubScope: DesignedExperienceManageSubScope | null | undefined): any[] {
  if (!comp) return [];
  const de: any = comp.designedExperienceData || {};
  if (manageSubScope?.subId) {
    const key = manageSubScope.flavor === "adult" ? "adultSubcomponents" : "subcomponents";
    const subs: any[] = Array.isArray(de[key]) ? de[key] : [];
    const sub = subs.find((s: any) => s.id === manageSubScope.subId);
    if (!sub) return [];
    return listSubcomponentAims(sub);
  }
  const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
  return Array.isArray(kde.aims) ? kde.aims : [];
}

const PRIORITY_STYLES: Record<string, string> = {
  H: "bg-red-50 border-red-200 text-red-700",
  M: "bg-amber-50 border-amber-200 text-amber-700",
  L: "bg-green-50 border-green-200 text-green-700",
};

function PriorityPicker({
  value,
  onChange,
}: {
  value: "H" | "M" | "L" | null;
  onChange: (p: "H" | "M" | "L") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0">
      {(["H", "M", "L"] as const).map((p, i) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "px-3 py-0.5 text-[11px] font-bold transition-colors",
            i > 0 && "border-l border-gray-200",
            value === p ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
          )}
        >
          {p === "H" ? "High" : p === "M" ? "Med" : "Low"}
        </button>
      ))}
    </div>
  );
}

export interface OutcomeSummaryViewProps {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  onOpenOutcomeScore?: () => void;
  /** When opening Manage while focused on a sub-block, scope aims + saves to that sub only. */
  manageSubScope?: DesignedExperienceManageSubScope | null;
  /** First breadcrumb — full exit to Designed Experience home (same as other DE drilldown surfaces). */
  onNavigateDesignedExperienceRoot: () => void;
}

export default function OutcomeSummaryView({
  nodeId,
  title,
  onBack,
  onOpenOutcomeScore,
  manageSubScope = null,
  onNavigateDesignedExperienceRoot,
}: OutcomeSummaryViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const isOverall = String(nodeId || "") === "overall" || String((comp as any)?.nodeId || "") === "overall";
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subNotesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dontShowPrimaryWarning = useRef(
    typeof window !== "undefined" && localStorage.getItem("outcome-primary-no-modal") === "1",
  );

  const [activeL1, setActiveL1] = useState<string>(L1_AREAS[0]?.key ?? "STEM");
  const [notesByKey, setNotesByKey] = useState<Record<string, string>>({});
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [subNotesByKey, setSubNotesByKey] = useState<Record<string, Record<string, string>>>({});
  const [subNotesInitialized, setSubNotesInitialized] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<{ l2: string; l3?: string } | null>(null);
  const [showLearnMore, setShowLearnMore] = useState(false);
  // Modal: label of the primary that was auto-removed when a 3rd was set
  const [replacedPrimaryLabel, setReplacedPrimaryLabel] = useState<string | null>(null);
  const [modalDontShow, setModalDontShow] = useState(false);
  const [outcomeDescribeDraft, setOutcomeDescribeDraft] = useState("");

  const isSubManageScope = !!manageSubScope?.subId;

  const manageSubBlockName = useMemo(() => {
    if (!manageSubScope?.subId || !comp) return null;
    const de: any = (comp as any).designedExperienceData || {};
    const key = manageSubScope.flavor === "adult" ? "adultSubcomponents" : "subcomponents";
    const sub = (Array.isArray(de[key]) ? de[key] : []).find((s: any) => s.id === manageSubScope.subId);
    return sub ? String(sub.name || sub.title || "").trim() || null : null;
  }, [comp, manageSubScope]);

  // ── Derived data ───────────────────────────────────────────
  const deAims = useMemo(() => readScopedKeyDesignAims(comp, manageSubScope), [comp, manageSubScope]);

  const deOutcomes = useMemo(() => {
    return deAims.filter((a: any) => a?.type === "outcome" && typeof a?.label === "string");
  }, [deAims]);

  const savedNotes = useMemo(() => {
    const hd = (comp as any)?.healthData || {};
    const la = hd.learningAdvancementOutcomeScoreData || {};
    const wb = hd.wellbeingConductOutcomeScoreData || {};
    return { ...(la.outcomeNotes || {}), ...(wb.outcomeNotes || {}) } as Record<string, { appliesDescription?: string }>;
  }, [comp]);

  // ── Notes init ─────────────────────────────────────────────
  useEffect(() => {
    if (!comp || notesInitialized) return;
    const initial: Record<string, string> = {};
    for (const aim of deOutcomes) {
      const key = normOutcomeKey(aim.label);
      initial[key] = String(savedNotes[key]?.appliesDescription || "");
    }
    setNotesByKey(initial);
    setNotesInitialized(true);
  }, [comp, notesInitialized, savedNotes, deOutcomes]);

  useEffect(() => {
    if (!notesInitialized) return;
    const missing = deOutcomes.filter((a: any) => notesByKey[normOutcomeKey(a.label)] === undefined);
    if (!missing.length) return;
    setNotesByKey((prev) => {
      const next = { ...prev };
      for (const a of missing) {
        const key = normOutcomeKey(a.label);
        next[key] = String(savedNotes[key]?.appliesDescription || "");
      }
      return next;
    });
  }, [notesInitialized, deOutcomes, savedNotes, notesByKey]);

  const saveNotes = useCallback(
    (next: Record<string, string>) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const existing: any = (comp as any)?.healthData || {};
        const laOsd: any = existing.learningAdvancementOutcomeScoreData || {};
        const wbOsd: any = existing.wellbeingConductOutcomeScoreData || {};
        const laNotes: any = { ...(laOsd.outcomeNotes || {}) };
        const wbNotes: any = { ...(wbOsd.outcomeNotes || {}) };
        for (const [k, v] of Object.entries(next)) {
          const aim = deOutcomes.find((a: any) => normOutcomeKey(a.label) === k);
          const bucketKey = aim ? outcomeHealthBucketForLabel(String(aim.label)) : "learningAdvancementOutcomeScoreData";
          const slot = bucketKey === "wellbeingConductOutcomeScoreData" ? wbNotes : laNotes;
          slot[k] = { appliesDescription: v };
        }
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...existing,
              learningAdvancementOutcomeScoreData: { ...laOsd, outcomeNotes: laNotes },
              wellbeingConductOutcomeScoreData: { ...wbOsd, outcomeNotes: wbNotes },
            },
          },
        });
      }, 500);
    },
    [comp, deOutcomes, nodeId, updateMutation],
  );

  useEffect(() => {
    if (!notesInitialized) return;
    saveNotes(notesByKey);
  }, [notesByKey, notesInitialized, saveNotes]);

  // ── Sub-notes (per-L3) init & save ─────────────────────────
  useEffect(() => {
    if (!comp || subNotesInitialized) return;
    const initial: Record<string, Record<string, string>> = {};
    for (const aim of deOutcomes) {
      const l2Key = normOutcomeKey(aim.label);
      initial[l2Key] = { ...(aim.subNotes ?? {}) };
    }
    setSubNotesByKey(initial);
    setSubNotesInitialized(true);
  }, [comp, subNotesInitialized, deOutcomes]);

  useEffect(() => {
    if (!subNotesInitialized) return;
    const missing = deOutcomes.filter((a: any) => subNotesByKey[normOutcomeKey(a.label)] === undefined);
    if (!missing.length) return;
    setSubNotesByKey((prev) => {
      const next = { ...prev };
      for (const a of missing) {
        const l2Key = normOutcomeKey(a.label);
        next[l2Key] = { ...(a.subNotes ?? {}) };
      }
      return next;
    });
  }, [subNotesInitialized, deOutcomes, subNotesByKey]);

  // ── Selection read helpers ─────────────────────────────────
  function getAimForL2(l2Name: string): any {
    return deOutcomes.find((a: any) => norm(a.label) === norm(l2Name)) ?? null;
  }

  function isL2WholeSelected(l2Name: string): boolean {
    const aim = getAimForL2(l2Name);
    if (!aim) return false;
    return !aim.subSelections || aim.subSelections.length === 0;
  }

  function getSubSelections(l2Name: string): string[] {
    return getAimForL2(l2Name)?.subSelections ?? [];
  }

  function isL3Selected(l2Name: string, l3Name: string): boolean {
    return getSubSelections(l2Name).some((s) => norm(s) === norm(l3Name));
  }

  function hasAnySelection(l2Name: string): boolean {
    return !!getAimForL2(l2Name);
  }

  function getPriority(l2Name: string): "H" | "M" | "L" | null {
    const aim = getAimForL2(l2Name);
    if (!aim) return null;
    const ov = aim.overrideLevel;
    if (ov === "H" || ov === "M" || ov === "L") return ov;
    const lv = aim.level;
    if (lv === "High") return "H";
    if (lv === "Medium") return "M";
    if (lv === "Low") return "L";
    return null;
  }

  function getSubPriorities(l2Name: string): Record<string, "H" | "M" | "L"> {
    return getAimForL2(l2Name)?.subPriorities ?? {};
  }

  function getL3Priority(l2Name: string, l3Name: string): "H" | "M" | "L" {
    const sp = getSubPriorities(l2Name);
    return sp[l3Name] ?? "M";
  }

  function isOutcomePrimary(l2Name: string): boolean {
    return !!getAimForL2(l2Name)?.isPrimary;
  }

  function getSubPrimaries(l2Name: string): Record<string, boolean> {
    return getAimForL2(l2Name)?.subPrimaries ?? {};
  }

  function isL3Primary(l2Name: string, l3Name: string): boolean {
    return !!getSubPrimaries(l2Name)[l3Name];
  }

  // Count all primary designations: L2-level + individual L3-level
  const primaryCount = useMemo(
    () =>
      deOutcomes.reduce((count: number, a: any) => {
        const subs: string[] = a?.subSelections ?? [];
        if (subs.length === 0) return count + (a?.isPrimary ? 1 : 0);
        const sp: Record<string, boolean> = a?.subPrimaries ?? {};
        return count + subs.filter((l3) => sp[l3]).length;
      }, 0),
    [deOutcomes],
  );

  // Returns all current primaries sorted by selection time (oldest first)
  function getAllPrimaries(): { label: string; l2Name: string; l3Name?: string; timestamp: number }[] {
    const result: { label: string; l2Name: string; l3Name?: string; timestamp: number }[] = [];
    for (const a of deOutcomes) {
      const subs: string[] = a?.subSelections ?? [];
      if (subs.length === 0) {
        if (a?.isPrimary) result.push({ label: a.label, l2Name: a.label, timestamp: a.primarySelectedAt ?? 0 });
      } else {
        const sp: Record<string, boolean> = a?.subPrimaries ?? {};
        const st: Record<string, number> = a?.subPrimaryTimestamps ?? {};
        for (const l3 of subs) {
          if (sp[l3]) result.push({ label: l3, l2Name: a.label, l3Name: l3, timestamp: st[l3] ?? 0 });
        }
      }
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  // ── Mutation helpers ───────────────────────────────────────
  function writeAims(updatedAims: any[]) {
    if (!nodeId || !comp) return;
    const de: any = (comp as any).designedExperienceData || {};
    if (manageSubScope?.subId) {
      const key = manageSubScope.flavor === "adult" ? "adultSubcomponents" : "subcomponents";
      const subs: any[] = Array.isArray(de[key]) ? [...de[key]] : [];
      const idx = subs.findIndex((s: any) => s.id === manageSubScope.subId);
      if (idx < 0) return;
      const sub = subs[idx];
      const prevKde = sub.keyDesignElements || {
        aims: sub.aims || [],
        practices: sub.practices || [],
        supports: sub.supports || [],
      };
      subs[idx] = {
        ...sub,
        aims: updatedAims,
        keyDesignElements: { ...prevKde, aims: updatedAims },
      };
      updateMutation.mutate({ nodeId, data: { designedExperienceData: { ...de, [key]: subs } } });
      return;
    }
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    updateMutation.mutate({
      nodeId,
      data: { designedExperienceData: { ...de, keyDesignElements: { ...kde, aims: updatedAims } } },
    });
  }

  function addOrUpdateAim(
    l2Name: string,
    subSelections: string[],
    priority?: "H" | "M" | "L",
    subPrioritiesOverride?: Record<string, "H" | "M" | "L">,
  ) {
    if (!nodeId || !comp) return;
    const aims: any[] = readScopedKeyDesignAims(comp, manageSubScope);

    const existing = aims.find((a: any) => a?.type === "outcome" && norm(a.label) === norm(l2Name));
    const l2Whole = subSelections.length === 0;
    let nextAims: any[];
    if (existing) {
      const existingSP: Record<string, "H" | "M" | "L"> = existing.subPriorities ?? {};
      const existingPrim: Record<string, boolean> = existing.subPrimaries ?? {};
      const existingST: Record<string, number> = existing.subPrimaryTimestamps ?? {};
      const existingSAC: Record<string, string[]> = existing.subAssignedComponents ?? {};
      const existingSASub: Record<string, string[]> = existing.subAssignedSubcomponentIds ?? {};
      const preservedSP =
        subPrioritiesOverride ??
        Object.fromEntries(subSelections.map((s) => [s, existingSP[s] ?? "M"]));
      const preservedPrim = Object.fromEntries(
        subSelections.map((s) => [s, existingPrim[s]]).filter(([, v]) => v),
      );
      const preservedST = Object.fromEntries(
        subSelections.map((s) => [s, existingST[s]]).filter(([, v]) => v != null),
      );
      const preservedSAC = Object.fromEntries(
        subSelections.map((s) => [s, existingSAC[s]]).filter(([, v]) => Array.isArray(v) && v.length > 0),
      );
      const preservedSASub = Object.fromEntries(
        subSelections.map((s) => [s, existingSASub[s]]).filter(([, v]) => Array.isArray(v) && v.length > 0),
      );

      nextAims = aims.map((a: any) => {
        if (a?.type !== "outcome" || norm(a.label) !== norm(l2Name)) return a;

        if (l2Whole) {
          const p =
            priority != null
              ? priority
              : (() => {
                  const ov = a.overrideLevel;
                  if (ov === "H" || ov === "M" || ov === "L") return ov;
                  const lv = a.level;
                  if (lv === "High") return "H";
                  if (lv === "Low") return "L";
                  return "M" as const;
                })();
          return {
            ...a,
            subSelections: [],
            subPriorities: {},
            subPrimaries: {},
            subPrimaryTimestamps: {},
            subNotes: {},
            subAssignedComponents: {},
            subAssignedSubcomponentIds: {},
            overrideLevel: p,
            levelMode: "override",
            level: p === "H" ? "High" : p === "L" ? "Low" : "Medium",
          };
        }

        const next: any = {
          ...a,
          subSelections,
          subPriorities: preservedSP,
          subPrimaries: preservedPrim,
          subPrimaryTimestamps: preservedST,
          subAssignedComponents: preservedSAC,
          subAssignedSubcomponentIds: preservedSASub,
        };
        delete next.overrideLevel;
        delete next.levelMode;
        delete next.level;
        delete next.computedLevel;
        return next;
      });
    } else if (l2Whole) {
      const effP = priority ?? "M";
      nextAims = [
        ...aims,
        {
          id: `aim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: "outcome",
          label: l2Name.trim(),
          level: effP === "H" ? "High" : effP === "M" ? "Medium" : "Low",
          levelMode: "override",
          overrideLevel: effP,
          subSelections: [],
          subPriorities: {},
          assignedComponents: [],
          assignedSubcomponentIds: [],
          subAssignedSubcomponentIds: {},
        },
      ];
    } else {
      nextAims = [
        ...aims,
        {
          id: `aim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: "outcome",
          label: l2Name.trim(),
          subSelections,
          subPriorities: subPrioritiesOverride ?? Object.fromEntries(subSelections.map((s) => [s, "M"])),
          assignedComponents: [],
          assignedSubcomponentIds: [],
          subAssignedSubcomponentIds: {},
        },
      ];
    }
    writeAims(nextAims);
  }

  function removeAim(l2Name: string) {
    if (!nodeId || !comp) return;
    const aims: any[] = readScopedKeyDesignAims(comp, manageSubScope);
    writeAims(aims.filter((a: any) => !(a?.type === "outcome" && norm(a.label) === norm(l2Name))));
  }

  // ── Interaction handlers ───────────────────────────────────
  function handleL2CheckboxClick(l2Name: string) {
    if (isL2WholeSelected(l2Name)) {
      removeAim(l2Name);
    } else {
      // Either no selection or L3 selections — switch to L2 whole and clear L3s
      addOrUpdateAim(l2Name, [], getPriority(l2Name) ?? "M");
    }
  }

  function handleL3Click(l2Name: string, l3Name: string) {
    const subs = getSubSelections(l2Name);
    if (isL2WholeSelected(l2Name)) {
      // Switch from L2-whole to this L3 only: drop L2-level priority; seed this L3's priority from former L2
      addOrUpdateAim(l2Name, [l3Name], undefined, {
        [l3Name]: getPriority(l2Name) ?? "M",
      });
    } else if (isL3Selected(l2Name, l3Name)) {
      const newSubs = subs.filter((s) => norm(s) !== norm(l3Name));
      if (newSubs.length === 0) removeAim(l2Name);
      else addOrUpdateAim(l2Name, newSubs);
    } else {
      addOrUpdateAim(l2Name, [...subs, l3Name]);
    }
  }

  /** Priority for this scoped copy of the outcome (component or sub-block when managing a block). */
  function handleSetPriority(l2Name: string, p: "H" | "M" | "L") {
    addOrUpdateAim(l2Name, getSubSelections(l2Name), p);
  }

  function handleSetL3Priority(l2Name: string, l3Name: string, p: "H" | "M" | "L") {
    const subs = getSubSelections(l2Name);
    const existing = getSubPriorities(l2Name);
    const next = { ...existing, [l3Name]: p };
    addOrUpdateAim(l2Name, subs, undefined, next);
  }

  function handleSetL3Notes(l2Name: string, l3Name: string, text: string) {
    if (!nodeId || !comp) return;
    const l2Key = normOutcomeKey(l2Name);
    const nextSubNotes = { ...(subNotesByKey[l2Key] ?? {}), [l3Name]: text };
    setSubNotesByKey((prev) => ({ ...prev, [l2Key]: nextSubNotes }));
    // Debounced save to aim.subNotes in designedExperienceData
    if (subNotesTimerRef.current) clearTimeout(subNotesTimerRef.current);
    subNotesTimerRef.current = setTimeout(() => {
      const aims: any[] = readScopedKeyDesignAims(comp, manageSubScope);
      writeAims(
        aims.map((a: any) =>
          a?.type === "outcome" && norm(a.label) === norm(l2Name) ? { ...a, subNotes: nextSubNotes } : a,
        ),
      );
    }, 500);
  }

  // Remove a primary designation (L2 or L3)
  function removePrimary(l2Name: string, l3Name?: string) {
    if (!nodeId || !comp) return;
    const aims: any[] = readScopedKeyDesignAims(comp, manageSubScope);
    writeAims(
      aims.map((a: any) => {
        if (a?.type !== "outcome" || norm(a.label) !== norm(l2Name)) return a;
        if (l3Name) {
          const sp = { ...(a.subPrimaries ?? {}), [l3Name]: false };
          const st = { ...(a.subPrimaryTimestamps ?? {}) };
          delete st[l3Name];
          return { ...a, subPrimaries: sp, subPrimaryTimestamps: st };
        }
        return { ...a, isPrimary: false, primarySelectedAt: undefined };
      }),
    );
  }

  // Add a primary, auto-replacing the oldest if already at max 2
  function addPrimary(l2Name: string, l3Name?: string) {
    if (!nodeId || !comp) return;
    let aims: any[] = [...readScopedKeyDesignAims(comp, manageSubScope)];
    const now = Date.now();

    if (primaryCount >= 2) {
      const oldest = getAllPrimaries()[0];
      // Remove the oldest primary from aims
      aims = aims.map((a: any) => {
        if (a?.type !== "outcome" || norm(a.label) !== norm(oldest.l2Name)) return a;
        if (oldest.l3Name) {
          const sp = { ...(a.subPrimaries ?? {}), [oldest.l3Name]: false };
          const st = { ...(a.subPrimaryTimestamps ?? {}) };
          delete st[oldest.l3Name];
          return { ...a, subPrimaries: sp, subPrimaryTimestamps: st };
        }
        return { ...a, isPrimary: false, primarySelectedAt: undefined };
      });
      if (!dontShowPrimaryWarning.current) setReplacedPrimaryLabel(oldest.label);
    }

    // Add the new primary
    aims = aims.map((a: any) => {
      if (a?.type !== "outcome" || norm(a.label) !== norm(l2Name)) return a;
      if (l3Name) {
        return {
          ...a,
          subPrimaries: { ...(a.subPrimaries ?? {}), [l3Name]: true },
          subPrimaryTimestamps: { ...(a.subPrimaryTimestamps ?? {}), [l3Name]: now },
        };
      }
      return { ...a, isPrimary: true, primarySelectedAt: now };
    });

    writeAims(aims);
  }

  function handleTogglePrimary(l2Name: string) {
    if (isOutcomePrimary(l2Name)) removePrimary(l2Name);
    else addPrimary(l2Name);
  }

  function handleToggleL3Primary(l2Name: string, l3Name: string) {
    if (isL3Primary(l2Name, l3Name)) removePrimary(l2Name, l3Name);
    else addPrimary(l2Name, l3Name);
  }

  // ── Sub-views ──────────────────────────────────────────────
  if (showLearnMore) return <OutcomesLearnMoreView mode="schema" onBack={() => setShowLearnMore(false)} />;

  const componentName = title || (comp as any)?.title || "this component";
  const activeL1Schema = OUTCOME_SCHEMA[activeL1] ?? {};

  const outcomeDetailTitle = selectedOutcome
    ? (selectedOutcome.l3 || "").trim()
      ? String(selectedOutcome.l3).trim()
      : selectedOutcome.l2
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="outcome-summary-view">
      <DrilldownNavBar
        sectionTitle="Designed Experience"
        onNavigateSectionRoot={onNavigateDesignedExperienceRoot}
        ancestors={
          outcomeDetailTitle
            ? [{ label: "Outcomes", onNavigate: () => setSelectedOutcome(null) }]
            : []
        }
        currentTitle={outcomeDetailTitle ?? "Outcomes"}
        onBack={outcomeDetailTitle ? () => setSelectedOutcome(null) : onBack}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedOutcome ? (
          <OutcomeDetailView
            nodeId={nodeId}
            title={title}
            outcomeLabel={selectedOutcome.l2}
            l3OutcomeLabel={selectedOutcome.l3}
            onBack={() => setSelectedOutcome(null)}
            onOpenOutcomeScore={onOpenOutcomeScore}
            hideTopBack
          />
        ) : (
          <div className="max-w-5xl mx-auto p-6 pb-16 space-y-5">
      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Manage Outcomes</h2>
            {(title || (comp as any)?.title) && (
              <p className="text-sm text-gray-500 mt-0.5">{title || (comp as any)?.title}</p>
            )}
            {isSubManageScope && manageSubBlockName && (
              <p className="text-xs text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-2.5 py-1.5 mt-2">
                Block: <span className="font-semibold">{manageSubBlockName}</span> — outcomes here are only for this
                block. They don&apos;t change the ring-level outcome list.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-gray-500"
              onClick={() => setShowLearnMore(true)}
            >
              <BookOpen className="w-3.5 h-3.5 mr-1" />
              Learn more
            </Button>
            {onOpenOutcomeScore && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onOpenOutcomeScore}>
                Open Outcomes Score
              </Button>
            )}
          </div>
        </div>

        <div className="px-5 py-2.5 text-xs text-gray-500 border-b border-gray-100">
          Select outcomes below, then add priority and notes for each. Double-click any outcome name to view its full
          detail page. Linking outcomes to other ring components or sub-blocks is done from each component&apos;s Manage
          view for now.
        </div>

        {/* Selected outcomes summary chips — one chip per actual selection (L2 or L3) */}
        {deOutcomes.length > 0 ? (
          <div className="px-5 py-3 flex flex-wrap gap-1.5">
            {deOutcomes.flatMap((a: any) => {
              const subs: string[] = a.subSelections ?? [];
              if (subs.length === 0) {
                const p = getPriority(a.label);
                const primary = !!a.isPrimary;
                return [(
                  <span
                    key={a.id}
                    className={cn(
                      "inline-flex items-center gap-1 pl-1.5 pr-2.5 py-1 border rounded-full text-[11px] font-medium",
                      primary ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-800",
                    )}
                  >
                    {!isOverall && (
                      <button
                        type="button"
                        onClick={() => handleTogglePrimary(a.label)}
                        title={primary ? "Remove primary" : "Set as primary"}
                        className="shrink-0 p-0.5 rounded transition-colors hover:opacity-70"
                      >
                        <Star className={cn("w-3 h-3", primary ? "fill-amber-500 text-amber-500" : "text-gray-300")} />
                      </button>
                    )}
                    {a.label}
                    {p && <span className={cn("text-[9px] font-bold px-1 rounded border", PRIORITY_STYLES[p])}>{p}</span>}
                  </span>
                )];
              }
              const subPrimaries: Record<string, boolean> = a.subPrimaries ?? {};
              const subPriorities: Record<string, "H" | "M" | "L"> = a.subPriorities ?? {};
              return subs.map((l3) => {
                const primary = !!subPrimaries[l3];
                const p = subPriorities[l3] ?? null;
                return (
                  <span
                    key={`${a.id}:${l3}`}
                    className={cn(
                      "inline-flex items-center gap-1 pl-1.5 pr-2.5 py-1 border rounded-full text-[11px] font-medium",
                      primary ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-800",
                    )}
                  >
                    {!isOverall && (
                      <button
                        type="button"
                        onClick={() => handleToggleL3Primary(a.label, l3)}
                        title={primary ? "Remove primary" : "Set as primary"}
                        className="shrink-0 p-0.5 rounded transition-colors hover:opacity-70"
                      >
                        <Star className={cn("w-3 h-3", primary ? "fill-amber-500 text-amber-500" : "text-gray-300")} />
                      </button>
                    )}
                    {l3}
                    {p && <span className={cn("text-[9px] font-bold px-1 rounded border", PRIORITY_STYLES[p])}>{p}</span>}
                  </span>
                );
              });
            })}
          </div>
        ) : (
          <div className="px-5 py-3 text-xs text-gray-400 italic">
            No outcomes selected yet — use the tabs below to add some.
          </div>
        )}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Describe outcomes for this component</h2>
        <p className="text-xs text-gray-500">
          Write or record in plain language, then map to outcomes below — same pattern as learner experience. Actions are
          indicative only until AI mapping is wired.
        </p>
        <PlainLanguageInput
          value={outcomeDescribeDraft}
          onChange={setOutcomeDescribeDraft}
          indicativeOnly
          showGenerateSummary
          placeholder="e.g. We prioritize algebra readiness, critical thinking in seminars, and attendance culture for this component…"
        />
      </section>

      {/* L1 category tabs */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {L1_AREAS.map((area) => {
              const l2s = Object.keys(OUTCOME_SCHEMA[area.key] ?? {});
              const selectedCount = l2s.reduce((total, l2) => {
                if (isL2WholeSelected(l2)) return total + 1;
                return total + getSubSelections(l2).length;
              }, 0);
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
                  {selectedCount > 0 && (
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                        activeL1 === area.key ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700",
                      )}
                    >
                      {selectedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* L2 sections */}
      <div className="space-y-2.5">
        {Object.entries(activeL1Schema).map(([l2Name, l3Items]) => {
          const l2Whole = isL2WholeSelected(l2Name);
          const subs = getSubSelections(l2Name);
          const hasSelection = hasAnySelection(l2Name);
          const hasL3s = (l3Items as string[]).length > 0;
          const priority = hasSelection ? getPriority(l2Name) : null;
          const notesKey = normOutcomeKey(l2Name);
          const notesValue = notesByKey[notesKey] ?? "";
          // isPrimary only relevant when L2 whole is selected (not L3 mode)
          const isPrimary = l2Whole && !isOverall && isOutcomePrimary(l2Name);

          return (
            <div
              key={l2Name}
              className={cn(
                "bg-white border rounded-xl shadow-sm overflow-hidden transition-colors",
                isPrimary ? "border-amber-300" : hasSelection ? "border-blue-200" : "border-gray-200",
              )}
            >
              {/* L2 header row */}
              <div className="px-4 py-3 flex items-center gap-3">
                {/* Selection checkbox */}
                <button
                  type="button"
                  aria-label={`Select ${l2Name}`}
                  onClick={() => handleL2CheckboxClick(l2Name)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    l2Whole
                      ? "bg-blue-600 border-blue-600"
                      : subs.length > 0
                        ? "bg-white border-blue-400"
                        : "bg-white border-gray-300 hover:border-blue-400",
                  )}
                >
                  {l2Whole && <Check className="w-3 h-3 text-white" />}
                  {!l2Whole && subs.length > 0 && <Minus className="w-3 h-3 text-blue-500" />}
                </button>

                {/* Name — double-click → detail view */}
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onDoubleClick={() => {
                    if (l2Whole) setSelectedOutcome({ l2: l2Name });
                  }}
                  title={l2Whole ? "Double-click to open full details" : "Open details from a specific area below"}
                >
                  <div className={cn("text-sm font-semibold leading-snug", hasSelection ? "text-gray-900" : "text-gray-700")}>
                    {l2Name}
                  </div>
                  {l2Whole && <div className="text-[11px] text-blue-500 mt-0.5">All areas</div>}
                  {subs.length > 0 && (
                    <div className="text-[11px] text-blue-500 mt-0.5">
                      {subs.length} area{subs.length !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </button>

                {/* Priority badge — L2 whole only; L3-specific priorities show on each sub-area row */}
                {l2Whole && priority && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] h-5 px-1.5 shrink-0 font-bold", PRIORITY_STYLES[priority])}
                  >
                    {priority}
                  </Badge>
                )}

                {/* Primary star — ring components only, L2 whole selected only */}
                {l2Whole && !isOverall && (
                  <button
                    type="button"
                    onClick={() => handleTogglePrimary(l2Name)}
                    title={isPrimary ? "Remove as primary outcome" : "Set as primary outcome"}
                    className={cn(
                      "shrink-0 p-1 rounded transition-colors",
                      isPrimary ? "text-amber-500 hover:text-amber-600" : "text-gray-300 hover:text-amber-400",
                    )}
                  >
                    <Star className={cn("w-4 h-4", isPrimary && "fill-amber-500")} />
                  </button>
                )}

                {/* Details arrow — L2-whole only; L3 selections use per-area Details */}
                {hasSelection && l2Whole && (
                  <button
                    type="button"
                    onClick={() => setSelectedOutcome({ l2: l2Name })}
                    className="text-[11px] text-gray-400 hover:text-blue-600 transition-colors shrink-0 flex items-center gap-0.5"
                  >
                    Details
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

              </div>

              {/* L3 chips — always visible when this L2 has areas in the schema */}
              {hasL3s && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="pt-3">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Select specific areas
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(l3Items as string[]).map((l3Name) => {
                        const l3Sel = isL3Selected(l2Name, l3Name);
                        const l3p = l3Sel ? getL3Priority(l2Name, l3Name) : null;
                        const dimmed = l2Whole;
                        return (
                          <span
                            key={l3Name}
                            className={cn(
                              "inline-flex items-center rounded-full border text-[11px] font-medium transition-colors",
                              l3Sel
                                ? "bg-blue-50 border-blue-300 text-blue-700"
                                : dimmed
                                  ? "bg-gray-50 border-gray-200 text-gray-400"
                                  : "bg-white border-gray-200 text-gray-600",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => handleL3Click(l2Name, l3Name)}
                              className="pl-2.5 pr-1.5 py-1 flex items-center gap-1 hover:opacity-80 transition-opacity"
                            >
                              {l3Sel && <Check className="w-3 h-3 shrink-0" />}
                              {l3Name}
                              {l3p && (
                                <span className={cn("text-[9px] font-bold px-1 rounded border ml-0.5", PRIORITY_STYLES[l3p])}>
                                  {l3p}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedOutcome({ l2: l2Name, l3: l3Name })}
                              title={`View details for "${l3Name}"`}
                              className="pr-1.5 py-1 text-gray-300 hover:text-blue-500 transition-colors"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    {l2Whole && (
                      <p className="text-[10px] text-gray-400 mt-2 italic">
                        Click a specific area to switch from "all areas" to targeted selection
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Inline details panel — shown when any selection exists */}
              {hasSelection && (
                <div className="border-t border-blue-100 bg-blue-50/25 px-4 py-4 space-y-4">
                  {l2Whole ? (
                    /* ── L2 whole selected: one priority + one notes block + ring push ── */
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-gray-600 shrink-0 w-14">Priority</span>
                        <PriorityPicker value={priority} onChange={(p) => handleSetPriority(l2Name, p)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-gray-600">
                          How this applies to {componentName}
                        </Label>
                        <Textarea
                          value={notesValue}
                          onChange={(e) => {
                            const v = e.currentTarget?.value ?? "";
                            setNotesByKey((prev) => ({ ...prev, [notesKey]: v }));
                          }}
                          placeholder="Describe how this outcome applies in this component…"
                          className="text-xs min-h-[64px] bg-white resize-none"
                        />
                      </div>
                    </>
                  ) : subs.length > 0 ? (
                    /* ── L3s selected: one block per selected area, each with its own ring push ── */
                    <div className="space-y-3">
                      {subs.map((l3Name) => {
                        const l2Key = normOutcomeKey(l2Name);
                        const l3Notes = subNotesByKey[l2Key]?.[l3Name] ?? "";
                        const l3Primary = !isOverall && isL3Primary(l2Name, l3Name);
                        return (
                          <div
                            key={l3Name}
                            className={cn(
                              "rounded-lg border bg-white px-3 py-3 space-y-2",
                              l3Primary ? "border-amber-300" : "border-blue-100",
                            )}
                          >
                            {/* L3 name + primary star + priority + details link */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[12px] font-semibold text-gray-800 flex-1 min-w-0">
                                {l3Primary && <Star className="w-3 h-3 fill-amber-500 text-amber-500 inline mr-1" />}
                                {l3Name}
                              </span>
                              {!isOverall && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleL3Primary(l2Name, l3Name)}
                                  title={l3Primary ? "Remove as primary outcome" : "Set as primary outcome"}
                                  className={cn(
                                    "shrink-0 p-0.5 rounded transition-colors",
                                    l3Primary ? "text-amber-500 hover:text-amber-600" : "text-gray-300 hover:text-amber-400",
                                  )}
                                >
                                  <Star className={cn("w-3.5 h-3.5", l3Primary && "fill-amber-500")} />
                                </button>
                              )}
                              <PriorityPicker
                                value={getL3Priority(l2Name, l3Name)}
                                onChange={(p) => handleSetL3Priority(l2Name, l3Name, p)}
                              />
                              <button
                                type="button"
                                onClick={() => setSelectedOutcome({ l2: l2Name, l3: l3Name })}
                                className="text-[11px] text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 shrink-0"
                              >
                                Details
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Per-L3 notes */}
                            <Textarea
                              value={l3Notes}
                              onChange={(e) => handleSetL3Notes(l2Name, l3Name, e.currentTarget?.value ?? "")}
                              placeholder={`How does "${l3Name}" apply here?`}
                              className="text-xs min-h-[56px] bg-gray-50 resize-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
          </div>
        )}
      </div>

      {/* Primary-replaced modal */}
      {replacedPrimaryLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Primary outcome replaced</h3>
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-medium">"{replacedPrimaryLabel}"</span> was removed as a primary outcome because you already had 2 primaries selected. Only 2 can be primary at a time.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={modalDontShow}
                onChange={(e) => setModalDontShow(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-xs text-gray-500">Don't show this message again</span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (modalDontShow) {
                  localStorage.setItem("outcome-primary-no-modal", "1");
                  dontShowPrimaryWarning.current = true;
                }
                setReplacedPrimaryLabel(null);
                setModalDontShow(false);
              }}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
