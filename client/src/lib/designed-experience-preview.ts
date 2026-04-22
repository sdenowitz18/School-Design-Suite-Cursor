/**
 * Build the precomputed `DesignedExperiencePreview` consumed by the Designed Experience
 * center card. We walk the full ring + center component list once so the card can
 * render synchronously without re-deriving counts on every keystroke.
 */

import {
  ALL_ELEMENTS,
} from "@/components/expert-view/expert-view-schema";
import type {
  BucketDef,
  BucketValue,
  ElementDef,
  TagDef,
} from "@/components/expert-view/expert-view-types";
import { OUTCOME_SCHEMA, LEAP_SCHEMA } from "@/components/designed-experience-schemas";
import { isLeapAimActive, isTargetingAimActive } from "@shared/aim-selection";
import {
  ADULT_ROLE_SECTIONS,
  type AdultPrimaryDef,
} from "@/components/adult-design-schema";
import { LEARNER_DEMOGRAPHIC_PRIMARIES } from "@/components/learner-design-schema";
import { TAGS_FAC_BACKGROUND } from "@/components/expert-view/facilitator-element-schema";
import { ringExperienceAudience } from "@/lib/ring-experience-audience";
import {
  ADULT_EXPERIENCE_PICKS,
  type AdultCatalogPick,
} from "@/lib/adult-experience-catalog";
import {
  normalizeCommunityEcosystemOutcomes,
  communityEcosystemStatus,
  type CommunityEcosystemOutcome,
} from "@/components/community-ecosystem/community-ecosystem-types";
import type {
  DesignedExperiencePreview,
  OutcomeCategoryKey,
  OutcomeRow,
  OutcomeCategorySummary,
  LeapOrPrincipleRow,
  AdultRoleSummary,
  ComponentRef,
  DesignElementTagRow,
} from "@/components/designed-experience-card-content";
import type { DesignItemDragPayload } from "@/components/design-item-drop-modal";

type AnyAim = {
  id?: string;
  type?: string;
  label?: string;
  level?: "High" | "Medium" | "Low" | "Absent";
  overrideLevel?: "H" | "M" | "L";
  computedLevel?: "H" | "M" | "L";
  isPrimary?: boolean;
  selected?: boolean;
  subSelections?: string[];
  subPriorities?: Record<string, "H" | "M" | "L">;
  subPrimaries?: Record<string, boolean>;
};

const LEARNING_ADVANCEMENT_CATEGORIES: OutcomeCategoryKey[] = [
  "STEM",
  "Arts & Humanities",
  "Thinking & Relating",
  "Professional & Practical",
  "Advancement",
];

const WELLBEING_CONDUCT_CATEGORIES: OutcomeCategoryKey[] = [
  "Wellbeing",
  "Conduct & Engagement",
];

const ALL_CATEGORIES: OutcomeCategoryKey[] = [
  ...LEARNING_ADVANCEMENT_CATEGORIES,
  ...WELLBEING_CONDUCT_CATEGORIES,
];

/** Map an outcome aim's L2 label (e.g. "Mathematics") to its top-level category (e.g. "STEM"). */
function categoryForL2Label(l2Label: string): OutcomeCategoryKey | null {
  for (const cat of Object.keys(OUTCOME_SCHEMA)) {
    const l2map = OUTCOME_SCHEMA[cat];
    if (l2map && l2Label in l2map) return cat as OutcomeCategoryKey;
  }
  return null;
}

function aimPriority(aim: AnyAim): "H" | "M" | "L" {
  const ov = aim.overrideLevel ?? aim.computedLevel;
  if (ov === "H" || ov === "M" || ov === "L") return ov;
  if (aim.level === "High") return "H";
  if (aim.level === "Low") return "L";
  return "M";
}

function l3Priority(aim: AnyAim, l3: string): "H" | "M" | "L" {
  const v = aim.subPriorities?.[l3];
  return v === "H" || v === "L" ? v : "M";
}

interface ExpandedOutcomeRow {
  /** L2 label (always present). */
  l2: string;
  /** L3 label, or undefined when the L2 itself is the row. */
  l3?: string;
  /** Resolved priority for this row. */
  priority: "H" | "M" | "L";
}

