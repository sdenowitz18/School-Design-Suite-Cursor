"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Maximize2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { scoreBgCls } from "@/lib/score-threshold-colors";
// LEAP_DESCRIPTIONS removed — leaps panel now shows name + priority only
import {
  adultSliceKeysFromSelections,
  formatAdultSliceTitle,
} from "./adult-design-schema";
import { isLeapAimActive, isTargetingAimActive } from "@shared/aim-selection";
import { ALL_ELEMENTS } from "@/components/expert-view/expert-view-schema";
import type { BucketDef, BucketValue, TagDef } from "@/components/expert-view/expert-view-types";

export { scoreBgCls };

// ─── Window type registry ─────────────────────────────────────────────────────

export type DataWindowKey =
  | "keyDrivers"
  | "leaps"
  | "outcomes"
  | "subcomponents"
  | "practices"
  | "tools"
  | "snapshot"
  | "embedded";

export const DATA_WINDOWS: { key: DataWindowKey; label: string }[] = [
  { key: "keyDrivers", label: "Key Drivers" },
  { key: "leaps", label: "Leaps" },
  { key: "outcomes", label: "Targeted Outcomes" },
  { key: "subcomponents", label: "Subcomponents" },
  { key: "practices", label: "Practices & Approaches" },
  { key: "tools", label: "Tools & Resources" },
  { key: "snapshot", label: "Snapshot" },
  { key: "embedded", label: "Embedded Locations" },
];

// ─── Priority helpers ─────────────────────────────────────────────────────────

export type Priority = "H" | "M" | "L";

export const PRIORITY_ORDER: Record<Priority, number> = { H: 0, M: 1, L: 2 };

/** Reads priority from overrideLevel / computedLevel (single-char) or level (text). */
export function aimPriority(aim: any): Priority {
  const ov = aim?.overrideLevel ?? aim?.computedLevel;
  if (ov === "H" || ov === "M" || ov === "L") return ov as Priority;
  const lv = aim?.level;
  if (lv === "High") return "H";
  if (lv === "Low") return "L";
  return "M";
}

// ─── Data extractors ──────────────────────────────────────────────────────────

export function getKeyDriversData(comp: any) {
  const hd: any = comp?.healthData || {};
  return {
    design: (hd.designScoreData?.finalDesignScore ?? null) as number | null,
    conditions: (hd.ringConditionsScoreData?.finalConditionsScore ?? null) as number | null,
    implementation: (hd.implementationScoreData?.finalImplementationScore ?? null) as number | null,
    experience: (hd.experienceScoreData?.finalExperienceScore ?? null) as number | null,
  };
}

export function aggregateLeaps(comp: any): Array<{ label: string; priority: Priority }> {
  const map = new Map<string, Priority>();

  const addAims = (aims: any[]) => {
    for (const a of aims) {
      if (a?.type === "leap" && typeof a?.label === "string" && isLeapAimActive(a)) {
        const p = aimPriority(a);
        const existing = map.get(a.label);
        if (!existing || PRIORITY_ORDER[p] < PRIORITY_ORDER[existing]) {
          map.set(a.label, p);
        }
      }
    }
  };

  const de = comp?.designedExperienceData || {};
  addAims(de.keyDesignElements?.aims || []);
  for (const sub of [...(de.subcomponents || []), ...(de.adultSubcomponents || [])]) {
    addAims(sub.keyDesignElements?.aims || sub.aims || []);
  }

  return Array.from(map.entries()).map(([label, priority]) => ({ label, priority }));
}

export { isLeapAimActive, isTargetingAimActive };

/**
 * Aggregate outcomes across the component and its subcomponents.
 * Uses L3 sub-selections when present (stored in `a.subSelections`),
 * falling back to the L2 label when no L3 is narrowed.
 * Per-L3 priority comes from `a.subPriorities[l3Label]`; L2 priority from aim.
 */
export function aggregateOutcomes(
  comp: any,
): Array<{ label: string; priority: Priority; isPrimary: boolean }> {
  const map = new Map<string, { priority: Priority; isPrimary: boolean }>();

  const mergeLabel = (label: string, p: Priority, primary: boolean) => {
    const existing = map.get(label);
    if (!existing || PRIORITY_ORDER[p] < PRIORITY_ORDER[existing.priority]) {
      map.set(label, { priority: p, isPrimary: primary });
    } else if (existing && primary) {
      map.set(label, { ...existing, isPrimary: true });
    }
  };

  // isRoot=true means isPrimary should be inherited; subcomponent primaries are local and should not
  // propagate as stars in the component-level view.
  const addAims = (aims: any[], isRoot: boolean) => {
    for (const a of aims) {
      if (a?.type !== "outcome" || !isTargetingAimActive(a)) continue;
      const subs: string[] = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
      if (subs.length === 0) {
        // Whole L2 selected
        mergeLabel(a.label, aimPriority(a), isRoot && !!a.isPrimary);
      } else {
        // Specific L3 selections — subPrimaries are only respected at root level
        const subPriorities: Record<string, string> = a.subPriorities ?? {};
        const subPrimaries: Record<string, boolean> = a.subPrimaries ?? {};
        for (const l3 of subs) {
          const raw = subPriorities[l3];
          const p: Priority = raw === "H" ? "H" : raw === "L" ? "L" : "M";
          mergeLabel(l3, p, isRoot && !!subPrimaries[l3]);
        }
      }
    }
  };

  const de = comp?.designedExperienceData || {};
  addAims(de.keyDesignElements?.aims || [], true);
  for (const sub of [...(de.subcomponents || []), ...(de.adultSubcomponents || [])]) {
    addAims(sub.keyDesignElements?.aims || sub.aims || [], false);
  }

  const PRIORITY_SORT: Record<Priority, number> = { H: 0, M: 1, L: 2 };
  return Array.from(map.entries())
    .map(([label, { priority, isPrimary }]) => ({ label, priority, isPrimary }))
    .sort((a, b) => {
      // Primary items first, then by priority
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return PRIORITY_SORT[a.priority] - PRIORITY_SORT[b.priority];
    });
}

export function getSubcomponents(
  comp: any,
): Array<{ id: string; name: string; description: string; isAdult: boolean }> {
  const de = comp?.designedExperienceData || {};
  const learner = (de.subcomponents || []).map((s: any) => ({
    id: s.id || "",
    name: s.name || "",
    description: s.description || "",
    isAdult: false,
  }));
  const adult = (de.adultSubcomponents || []).map((s: any) => ({
    id: s.id || "",
    name: s.name || "",
    description: s.description || "",
    isAdult: true,
  }));
  return [...learner, ...adult];
}

