/**
 * Community & ecosystem outcomes — center (overall) Designed Experience only.
 * Defaults + custom; metric direction is "higher is better" for all v1.
 */

export type CommunityEcosystemMetricUnit = "number" | "percent";

export type CommunityEcosystemOutcome = {
  id: string;
  label: string;
  kind: "default" | "custom";
  /** User-authored description / goals */
  description?: string;
  metricUnit: CommunityEcosystemMetricUnit;
  /** Parsed numbers; null/undefined means unset */
  currentValue?: number | null;
  targetValue?: number | null;
  /** Optional uploaded artifact (data URL + filename for prototype persistence) */
  artifactDataUrl?: string;
  artifactFileName?: string;
};

export const COMMUNITY_ECOSYSTEM_DEFAULTS: readonly { id: string; label: string }[] = [
  { id: "enrollment", label: "Enrollment" },
  { id: "staff_retention", label: "Staff retention" },
  { id: "caregiver_satisfaction", label: "Caregiver satisfaction" },
] as const;

export function normalizeCommunityEcosystemOutcomes(raw: unknown): CommunityEcosystemOutcome[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x: any): CommunityEcosystemOutcome => ({
      id: String(x.id || ""),
      label: String(x.label || ""),
      kind: x.kind === "custom" ? "custom" : "default",
      description: typeof x.description === "string" ? x.description : "",
      metricUnit: x.metricUnit === "percent" ? "percent" : "number",
      currentValue:
        x.currentValue === null || x.currentValue === undefined || x.currentValue === ""
          ? null
          : Number(x.currentValue),
      targetValue:
        x.targetValue === null || x.targetValue === undefined || x.targetValue === ""
          ? null
          : Number(x.targetValue),
      artifactDataUrl: typeof x.artifactDataUrl === "string" ? x.artifactDataUrl : undefined,
      artifactFileName: typeof x.artifactFileName === "string" ? x.artifactFileName : undefined,
    }))
    .filter((o) => o.id && o.label);
}

export type CommunityEcosystemStatusLabel = "Set targets" | "On track" | "Off track";

export function communityEcosystemStatus(o: CommunityEcosystemOutcome): CommunityEcosystemStatusLabel {
  const c = o.currentValue;
  const t = o.targetValue;
  if (c == null || Number.isNaN(c) || t == null || Number.isNaN(t)) return "Set targets";
  if (o.metricUnit === "percent") {
    const c2 = Math.min(100, Math.max(0, c));
    const t2 = Math.min(100, Math.max(0, t));
    if (c2 >= t2) return "On track";
    return "Off track";
  }
  if (c >= t) return "On track";
  return "Off track";
}
