import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bot, Plus, X, Maximize2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { componentQueries, useSeedComponents, useUpdateComponent } from "@/lib/api";
import DesignedExperienceView from "./designed-experience-view";
import type { DESubcomponent } from "./designed-experience-view";
import SnapshotView from "./snapshot-view";
import ComponentHealthView from "./component-health-view";
import SubcomponentSnapshotView from "./subcomponent-snapshot-view";

interface CanvasNode {
  id: string;
  nodeId: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  color: string;
  stats: {
    left: number;
    right: number;
    leftLabel: string;
    rightLabel: string;
  }
}

function componentToCanvasNode(comp: any): CanvasNode {
  const snap = comp.snapshotData || {};
  return {
    id: comp.id,
    nodeId: comp.nodeId,
    title: comp.title,
    subtitle: comp.subtitle,
    x: comp.canvasX,
    y: comp.canvasY,
    color: comp.color,
    stats: {
      left: (snap.subcomponents || []).length,
      right: (snap.primaryOutcomes || []).length,
      leftLabel: "Experiences",
      rightLabel: "Outcomes",
    },
  };
}

const FALLBACK_NODES: CanvasNode[] = [
  { id: "1", nodeId: "algebra", title: "Algebra", subtitle: "STEM Component", x: 600, y: 100, color: "bg-emerald-100", stats: { left: 3, right: 2, leftLabel: "Experiences", rightLabel: "Outcomes" } },
  { id: "2", nodeId: "math", title: "Math", subtitle: "STEM Component", x: 300, y: 450, color: "bg-emerald-100", stats: { left: 0, right: 0, leftLabel: "Experiences", rightLabel: "Outcomes" } },
  { id: "3", nodeId: "college_exposure", title: "College Exposure", subtitle: "Access & Opportunity", x: 900, y: 450, color: "bg-blue-100", stats: { left: 0, right: 0, leftLabel: "Experiences", rightLabel: "Outcomes" } },
  { id: "4", nodeId: "overall", title: "Overall School", subtitle: "Key Levers", x: 600, y: 300, color: "bg-white", stats: { left: 0, right: 0, leftLabel: "Experiences", rightLabel: "Outcomes" } },
];

const OctagonNode = ({ node, onClick }: { node: CanvasNode; onClick: () => void }) => {
  const isOverall = node.nodeId === "overall";

  if (isOverall) {
     return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            className="absolute cursor-pointer flex flex-col items-center justify-center w-[300px] h-[220px] bg-white rounded-xl shadow-lg border-2 border-gray-200 p-4 z-20"
            style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
            onClick={onClick}
            data-testid={`node-${node.nodeId}`}
        >
            <div className="flex flex-col items-center w-full h-full justify-between">
                <div className="text-center space-y-1">
                    <div className="flex gap-1 justify-center mb-1">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="w-1 h-1 rounded-full bg-gray-300" />
                        ))}
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg">{node.title}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{node.subtitle}</p>
                </div>

                <div className="relative w-full flex-1 flex items-center justify-center my-2">
                     <div className="w-[80%] h-[60px] rounded-[50%] border border-gray-300 flex items-center justify-center bg-gray-50 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                           <div className="w-full h-px bg-gray-400 rotate-45 absolute" />
                           <div className="w-full h-px bg-gray-400 -rotate-45 absolute" />
                        </div>
                        <span className="text-xs text-gray-400 font-medium z-10">Implementation</span>
                     </div>
                </div>

                <div className="flex w-full justify-between items-center px-4 border-t border-gray-100 pt-3">
                     <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 mb-0.5">{node.stats.leftLabel}</span>
                        <div className="bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded text-sm min-w-[30px] text-center">{node.stats.left}</div>
                     </div>
                     <span className="text-xs text-gray-300 tracking-widest">••• Performance •••</span>
                     <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 mb-0.5">{node.stats.rightLabel}</span>
                        <div className="bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded text-sm min-w-[30px] text-center">{node.stats.right}</div>
                     </div>
                </div>
            </div>
            
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gray-200 text-gray-600 text-xs font-bold px-6 py-1 rounded-full shadow-sm">
                Journey
            </div>
        </motion.div>
     );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className="absolute cursor-pointer flex flex-col items-center justify-center w-[220px] h-[220px] transition-all"
      style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
      onClick={onClick}
      data-testid={`node-${node.nodeId}`}
    >
      <div 
        className={cn(
            "w-full h-full flex flex-col items-center justify-between p-6 shadow-md transition-colors",
            node.color
        )}
        style={{ 
            clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
            border: "1px solid #000"
        }}
      >
        <div className="text-center space-y-1 mt-2">
            <div className="flex gap-1 justify-center mb-1">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-gray-400/50" />
                ))}
            </div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight px-2">{node.title}</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{node.subtitle}</p>
        </div>

        <div className="flex-1 w-full flex items-center justify-center">
             <div className="w-[80%] h-[40px] rounded-[50%] bg-blue-900/10 flex items-center justify-center">
                <span className="text-[9px] text-gray-400">{node.stats.left > 0 ? `${node.stats.left} subcomponents` : "No subcomponents"}</span>
             </div>
        </div>

        <div className="flex w-full justify-between items-end gap-2 mb-2">
             <div className="flex flex-col items-center flex-1">
                <span className="text-[9px] text-blue-600 font-medium mb-0.5">{node.stats.leftLabel}</span>
                <div className="bg-yellow-300 text-yellow-900 font-bold px-2 py-0.5 rounded text-sm w-full text-center shadow-sm border border-yellow-400/30">{node.stats.left}</div>
             </div>
             <div className="flex flex-col items-center flex-1">
                <span className="text-[9px] text-blue-600 font-medium mb-0.5">{node.stats.rightLabel}</span>
                <div className="bg-red-300 text-red-900 font-bold px-2 py-0.5 rounded text-sm w-full text-center shadow-sm border border-red-400/30">{node.stats.right}</div>
             </div>
        </div>
        
        <div className="text-[9px] text-gray-500 font-medium -mt-1">
          {node.subtitle.includes("STEM") ? "STEM capacities" : node.subtitle}
        </div>
      </div>
      
      <div 
        className="absolute inset-0 pointer-events-none border-2 border-gray-800/20"
        style={{ 
            clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)"
        }}
      />
    </motion.div>
  );
};

