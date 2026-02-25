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
import { calculateRingDesignDimensionScores, calculateRingDesignScore } from "@shared/ring-design-score";
import type { RingDesignScoreData } from "@shared/schema";
import RingDesignScoreView from "./ring-design-score-view";
import RingImplementationScoreView from "./ring-implementation-score-view";
import { calculateRingImplementationScore } from "@shared/ring-implementation-score";
import RingConditionsScoreView from "./ring-conditions-score-view";
import { calculateRingConditionsScore, calculateRingConditionsScoreFromData, calculateRingConditionsSum } from "@shared/ring-conditions-score";
import { effectiveFromInstances, UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import { getSchoolYearKey, getSemesterKey, listSelectableSemesterKeys, listSelectableYearKeys, parseIsoDate } from "@shared/marking-period";
import type { ScoreFilter, ScoreInstance } from "@shared/schema";
import ScoreFilterBar from "./score-filter-bar";
import ScoreFlags, { SignalFlags } from "./score-flags";

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

  const isOverall = String(nodeId || "") === "overall";
  const isRingNode = !!nodeId && (RING_NODE_IDS as readonly string[]).includes(nodeId);
  const canUseRingConditions = !!comp && (isRingNode || isOverall);
  const canUseRingDesign = !!comp && (isRingNode || isOverall);
  const canUseRingImplementation = !!comp && (isRingNode || isOverall);
  const canOpenDriverScoring = !!comp;

  const [asOfDate, setAsOfDate] = useState("Sept '25 (Baseline)");
  const [status, setStatus] = useState("Test & Refine");
  const [showOutcomeScore, setShowOutcomeScore] = useState(false);
  const [showExperienceScore, setShowExperienceScore] = useState(false);
  const [showRingDesignScore, setShowRingDesignScore] = useState(false);
  const [showRingImplementationScore, setShowRingImplementationScore] = useState(false);
  const [showRingConditionsScore, setShowRingConditionsScore] = useState(false);
  const [conditionsSummaryMode, setConditionsSummaryMode] = useState<"stakeholder" | "type">("stakeholder");
  const [healthSummaryView, setHealthSummaryView] = useState<"overview" | "flags">("overview");
  const [globalFilter, setGlobalFilter] = useState<ScoreFilter>({
    mode: "year",
    yearKey: listSelectableYearKeys(new Date(), 5)[0],
    aggregation: "singleLatest",
  } as any);

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

  const globalActors = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (label: unknown) => {
      const clean = String(label ?? "").trim();
      if (!clean) return;
      const key = normActor(clean);
      if (key === UNKNOWN_ACTOR_KEY) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };

    const hd: any = (comp as any)?.healthData || {};
    const implActors: any[] = (hd?.ringImplementationScoreData as any)?.actors || [];
    const outActors: any[] = (outcomeScoreData as any)?.actors || [];
    const expActors: any[] = (experienceScoreData as any)?.actors || [];

    for (const a of implActors) add(a);
    for (const a of outActors) add(a);
    for (const a of expActors) add(a);

    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [comp, outcomeScoreData, experienceScoreData]);

  const ringDesignScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return (hd.ringDesignScoreData || null) as RingDesignScoreData | null;
  }, [comp]);

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

  const computedTargetedOutcomes = useMemo(() => {
    const list: any[] = Array.isArray(targetedOutcomes) ? targetedOutcomes : [];
    const W: Record<string, number> = { H: 6, M: 3, L: 1 };
    const calc = (measures: any[]): number | null => {
      const ms = Array.isArray(measures) ? measures : [];
      let totalW = 0;
      let total = 0;
      for (const m of ms) {
        if (m?.skipped) continue;
        const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
        const rating = insts.length > 0 ? effectiveFromInstances(insts, globalFilter).score : null;
        if (rating === null) continue;
        const w = W[String(m?.priority || "M")] ?? 1;
        totalW += w;
        total += rating * w;
      }
      if (totalW <= 0) return null;
      return Math.round((total / totalW) * 100) / 100;
    };
    return list.map((o) => ({ ...o, calculatedScore: calc(o?.measures || []) }));
  }, [globalFilter, targetedOutcomes]);

  const realOutcomeScore = useMemo(() => {
    if (!outcomeScoreData) return null;
    const stored = (outcomeScoreData as any)?.finalOutcomeScore;
    if (typeof stored === "number" && Number.isFinite(stored)) return Math.max(1, Math.min(5, Math.round(stored)));
    const mode = String((outcomeScoreData as any)?.scoringMode || "targeted");
    const W: Record<string, number> = { H: 6, M: 3, L: 1 };

    const roundFinal1to5 = (score: number | null): number | null => {
      if (score === null) return null;
      const rounded = Math.round(score);
      if (rounded < 1) return 1;
      if (rounded > 5) return 5;
      return rounded;
    };

    const weightedAvg = (items: { rating: number | null; priority: string; skipped: boolean }[]): number | null => {
      let totalWeight = 0;
      let totalScore = 0;
      for (const item of items) {
        if (item.skipped || item.rating === null) continue;
        const w = W[item.priority] ?? 1;
        totalWeight += w;
        totalScore += item.rating * w;
      }
      if (totalWeight <= 0) return null;
      return Math.round((totalScore / totalWeight) * 100) / 100;
    };

    if (mode === "overall") {
      const overallMeasures: any[] = Array.isArray((outcomeScoreData as any)?.overallMeasures) ? (outcomeScoreData as any).overallMeasures : [];
      const items = overallMeasures.map((m) => {
        const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
        const rating = insts.length > 0 ? effectiveFromInstances(insts, globalFilter).score : null;
        return { rating, priority: String(m?.priority || "M"), skipped: !!m?.skipped };
      });
      return roundFinal1to5(weightedAvg(items));
    }

    const items = computedTargetedOutcomes.map((o: any) => ({
      rating: o?.calculatedScore ?? null,
      priority: String(o?.priority || "M"),
      skipped: !!o?.skipped,
    }));
    return roundFinal1to5(weightedAvg(items));
  }, [computedTargetedOutcomes, globalFilter, outcomeScoreData]);

  const realExperienceScore = useMemo(() => {
    if (!experienceScoreData) return null;
    const stored = (experienceScoreData as any)?.finalExperienceScore;
    if (typeof stored === "number" && Number.isFinite(stored)) return Math.max(1, Math.min(5, Math.round(stored)));

    const W: Record<string, number> = { H: 6, M: 3, L: 1 };
    const roundFinal1to5 = (score: number | null): number | null => {
      if (score === null) return null;
      const rounded = Math.round(score);
      if (rounded < 1) return 1;
      if (rounded > 5) return 5;
      return rounded;
    };
    const weightedAvg = (items: { rating: number | null; priority: string; skipped: boolean }[]): number | null => {
      let totalWeight = 0;
      let totalScore = 0;
      for (const item of items) {
        if (item.skipped || item.rating === null) continue;
        const w = W[item.priority] ?? 1;
        totalWeight += w;
        totalScore += item.rating * w;
      }
      if (totalWeight <= 0) return null;
      return Math.round((totalScore / totalWeight) * 100) / 100;
    };
    const measureRating = (m: any): number | null => {
      const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
      if (insts.length === 0) return null;
      return effectiveFromInstances(insts, globalFilter).score;
    };
    const dimScore = (dim: any): number | null => {
      const ms: any[] = Array.isArray(dim?.measures) ? dim.measures : [];
      return weightedAvg(ms.map((m) => ({ rating: measureRating(m), priority: String(m?.priority || "M"), skipped: !!m?.skipped })));
    };
    const itemScore = (measures: any[]): number | null => {
      const ms: any[] = Array.isArray(measures) ? measures : [];
      return weightedAvg(ms.map((m) => ({ rating: measureRating(m), priority: String(m?.priority || "M"), skipped: !!m?.skipped })));
    };

    const leapAims: any[] = ((comp as any)?.designedExperienceData?.keyDesignElements?.aims || []).filter((a: any) => a?.type === "leap");
    const leapCount = new Set(leapAims.map((a: any) => String(a?.label || "").trim().toLowerCase()).filter(Boolean)).size;
    const calcWeights = (count: number) => {
      let leapsWeight = 0;
      if (count >= 5) leapsWeight = 0.6;
      else if (count >= 3) leapsWeight = 0.5;
      else if (count >= 1) leapsWeight = 0.4;
      const remaining = 1 - leapsWeight;
      return { leapsWeight, healthWeight: remaining / 2, behaviorWeight: remaining / 2 };
    };
    const baseWeights = calcWeights(leapCount);

    const scoringMode = String((experienceScoreData as any)?.scoringMode || "dimensions");
    if (scoringMode === "overall") {
      const overallMeasures: any[] = Array.isArray((experienceScoreData as any)?.overallMeasures) ? (experienceScoreData as any).overallMeasures : [];
      const raw = weightedAvg(overallMeasures.map((m) => ({ rating: measureRating(m), priority: String(m?.priority || "M"), skipped: !!m?.skipped })));
      return roundFinal1to5(raw);
    }

    const leapsScoringMode = String((experienceScoreData as any)?.leapsScoringMode || "across");
    const leaps = (experienceScoreData as any)?.leaps || { measures: [] };
    const health = (experienceScoreData as any)?.health || { measures: [] };
    const behavior = (experienceScoreData as any)?.behavior || { measures: [] };
    const leapItems: any[] = Array.isArray((experienceScoreData as any)?.leapItems) ? (experienceScoreData as any).leapItems : [];

    const leapsDimScore =
      leapsScoringMode === "individual"
        ? (() => {
            let totalWeight = 0;
            let total = 0;
            for (const it of leapItems) {
              const s = itemScore(it?.measures || []);
              if (s === null) continue;
              const w = W[String(it?.weight || "M")] ?? 1;
              totalWeight += w;
              total += s * w;
            }
            if (totalWeight <= 0) return null;
            return Math.round((total / totalWeight) * 100) / 100;
          })()
        : dimScore(leaps);

    const healthDimScore = dimScore(health);
    const behaviorDimScore = dimScore(behavior);

    // Redistribute missing weights across scored dimensions.
    const dims: { score: number; weight: number }[] = [];
    const missingWeights: number[] = [];
    if (baseWeights.leapsWeight > 0) {
      if (leapsDimScore !== null) dims.push({ score: leapsDimScore, weight: baseWeights.leapsWeight });
      else missingWeights.push(baseWeights.leapsWeight);
    }
    if (healthDimScore !== null && baseWeights.healthWeight > 0) dims.push({ score: healthDimScore, weight: baseWeights.healthWeight });
    else missingWeights.push(baseWeights.healthWeight);
    if (behaviorDimScore !== null && baseWeights.behaviorWeight > 0) dims.push({ score: behaviorDimScore, weight: baseWeights.behaviorWeight });
    else missingWeights.push(baseWeights.behaviorWeight);
    if (dims.length === 0) return null;
    if (baseWeights.leapsWeight > 0 && leapsDimScore === null) return null;

    const totalMissing = missingWeights.reduce((s, w) => s + w, 0);
    const redistPerDim = totalMissing / dims.length;
    let total = 0;
    for (const d of dims) {
      total += d.score * (d.weight + redistPerDim);
    }
    const raw = Math.round(total * 100) / 100;
    return roundFinal1to5(raw);
  }, [comp, experienceScoreData, globalFilter]);
  const experienceDimensions = useMemo(() => {
    if (!experienceScoreData)
      return {
        leaps: { instances: [], measures: [], excluded: false },
        health: { instances: [], measures: [], excluded: false },
        behavior: { instances: [], measures: [], excluded: false },
      };
    return {
      leaps: (experienceScoreData as any).leaps || { instances: [], measures: [], excluded: false },
      health: (experienceScoreData as any).health || { instances: [], measures: [], excluded: false },
      behavior: (experienceScoreData as any).behavior || { instances: [], measures: [], excluded: false },
    };
  }, [experienceScoreData]);

  const computedRingDesignDimensionScores = useMemo(() => {
    const data: any = (comp as any)?.healthData?.ringDesignScoreData;
    if (!data) return null;
    const rsd = { ...data, filter: globalFilter } as any;
    return calculateRingDesignDimensionScores(rsd as any);
  }, [comp, globalFilter]);

  const computedRingDesignScore = useMemo(() => {
    const data: any = (comp as any)?.healthData?.ringDesignScoreData;
    if (!data) return calculateRingDesignScore(comp as any);
    const tmp = {
      ...(comp as any),
      healthData: {
        ...((comp as any)?.healthData || {}),
        ringDesignScoreData: {
          ...data,
          filter: globalFilter,
        },
      },
    };
    return calculateRingDesignScore(tmp as any);
  }, [comp, globalFilter]);

  const computedRingImplementationScore = useMemo(() => {
    const data: any = (comp as any)?.healthData?.ringImplementationScoreData;
    if (!data) return calculateRingImplementationScore(comp as any);
    const tmp = {
      ...(comp as any),
      healthData: {
        ...((comp as any)?.healthData || {}),
        ringImplementationScoreData: {
          ...data,
          filter: globalFilter,
        },
      },
    };
    return calculateRingImplementationScore(tmp as any);
  }, [comp, globalFilter]);

  const getImplEffectiveFromInstances = (instances: any[], filter: any): { score: number | null; weightLabel: "H" | "M" | "L" | null } => {
    const inPeriod = (asOfDate: string) => {
      const d = parseIsoDate(String(asOfDate || ""));
      if (!d) return false;
      const mode = filter?.mode || "none";
      if (mode === "none") return true;
      if (mode === "year") {
        const y = String(filter?.yearKey || "");
        if (!y) return true;
        return getSchoolYearKey(d) === y;
      }
      if (mode === "semester") {
        const s = String(filter?.semesterKey || "");
        if (!s) return true;
        return getSemesterKey(d) === s;
      }
      return true;
    };

    const scored = (instances || []).filter((i) => i?.score !== null && i?.score !== undefined && inPeriod(i?.asOfDate));
    if (scored.length === 0) return { score: null, weightLabel: null };

    const safeDt = (asOfDate: string) => {
      const d = parseIsoDate(String(asOfDate || ""));
      return d ? d.getTime() : 0;
    };
    const UNKNOWN_ACTOR_KEY = "__unknown__";
    const normActor = (v: unknown) => {
      const clean = String(v ?? "").trim();
      if (!clean) return UNKNOWN_ACTOR_KEY;
      return clean.toLowerCase();
    };
    const wVal = (w: unknown) => (w === "H" ? 4 : w === "M" ? 2 : 1);

    if ((filter?.aggregation || "singleLatest") === "latestPerActor") {
      const wanted = normActor(filter?.actorKey);
      if (!wanted) return { score: null, weightLabel: null };
      const eligible = scored.filter((i) => normActor(i?.actor) === wanted);
      if (eligible.length === 0) return { score: null, weightLabel: null };
      const latest = [...eligible].sort((a, b) => safeDt(b?.asOfDate) - safeDt(a?.asOfDate))[0];
      const w = latest?.weight === "H" || latest?.weight === "M" || latest?.weight === "L" ? latest.weight : "M";
      return { score: Number(latest?.score), weightLabel: w };
    }

    // Single Latest (default): latest per actor, then weighted avg across actors.
    const byActor = new Map<string, any>();
    for (const inst of scored) {
      const key = normActor(inst?.actor);
      const prev = byActor.get(key);
      if (!prev || safeDt(inst?.asOfDate) > safeDt(prev?.asOfDate)) byActor.set(key, inst);
    }
    const latests = Array.from(byActor.values());
    if (latests.length === 0) return { score: null, weightLabel: null };

    let totalW = 0;
    let total = 0;
    for (const inst of latests) {
      const s = inst?.score;
      if (s === null || s === undefined) continue;
      const w = wVal(inst?.weight);
      totalW += w;
      total += Number(s) * w;
    }
    if (totalW <= 0) return { score: null, weightLabel: null };
    const avg = total / totalW;
    const score = Math.max(1, Math.min(5, Math.round(avg)));
    const avgW = totalW / Math.max(1, latests.length);
    const weightLabel: "H" | "M" | "L" = avgW >= 3 ? "H" : avgW >= 1.5 ? "M" : "L";
    return { score, weightLabel };
  };

  const getImplEffectiveFromItems = (items: any[], filter: any): { score: number | null } => {
    const PRIORITY_WEIGHT: Record<"H" | "M" | "L", number> = { H: 6, M: 3, L: 1 };
    const safeScore = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return null;
      const i = Math.round(n);
      if (i < 1 || i > 5) return null;
      return i;
    };
    const safeHml = (v: unknown): "H" | "M" | "L" => (v === "H" || v === "M" || v === "L" ? v : "M");

    const list = Array.isArray(items) ? items : [];
    let totalW = 0;
    let total = 0;
    for (const it of list) {
      const insts = Array.isArray((it as any)?.instances) ? (it as any).instances : [];
      const score = insts.length > 0 ? getImplEffectiveFromInstances(insts, filter).score : null;
      if (score === null) continue;
      const p = safeHml((it as any)?.priority);
      const w = PRIORITY_WEIGHT[p] || 1;
      totalW += w;
      total += score * w;
    }
    if (totalW <= 0) return { score: null };
    const avg = total / totalW;
    const rounded = Math.max(1, Math.min(5, Math.round(avg)));
    return { score: rounded };
  };

  const computedRingConditionsScore = useMemo(() => {
    const data: any = (comp as any)?.healthData?.ringConditionsScoreData;
    if (!data) return calculateRingConditionsScore(comp as any);
    const tmp = {
      ...(comp as any),
      healthData: {
        ...((comp as any)?.healthData || {}),
        ringConditionsScoreData: {
          ...data,
          filter: globalFilter,
        },
      },
    };
    return calculateRingConditionsScore(tmp as any);
  }, [comp, globalFilter]);

  if (showExperienceScore) {
    return (
      <ExperienceScoreView
        nodeId={nodeId}
        title={title}
        onBack={() => setShowExperienceScore(false)}
        sourceFilter={globalFilter}
        onFilterChange={setGlobalFilter}
      />
    );
  }

  if (showOutcomeScore) {
    return (
      <OutcomeScoreView
        nodeId={nodeId}
        title={title}
        onBack={() => setShowOutcomeScore(false)}
        sourceFilter={globalFilter}
        onFilterChange={setGlobalFilter}
      />
    );
  }

  if (showRingDesignScore) {
    return (
      <RingDesignScoreView
        nodeId={nodeId}
        title={title}
        onBack={() => setShowRingDesignScore(false)}
        sourceFilter={globalFilter}
        onFilterChange={setGlobalFilter}
      />
    );
  }

  if (showRingImplementationScore) {
    return (
      <RingImplementationScoreView
        nodeId={nodeId}
        title={title}
        onBack={() => setShowRingImplementationScore(false)}
        sourceFilter={globalFilter}
        onFilterChange={setGlobalFilter}
      />
    );
  }

  if (showRingConditionsScore) {
    return (
      <RingConditionsScoreView
        nodeId={nodeId}
        title={title}
        onBack={() => setShowRingConditionsScore(false)}
        sourceFilter={globalFilter}
        onFilterChange={setGlobalFilter}
      />
    );
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

      <ScoreFilterBar
        filter={globalFilter}
        onChange={setGlobalFilter as any}
        actors={globalActors}
        className="p-4"
        testId="health-global-filter"
      />

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
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Drivers</span>
               
               <div className="relative w-full bg-gray-50/80 rounded-2xl border border-gray-100 p-4">
                  <div className="flex justify-between items-start mb-6 px-4">
                      <div className="text-center">
                         <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">Design</div>
                         <button
                           type="button"
                           disabled={!canOpenDriverScoring}
                           onClick={() => setShowRingDesignScore(true)}
                           className={cn(!canOpenDriverScoring && "cursor-default")}
                           data-testid="button-design-score"
                         >
                           <Badge
                             variant="outline"
                             className={cn(
                               "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5",
                               canOpenDriverScoring && "cursor-pointer hover:bg-emerald-100"
                             )}
                           >
                             {(computedRingDesignScore ?? "—")}/5
                           </Badge>
                         </button>
                      </div>
                      <div className="text-center">
                         <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">Conditions</div>
                         <button
                           type="button"
                           disabled={!canOpenDriverScoring}
                           onClick={() => setShowRingConditionsScore(true)}
                           className={cn(!canOpenDriverScoring && "cursor-default")}
                           data-testid="button-conditions-score"
                         >
                           <Badge
                             variant="outline"
                             className={cn(
                               "bg-red-50 text-red-700 border-red-200 text-[10px] h-5",
                               canOpenDriverScoring && "cursor-pointer hover:bg-red-100"
                             )}
                           >
                             {(computedRingConditionsScore ?? "—")}/5
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
                        disabled={!canOpenDriverScoring}
                        onClick={() => setShowRingImplementationScore(true)}
                        className={cn(!canOpenDriverScoring && "cursor-default")}
                        data-testid="button-implementation-score"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] h-5",
                            canOpenDriverScoring && "cursor-pointer hover:bg-yellow-100"
                          )}
                        >
                          {(computedRingImplementationScore ?? "—")}/5
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
                              canUseRingDesign
                                ? computedRingDesignScore !== null
                                  ? computedRingDesignScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                    computedRingDesignScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-400"
                                : "bg-emerald-100 text-emerald-700"
                           )}>
                              {canUseRingDesign ? (computedRingDesignScore ?? "—") : DRIVER_DATA.design.score}
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

                           {canUseRingDesign ? (
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
                                  healthSummaryView === "flags" ? (
                                    <ScoreFlags
                                      collapsible={false}
                                      overallScore={computedRingDesignScore}
                                      items={[
                                        { key: "aims", label: "Aims", score: (computedRingDesignDimensionScores as any)?.aimsScore ?? null },
                                        { key: "experience", label: "Experience", score: (computedRingDesignDimensionScores as any)?.experienceScore ?? null },
                                        { key: "resources", label: "Resources", score: (computedRingDesignDimensionScores as any)?.resourcesScore ?? null },
                                      ]}
                                      threshold={2}
                                      testId="health-design-flags"
                                    />
                                  ) : (
                                    <div className="space-y-1.5" data-testid="design-summary-rows">
                                      {([
                                        { key: "aimsScore", name: "Aims", weightKey: "aimsWeight" },
                                        { key: "experienceScore", name: "Experience", weightKey: "experienceWeight" },
                                        { key: "resourcesScore", name: "Resources", weightKey: "resourcesWeight" },
                                      ] as const).map((row) => {
                                        const score =
                                          (computedRingDesignDimensionScores as any)?.[row.key] ??
                                          (ringDesignScoreData as any)?.designDimensions?.[row.key] ??
                                          null;
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
                                          <div
                                            key={row.key}
                                            className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
                                            data-testid={`design-summary-row-${row.key}`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div
                                                className={cn(
                                                  "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                                                  score !== null
                                                    ? score >= 4
                                                      ? "bg-emerald-100 text-emerald-700"
                                                      : score >= 3
                                                        ? "bg-yellow-100 text-yellow-700"
                                                        : "bg-red-100 text-red-700"
                                                    : "bg-gray-100 text-gray-400",
                                                )}
                                              >
                                                {scoreLabel}
                                              </div>
                                              <span className="text-xs text-gray-700 truncate">
                                                {row.name} (W: {w})
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )
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
                              canUseRingConditions
                                ? computedRingConditionsScore !== null
                                  ? computedRingConditionsScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                    computedRingConditionsScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-400"
                                : "bg-red-100 text-red-700"
                           )}>
                              {canUseRingConditions ? (computedRingConditionsScore ?? "—") : DRIVER_DATA.conditions.score}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Conditions Performance</h4>
                              {canUseRingConditions ? (
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
                           {canUseRingConditions ? (
                             <>
                               {(((comp as any)?.healthData?.ringConditionsScoreData?.conditions || []) as any[]).length === 0 ? (
                                 <div className="text-xs text-gray-400 italic py-2">No conditions logged yet. Click below to add conditions.</div>
                               ) : (
                                 <div className="space-y-2">
                                   <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                     <div className="flex items-center justify-between gap-2 mb-1">
                                      {healthSummaryView !== "flags" ? (
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
                                      ) : null}
                                     </div>
                                     <div className="space-y-1.5">
                                       {healthSummaryView === "flags"
                                         ? (() => {
                                             const list: any[] = ((comp as any)?.healthData?.ringConditionsScoreData?.conditions || []) as any[];
                                             const stakeholderLabels: Record<string, string> = {
                                               students: "Students",
                                               families: "Families",
                                               educators_staff: "Educators / Staff",
                                               admin_district: "Administration (District)",
                                               admin_school: "Administration (School)",
                                               other_leaders: "Other Community Leaders",
                                             };

                                            const items = list.map((c: any) => {
                                              const sum =
                                                calculateRingConditionsSum({
                                                  actors: globalActors as any,
                                                  filter: globalFilter as any,
                                                  conditions: [c],
                                                  finalConditionsScore: null,
                                                  conditionsSum: null,
                                                } as any) ?? null;
                                              const desc = String(c?.description || "").trim();
                                              const group = String(c?.stakeholderGroup || "").trim();
                                              const label = desc ? desc : group ? (stakeholderLabels[group] || group) : "Condition";
                                              return { key: String(c?.id || label), label, value: sum };
                                            });

                                            return (
                                              <SignalFlags
                                                collapsible={false}
                                                title="Flags"
                                                items={items as any}
                                                maxPerSide={3}
                                                showValues={false}
                                                testId="health-conditions-flags"
                                              />
                                            );
                                           })()
                                         : (() => {
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
                                                   const kk = String(t || "").trim();
                                                   if (kk) add(kk);
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
                                                   <span className="text-[10px] text-green-600 font-semibold">{counts.tail}T</span>
                                                   <span className="text-[10px] text-gray-300">•</span>
                                                   <span className="text-[10px] text-red-600 font-semibold">{counts.head}H</span>
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
                              canUseRingImplementation
                                ? computedRingImplementationScore !== null
                                  ? computedRingImplementationScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                    computedRingImplementationScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-400"
                                : "bg-yellow-100 text-yellow-700"
                           )}>
                              {canUseRingImplementation ? (computedRingImplementationScore ?? "—") : DRIVER_DATA.implementation.score}
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
                           {canUseRingImplementation ? (
                             <>
                               <div className="space-y-1.5">
                                 {((comp as any)?.healthData?.ringImplementationScoreData?.implementationScoringMode === "overall") ? (
                                   <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid="implementation-summary-overall-row">
                                     <div className="flex items-center gap-2">
                                       <div className={cn(
                                         "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center",
                                        computedRingImplementationScore !== null
                                          ? (computedRingImplementationScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                            computedRingImplementationScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                             "bg-red-100 text-red-700")
                                           : "bg-gray-100 text-gray-400"
                                       )}>
                                        {computedRingImplementationScore ?? "—"}
                                       </div>
                                       <span className="text-xs text-gray-700">Overall Implementation Score</span>
                                     </div>
                                     <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
                                       Overall mode
                                     </Badge>
                                   </div>
                                ) : healthSummaryView === "flags" ? (
                                  (() => {
                                    const rows = [
                                      { key: "studentsEnrollment", name: "Enrollment" },
                                      { key: "feasibilitySustainability", name: "Feasibility" },
                                      { key: "fidelityDesignedExperience", name: "Fidelity" },
                                      { key: "qualityDelivery", name: "Delivery" },
                                      { key: "measurementAdministrationQuality", name: "Measurement" },
                                    ] as const;

                                    const implData: any = (comp as any)?.healthData?.ringImplementationScoreData || {};
                                    const dims: any = implData.dimensions || {};
                                    const legacyMap: Record<string, string> = {
                                      studentsEnrollment: "scale",
                                      feasibilitySustainability: "learnerDemand",
                                      fidelityDesignedExperience: "fidelity",
                                      qualityDelivery: "quality",
                                    };

                                    const items = rows.map((row) => {
                                      const legacyKey = legacyMap[row.key];
                                      const dim: any = dims?.[row.key] || (legacyKey ? dims?.[legacyKey] : {}) || {};
                                      const instances = Array.isArray(dim.instances) ? dim.instances : [];
                                      const mode = dim?.scoringMode === "items" ? "items" : "overall";
                                      const eff =
                                        mode === "items"
                                          ? { score: getImplEffectiveFromItems(dim.items, globalFilter).score, weightLabel: null as any }
                                          : instances.length > 0
                                            ? getImplEffectiveFromInstances(instances, globalFilter)
                                            : { score: dim.score ?? null, weightLabel: null as any };
                                      const score = eff.score ?? (dim.score ?? null);
                                      return { key: row.key, label: row.name, score };
                                    });

                                    return (
                                      <ScoreFlags
                                        collapsible={false}
                                        overallScore={computedRingImplementationScore}
                                        items={items as any}
                                        threshold={2}
                                        testId="health-implementation-flags"
                                      />
                                    );
                                  })()
                                ) : (
                                  <div className="space-y-1.5" data-testid="implementation-summary-rows">
                                    {([
                                      { key: "studentsEnrollment", name: "Enrollment" },
                                      { key: "feasibilitySustainability", name: "Feasibility" },
                                      { key: "fidelityDesignedExperience", name: "Fidelity" },
                                      { key: "qualityDelivery", name: "Delivery" },
                                      { key: "measurementAdministrationQuality", name: "Measurement" },
                                    ] as const).map((row) => {
                                      const implData: any = (comp as any)?.healthData?.ringImplementationScoreData || {};
                                      const dims: any = implData.dimensions || {};
                                      const legacyMap: Record<string, string> = {
                                        studentsEnrollment: "scale",
                                        feasibilitySustainability: "learnerDemand",
                                        fidelityDesignedExperience: "fidelity",
                                        qualityDelivery: "quality",
                                      };
                                      const legacyKey = legacyMap[row.key];
                                      const dim: any = dims?.[row.key] || (legacyKey ? dims?.[legacyKey] : {}) || {};
                                      const instances = Array.isArray(dim.instances) ? dim.instances : [];
                                      const mode = dim?.scoringMode === "items" ? "items" : "overall";

                                      const eff =
                                        mode === "items"
                                          ? {
                                              score: getImplEffectiveFromItems(dim.items, globalFilter).score,
                                              weightLabel: (dim.weight === "H" || dim.weight === "M" || dim.weight === "L" ? dim.weight : "M") as any,
                                            }
                                          : instances.length > 0
                                            ? getImplEffectiveFromInstances(instances, globalFilter)
                                            : { score: dim.score ?? null, weightLabel: null as any };

                                      const score = eff.score ?? (dim.score ?? null);
                                      const w =
                                        mode === "items"
                                          ? dim.weight === "H" || dim.weight === "M" || dim.weight === "L"
                                            ? dim.weight
                                            : "M"
                                          : eff.weightLabel ??
                                            (dim.weight === "H" || dim.weight === "M" || dim.weight === "L" ? dim.weight : "M");
                                      const scoreLabel = score !== null ? String(score) : "—";

                                      return (
                                        <div
                                          key={row.key}
                                          className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
                                          data-testid={`implementation-summary-row-${row.key}`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div
                                              className={cn(
                                                "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                                                score !== null
                                                  ? score >= 4
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : score >= 3
                                                      ? "bg-yellow-100 text-yellow-700"
                                                      : "bg-red-100 text-red-700"
                                                  : "bg-gray-100 text-gray-400",
                                              )}
                                            >
                                              {scoreLabel}
                                            </div>
                                            <span className="text-xs text-gray-700 truncate">
                                              {row.name} (W: {w})
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
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
               <div className="flex items-center gap-3">
                 <span className="text-xs text-gray-500 hidden sm:inline">Outputs &amp; Results</span>
                 <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white">
                   <button
                     type="button"
                     onClick={() => setHealthSummaryView("overview")}
                     className={cn(
                       "px-3 py-1.5 text-[11px] font-semibold transition-colors",
                       healthSummaryView === "overview" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900",
                     )}
                     aria-pressed={healthSummaryView === "overview"}
                     data-testid="health-summary-view-overview"
                   >
                     Overview
                   </button>
                   <button
                     type="button"
                     onClick={() => setHealthSummaryView("flags")}
                     className={cn(
                       "px-3 py-1.5 text-[11px] font-semibold transition-colors border-l border-gray-200",
                       healthSummaryView === "flags" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:text-gray-900",
                     )}
                     aria-pressed={healthSummaryView === "flags"}
                     data-testid="health-summary-view-flags"
                   >
                     Flags
                   </button>
                 </div>
               </div>
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
                                  const excluded = d.key !== "leaps" && measures.length === 0 && d.score === null;
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

                                if (healthSummaryView === "flags") {
                                  const leapsMode = String((experienceScoreData as any)?.leapsScoringMode || "across");
                                  const items =
                                    leapsMode === "individual"
                                      ? (((experienceScoreData as any)?.leapItems || []) as any[]).map((li: any) => ({
                                          key: `leap:${String(li?.id || Math.random())}`,
                                          label: String(li?.label || "Leap"),
                                          score: effectiveFromInstances((li?.instances || []) as any, globalFilter).score,
                                        }))
                                      : [
                                          ...(((experienceDimensions.leaps as any)?.measures || []) as any[]).filter((m: any) => m && !m?.skipped).map((m: any) => ({
                                            key: String(m?.id || m?.name || Math.random()),
                                            label: `Leaps: ${String(m?.name || "Measure")}`,
                                            score: (() => {
                                              const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
                                              return insts.length > 0 ? effectiveFromInstances(insts as any, globalFilter).score : null;
                                            })(),
                                          })),
                                          ...(((experienceDimensions.health as any)?.measures || []) as any[]).filter((m: any) => m && !m?.skipped).map((m: any) => ({
                                            key: String(m?.id || m?.name || Math.random()),
                                            label: `Health: ${String(m?.name || "Measure")}`,
                                            score: (() => {
                                              const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
                                              return insts.length > 0 ? effectiveFromInstances(insts as any, globalFilter).score : null;
                                            })(),
                                          })),
                                          ...(((experienceDimensions.behavior as any)?.measures || []) as any[]).filter((m: any) => m && !m?.skipped).map((m: any) => ({
                                            key: String(m?.id || m?.name || Math.random()),
                                            label: `Behavior: ${String(m?.name || "Measure")}`,
                                            score: (() => {
                                              const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
                                              return insts.length > 0 ? effectiveFromInstances(insts as any, globalFilter).score : null;
                                            })(),
                                          })),
                                        ];

                                  return (
                                    <ScoreFlags
                                      collapsible={false}
                                      overallScore={realExperienceScore}
                                      items={items as any}
                                      threshold={2}
                                      maxPerSide={6}
                                      testId="health-experience-flags"
                                    />
                                  );
                                }

                                return scored.map(({ key, name, dim, score, excluded }) => {
                                const ratedCount = isOverall
                                  ? (() => {
                                      const insts: ScoreInstance[] = Array.isArray((dim as any)?.instances) ? ((dim as any).instances as ScoreInstance[]) : [];
                                      return insts.filter((i: any) => effectiveFromInstances([i] as any, globalFilter).score !== null).length;
                                    })()
                                  : (() => {
                                      const measures = (dim as any)?.measures || [];
                                      return (measures as any[]).filter((m: any) => {
                                        if (m?.skipped) return false;
                                        const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
                                        const eff = insts.length > 0 ? effectiveFromInstances(insts, globalFilter).score : null;
                                        return eff !== null;
                                      }).length;
                                    })();
                                const isExcluded = !!dim?.excluded || excluded;
                                const scoreLabel = score !== null ? String(Math.max(1, Math.min(5, Math.round(score)))) : "—";
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
                              <p className="text-xs text-gray-500">{computedTargetedOutcomes.length} outcome{computedTargetedOutcomes.length !== 1 ? "s" : ""} tracked</p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           {computedTargetedOutcomes.length === 0 ? (
                              <div className="text-xs text-gray-400 italic py-2">No outcomes scored yet. Click the Outcomes box above to add and score outcomes.</div>
                           ) : (
                             healthSummaryView === "flags" ? (
                               <ScoreFlags
                                 collapsible={false}
                                 overallScore={realOutcomeScore}
                                 items={computedTargetedOutcomes.map((o: any) => ({
                                   key: String(o.id),
                                   label: String(o.outcomeName || "Outcome"),
                                   score: o.skipped ? null : (o.calculatedScore ?? null),
                                 }))}
                                 threshold={2}
                                 testId="health-outcomes-flags"
                               />
                             ) : (
                               <div className="space-y-1.5">
                                 {computedTargetedOutcomes.map((o: any) => {
                                   const score = o.calculatedScore ?? null;
                                   const priority = o.priority || "M";
                                   const name = o.outcomeName || "Untitled";
                                   const scoreLabel = score !== null ? String(Math.max(1, Math.min(5, Math.round(score)))) : "—";
                                   const ratedCount = isOverall
                                     ? (() => {
                                         const insts: ScoreInstance[] = Array.isArray((o as any)?.instances) ? ((o as any).instances as ScoreInstance[]) : [];
                                         return insts.filter((i: any) => effectiveFromInstances([i] as any, globalFilter).score !== null).length;
                                       })()
                                     : (() => {
                                         const measures: any[] = (o as any).measures || [];
                                         return measures.filter((m: any) => {
                                           if (m?.skipped) return false;
                                           const insts: ScoreInstance[] = Array.isArray(m?.instances) ? (m.instances as ScoreInstance[]) : [];
                                           const eff = insts.length > 0 ? effectiveFromInstances(insts, globalFilter).score : null;
                                           return eff !== null;
                                         }).length;
                                       })();
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
                                       <div className="flex items-center gap-2 shrink-0" />
                                     </div>
                                   );
                                 })}
                               </div>
                             )
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