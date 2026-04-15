import type { ImplementationTopDimension } from "./implementation-subdimension-tree";
import type { OutcomeMeasure } from "./schema";
import { isLeapAimActive } from "./aim-selection";

/** Canonical six Leaps (must match `LEAP_SCHEMA["Level 1"]` in designed-experience-schemas). */
const LEVEL1: string[] = [
  "Whole-child focus",
  "Connection & community",
  "High expectations with rigorous learning",
  "Relevance",
  "Customization",
  "Agency",
];

function slugLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "leap";
}

function norm(s: string): string {
  return (s || "").trim().toLowerCase();
}

/** Stable id for each of the six canonical Leaps (tagging + weights). */
export const EXPERIENCE_FIXED_LEAP_SUBIDS: { id: string; label: string }[] = LEVEL1.map((label) => ({
  id: `exp-leap-${slugLabel(label)}`,
  label,
}));

const FIXED_LABEL_TO_ID = new Map<string, string>();
for (const row of EXPERIENCE_FIXED_LEAP_SUBIDS) {
  FIXED_LABEL_TO_ID.set(norm(row.label), row.id);
}

/**
 * Stable id for a leap / design-principle aim. Non-catalog labels always use a label slug so the same
 * principle matches across components (legacy per-aim `exp-aim-*` ids are remapped on load).
 */
export function experienceSubdimensionIdForAim(aim: { id?: string; label: string }): string {
  const label = String(aim.label || "");
  const fixed = FIXED_LABEL_TO_ID.get(norm(label));
  if (fixed) return fixed;
  return `exp-custom-${slugLabel(label)}`;
}

export function allExperienceFixedLeapIds(): string[] {
  return EXPERIENCE_FIXED_LEAP_SUBIDS.map((r) => r.id);
}

/** Leap aims from `keyDesignElements.aims` with `type === "leap"` → flat subdimension tops (empty children). */
export function experienceSubdimensionTopsFromLeapAims(
  aims: Array<{ type?: string; id?: string; label?: string }>,
): ImplementationTopDimension[] {
  const out: ImplementationTopDimension[] = [];
  const seen = new Set<string>();
  for (const a of Array.isArray(aims) ? aims : []) {
    if (String(a?.type || "") !== "leap" || typeof a?.label !== "string") continue;
    const id = experienceSubdimensionIdForAim({ id: a.id, label: a.label });
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: String(a.label).trim(),
      children: [],
    });
  }
  return out;
}

function leapAimsFromComponentTree(c: unknown): any[] {
  const out: any[] = [];
  const kde: any = (c as any)?.designedExperienceData?.keyDesignElements;
  const topAims: any[] = Array.isArray(kde?.aims) ? kde.aims : [];
  for (const a of topAims) out.push(a);
  const subs: any[] = Array.isArray((c as any)?.designedExperienceData?.subcomponents)
    ? (c as any).designedExperienceData.subcomponents
    : [];
  for (const s of subs) {
    const sa: any[] = Array.isArray(s?.aims) ? s.aims : [];
    for (const a of sa) out.push(a);
  }
  return out;
}

export function experienceHasLeapAimForTop(comp: unknown, topId: string): boolean {
  for (const a of leapAimsFromComponentTree(comp)) {
    if (a?.type !== "leap" || typeof a?.label !== "string") continue;
    if (experienceSubdimensionIdForAim(a) === topId) return true;
  }
  return false;
}

/** Custom design principles (`isCustom` leaps) defined on any component or subcomponent in the school. */
export function globalCustomDesignPrincipleTops(allComponents: unknown): ImplementationTopDimension[] {
  const seen = new Set<string>();
  const customs: ImplementationTopDimension[] = [];
  for (const c of Array.isArray(allComponents) ? allComponents : []) {
    for (const a of leapAimsFromComponentTree(c)) {
      if (String(a?.type || "") !== "leap" || !a?.isCustom) continue;
      const label = String(a.label || "").trim();
      if (!label) continue;
      const k = norm(label);
      if (seen.has(k)) continue;
      seen.add(k);
      customs.push({
        id: experienceSubdimensionIdForAim({ label }),
        label,
        children: [],
      });
    }
  }
  customs.sort((a, b) => a.label.localeCompare(b.label));
  return customs;
}

/**
 * Subdimensions for Status & Health / Experience score: the six core leaps (always) plus every
 * school-wide custom design principle. Scoring a row is optional (no measures → no contribution).
 */
export function experienceHealthSubdimensions(allComponents: unknown): ImplementationTopDimension[] {
  const fixed: ImplementationTopDimension[] = EXPERIENCE_FIXED_LEAP_SUBIDS.map((r) => ({
    id: r.id,
    label: r.label,
    children: [],
  }));
  return [...fixed, ...globalCustomDesignPrincipleTops(allComponents)];
}

/** H/M/L weights from this component's leap aims (component + subcomponents) for each health subdimension. */
export function experienceWeightsForComponent(
  comp: unknown,
  tops: ImplementationTopDimension[],
): Record<string, "H" | "M" | "L"> {
  const bySubId = new Map<string, any>();
  for (const a of leapAimsFromComponentTree(comp)) {
    if (a?.type !== "leap" || typeof a?.label !== "string" || !isLeapAimActive(a)) continue;
    bySubId.set(experienceSubdimensionIdForAim(a), a);
  }
  const o: Record<string, "H" | "M" | "L"> = {};
  for (const top of tops) {
    const aim = bySubId.get(top.id);
    if (aim) {
      const ol = aim.overrideLevel;
      o[top.id] = ol === "H" || ol === "M" || ol === "L" ? ol : "M";
    } else {
      o[top.id] = "M";
    }
  }
  return o;
}

/** Map legacy `exp-aim-<storedId>` tags on measures to label-based ids for this component's aims. */
export function remapExperienceSubdimensionIdsOnMeasures(measures: OutcomeMeasure[], comp: unknown): OutcomeMeasure[] {
  const idMap = new Map<string, string>();
  for (const a of leapAimsFromComponentTree(comp)) {
    if (a?.type !== "leap" || typeof a?.label !== "string") continue;
    const oldRaw = String(a.id || "").trim();
    if (!oldRaw) continue;
    const oldId = `exp-aim-${oldRaw}`;
    const newId = experienceSubdimensionIdForAim(a);
    if (oldId !== newId) idMap.set(oldId, newId);
  }
  if (idMap.size === 0) return measures;
  return measures.map((m) => ({
    ...m,
    subDimensionIds: (m.subDimensionIds || []).map((id) => idMap.get(id) || id),
  }));
}

export function defaultExperienceSubDimensionWeights(
  aims: Array<{ type?: string; id?: string; label?: string; overrideLevel?: string }>,
): Record<string, "H" | "M" | "L"> {
  const o: Record<string, "H" | "M" | "L"> = {};
  for (const a of Array.isArray(aims) ? aims : []) {
    if (String(a?.type || "") !== "leap" || typeof a?.label !== "string") continue;
    const id = experienceSubdimensionIdForAim({ id: a.id, label: a.label });
    const ol = a?.overrideLevel;
    if (ol === "H" || ol === "M" || ol === "L") o[id] = ol;
    else o[id] = "M";
  }
  return o;
}

export function experienceTagOptionsFromTops(tops: ImplementationTopDimension[]): { id: string; label: string }[] {
  return tops.map((t) => ({ id: t.id, label: t.label }));
}