export default function CanvasView() {
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [activeTab, setActiveTab] = useState("snapshot");
  const [initialSubId, setInitialSubId] = useState<string | null>(null);
  const [openSubId, setOpenSubId] = useState<string | null>(null);
  
  const { data: componentsRaw, isLoading } = useQuery(componentQueries.all);
  const seedMutation = useSeedComponents();
  const updateMutation = useUpdateComponent();

  const nodes: CanvasNode[] = componentsRaw && Array.isArray(componentsRaw) && componentsRaw.length > 0
    ? componentsRaw.map(componentToCanvasNode)
    : FALLBACK_NODES;

  useEffect(() => {
    if (componentsRaw && Array.isArray(componentsRaw) && componentsRaw.length === 0) {
      seedMutation.mutate();
    }
  }, [componentsRaw]);

  return (
    <div className="w-full h-screen bg-[#F8F9FA] relative overflow-hidden font-sans">
      <div className="absolute top-4 left-0 right-0 px-6 flex justify-between items-center z-10">
         <div className="flex items-center gap-2">
         </div>
         
         <div className="bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
            Steven Test Blueprint #2
         </div>
         
         <div className="bg-gray-900 text-white p-2 rounded-lg shadow-lg flex gap-4">
             <div className="w-4 h-4 rounded-full border border-gray-500" />
             <div className="w-4 h-4 rounded-full border border-gray-500" />
             <div className="w-4 h-4 rounded-full border border-gray-500" />
             <div className="w-px h-4 bg-gray-700" />
             <div className="w-4 h-4 rounded-full border border-gray-500" />
         </div>
      </div>

      <div className="absolute left-4 top-20 bottom-20 w-12 bg-blue-900 rounded-full flex flex-col items-center py-6 gap-6 shadow-xl z-10">
         <div className="w-2 h-2 rounded-full bg-white/50" />
         <div className="w-2 h-2 rounded-full bg-white/50" />
         <div className="w-2 h-2 rounded-full bg-white" />
         <div className="w-2 h-2 rounded-full bg-white/50" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center transform scale-90 origin-center">
         {nodes.map(node => (
            <OctagonNode key={node.nodeId} node={node} onClick={() => setSelectedNode(node)} />
         ))}
      </div>

      <div className="absolute bottom-6 right-6 flex items-center bg-white rounded-full shadow-lg border border-gray-200 px-4 py-2 gap-4">
         <button className="text-gray-500 hover:text-gray-900 font-bold">-</button>
         <span className="text-xs font-medium text-gray-600">50%</span>
         <button className="text-gray-500 hover:text-gray-900 font-bold">+</button>
      </div>

      <div className="absolute bottom-6 right-36 bg-blue-900 text-white p-3 rounded-full shadow-lg cursor-pointer hover:bg-blue-800 transition-colors">
          <Bot className="w-5 h-5" />
      </div>

      <Sheet open={!!selectedNode} onOpenChange={(open) => { if (!open) { setSelectedNode(null); setOpenSubId(null); } }}>
        <SheetContent className="w-full sm:max-w-[800px] p-0 border-l border-gray-200 shadow-2xl flex flex-col bg-white" side="right">
           {(() => {
              const comp = componentsRaw?.find((c: any) => c.nodeId === selectedNode?.nodeId);
              const subs: any[] = comp?.designedExperienceData?.subcomponents || [];
              const activeSub = openSubId ? subs.find((s: any) => s.id === openSubId) : null;
              const dropdownTitle = activeSub ? activeSub.name : selectedNode?.title;

              return (
                <>
                  <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex items-center gap-3 flex-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-md transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95" data-testid="dropdown-component-switcher">
                            <h2 className="text-lg font-bold text-gray-900">{dropdownTitle}</h2>
                            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[280px] bg-white z-50">
                          <DropdownMenuItem
                            className="font-medium cursor-pointer py-2"
                            onClick={() => { setOpenSubId(null); }}
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
                              <DropdownMenuLabel className="text-xs text-gray-500 font-normal uppercase tracking-wider px-2 py-1.5">Subcomponents</DropdownMenuLabel>
                              {subs.map((sub: any) => (
                                <DropdownMenuItem 
                                  key={sub.id} 
                                  className="cursor-pointer py-2 text-gray-600 hover:text-gray-900"
                                  onClick={() => { setActiveTab("designed-experience"); setOpenSubId(sub.id); }}
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
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedNode(null); setOpenSubId(null); }} data-testid="button-close-panel">
                        <X className="w-4 h-4 text-gray-500" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 py-3 bg-white border-b border-gray-100 shrink-0">
                      <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); }} className="w-full">
                        <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-transparent gap-6">
                          {["Snapshot", "Designed Experience", "Status and Health"].map(tab => (
                            <TabsTrigger 
                              key={tab} 
                              value={tab.toLowerCase().replace(/ /g, "-")}
                              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-900 data-[state=active]:shadow-none px-0 py-2 text-gray-500 hover:text-gray-700 bg-transparent"
                              data-testid={`tab-${tab.toLowerCase().replace(/ /g, "-")}`}
                            >
                              {tab}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-50/30">
                      {(() => {
                        const activeSubData: DESubcomponent | undefined = activeSub ? {
                          ...activeSub,
                          aims: activeSub.aims || [],
                          practices: activeSub.practices || [],
                          supports: activeSub.supports || [],
                        } : undefined;

                        const updateSubInComponent = (updated: DESubcomponent) => {
                          if (!comp || !selectedNode) return;
                          const de = comp.designedExperienceData || {};
                          const updatedSubs = (de.subcomponents || []).map((s: any) => s.id === updated.id ? updated : s);
                          updateMutation.mutate({ nodeId: selectedNode.nodeId, data: { designedExperienceData: { ...de, subcomponents: updatedSubs } } });
                        };

                        if (activeSubData && activeTab === "snapshot") {
                          return <SubcomponentSnapshotView sub={activeSubData} parentTitle={selectedNode?.title || "Component"} onUpdate={updateSubInComponent} />;
                        }
                        if (activeTab === "snapshot") {
                          return <SnapshotView nodeId={selectedNode?.nodeId} title={selectedNode?.title} color={selectedNode?.color} />;
                        }
                        if (activeTab === "designed-experience") {
                          return <DesignedExperienceView nodeId={selectedNode?.nodeId} title={selectedNode?.title} initialSubId={initialSubId} onSubIdConsumed={() => setInitialSubId(null)} openSubId={openSubId} onOpenSubIdChange={setOpenSubId} />;
                        }
                        if (activeTab === "status-and-health") {
                          return <ComponentHealthView nodeId={selectedNode?.nodeId} title={selectedNode?.title} />;
                        }
                        return null;
                      })()}
                    </div>
                    
                    <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-2 shrink-0">
                      <Button variant="outline" onClick={() => setSelectedNode(null)} data-testid="button-back">Back</Button>
                      <Button className="bg-blue-900 hover:bg-blue-800" data-testid="button-save">Save Changes</Button>
                    </div>
                  </div>
                </>
              );
           })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
