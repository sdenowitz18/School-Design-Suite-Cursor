import React, { useMemo, useState } from "react";
import { 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Layout,
  Users,
  Calendar,
  Settings2,
  ArrowRight,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { componentQueries } from "@/lib/api";
import OutcomeScoreView from "./outcome-score-view";
import ExperienceScoreView from "./experience-score-view";
import { calculateRingDesignScore } from "@shared/ring-design-score";
import type { RingDesignScoreData } from "@shared/schema";
import RingDesignScoreView from "./ring-design-score-view";
import RingImplementationScoreView from "./ring-implementation-score-view";
import { calculateRingImplementationScore } from "@shared/ring-implementation-score";
import RingConditionsScoreView from "./ring-conditions-score-view";
import { calculateRingConditionsScore } from "@shared/ring-conditions-score";

const RING_NODE_IDS = ["algebra", "math", "college_exposure"] as const;

interface ComponentHealthViewProps {
  nodeId?: string;
  title?: string;
}

// Mock Data
const JOURNEY_SNAPSHOTS = [
  "Baseline",
  "Sept '25 (Baseline)",
  "Jan '26 (Mid-Year)",
  "June '26 (End-Year)",
  "Sept '26 (Target)"
];

const DRIVER_DATA = {
  design: {
    score: 4,
    status: "Strong",
    description: "The design is coherency and aligned to Math Identity and Rigor",
    tailwinds: ["Strong alignment with vision", "Clear outcomes defined"],
    headwinds: ["Complexity of new practices"]
  },
  conditions: {
    score: 2,
    status: "Weak",
    description: "Staffing challenges and scheduling conflicts are creating drag",
    tailwinds: ["Supportive leadership"],
    headwinds: ["Schedule constraints", "Teacher turnover", "Budget limitations"]
  },
  implementation: {
    score: 3,
    status: "Moderate",
    description: "Fidelity is mixed across classrooms",
    dimensions: [
      { name: "Quality", value: "High" },
      { name: "Fidelity", value: "Med" },
      { name: "Scale", value: "Low" },
      { name: "Learner Demand", value: "Med" }
    ]
  }
};

const PERFORMANCE_DATA = {
  experience: {
    score: 4,
    trend: "up",
    categories: [
      { name: "Leaps", status: "Strong" },
      { name: "Engagement", status: "Moderate" },
      { name: "Belonging", status: "Strong" }
    ]
  },
  outcomes: {
    score: 2,
    trend: "flat",
    categories: [
      { name: "Proficiency", status: "Weak" },
      { name: "Growth", status: "Moderate" },
      { name: "Agency", status: "Strong" }
    ]
  }
};

export default function ComponentHealthView({ nodeId, title }: ComponentHealthViewProps) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));

  const isRingNode = !!nodeId && (RING_NODE_IDS as readonly string[]).includes(nodeId);

  const [asOfDate, setAsOfDate] = useState("Sept '25 (Baseline)");
  const [status, setStatus] = useState("Test & Refine");
  const [showOutcomeScore, setShowOutcomeScore] = useState(false);
  const [showExperienceScore, setShowExperienceScore] = useState(false);
  const [showRingDesignScore, setShowRingDesignScore] = useState(false);
  const [showRingImplementationScore, setShowRingImplementationScore] = useState(false);
  const [showRingConditionsScore, setShowRingConditionsScore] = useState(false);
  const [conditionsSummaryMode, setConditionsSummaryMode] = useState<"stakeholder" | "type">("stakeholder");

  const outcomeScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return hd.outcomeScoreData || null;
  }, [comp]);

  const experienceScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return hd.experienceScoreData || null;
  }, [comp]);

  const ringDesignScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return (hd.ringDesignScoreData || null) as RingDesignScoreData | null;
  }, [comp]);

  const realOutcomeScore = outcomeScoreData?.finalOutcomeScore ?? null;
  const targetedOutcomes: any[] = useMemo(() => {
    const fromHealth: any[] = outcomeScoreData?.targetedOutcomes || [];
    const de: any = comp?.designedExperienceData || {};
    const kde = de.keyDesignElements || {};
    const aims: any[] = kde.aims || [];
    const deOutcomeAims = aims
      .filter((a: any) => a?.type === "outcome" && typeof a?.label === "string")
      .map((a: any) => ({ id: String(a.id || a.label), label: String(a.label) }));

    const norm = (s: string) => s.trim().toLowerCase();
    const byName = new Map<string, any>();
    for (const o of fromHealth) {
      byName.set(norm(String(o?.outcomeName || "")), o);
    }

    const seen = new Set<string>();
    const merged: any[] = [];
    for (const aim of deOutcomeAims) {
      const key = norm(aim.label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = byName.get(key);
      merged.push(
        existing ?? {
          id: aim.id,
          outcomeName: aim.label,
          priority: "M",
          skipped: false,
          measures: [],
          calculatedScore: null,
        },
      );
    }

    return merged;
  }, [comp?.designedExperienceData, outcomeScoreData?.targetedOutcomes]);

  const realExperienceScore = experienceScoreData?.finalExperienceScore ?? null;
  const experienceDimensions = useMemo(() => {
    if (!experienceScoreData) return { leaps: { measures: [], excluded: false }, health: { measures: [], excluded: false }, behavior: { measures: [], excluded: false } };
    return {
      leaps: experienceScoreData.leaps || { measures: [], excluded: false },
      health: experienceScoreData.health || { measures: [], excluded: false },
      behavior: experienceScoreData.behavior || { measures: [], excluded: false },
    };
  }, [experienceScoreData]);

  const computedRingDesignScore = useMemo(() => {
    if (!isRingNode) return null;
    return calculateRingDesignScore(comp as any);
  }, [comp, isRingNode]);

  const computedRingImplementationScore = useMemo(() => {
    if (!isRingNode) return null;
    return calculateRingImplementationScore(comp as any);
  }, [comp, isRingNode]);

  const computedRingConditionsScore = useMemo(() => {
    if (!isRingNode) return null;
    return calculateRingConditionsScore(comp as any);
  }, [comp, isRingNode]);

  if (showExperienceScore) {
    return <ExperienceScoreView nodeId={nodeId} title={title} onBack={() => setShowExperienceScore(false)} />;
  }

  if (showOutcomeScore) {
    return <OutcomeScoreView nodeId={nodeId} title={title} onBack={() => setShowOutcomeScore(false)} />;
  }

  if (showRingDesignScore) {
    return <RingDesignScoreView nodeId={nodeId} title={title} onBack={() => setShowRingDesignScore(false)} />;
  }

  if (showRingImplementationScore) {
    return <RingImplementationScoreView nodeId={nodeId} title={title} onBack={() => setShowRingImplementationScore(false)} />;
  }

  if (showRingConditionsScore) {
    return <RingConditionsScoreView nodeId={nodeId} title={title} onBack={() => setShowRingConditionsScore(false)} />;
  }

  // Zone 2: Driver Tri-Spoke Visualization (SVG)
  const DriverTriSpoke = () => (
    <div className="relative w-full h-[140px] flex items-center justify-center">
       {/* Background Zone */}
       <div className="absolute inset-0 bg-gray-100/50 rounded-lg -z-10" />
       
       <svg width="200" height="120" viewBox="0 0 200 120" className="overflow-visible">
          {/* Central Hub */}
          <circle cx="100" cy="80" r="4" fill="#cbd5e1" />
          
          {/* Design Arm (Top Left) */}
          <line x1="100" y1="80" x2="60" y2="40" stroke="#fca5a5" strokeWidth="8" strokeLinecap="round" className="opacity-80" />
          <text x="50" y="30" textAnchor="middle" className="text-[10px] font-bold fill-emerald-800 uppercase tracking-wide">Design</text>
          
          {/* Conditions Arm (Top Right) */}
          <line x1="100" y1="80" x2="140" y2="40" stroke="#86efac" strokeWidth="8" strokeLinecap="round" className="opacity-80" />
          <text x="150" y="30" textAnchor="middle" className="text-[10px] font-bold fill-emerald-800 uppercase tracking-wide">Conditions</text>
          
          {/* Implementation Arm (Bottom - The Output) */}
          <line x1="100" y1="80" x2="100" y2="110" stroke="#fde047" strokeWidth="8" strokeLinecap="round" className="opacity-80" />
          <text x="100" y="100" textAnchor="middle" className="text-[10px] font-bold fill-emerald-800 uppercase tracking-wide translate-y-3">Implementation</text>
          
          {/* Arrows for Flow */}
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
            </marker>
          </defs>
       </svg>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-24">
      
      {/* Zone 1: Context Header */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
         <div className="space-y-1">
            <h2 className="text-2xl font-serif font-bold text-gray-900">Performance & Status</h2>
            <div className="flex items-center gap-2">
               <span className="text-sm text-gray-500">As of:</span>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="outline" size="sm" className="h-7 text-xs font-medium border-gray-300 bg-white hover:bg-gray-50">
                        {asOfDate} <ChevronDown className="w-3 h-3 ml-2 text-gray-400" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                     {JOURNEY_SNAPSHOTS.map(date => (
                        <DropdownMenuItem key={date} onClick={() => setAsOfDate(date)} className="text-xs">
                           {date}
                        </DropdownMenuItem>
                     ))}
                  </DropdownMenuContent>
               </DropdownMenu>
               <Separator orientation="vertical" className="h-4 mx-1" />
               <Badge variant="secondary" className="bg-sky-100 text-sky-700 hover:bg-sky-200 border-sky-200 font-medium text-xs">
                  {status}
               </Badge>
            </div>
         </div>
      </section>

      {/* Zone 2: Health Summary (Integrated Triad) */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         {/* Top Bar: Journey Context */}
         <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs text-gray-500">
               <Activity className="w-3.5 h-3.5" />
               <span>Integrated Health View</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Snapshot</span>
         </div>

         <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left: Experience Score (Clickable) */}
            <button
               className="md:col-span-3 flex flex-col items-center justify-center space-y-2 cursor-pointer group rounded-xl p-3 -m-3 hover:bg-emerald-50/50 transition-all"
               onClick={() => setShowExperienceScore(true)}
               data-testid="button-experience-score"
            >
               <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1">Experience</span>
               <div className={cn(
                  "relative flex items-center justify-center w-24 h-16 rounded-lg border shadow-sm group-hover:shadow-md transition-all",
                  realExperienceScore !== null
                    ? realExperienceScore >= 4 ? "bg-emerald-100 border-emerald-200 group-hover:border-emerald-300" :
                      realExperienceScore >= 3 ? "bg-yellow-100 border-yellow-200 group-hover:border-yellow-300" :
                      "bg-red-100 border-red-200 group-hover:border-red-300"
                    : "bg-gray-100 border-gray-200 group-hover:border-gray-300"
               )}>
                  <span className={cn(
                    "text-4xl font-bold",
                    realExperienceScore !== null
                      ? realExperienceScore >= 4 ? "text-emerald-700" :
                        realExperienceScore >= 3 ? "text-yellow-700" :
                        "text-red-700"
                      : "text-gray-400"
                  )}>
                    {realExperienceScore !== null ? Math.round(realExperienceScore) : "—"}
                  </span>
               </div>
               <div className="flex items-center text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                  {realExperienceScore === null ? "Not scored yet" : realExperienceScore >= 4 ? "On Track" : realExperienceScore >= 3 ? "Moderate" : "Below Target"}
               </div>
               <span className="text-[9px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">Click to score</span>
            </button>

            {/* Middle: Drivers (Visual) */}
            <div className="md:col-span-6 flex flex-col items-center justify-center relative">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Key Levers</span>
               
               <div className="relative w-full bg-gray-50/80 rounded-2xl border border-gray-100 p-4">
                  <div className="flex justify-between items-start mb-6 px-4">
                      <div className="text-center">
                         <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">Design</div>
                         <button
                           type="button"
                           disabled={!isRingNode}
                           onClick={() => isRingNode && setShowRingDesignScore(true)}
                           className={cn(!isRingNode && "cursor-default")}
                           data-testid="button-design-score"
                         >
                           <Badge
                             variant="outline"
                             className={cn(
                               "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5",
                               isRingNode && "cursor-pointer hover:bg-emerald-100"
                             )}
                           >
                             {isRingNode ? (computedRingDesignScore ?? "—") : DRIVER_DATA.design.score}/5
                           </Badge>
                         </button>
                      </div>
                      <div className="text-center">
                         <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">Conditions</div>
                         <button
                           type="button"
                           disabled={!isRingNode}
                           onClick={() => isRingNode && setShowRingConditionsScore(true)}
                           className={cn(!isRingNode && "cursor-default")}
                           data-testid="button-conditions-score"
                         >
                           <Badge
                             variant="outline"
                             className={cn(
                               "bg-red-50 text-red-700 border-red-200 text-[10px] h-5",
                               isRingNode && "cursor-pointer hover:bg-red-100"
                             )}
                           >
                             {isRingNode ? (computedRingConditionsScore ?? "—") : DRIVER_DATA.conditions.score}/5
                           </Badge>
                         </button>
                      </div>
                  </div>
                  
                  {/* Flow Arrows Visual - Simplified Flux Capacitor */}
                  <div className="relative h-16 w-full flex justify-center items-center">
                     {/* Y Shape */}
                     <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <path d="M 60 10 L 100 35 L 140 10" fill="none" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
                        <line x1="100" y1="35" x2="100" y2="60" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
                        {/* Status Colors Overlay */}
                        <path d="M 60 10 L 100 35" fill="none" stroke="#fca5a5" strokeWidth="4" strokeLinecap="round" className="opacity-80" /> {/* Design (Red-ish for mock) */}
                        <path d="M 140 10 L 100 35" fill="none" stroke="#86efac" strokeWidth="4" strokeLinecap="round" className="opacity-80" /> {/* Conditions (Green-ish) */}
                        <line x1="100" y1="35" x2="100" y2="60" stroke="#fde047" strokeWidth="4" strokeLinecap="round" className="opacity-80" /> {/* Implementation (Yellow) */}
                        
                        {/* Arrow Head */}
                        <path d="M 96 55 L 100 60 L 104 55" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                     </svg>
                  </div>

                  <div className="text-center mt-1">
                      <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">Implementation</div>
                      <button
                        type="button"
                        disabled={!isRingNode}
                        onClick={() => isRingNode && setShowRingImplementationScore(true)}
                        className={cn(!isRingNode && "cursor-default")}
                        data-testid="button-implementation-score"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] h-5",
                            isRingNode && "cursor-pointer hover:bg-yellow-100"
                          )}
                        >
                          {isRingNode ? (computedRingImplementationScore ?? "—") : DRIVER_DATA.implementation.score}/5
                        </Badge>
                      </button>
                  </div>
               </div>
               
               <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200 -z-10 hidden md:block border-t border-dashed" />
               <span className="absolute bottom-0 text-[9px] text-gray-400 bg-white px-2 uppercase tracking-widest translate-y-1/2">Performance Drivers</span>
            </div>

            {/* Right: Outcomes Score (Clickable) */}
            <button
               className="md:col-span-3 flex flex-col items-center justify-center space-y-2 cursor-pointer group rounded-xl p-3 -m-3 hover:bg-red-50/50 transition-all"
               onClick={() => setShowOutcomeScore(true)}
               data-testid="button-outcome-score"
            >
               <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1">Outcomes</span>
               <div className={cn(
                  "relative flex items-center justify-center w-24 h-16 rounded-lg border shadow-sm group-hover:shadow-md transition-all",
                  realOutcomeScore !== null
                    ? realOutcomeScore >= 4 ? "bg-emerald-100 border-emerald-200 group-hover:border-emerald-300" :
                      realOutcomeScore >= 3 ? "bg-yellow-100 border-yellow-200 group-hover:border-yellow-300" :
                      "bg-red-100 border-red-200 group-hover:border-red-300"
                    : "bg-gray-100 border-gray-200 group-hover:border-gray-300"
               )}>
                  <span className={cn(
                    "text-4xl font-bold",
                    realOutcomeScore !== null
                      ? realOutcomeScore >= 4 ? "text-emerald-700" :
                        realOutcomeScore >= 3 ? "text-yellow-700" :
                        "text-red-700"
                      : "text-gray-400"
                  )}>
                    {realOutcomeScore !== null ? Math.round(realOutcomeScore) : "—"}
                  </span>
               </div>
               <div className="flex items-center text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                  {realOutcomeScore === null ? "Not scored yet" : realOutcomeScore >= 4 ? "On Track" : realOutcomeScore >= 3 ? "Moderate" : "Below Target"}
               </div>
               <span className="text-[9px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">Click to score</span>
            </button>
         </div>
      </section>

      {/* Zone 3: Drill-Downs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         
         {/* Left Column: Drivers Drill-Down */}
         <section className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Drivers
               </h3>
               <span className="text-xs text-gray-500">Inputs & Conditions</span>
            </div>
            
            <div className="space-y-3">
               {/* Design Panel */}
               <Collapsible className="group">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                     <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex flex-col items-center justify-center w-8 h-8 rounded font-bold text-sm",
                              isRingNode
                                ? computedRingDesignScore !== null
                                  ? computedRingDesignScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                    computedRingDesignScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-400"
                                : "bg-emerald-100 text-emerald-700"
                           )}>
                              {isRingNode ? (computedRingDesignScore ?? "—") : DRIVER_DATA.design.score}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Design Performance</h4>
                              <p className="text-xs text-gray-500">Coherence & Alignment</p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-4">
                           <Separator />

                           {isRingNode ? (
                             <>
                               <div className="space-y-1.5">
                                 {ringDesignScoreData?.designScoringMode !== "multi" ? (
                                   <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid="design-summary-overall-row">
                                     <div className="flex items-center gap-2">
                                       {(() => {
                                         const overall = ringDesignScoreData?.overallDesignScore ?? null;
                                         const color =
                                           overall !== null
                                             ? overall >= 4 ? "bg-emerald-100 text-emerald-700" :
                                               overall >= 3 ? "bg-yellow-100 text-yellow-700" :
                                               "bg-red-100 text-red-700"
                                             : "bg-gray-100 text-gray-400";
                                         return (
                                       <div className={cn(
                                         "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center",
                                         color
                                       )}>
                                         {overall ?? "—"}
                                       </div>
                                         );
                                       })()}
                                       <span className="text-xs text-gray-700">Overall Design Score</span>
                                     </div>
                                     <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                                       Overall mode
                                     </Badge>
                                   </div>
                                 ) : (
                                   ([
                                     { key: "aimsScore", name: "Aims for Learners", weightKey: "aimsWeight" },
                                     { key: "experienceScore", name: "Student Experience", weightKey: "experienceWeight" },
                                     { key: "resourcesScore", name: "Supporting Resources & Routines", weightKey: "resourcesWeight" },
                                   ] as const).map((row) => {
                                     const score = ringDesignScoreData?.designDimensions?.[row.key] ?? null;
                                     const rawW = ringDesignScoreData?.designWeights?.[row.weightKey];
                                     const w =
                                       rawW === "H" || rawW === "M" || rawW === "L"
                                         ? rawW
                                         : typeof rawW === "number"
                                           ? rawW >= 4
                                             ? "H"
                                             : rawW >= 2
                                               ? "M"
                                               : "L"
                                           : "M";
                                     const scoreLabel = score !== null ? String(score) : "—";
                                     return (
                                       <div key={row.key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid={`design-summary-dim-${row.key}`}>
                                         <div className="flex items-center gap-2 min-w-0">
                                           <div className={cn(
                                             "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                                             score !== null
                                               ? score >= 4 ? "bg-emerald-100 text-emerald-700" :
                                                 score >= 3 ? "bg-yellow-100 text-yellow-700" :
                                                 "bg-red-100 text-red-700"
                                               : "bg-gray-100 text-gray-400"
                                           )}>
                                             {scoreLabel}
                                           </div>
                                           <span className="text-xs text-gray-700 truncate">{row.name} ({w})</span>
                                         </div>
                                       </div>
                                     );
                                   })
                                 )}
                               </div>
                               <button
                                 onClick={() => setShowRingDesignScore(true)}
                                 className="w-full text-center text-[10px] text-blue-500 hover:text-blue-700 font-medium py-1 transition-colors"
                                 data-testid="link-view-design-details"
                               >
                                 View & edit design scores
                               </button>
                             </>
                           ) : (
                             <>
                               <p className="text-xs text-gray-600 italic">"{DRIVER_DATA.design.description}"</p>
                               <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-green-50 p-2 rounded border border-green-100">
                                     <span className="text-[10px] font-bold text-green-700 block mb-1">TAILWINDS</span>
                                     <ul className="list-disc list-inside text-[10px] text-gray-600">
                                        {DRIVER_DATA.design.tailwinds.map((t, i) => <li key={i}>{t}</li>)}
                                     </ul>
                                  </div>
                                  <div className="bg-red-50 p-2 rounded border border-red-100">
                                     <span className="text-[10px] font-bold text-red-700 block mb-1">HEADWINDS</span>
                                     <ul className="list-disc list-inside text-[10px] text-gray-600">
                                        {DRIVER_DATA.design.headwinds.map((t, i) => <li key={i}>{t}</li>)}
                                     </ul>
                                  </div>
                               </div>
                             </>
                           )}
                        </div>
                     </CollapsibleContent>
                  </div>
               </Collapsible>

               {/* Conditions Panel */}
               <Collapsible className="group" defaultOpen>
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                     <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex flex-col items-center justify-center w-8 h-8 rounded font-bold text-sm",
                              isRingNode
                                ? computedRingConditionsScore !== null
                                  ? computedRingConditionsScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                    computedRingConditionsScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-400"
                                : "bg-red-100 text-red-700"
                           )}>
                              {isRingNode ? (computedRingConditionsScore ?? "—") : DRIVER_DATA.conditions.score}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Conditions Performance</h4>
                              {isRingNode ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {(() => {
                                    const list: any[] = ((comp as any)?.healthData?.ringConditionsScoreData?.conditions || []) as any[];
                                    const tailwinds = list.filter((c) => c?.direction === "tailwind").length;
                                    const headwinds = list.filter((c) => c?.direction === "headwind").length;
                                    return (
                                      <>
                                        <span className="text-[10px] text-green-600 font-medium">{tailwinds} Tailwind{tailwinds !== 1 ? "s" : ""}</span>
                                        <span className="text-[10px] text-gray-300">•</span>
                                        <span className="text-[10px] text-red-600 font-medium">{headwinds} Headwind{headwinds !== 1 ? "s" : ""}</span>
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-green-600 font-medium">1 Tailwind</span>
                                  <span className="text-[10px] text-gray-300">•</span>
                                  <span className="text-[10px] text-red-600 font-medium">3 Headwinds</span>
                                </div>
                              )}
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           {isRingNode ? (
                             <>
                               {(((comp as any)?.healthData?.ringConditionsScoreData?.conditions || []) as any[]).length === 0 ? (
                                 <div className="text-xs text-gray-400 italic py-2">No conditions logged yet. Click below to add conditions.</div>
                               ) : (
                                 <div className="space-y-2">
                                   <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                     <div className="flex items-center justify-between gap-2 mb-1">
                                       <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white">
                                         <button
                                           type="button"
                                           onClick={() => setConditionsSummaryMode("stakeholder")}
                                           className={cn(
                                             "px-2 py-0.5 text-[10px] font-bold transition-colors",
                                             conditionsSummaryMode === "stakeholder" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-800",
                                           )}
                                           aria-pressed={conditionsSummaryMode === "stakeholder"}
                                           data-testid="conditions-summary-mode-stakeholder"
                                         >
                                           Stakeholders
                                         </button>
                                         <button
                                           type="button"
                                           onClick={() => setConditionsSummaryMode("type")}
                                           className={cn(
                                             "px-2 py-0.5 text-[10px] font-bold transition-colors border-l border-gray-200",
                                             conditionsSummaryMode === "type" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-800",
                                           )}
                                           aria-pressed={conditionsSummaryMode === "type"}
                                           data-testid="conditions-summary-mode-type"
                                         >
                                           Condition type
                                         </button>
                                       </div>
                                     </div>
                                     <div className="space-y-1.5">
                                       {(() => {
                                         const list: any[] = ((comp as any)?.healthData?.ringConditionsScoreData?.conditions || []) as any[];
                                         const stakeholderLabels: Record<string, string> = {
                                           students: "Students",
                                           families: "Families",
                                           educators_staff: "Educators / Staff",
                                           admin_district: "Administration (District)",
                                           admin_school: "Administration (School)",
                                           other_leaders: "Other Community Leaders",
                                         };

                                         const grouped = new Map<string, { tail: number; head: number }>();
                                         for (const c of list) {
                                           const dir = c?.direction;
                                           const add = (k: string) => {
                                             const cur = grouped.get(k) || { tail: 0, head: 0 };
                                             if (dir === "tailwind") cur.tail += 1;
                                             else if (dir === "headwind") cur.head += 1;
                                             grouped.set(k, cur);
                                           };

                                           if (conditionsSummaryMode === "stakeholder") {
                                             const g = String(c?.stakeholderGroup || "");
                                             if (!g) continue;
                                             add(g);
                                           } else {
                                             const tags: any[] = Array.isArray(c?.cs) ? c.cs : [];
                                             // Cs tagging is required; if missing, omit from type summary.
                                             for (const t of tags) {
                                               const k = String(t || "").trim();
                                               if (k) add(k);
                                             }
                                           }
                                         }
                                         const entries = Array.from(grouped.entries());
                                         entries.sort((a, b) => (b[1].head + b[1].tail) - (a[1].head + a[1].tail));
                                         return entries.map(([g, counts]) => (
                                           <div key={g} className="flex items-center justify-between text-xs">
                                             <span className="text-gray-700">
                                               {conditionsSummaryMode === "stakeholder" ? (stakeholderLabels[g] || g) : g}
                                             </span>
                                             <div className="flex items-center gap-1.5">
                                               <span className="text-[10px] text-green-600 font-semibold">
                                                 {counts.tail}T
                                               </span>
                                               <span className="text-[10px] text-gray-300">•</span>
                                               <span className="text-[10px] text-red-600 font-semibold">
                                                 {counts.head}H
                                               </span>
                                             </div>
                                           </div>
                                         ));
                                       })()}
                                     </div>
                                   </div>
                                 </div>
                               )}
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 className="w-full h-6 text-[10px] text-gray-400 hover:text-blue-600"
                                 onClick={() => setShowRingConditionsScore(true)}
                               >
                                 View & edit conditions
                               </Button>
                             </>
                           ) : (
                             <>
                               <p className="text-xs text-gray-600 italic">"{DRIVER_DATA.conditions.description}"</p>
                               <div className="space-y-2">
                                  <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                     <span className="text-[10px] font-bold text-gray-500 block mb-1 flex items-center gap-1">
                                        <TrendingDown className="w-3 h-3 text-red-500" /> TOP HEADWINDS
                                     </span>
                                     <ul className="space-y-1">
                                        {DRIVER_DATA.conditions.headwinds.map((t, i) => (
                                           <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                              <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                                              {t}
                                           </li>
                                        ))}
                                     </ul>
                                  </div>
                               </div>
                               <Button variant="ghost" size="sm" className="w-full h-6 text-[10px] text-gray-400 hover:text-blue-600">
                                  View all conditions factors
                               </Button>
                             </>
                           )}
                        </div>
                     </CollapsibleContent>
                  </div>
               </Collapsible>

               {/* Implementation Panel */}
               <Collapsible className="group">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                     <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex flex-col items-center justify-center w-8 h-8 rounded font-bold text-sm",
                              isRingNode
                                ? computedRingImplementationScore !== null
                                  ? computedRingImplementationScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                    computedRingImplementationScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-400"
                                : "bg-yellow-100 text-yellow-700"
                           )}>
                              {isRingNode ? (computedRingImplementationScore ?? "—") : DRIVER_DATA.implementation.score}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Implementation Performance</h4>
                              <p className="text-xs text-gray-500">Fidelity & Scale</p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           {isRingNode ? (
                             <>
                               <div className="space-y-1.5">
                                 {((comp as any)?.healthData?.ringImplementationScoreData?.implementationScoringMode === "overall") ? (
                                   <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid="implementation-summary-overall-row">
                                     <div className="flex items-center gap-2">
                                       <div className={cn(
                                         "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center",
                                         (comp as any)?.healthData?.ringImplementationScoreData?.overallImplementationScore !== null
                                           ? ((comp as any).healthData.ringImplementationScoreData.overallImplementationScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                             (comp as any).healthData.ringImplementationScoreData.overallImplementationScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                             "bg-red-100 text-red-700")
                                           : "bg-gray-100 text-gray-400"
                                       )}>
                                         {(comp as any)?.healthData?.ringImplementationScoreData?.overallImplementationScore ?? "—"}
                                       </div>
                                       <span className="text-xs text-gray-700">Overall Implementation Score</span>
                                     </div>
                                     <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                                       Overall mode
                                     </Badge>
                                   </div>
                                 ) : (
                                   ([
                                     { key: "quality", name: "Quality" },
                                     { key: "fidelity", name: "Fidelity" },
                                     { key: "scale", name: "Scale" },
                                     { key: "learnerDemand", name: "Learner Demand" },
                                   ] as const).map((row) => {
                                     const implData: any = (comp as any)?.healthData?.ringImplementationScoreData || {};
                                     const dim: any = implData.dimensions?.[row.key] || {};
                                     const score = dim.score ?? null;
                                     const w = dim.weight === "H" || dim.weight === "M" || dim.weight === "L" ? dim.weight : "M";
                                     const scoreLabel = score !== null ? String(score) : "—";
                                     return (
                                       <div key={row.key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid={`implementation-summary-dim-${row.key}`}>
                                         <div className="flex items-center gap-2 min-w-0">
                                           <div className={cn(
                                             "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                                             score !== null
                                               ? score >= 4 ? "bg-emerald-100 text-emerald-700" :
                                                 score >= 3 ? "bg-yellow-100 text-yellow-700" :
                                                 "bg-red-100 text-red-700"
                                               : "bg-gray-100 text-gray-400"
                                           )}>
                                             {scoreLabel}
                                           </div>
                                         <span className="text-xs text-gray-700 truncate">{row.name} ({w})</span>
                                         </div>
                                       </div>
                                     );
                                   })
                                 )}
                               </div>
                               <button
                                 onClick={() => setShowRingImplementationScore(true)}
                                 className="w-full text-center text-[10px] text-blue-500 hover:text-blue-700 font-medium py-1 transition-colors"
                                 data-testid="link-view-implementation-details"
                               >
                                 View & edit implementation scores
                               </button>
                             </>
                           ) : (
                             <>
                               <p className="text-xs text-gray-600 italic">"{DRIVER_DATA.implementation.description}"</p>
                               <div className="grid grid-cols-2 gap-2">
                                 {DRIVER_DATA.implementation.dimensions.map((dim, i) => (
                                   <div key={i} className="bg-gray-50 p-2 rounded border border-gray-100 flex justify-between items-center">
                                     <span className="text-xs font-medium text-gray-600">{dim.name}</span>
                                     <Badge
                                       variant="secondary"
                                       className={cn(
                                         "text-[10px] h-5",
                                         dim.value === "High"
                                           ? "bg-green-100 text-green-700"
                                           : dim.value === "Med"
                                             ? "bg-yellow-100 text-yellow-700"
                                             : "bg-red-100 text-red-700"
                                       )}
                                     >
                                       {dim.value}
                                     </Badge>
                                   </div>
                                 ))}
                               </div>
                             </>
                           )}
                        </div>
                     </CollapsibleContent>
                  </div>
               </Collapsible>

            </div>
         </section>

         {/* Right Column: Performance Drill-Down */}
         <section className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" /> Performance
               </h3>
               <span className="text-xs text-gray-500">Outputs & Results</span>
            </div>

             <div className="space-y-3">
               {/* Experience Panel - Real Data from healthData */}
               <Collapsible className="group" defaultOpen>
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                     <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex flex-col items-center justify-center w-8 h-8 rounded font-bold text-sm",
                              realExperienceScore !== null
                                ? realExperienceScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                  realExperienceScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-400"
                           )}>
                              {realExperienceScore !== null ? Math.round(realExperienceScore) : "—"}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Experience Score</h4>
                              <p className="text-xs text-gray-500">3 dimensions</p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           <div className="space-y-1.5">
                              {(() => {
                                const aims: any[] = ((comp as any)?.designedExperienceData?.keyDesignElements?.aims || []) as any[];
                                const leapCount = aims.filter((a) => a?.type === "leap").length;
                                let leapsWeight = 0;
                                if (leapCount >= 5) leapsWeight = 0.60;
                                else if (leapCount >= 3) leapsWeight = 0.50;
                                else if (leapCount >= 1) leapsWeight = 0.40;
                                const remaining = 1.0 - leapsWeight;
                                const base = { leaps: leapsWeight, health: remaining / 2, behavior: remaining / 2 };

                                const dims = [
                                  { key: "leaps" as const, name: "Leaps & Design Principles", dim: experienceDimensions.leaps, score: experienceScoreData?.leapsDimensionScore ?? null },
                                  { key: "health" as const, name: "Mental & Physical Health", dim: experienceDimensions.health, score: experienceScoreData?.healthDimensionScore ?? null },
                                  { key: "behavior" as const, name: "Behavior, Attendance & Engagement", dim: experienceDimensions.behavior, score: experienceScoreData?.behaviorDimensionScore ?? null },
                                ];

                                const scored = dims.map((d) => {
                                  const measures = d.dim?.measures || [];
                                  const excluded = d.key !== "leaps" && measures.length === 0;
                                  const hasScore = d.key === "leaps" ? d.score !== null : d.score !== null && !excluded;
                                  return { ...d, excluded, hasScore };
                                });

                                const missingWeight = scored.filter((d) => !d.hasScore).reduce((s, d) => s + (base as any)[d.key], 0);
                                const scoredCount = scored.filter((d) => d.hasScore).length;
                                const redist = scoredCount > 0 ? missingWeight / scoredCount : 0;
                                const adjusted: Record<string, number> = { leaps: 0, health: 0, behavior: 0 };
                                for (const d of scored) {
                                  adjusted[d.key] = d.hasScore ? (base as any)[d.key] + redist : 0;
                                }

                                return scored.map(({ key, name, dim, score, excluded }) => {
                                const measures = dim?.measures || [];
                                const ratedCount = measures.filter((m: any) => m.rating !== null && !m.skipped).length;
                                const isExcluded = !!dim?.excluded || excluded;
                                const scoreLabel = score !== null ? (Math.round(score * 10) / 10).toFixed(1) : "—";
                                const wtLabel = `${Math.round((adjusted as any)[key] * 100)}%`;
                                return (
                                  <div key={key} className={cn("flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0", isExcluded && "opacity-50")} data-testid={`health-experience-dim-${key}`}>
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center",
                                        score !== null
                                          ? score >= 4 ? "bg-emerald-100 text-emerald-700" :
                                            score >= 3 ? "bg-yellow-100 text-yellow-700" :
                                            "bg-red-100 text-red-700"
                                          : "bg-gray-100 text-gray-400"
                                      )}>
                                        {scoreLabel}
                                      </div>
                                      <span className={cn("text-xs text-gray-700", isExcluded && "line-through")}>{name} ({wtLabel})</span>
                                      {isExcluded && <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Excluded</span>}
                                    </div>
                                    <span className="text-[10px] text-gray-400">{ratedCount} measure{ratedCount !== 1 ? "s" : ""}</span>
                                  </div>
                                );
                              });
                              })()}
                           </div>
                           <button
                              onClick={() => setShowExperienceScore(true)}
                              className="w-full text-center text-[10px] text-blue-500 hover:text-blue-700 font-medium py-1 transition-colors"
                              data-testid="link-view-experience-details"
                           >
                              View & edit experience scores
                           </button>
                        </div>
                     </CollapsibleContent>
                  </div>
               </Collapsible>

               {/* Outcomes Panel - Real Data from healthData */}
               <Collapsible className="group" defaultOpen>
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                     <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex flex-col items-center justify-center w-8 h-8 rounded font-bold text-sm",
                              realOutcomeScore !== null
                                ? realOutcomeScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                  realOutcomeScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-400"
                           )}>
                              {realOutcomeScore !== null ? Math.round(realOutcomeScore) : "—"}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Outcomes Score</h4>
                              <p className="text-xs text-gray-500">{targetedOutcomes.length} outcome{targetedOutcomes.length !== 1 ? "s" : ""} tracked</p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           {targetedOutcomes.length === 0 ? (
                              <div className="text-xs text-gray-400 italic py-2">No outcomes scored yet. Click the Outcomes box above to add and score outcomes.</div>
                           ) : (
                              <div className="space-y-1.5">
                                 {targetedOutcomes.map((o: any) => {
                                    const score = o.calculatedScore ?? null;
                                    const priority = o.priority || "M";
                                    const name = o.outcomeName || "Untitled";
                                    const scoreLabel = score !== null ? (Math.round(score * 10) / 10).toFixed(1) : "—";
                                    const measures: any[] = o.measures || [];
                                    const ratedCount = measures.filter((m: any) => m.rating !== null && !m.skipped).length;
                                    return (
                                       <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid={`health-outcome-row-${o.id}`}>
                                          <div className="flex items-center gap-2 min-w-0">
                                             <div
                                               className={cn(
                                                 "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                                                 score !== null
                                                   ? score >= 4 ? "bg-emerald-100 text-emerald-700" :
                                                     score >= 3 ? "bg-yellow-100 text-yellow-700" :
                                                     "bg-red-100 text-red-700"
                                                   : "bg-gray-100 text-gray-400"
                                               )}
                                             >
                                               {scoreLabel}
                                             </div>
                                             <span className={cn("text-xs text-gray-700 truncate", o.skipped && "line-through text-gray-400")}>{name} ({priority})</span>
                                             {o.skipped && <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Skipped</span>}
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-gray-400">{ratedCount} measure{ratedCount !== 1 ? "s" : ""}</span>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           )}
                           <button
                              onClick={() => setShowOutcomeScore(true)}
                              className="w-full text-center text-[10px] text-blue-500 hover:text-blue-700 font-medium py-1 transition-colors"
                              data-testid="link-view-outcome-details"
                           >
                              View & edit outcome scores
                           </button>
                        </div>
                     </CollapsibleContent>
                  </div>
               </Collapsible>
             </div>
         </section>

      </div>
    </div>
  );
}