function getGradeBand(comp: any): string {
  const selections: any[] =
    comp?.designedExperienceData?.learnersProfile?.selections || [];

  const GRADE_PRIMARY_IDS = new Set([
    "grade_preschool",
    "grade_kindergarten",
    "grade_elementary_school",
    "grade_middle_school",
    "grade_high_school",
  ]);

  const SECONDARY_LABELS: Record<string, string> = {
    grade_9: "9th",
    grade_10: "10th",
    grade_11: "11th",
    grade_12: "12th",
    grade_6: "6th",
    grade_7: "7th",
    grade_8: "8th",
    grade_1: "1st",
    grade_2: "2nd",
    grade_3: "3rd",
    grade_4: "4th",
    grade_5: "5th",
    preschool_3: "PK3",
    preschool_4: "PK4",
  };

  const PRIMARY_LABELS: Record<string, string> = {
    grade_preschool: "Preschoolers",
    grade_kindergarten: "Kindergarteners",
    grade_elementary_school: "Elementary Schoolers",
    grade_middle_school: "Middle Schoolers",
    grade_high_school: "High Schoolers",
  };

  const bandSels = selections.filter((s) => GRADE_PRIMARY_IDS.has(s.primaryId));
  if (bandSels.length === 0) return "";

  const specificGrades: string[] = [];
  const primaryOnlyLabels: string[] = [];

  for (const sel of bandSels) {
    if (sel.secondaryIds?.length > 0) {
      for (const sid of sel.secondaryIds) {
        const lbl = SECONDARY_LABELS[sid];
        if (lbl) specificGrades.push(lbl);
      }
    } else {
      const lbl = PRIMARY_LABELS[sel.primaryId];
      if (lbl) primaryOnlyLabels.push(lbl);
    }
  }

  if (specificGrades.length > 0) {
    if (specificGrades.length === 1) return `${specificGrades[0]} Graders`;
    const last = specificGrades[specificGrades.length - 1];
    return `${specificGrades.slice(0, -1).join(", ")} & ${last} Graders`;
  }
  return primaryOnlyLabels.join(" & ");
}

function getTeacherNames(comp: any): string {
  const de = comp?.designedExperienceData || {};
  const roleNames = new Map<string, string[]>();

  const processProfile = (profile: any) => {
    if (!profile) return;
    const sels: any[] = profile.selections || [];
    const detail: Record<string, any> = profile.sliceDetail || {};
    const sliceKeys = adultSliceKeysFromSelections(sels);
    for (const key of sliceKeys) {
      const nameText: string = detail[key]?.name?.text?.trim() || "";
      if (nameText) {
        const names = nameText
          .split(/[\n,]+/)
          .map((n: string) => n.trim())
          .filter(Boolean);
        if (!roleNames.has(key)) roleNames.set(key, []);
        roleNames.get(key)!.push(...names);
      }
    }
  };

  processProfile(de.adultsProfile);
  for (const sub of [...(de.subcomponents || []), ...(de.adultSubcomponents || [])]) {
    processProfile(sub.adultsProfile);
  }

  if (roleNames.size === 0) return "";

  const parts: string[] = Array.from(roleNames.entries()).map(([key, names]) => {
    const label = formatAdultSliceTitle(key);
    const unique = Array.from(new Set(names));
    return `${label} (${unique.join(", ")})`;
  });
  return parts.join(", ");
}

/** Primary outcome labels — up to 2, oldest-first (matching the working space's own enforcement). */
function getPrimaryOutcomes(comp: any): string {
  const aims: any[] = comp?.designedExperienceData?.keyDesignElements?.aims || [];
  const items: { label: string; ts: number }[] = [];
  for (const a of aims) {
    if (a?.type !== "outcome" || !isTargetingAimActive(a)) continue;
    const subs: string[] = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
    if (subs.length === 0) {
      if (a.isPrimary && a.label) items.push({ label: String(a.label).trim(), ts: Number(a.primarySelectedAt) || 0 });
    } else {
      const sp: Record<string, boolean> = a.subPrimaries ?? {};
      const st: Record<string, number> = a.subPrimaryTimestamps ?? {};
      for (const l3 of subs) {
        if (sp[l3]) items.push({ label: String(l3).trim(), ts: Number(st[l3]) || 0 });
      }
    }
  }
  items.sort((x, y) => x.ts - y.ts);
  return items.slice(0, 2).map((i) => i.label).filter(Boolean).join(" & ");
}

const BK_SCHEDULE_CLASSROOMS_STUDENTS = "schedule-q1__number-of-classrooms-and-students";
const BK_SCHEDULE_DURATION = "schedule-q1__duration";
const BK_SCHEDULE_FREQUENCY = "schedule-q1__frequency";

const BUCKET_ID_CLASSROOMS_STUDENTS = "number-of-classrooms-and-students";

/** A3 pair for schedule “classrooms + students” bucket: `first` = classrooms, `second` = students. */
function formatA3PairClassroomsStudentsLine(first: number | null, second: number | null): string {
  if (second != null && first != null) {
    return `${second} students across ${first} classrooms`;
  }
  if (second != null) return `${second} students`;
  if (first != null) return `${first} classrooms`;
  return "";
}

function isClassroomsStudentsPairBucket(bucket: { id?: string }): boolean {
  return bucket.id === BUCKET_ID_CLASSROOMS_STUDENTS;
}

function unwrapA3Value(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "value" in v) return (v as any).value ?? null;
  return null;
}

function formatScheduleClassroomsStudents(expert: Record<string, Record<string, unknown>>): string {
  const bv = expert?.schedule?.[BK_SCHEDULE_CLASSROOMS_STUDENTS] as { archetypeA3Pair?: { first: unknown; second: unknown } } | undefined;
  const pair = bv?.archetypeA3Pair;
  if (!pair) return "";
  return formatA3PairClassroomsStudentsLine(unwrapA3Value(pair.first), unwrapA3Value(pair.second));
}

function formatA3Phrase(v: { value: number | null; unit?: string } | undefined): string {
  if (!v || v.value == null) return "";
  const u = String(v.unit || "").trim();
  if (u === "min") return `${v.value} minutes`;
  if (u === "hrs") return `${v.value} hours`;
  if (u === "days") return `${v.value} days`;
  if (u) return `${v.value} ${u}`.trim();
  return String(v.value);
}

/** Duration + frequency from Schedule & Use of Time expert buckets (component ring level). */
function formatScheduleDurationFrequency(expert: Record<string, Record<string, unknown>>): string {
  const dur = expert?.schedule?.[BK_SCHEDULE_DURATION] as { archetypeA3?: { value: number | null; unit?: string } } | undefined;
  const freq = expert?.schedule?.[BK_SCHEDULE_FREQUENCY] as { archetypeA3?: { value: number | null; unit?: string } } | undefined;
  const durPart = formatA3Phrase(dur?.archetypeA3);
  const fa = freq?.archetypeA3;
  const freqVal = fa?.value;
  const freqUnit = String(fa?.unit || "").trim();
  const freqPart = freqVal != null ? (freqUnit ? `${freqVal}x ${freqUnit}` : `${freqVal}x`) : "";
  if (freqPart && durPart) return `${freqPart} for ${durPart}`;
  return freqPart || durPart || "";
}

/**
 * Subcomponent rows from `subcomponents` / `adultSubcomponents` are stored flat
 * (aims, elementsExpertData, snapshotData) — normalize to the same shape as a ring component
 * so snapshot helpers can read a single `designedExperienceData` block.
 */
