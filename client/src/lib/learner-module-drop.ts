import { computeRingPositions, uniqueNodeIdFromLabel } from "@/lib/canvas-placement";
import {
  defaultSnapshotForLearnerComponent,
  LEARNER_COMPONENT_COLOR_ROTATION,
} from "@/lib/learner-experience-create";
import { getCatalogPickByKey, type LECatalogPick } from "@/lib/learner-experience-catalog";
import { getAdultCatalogPickByKey, type AdultCatalogPick } from "@/lib/adult-experience-catalog";

export const LEARNER_MODULE_DRAG_MIME = "application/x-sds-learner-module";

export type ExperienceAudience = "learner" | "adult";

export type LearnerModuleDragPayload = { catalogKey: string; audience?: ExperienceAudience };

/** Shared shape for drag resolution (learner + adult catalogs). */
export type ModuleCatalogPick = LECatalogPick | AdultCatalogPick;

export function setLearnerModuleDragData(
  dt: DataTransfer,
  catalogKey: string,
  audience: ExperienceAudience = "learner",
) {
  const payload: LearnerModuleDragPayload = { catalogKey, audience };
  dt.setData(LEARNER_MODULE_DRAG_MIME, JSON.stringify(payload));
  dt.effectAllowed = "copy";
}

export function readLearnerModuleDrop(dt: DataTransfer): LearnerModuleDragPayload | null {
  try {
    const raw = dt.getData(LEARNER_MODULE_DRAG_MIME);
    if (!raw) return null;
    const o = JSON.parse(raw) as LearnerModuleDragPayload;
    if (o && typeof o.catalogKey === "string") {
      const audience: ExperienceAudience = o.audience === "adult" ? "adult" : "learner";
      return { catalogKey: o.catalogKey, audience };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function dataTransferHasLearnerModule(dt: DataTransfer): boolean {
  return Array.from(dt.types || []).includes(LEARNER_MODULE_DRAG_MIME);
}

export type AddRingPlacement = {
  slot: number;
  existingNodeIds: Set<string>;
  colorIndex: number;
};

/** Creates one ring component from a catalog pick; mutates `placement.existingNodeIds` with the new node id. */
export async function addRingComponentFromCatalogPick(
  pick: ModuleCatalogPick,
  mutateAsync: (body: Record<string, unknown>) => Promise<unknown>,
  placement: AddRingPlacement,
  audience: ExperienceAudience = "learner",
): Promise<void> {
  const nodeId = uniqueNodeIdFromLabel(pick.title, placement.existingNodeIds);
  placement.existingNodeIds.add(nodeId);
  const pos = computeRingPositions(placement.slot, 1)[0]!;
  const color =
    LEARNER_COMPONENT_COLOR_ROTATION[placement.colorIndex % LEARNER_COMPONENT_COLOR_ROTATION.length];
  const catalogMeta = {
    bucketId: pick.bucketId,
    primaryId: pick.primaryId,
    secondaryId: pick.secondaryId,
  };
  const roleId = "roleId" in pick ? (pick as any).roleId : undefined;
  const primaryAdultGroup = audience === "adult" && roleId
    ? CATALOG_ROLE_TO_ADULT_GROUP[roleId] || ""
    : "";
  await mutateAsync({
    nodeId,
    title: pick.title,
    subtitle: pick.subtitle,
    color,
    canvasX: pos.canvasX,
    canvasY: pos.canvasY,
    snapshotData: {
      ...defaultSnapshotForLearnerComponent(pick.title),
      ...(primaryAdultGroup ? { primaryAdultGroup } : {}),
    },
    designedExperienceData: {
      description: "",
      experienceAudience: audience,
      ...(audience === "adult"
        ? { adultExperienceCatalogMeta: catalogMeta }
        : { learnerExperienceCatalogMeta: catalogMeta }),
    },
    healthData: {},
  });
}

let subDropCounter = 0;
export function newSubcomponentId() {
  return `de_sub_${Date.now()}_${++subDropCounter}`;
}

const CATALOG_ROLE_TO_ADULT_GROUP: Record<string, string> = {
  educator_exp: "educators",
  caregiver_exp: "caregivers_families",
  school_leaders_admin: "school_leaders_administrators",
  student_support_wellbeing: "student_support_wellbeing_staff",
  school_ops_support: "school_operations_support_staff",
  district_leadership: "district_leaders_staff",
};

/** Build a subcomponent record from a catalog pick (same conceptual module as a ring component). */
export function subcomponentFromCatalogPick(pick: ModuleCatalogPick, audience: ExperienceAudience = "learner") {
  const catalogMeta = {
    bucketId: pick.bucketId,
    primaryId: pick.primaryId,
    secondaryId: pick.secondaryId,
  };
  const roleId = "roleId" in pick ? (pick as any).roleId : undefined;
  const primaryAdultGroup = audience === "adult" && roleId
    ? CATALOG_ROLE_TO_ADULT_GROUP[roleId] || ""
    : "";
  return {
    id: newSubcomponentId(),
    name: pick.title,
    description: pick.subtitle || "",
    aims: [],
    practices: [],
    supports: [],
    experienceAudience: audience,
    snapshotData: {
      ...(primaryAdultGroup ? { primaryAdultGroup } : {}),
    },
    ...(audience === "adult"
      ? { adultExperienceCatalogMeta: catalogMeta }
      : { learnerExperienceCatalogMeta: catalogMeta }),
  };
}

export function resolveCatalogPickFromDrop(
  dt: DataTransfer,
): { pick: ModuleCatalogPick; audience: ExperienceAudience } | null {
  const payload = readLearnerModuleDrop(dt);
  if (!payload) return null;
  const audience: ExperienceAudience = payload.audience === "adult" ? "adult" : "learner";
  if (audience === "adult") {
    const pick = getAdultCatalogPickByKey(payload.catalogKey);
    return pick ? { pick, audience: "adult" } : null;
  }
  const pick = getCatalogPickByKey(payload.catalogKey);
  return pick ? { pick, audience: "learner" } : null;
}
