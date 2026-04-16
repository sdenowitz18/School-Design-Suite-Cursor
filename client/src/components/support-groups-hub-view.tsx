import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { SUPPORT_SCHEMA } from "./designed-experience-schemas";
import { SchemaPickerSheet } from "./de-schema-picker-sheet";
import { SUPPORT_GROUPS, type SupportGroupKey } from "./support-groups-config";
import {
  getIsKeyForLabel,
  getSupportGroupsFromDesignedExperience,
  getGroupItems,
  keyMapFromGroups,
  mergeSupportTags,
  normKey,
  setIsKeyForLabel,
  toggleGroupLabel,
  unionLabelsFromGroups,
} from "./supports-utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SupportGroupsHubView({
  nodeId,
  title,
  onBack,
  onOpenGroup,
  onOpenSupport,
  hideShellBackButton = false,
}: {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  onOpenGroup: (key: SupportGroupKey) => void;
  onOpenSupport?: (groupKey: SupportGroupKey, label: string) => void;
  hideShellBackButton?: boolean;
}) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupsRef = useRef<any>({});
  const compRef = useRef<any>(null);

  const [groups, setGroups] = useState(() => getSupportGroupsFromDesignedExperience(null));
  const [initialized, setInitialized] = useState(false);

  const componentTitle = title || (comp as any)?.title || "Component";

  useEffect(() => {
    compRef.current = comp;
  }, [comp]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    if (!comp || initialized) return;
    const de: any = (comp as any).designedExperienceData || {};
    const kde: any = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const existingSupports: any[] = Array.isArray(kde.supports) ? kde.supports : [];

    const rawGroups = getSupportGroupsFromDesignedExperience(de);
    const { _unassigned: _oldUnassigned, ...rawGroupsNoUnassigned } = rawGroups as any;
    const existingLabels = existingSupports.map((s) => String(s?.label || "")).filter(Boolean);

    // Auto-assign any legacy selected supports into the first group so nothing “disappears”.
    const grouped = new Set(unionLabelsFromGroups(rawGroupsNoUnassigned, false).map(normKey));
    const bySupportKey = new Map<string, any>();
    for (const s of existingSupports) {
      const k = normKey(s?.label);
      if (k) bySupportKey.set(k, s);
    }

    const legacyMissing = existingLabels.filter((l) => !grouped.has(normKey(l)));
    const firstGroupKey = SUPPORT_GROUPS[0]?.key;
    const firstItems = firstGroupKey ? getGroupItems(rawGroupsNoUnassigned, firstGroupKey).slice() : [];
    for (const label of legacyMissing) {
      const k = normKey(label);
      if (!k) continue;
      if (firstItems.some((x) => normKey(x.label) === k)) continue;
      const isKey = !!bySupportKey.get(k)?.isKey;
      firstItems.push({ label: String(label || "").trim(), applies: "", isKey });
    }
    const next = firstGroupKey ? { ...rawGroupsNoUnassigned, [firstGroupKey]: { supports: firstItems } } : rawGroupsNoUnassigned;
    setGroups(next as any);
    setInitialized(true);
  }, [comp, initialized]);

  const commitSave = useCallback(
    (nextGroups: any) => {
      const c = compRef.current;
      if (!nodeId || !c) return;
      const de: any = (c as any).designedExperienceData || {};
      const kde: any = de.keyDesignElements || { aims: [], practices: [], supports: [] };

      const desiredLabels = unionLabelsFromGroups(nextGroups, false);
      const isKeyByLabel = keyMapFromGroups(nextGroups);
      const mergedSupportTags = mergeSupportTags(Array.isArray(kde.supports) ? kde.supports : [], desiredLabels, isKeyByLabel);

      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            supportGroups: nextGroups,
            keyDesignElements: { ...kde, supports: mergedSupportTags },
          },
        },
      });
    },
    [nodeId, updateMutation],
  );

  const doSave = useCallback(
    (nextGroups: any) => {
      if (!nodeId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        commitSave(nextGroups);
      }, 500);
    },
    [commitSave, nodeId],
  );

  useEffect(() => {
    if (!initialized) return;
    doSave(groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, initialized]);

  useEffect(() => {
    return () => {
      // Flush pending debounced save on navigation away.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        commitSave(groupsRef.current);
      }
    };
  }, [commitSave]);

  const totalSelected = useMemo(() => unionLabelsFromGroups(groups, false).length, [groups]);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="support-groups-hub">
      {!hideShellBackButton ? (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">Supports</h2>
              <p className="text-sm text-gray-500 mt-0.5">{componentTitle}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-600">
              {totalSelected} selected
            </Badge>
          </div>
        </div>
        <div className="p-4 text-xs text-gray-600">
          Organize supports into the seven implementation groups below. You can add supports to each group, then click into a group to add “how it applies” notes.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SUPPORT_GROUPS.map((g, idx) => {
          const items = getGroupItems(groups, g.key).sort((a, b) => a.label.localeCompare(b.label));
          const count = items.length;
          const isLast = idx === SUPPORT_GROUPS.length - 1;
          return (
            <div
              key={g.key}
              className={cn(
                "border rounded-xl bg-gray-50/50 p-3 flex flex-col",
                "shadow-sm ring-1 ring-black/5 border-gray-200",
                isLast && "md:col-span-3",
              )}
              data-testid={`support-group-card-${g.key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <button type="button" className="min-w-0 text-left" onClick={() => onOpenGroup(g.key)}>
                  <h3 className="font-semibold text-gray-900 text-xs uppercase tracking-wide truncate">
                    {g.title}
                  </h3>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                    {count}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-gray-500 hover:text-gray-900 px-2 rounded-full border border-gray-200 bg-white"
                    onClick={() => onOpenGroup(g.key)}
                    data-testid={`support-group-open-${g.key}`}
                  >
                    Open
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 mb-2 line-clamp-2">{g.subtitle}</div>

              <ScrollArea className={cn("w-full", isLast ? "max-h-[160px]" : "max-h-[220px]")}>
                <div className="flex flex-wrap gap-1">
                  {items.map((it) => (
                    <button
                      key={normKey(it.label)}
                      type="button"
                      onClick={() => onOpenSupport?.(g.key, it.label)}
                      className="max-w-full text-left"
                      data-testid={`support-chip-${g.key}-${normKey(it.label)}`}
                    >
                      <Badge
                      key={normKey(it.label)}
                      variant="outline"
                      className="bg-white text-gray-700 border-gray-200 text-[11px] font-medium px-2 py-0.5 hover:bg-gray-50 cursor-pointer"
                      title={it.label}
                    >
                      <span className="truncate max-w-[220px]">{it.label}</span>
                    </Badge>
                    </button>
                  ))}
                  {items.length === 0 && <p className="text-xs text-gray-400 italic">No supports yet</p>}
                </div>
              </ScrollArea>

              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-200">
                <SchemaPickerSheet
                  title={`Select supports: ${g.title}`}
                  description="Add or remove supports in this group."
                  schema={SUPPORT_SCHEMA}
                  selectedLabels={items.map((x) => x.label)}
                  onToggle={(label) => {
                    setGroups((prev) => toggleGroupLabel(prev, g.key, label));
                  }}
                  getIsKey={(label) => getIsKeyForLabel(groups, label)}
                  onSetIsKey={(label, isKey) => setGroups((prev) => setIsKeyForLabel(prev, label, isKey))}
                  type="support"
                  triggerLabel="Supports"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

