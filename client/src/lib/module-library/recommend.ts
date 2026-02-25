"use client";

import type { ModuleModel } from "./catalog";

export type BlueprintSignals = {
  outcomes: Set<string>;
  leaps: Set<string>;
  practices: Set<string>;
  supports: Set<string>;
};

export function extractBlueprintSignals(component: any | null | undefined): BlueprintSignals {
  const de: any = component?.designedExperienceData || {};
  const kde: any = de?.keyDesignElements || {};
  const aims: any[] = Array.isArray(kde.aims) ? kde.aims : [];
  const practices: any[] = Array.isArray(kde.practices) ? kde.practices : [];
  const supports: any[] = Array.isArray(kde.supports) ? kde.supports : [];

  const subs: any[] = Array.isArray(de.subcomponents) ? de.subcomponents : [];

  const out = {
    outcomes: new Set<string>(),
    leaps: new Set<string>(),
    practices: new Set<string>(),
    supports: new Set<string>(),
  };

  const addAim = (a: any) => {
    const type = String(a?.type || "").toLowerCase();
    const label = String(a?.label || "").trim();
    if (!label) return;
    if (type === "outcome") out.outcomes.add(label);
    else if (type === "leap") out.leaps.add(label);
  };

  aims.forEach(addAim);
  practices.forEach((p) => {
    const label = String(p?.label || "").trim();
    if (label) out.practices.add(label);
  });
  supports.forEach((s) => {
    const label = String(s?.label || "").trim();
    if (label) out.supports.add(label);
  });

  for (const sub of subs) {
    const subAims: any[] = Array.isArray(sub?.aims) ? sub.aims : [];
    const subPractices: any[] = Array.isArray(sub?.practices) ? sub.practices : [];
    const subSupports: any[] = Array.isArray(sub?.supports) ? sub.supports : [];
    subAims.forEach(addAim);
    subPractices.forEach((p) => {
      const label = String(p?.label || "").trim();
      if (label) out.practices.add(label);
    });
    subSupports.forEach((s) => {
      const label = String(s?.label || "").trim();
      if (label) out.supports.add(label);
    });
  }

  return out;
}

function overlapCount(a: Set<string>, b: string[]): number {
  let n = 0;
  for (const x of b) if (a.has(x)) n++;
  return n;
}

export type AlignmentLevel = "H" | "M" | "L";

function levelFromRatio(r: number): AlignmentLevel {
  if (r >= 0.5) return "H";
  if (r >= 0.25) return "M";
  return "L";
}

export function computeAlignment(model: ModuleModel, blueprint: BlueprintSignals): {
  aims: AlignmentLevel;
  practices: AlignmentLevel;
  supports: AlignmentLevel;
} {
  const aimsOverlap = overlapCount(blueprint.outcomes, model.outcomes) + overlapCount(blueprint.leaps, model.leaps);
  const aimsDenom = Math.max(1, blueprint.outcomes.size + blueprint.leaps.size);
  const practiceDenom = Math.max(1, blueprint.practices.size);
  const supportDenom = Math.max(1, blueprint.supports.size);

  const practiceOverlap = overlapCount(blueprint.practices, model.practices);
  const supportOverlap = overlapCount(blueprint.supports, model.supports);

  return {
    aims: levelFromRatio(aimsOverlap / aimsDenom),
    practices: levelFromRatio(practiceOverlap / practiceDenom),
    supports: levelFromRatio(supportOverlap / supportDenom),
  };
}

export type ModuleFilters = {
  outcomes: string[];
  leaps: string[];
  practices: string[];
  supports: string[];
};

export function modelMatchesAllFilters(model: ModuleModel, filters: ModuleFilters): boolean {
  const hasAll = (need: string[], have: string[]) => need.every((n) => have.includes(n));
  return (
    hasAll(filters.outcomes, model.outcomes) &&
    hasAll(filters.leaps, model.leaps) &&
    hasAll(filters.practices, model.practices) &&
    hasAll(filters.supports, model.supports)
  );
}

export function recommendModels({
  models,
  blueprint,
  filters,
  limit = 5,
}: {
  models: ModuleModel[];
  blueprint: BlueprintSignals;
  filters?: ModuleFilters;
  limit?: number;
}): ModuleModel[] {
  const base = filters ? models.filter((m) => modelMatchesAllFilters(m, filters)) : models;

  const scored = base
    .map((m) => {
      const aims = overlapCount(blueprint.outcomes, m.outcomes) + overlapCount(blueprint.leaps, m.leaps);
      const practices = overlapCount(blueprint.practices, m.practices);
      const supports = overlapCount(blueprint.supports, m.supports);

      // Weighted: aims are strongest signal, then practices, then supports.
      const score = aims * 3 + practices * 2 + supports * 1;
      return { m, score, aims, practices, supports };
    })
    .sort((a, b) => b.score - a.score || b.aims - a.aims || a.m.name.localeCompare(b.m.name));

  return scored.slice(0, limit).map((x) => x.m);
}

