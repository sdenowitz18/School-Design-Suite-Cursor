/**
 * The six core leaps from the product schema. Any other leap label is treated as a school-defined
 * design principle and uses soft-off (`selected: false`) instead of removal when deselected.
 */
const CANONICAL_LEAP_LABELS_LOWER = new Set([
  "whole-child focus",
  "connection & community",
  "high expectations with rigorous learning",
  "relevance",
  "customization",
  "agency",
]);

export function isCanonicalLeapLabel(label: unknown): boolean {
  const n = String(label ?? "").trim().toLowerCase();
  return n.length > 0 && CANONICAL_LEAP_LABELS_LOWER.has(n);
}

/** True when deselecting should set `selected: false` instead of deleting the aim row. */
export function leapAimUsesSoftDeselect(aim: { type?: string; label?: unknown; isCustom?: boolean }): boolean {
  if (!aim || String(aim.type) !== "leap") return false;
  if ((aim as { isCustom?: boolean }).isCustom) return true;
  return !isCanonicalLeapLabel(aim.label);
}

/**
 * Custom design principles (leaps with `isCustom`) can be turned off for a component with
 * `selected: false` while keeping the row in `aims` until the user deletes the principle.
 * Canonical leaps and outcomes use "remove from aims" when turned off; they omit `selected`.
 */
export function isLeapAimActive(a: { type?: string; selected?: boolean }): boolean {
  if (!a || String(a.type) !== "leap") return true;
  return a.selected !== false;
}

/** Include in targeting / rollup / "intended" chips when the aim applies to this component. */
export function isTargetingAimActive(a: { type?: string; selected?: boolean }): boolean {
  if (!a) return false;
  if (a.type === "leap" && a.selected === false) return false;
  return true;
}
