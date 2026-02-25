import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { SUPPORT_SCHEMA } from "./designed-experience-schemas";
import { SchemaPickerSheet } from "./de-schema-picker-sheet";
import { SUPPORT_GROUPS, type SupportGroupKey } from "./support-groups-config";
import {
  buildSupportUsageIndex,
  getIsKeyForLabel,
  getGroupItems,
  getSupportGroupsFromDesignedExperience,
  keyMapFromGroups,
  mergeSupportTags,
  normKey,
  setApplies,
  setIsKeyForLabel,
  toggleGroupLabel,
  unionLabelsFromGroups,
} from "./supports-utils";

import artifactDoc from "@/assets/images/artifact-doc.png";
import artifactSlide from "@/assets/images/artifact-slide.png";
import artifactRubric from "@/assets/images/artifact-rubric.png";

interface Artifact {
  id: string;
  title: string;
  type: "doc" | "video" | "link";
  thumbnail: string;
}

const FEATURED_ARTIFACTS: Artifact[] = [
  { id: "a1", title: "Curriculum Overview", type: "doc", thumbnail: artifactDoc },
  { id: "a2", title: "Scope & Sequence Snapshot", type: "doc", thumbnail: artifactSlide },
  { id: "a3", title: "Assessment Calibration", type: "doc", thumbnail: artifactRubric },
  { id: "a4", title: "Implementation Look-Fors", type: "doc", thumbnail: artifactDoc },
];

const ArtifactCard = ({ artifact }: { artifact: Artifact }) => (
  <div className="flex flex-col w-[170px] group cursor-pointer shrink-0">
    <div className="relative aspect-[4/3] bg-gray-100 rounded-md border border-gray-200 overflow-hidden transition-all group-hover:shadow-md group-hover:border-gray-300">
      <img src={artifact.thumbnail} alt={artifact.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
    </div>
    <div className="mt-2 space-y-1">
      <h4 className="text-xs font-medium text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
        {artifact.title}
      </h4>
      <div className="text-[10px] text-gray-500 bg-gray-50 px-1 py-0.5 rounded border border-gray-100 inline-block">
        {artifact.type.toUpperCase()}
      </div>
    </div>
  </div>
);

export default function SupportGroupDetailView({
  nodeId,
  title,
  groupKey,
  onBack,
  onOpenSupport,
}: {
  nodeId?: string;
  title?: string;
  groupKey: SupportGroupKey;
  onBack: () => void;
  onOpenSupport: (label: string) => void;
}) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const { data: allComponents } = useQuery(componentQueries.all);
  const updateMutation = useUpdateComponent();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupsRef = useRef<any>({});
  const compRef = useRef<any>(null);

  const [groups, setGroups] = useState(() => getSupportGroupsFromDesignedExperience(null));
  const [initialized, setInitialized] = useState(false);

  const componentTitle = title || (comp as any)?.title || "Component";
  const groupMeta = SUPPORT_GROUPS.find((g) => g.key === groupKey);

  useEffect(() => {
    compRef.current = comp;
  }, [comp]);

  useEffect(() => {
    if (!comp || initialized) return;
    const de: any = (comp as any).designedExperienceData || {};
    const raw = getSupportGroupsFromDesignedExperience(de);
    const { _unassigned: _oldUnassigned, ...next } = raw as any;
    setGroups(next);
    setInitialized(true);
  }, [comp, initialized]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  const usageIndex = useMemo(() => {
    const list = Array.isArray(allComponents) ? allComponents : [];
    return buildSupportUsageIndex(list);
  }, [allComponents]);

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

  const items = useMemo(() => getGroupItems(groups, groupKey).sort((a, b) => a.label.localeCompare(b.label)), [groupKey, groups]);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="support-group-detail">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to supports
      </button>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{groupMeta?.title || "Support group"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{componentTitle}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5 bg-gray-200 text-gray-600 shrink-0">
            {items.length}
          </Badge>
        </div>
        {groupMeta?.subtitle ? <div className="p-4 text-xs text-gray-600">{groupMeta.subtitle}</div> : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3" data-testid="support-group-artifacts">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Featured artifacts</div>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
            View all
          </Button>
        </div>
        <ScrollArea className="w-full whitespace-nowrap pb-3">
          <div className="flex gap-4">
            {FEATURED_ARTIFACTS.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
            <div className="flex flex-col w-[170px] group cursor-pointer shrink-0">
              <div className="relative aspect-[4/3] bg-gray-50 rounded-md border border-dashed border-gray-300 flex items-center justify-center transition-colors group-hover:bg-gray-100 group-hover:border-gray-400">
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <div className="text-[10px] font-medium">Add artifact</div>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-xs text-gray-400 italic">Dummy visual</div>
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Supports in this group</div>
          <SchemaPickerSheet
            title={`Select supports: ${groupMeta?.title || "Group"}`}
            description="Add or remove supports in this group."
            schema={SUPPORT_SCHEMA}
            selectedLabels={items.map((x) => x.label)}
            onToggle={(label) => {
              setGroups((prev) => toggleGroupLabel(prev, groupKey, label));
            }}
            getIsKey={(label) => getIsKeyForLabel(groups, label)}
            onSetIsKey={(label, isKey) => setGroups((prev) => setIsKeyForLabel(prev, label, isKey))}
            type="support"
            triggerLabel="Supports"
          />
        </div>
        <div className="text-[11px] text-gray-500">Click a support name to open details.</div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-bold text-gray-900">No supports selected</div>
              <div className="text-xs text-gray-500 mt-0.5">Use “Supports” above to select supports for this group.</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => {
            const key = normKey(it.label);
            const usage = usageIndex.get(key);
            const embedded = (usage?.components || []).filter((c) => String(c.nodeId) !== String(nodeId));
            return (
              <div key={key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <button type="button" className="min-w-0 text-left" onClick={() => onOpenSupport(it.label)}>
                    <div className="text-sm font-bold text-gray-900 hover:underline">{it.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Built in {usage?.count ?? 0} component{(usage?.count ?? 0) === 1 ? "" : "s"}
                    </div>
                  </button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-blue-600 hover:text-blue-700" onClick={() => onOpenSupport(it.label)}>
                    Open <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">How it applies</div>
                    <Textarea
                      value={it.applies}
                      onChange={(e) => setGroups((prev) => setApplies(prev, groupKey, it.label, e.currentTarget.value))}
                      placeholder="Describe how this support applies in this group…"
                      className="text-sm min-h-[90px] bg-white"
                      data-testid={`support-applies-${key}`}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Embedded components</div>
                    {embedded.length === 0 ? (
                      <div className="text-xs text-gray-400 italic">No other components tagged with this support yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {embedded.map((c) => (
                          <span key={c.nodeId} className={cn("text-[11px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200")}>
                            {c.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

