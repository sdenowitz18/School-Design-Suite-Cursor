"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, Check, Maximize2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DesignedExperienceView from "./designed-experience-view";
import type { DESubcomponent } from "./designed-experience-view";
import SnapshotView from "./snapshot-view";
import ComponentHealthView from "./component-health-view";
import SubcomponentSnapshotView from "./subcomponent-snapshot-view";
import OverviewContextView from "./overview-context-view";
import { componentQueries, useUpdateComponent } from "@/lib/api";

export interface ComponentWorkingPanelNode {
  nodeId: string;
  title: string;
  color?: string;
}

export default function ComponentWorkingPanel({
  selectedNode,
  componentsRaw,
  activeTab,
  onActiveTabChange,
  initialSubId,
  onInitialSubIdConsumed,
  openSubId,
  onOpenSubIdChange,
  overallNavTarget,
  onOverallNavTargetConsumed,
  onClose,
  onExpand,
  showExpandButton = false,
  onRequestOpenComponent,
  onRequestNavigateToStudentDemographics,
}: {
  selectedNode: ComponentWorkingPanelNode | null;
  componentsRaw: any[] | undefined;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  initialSubId: string | null;
  onInitialSubIdConsumed: () => void;
  openSubId: string | null;
  onOpenSubIdChange: (id: string | null) => void;
  overallNavTarget: any | null;
  onOverallNavTargetConsumed: () => void;
  onClose: () => void;
  onExpand?: () => void;
  showExpandButton?: boolean;
  /** Whole-school learner experience: open another component’s working panel (snapshot tab). */
  onRequestOpenComponent?: (nodeId: string) => void;
  /** Overall school only: re-route the Learners "Manage" link to the Student Demographics chart. */
  onRequestNavigateToStudentDemographics?: () => void;
}) {
  const updateMutation = useUpdateComponent();
  const nodeId = selectedNode?.nodeId || "";
  const listComponent = componentsRaw?.find((c: any) => c?.nodeId === selectedNode?.nodeId) ?? null;
  const { data: componentData } = useQuery({
    ...componentQueries.byNodeId(nodeId),
    initialData: listComponent ?? undefined,
  });

  if (!selectedNode) return null;

  const comp = (componentData as any) ?? listComponent;
  const subs: any[] = comp?.designedExperienceData?.subcomponents || [];
  const activeSub = openSubId ? subs.find((s: any) => s.id === openSubId) : null;
  const dropdownTitle = activeSub ? activeSub.name : selectedNode?.title;
  const isOverallSelected = selectedNode?.nodeId === "overall";

  const activeSubData: DESubcomponent | undefined = activeSub
    ? {
        ...activeSub,
        aims: activeSub.aims || [],
        practices: activeSub.practices || [],
        supports: activeSub.supports || [],
      }
    : undefined;

  const updateSubInComponent = (updated: DESubcomponent) => {
    if (!comp || !selectedNode) return;
    const de = comp.designedExperienceData || {};
    const updatedSubs = (de.subcomponents || []).map((s: any) => (s.id === updated.id ? updated : s));
    updateMutation.mutate({
      nodeId: selectedNode.nodeId,
      data: { designedExperienceData: { ...de, subcomponents: updatedSubs } },
    });
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-md transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95"
                data-testid="dropdown-component-switcher"
                type="button"
              >
                <h2 className="text-lg font-bold text-gray-900">{dropdownTitle}</h2>
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px] bg-white">
              <DropdownMenuItem
                className="font-medium cursor-pointer py-2"
                onClick={() => {
                  onOpenSubIdChange(null);
                }}
                data-testid="switch-to-component"
              >
                <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center mr-2 border border-blue-100">
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
                <span>{selectedNode?.title}</span>
                {!openSubId && <Check className="w-4 h-4 ml-auto text-blue-600" />}
              </DropdownMenuItem>

              {subs.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-gray-500 font-normal uppercase tracking-wider px-2 py-1.5">
                    Subcomponents
                  </DropdownMenuLabel>
                  {subs.map((sub: any) => (
                    <DropdownMenuItem
                      key={sub.id}
                      className="cursor-pointer py-2 text-gray-600 hover:text-gray-900"
                      onClick={() => {
                        onActiveTabChange("designed-experience");
                        onOpenSubIdChange(sub.id);
                      }}
                      data-testid={`switch-to-sub-${sub.id}`}
                    >
                      <div className="w-6 h-6 mr-2 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      </div>
                      <span>{sub.name}</span>
                      {openSubId === sub.id && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          {showExpandButton && onExpand && (
            <Button variant="ghost" size="icon" onClick={onExpand} data-testid="button-expand-panel">
              <Maximize2 className="w-4 h-4 text-gray-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
            <X className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-3 bg-white border-b border-gray-100 shrink-0">
          <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-transparent gap-6">
              {(selectedNode?.nodeId === "overall"
                ? [
                    { label: "Journey & Overview", value: "overview-and-context" },
                    { label: "Designed Experience", value: "designed-experience" },
                    { label: "Status and Health", value: "status-and-health" },
                  ]
                : [
                    { label: "Journey & Overview", value: "snapshot" },
                    { label: "Designed Experience", value: "designed-experience" },
                    ...(!openSubId ? [{ label: "Status and Health", value: "status-and-health" }] : []),
                  ]
              ).map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-900 data-[state=active]:shadow-none px-0 py-2 text-gray-500 hover:text-gray-700 bg-transparent"
                  data-testid={`tab-${tab.value}`}
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/30">
          {(() => {
            if (!isOverallSelected && activeSubData && activeTab === "snapshot") {
              return (
                <SubcomponentSnapshotView
                  sub={activeSubData}
                  parentTitle={selectedNode?.title || "Component"}
                  onUpdate={updateSubInComponent}
                />
              );
            }
            if (!isOverallSelected && activeTab === "snapshot") {
              return (
                <SnapshotView nodeId={selectedNode?.nodeId} title={selectedNode?.title} color={selectedNode?.color} />
              );
            }
            if (isOverallSelected && activeTab === "overview-and-context") {
              return (
                <OverviewContextView
                  nodeId={selectedNode?.nodeId}
                  initialRoute={overallNavTarget}
                  onRouteConsumed={onOverallNavTargetConsumed}
                />
              );
            }
            if (activeTab === "designed-experience") {
              return (
                <DesignedExperienceView
                  nodeId={selectedNode?.nodeId}
                  title={selectedNode?.title}
                  initialSubId={initialSubId}
                  onSubIdConsumed={onInitialSubIdConsumed}
                  openSubId={openSubId}
                  onOpenSubIdChange={onOpenSubIdChange}
                  onRequestOpenComponent={onRequestOpenComponent}
                  onRequestNavigateToStudentDemographics={onRequestNavigateToStudentDemographics}
                />
              );
            }
            if (activeTab === "status-and-health") {
              return <ComponentHealthView nodeId={selectedNode?.nodeId} title={selectedNode?.title} />;
            }
            return null;
          })()}
        </div>

      </div>
    </>
  );
}

