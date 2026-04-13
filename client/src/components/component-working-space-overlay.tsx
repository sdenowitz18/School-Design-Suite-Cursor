"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  addRingComponentFromCatalogPick,
  dataTransferHasLearnerModule,
  resolveCatalogPickFromDrop,
  subcomponentFromCatalogPick,
} from "@/lib/learner-module-drop";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCreateComponent, useUpdateComponent } from "@/lib/api";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import ComponentWorkingPanel, { type ComponentWorkingPanelNode } from "./component-working-panel";
import AICompanionPanel from "./ai-companion-panel";
import ModuleLibraryPanel from "./module-library-panel";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import ToolSidebar, { getToolMeta, type ToolId } from "./tool-sidebar";
import { componentQueries } from "@/lib/api";
import { shouldIgnoreOutsideInteraction } from "@/lib/learner-module-library-dismiss-guard";
import { useLearnerModuleLibrary } from "@/contexts/learner-module-library-context";

class OverlayErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full w-full bg-white flex items-center justify-center p-8">
        <div className="max-w-xl w-full rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="text-sm font-bold text-red-900">Workspace failed to render</div>
          <div className="text-sm text-red-800 mt-2 whitespace-pre-wrap">{this.state.error.message}</div>
          <div className="mt-4 flex justify-end">
            <Button className="bg-blue-900 hover:bg-blue-800" onClick={this.props.onClose} type="button">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default function ComponentWorkingSpaceOverlay({
  open,
  onOpenChange,
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
  onRequestOpenComponent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onRequestOpenComponent?: (nodeId: string) => void;
}) {
  const nodeId = selectedNode?.nodeId || "";
  const listComponent =
    selectedNode && componentsRaw ? (componentsRaw.find((c: any) => c?.nodeId === selectedNode.nodeId) ?? null) : null;

  const { data: componentData } = useQuery({
    ...componentQueries.byNodeId(nodeId),
    initialData: listComponent ?? undefined,
  });
  const componentInFocus =
    (componentData as any) ?? listComponent;

  const updateMutation = useUpdateComponent();
  const createMutation = useCreateComponent();
  const { moduleLibraryAudience } = useLearnerModuleLibrary();
  const [panelDropActive, setPanelDropActive] = useState(false);

  const ringListForDrop = useMemo(
    () => (Array.isArray(componentsRaw) ? componentsRaw.filter((c: any) => String(c?.nodeId || "") !== "overall") : []),
    [componentsRaw],
  );

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [pane2Tool, setPane2Tool] = useState<ToolId | null>(null);
  const [pane3Tool, setPane3Tool] = useState<ToolId | null>(null);
  const [pendingOpenTool, setPendingOpenTool] = useState<ToolId | null>(null);

  const sidebarWidth = sidebarExpanded ? 320 : 56;

  const toolInUsePane = useCallback(
    (id: ToolId): 2 | 3 | null => {
      if (pane2Tool === id) return 2;
      if (pane3Tool === id) return 3;
      return null;
    },
    [pane2Tool, pane3Tool],
  );

  const closePane = useCallback(
    (pane: 2 | 3) => {
      // Collapse panes. If pane 2 closes while pane 3 exists, shift pane 3 left.
      if (pane === 2) {
        if (pane3Tool) {
          setPane2Tool(pane3Tool);
          setPane3Tool(null);
        } else {
          setPane2Tool(null);
        }
        return;
      }
      setPane3Tool(null);
    },
    [pane3Tool],
  );

  const toggleTool = useCallback(
    (id: ToolId) => {
      const inUse = toolInUsePane(id);
      if (inUse) {
        closePane(inUse);
        return;
      }
      if (!pane2Tool) {
        setPane2Tool(id);
        return;
      }
      if (!pane3Tool) {
        setPane3Tool(id);
        return;
      }
      setPendingOpenTool(id);
    },
    [closePane, pane2Tool, pane3Tool, toolInUsePane],
  );

  const confirmClosePaneAndOpen = useCallback(
    (paneToClose: 2 | 3) => {
      const target = pendingOpenTool;
      if (!target) return;
      setPendingOpenTool(null);
      if (paneToClose === 2) setPane2Tool(target);
      else setPane3Tool(target);
    },
    [pendingOpenTool],
  );

  const renderTool = (tool: ToolId, pane: 2 | 3) => {
    const meta = getToolMeta(tool);
    const onClose = () => closePane(pane);
    return (
      <div className="h-full w-full flex flex-col bg-white border-l border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200/70 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900">{meta.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              Component in focus: {String(componentInFocus?.title || componentInFocus?.nodeId || "—")}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close pane" data-testid={`tool-pane-close-${pane}`}>
            <X className="w-4 h-4 text-gray-600" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tool === "aiChat" ? (
            <AICompanionPanel component={componentInFocus} embedded onExitChat={onClose} />
          ) : tool === "moduleLibrary" ? (
            <ModuleLibraryPanel component={componentInFocus} />
          ) : (
            <div className="p-6 text-sm text-gray-600">Export Builder is coming soon.</div>
          )}
        </div>
      </div>
    );
  };

  const onWorkingPanelDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setPanelDropActive(false);
      const parentId = selectedNode?.nodeId;
      if (!parentId) return;
      const resolved = resolveCatalogPickFromDrop(e.dataTransfer);
      if (!resolved) return;

      if (parentId === "overall") {
        const idSet = new Set(ringListForDrop.map((c: any) => String(c.nodeId)));
        const slot = ringListForDrop.length;
        await addRingComponentFromCatalogPick(
          resolved.pick,
          (body) => createMutation.mutateAsync(body),
          { slot, existingNodeIds: idSet, colorIndex: slot },
          resolved.audience,
        );
        return;
      }

      if (!componentInFocus) return;
      const de: any = componentInFocus.designedExperienceData || {};
      if (resolved.audience === "adult") {
        const adultSubs = [...(de.adultSubcomponents || [])];
        adultSubs.push(subcomponentFromCatalogPick(resolved.pick, "adult"));
        updateMutation.mutate({
          nodeId: parentId,
          data: { designedExperienceData: { ...de, adultSubcomponents: adultSubs } },
        });
      } else {
        const subs = [...(de.subcomponents || [])];
        subs.push(subcomponentFromCatalogPick(resolved.pick, "learner"));
        updateMutation.mutate({
          nodeId: parentId,
          data: { designedExperienceData: { ...de, subcomponents: subs } },
        });
      }
    },
    [selectedNode?.nodeId, componentInFocus, updateMutation, ringListForDrop, createMutation],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={cn(
          "fixed z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "left-0 right-0 top-[var(--lml-strip-offset,0px)] bottom-0 !inset-auto",
        )}
        className="fixed left-0 top-[var(--lml-strip-offset,0px)] translate-x-0 translate-y-0 w-screen h-[calc(100vh-var(--lml-strip-offset,0px))] max-h-[calc(100vh-var(--lml-strip-offset,0px))] max-w-none rounded-none p-0 gap-0 border-0 bg-white z-[60] overflow-hidden flex flex-col data-[state=open]:animate-none data-[state=closed]:animate-none"
        data-testid="component-working-space-overlay"
        onPointerDownOutside={(e) => {
          if (shouldIgnoreOutsideInteraction(e)) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (shouldIgnoreOutsideInteraction(e)) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (shouldIgnoreOutsideInteraction(e)) e.preventDefault();
        }}
      >
        <OverlayErrorBoundary onClose={() => onOpenChange(false)}>
          <div className="h-full w-full" style={{ paddingRight: sidebarWidth }}>
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
              <ResizablePanel defaultSize={pane2Tool ? 35 : 100} minSize={25} className="min-w-[320px]">
                <div
                  className={cn(
                    "relative h-full w-full flex flex-col border-r border-gray-200 bg-white transition-[box-shadow,background-color]",
                    panelDropActive && selectedNode?.nodeId && "ring-4 ring-inset ring-sky-500 bg-sky-50/40",
                  )}
                  onDragEnter={(e) => {
                    if (!dataTransferHasLearnerModule(e.dataTransfer) || !selectedNode?.nodeId) return;
                    e.preventDefault();
                    setPanelDropActive(true);
                  }}
                  onDragOver={(e) => {
                    if (!dataTransferHasLearnerModule(e.dataTransfer) || !selectedNode?.nodeId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    setPanelDropActive(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setPanelDropActive(false);
                    }
                  }}
                  onDrop={onWorkingPanelDrop}
                >
                  {panelDropActive && selectedNode?.nodeId ? (
                    <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-4">
                      <div className="rounded-full border border-sky-300 bg-white/95 px-4 py-2 text-center text-xs font-semibold text-sky-900 shadow-md">
                        {selectedNode.nodeId === "overall"
                          ? `Drop to add ${moduleLibraryAudience === "adult" ? "adult" : "learner"} experience component to the blueprint`
                          : moduleLibraryAudience === "adult"
                            ? `Drop to add adult subcomponent to “${selectedNode.title}”`
                            : `Drop to add learner subcomponent to “${selectedNode.title}”`}
                      </div>
                    </div>
                  ) : null}
                  <ComponentWorkingPanel
                    selectedNode={selectedNode}
                    componentsRaw={componentsRaw}
                    activeTab={activeTab}
                    onActiveTabChange={onActiveTabChange}
                    initialSubId={initialSubId}
                    onInitialSubIdConsumed={onInitialSubIdConsumed}
                    openSubId={openSubId}
                    onOpenSubIdChange={onOpenSubIdChange}
                    overallNavTarget={overallNavTarget}
                    onOverallNavTargetConsumed={onOverallNavTargetConsumed}
                    onClose={() => onOpenChange(false)}
                    onRequestOpenComponent={onRequestOpenComponent}
                  />
                </div>
              </ResizablePanel>

              {pane2Tool && (
                <>
                  <ResizableHandle withHandle className="bg-gray-200 w-[3px]" />
                  <ResizablePanel defaultSize={pane3Tool ? 45 : 65} minSize={25} className="min-w-[360px]">
                    {renderTool(pane2Tool, 2)}
                  </ResizablePanel>
                </>
              )}

              {pane3Tool && (
                <>
                  <ResizableHandle withHandle className="bg-gray-200 w-[3px]" />
                  <ResizablePanel defaultSize={20} minSize={18} className="min-w-[320px]">
                    {renderTool(pane3Tool, 3)}
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>

          <div className="absolute right-0 top-0 bottom-0 z-50">
            <ToolSidebar
              expanded={sidebarExpanded}
              onToggleExpanded={() => setSidebarExpanded((v) => !v)}
              pane2Tool={pane2Tool}
              pane3Tool={pane3Tool}
              onToggleTool={toggleTool}
            />
          </div>

          {pendingOpenTool && pane2Tool && pane3Tool && (
            <div
              className="absolute top-20 z-50 w-[340px] rounded-xl border border-gray-200 bg-white shadow-lg p-3"
              style={{ right: sidebarWidth + 16 }}
            >
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Max panes reached</div>
              <div className="text-sm text-gray-900 mt-2">
                Open <span className="font-semibold">{getToolMeta(pendingOpenTool).name}</span>. Which pane do you want to close?
              </div>
              <div className="mt-3 space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => confirmClosePaneAndOpen(2)}
                  data-testid="choose-close-pane2"
                >
                  <span>Close Pane 2</span>
                  <span className="text-xs text-gray-500">{getToolMeta(pane2Tool).name}</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => confirmClosePaneAndOpen(3)}
                  data-testid="choose-close-pane3"
                >
                  <span>Close Pane 3</span>
                  <span className="text-xs text-gray-500">{getToolMeta(pane3Tool).name}</span>
                </Button>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setPendingOpenTool(null)} data-testid="choose-close-cancel">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </OverlayErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