export function toSnapshotViewComp(raw: any): any {
  if (!raw) return raw;
  if (raw.designedExperienceData && typeof raw.designedExperienceData === "object") return raw;
  return {
    ...raw,
    snapshotData: raw.snapshotData ?? {},
    designedExperienceData: {
      keyDesignElements: raw.keyDesignElements ?? { aims: raw.aims ?? [] },
      elementsExpertData: raw.elementsExpertData ?? {},
      subcomponents: [],
      adultSubcomponents: [],
      learnersProfile: raw.learnersProfile,
      adultsProfile: raw.adultsProfile,
    },
  };
}

/**
 * Snapshot lines for the ring data preview.
 * @param sourceComp — the component or sub whose snapshot / DE data to show
 * @param designRoot — optional full ring parent; when set, read schedule/expert/aims from parent (e.g. sub tile rollups)
 */
export function getSnapshotData(sourceComp: any, designRoot?: any) {
  const src = toSnapshotViewComp(sourceComp);
  const dr = designRoot != null ? toSnapshotViewComp(designRoot) : null;
  const root = dr ?? src;
  const profileComp = dr ?? src;
  const expert = (root?.designedExperienceData?.elementsExpertData ?? {}) as Record<string, Record<string, unknown>>;
  const rootSnap: any = root?.snapshotData || {};

  const enrollmentExpert = formatScheduleClassroomsStudents(expert);
  const hasStudents = rootSnap.amountStudents && String(rootSnap.amountStudents) !== "0";
  const hasClassrooms = rootSnap.amountClassrooms && String(rootSnap.amountClassrooms) !== "0";
  const enrollmentSnap =
    hasStudents && hasClassrooms
      ? `${rootSnap.amountStudents} students across ${rootSnap.amountClassrooms} classrooms`
      : hasStudents
        ? `${rootSnap.amountStudents} students`
        : hasClassrooms
          ? `${rootSnap.amountClassrooms} classrooms`
          : "";

  const enrollment = enrollmentExpert || enrollmentSnap;

  const durationExpert = formatScheduleDurationFrequency(expert);
  const hasFreqSnap =
    rootSnap.sessionFrequency &&
    rootSnap.sessionFrequencyPer &&
    rootSnap.sessionDuration;
  const durationSnap = hasFreqSnap
    ? `${rootSnap.sessionFrequency}x per ${rootSnap.sessionFrequencyPer} for ${rootSnap.sessionDuration} mins`
    : "";
  const duration = durationExpert || durationSnap;

  return {
    primaryOutcomes: getPrimaryOutcomes(root),
    teachers: getTeacherNames(profileComp),
    gradeBand: getGradeBand(profileComp),
    enrollment,
    duration,
  };
}

// ─── Expert data utilities ────────────────────────────────────────────────────

/** Resolve a tag label, handling custom tags and discipline-grouped buckets. */
function _resolveTag(
  tagId: string,
  isCustom: boolean | undefined,
  customLabel: string | undefined,
  tags: TagDef[] | undefined,
): string {
  if (isCustom) return customLabel ?? tagId;
  // Try top-level tags first
  const topLevel = tags?.find((t) => t.id === tagId)?.label;
  if (topLevel) return topLevel;
  // Fall through to secondaries (some items are stored directly with a secondary ID)
  for (const t of tags ?? []) {
    const sec = t.secondaries?.find((s) => s.id === tagId)?.label;
    if (sec) return sec;
  }
  return tagId;
}

/** Flatten tags from a bucket (handles discipline groups). */
function _flatTags(bucket: BucketDef): TagDef[] {
  if (bucket.disciplineGroups?.length) return bucket.disciplineGroups.flatMap((g) => g.tags);
  return bucket.tags ?? [];
}

/** Extract display labels that are flagged as KEY from a single bucket value. */
export function extractKeyLabelsFromBucket(bucket: BucketDef, bv: BucketValue): string[] {
  const labels: string[] = [];
  const tags = _flatTags(bucket);

  if (bv.archetypeA1) {
    for (const sel of bv.archetypeA1.selections ?? []) {
      const primaryTag = tags.find((t) => t.id === sel.tagId);
      const primaryLabel = _resolveTag(sel.tagId, sel.isCustom, sel.customLabel, tags);
      const secondaries = sel.selectedSecondaries ?? [];
      if (sel.isKey) {
        if (secondaries.length > 0) {
          if (bucket.groupedSecondaryDisplay) {
            const secLabels = secondaries.map(
              (s) => primaryTag?.secondaries?.find((sec) => sec.id === s.tagId)?.label ?? s.tagId,
            );
            labels.push(`${primaryLabel} (${secLabels.join(", ")})`);
          } else {
            for (const sec of secondaries) {
              labels.push(primaryTag?.secondaries?.find((s) => s.id === sec.tagId)?.label ?? sec.tagId);
            }
          }
        } else {
          labels.push(primaryLabel);
        }
      } else {
        for (const sec of secondaries) {
          if (sec.isKey) {
            labels.push(primaryTag?.secondaries?.find((s) => s.id === sec.tagId)?.label ?? sec.tagId);
          }
        }
      }
    }
  } else if (bv.archetypeA2) {
    if (bv.archetypeA2.isKey && bv.archetypeA2.selectedId) {
      labels.push(_resolveTag(bv.archetypeA2.selectedId, bv.archetypeA2.isCustom, bv.archetypeA2.customLabel, tags));
    }
  } else if (bv.archetypeA3) {
    if (bv.archetypeA3.isKey && bv.archetypeA3.value != null) {
      labels.push(`${bv.archetypeA3.value} ${bv.archetypeA3.unit}`.trim());
    }
  } else if (bv.archetypeA3Ratio) {
    if (bv.archetypeA3Ratio.isKey) {
      const { learners, facilitators } = bv.archetypeA3Ratio;
      if (learners != null && facilitators != null) labels.push(`${learners}:${facilitators} ratio`);
    }
  } else if (bv.archetypeA3Pair) {
    if (bv.archetypeA3Pair.isKey) {
      const { first, second } = bv.archetypeA3Pair;
      if (isClassroomsStudentsPairBucket(bucket)) {
        const combined = formatA3PairClassroomsStudentsLine(first, second);
        if (combined) labels.push(combined);
        else {
          const [l1, l2] = bucket.pairLabels ?? ["Value 1", "Value 2"];
          if (first != null) labels.push(`${l1}: ${first}`);
          if (second != null) labels.push(`${l2}: ${second}`);
        }
      } else {
        const [l1, l2] = bucket.pairLabels ?? ["Value 1", "Value 2"];
        if (first != null) labels.push(`${l1}: ${first}`);
        if (second != null) labels.push(`${l2}: ${second}`);
      }
    }
  } else if (bv.archetypeA4) {
    if (bv.archetypeA4.isKey) {
      labels.push(`… ${bucket.title}`);
    }
  } else if (bv.archetypeA5) {
    if (bv.archetypeA5.isKey && bv.archetypeA5.text?.trim()) {
      labels.push(`… ${bucket.title}`);
    }
  }
  return labels;
}

