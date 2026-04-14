/** Top-level implementation score dimensions (each may have optional sub-sub-dimensions). */

export interface ImplementationSubSub {
  id: string;
  label: string;
}

export interface ImplementationTopDimension {
  id: string;
  label: string;
  children: ImplementationSubSub[];
}

export const IMPLEMENTATION_SUBDIMENSION_TREE: ImplementationTopDimension[] = [
  {
    id: "impl-plan-approach",
    label: "Implementation plan & approach",
    children: [],
  },
  {
    id: "impl-feasibility-sustainability",
    label: "Perceived feasibility / sustainability",
    children: [],
  },
  {
    id: "impl-skillfulness-learner-experience",
    label: "Skillfulness of instruction and facilitating the learner experience",
    children: [
      {
        id: "impl-skill-learner-classroom-delivery-outcomes",
        label: "Strong classroom mgmt, instructional delivery, and driving to outcomes",
      },
      {
        id: "impl-skill-learner-inspire-motivate-engagement",
        label: "Inspires, motivates, & fosters appreciation & healthy engagement",
      },
    ],
  },
  {
    id: "impl-students-enrollment-attendance",
    label: "Students involved / enrollment & attendance, relative to designed targets",
    children: [],
  },
  {
    id: "impl-fidelity-design",
    label: "Fidelity to design",
    children: [
      {
        id: "impl-fidelity-learner-experience",
        label: "Fidelity to designed learner experience",
      },
      {
        id: "impl-fidelity-adult-experience",
        label: "Fidelity to designed adult experience",
      },
    ],
  },
  {
    id: "impl-skillfulness-adult-experience",
    label: "Skillfulness of facilitating the adult experience",
    children: [],
  },
  {
    id: "impl-measurement-admin-quality",
    label: "Measurement administration quality",
    children: [],
  },
];

const _childToParent = new Map<string, string>();
for (const top of IMPLEMENTATION_SUBDIMENSION_TREE) {
  for (const c of top.children) {
    _childToParent.set(c.id, top.id);
  }
}

export function getImplementationTopById(id: string): ImplementationTopDimension | undefined {
  return IMPLEMENTATION_SUBDIMENSION_TREE.find((t) => t.id === id);
}

export function getImplementationParentIdForChild(childId: string): string | undefined {
  return _childToParent.get(childId);
}

/** Top-level owner id for any weighted tag (child → parent; top → self). */
export function implementationOwnerTopId(dimId: string): string | undefined {
  const parent = getImplementationParentIdForChild(dimId);
  if (parent) return parent;
  return getImplementationTopById(dimId)?.id;
}

/**
 * When multiple tags are selected on an implementation measure, decide rollup scope.
 * - Same parent top only → score as that sub-dimension overall (collapse to parent id).
 * - Multiple different tops → overall implementation (untagged at sub-dimension level).
 */
export function classifyImplementationMultiTagSelection(selectedIds: string[]):
  | { kind: "single" }
  | { kind: "parent_overall"; parentId: string; parentLabel: string }
  | { kind: "full_implementation" } {
  const uniq = Array.from(new Set(selectedIds.filter(Boolean)));
  if (uniq.length <= 1) return { kind: "single" };

  const owners = new Set<string>();
  for (const id of uniq) {
    const o = implementationOwnerTopId(id);
    if (o) owners.add(o);
  }
  if (owners.size > 1) return { kind: "full_implementation" };

  const parentId = Array.from(owners)[0]!;
  const top = getImplementationTopById(parentId);
  return {
    kind: "parent_overall",
    parentId,
    parentLabel: top?.label ?? parentId,
  };
}

/** All dimension ids that carry a sub-dimension weight (7 tops + 4 sub-subs). */
export function allImplementationWeightedIds(): string[] {
  const out: string[] = [];
  for (const top of IMPLEMENTATION_SUBDIMENSION_TREE) {
    out.push(top.id);
    for (const c of top.children) out.push(c.id);
  }
  return out;
}

/** Flat list of leaf ids (sub-subs + tops with no children). */
export function allImplementationLeafIds(): string[] {
  const out: string[] = [];
  for (const top of IMPLEMENTATION_SUBDIMENSION_TREE) {
    if (top.children.length === 0) out.push(top.id);
    else for (const c of top.children) out.push(c.id);
  }
  return out;
}

/** Labels for any id that can be tagged on a measure (parents + sub-subs). */
export function allImplementationTagOptions(): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const top of IMPLEMENTATION_SUBDIMENSION_TREE) {
    out.push({ id: top.id, label: top.label });
    for (const c of top.children) out.push({ id: c.id, label: c.label });
  }
  return out;
}
