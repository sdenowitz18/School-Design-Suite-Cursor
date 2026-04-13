import { computeRingPositions, uniqueNodeIdFromLabel } from "@/lib/canvas-placement";
import {
  defaultSnapshotForLearnerComponent,
  LEARNER_COMPONENT_COLOR_ROTATION,
} from "@/lib/learner-experience-create";

export const LEGACY_ADULT_SUBS_MIGRATION_KEY = "sds-migrated-overall-adult-subcomponents-v1";
export const LEGACY_ADULT_SUBS_MIGRATION_BUSY_KEY = `${LEGACY_ADULT_SUBS_MIGRATION_KEY}:busy`;

/** One-time: turn legacy overall `adultSubcomponents` into adult `experienceAudience` ring components. */
export function scheduleMigrateLegacyOverallAdultSubcomponents(opts: {
  overallDesignedExperience: Record<string, unknown> | undefined;
  allRings: any[];
  createMutateAsync: (body: Record<string, unknown>) => Promise<unknown>;
  updateMutateAsync: (args: { nodeId: string; data: Record<string, unknown> }) => Promise<unknown>;
}): void {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(LEGACY_ADULT_SUBS_MIGRATION_KEY) === "1") return;

  const de = opts.overallDesignedExperience ?? {};
  const legacy: any[] = Array.isArray((de as any).adultSubcomponents) ? (de as any).adultSubcomponents : [];
  if (legacy.length === 0) {
    sessionStorage.setItem(LEGACY_ADULT_SUBS_MIGRATION_KEY, "1");
    return;
  }
  if (sessionStorage.getItem(LEGACY_ADULT_SUBS_MIGRATION_BUSY_KEY) === "1") return;
  sessionStorage.setItem(LEGACY_ADULT_SUBS_MIGRATION_BUSY_KEY, "1");

  const run = async () => {
    try {
      const idSet = new Set(opts.allRings.map((c: any) => String(c.nodeId)));
      let slot = opts.allRings.length;
      for (const sub of legacy) {
        const name = String(sub?.name || "").trim() || "Adult module";
        const nodeId = uniqueNodeIdFromLabel(name, idSet);
        idSet.add(nodeId);
        const pos = computeRingPositions(slot, 1)[0]!;
        const color = LEARNER_COMPONENT_COLOR_ROTATION[slot % LEARNER_COMPONENT_COLOR_ROTATION.length];
        slot += 1;
        const base = defaultSnapshotForLearnerComponent(name);
        const catalogMeta = sub.adultExperienceCatalogMeta;
        await opts.createMutateAsync({
          nodeId,
          title: name,
          subtitle: String(sub?.description || "").slice(0, 200),
          color,
          canvasX: pos.canvasX,
          canvasY: pos.canvasY,
          snapshotData: { ...base, description: String(sub?.description || "").trim() || base.description },
          designedExperienceData: {
            description: String(sub?.description || "").trim(),
            experienceAudience: "adult",
            ...(catalogMeta && typeof catalogMeta === "object"
              ? { adultExperienceCatalogMeta: catalogMeta }
              : {}),
          },
          healthData: {},
        });
      }
      await opts.updateMutateAsync({
        nodeId: "overall",
        data: { designedExperienceData: { ...de, adultSubcomponents: [] } },
      });
      sessionStorage.setItem(LEGACY_ADULT_SUBS_MIGRATION_KEY, "1");
    } finally {
      sessionStorage.removeItem(LEGACY_ADULT_SUBS_MIGRATION_BUSY_KEY);
    }
  };

  void run();
}