/** Extract ALL selected items (key or not) with their key status, for the full view. */
export function extractAllItemsFromBucket(
  bucket: BucketDef,
  bv: BucketValue,
): Array<{ label: string; isKey: boolean }> {
  const items: Array<{ label: string; isKey: boolean }> = [];
  const tags = _flatTags(bucket);

  if (bv.archetypeA1) {
    for (const sel of bv.archetypeA1.selections ?? []) {
      const primaryTag = tags.find((t) => t.id === sel.tagId);
      const primaryLabel = _resolveTag(sel.tagId, sel.isCustom, sel.customLabel, tags);
      const secondaries = sel.selectedSecondaries ?? [];
      if (secondaries.length > 0) {
        if (bucket.groupedSecondaryDisplay) {
          const secLabels = secondaries.map(
            (s) => primaryTag?.secondaries?.find((sec) => sec.id === s.tagId)?.label ?? s.tagId,
          );
          items.push({ label: `${primaryLabel} (${secLabels.join(", ")})`, isKey: sel.isKey });
        } else {
          for (const sec of secondaries) {
            const secLabel = primaryTag?.secondaries?.find((s) => s.id === sec.tagId)?.label ?? sec.tagId;
            items.push({ label: secLabel, isKey: sec.isKey });
          }
        }
      } else {
        items.push({ label: primaryLabel, isKey: sel.isKey });
      }
    }
  } else if (bv.archetypeA2) {
    if (bv.archetypeA2.selectedId) {
      items.push({
        label: _resolveTag(bv.archetypeA2.selectedId, bv.archetypeA2.isCustom, bv.archetypeA2.customLabel, tags),
        isKey: bv.archetypeA2.isKey,
      });
    }
  } else if (bv.archetypeA3) {
    if (bv.archetypeA3.value != null) {
      items.push({ label: `${bv.archetypeA3.value} ${bv.archetypeA3.unit}`.trim(), isKey: bv.archetypeA3.isKey });
    }
  } else if (bv.archetypeA3Ratio) {
    const { learners, facilitators } = bv.archetypeA3Ratio;
    if (learners != null || facilitators != null) {
      items.push({ label: `${learners ?? "?"}:${facilitators ?? "?"} ratio`, isKey: bv.archetypeA3Ratio.isKey });
    }
  } else if (bv.archetypeA3Pair) {
    const [l1, l2] = bucket.pairLabels ?? ["Value 1", "Value 2"];
    const { first, second } = bv.archetypeA3Pair;
    if (isClassroomsStudentsPairBucket(bucket)) {
      const combined = formatA3PairClassroomsStudentsLine(first, second);
      if (combined) {
        items.push({ label: combined, isKey: bv.archetypeA3Pair.isKey });
      } else {
        if (first != null) items.push({ label: `${l1}: ${first}`, isKey: bv.archetypeA3Pair.isKey });
        if (second != null) items.push({ label: `${l2}: ${second}`, isKey: bv.archetypeA3Pair.isKey });
      }
    } else {
      if (first != null) items.push({ label: `${l1}: ${first}`, isKey: bv.archetypeA3Pair.isKey });
      if (second != null) items.push({ label: `${l2}: ${second}`, isKey: bv.archetypeA3Pair.isKey });
    }
  } else if (bv.archetypeA4) {
    const parts = [bv.archetypeA4.days?.join(", "), bv.archetypeA4.time, bv.archetypeA4.recurrence].filter(Boolean);
    if (parts.length) items.push({ label: parts.join(" · "), isKey: bv.archetypeA4.isKey });
    if (bv.archetypeA4.notes?.trim()) items.push({ label: bv.archetypeA4.notes.trim(), isKey: bv.archetypeA4.isKey });
  } else if (bv.archetypeA5) {
    if (bv.archetypeA5.text?.trim()) items.push({ label: bv.archetypeA5.text.trim(), isKey: bv.archetypeA5.isKey });
  } else if (bv.archetypeA2Tension && bucket.tensions) {
    for (const tension of bucket.tensions) {
      const side = bv.archetypeA2Tension.selections?.[tension.id];
      if (side === "left") items.push({ label: tension.leftLabel, isKey: false });
      else if (side === "right") items.push({ label: tension.rightLabel, isKey: false });
    }
  }
  return items;
}

/** Aggregate key items across component + all subs for a given section (practices or tools). */
function _getExpertKeyItems(comp: any, section: "practices" | "tools"): string[] {
  const de = comp?.designedExperienceData ?? {};
  const sources = [
    de.elementsExpertData ?? {},
    ...(de.subcomponents ?? []).map((s: any) => s.elementsExpertData ?? {}),
    ...(de.adultSubcomponents ?? []).map((s: any) => s.elementsExpertData ?? {}),
  ];
  const seen = new Set<string>();
  const results: string[] = [];
  for (const element of ALL_ELEMENTS) {
    for (const question of element.questions) {
      if (question.section !== section) continue;
      for (const bucket of question.buckets) {
        // Data is stored with composite key: questionId__bucketId
        const bk = `${question.id}__${bucket.id}`;
        for (const expertData of sources) {
          const bv: BucketValue | undefined = (expertData as any)?.[element.id]?.[bk];
          if (!bv) continue;
          for (const label of extractKeyLabelsFromBucket(bucket, bv)) {
            if (!seen.has(label)) { seen.add(label); results.push(label); }
          }
        }
      }
    }
  }
  return results;
}

export function getPracticesKeyItems(comp: any): string[] { return _getExpertKeyItems(comp, "practices"); }
export function getToolsKeyItems(comp: any): string[] { return _getExpertKeyItems(comp, "tools"); }

/** A single attribution of a practice/tool to a source (component or sub). */
export interface PracticeAttribution {
  sourceName: string;
  isAdult: boolean;
  isKey: boolean;
  notes: string; // TagSelection.notes for A1; notes field for others
  isComponent: boolean; // true when this attribution is from the root component (not a subcomponent)
}

/** Full dossier for one practice/tool label within a ring component tree. */
export interface PracticeDossier {
  section: "practices" | "tools";
  elementId: string;
  elementShortTitle: string;
  bucketId: string;
  bucketTitle: string;
  label: string;
  attributions: PracticeAttribution[];
}

