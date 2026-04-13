"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { componentQueries, useCreateComponent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import OctagonCard from "@/components/octagon-card";
import {
  LEARNER_EXPERIENCE_CATALOG,
  flattenBucketForFilter,
  type LECatalogPick,
} from "@/lib/learner-experience-catalog";
import {
  ADULT_EXPERIENCE_PICKS,
  ADULT_EXPERIENCE_ROLE_OPTIONS,
  adultPicksForRoleId,
  type AdultCatalogPick,
} from "@/lib/adult-experience-catalog";
import { addRingComponentFromCatalogPick, setLearnerModuleDragData } from "@/lib/learner-module-drop";
import { useLearnerModuleLibrary } from "@/contexts/learner-module-library-context";
import { LML_STRIP_HEIGHT_CLAMP } from "@/lib/learner-module-library-layout";

/**
 * Top-of-screen module library. Pushes blueprint + side panel down when open.
 * Every dimension tab: primary tags from catalog in a dropdown (Excel-aligned primaries);
 * L2 modules appear as octagons below for the selected primary (or all when "All primaries").
 */
export default function LearnerModuleLibraryStrip() {
  const {
    open,
    closeLibrary,
    selectedCatalogKeys,
    toggleCatalogKey,
    clearCatalogSelection,
    moduleLibraryAudience,
    setModuleLibraryAudience,
  } = useLearnerModuleLibrary();
  const { data: componentsRaw } = useQuery(componentQueries.all);
  const createMutation = useCreateComponent();

  const ringComponents = useMemo(
    () =>
      Array.isArray(componentsRaw)
        ? componentsRaw.filter((c: any) => String(c?.nodeId || "") !== "overall")
        : [],
    [componentsRaw],
  );

  const [activeBucketId, setActiveBucketId] = useState(LEARNER_EXPERIENCE_CATALOG[0]?.id ?? "");
  const [primaryFilter, setPrimaryFilter] = useState<string>("all");

  const pickByKey = useMemo(() => {
    const m = new Map<string, LECatalogPick>();
    for (const b of LEARNER_EXPERIENCE_CATALOG) {
      for (const p of flattenBucketForFilter(b, "all")) {
        m.set(p.key, p);
      }
    }
    return m;
  }, []);

  const adultPickByKey = useMemo(() => {
    const m = new Map<string, AdultCatalogPick>();
    for (const p of ADULT_EXPERIENCE_PICKS) m.set(p.key, p);
    return m;
  }, []);

  const [adultRoleId, setAdultRoleId] = useState(ADULT_EXPERIENCE_ROLE_OPTIONS[0]?.id ?? "");
  const adultPicksRow = useMemo(() => adultPicksForRoleId(adultRoleId), [adultRoleId]);

  const activeBucket = LEARNER_EXPERIENCE_CATALOG.find((b) => b.id === activeBucketId);

  useEffect(() => {
    setPrimaryFilter("all");
  }, [activeBucketId]);

  const existingNodeIds = useMemo(() => new Set(ringComponents.map((c: any) => String(c.nodeId))), [ringComponents]);

  const addFromCatalogBulk = async () => {
    if (selectedCatalogKeys.size === 0) return;
    const keys = Array.from(selectedCatalogKeys);
    const idSet = new Set(existingNodeIds);
    let slot = ringComponents.length;
    let colorIdx = ringComponents.length;
    if (moduleLibraryAudience === "adult") {
      const picks = keys.map((k) => adultPickByKey.get(k)).filter(Boolean) as AdultCatalogPick[];
      for (let i = 0; i < picks.length; i++) {
        await addRingComponentFromCatalogPick(
          picks[i],
          (body) => createMutation.mutateAsync(body),
          { slot, existingNodeIds: idSet, colorIndex: colorIdx },
          "adult",
        );
        slot += 1;
        colorIdx += 1;
      }
    } else {
      const picks = keys.map((k) => pickByKey.get(k)).filter(Boolean) as LECatalogPick[];
      for (let i = 0; i < picks.length; i++) {
        await addRingComponentFromCatalogPick(
          picks[i],
          (body) => createMutation.mutateAsync(body),
          { slot, existingNodeIds: idSet, colorIndex: colorIdx },
          "learner",
        );
        slot += 1;
        colorIdx += 1;
      }
    }
    clearCatalogSelection();
  };

  const switchAudience = (next: "learner" | "adult") => {
    setModuleLibraryAudience(next);
    clearCatalogSelection();
    if (next === "adult" && ADULT_EXPERIENCE_ROLE_OPTIONS[0]) {
      setAdultRoleId(ADULT_EXPERIENCE_ROLE_OPTIONS[0].id);
    }
  };

  if (!open) return null;

  return (
    <DismissableLayerBranch
      className="shrink-0 z-[100] pointer-events-auto"
      style={{ position: "relative" }}
    >
    <div
      className="flex flex-col border-b border-gray-200 bg-white shadow-md h-full"
      data-testid="learner-module-library-strip"
      style={{ height: LML_STRIP_HEIGHT_CLAMP }}
    >
      {moduleLibraryAudience === "learner" ? (
      <Tabs value={activeBucketId} onValueChange={setActiveBucketId} className="flex flex-1 min-h-0 flex-col gap-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b-2 border-sky-300 bg-sky-100/90 px-2 py-1.5 sm:px-3 shrink-0">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Module library</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300/50"
                  aria-label="About the module library"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px] text-left font-normal bg-gray-900 text-white border-0">
                Drag modules onto the blueprint to add ring components, or onto an open ring working panel to add
                subcomponents. Or select modules and use &ldquo;Add selected to blueprint&rdquo; below.
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-0.5 rounded-md border border-gray-200/80 bg-white p-0.5 shrink-0">
            <Button type="button" size="sm" variant="default" className="h-7 text-[11px] px-2" onClick={() => switchAudience("learner")}>
              Learner
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => switchAudience("adult")}>
              Adult
            </Button>
          </div>

          <p className="w-full basis-full text-[10px] text-gray-600 leading-snug order-last sm:order-none sm:w-auto sm:basis-auto sm:max-w-md">
            <span className="font-semibold text-gray-700">Drag:</span> blueprint → new component · ring working panel →
            subcomponent on that component.
          </p>

          <TabsList className="h-8 flex-1 min-w-0 justify-start gap-0.5 overflow-x-auto rounded-md bg-gray-100/90 p-0.5 sm:flex-initial sm:max-w-none">
            {LEARNER_EXPERIENCE_CATALOG.map((b) => (
              <TabsTrigger
                key={b.id}
                value={b.id}
                className="shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] h-7 data-[state=active]:shadow-sm"
              >
                {b.tabLabel}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeBucket ? (
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto sm:min-w-[200px]">
              <span className="text-[10px] text-gray-500 whitespace-nowrap hidden sm:inline">Primary</span>
              <Select value={primaryFilter} onValueChange={setPrimaryFilter}>
                <SelectTrigger className="h-8 text-xs flex-1 sm:w-[220px] sm:flex-none">
                  <SelectValue placeholder="All primaries" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="all">All primaries</SelectItem>
                  {activeBucket.primaries.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 ml-auto sm:ml-0"
            onClick={closeLibrary}
            title="Close module library"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {LEARNER_EXPERIENCE_CATALOG.map((b) => (
          <TabsContent
            key={b.id}
            value={b.id}
            className="mt-0 flex-1 min-h-0 flex flex-col overflow-hidden outline-none data-[state=inactive]:hidden"
          >
            <p className="shrink-0 px-2 sm:px-3 pt-2 text-[10px] text-gray-500 line-clamp-2">{b.dimensionLabel}</p>
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-2 sm:px-3 pt-2 pb-1">
              <div className="flex gap-3 items-stretch min-h-[min(100%,11rem)] h-full">
                {flattenBucketForFilter(b, primaryFilter as "all" | string).map((item) => {
                  const sel = selectedCatalogKeys.has(item.key);
                  return (
                    <div key={item.key} className="flex w-[168px] shrink-0 flex-col gap-1.5">
                      <div
                        title={item.title}
                        draggable
                        onDragStart={(e) => {
                          setLearnerModuleDragData(e.dataTransfer, item.key, "learner");
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className={cn(
                          "rounded-xl border border-transparent bg-gray-50/80 transition-all w-full overflow-hidden cursor-grab active:cursor-grabbing",
                          sel ? "ring-2 ring-blue-500 ring-offset-2 border-blue-200 bg-white" : "hover:border-gray-200 hover:bg-white",
                        )}
                      >
                        <div className="h-[136px] w-full flex items-start justify-center overflow-hidden pt-1">
                          <div className="scale-[0.60] origin-top pointer-events-none">
                            <OctagonCard
                              title={item.title}
                              subtitle={item.subtitle}
                              bgClassName="bg-white"
                              centerVariant="pill"
                              centerText="Drag"
                              leftStat={{ label: "Exp", value: "0" }}
                              rightStat={{ label: "Out", value: "0" }}
                              onClick={() => {}}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="w-full py-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCatalogKey(item.key);
                          }}
                        >
                          {sel ? "Deselect" : "Select for bulk add"}
                        </button>
                      </div>
                      <p
                        className="text-[11px] leading-snug text-center text-gray-800 px-0.5 line-clamp-4 min-h-[3.5rem]"
                        title={item.title}
                      >
                        {item.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col gap-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b-2 border-violet-400 bg-violet-100/95 px-2 py-1.5 sm:px-3 shrink-0">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Module library</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-300/50"
                    aria-label="About the module library"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] text-left font-normal bg-gray-900 text-white border-0">
                  Adult experience modules: drag to the blueprint for a new ring component, or onto the working panel
                  for an adult subcomponent. For whole-school, switch to Adult here and drop on the center panel when
                  Overview is open.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200/80 bg-white p-0.5 shrink-0">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] px-2" onClick={() => switchAudience("learner")}>
                Learner
              </Button>
              <Button type="button" size="sm" variant="default" className="h-7 text-[11px] px-2" onClick={() => switchAudience("adult")}>
                Adult
              </Button>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-1 min-w-[200px] max-w-full sm:max-w-xl">
              <span className="text-[10px] text-gray-500 whitespace-nowrap hidden sm:inline">Audience</span>
              <Select value={adultRoleId} onValueChange={setAdultRoleId}>
                <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {ADULT_EXPERIENCE_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 ml-auto sm:ml-0"
              onClick={closeLibrary}
              title="Close module library"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-2 sm:px-3 pt-2 pb-1">
            <div className="flex gap-3 items-stretch min-h-[min(100%,11rem)] h-full">
              {adultPicksRow.map((item) => {
                const sel = selectedCatalogKeys.has(item.key);
                return (
                  <div key={item.key} className="flex w-[168px] shrink-0 flex-col gap-1.5">
                    <div
                      title={item.title}
                      draggable
                      onDragStart={(e) => {
                        setLearnerModuleDragData(e.dataTransfer, item.key, "adult");
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className={cn(
                        "rounded-xl border border-transparent bg-violet-50/50 transition-all w-full overflow-hidden cursor-grab active:cursor-grabbing",
                        sel ? "ring-2 ring-violet-500 ring-offset-2 border-violet-200 bg-white" : "hover:border-gray-200 hover:bg-white",
                      )}
                    >
                      <div className="h-[136px] w-full flex items-start justify-center overflow-hidden pt-1">
                        <div className="scale-[0.60] origin-top pointer-events-none">
                          <OctagonCard
                            title={item.title}
                            subtitle={item.subtitle}
                            bgClassName="bg-white"
                            centerVariant="pill"
                            centerText="Drag"
                            leftStat={{ label: "Exp", value: "0" }}
                            rightStat={{ label: "Out", value: "0" }}
                            onClick={() => {}}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-full py-1 text-[10px] font-medium text-violet-700 hover:text-violet-900 hover:bg-violet-50/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCatalogKey(item.key);
                        }}
                      >
                        {sel ? "Deselect" : "Select for bulk add"}
                      </button>
                    </div>
                    <p
                      className="text-[11px] leading-snug text-center text-gray-800 px-0.5 line-clamp-4 min-h-[3.5rem]"
                      title={item.title}
                    >
                      {item.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 shrink-0 border-t border-gray-100 bg-white px-2 sm:px-3 py-1.5">
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={selectedCatalogKeys.size === 0 || createMutation.isPending}
          onClick={() => void addFromCatalogBulk()}
        >
          Add selected to blueprint ({selectedCatalogKeys.size})
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearCatalogSelection}>
          Clear selection
        </Button>
      </div>
    </div>
    </DismissableLayerBranch>
  );
}
