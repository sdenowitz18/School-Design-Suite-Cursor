import type { SupportGroupKey } from "./support-groups-config";

export function normKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export type SupportGroupItem = { label: string; applies: string; isKey?: boolean };

export type SupportGroupsState = Partial<
  Record<SupportGroupKey, { supports: SupportGroupItem[] }>
> & {
  _unassigned?: { supports: SupportGroupItem[] };
};

export type SupportDetailsState = Record<string, { keyConsistenciesGuidance: string }>;

export function getSupportGroupsFromDesignedExperience(de: any): SupportGroupsState {
  const raw = de?.supportGroups;
  if (!raw || typeof raw !== "object") return {};
  return raw as SupportGroupsState;
}

export function getSupportDetailsFromDesignedExperience(de: any): SupportDetailsState {
  const raw = de?.supportDetails;
  if (!raw || typeof raw !== "object") return {};
  return raw as SupportDetailsState;
}

export function ensureItemList(list: any): SupportGroupItem[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => ({
      label: String(x?.label ?? ""),
      applies: String(x?.applies ?? ""),
      isKey: !!x?.isKey,
    }))
    .filter((x) => x.label.trim().length > 0);
}

export function getGroupItems(groups: SupportGroupsState, key: SupportGroupKey): SupportGroupItem[] {
  return ensureItemList((groups as any)?.[key]?.supports);
}

export function setGroupItems(groups: SupportGroupsState, key: SupportGroupKey, items: SupportGroupItem[]): SupportGroupsState {
  return {
    ...(groups || {}),
    [key]: { supports: items },
  };
}

export function toggleGroupLabel(groups: SupportGroupsState, key: SupportGroupKey, label: string): SupportGroupsState {
  const clean = String(label || "").trim();
  if (!clean) return groups;
  const items = getGroupItems(groups, key);
  const idx = items.findIndex((i) => normKey(i.label) === normKey(clean));
  const next = idx >= 0 ? items.filter((_, i) => i !== idx) : [...items, { label: clean, applies: "", isKey: false }];
  return setGroupItems(groups, key, next);
}

export function setApplies(groups: SupportGroupsState, key: SupportGroupKey, label: string, applies: string): SupportGroupsState {
  const clean = String(label || "").trim();
  const items = getGroupItems(groups, key);
  const next = items.map((i) => (normKey(i.label) === normKey(clean) ? { ...i, applies } : i));
  return setGroupItems(groups, key, next);
}

export function getIsKeyForLabel(groups: SupportGroupsState, label: string): boolean {
  const k = normKey(label);
  if (!k) return false;
  for (const [groupKey, g] of Object.entries(groups || {})) {
    if (!g || typeof g !== "object") continue;
    const supports = ensureItemList((g as any).supports);
    const found = supports.find((x) => normKey(x.label) === k);
    if (found) return !!found.isKey;
  }
  return false;
}

export function setIsKeyForLabel(groups: SupportGroupsState, label: string, isKey: boolean): SupportGroupsState {
  const k = normKey(label);
  if (!k) return groups;
  const next: any = { ...(groups || {}) };
  for (const [groupKey, g] of Object.entries(groups || {})) {
    if (!g || typeof g !== "object") continue;
    const supports = ensureItemList((g as any).supports);
    const updated = supports.map((x) => (normKey(x.label) === k ? { ...x, isKey } : x));
    next[groupKey] = { supports: updated };
  }
  return next as SupportGroupsState;
}

export function keyMapFromGroups(groups: SupportGroupsState): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const [groupKey, g] of Object.entries(groups || {})) {
    if (!g || typeof g !== "object") continue;
    const supports = ensureItemList((g as any).supports);
    for (const s of supports) {
      const k = normKey(s.label);
      if (!k) continue;
      // Single “Key” flag at component level; keep it true if any occurrence is true.
      out.set(k, (out.get(k) ?? false) || !!s.isKey);
    }
  }
  return out;
}

export function unionLabelsFromGroups(groups: SupportGroupsState, includeUnassigned = true): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const clean = String(label || "").trim();
    if (!clean) return;
    const key = normKey(clean);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };

  for (const [k, g] of Object.entries(groups || {})) {
    if (k === "_unassigned") continue;
    if (!g || typeof g !== "object") continue;
    const supports = (g as any).supports;
    if (!Array.isArray(supports)) continue;
    for (const s of supports) add(s?.label);
  }
  if (includeUnassigned) {
    const u = groups?._unassigned?.supports;
    if (Array.isArray(u)) for (const s of u) add((s as any)?.label);
  }
  return out;
}

export function mergeSupportTags(
  existingSupportTags: any[],
  desiredLabels: string[],
  isKeyByLabel?: Map<string, boolean>,
): any[] {
  const byKey = new Map<string, any>();
  for (const t of Array.isArray(existingSupportTags) ? existingSupportTags : []) {
    const label = String(t?.label ?? "");
    const key = normKey(label);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, t);
  }

  const out: any[] = [];
  for (const label of desiredLabels) {
    const clean = String(label || "").trim();
    if (!clean) continue;
    const key = normKey(clean);
    const existing = byKey.get(key);
    const desiredIsKey = isKeyByLabel?.get(key);
    if (existing) {
      out.push({
        ...existing,
        label: clean,
        type: "support",
        isKey: desiredIsKey !== undefined ? desiredIsKey : existing?.isKey,
      });
    } else {
      out.push({
        id: `support_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "support",
        label: clean,
        isKey: desiredIsKey ?? false,
      });
    }
  }
  return out;
}

export type SupportUsageIndex = Map<string, { count: number; components: { nodeId: string; title: string }[] }>;

export function buildSupportUsageIndex(components: any[]): SupportUsageIndex {
  const byKey = new Map<string, { componentsByNodeId: Map<string, { nodeId: string; title: string }> }>();

  const add = (label: unknown, comp: any) => {
    const clean = String(label ?? "").trim();
    const key = normKey(clean);
    if (!key) return;
    const nodeId = String(comp?.nodeId || comp?.node_id || comp?.id || "");
    const title = String(comp?.title || comp?.name || nodeId || "Untitled");
    if (!nodeId) return;
    const cur = byKey.get(key) || { componentsByNodeId: new Map() };
    cur.componentsByNodeId.set(nodeId, { nodeId, title });
    byKey.set(key, cur);
  };

  for (const comp of components || []) {
    const de: any = comp?.designedExperienceData || {};
    const kde: any = de?.keyDesignElements || {};
    const supports: any[] = Array.isArray(kde?.supports) ? kde.supports : [];
    for (const s of supports) add(s?.label, comp);

    const subs: any[] = Array.isArray(de?.subcomponents) ? de.subcomponents : [];
    for (const sub of subs) {
      const sTags: any[] = Array.isArray(sub?.supports) ? sub.supports : [];
      for (const s of sTags) add(s?.label, comp);
    }
  }

  const out: SupportUsageIndex = new Map();
  const entries = Array.from(byKey.entries());
  for (let i = 0; i < entries.length; i++) {
    const k = entries[i][0];
    const v = entries[i][1];
    const list = Array.from(v.componentsByNodeId.values()) as { nodeId: string; title: string }[];
    list.sort((a, b) => a.title.localeCompare(b.title));
    out.set(k, { count: list.length, components: list });
  }
  return out;
}