/** Build a dossier for a given display label within a ring component and its subs. */
export function buildPracticeDossier(
  comp: any,
  section: "practices" | "tools",
  elementId: string,
  bucketCompositeKey: string, // e.g. "schedule-q1__number-of-classrooms-and-students"
  label: string,
): PracticeDossier | null {
  const element = ALL_ELEMENTS.find((e) => e.id === elementId);
  if (!element) return null;

  // Find bucket
  let foundBucket: import("./expert-view/expert-view-types").BucketDef | undefined;
  for (const q of element.questions) {
    for (const b of q.buckets) {
      if (`${q.id}__${b.id}` === bucketCompositeKey) { foundBucket = b; break; }
    }
    if (foundBucket) break;
  }
  if (!foundBucket) return null;

  const de = comp?.designedExperienceData ?? {};
  const compName = comp?.snapshotData?.name || comp?.title || "Component";

  const sources: Array<{ name: string; isAdult: boolean; isComponent: boolean; expertData: any }> = [
    { name: compName, isAdult: false, isComponent: true, expertData: de.elementsExpertData ?? {} },
    ...(de.subcomponents ?? []).map((s: any) => ({
      name: s.name || "Subcomponent",
      isAdult: false,
      isComponent: false,
      expertData: s.elementsExpertData ?? {},
    })),
    ...(de.adultSubcomponents ?? []).map((s: any) => ({
      name: s.name || "Adult Subcomponent",
      isAdult: true,
      isComponent: false,
      expertData: s.elementsExpertData ?? {},
    })),
  ];

  const attributions: PracticeAttribution[] = [];
  const normLabel = label.trim().toLowerCase();

  for (const src of sources) {
    const bv = src.expertData?.[elementId]?.[bucketCompositeKey];
    if (!bv) continue;

    // Check if this source includes our label
    if (bv.archetypeA1) {
      for (const sel of bv.archetypeA1.selections ?? []) {
        const primaryTag = (foundBucket.tags ?? []).find((t: any) => t.id === sel.tagId);
        const primaryLabel = _resolveTag(sel.tagId, sel.isCustom, sel.customLabel, _flatTags(foundBucket));
        const secondaries = sel.selectedSecondaries ?? [];
        if (foundBucket.groupedSecondaryDisplay) {
          const combined = secondaries.length > 0
            ? `${primaryLabel} (${secondaries.map((s: any) => primaryTag?.secondaries?.find((x: any) => x.id === s.tagId)?.label ?? s.tagId).join(", ")})`
            : primaryLabel;
          if (combined.trim().toLowerCase() === normLabel) {
            attributions.push({ sourceName: src.name, isAdult: src.isAdult, isKey: sel.isKey, notes: sel.notes || "", isComponent: src.isComponent });
          }
        } else if (secondaries.length > 0) {
          for (const sec of secondaries) {
            const secLabel = primaryTag?.secondaries?.find((s: any) => s.id === sec.tagId)?.label ?? sec.tagId;
            if (secLabel.trim().toLowerCase() === normLabel) {
              attributions.push({ sourceName: src.name, isAdult: src.isAdult, isKey: sec.isKey, notes: (sec as any).notes || "", isComponent: src.isComponent });
            }
          }
        } else {
          if (primaryLabel.trim().toLowerCase() === normLabel) {
            attributions.push({ sourceName: src.name, isAdult: src.isAdult, isKey: sel.isKey, notes: sel.notes || "", isComponent: src.isComponent });
          }
        }
      }
    } else {
      const allItems = extractAllItemsFromBucket(foundBucket, bv);
      for (const item of allItems) {
        if (item.label.trim().toLowerCase() === normLabel) {
          const notes = bv.archetypeA3?.description || bv.archetypeA4?.notes || bv.archetypeA5?.text || "";
          attributions.push({ sourceName: src.name, isAdult: src.isAdult, isKey: item.isKey, notes, isComponent: src.isComponent });
        }
      }
    }
  }

  return {
    section,
    elementId,
    elementShortTitle: element.shortTitle,
    bucketId: foundBucket.id,
    bucketTitle: foundBucket.title,
    label,
    attributions,
  };
}

/**
 * Enumerate all practice/tool items across a component tree and return them
 * with enough context to open a dossier (element id + composite bucket key).
 */
export interface PracticeItem {
  section: "practices" | "tools";
  elementId: string;
  elementShortTitle: string;
  bucketCompositeKey: string;
  bucketTitle: string;
  label: string;
  isKey: boolean;
  /** True when the value comes from an A4 or A5 bucket (free-text / schedule entry).
   *  Compact views should show bucketTitle + " …" instead of the raw label. */
  isLongText: boolean;
}

export function getAllPracticeItems(comp: any, section: "practices" | "tools"): PracticeItem[] {
  const de = comp?.designedExperienceData ?? {};
  const sources = [
    de.elementsExpertData ?? {},
    ...(de.subcomponents ?? []).map((s: any) => s.elementsExpertData ?? {}),
    ...(de.adultSubcomponents ?? []).map((s: any) => s.elementsExpertData ?? {}),
  ];

  const seen = new Map<string, PracticeItem>(); // key → item

  for (const element of ALL_ELEMENTS) {
    for (const question of element.questions) {
      if (question.section !== section) continue;
      for (const bucket of question.buckets) {
        const bk = `${question.id}__${bucket.id}`;
        for (const expertData of sources) {
          const bv: import("./expert-view/expert-view-types").BucketValue | undefined = (expertData as any)?.[element.id]?.[bk];
          if (!bv) continue;
          const isLongText = bucket.archetype === "A4" || bucket.archetype === "A5";
          const items = extractAllItemsFromBucket(bucket, bv);
          for (const item of items) {
            // For A4/A5 (free-text / schedule), collapse all sources into one entry
            // keyed only by bucket — the drill view shows per-source tabs when opened.
            const uid = isLongText
              ? `${element.id}::${bk}`
              : `${element.id}::${bk}::${item.label}`;
            if (!seen.has(uid)) {
              seen.set(uid, {
                section,
                elementId: element.id,
                elementShortTitle: element.shortTitle,
                bucketCompositeKey: bk,
                bucketTitle: bucket.title,
                label: item.label,
                isKey: item.isKey,
                isLongText,
              });
            } else if (item.isKey) {
              seen.get(uid)!.isKey = true;
            }
          }
        }
      }
    }
  }
  return Array.from(seen.values());
}

/** Where ring rollup data came from — drives deep-link into the working panel. */
export type RingSourceScope =
  | { kind: "component" }
  | { kind: "learnerSub"; id: string }
  | { kind: "adultSub"; id: string };

/** Build a flat list of sources (comp + subs) with their name and expert data. */
export function buildExpertSources(comp: any): Array<{
  name: string;
  isAdult: boolean;
  expertData: any;
  scope: RingSourceScope;
}> {
  const de = comp?.designedExperienceData ?? {};
  const compName = comp?.snapshotData?.name || comp?.title || "Component";
  return [
    { name: compName, isAdult: false, expertData: de.elementsExpertData ?? {}, scope: { kind: "component" } },
    ...(de.subcomponents ?? []).map((s: any) => ({
      name: s.name || "Subcomponent",
      isAdult: false,
      expertData: s.elementsExpertData ?? {},
      scope: { kind: "learnerSub", id: String(s.id) } as RingSourceScope,
    })),
    ...(de.adultSubcomponents ?? []).map((s: any) => ({
      name: s.name || "Adult Subcomponent",
      isAdult: true,
      expertData: s.elementsExpertData ?? {},
      scope: { kind: "adultSub", id: String(s.id) } as RingSourceScope,
    })),
  ];
}