/** Expand a list of aims into one row per L3 (or one row for the L2-whole when no L3 picked). */
function expandOutcomeAims(aims: AnyAim[]): ExpandedOutcomeRow[] {
  const out: ExpandedOutcomeRow[] = [];
  for (const a of aims) {
    if (a.type !== "outcome" || !isTargetingAimActive(a)) continue;
    const subs = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
    if (subs.length === 0) {
      out.push({ l2: String(a.label ?? ""), priority: aimPriority(a) });
    } else {
      for (const l3 of subs) {
        out.push({ l2: String(a.label ?? ""), l3, priority: l3Priority(a, l3) });
      }
    }
  }
  return out;
}

/** Walk every ring component and bucket them by which outcome category their outcomes touch. */
function buildHexIndex(ringComponents: any[]): {
  componentsByCategory: Map<OutcomeCategoryKey, Set<string>>;
  componentsByOutcomeKey: Map<string, Set<string>>;
  componentsByLeapLabel: Map<string, Set<string>>;
} {
  const componentsByCategory = new Map<OutcomeCategoryKey, Set<string>>();
  const componentsByOutcomeKey = new Map<string, Set<string>>();
  const componentsByLeapLabel = new Map<string, Set<string>>();
  for (const cat of ALL_CATEGORIES) componentsByCategory.set(cat, new Set());

  for (const comp of ringComponents) {
    const id = String(comp?.nodeId ?? comp?.id ?? "");
    if (!id) continue;
    const de = comp?.designedExperienceData;
    const aims: AnyAim[] = de?.keyDesignElements?.aims ?? [];

    // Outcome rows
    const expanded = expandOutcomeAims(aims);
    for (const row of expanded) {
      const cat = categoryForL2Label(row.l2);
      if (!cat) continue;
      componentsByCategory.get(cat)!.add(id);
      const outcomeKey = row.l3 ? `${row.l2}::${row.l3}` : row.l2;
      if (!componentsByOutcomeKey.has(outcomeKey)) componentsByOutcomeKey.set(outcomeKey, new Set());
      componentsByOutcomeKey.get(outcomeKey)!.add(id);
    }

    // Leap rows
    for (const a of aims) {
      if (a.type !== "leap" || !isLeapAimActive(a)) continue;
      const label = String(a.label ?? "").trim();
      if (!label) continue;
      if (!componentsByLeapLabel.has(label)) componentsByLeapLabel.set(label, new Set());
      componentsByLeapLabel.get(label)!.add(id);
    }
  }

  return { componentsByCategory, componentsByOutcomeKey, componentsByLeapLabel };
}

/**
 * Build the per-category summaries for the Targeted Impact card.
 *
 * Each category's `outcomes` list includes:
 *  - outcomes selected at the center/overall component (priority = H/M/L)
 *  - outcomes only present in ring components (priority = null, hex ≥ 1)
 *
 * Center-selected outcomes sort first; ring-only outcomes sort second. Both
 * groups are ordered alphabetically by label within themselves.
 */
