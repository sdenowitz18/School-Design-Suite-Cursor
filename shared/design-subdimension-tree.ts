import type { ImplementationTopDimension } from "./implementation-subdimension-tree";

/**
 * Seven flat design sub-dimensions (no sub-sub level). Same structural shape as
 * implementation tops with empty children for reuse of scoring helpers.
 */
export const DESIGN_SUBDIMENSION_TREE: ImplementationTopDimension[] = [
  {
    id: "design-richness-learner-impact",
    label: "Richness/robustness of targeted learners & learner impact",
    children: [],
  },
  {
    id: "design-completeness-learner-experience",
    label:
      "Completeness of the designed learner experience to enable the entire targeted learner impact for targeted learners, with choices across all elements of experience design",
    children: [],
  },
  {
    id: "design-quality-learner-leapiness",
    label:
      "Quality of the designed learner experience in terms of its 'Leapiness' (i.e., extent to which it will create an experience for all targeted learners to the right of all six Leaps)",
    children: [],
  },
  {
    id: "design-completeness-adult-experience",
    label:
      "Completeness of designed adult experience to enable the entire learner experience, with choices across all elements of experience design",
    children: [],
  },
  {
    id: "design-tools-resources",
    label:
      "Quality & completeness of the tools & resources compiled across the various elements of experience design to deliver on the designed learner and adult experiences",
    children: [],
  },
  {
    id: "design-coherence-choices",
    label:
      "Coherence of design choices (i.e., compatible and mutually reinforcing) in the part of the design being focused on, within and across the various elements of experience design",
    children: [],
  },
  {
    id: "design-alignment-context",
    label:
      "Alignment of design choices to the community's conditions and context, and (for components) to the rest of the learning environment design, within and across the various elements of experience design",
    children: [],
  },
];

export function allDesignWeightedIds(): string[] {
  return DESIGN_SUBDIMENSION_TREE.map((d) => d.id);
}

export function allDesignTagOptions(): { id: string; label: string }[] {
  return DESIGN_SUBDIMENSION_TREE.map((d) => ({ id: d.id, label: d.label }));
}

/** Multiple design tags → overall design score only (untagged). */
export function classifyDesignMultiTagSelection(selectedIds: string[]): "single" | "overall_design" {
  const uniq = Array.from(new Set(selectedIds.filter(Boolean)));
  if (uniq.length <= 1) return "single";
  return "overall_design";
}