/** Build a flat list of aim sources (comp + subs) for leaps / outcomes. */
export function buildAimSources(comp: any): Array<{
  name: string;
  isAdult: boolean;
  aims: any[];
  scope: RingSourceScope;
}> {
  const de = comp?.designedExperienceData ?? {};
  const compName = comp?.snapshotData?.name || comp?.title || "Component";
  return [
    { name: compName, isAdult: false, aims: de.keyDesignElements?.aims ?? [], scope: { kind: "component" } },
    ...(de.subcomponents ?? []).map((s: any) => ({
      name: s.name || "Subcomponent",
      isAdult: false,
      aims: s.keyDesignElements?.aims ?? s.aims ?? [],
      scope: { kind: "learnerSub", id: String(s.id) } as RingSourceScope,
    })),
    ...(de.adultSubcomponents ?? []).map((s: any) => ({
      name: s.name || "Adult Subcomponent",
      isAdult: true,
      aims: s.keyDesignElements?.aims ?? s.aims ?? [],
      scope: { kind: "adultSub", id: String(s.id) } as RingSourceScope,
    })),
  ];
}

/** Build snapshot sources (comp + subs). */
export function buildSnapshotSources(comp: any): Array<{
  name: string;
  isAdult: boolean;
  snap: any;
  comp: any;
  scope: RingSourceScope;
}> {
  const de = comp?.designedExperienceData ?? {};
  const compName = comp?.snapshotData?.name || comp?.title || "Component";
  return [
    { name: compName, isAdult: false, snap: comp?.snapshotData ?? {}, comp, scope: { kind: "component" } },
    ...(de.subcomponents ?? []).map((s: any) => ({
      name: s.name || "Subcomponent",
      isAdult: false,
      snap: s.snapshotData ?? {},
      comp: s,
      scope: { kind: "learnerSub", id: String(s.id) } as RingSourceScope,
    })),
    ...(de.adultSubcomponents ?? []).map((s: any) => ({
      name: s.name || "Adult Subcomponent",
      isAdult: true,
      snap: s.snapshotData ?? {},
      comp: s,
      scope: { kind: "adultSub", id: String(s.id) } as RingSourceScope,
    })),
  ];
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function ScoreRow({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[9px] font-medium text-gray-700 truncate">{label}</span>
      <span
        className={cn(
          "text-[9px] font-bold px-1 py-px rounded border shrink-0",
          scoreBgCls(score),
        )}
      >
        {score !== null ? `${Math.round(score)}/5` : "—"}
      </span>
    </div>
  );
}

function BulletRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1 text-[9px] text-gray-800 leading-tight">
      <span className="shrink-0 mt-px select-none">•</span>
      <span className="line-clamp-1 min-w-0">{children}</span>
    </li>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-[8px] text-gray-400 italic text-center py-2">{text}</p>
  );
}

function ComingSoonContent() {
  return (
    <div className="flex items-center justify-center h-full py-3">
      <span className="text-[8px] text-gray-400 font-medium italic">Coming soon</span>
    </div>
  );
}

// ─── Window content renderers ─────────────────────────────────────────────────

// ─── Key Drivers SVG diagram (scales to fill any container) ──────────────────

function kdColor(score: number | null): { fill: string; stroke: string; text: string } {
  if (score === null || Number.isNaN(score)) return { fill: "#f3f4f6", stroke: "#e5e7eb", text: "#9ca3af" };
  const r = Math.round(score);
  if (r <= 2) return { fill: "#fee2e2", stroke: "#fca5a5", text: "#b91c1c" };
  if (r === 3) return { fill: "#fef9c3", stroke: "#fde047", text: "#854d0e" };
  return { fill: "#d1fae5", stroke: "#6ee7b7", text: "#047857" };
}

function kdScoreLabel(score: number | null): string {
  return score !== null ? `${Math.round(score)}/5` : "—";
}

/**
 * SVG diagram showing the 4 Key Driver sub-dimensions with directional flow lines.
 * Uses viewBox so it scales to fill whatever container it's placed in.
 */
export type KDNodeKey = "design" | "conditions" | "implementation" | "experience";

export function KeyDriversDiagram({
  data,
  onNodeClick,
}: {
  data: ReturnType<typeof getKeyDriversData>;
  onNodeClick?: (dim: KDNodeKey) => void;
}) {
  const VW = 200, VH = 148;
  const PILL_H = 14, GAP = 3, FONT_LBL = 8.5, FONT_SCORE = 8;

  // Label baseline y for each node
  const DY = 12, CY = 12, IY = 80, EY = 124;
  const DX = 40, CX = 162, IX = 100, EX = 100;

  function KDNode({
    nx, ny, label, shortLabel, score, pw, dimKey,
  }: { nx: number; ny: number; label: string; shortLabel?: string; score: number | null; pw: number; dimKey: KDNodeKey }) {
    const col = kdColor(score);
    const pillTop = ny + GAP;
    const pillX = nx - pw / 2;
    const hitW = Math.max(pw + 8, 44);
    const hitH = FONT_LBL + GAP + PILL_H + 4;
    const hitX = nx - hitW / 2;
    const hitY = ny - FONT_LBL;
    const clickable = !!onNodeClick;
    return (
      <g
        onClick={clickable ? (e) => { e.stopPropagation(); onNodeClick(dimKey); } : undefined}
        style={clickable ? { cursor: "pointer" } : undefined}
      >
        {clickable && (
          <rect x={hitX} y={hitY} width={hitW} height={hitH} rx={3} fill="transparent" />
        )}
        <text x={nx} y={ny} textAnchor="middle"
          fontSize={FONT_LBL} fontWeight="600" fill={clickable ? "#1d4ed8" : "#374151"}>
          {shortLabel ?? label}
        </text>
        <rect x={pillX} y={pillTop} width={pw} height={PILL_H} rx={3}
          fill={col.fill} stroke={clickable ? "#93c5fd" : col.stroke} strokeWidth={clickable ? 1.2 : 0.8} />
        <text x={nx} y={pillTop + PILL_H / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize={FONT_SCORE} fontWeight="700" fill={col.text}>
          {kdScoreLabel(score)}
        </text>
      </g>
    );
  }

  // Connection points
  const dBot = DY + GAP + PILL_H;
  const cBot = CY + GAP + PILL_H;
  const iTop = IY - 2;
  const iBot = IY + GAP + PILL_H;
  const eTop = EY - 2;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <marker id="kdArr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="#9ca3af" />
        </marker>
      </defs>
      {/* Connecting lines */}
      <line x1={DX} y1={dBot} x2={IX - 8} y2={iTop} stroke="#d1d5db" strokeWidth={1.2} />
      <line x1={CX} y1={cBot} x2={IX + 8} y2={iTop} stroke="#d1d5db" strokeWidth={1.2} />
      <line x1={IX} y1={iBot} x2={EX} y2={eTop}
        stroke="#d1d5db" strokeWidth={1.2} markerEnd="url(#kdArr)" />
      {/* Nodes */}
      <KDNode nx={DX} ny={DY} label="Design"         score={data.design}         pw={38} dimKey="design" />
      <KDNode nx={CX} ny={CY} label="Conditions"     score={data.conditions}     pw={44} dimKey="conditions" />
      <KDNode nx={IX} ny={IY} label="Implementation" shortLabel="Impl."          score={data.implementation} pw={42} dimKey="implementation" />
      <KDNode nx={EX} ny={EY} label="Experience"     score={data.experience}     pw={44} dimKey="experience" />
    </svg>
  );
}

