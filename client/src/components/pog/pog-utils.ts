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

export function syncKeyAimsOutcomesFromPortrait(de: any, portrait: PortraitOfGraduate): any {
  const linked = listLinkedOutcomes(portrait);
  const linkedKeys = new Set(linked.map((l) => normKey(l)));

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
      out.push(a);
    }
  }

  // Add missing linked outcomes (as source:'pog'), but do NOT set level/priority.
  const existingKeys = new Set(out.filter((a) => a?.type === "outcome").map((a) => normKey(a?.label)).filter(Boolean));
  for (const label of linked) {
    const k = normKey(label);
    if (!k) continue;
    if (manualOutcomeKeys.has(k)) continue; // already manually present
    if (existingKeys.has(k)) continue;
    out.push({
      id: genId("aim"),
      type: "outcome",
      label,
      source: "pog",
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

