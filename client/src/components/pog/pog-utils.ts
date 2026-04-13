"use client";

import type { PortraitAttribute, PortraitAttributeLink, PortraitOfGraduate } from "./pog-types";

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizePortrait(raw: any): PortraitOfGraduate {
  const attrsRaw: any[] = Array.isArray(raw?.attributes) ? raw.attributes : [];
  const attributes: PortraitAttribute[] = attrsRaw
    .map((a: any) => ({
      id: String(a?.id || genId("pog_attr")),
      name: String(a?.name || "").trim(),
      description: String(a?.description || "").trim(),
      icon: String(a?.icon || "★").trim() || "★",
      score1to5:
        a?.score1to5 === 1 || a?.score1to5 === 2 || a?.score1to5 === 3 || a?.score1to5 === 4 || a?.score1to5 === 5
          ? a.score1to5
          : null,
      builtPercent:
        a?.builtPercent === 0 || a?.builtPercent === 25 || a?.builtPercent === 50 || a?.builtPercent === 75 || a?.builtPercent === 100
          ? a.builtPercent
          : null,
    }))
    .filter((a) => a.name.length > 0);

  const linksRaw: any = raw?.linksByAttributeId && typeof raw.linksByAttributeId === "object" ? raw.linksByAttributeId : {};
  const linksByAttributeId: Record<string, PortraitAttributeLink[]> = {};
  for (const a of attributes) {
    const list: any[] = Array.isArray(linksRaw[a.id]) ? linksRaw[a.id] : [];
    const cleaned: PortraitAttributeLink[] = list
      .map((l: any) => ({
        outcomeLabel: String(l?.outcomeLabel || "").trim(),
        priority: l?.priority === "H" || l?.priority === "M" || l?.priority === "L" ? l.priority : "M",
      }))
      .filter((l) => l.outcomeLabel.length > 0);
    // dedupe by outcome label key
    const seen = new Set<string>();
    linksByAttributeId[a.id] = cleaned.filter((l) => {
      const k = normKey(l.outcomeLabel);
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  return { attributes, linksByAttributeId };
}

/** Clear all outcome links per attribute (keeps attributes). */
export function stripPortraitOutcomeLinks(portrait: PortraitOfGraduate): PortraitOfGraduate {
  const linksByAttributeId: Record<string, PortraitAttributeLink[]> = {};
  for (const a of portrait.attributes || []) {
    linksByAttributeId[a.id] = [];
  }
  return { ...portrait, linksByAttributeId };
}

/** Remove center aims that were auto-added from Portrait ↔ outcome sync. */
export function stripPogSourcedOutcomesFromKeyDesignElements(kde: any): any {
  const base = kde || { aims: [], practices: [], supports: [] };
  const aims = (Array.isArray(base.aims) ? base.aims : []).filter(
    (a: any) => !(a?.type === "outcome" && a?.source === "pog"),
  );
  return { ...base, aims };
}

export type WhereBuiltComponent = {
  nodeId: string;
  title: string;
  outcomes: string[];
};

export function buildWhereBuiltForOutcomeKeys(
  components: any[],
  targetOutcomeKeys: Set<string>,
): WhereBuiltComponent[] {
  const out: WhereBuiltComponent[] = [];
  for (const comp of Array.isArray(components) ? components : []) {
    const nodeId = String(comp?.nodeId || comp?.node_id || "");
    if (!nodeId) continue;
    if (nodeId === "overall") continue; // Exclude Whole School from "where built"
    const title = String(comp?.title || nodeId || "Component");
    const found = new Map<string, string>();

    const aims = comp?.designedExperienceData?.keyDesignElements?.aims || [];
    for (const a of Array.isArray(aims) ? aims : []) {
      if (a?.type !== "outcome") continue;
      const label = String(a?.label || "").trim();
      const k = normKey(label);
      if (!k || !targetOutcomeKeys.has(k)) continue;
      found.set(k, label);
    }

    // For now, "where built" only considers key aims outcomes.

    const outcomes = Array.from(found.values()).sort((a, b) => a.localeCompare(b));
    if (outcomes.length > 0) out.push({ nodeId, title, outcomes });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

export function listLinkedOutcomes(p: PortraitOfGraduate): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const links of Object.values(p.linksByAttributeId || {})) {
    for (const l of Array.isArray(links) ? links : []) {
      const clean = String(l?.outcomeLabel || "").trim();
      const k = normKey(clean);
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(clean);
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function listLinkedOutcomesWithPriority(p: PortraitOfGraduate): { label: string; key: string }[] {
  const byKey = new Map<string, { label: string }>();
  for (const links of Object.values(p.linksByAttributeId || {})) {
    for (const l of Array.isArray(links) ? links : []) {
      const label = String((l as any)?.outcomeLabel || "").trim();
      const key = normKey(label);
      if (!key) continue;
      const cur = byKey.get(key) || { label };
      byKey.set(key, cur);
    }
  }
  return Array.from(byKey.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function syncKeyAimsOutcomesFromPortrait(de: any, portrait: PortraitOfGraduate): any {
  const linked = listLinkedOutcomesWithPriority(portrait);
  const linkedKeys = new Set(linked.map((l) => l.key));

  const kde: any = de?.keyDesignElements || { aims: [], practices: [], supports: [] };
  const aims: any[] = Array.isArray(kde.aims) ? kde.aims : [];

  const out: any[] = [];
  const manualOutcomeKeys = new Set<string>();
  for (const a of aims) {
    if (a?.type === "outcome") {
      const k = normKey(a?.label);
      if (k && a?.source !== "pog") manualOutcomeKeys.add(k);
    }
  }

  // Keep existing non-POG tags; keep POG tags only if still linked.
  for (const a of aims) {
    if (a?.type !== "outcome") {
      out.push(a);
      continue;
    }
    const k = normKey(a?.label);
    const isPog = a?.source === "pog";
    if (!isPog) {
      out.push(a);
      continue;
    }
    if (k && linkedKeys.has(k) && !manualOutcomeKeys.has(k)) {
      out.push({
        ...a,
        // Portrait links no longer drive center-level priority.
        level: a?.level ?? null,
      });
    }
  }

  // Add missing linked outcomes (as source:'pog') with no priority level.
  const existingKeys = new Set(out.filter((a) => a?.type === "outcome").map((a) => normKey(a?.label)).filter(Boolean));
  for (const item of linked) {
    const k = item.key;
    if (!k) continue;
    if (manualOutcomeKeys.has(k)) continue; // already manually present
    if (existingKeys.has(k)) continue;
    out.push({
      id: genId("aim"),
      type: "outcome",
      label: item.label,
      source: "pog",
      level: null,
    });
    existingKeys.add(k);
  }

  return {
    ...(de || {}),
    keyDesignElements: {
      ...kde,
      aims: out,
    },
  };
}