function KeyDriversContent({ comp, onDimensionClick }: { comp: any; onDimensionClick?: (dim: KDNodeKey) => void }) {
  const data = getKeyDriversData(comp);
  return (
    <div className="w-full h-full flex items-stretch p-0.5">
      <KeyDriversDiagram data={data} onNodeClick={onDimensionClick} />
    </div>
  );
}

// ─── Drill event types (used by compact content + enlarged lists) ─────────────

export type CompactDrillEvent =
  | { kind: "leap"; label: string }
  | { kind: "outcome"; label: string }
  | { kind: "subcomponent"; name: string }
  | { kind: "practice"; item: PracticeItem }
  | { kind: "tool"; item: PracticeItem };

function BulletButton({
  children,
  onClick,
  onDoubleClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <li className="flex items-start gap-1 text-[9px] leading-tight">
      <span className="shrink-0 mt-px select-none text-gray-400">•</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onDoubleClick={onDoubleClick ? (e) => { e.stopPropagation(); onDoubleClick(); } : undefined}
        className="min-w-0 text-left text-gray-800 hover:text-blue-700 hover:underline transition-colors"
        title={onDoubleClick ? "Click to view · Double-click to edit" : undefined}
      >
        {children}
      </button>
    </li>
  );
}

function LeapsContent({ comp, onDrill, onDoubleClickItem }: { comp: any; onDrill?: (e: CompactDrillEvent) => void; onDoubleClickItem?: (e: CompactDrillEvent) => void }) {
  const leaps = aggregateLeaps(comp);
  if (leaps.length === 0) return <EmptyState text="No leaps defined" />;
  return (
    <ul className="space-y-0.5">
      {leaps.map((leap) =>
        onDrill ? (
          <BulletButton key={leap.label}
            onClick={() => onDrill({ kind: "leap", label: leap.label })}
            onDoubleClick={onDoubleClickItem ? () => onDoubleClickItem({ kind: "leap", label: leap.label }) : undefined}
          >
            {leap.label}{" "}
            <span className="text-gray-500">({leap.priority})</span>
          </BulletButton>
        ) : (
          <BulletRow key={leap.label}>
            {leap.label}{" "}
            <span className="text-gray-500">({leap.priority})</span>
          </BulletRow>
        )
      )}
    </ul>
  );
}

function OutcomesContent({ comp, onDrill, onDoubleClickItem }: { comp: any; onDrill?: (e: CompactDrillEvent) => void; onDoubleClickItem?: (e: CompactDrillEvent) => void }) {
  const outcomes = aggregateOutcomes(comp);
  if (outcomes.length === 0) return <EmptyState text="No outcomes defined" />;
  return (
    <ul className="space-y-0.5">
      {outcomes.map((o) =>
        onDrill ? (
          <BulletButton key={o.label}
            onClick={() => onDrill({ kind: "outcome", label: o.label })}
            onDoubleClick={onDoubleClickItem ? () => onDoubleClickItem({ kind: "outcome", label: o.label }) : undefined}
          >
            {o.isPrimary && <span className="text-amber-500"> ★</span>}
            {o.label}{" "}
            <span className="text-gray-500">({o.priority})</span>
          </BulletButton>
        ) : (
          <BulletRow key={o.label}>
            {o.isPrimary && <span className="text-amber-500"> ★</span>}
            {o.label}{" "}
            <span className="text-gray-500">({o.priority})</span>
          </BulletRow>
        )
      )}
    </ul>
  );
}

function SubcomponentsContent({ comp, onDrill, onDoubleClickItem }: { comp: any; onDrill?: (e: CompactDrillEvent) => void; onDoubleClickItem?: (e: CompactDrillEvent) => void }) {
  const subs = getSubcomponents(comp);
  if (subs.length === 0) return <EmptyState text="No subcomponents" />;
  return (
    <ul className="space-y-0.5">
      {subs.map((sub, i) =>
        onDrill ? (
          <BulletButton key={i}
            onClick={() => onDrill({ kind: "subcomponent", name: sub.name })}
            onDoubleClick={onDoubleClickItem ? () => onDoubleClickItem({ kind: "subcomponent", name: sub.name }) : undefined}
          >
            {sub.isAdult && <span className="text-gray-500">(A) </span>}
            {sub.name}
          </BulletButton>
        ) : (
          <BulletRow key={i}>
            {sub.isAdult && <span className="text-gray-500">(A) </span>}
            {sub.name}
          </BulletRow>
        )
      )}
    </ul>
  );
}

function SnapshotContent({ comp }: { comp: any }) {
  const data = getSnapshotData(comp);
  const rows = [
    data.primaryOutcomes,
    data.teachers,
    data.gradeBand,
    data.enrollment,
    data.duration,
  ].filter(Boolean);

  if (rows.length === 0) return <EmptyState text="No snapshot data yet" />;

  return (
    <ul className="space-y-0.5">
      {rows.map((row, i) => (
        <BulletRow key={i}>{row}</BulletRow>
      ))}
    </ul>
  );
}

/**
 * Merge schedule duration + frequency A3 items into a single "X min/day · Yx/week" line.
 * Duration key: "schedule-q1__duration", Frequency key: "schedule-q1__frequency".
 * Returns a new array with those two items replaced by one combined item.
 */
export function mergeScheduleDurationFrequency(items: PracticeItem[]): PracticeItem[] {
  const DUR_KEY = "schedule-q1__duration";
  const FREQ_KEY = "schedule-q1__frequency";
  const durIdx = items.findIndex((i) => i.bucketCompositeKey === DUR_KEY);
  const freqIdx = items.findIndex((i) => i.bucketCompositeKey === FREQ_KEY);
  if (durIdx === -1 || freqIdx === -1) return items;

  const dur = items[durIdx];
  const freq = items[freqIdx];

  // Build a human label: "5x per week · 30 min/session"
  // The raw labels are e.g. "30 min", "5 days" — reformat them.
  const formatFreq = (raw: string) => {
    const m = raw.match(/^(\d+)\s*(.*)/);
    if (!m) return raw;
    const [, n, unit] = m;
    if (!unit || unit === "x") return `${n}x`;
    return `${n}x/${unit.replace(/s$/, "")}`;
  };
  const formatDur = (raw: string) => {
    const m = raw.match(/^(\d+)\s*(.*)/);
    if (!m) return raw;
    const [, n, unit] = m;
    const u = unit.toLowerCase();
    if (u === "min" || u === "mins" || u === "minutes") return `${n} min/session`;
    if (u === "hrs" || u === "hours" || u === "hour") return `${n} hr/session`;
    return raw;
  };

  const combined: PracticeItem = {
    ...dur,
    label: `${formatFreq(freq.label)} · ${formatDur(dur.label)}`,
    isKey: dur.isKey || freq.isKey,
    isLongText: false,
  };

  // Replace both items with the merged one (insert at the earlier index)
  const result = items.filter((_, idx) => idx !== durIdx && idx !== freqIdx);
  result.splice(Math.min(durIdx, freqIdx), 0, combined);
  return result;
}