function buildCategorySummaries(
  centerAims: AnyAim[],
  componentsByCategory: Map<OutcomeCategoryKey, Set<string>>,
  componentsByOutcomeKey: Map<string, Set<string>>,
  categories: OutcomeCategoryKey[],
): OutcomeCategorySummary[] {
  // Index center-selected outcomes by their outcome key.
  const centerExpanded = expandOutcomeAims(centerAims);
  const centerByKey = new Map<string, ExpandedOutcomeRow>();
  for (const row of centerExpanded) {
    const key = row.l3 ? `${row.l2}::${row.l3}` : row.l2;
    centerByKey.set(key, row);
  }

  // Union of all outcome keys: center + every ring component.
  const allKeys = new Set<string>(
    Array.from(centerByKey.keys()).concat(Array.from(componentsByOutcomeKey.keys())),
  );

  const byCategory = new Map<OutcomeCategoryKey, OutcomeRow[]>();
  for (const cat of categories) byCategory.set(cat, []);

  for (const key of Array.from(allKeys)) {
    const sep = key.indexOf("::");
    const l2 = sep >= 0 ? key.slice(0, sep) : key;
    const l3 = sep >= 0 ? key.slice(sep + 2) : undefined;
    const cat = categoryForL2Label(l2);
    if (!cat || !byCategory.has(cat)) continue;

    const hexSet = componentsByOutcomeKey.get(key);
    const centerRow = centerByKey.get(key);

    byCategory.get(cat)!.push({
      key,
      label: l3 ?? l2,
      // null = ring-only (not selected at center); H/M/L = selected at center.
      priority: centerRow ? centerRow.priority : null,
      hex: hexSet?.size ?? 0,
      hexIds: hexSet ? Array.from(hexSet) : [],
    });
  }

  return categories.map((cat) => {
    const outcomes = byCategory.get(cat) ?? [];
    // Center-selected first, then ring-only; alphabetical within each group.
    outcomes.sort((a, b) => {
      const aCtr = a.priority !== null;
      const bCtr = b.priority !== null;
      if (aCtr !== bCtr) return aCtr ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    const catSet = componentsByCategory.get(cat);
    return {
      category: cat,
      // selectedCount = center-selected only (used for the number pill at the category level).
      selectedCount: outcomes.filter((o) => o.priority !== null).length,
      hex: catSet?.size ?? 0,
      hexIds: catSet ? Array.from(catSet) : [],
      outcomes,
    };
  });
}

/** Build canonical leap/principle rows (always show all six canonical leaps; flag unselected as Absent). */
function buildLeapRows(
  centerAims: AnyAim[],
  componentsByLeapLabel: Map<string, Set<string>>,
): LeapOrPrincipleRow[] {
  const canonical = LEAP_SCHEMA["Level 1"] ?? [];
  const seenLabels = new Set<string>();
  const centerLeaps = centerAims.filter((a) => a.type === "leap" && isLeapAimActive(a));
  const centerLeapByLabelLower = new Map<string, AnyAim>();
  for (const l of centerLeaps) {
    const k = String(l.label ?? "").trim().toLowerCase();
    if (k) centerLeapByLabelLower.set(k, l);
  }

  const rows: LeapOrPrincipleRow[] = [];

  // Canonical leaps first, in schema order, with priority or "Absent".
  for (const leap of canonical) {
    seenLabels.add(leap.toLowerCase());
    const aim = centerLeapByLabelLower.get(leap.toLowerCase());
    const leapSet = componentsByLeapLabel.get(leap);
    rows.push({
      label: leap,
      priority: aim ? aimPriority(aim) : "Absent",
      hex: leapSet?.size ?? 0,
      hexIds: leapSet ? Array.from(leapSet) : [],
    });
  }

  // Then any custom design principles (school-defined) that exist in center aims.
  for (const aim of centerLeaps) {
    const label = String(aim.label ?? "").trim();
    if (!label) continue;
    if (seenLabels.has(label.toLowerCase())) continue;
    seenLabels.add(label.toLowerCase());
    const customSet = componentsByLeapLabel.get(label);
    rows.push({
      label,
      priority: aimPriority(aim),
      hex: customSet?.size ?? 0,
      hexIds: customSet ? Array.from(customSet) : [],
    });
  }

  return rows;
}

/** Identify ring components whose primary-starred outcomes touch a given category. */
function buildStudentExperienceGroups(
  ringLearnerComponents: any[],
): DesignedExperiencePreview["studentExperiences"] {
  const byCategory = new Map<OutcomeCategoryKey, Map<string, ComponentRef>>();
  for (const cat of ALL_CATEGORIES) byCategory.set(cat, new Map());

  for (const comp of ringLearnerComponents) {
    const aims: AnyAim[] = comp?.designedExperienceData?.keyDesignElements?.aims ?? [];
    const ref: ComponentRef = {
      nodeId: String(comp?.nodeId ?? comp?.id ?? ""),
      title: String(comp?.title ?? "Untitled"),
    };
    if (!ref.nodeId) continue;

    const touched = new Set<OutcomeCategoryKey>();
    for (const a of aims) {
      if (a.type !== "outcome" || !isTargetingAimActive(a)) continue;
      const l2 = String(a.label ?? "");
      const subs = Array.isArray(a.subSelections) ? a.subSelections.filter(Boolean) : [];
      const cat = categoryForL2Label(l2);
      if (!cat) continue;
      // Primary at L2 (no subs) → entire L2 is primary; primary at L3 → the matching L3 is primary.
      if (subs.length === 0) {
        if (a.isPrimary) touched.add(cat);
      } else {
        const sp = a.subPrimaries ?? {};
        if (subs.some((l3) => sp[l3])) touched.add(cat);
      }
    }
    touched.forEach((cat) => {
      byCategory.get(cat)!.set(ref.nodeId, ref);
    });
  }

  return ALL_CATEGORIES.map((category) => ({
    category,
    components: Array.from(byCategory.get(category)?.values() ?? []),
  }));
}

// ─── Design Element Card Data ─────────────────────────────────────────────────

/** Bucket key used when storing expert data: `questionId__bucketId`. */
export function bucketKey(questionId: string, bucketId: string) {
  return `${questionId}__${bucketId}`;
}

/**
 * Build a per-element, per-tag hex index from all ring components.
 * Returns a Map keyed as `"elementId::questionId__bucketId::tagId"` → Set<nodeId>.
 * For non-tag archetypes (A3, A4, A5) the key uses `"__value__"` to count presence.
 */
export function buildDesignElementHexIndex(ring: any[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  function add(k: string, nodeId: string) {
    if (!index.has(k)) index.set(k, new Set());
    index.get(k)!.add(nodeId);
  }

  /** Scan one expertData record, attributing all matches to the parent nodeId. */
  function scanExpertData(
    expertData: Record<string, Record<string, BucketValue>>,
    nodeId: string,
  ) {
    for (const element of ALL_ELEMENTS) {
      const elementData = expertData[element.id] ?? {};
      for (const question of element.questions) {
        for (const bucket of question.buckets) {
          const bk = bucketKey(question.id, bucket.id);
          const bv: BucketValue = (elementData[bk] as BucketValue) ?? {};
          const prefix = `${element.id}::${bk}::`;

          if (bv.archetypeA1) {
            for (const sel of bv.archetypeA1.selections ?? []) {
              add(prefix + sel.tagId, nodeId);
              for (const sec of sel.selectedSecondaries ?? []) {
                add(prefix + sec.tagId, nodeId);
              }
            }
          } else if (bv.archetypeA2) {
            if (bv.archetypeA2.selectedId) add(prefix + bv.archetypeA2.selectedId, nodeId);
          } else if (bv.archetypeA3 || bv.archetypeA3Pair || bv.archetypeA3Ratio || bv.archetypeA4 || bv.archetypeA5) {
            add(prefix + "__value__", nodeId);
          }
        }
      }
    }
  }

  for (const comp of ring) {
    const nodeId = String(comp?.nodeId ?? "");
    if (!nodeId) continue;
    const de: any = comp?.designedExperienceData ?? {};

    // Scan component-level expert data.
    const topExpert: Record<string, Record<string, BucketValue>> =
      (de.elementsExpertData as any) ?? {};
    scanExpertData(topExpert, nodeId);

    // Scan each learner and adult subcomponent's expert data, attributing to parent nodeId.
    for (const sub of [...(de.subcomponents ?? []), ...(de.adultSubcomponents ?? [])]) {
      if (!sub?.elementsExpertData) continue;
      scanExpertData(sub.elementsExpertData as Record<string, Record<string, BucketValue>>, nodeId);
    }
  }
  return index;
}

/** Resolve a TagDef label from a list of tags, including custom tags. */
export function resolveTagLabel(
  tagId: string,
  isCustom: boolean | undefined,
  customLabel: string | undefined,
  tags: TagDef[] | undefined,
): string {
  if (isCustom) return customLabel ?? tagId;
  return tags?.find((t) => t.id === tagId)?.label ?? tagId;
}

/** Resolve a secondary tag label from a primary tag's secondaries list. */
export function resolveSecLabel(secTagId: string, primaryTag: TagDef | undefined): string {
  return primaryTag?.secondaries?.find((s) => s.id === secTagId)?.label ?? secTagId;
}

/**
 * Extract key display rows from a single bucket value for the center card standard view.
 */
function extractBucketRows(
  bucket: BucketDef,
  bv: BucketValue,
  hexPrefix: string,
  hexIndex: Map<string, Set<string>>,
  elementId: string,
  bk: string,
): DesignElementTagRow[] {
  const rows: DesignElementTagRow[] = [];
  // For buckets that use disciplineGroups instead of a flat tags array,
  // build a flattened list so resolveTagLabel can find the friendly label.
  const effectiveTags: TagDef[] | undefined =
    bucket.tags ??
    (bucket.disciplineGroups
      ? bucket.disciplineGroups.flatMap((g) => g.tags)
      : undefined);
  function hexFor(tagId: string): { hexCount: number; hexIds: string[] } {
    const s = hexIndex.get(hexPrefix + tagId);
    return s ? { hexCount: s.size, hexIds: Array.from(s) } : { hexCount: 0, hexIds: [] };
  }

  // ── A1 ──────────────────────────────────────────────────────────────────────
  if (bv.archetypeA1) {
    for (const sel of bv.archetypeA1.selections ?? []) {
      const primaryTag = effectiveTags?.find((t) => t.id === sel.tagId);
      const primaryLabel = resolveTagLabel(sel.tagId, sel.isCustom, sel.customLabel, effectiveTags);
      const selectedSecs = sel.selectedSecondaries ?? [];

      if (sel.isKey) {
        // Primary is starred.
        const hex = hexFor(sel.tagId);
        if (selectedSecs.length > 0) {
          if (bucket.groupedSecondaryDisplay) {
            // "Primary (Sec1, Sec2)"
            const secLabels = selectedSecs.map((s) => resolveSecLabel(s.tagId, primaryTag));
            const label = `${primaryLabel} (${secLabels.join(", ")})`;
            rows.push({ label, ...hex, isTagType: true, dragPayload: { kind: "designElement", label, elementId, bucketKey: bk, tagId: sel.tagId, archetype: "A1" } });
          } else {
            // Show every selected secondary as its own bullet (their own hex).
            for (const sec of selectedSecs) {
              const secLabel = resolveSecLabel(sec.tagId, primaryTag);
              rows.push({ label: secLabel, ...hexFor(sec.tagId), isTagType: true, dragPayload: { kind: "designElement", label: secLabel, elementId, bucketKey: bk, tagId: sec.tagId, archetype: "A1" } });
            }
          }
        } else {
          // No secondaries selected — show the primary label.
          rows.push({ label: primaryLabel, ...hex, isTagType: true, dragPayload: { kind: "designElement", label: primaryLabel, elementId, bucketKey: bk, tagId: sel.tagId, archetype: "A1" } });
        }
      } else {
        // Primary is NOT starred — emit only individually starred secondaries.
        for (const sec of selectedSecs) {
          if (!sec.isKey) continue;
          const secLabel = resolveSecLabel(sec.tagId, primaryTag);
          rows.push({ label: secLabel, ...hexFor(sec.tagId), isTagType: true, dragPayload: { kind: "designElement", label: secLabel, elementId, bucketKey: bk, tagId: sec.tagId, archetype: "A1" } });
        }
      }
    }
  }

  // ── A2 ──────────────────────────────────────────────────────────────────────
  else if (bv.archetypeA2) {
    const a2 = bv.archetypeA2;
    if (a2.isKey && a2.selectedId) {
      const label = resolveTagLabel(a2.selectedId, a2.isCustom, a2.customLabel, effectiveTags);
      rows.push({ label, ...hexFor(a2.selectedId), isTagType: true, dragPayload: { kind: "designElement", label, elementId, bucketKey: bk, tagId: a2.selectedId, archetype: "A2" } });
    }
  }

  // ── A3 (single numeric) ──────────────────────────────────────────────────
  else if (bv.archetypeA3) {
    const a3 = bv.archetypeA3;
    if (a3.isKey && a3.value != null) {
      rows.push({ label: `${a3.value} ${a3.unit}`, hexCount: 0, hexIds: [] });
    }
  }

  // ── A3Pair ────────────────────────────────────────────────────────────────
  else if (bv.archetypeA3Pair) {
    const a3p = bv.archetypeA3Pair;
    if (a3p.isKey && (a3p.first != null || a3p.second != null)) {
      const [l0, l1] = bucket.pairLabels ?? ["First", "Second"];
      const parts: string[] = [];
      if (a3p.first != null) parts.push(`${a3p.first} ${l0}`);
      if (a3p.second != null) parts.push(`${a3p.second} ${l1}`);
      rows.push({ label: parts.join(" / "), hexCount: 0, hexIds: [] });
    }
  }

  // ── A4 ────────────────────────────────────────────────────────────────────
  else if (bv.archetypeA4) {
    const a4 = bv.archetypeA4;
    if (a4.isKey) {
      const parts: string[] = [];
      if (a4.days.length > 0) parts.push(a4.days.join(", "));
      if (a4.time) parts.push(`at ${a4.time}`);
      if (a4.recurrence) parts.push(`(${a4.recurrence})`);
      const label = parts.join(" ") || bucket.title;
      rows.push({ label, hexCount: 0, hexIds: [] });
    }
  }

  // ── A5 ────────────────────────────────────────────────────────────────────
  else if (bv.archetypeA5) {
    const a5 = bv.archetypeA5;
    if (a5.isKey && a5.text?.trim()) {
      rows.push({ label: bucket.title, hexCount: 0, hexIds: [], isEllipsis: true });
    }
  }

  return rows;
}

/**
 * Build the practices/tools rows for one element given the center's expert data
 * and the pre-built hex index.
 */
function buildElementCardRows(
  element: ElementDef,
  centerExpertData: Record<string, Record<string, BucketValue>>,
  hexIndex: Map<string, Set<string>>,
): { practices: DesignElementTagRow[]; tools: DesignElementTagRow[] } {
  const practices: DesignElementTagRow[] = [];
  const tools: DesignElementTagRow[] = [];
  const elementData = centerExpertData[element.id] ?? {};

  for (const question of element.questions) {
    const target = question.section === "tools" ? tools : practices;
    for (const bucket of question.buckets) {
      // Skip buckets that are ring-only or entirely hidden at center level
      if (bucket.ringOnly || bucket.hideAtCenter) continue;

      const bk = bucketKey(question.id, bucket.id);
      const rawBv: BucketValue | undefined = elementData[bk] as BucketValue | undefined;
      if (!rawBv) continue;

      // School Calendar: yearly schedule entries → show "School calendar …" if has content
      if (rawBv.yearlySchedule !== undefined) {
        const entries = rawBv.yearlySchedule?.entries ?? [];
        if (entries.length > 0) {
          // Deduplicate: only add once per element
          if (!practices.some((r) => r.label === "School calendar" && r.isEllipsis)) {
            practices.push({ label: "School calendar", hexCount: 0, hexIds: [], isEllipsis: true });
          }
        }
        continue;
      }
      // Marking periods → same "School calendar …" entry
      if (rawBv.markingPeriods !== undefined) {
        if (rawBv.markingPeriods?.periodType) {
          if (!practices.some((r) => r.label === "School calendar" && r.isEllipsis)) {
            practices.push({ label: "School calendar", hexCount: 0, hexIds: [], isEllipsis: true });
          }
        }
        continue;
      }

      const hexPrefix = `${element.id}::${bk}::`;
      const extracted = extractBucketRows(bucket, rawBv, hexPrefix, hexIndex, element.id, bk);
      target.push(...extracted);
    }
  }

  return { practices, tools };
}

function buildDesignElementCards(
  overall: any,
  ring: any[],
): DesignedExperiencePreview["designElements"] {
  const hexIndex = buildDesignElementHexIndex(ring);
  const centerExpertData: Record<string, Record<string, BucketValue>> =
    (overall?.designedExperienceData?.elementsExpertData as any) ?? {};

  return ALL_ELEMENTS.map((el) => {
    const { practices, tools } = buildElementCardRows(el, centerExpertData, hexIndex);
    return {
      id: el.id as DesignedExperiencePreview["designElements"][number]["id"],
      title: el.title,
      practices,
      tools,
    };
  });
}

/** @deprecated Now replaced by buildDesignElementCards — remove if no other reference. */
// const DESIGN_ELEMENTS was removed; buildDesignElementCards is used instead.

/** Map adult-design-schema role IDs to adult-experience-catalog role IDs. */
const ADULT_ROLE_TO_CATALOG_ROLE: Record<string, string | null> = {
  educators: "educator_exp",
  caregivers_families: "caregiver_exp",
  school_leaders_administrators: "school_leaders_admin",
  student_support_wellbeing_staff: "student_support_wellbeing",
  school_operations_support_staff: "school_ops_support",
  district_leaders_staff: "district_leadership",
  other_adults: null,
};

/** Resolve the adult catalog roleId for an adult ring component (via its catalog meta). */
function adultComponentCatalogRoleId(comp: any): string | null {
  const meta = comp?.designedExperienceData?.adultExperienceCatalogMeta;
  if (!meta) return null;
  const pick: AdultCatalogPick | undefined = ADULT_EXPERIENCE_PICKS.find(
    (p) => p.primaryId === meta.primaryId && p.secondaryId === meta.secondaryId,
  );
  return pick?.roleId ?? null;
}

const ADULT_PRIMARY_BY_ID = new Map<string, AdultPrimaryDef>();
for (const sec of ADULT_ROLE_SECTIONS) {
  for (const b of sec.buckets) {
    for (const p of b.primaries) ADULT_PRIMARY_BY_ID.set(p.id, p);
  }
}

const LEARNER_DEMOGRAPHIC_LABEL_BY_ID = new Map<string, string>();
for (const p of LEARNER_DEMOGRAPHIC_PRIMARIES) LEARNER_DEMOGRAPHIC_LABEL_BY_ID.set(p.id, p.label);

const FAC_BACKGROUND_LABEL_BY_ID = new Map<string, string>();
for (const t of TAGS_FAC_BACKGROUND) FAC_BACKGROUND_LABEL_BY_ID.set(t.id, t.label);

function tagLabelForId(map: Map<string, string>, id: string): string {
  return map.get(id) ?? id.replace(/_/g, " ");
}

/** Read the seven-role primary selections from `designedExperienceData.adultsProfile`. */
function readSelectedAdultPrimaryIds(de: any): string[] {
  const sel = de?.adultsProfile?.selections;
  if (!Array.isArray(sel)) return [];
  const ids: string[] = [];
  for (const s of sel) {
    const pid = String(s?.primaryId ?? "");
    if (!pid) continue;
    if (ADULT_PRIMARY_BY_ID.has(pid)) ids.push(pid);
  }
  // De-dupe, preserve order
  return Array.from(new Set(ids));
}

function buildAdultRoleSummaries(
  overallComp: any,
  ringComponents: any[],
): AdultRoleSummary[] {
  const de = overallComp?.designedExperienceData ?? {};
  const selectedRoleIds = readSelectedAdultPrimaryIds(de);
  if (selectedRoleIds.length === 0) return [];

  const sliceDetail: Record<string, any> = de?.adultsProfile?.sliceDetail ?? {};

  // Adult ring components grouped by catalog roleId.
  const adultRingsByRoleId = new Map<string, ComponentRef[]>();
  for (const comp of ringComponents) {
    if (ringExperienceAudience(comp) !== "adult") continue;
    const roleId = adultComponentCatalogRoleId(comp);
    if (!roleId) continue;
    if (!adultRingsByRoleId.has(roleId)) adultRingsByRoleId.set(roleId, []);
    adultRingsByRoleId.get(roleId)!.push({
      nodeId: String(comp?.nodeId ?? comp?.id ?? ""),
      title: String(comp?.title ?? "Untitled"),
    });
  }

  const out: AdultRoleSummary[] = [];
  for (const roleId of selectedRoleIds) {
    const def = ADULT_PRIMARY_BY_ID.get(roleId);
    if (!def) continue;
    const catalogRoleId = ADULT_ROLE_TO_CATALOG_ROLE[roleId] ?? null;
    const experiences = catalogRoleId ? adultRingsByRoleId.get(catalogRoleId) ?? [] : [];

    // Aggregate sliceDetail across every slice keyed under this primary (primary alone or primary::secondary).
    const sliceKeys = Object.keys(sliceDetail).filter(
      (k) => k === roleId || k.startsWith(`${roleId}::`),
    );
    const demoTags: string[] = [];
    const demoSeen = new Set<string>();
    const bgTags: string[] = [];
    const bgSeen = new Set<string>();
    let incomingText = "";
    let staffingText = "";
    for (const k of sliceKeys) {
      const slice = sliceDetail[k] ?? {};
      const demoSel: any[] = slice?.demographicsA1?.selections ?? [];
      for (const sel of demoSel) {
        const tagId = String(sel?.tagId ?? "");
        if (!tagId || demoSeen.has(tagId)) continue;
        demoSeen.add(tagId);
        demoTags.push(tagLabelForId(LEARNER_DEMOGRAPHIC_LABEL_BY_ID, tagId));
      }
      const bgSel: any[] = slice?.background?.selections ?? [];
      for (const sel of bgSel) {
        const tagId = String(sel?.tagId ?? "");
        if (!tagId || bgSeen.has(tagId)) continue;
        bgSeen.add(tagId);
        bgTags.push(tagLabelForId(FAC_BACKGROUND_LABEL_BY_ID, tagId));
      }
      const inc = String(slice?.incomingSkills?.text ?? "").trim();
      if (inc && !incomingText) incomingText = inc;
      const st = String(slice?.staffing?.text ?? "").trim();
      if (st && !staffingText) staffingText = st;
    }

    out.push({
      roleId,
      label: def.label,
      experiences,
      demographicTags: demoTags,
      incomingSkillsText: incomingText,
      backgroundTags: bgTags,
      staffingText,
    });
  }
  return out;
}

/**
 * Build the full DesignedExperiencePreview by walking the center component once and the
 * ring components once. Caller supplies the raw components list (already fetched).
 */
export function buildDesignedExperiencePreview(
  componentsRaw: any[],
  options?: { studentDemographics?: { currentAsOf: string | null; verified: boolean; hasData: boolean } },
): DesignedExperiencePreview {
  const list = Array.isArray(componentsRaw) ? componentsRaw : [];
  const overall = list.find((c) => String(c?.nodeId) === "overall");
  const ring = list.filter((c) => String(c?.nodeId) !== "overall");

  const de = overall?.designedExperienceData ?? {};
  const centerAims: AnyAim[] = de?.keyDesignElements?.aims ?? [];

  const { componentsByCategory, componentsByOutcomeKey, componentsByLeapLabel } = buildHexIndex(ring);

  const laCategories = buildCategorySummaries(
    centerAims,
    componentsByCategory,
    componentsByOutcomeKey,
    LEARNING_ADVANCEMENT_CATEGORIES,
  );
  const wcCategories = buildCategorySummaries(
    centerAims,
    componentsByCategory,
    componentsByOutcomeKey,
    WELLBEING_CONDUCT_CATEGORIES,
  );

  const portraitAttrs: any[] = de?.portraitOfGraduate?.attributes ?? [];
  const portrait = {
    attributes: portraitAttrs.map((a) => ({
      id: String(a?.id ?? ""),
      name: String(a?.name ?? ""),
      description: String(a?.description ?? ""),
      icon: String(a?.icon ?? ""),
    })).filter((a) => a.id && a.name),
  };

  const leaps = { rows: buildLeapRows(centerAims, componentsByLeapLabel) };

  const rawCommunity = de?.communityEcosystemOutcomes;
  const communityNormalized: CommunityEcosystemOutcome[] = normalizeCommunityEcosystemOutcomes(rawCommunity);
  const community = {
    outcomes: communityNormalized.map((o) => {
      const status = communityEcosystemStatus(o);
      const unitSuffix = o.metricUnit === "percent" ? "%" : "";
      const fmt = (n: number | null | undefined) =>
        n == null || Number.isNaN(n) ? "" : String(n);
      return {
        id: o.id,
        label: o.label,
        status,
        description: o.description ?? "",
        current: fmt(o.currentValue),
        target: fmt(o.targetValue),
        unitSuffix,
      };
    }),
  };

  // Learner ring components for student-experiences groupings.
  const learnerRing = ring.filter((c) => ringExperienceAudience(c) === "learner");
  const studentExperiences = buildStudentExperienceGroups(learnerRing);

  const adults = buildAdultRoleSummaries(overall, ring);

  return {
    studentDemographics: options?.studentDemographics ?? { currentAsOf: null, verified: false, hasData: false },
    targetedImpact: {
      learningAdvancement: {
        selectedCount: laCategories.reduce((s, c) => s + c.selectedCount, 0),
        categories: laCategories,
      },
      wellbeingConduct: {
        selectedCount: wcCategories.reduce((s, c) => s + c.selectedCount, 0),
        categories: wcCategories,
      },
      portrait,
      leaps,
      community,
    },
    studentExperiences,
    designElements: buildDesignElementCards(overall, ring),
    adults,
  };
}
