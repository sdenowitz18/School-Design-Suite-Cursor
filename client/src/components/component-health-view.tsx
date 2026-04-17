import React, { useCallback, useMemo, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { componentQueries } from "@/lib/api";
import OutcomeScoreView from "./outcome-score-view";
import ExperienceScoreView from "./experience-score-view";
import DesignScoreView from "./design-score-view";
import ImplementationScoreView from "./implementation-score-view";
import { calcFinalImplementationScore, calcImplementationTopDimensionScore } from "@shared/implementation-score-calc";
import { IMPLEMENTATION_SUBDIMENSION_TREE } from "@shared/implementation-subdimension-tree";
import { calcFinalDesignScore, calcDesignDimensionScore } from "@shared/design-score-calc";
import { DESIGN_SUBDIMENSION_TREE } from "@shared/design-subdimension-tree";
import RingConditionsScoreView from "./ring-conditions-score-view";
import {
  calculateRingConditionsScore,
  calculateRingConditionsScoreFromData,
  calculateRingConditionsSum,
  getConditionStakeholderGroups,
  getPrimaryStakeholderGroup,
} from "@shared/ring-conditions-score";
import { effectiveFromInstances, UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import { calcOverallOutcomeScore, calcL1Score } from "@shared/outcome-score-calc";
import { calcFinalExperienceScore, migrateLegacyExperienceScoreData } from "@shared/experience-score-calc";
import { isLeapAimActive } from "@shared/aim-selection";
import {
  experienceHealthSubdimensions,
  experienceWeightsForComponent,
  remapExperienceSubdimensionIdsOnMeasures,
} from "@shared/experience-subdimension-tree";
import type { OutcomeMeasure } from "@shared/schema";
import {
  LEARNING_ADVANCEMENT_OUTCOME_TREE,
  WELLBEING_CONDUCT_OUTCOME_TREE,
  getL1ByIdInTree,
  type OutcomeSubDimL1,
} from "@shared/outcome-subdimension-tree";
import { getSchoolYearKey, getSemesterKey, listSelectableSemesterKeys, listSelectableYearKeys, parseIsoDate } from "@shared/marking-period";
import type { ScoreFilter, ScoreInstance } from "@shared/schema";
import ScoreFilterBar from "./score-filter-bar";
import ScoreFlags, { SignalFlags } from "./score-flags";
import { DrilldownNavBar } from "./drilldown-nav-bar";
/** Ring node = any component that isn't "overall". No hardcoded list. */

function scorePillClass(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-500 border-gray-200";
  if (score >= 4) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 3) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
}

/** SVG / connector stroke color aligned with score bands (null → neutral gray). */
function flowConnectorStroke(score: number | null): string {
  if (score === null) return "#cbd5e1";
  if (score >= 4) return "#10b981";
  if (score >= 3) return "#ca8a04";
  return "#ef4444";
}

interface ComponentHealthViewProps {
  nodeId?: string;
  title?: string;
}


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
  const { data: allComponents } = useQuery(componentQueries.all as any);

  const isOverall = String(nodeId || "") === "overall";
  const isRingNode = !!nodeId && nodeId !== "overall";
  const canUseRingConditions = !!comp;
  const canUseRingDesign = !!comp;
  const canUseRingImplementation = !!comp;
  const canOpenDriverScoring = !!comp;

  const [status, setStatus] = useState("Test & Refine");
  const [showLearningOutcomeScore, setShowLearningOutcomeScore] = useState(false);
  const [showWellbeingOutcomeScore, setShowWellbeingOutcomeScore] = useState(false);
  const [showExperienceScore, setShowExperienceScore] = useState(false);
  const [showRingDesignScore, setShowRingDesignScore] = useState(false);
  const [showRingImplementationScore, setShowRingImplementationScore] = useState(false);
  const [showRingConditionsScore, setShowRingConditionsScore] = useState(false);
  /** L1 outcome sub-dimension drill (STEM, etc.) — synced with OutcomeScoreView when shell breadcrumbs are used. */
  const [learningOutcomeScoreL1Id, setLearningOutcomeScoreL1Id] = useState<string | null>(null);
  const [wellbeingOutcomeScoreL1Id, setWellbeingOutcomeScoreL1Id] = useState<string | null>(null);
  const [conditionsSummaryMode, setConditionsSummaryMode] = useState<"stakeholder" | "type">("stakeholder");
  const [healthSummaryView, setHealthSummaryView] = useState<"overview" | "flags">("overview");
  const [globalFilter, setGlobalFilter] = useState<ScoreFilter>({
    mode: "year",
    yearKey: listSelectableYearKeys(new Date(), 5)[0],
    aggregation: "singleLatest",
  } as any);

  const exitHealthScoreDrill = useCallback(() => {
    setShowExperienceScore(false);
    setShowLearningOutcomeScore(false);
    setShowWellbeingOutcomeScore(false);
    setShowRingDesignScore(false);
    setShowRingImplementationScore(false);
    setShowRingConditionsScore(false);
    setLearningOutcomeScoreL1Id(null);
    setWellbeingOutcomeScoreL1Id(null);
  }, []);

  const learningAdvancementOutcomeScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return hd.learningAdvancementOutcomeScoreData || null;
  }, [comp]);

  const wellbeingConductOutcomeScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return hd.wellbeingConductOutcomeScoreData || null;
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
    const implActors: any[] = (hd?.implementationScoreData as any)?.actors || [];
    const designActors: any[] = (hd?.designScoreData as any)?.actors || [];
    const laActors: any[] = (learningAdvancementOutcomeScoreData as any)?.actors || [];
    const wbActors: any[] = (wellbeingConductOutcomeScoreData as any)?.actors || [];
    const expActors: any[] = (experienceScoreData as any)?.actors || [];

    for (const a of implActors) add(a);
    for (const a of designActors) add(a);
    for (const a of laActors) add(a);
    for (const a of wbActors) add(a);
    for (const a of expActors) add(a);

    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [comp, learningAdvancementOutcomeScoreData, wellbeingConductOutcomeScoreData, experienceScoreData]);

  const designScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return hd.designScoreData || null;
  }, [comp]);

  const realLearningOutcomeScore = useMemo(() => {
    if (!learningAdvancementOutcomeScoreData) return null;
    const osd = learningAdvancementOutcomeScoreData as any;
    const rawMeasures: any[] = Array.isArray(osd?.measures) ? osd.measures : [];
    const rawOverall: any[] = Array.isArray(osd?.overallMeasures) ? osd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> = osd?.subDimensionWeights && typeof osd.subDimensionWeights === "object" ? osd.subDimensionWeights : {};
    const score = calcOverallOutcomeScore(rawMeasures, rawOverall, weights, globalFilter, LEARNING_ADVANCEMENT_OUTCOME_TREE);
    if (score === null) return null;
    return Math.max(1, Math.min(5, Math.round(score)));
  }, [learningAdvancementOutcomeScoreData, globalFilter]);

  const realWellbeingOutcomeScore = useMemo(() => {
    if (!wellbeingConductOutcomeScoreData) return null;
    const osd = wellbeingConductOutcomeScoreData as any;
    const rawMeasures: any[] = Array.isArray(osd?.measures) ? osd.measures : [];
    const rawOverall: any[] = Array.isArray(osd?.overallMeasures) ? osd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> = osd?.subDimensionWeights && typeof osd.subDimensionWeights === "object" ? osd.subDimensionWeights : {};
    const score = calcOverallOutcomeScore(rawMeasures, rawOverall, weights, globalFilter, WELLBEING_CONDUCT_OUTCOME_TREE);
    if (score === null) return null;
    return Math.max(1, Math.min(5, Math.round(score)));
  }, [wellbeingConductOutcomeScoreData, globalFilter]);

  const leapAimsForExperience = useMemo(() => {
    const aims: any[] = ((comp as any)?.designedExperienceData?.keyDesignElements?.aims || []) as any[];
    return aims.filter((a) => a?.type === "leap" && typeof a?.label === "string" && isLeapAimActive(a));
  }, [comp]);

  const experienceTopsHealth = useMemo(
    () => experienceHealthSubdimensions((allComponents as any[]) || []),
    [allComponents],
  );

  const migratedExperienceData = useMemo(() => {
    if (!experienceScoreData) {
      return {
        measures: [] as OutcomeMeasure[],
        overallMeasures: [] as OutcomeMeasure[],
        subDimensionWeights: {} as Record<string, "H" | "M" | "L">,
      };
    }
    const m = migrateLegacyExperienceScoreData(experienceScoreData, leapAimsForExperience);
    return {
      ...m,
      measures: comp ? remapExperienceSubdimensionIdsOnMeasures(m.measures, comp) : m.measures,
    };
  }, [experienceScoreData, leapAimsForExperience, comp]);

  const realExperienceScore = useMemo(() => {
    if (!experienceScoreData) return null;
    const stored = (experienceScoreData as any)?.finalExperienceScore;
    if (typeof stored === "number" && Number.isFinite(stored)) return Math.max(1, Math.min(5, Math.round(stored)));

    const roundFinal1to5 = (score: number | null): number | null => {
      if (score === null) return null;
      const rounded = Math.round(score);
      if (rounded < 1) return 1;
      if (rounded > 5) return 5;
      return rounded;
    };

    const { measures, overallMeasures, subDimensionWeights } = migratedExperienceData;
    const esdW =
      (experienceScoreData as any)?.subDimensionWeights && typeof (experienceScoreData as any).subDimensionWeights === "object"
        ? (experienceScoreData as any).subDimensionWeights
        : {};
    const weights: Record<string, "H" | "M" | "L"> = {
      ...(comp ? experienceWeightsForComponent(comp, experienceTopsHealth) : {}),
      ...subDimensionWeights,
      ...esdW,
    };

    const raw = calcFinalExperienceScore(
      measures as OutcomeMeasure[],
      overallMeasures as OutcomeMeasure[],
      weights,
      globalFilter,
      experienceTopsHealth,
    );
    return roundFinal1to5(raw);
  }, [comp, experienceScoreData, experienceTopsHealth, globalFilter, migratedExperienceData]);

  const experienceWeightsResolved = useMemo(() => {
    const base = comp ? experienceWeightsForComponent(comp, experienceTopsHealth) : {};
    if (!experienceScoreData) {
      return base;
    }
    const { subDimensionWeights } = migratedExperienceData;
    const esdW =
      (experienceScoreData as any)?.subDimensionWeights && typeof (experienceScoreData as any).subDimensionWeights === "object"
        ? (experienceScoreData as any).subDimensionWeights
        : {};
    return { ...base, ...subDimensionWeights, ...esdW };
  }, [comp, experienceScoreData, experienceTopsHealth, migratedExperienceData]);

  const experienceSubdimensionRows = useMemo(() => {
    if (experienceTopsHealth.length === 0) return [];
    const { measures, overallMeasures } = migratedExperienceData;
    return experienceTopsHealth.map((top) => {
      const s = calcImplementationTopDimensionScore(
        top as any,
        measures as OutcomeMeasure[],
        overallMeasures as OutcomeMeasure[],
        experienceWeightsResolved,
        globalFilter,
      );
      return {
        key: top.id,
        label: top.label,
        weight: experienceWeightsResolved[top.id] || "M",
        score: s !== null ? Math.max(1, Math.min(5, Math.round(s))) : null,
      };
    });
  }, [experienceTopsHealth, experienceWeightsResolved, globalFilter, migratedExperienceData]);

  const designSummaryRows = useMemo(() => {
    const dsd = designScoreData as any;
    const rawMeasures: any[] = dsd && Array.isArray(dsd?.measures) ? dsd.measures : [];
    const rawOverall: any[] = dsd && Array.isArray(dsd?.overallMeasures) ? dsd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> =
      dsd?.subDimensionWeights && typeof dsd.subDimensionWeights === "object" ? dsd.subDimensionWeights : {};
    return DESIGN_SUBDIMENSION_TREE.map((top) => {
      const s = designScoreData
        ? calcDesignDimensionScore(top as any, rawMeasures, rawOverall, weights, globalFilter)
        : null;
      return {
        id: top.id,
        label: top.label,
        weight: weights[top.id] || "M",
        score: s !== null ? Math.max(1, Math.min(5, Math.round(s))) : null,
      };
    });
  }, [designScoreData, globalFilter]);

  /** Learning & advancement — same five L1 areas as OutcomeScoreView (drivers + performance cards). */
  const learningOutcomeDimensionRows = useMemo(() => {
    const tree = LEARNING_ADVANCEMENT_OUTCOME_TREE;
    const osd = learningAdvancementOutcomeScoreData as any;
    const rawMeasures: any[] = osd && Array.isArray(osd?.measures) ? osd.measures : [];
    const rawOverall: any[] = osd && Array.isArray(osd?.overallMeasures) ? osd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> =
      osd?.subDimensionWeights && typeof osd.subDimensionWeights === "object" ? osd.subDimensionWeights : {};
    return tree.map((l1: OutcomeSubDimL1) => {
      const l2Ids = new Set(l1.children.map((c) => c.id));
      const tagged = rawMeasures.filter(
        (m: any) => Array.isArray(m?.subDimensionIds) && m.subDimensionIds.some((id: string) => l2Ids.has(id)),
      );
      const score = osd ? calcL1Score(l1, rawMeasures, rawOverall, weights, globalFilter) : null;
      return { key: l1.id, label: l1.label, score, count: tagged.length };
    });
  }, [learningAdvancementOutcomeScoreData, globalFilter]);

  /** Wellbeing & conduct — same two L1 groups as OutcomeScoreView. */
  const wellbeingOutcomeDimensionRows = useMemo(() => {
    const tree = WELLBEING_CONDUCT_OUTCOME_TREE;
    const osd = wellbeingConductOutcomeScoreData as any;
    const rawMeasures: any[] = osd && Array.isArray(osd?.measures) ? osd.measures : [];
    const rawOverall: any[] = osd && Array.isArray(osd?.overallMeasures) ? osd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> =
      osd?.subDimensionWeights && typeof osd.subDimensionWeights === "object" ? osd.subDimensionWeights : {};
    return tree.map((l1: OutcomeSubDimL1) => {
      const l2Ids = new Set(l1.children.map((c) => c.id));
      const tagged = rawMeasures.filter(
        (m: any) => Array.isArray(m?.subDimensionIds) && m.subDimensionIds.some((id: string) => l2Ids.has(id)),
      );
      const score = osd ? calcL1Score(l1, rawMeasures, rawOverall, weights, globalFilter) : null;
      return { key: l1.id, label: l1.label, score, count: tagged.length };
    });
  }, [wellbeingConductOutcomeScoreData, globalFilter]);

  const computedRingDesignScore = useMemo(() => {
    if (!designScoreData) return null;
    const dsd = designScoreData as any;
    const rawMeasures: any[] = Array.isArray(dsd?.measures) ? dsd.measures : [];
    const rawOverall: any[] = Array.isArray(dsd?.overallMeasures) ? dsd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> =
      dsd?.subDimensionWeights && typeof dsd.subDimensionWeights === "object" ? dsd.subDimensionWeights : {};
    const score = calcFinalDesignScore(rawMeasures, rawOverall, weights, globalFilter);
    if (score === null) return null;
    return Math.max(1, Math.min(5, Math.round(score)));
  }, [designScoreData, globalFilter]);

  const implementationScoreData = useMemo(() => {
    if (!comp) return null;
    const hd: any = comp.healthData || {};
    return hd.implementationScoreData || null;
  }, [comp]);

  const computedRingImplementationScore = useMemo(() => {
    if (!implementationScoreData) return null;
    const isd = implementationScoreData as any;
    const rawMeasures: any[] = Array.isArray(isd?.measures) ? isd.measures : [];
    const rawOverall: any[] = Array.isArray(isd?.overallMeasures) ? isd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> =
      isd?.subDimensionWeights && typeof isd.subDimensionWeights === "object" ? isd.subDimensionWeights : {};
    const score = calcFinalImplementationScore(rawMeasures, rawOverall, weights, globalFilter);
    if (score === null) return null;
    return Math.max(1, Math.min(5, Math.round(score)));
  }, [implementationScoreData, globalFilter]);

  const implementationSummaryRows = useMemo(() => {
    const isd = implementationScoreData as any;
    const rawMeasures: any[] = isd && Array.isArray(isd?.measures) ? isd.measures : [];
    const rawOverall: any[] = isd && Array.isArray(isd?.overallMeasures) ? isd.overallMeasures : [];
    const weights: Record<string, "H" | "M" | "L"> =
      isd?.subDimensionWeights && typeof isd.subDimensionWeights === "object" ? isd.subDimensionWeights : {};
    return IMPLEMENTATION_SUBDIMENSION_TREE.map((top) => {
      const s = implementationScoreData
        ? calcImplementationTopDimensionScore(top, rawMeasures, rawOverall, weights, globalFilter)
        : null;
      return {
        id: top.id,
        label: top.label,
        weight: weights[top.id] || "M",
        score: s !== null ? Math.max(1, Math.min(5, Math.round(s))) : null,
      };
    });
  }, [implementationScoreData, globalFilter]);

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

    // If actorKey is set, filter to that actor only
    if (filter?.actorKey && filter.actorKey !== "__unknown__") {
      const wanted = normActor(filter.actorKey);
      const eligible = scored.filter((i) => normActor(i?.actor) === wanted);
      if (eligible.length === 0) return { score: null, weightLabel: null };
      const latest = [...eligible].sort((a, b) => safeDt(b?.asOfDate) - safeDt(a?.asOfDate))[0];
      const w = latest?.weight === "H" || latest?.weight === "M" || latest?.weight === "L" ? latest.weight : "M";
      return { score: Number(latest?.score), weightLabel: w };
    }

    // Default: latest per actor, then weighted avg across actors.
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DrilldownNavBar
          sectionTitle="Status and Health"
          onNavigateSectionRoot={exitHealthScoreDrill}
          ancestors={[]}
          currentTitle="Experience score"
          onBack={exitHealthScoreDrill}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <ExperienceScoreView
            nodeId={nodeId}
            title={title}
            onBack={exitHealthScoreDrill}
            sourceFilter={globalFilter}
            onFilterChange={setGlobalFilter}
            hideShellBackButton
          />
        </div>
      </div>
    );
  }

  if (showLearningOutcomeScore) {
    const learningL1Row = learningOutcomeScoreL1Id
      ? getL1ByIdInTree(LEARNING_ADVANCEMENT_OUTCOME_TREE, learningOutcomeScoreL1Id)
      : null;
    const learningHubTitle = "Learning & advancement outcome score";
    const learningAncestorLabel = "Learning & advancement outcomes";
    const popLearningL1 = () => setLearningOutcomeScoreL1Id(null);
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DrilldownNavBar
          sectionTitle="Status and Health"
          onNavigateSectionRoot={exitHealthScoreDrill}
          ancestors={
            learningL1Row
              ? [{ label: learningAncestorLabel, onNavigate: popLearningL1 }]
              : []
          }
          currentTitle={learningL1Row ? learningL1Row.label : learningHubTitle}
          onBack={learningL1Row ? popLearningL1 : exitHealthScoreDrill}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <OutcomeScoreView
            nodeId={nodeId}
            title={title}
            variant="learningAdvancement"
            onBack={exitHealthScoreDrill}
            sourceFilter={globalFilter}
            onFilterChange={setGlobalFilter}
            hideShellBackButton
            selectedL1Id={learningOutcomeScoreL1Id}
            onSelectedL1IdChange={setLearningOutcomeScoreL1Id}
          />
        </div>
      </div>
    );
  }

  if (showWellbeingOutcomeScore) {
    const wellbeingL1Row = wellbeingOutcomeScoreL1Id
      ? getL1ByIdInTree(WELLBEING_CONDUCT_OUTCOME_TREE, wellbeingOutcomeScoreL1Id)
      : null;
    const wellbeingHubTitle = "Wellbeing & conduct outcome score";
    const wellbeingAncestorLabel = "Wellbeing & conduct outcomes";
    const popWellbeingL1 = () => setWellbeingOutcomeScoreL1Id(null);
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DrilldownNavBar
          sectionTitle="Status and Health"
          onNavigateSectionRoot={exitHealthScoreDrill}
          ancestors={
            wellbeingL1Row
              ? [{ label: wellbeingAncestorLabel, onNavigate: popWellbeingL1 }]
              : []
          }
          currentTitle={wellbeingL1Row ? wellbeingL1Row.label : wellbeingHubTitle}
          onBack={wellbeingL1Row ? popWellbeingL1 : exitHealthScoreDrill}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <OutcomeScoreView
            nodeId={nodeId}
            title={title}
            variant="wellbeingConduct"
            onBack={exitHealthScoreDrill}
            sourceFilter={globalFilter}
            onFilterChange={setGlobalFilter}
            hideShellBackButton
            selectedL1Id={wellbeingOutcomeScoreL1Id}
            onSelectedL1IdChange={setWellbeingOutcomeScoreL1Id}
          />
        </div>
      </div>
    );
  }

  if (showRingDesignScore) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DrilldownNavBar
          sectionTitle="Status and Health"
          onNavigateSectionRoot={exitHealthScoreDrill}
          ancestors={[]}
          currentTitle="Design score"
          onBack={exitHealthScoreDrill}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <DesignScoreView
            nodeId={nodeId}
            title={title}
            onBack={exitHealthScoreDrill}
            sourceFilter={globalFilter}
            onFilterChange={setGlobalFilter}
            hideShellBackButton
          />
        </div>
      </div>
    );
  }

  if (showRingImplementationScore) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DrilldownNavBar
          sectionTitle="Status and Health"
          onNavigateSectionRoot={exitHealthScoreDrill}
          ancestors={[]}
          currentTitle="Implementation score"
          onBack={exitHealthScoreDrill}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <ImplementationScoreView
            nodeId={nodeId}
            title={title}
            onBack={exitHealthScoreDrill}
            sourceFilter={globalFilter}
            onFilterChange={setGlobalFilter}
            hideShellBackButton
          />
        </div>
      </div>
    );
  }

  if (showRingConditionsScore) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DrilldownNavBar
          sectionTitle="Status and Health"
          onNavigateSectionRoot={exitHealthScoreDrill}
          ancestors={[]}
          currentTitle="Conditions score"
          onBack={exitHealthScoreDrill}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <RingConditionsScoreView
            nodeId={nodeId}
            title={title}
            onBack={exitHealthScoreDrill}
            sourceFilter={globalFilter}
            onFilterChange={setGlobalFilter}
            hideShellBackButton
          />
        </div>
      </div>
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
            <h2 className="text-2xl font-serif font-bold text-gray-900">Status &amp; Health</h2>
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

         <div className="p-6">
            <div className="w-full max-w-4xl mx-auto">
               <span className="block text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Drivers</span>

               <div className="flex flex-col md:flex-row md:items-start md:justify-center gap-6 md:gap-2 lg:gap-4">
                  <div className="flex justify-center md:w-36 lg:w-40 shrink-0 md:pt-10 order-2 md:order-1">
                     <button
                        type="button"
                        className="flex flex-col items-center justify-center space-y-2 cursor-pointer group rounded-xl p-3 border border-transparent hover:border-gray-200 hover:bg-slate-50/80 transition-all"
                        onClick={() => {
                          setLearningOutcomeScoreL1Id(null);
                          setShowLearningOutcomeScore(true);
                        }}
                        data-testid="button-learning-outcome-score"
                     >
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 text-center leading-tight">
                           Learning &amp; advancement
                        </span>
                        <div
                           className={cn(
                              "relative flex items-center justify-center w-24 h-16 rounded-lg border shadow-sm group-hover:shadow-md transition-all",
                              realLearningOutcomeScore !== null
                                 ? realLearningOutcomeScore >= 4
                                    ? "bg-emerald-100 border-emerald-200 group-hover:border-emerald-300"
                                    : realLearningOutcomeScore >= 3
                                      ? "bg-yellow-100 border-yellow-200 group-hover:border-yellow-300"
                                      : "bg-red-100 border-red-200 group-hover:border-red-300"
                                 : "bg-gray-100 border-gray-200 group-hover:border-gray-300",
                           )}
                        >
                           <span
                              className={cn(
                                 "text-4xl font-bold",
                                 realLearningOutcomeScore !== null
                                    ? realLearningOutcomeScore >= 4 ? "text-emerald-700"
                                       : realLearningOutcomeScore >= 3
                                         ? "text-yellow-700"
                                         : "text-red-700"
                                    : "text-gray-400",
                              )}
                           >
                              {realLearningOutcomeScore !== null ? Math.round(realLearningOutcomeScore) : "—"}
                           </span>
                        </div>
                        <span className="text-[9px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                           Click to score
                        </span>
                     </button>
                  </div>

                  <div className="order-1 md:order-2 flex-1 min-w-0 max-w-md mx-auto w-full">
                     <div className="relative w-full bg-gray-50/80 rounded-2xl border border-gray-100 p-4 pb-5">
                        <div className="flex justify-between items-start mb-1 px-2 sm:px-4">
                           <div className="text-center">
                              <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">
                                 Design
                              </div>
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
                                       "text-[10px] h-5",
                                       scorePillClass(computedRingDesignScore),
                                       canOpenDriverScoring && "cursor-pointer hover:opacity-90",
                                    )}
                                 >
                                    {(computedRingDesignScore ?? "—")}/5
                                 </Badge>
                              </button>
                           </div>
                           <div className="text-center">
                              <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">
                                 Conditions
                              </div>
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
                                       "text-[10px] h-5",
                                       scorePillClass(computedRingConditionsScore),
                                       canOpenDriverScoring && "cursor-pointer hover:opacity-90",
                                    )}
                                 >
                                    {(computedRingConditionsScore ?? "—")}/5
                                 </Badge>
                              </button>
                           </div>
                        </div>

                        <div className="relative h-12 w-full flex justify-center items-center">
                           <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 48" preserveAspectRatio="none">
                              <path
                                 d="M 60 6 L 100 34"
                                 fill="none"
                                 stroke={flowConnectorStroke(computedRingDesignScore)}
                                 strokeWidth="4"
                                 strokeLinecap="round"
                                 opacity={0.9}
                              />
                              <path
                                 d="M 140 6 L 100 34"
                                 fill="none"
                                 stroke={flowConnectorStroke(computedRingConditionsScore)}
                                 strokeWidth="4"
                                 strokeLinecap="round"
                                 opacity={0.9}
                              />
                              <line
                                 x1="100"
                                 y1="34"
                                 x2="100"
                                 y2="46"
                                 stroke={flowConnectorStroke(computedRingImplementationScore)}
                                 strokeWidth="4"
                                 strokeLinecap="round"
                                 opacity={0.9}
                              />
                           </svg>
                        </div>

                        <div className="text-center -mt-1 relative z-10">
                           <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">
                              Implementation
                           </div>
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
                                    "text-[10px] h-5",
                                    scorePillClass(computedRingImplementationScore),
                                    canOpenDriverScoring && "cursor-pointer hover:opacity-90",
                                 )}
                              >
                                 {(computedRingImplementationScore ?? "—")}/5
                              </Badge>
                           </button>
                        </div>

                        <div className="flex flex-col items-center py-1">
                           <div
                              className="w-0.5 h-5 rounded-full shrink-0"
                              style={{ backgroundColor: flowConnectorStroke(computedRingImplementationScore) }}
                              aria-hidden
                           />
                           <svg
                              className="-mt-0.5"
                              width="12"
                              height="8"
                              viewBox="0 0 12 8"
                              fill="none"
                              aria-hidden
                           >
                              <path
                                 d="M1 1.5L6 6.5L11 1.5"
                                 stroke={flowConnectorStroke(computedRingImplementationScore)}
                                 strokeWidth="1.5"
                                 strokeLinecap="round"
                                 strokeLinejoin="round"
                              />
                           </svg>
                        </div>

                        <div className="text-center">
                           <div className="text-xs font-bold text-emerald-800 underline decoration-emerald-300 decoration-2 underline-offset-4 mb-1">
                              Experience
                           </div>
                           <button
                              type="button"
                              disabled={!canOpenDriverScoring}
                              onClick={() => setShowExperienceScore(true)}
                              className={cn(!canOpenDriverScoring && "cursor-default")}
                              data-testid="button-experience-score"
                           >
                              <Badge
                                 variant="outline"
                                 className={cn(
                                    "text-[10px] h-5",
                                    scorePillClass(realExperienceScore),
                                    canOpenDriverScoring && "cursor-pointer hover:opacity-90",
                                 )}
                              >
                                 {(realExperienceScore ?? "—")}/5
                              </Badge>
                           </button>
                        </div>
                     </div>
                     <span className="mt-3 block text-center text-[9px] text-gray-400 uppercase tracking-widest">
                        Performance drivers
                     </span>
                  </div>

                  <div className="flex justify-center md:w-36 lg:w-40 shrink-0 md:pt-10 order-3">
                     <button
                        type="button"
                        className="flex flex-col items-center justify-center space-y-2 cursor-pointer group rounded-xl p-3 border border-transparent hover:border-gray-200 hover:bg-slate-50/80 transition-all"
                        onClick={() => {
                          setWellbeingOutcomeScoreL1Id(null);
                          setShowWellbeingOutcomeScore(true);
                        }}
                        data-testid="button-wellbeing-outcome-score"
                     >
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1 text-center leading-tight">
                           Wellbeing &amp; conduct
                        </span>
                        <div
                           className={cn(
                              "relative flex items-center justify-center w-24 h-16 rounded-lg border shadow-sm group-hover:shadow-md transition-all",
                              realWellbeingOutcomeScore !== null
                                 ? realWellbeingOutcomeScore >= 4
                                    ? "bg-emerald-100 border-emerald-200 group-hover:border-emerald-300"
                                    : realWellbeingOutcomeScore >= 3
                                      ? "bg-yellow-100 border-yellow-200 group-hover:border-yellow-300"
                                      : "bg-red-100 border-red-200 group-hover:border-red-300"
                                 : "bg-gray-100 border-gray-200 group-hover:border-gray-300",
                           )}
                        >
                           <span
                              className={cn(
                                 "text-4xl font-bold",
                                 realWellbeingOutcomeScore !== null
                                    ? realWellbeingOutcomeScore >= 4
                                       ? "text-emerald-700"
                                       : realWellbeingOutcomeScore >= 3
                                         ? "text-yellow-700"
                                         : "text-red-700"
                                    : "text-gray-400",
                              )}
                           >
                              {realWellbeingOutcomeScore !== null ? Math.round(realWellbeingOutcomeScore) : "—"}
                           </span>
                        </div>
                        <span className="text-[9px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                           Click to score
                        </span>
                     </button>
                  </div>
               </div>
            </div>
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
                                 {healthSummaryView === "flags" ? (
                                   <ScoreFlags
                                     collapsible={false}
                                     overallScore={computedRingDesignScore}
                                     items={designSummaryRows.map((row) => ({
                                       key: row.id,
                                       label: row.label,
                                       score: row.score,
                                     }))}
                                     threshold={2}
                                     testId="health-design-flags"
                                   />
                                 ) : (
                                   <div className="space-y-1.5" data-testid="design-summary-rows">
                                     {designSummaryRows.map((row) => {
                                       const score = row.score;
                                       const scoreLabel = score !== null ? String(score) : "—";
                                       return (
                                         <div
                                           key={row.id}
                                           className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
                                           data-testid={`design-summary-row-${row.id}`}
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
                                             <span className="text-xs text-gray-700 truncate" title={row.label}>
                                               {row.label.length > 48 ? `${row.label.slice(0, 46)}…` : row.label}{" "}
                                               <span className="text-gray-400">(W: {row.weight})</span>
                                             </span>
                                           </div>
                                         </div>
                                       );
                                     })}
                                   </div>
                                 )}
                               </div>
                               {!designScoreData && (
                                 <p className="text-[10px] text-gray-400">
                                   No measures yet — use View &amp; edit to add scores and weights.
                                 </p>
                               )}
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
                                                 const groups = getConditionStakeholderGroups(c);
                                                 for (const g of groups) {
                                                   if (!g) continue;
                                                   add(String(g));
                                                 }
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
                                 {healthSummaryView === "flags" ? (
                                   <ScoreFlags
                                     collapsible={false}
                                     overallScore={computedRingImplementationScore}
                                     items={implementationSummaryRows.map((row) => ({
                                       key: row.id,
                                       label: row.label,
                                       score: row.score,
                                     }))}
                                     threshold={2}
                                     testId="health-implementation-flags"
                                   />
                                 ) : (
                                   <div className="space-y-1.5" data-testid="implementation-summary-rows">
                                     {implementationSummaryRows.map((row) => {
                                       const score = row.score;
                                       const scoreLabel = score !== null ? String(score) : "—";
                                       return (
                                         <div
                                           key={row.id}
                                           className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
                                           data-testid={`implementation-summary-row-${row.id}`}
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
                                             <span className="text-xs text-gray-700 truncate" title={row.label}>
                                               {row.label.length > 48 ? `${row.label.slice(0, 46)}…` : row.label}{" "}
                                               <span className="text-gray-400">(W: {row.weight})</span>
                                             </span>
                                           </div>
                                         </div>
                                       );
                                     })}
                                   </div>
                                 )}
                               </div>
                               {!implementationScoreData && (
                                 <p className="text-[10px] text-gray-400">
                                   No measures yet — use View &amp; edit to add scores and weights.
                                 </p>
                               )}
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

               {/* Experience — same drill-down as Performance outcomes; lives under Drivers */}
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
                              <p className="text-xs text-gray-500">
                                {experienceTopsHealth.length} experience areas (6 core leaps + school design principles)
                              </p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           <div className="space-y-1.5">
                              {(() => {
                                if (healthSummaryView === "flags") {
                                  const items = experienceSubdimensionRows.map((r) => ({
                                    key: r.key,
                                    label: r.label,
                                    score: r.score,
                                  }));
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

                                return experienceSubdimensionRows.map(({ key, label, weight, score }) => {
                                  const l2Ids = new Set([key]);
                                  const tagged = (migratedExperienceData.measures as any[]).filter(
                                    (m: any) =>
                                      Array.isArray(m?.subDimensionIds) &&
                                      m.subDimensionIds.some((id: string) => l2Ids.has(id)),
                                  );
                                  const ratedCount = (tagged as any[]).filter((m: any) => {
                                    const insts: ScoreInstance[] = Array.isArray(m?.instances)
                                      ? (m.instances as ScoreInstance[])
                                      : [];
                                    return insts.length > 0 && effectiveFromInstances(insts, globalFilter).score !== null;
                                  }).length;
                                  const scoreLabel = score !== null ? String(score) : "—";
                                  return (
                                    <div
                                      key={key}
                                      className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
                                      data-testid={`health-experience-dim-${key}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={cn(
                                            "w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center",
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
                                        <span className="text-xs text-gray-700">
                                          {label} ({weight}) · {ratedCount} rated
                                        </span>
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
               {/* Learning & advancement outcomes */}
               <Collapsible className="group" defaultOpen>
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                     <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex flex-col items-center justify-center w-8 h-8 rounded font-bold text-sm",
                              realLearningOutcomeScore !== null
                                ? realLearningOutcomeScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                  realLearningOutcomeScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-400"
                           )}>
                              {realLearningOutcomeScore !== null ? Math.round(realLearningOutcomeScore) : "—"}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Learning &amp; advancement</h4>
                              <p className="text-xs text-gray-500">{learningOutcomeDimensionRows.length} dimensions</p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           {healthSummaryView === "flags" ? (
                               <ScoreFlags
                                 collapsible={false}
                                 overallScore={realLearningOutcomeScore}
                                items={learningOutcomeDimensionRows.map((row) => ({
                                  key: row.key,
                                  label: row.label,
                                  score: row.score,
                                }))}
                                 threshold={2}
                                 testId="health-outcomes-learning-flags"
                               />
                             ) : (
                               <div className="space-y-1.5">
                                {learningOutcomeDimensionRows.map((o: any) => {
                                  const score = o.score ?? null;
                                  const name = `${o.label || "Dimension"} (${o.count ?? 0})`;
                                   const scoreLabel = score !== null ? String(Math.max(1, Math.min(5, Math.round(score)))) : "—";
                                   return (
                                    <div key={o.key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid={`health-outcome-learning-row-${o.key}`}>
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
                                        <span className="text-xs text-gray-700 truncate">{name}</span>
                                       </div>
                                       <div className="flex items-center gap-2 shrink-0" />
                                     </div>
                                   );
                                 })}
                               </div>
                             )}
                           {learningOutcomeDimensionRows.length > 0 &&
                             learningOutcomeDimensionRows.every((r) => r.score === null) && (
                               <p className="text-[10px] text-gray-400 pt-1">
                                 No scores for this period yet — open the editor to add measures.
                               </p>
                             )}
                           <button
                              onClick={() => {
                                setLearningOutcomeScoreL1Id(null);
                                setShowLearningOutcomeScore(true);
                              }}
                              className="w-full text-center text-[10px] text-blue-500 hover:text-blue-700 font-medium py-1 transition-colors"
                              data-testid="link-view-learning-outcome-details"
                           >
                              View &amp; edit learning outcomes
                           </button>
                        </div>
                     </CollapsibleContent>
                  </div>
               </Collapsible>

               {/* Wellbeing & conduct outcomes */}
               <Collapsible className="group" defaultOpen>
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                     <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                              "flex flex-col items-center justify-center w-8 h-8 rounded font-bold text-sm",
                              realWellbeingOutcomeScore !== null
                                ? realWellbeingOutcomeScore >= 4 ? "bg-emerald-100 text-emerald-700" :
                                  realWellbeingOutcomeScore >= 3 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-400"
                           )}>
                              {realWellbeingOutcomeScore !== null ? Math.round(realWellbeingOutcomeScore) : "—"}
                           </div>
                           <div>
                              <h4 className="font-semibold text-gray-900 text-sm">Wellbeing &amp; conduct</h4>
                              <p className="text-xs text-gray-500">{wellbeingOutcomeDimensionRows.length} dimensions</p>
                           </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 space-y-3">
                           <Separator />
                           {healthSummaryView === "flags" ? (
                               <ScoreFlags
                                 collapsible={false}
                                 overallScore={realWellbeingOutcomeScore}
                                items={wellbeingOutcomeDimensionRows.map((row) => ({
                                  key: row.key,
                                  label: row.label,
                                  score: row.score,
                                }))}
                                 threshold={2}
                                 testId="health-outcomes-wellbeing-flags"
                               />
                             ) : (
                               <div className="space-y-1.5">
                                {wellbeingOutcomeDimensionRows.map((o: any) => {
                                  const score = o.score ?? null;
                                  const name = `${o.label || "Dimension"} (${o.count ?? 0})`;
                                   const scoreLabel = score !== null ? String(Math.max(1, Math.min(5, Math.round(score)))) : "—";
                                   return (
                                    <div key={o.key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0" data-testid={`health-outcome-wellbeing-row-${o.key}`}>
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
                                        <span className="text-xs text-gray-700 truncate">{name}</span>
                                       </div>
                                       <div className="flex items-center gap-2 shrink-0" />
                                     </div>
                                   );
                                 })}
                               </div>
                             )}
                           {wellbeingOutcomeDimensionRows.length > 0 &&
                             wellbeingOutcomeDimensionRows.every((r) => r.score === null) && (
                               <p className="text-[10px] text-gray-400 pt-1">
                                 No scores for this period yet — open the editor to add measures.
                               </p>
                             )}
                           <button
                              onClick={() => {
                                setWellbeingOutcomeScoreL1Id(null);
                                setShowWellbeingOutcomeScore(true);
                              }}
                              className="w-full text-center text-[10px] text-blue-500 hover:text-blue-700 font-medium py-1 transition-colors"
                              data-testid="link-view-wellbeing-outcome-details"
                           >
                              View &amp; edit wellbeing &amp; conduct
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