function PracticesContent({ comp, onDrill, onDoubleClickItem }: { comp: any; onDrill?: (e: CompactDrillEvent) => void; onDoubleClickItem?: (e: CompactDrillEvent) => void }) {
  const allItems = useMemo(() => getAllPracticeItems(comp, "practices"), [comp]);
  const keyItems = useMemo(
    () => mergeScheduleDurationFrequency(allItems.filter((i) => i.isKey)),
    [allItems],
  );
  if (keyItems.length === 0) return <EmptyState text="No key practices marked yet" />;
  return (
    <ul className="space-y-0.5">
      {keyItems.map((item, i) => {
        const displayLabel = item.isLongText ? `… ${item.bucketTitle}` : item.label;
        return onDrill ? (
          <BulletButton key={i}
            onClick={() => onDrill({ kind: "practice", item })}
            onDoubleClick={onDoubleClickItem ? () => onDoubleClickItem({ kind: "practice", item }) : undefined}
          >
            {displayLabel}
          </BulletButton>
        ) : (
          <BulletRow key={i}>{displayLabel}</BulletRow>
        );
      })}
    </ul>
  );
}

function ToolsContent({ comp, onDrill, onDoubleClickItem }: { comp: any; onDrill?: (e: CompactDrillEvent) => void; onDoubleClickItem?: (e: CompactDrillEvent) => void }) {
  const allItems = useMemo(() => getAllPracticeItems(comp, "tools"), [comp]);
  const keyItems = allItems.filter((i) => i.isKey);
  if (keyItems.length === 0) return <EmptyState text="No key tools marked yet" />;
  return (
    <ul className="space-y-0.5">
      {keyItems.map((item, i) => {
        const displayLabel = item.isLongText ? `… ${item.bucketTitle}` : item.label;
        return onDrill ? (
          <BulletButton key={i}
            onClick={() => onDrill({ kind: "tool", item })}
            onDoubleClick={onDoubleClickItem ? () => onDoubleClickItem({ kind: "tool", item }) : undefined}
          >
            {displayLabel}
          </BulletButton>
        ) : (
          <BulletRow key={i}>{displayLabel}</BulletRow>
        );
      })}
    </ul>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export interface RingDataPreviewWindowProps {
  comp: any;
  selectedWindow: DataWindowKey;
  onWindowChange: (w: DataWindowKey) => void;
  /** When provided, clicking the expand button in the header opens the full view. */
  onOpenFullView?: () => void;
  /** When provided, list items become clickable and fire drill-down events. */
  onDrill?: (e: CompactDrillEvent) => void;
  /** When provided, double-clicking a list item fires this to open the working panel edit page for it. */
  onDoubleClickItem?: (e: CompactDrillEvent) => void;
  /** When provided, clicking a Key Drivers node fires a dimension-detail event. */
  onDimensionClick?: (dim: KDNodeKey) => void;
  /** Double-click on the scrollable body (not on buttons) opens the working panel scoped to this window. */
  onDoubleClickToEdit?: () => void;
}

export function RingDataPreviewWindow({
  comp,
  selectedWindow,
  onWindowChange,
  onOpenFullView,
  onDrill,
  onDoubleClickItem,
  onDimensionClick,
  onDoubleClickToEdit,
}: RingDataPreviewWindowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentIdx = DATA_WINDOWS.findIndex((w) => w.key === selectedWindow);
  const safeIdx = currentIdx >= 0 ? currentIdx : 0;
  const currentWindow = DATA_WINDOWS[safeIdx];

  const goTo = (idx: number) => {
    onWindowChange(DATA_WINDOWS[idx].key);
    setDropdownOpen(false);
  };
  const prev = () => goTo((safeIdx - 1 + DATA_WINDOWS.length) % DATA_WINDOWS.length);
  const next = () => goTo((safeIdx + 1) % DATA_WINDOWS.length);

  return (
    <div
      data-preview-interactive
      className="w-full h-full flex flex-col overflow-hidden pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        if (!onDoubleClickToEdit) return;
        const el = e.target as HTMLElement;
        if (el.closest("button, a, [role='button'], input, select, textarea")) return;
        e.stopPropagation();
        e.preventDefault();
        onDoubleClickToEdit();
      }}
    >
      {/* ── Header ── */}
      <div className="group/header flex items-center shrink-0 px-0.5">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="p-0.5 rounded hover:bg-gray-100 transition-colors shrink-0"
          title="Previous window"
        >
          <ChevronLeft className="w-2.5 h-2.5 text-gray-500" />
        </button>

        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((o) => !o);
            }}
            className="w-full flex items-center justify-center gap-0.5 py-0.5 text-[8px] font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span className="truncate">{currentWindow.label}</span>
            <ChevronDown className="w-2 h-2 shrink-0 text-gray-500" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 z-[999] bg-white border border-gray-200 rounded shadow-lg mt-0.5 py-0.5 max-h-[110px] overflow-y-auto">
              {DATA_WINDOWS.map((w, idx) => (
                <button
                  key={w.key}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(idx);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-0.5 text-[8px] font-medium hover:bg-gray-50 transition-colors",
                    w.key === selectedWindow
                      ? "text-blue-600 bg-blue-50/50"
                      : "text-gray-700",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="p-0.5 rounded hover:bg-gray-100 transition-colors shrink-0"
          title="Next window"
        >
          <ChevronRight className="w-2.5 h-2.5 text-gray-500" />
        </button>

        {/* Expand button — always visible when onOpenFullView is provided */}
        {onOpenFullView && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullView();
            }}
            className="ml-0.5 p-0.5 rounded transition-colors shrink-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            title="Open full view"
          >
            <Maximize2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-gray-200 shrink-0 mx-1" />

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 min-h-0">
        {selectedWindow === "keyDrivers" && <KeyDriversContent comp={comp} onDimensionClick={onDimensionClick} />}
        {selectedWindow === "leaps" && <LeapsContent comp={comp} onDrill={onDrill} onDoubleClickItem={onDoubleClickItem} />}
        {selectedWindow === "outcomes" && <OutcomesContent comp={comp} onDrill={onDrill} onDoubleClickItem={onDoubleClickItem} />}
        {selectedWindow === "subcomponents" && <SubcomponentsContent comp={comp} onDrill={onDrill} onDoubleClickItem={onDoubleClickItem} />}
        {selectedWindow === "practices" && <PracticesContent comp={comp} onDrill={onDrill} onDoubleClickItem={onDoubleClickItem} />}
        {selectedWindow === "tools" && <ToolsContent comp={comp} onDrill={onDrill} onDoubleClickItem={onDoubleClickItem} />}
        {selectedWindow === "snapshot" && <SnapshotContent comp={comp} />}
        {selectedWindow === "embedded" && <ComingSoonContent />}
      </div>
    </div>
  );
}
