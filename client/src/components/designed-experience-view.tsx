import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Target, 
  Sparkles, 
  RotateCw, 
  Wrench, 
  Paperclip, 
  ChevronDown, 
  ChevronRight,
  ChevronLeft,
  Plus,
  Library,
  X,
  Star,
  Trash2,
  Pencil,
  Check,
  Search,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { componentQueries, useCreateComponent, useDeleteComponent, useUpdateComponent } from "@/lib/api";
import { useMergedComponent } from "@/lib/useMergedComponent";
import OutcomeSummaryView from "./outcome-summary-view";
import LeapSummaryView from "./leap-summary-view";
import LearnersView from "./learners-view";
import AdultsView from "./adults-view";
import SchoolLearnerExperienceView from "./school-learner-experience-view";
import SchoolAdultExperienceView from "./school-adult-experience-view";
import ComponentLearnerExperienceView from "./component-learner-experience-view";
import ComponentAdultExperienceView from "./component-adult-experience-view";
import { useLearnerModuleLibraryOptional } from "@/contexts/learner-module-library-context";
import OutcomeDetailView from "./outcome-detail-view";
import LeapDetailView from "./leap-detail-view";
import CommunityEcosystemManageView from "./community-ecosystem/community-ecosystem-manage-view";
import CommunityEcosystemOutcomeDetailView from "./community-ecosystem/community-ecosystem-outcome-detail-view";
import {
  normalizeCommunityEcosystemOutcomes,
  type CommunityEcosystemOutcome,
} from "./community-ecosystem/community-ecosystem-types";
import OutcomeScoreView from "./outcome-score-view";
import { SchemaPickerSheet } from "./de-schema-picker-sheet";
import { ExpertViewShell } from "./expert-view/ExpertViewShell";
import type { ElementsExpertData } from "./expert-view/expert-view-types";
import { LEAP_SCHEMA, OUTCOME_SCHEMA, PRACTICE_SCHEMA, SUPPORT_SCHEMA } from "./designed-experience-schemas";
import { formatLearnerSelectionPreview, learnerSelectionIsKey } from "./learner-design-schema";
import { adultLeafChipsFromSelections } from "./adult-design-schema";
import SupportGroupsHubView from "./support-groups-hub-view";
import SupportGroupDetailView from "./support-group-detail-view";
import SupportDetailView from "./support-detail-view";
import type { SupportGroupKey } from "./support-groups-config";
import PogHubView from "./pog/pog-hub-view";
import PogAttributeDetailView from "./pog/pog-attribute-detail-view";
import PogOutcomesFirstView from "./pog/pog-outcomes-first-view";
import PogLearnMoreView from "./pog/pog-learn-more-view";
import type { PortraitOfGraduate } from "./pog/pog-types";
import { POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI } from "./pog/pog-feature-flags";
import {
  normalizePortrait,
  stripPogSourcedOutcomesFromKeyDesignElements,
  stripPortraitOutcomeLinks,
  syncKeyAimsOutcomesFromPortrait,
  normKey as normPogKey,
} from "./pog/pog-utils";
import {
  applyScenarioLevelsToAims,
  buildCenterScenarios,
  buildRingScenarios,
  priorityToLevel as rollupPriorityToLevel,
  type TargetingScenario,
} from "./targeting-rollup-utils";
import { isAdultRingComponent, isLearnerRingComponent } from "@/lib/ring-experience-audience";
import { scheduleMigrateLegacyOverallAdultSubcomponents } from "@/lib/legacy-overall-adult-subs-migration";
import { isLeapAimActive, isTargetingAimActive, leapAimUsesSoftDeselect } from "@shared/aim-selection";

import artifactDoc from "@/assets/images/artifact-doc.png";
import artifactSlide from "@/assets/images/artifact-slide.png";
import artifactRubric from "@/assets/images/artifact-rubric.png";

export type TagType = "outcome" | "leap" | "practice" | "support" | "artifact";

export type TagLevel = "High" | "Medium" | "Low" | "Absent";

export interface Tag {
  id: string;
  type: TagType;
  label: string;
  isPrimary?: boolean;
  isKey?: boolean;
  level?: TagLevel;
  source?: string;
}

export interface KeyDesignElements {
  aims: Tag[];
  practices: Tag[];
  supports: Tag[];
}

export interface DESubcomponent {
  id: string;
  name: string;
  description: string;
  aims: Tag[];
  practices: Tag[];
  supports: Tag[];
  keyDesignElements?: KeyDesignElements;
  elementsExpertData?: ElementsExpertData;
  learnersProfile?: any;
  adultsProfile?: any;
}

export interface DesignedExperienceData {
  description?: string;
  keyDesignElements?: KeyDesignElements;
  subcomponents?: DESubcomponent[];
  /** Same shape as subcomponents; modules dragged from the adult catalog land here. */
  adultSubcomponents?: DESubcomponent[];
  /** Center (overall) only — community & ecosystem outcomes. */
  communityEcosystemOutcomes?: CommunityEcosystemOutcome[];
  /** Center (overall) only — plain-language description for community/ecosystem outcomes (future AI assist). */
  communityEcosystemPlainText?: string;
  /** Center (overall) only — plain-language for Portrait of a Graduate (future AI / upload assist). */
  portraitOfGraduatePlainText?: string;
  // Additional nested pages may store extra fields here (e.g. support group workflow).
  // This view must preserve unknown fields when saving.
  [key: string]: any;
}


interface Artifact {
  id: string;
  title: string;
  type: "doc" | "video" | "link";
  thumbnail: string;
  tags?: Tag[];
}

const FEATURED_ARTIFACTS: Artifact[] = [
  { id: "1", title: "Curriculum Overview", type: "doc", thumbnail: artifactDoc, tags: [{ id: "t1", type: "outcome", label: "Algebra" }] },
  { id: "2", title: "Cooperative Groups", type: "doc", thumbnail: artifactSlide, tags: [{ id: "t2", type: "practice", label: "Pedagogy" }] },
  { id: "3", title: "Grade 7 Reasoning Task", type: "doc", thumbnail: artifactDoc, tags: [{ id: "t3", type: "outcome", label: "Geometry" }] },
  { id: "4", title: "Student Self-Assessment", type: "doc", thumbnail: artifactRubric, tags: [{ id: "t4", type: "support", label: "Rubric" }] },
];

let deIdCounter = 0;
const generateId = () => `de_${Date.now()}_${++deIdCounter}`;

/** Priority (H/M/L) for DE chips — aligned with Manage views: overrideLevel / computedLevel, then level text. */
function aimPriorityAbbrev(aim: any): "H" | "M" | "L" | null {
  const ov = aim?.overrideLevel ?? aim?.computedLevel;
  if (ov === "H" || ov === "M" || ov === "L") return ov;
  const lv = aim?.level;
  if (lv === "High") return "H";
  if (lv === "Low") return "L";
  if (lv === "Medium") return "M";
  return null;
}

/** One DE chip per L3 when narrowed; one chip for L2-whole (`subSelections` empty). */
function deExpandedOutcomeChips(aims: Tag[]): { aim: Tag; l3?: string; chipLabel: string; reactKey: string }[] {
  const rows: { aim: Tag; l3?: string; chipLabel: string; reactKey: string }[] = [];
  for (const a of aims) {
    if (a.type !== "outcome" || !isTargetingAimActive(a as any)) continue;
    const subs = Array.isArray((a as any).subSelections) ? (a as any).subSelections.filter(Boolean) : [];
    if (subs.length === 0) {
      rows.push({ aim: a, chipLabel: a.label, reactKey: `${a.id}:l2` });
    } else {
      for (const l3 of subs) {
        const k = (l3 || "").trim().toLowerCase();
        rows.push({ aim: a, l3, chipLabel: l3, reactKey: `${a.id}:${k}` });
      }
    }
  }
  return rows;
}

function deOutcomeChipPriorityLetter(aim: any, l3?: string): "H" | "M" | "L" | null {
  if (!l3) return aimPriorityAbbrev(aim);
  const sp = aim?.subPriorities ?? {};
  const v = sp[l3];
  if (v === "H" || v === "M" || v === "L") return v;
  return "M";
}

const DE_CHIP_PRIORITY_STYLES: Record<string, string> = {
  H: "bg-red-50 border-red-200 text-red-700",
  M: "bg-amber-50 border-amber-200 text-amber-700",
  L: "bg-green-50 border-green-200 text-green-700",
};

const Chip = ({ 
  type, 
  label, 
  className, 
  onClick,
  meta,
  isPrimary,
  onRemove,
}: { 
  type: TagType; 
  label: string; 
  className?: string;
  onClick?: () => void;
  meta?: string;
  isPrimary?: boolean;
  onRemove?: () => void;
}) => {
  const styles = {
    outcome: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    leap: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    practice: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    support: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100",
    artifact: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100",
  };

  const icons = {
    outcome: Target,
    leap: Sparkles,
    practice: RotateCw,
    support: Wrench,
    artifact: Paperclip,
  };

  const Icon = icons[type];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium gap-1 px-2 py-0.5 transition-all cursor-default text-[11px] max-w-full min-w-0 overflow-hidden", 
        styles[type], 
        onClick && "cursor-pointer",
        isPrimary && "font-bold border-2",
        className
      )}
      onClick={onClick}
      title={label}
    >
      {isPrimary && <Star className="w-2.5 h-2.5 fill-current text-current opacity-100" />}
      {!isPrimary && <Icon className="w-2.5 h-2.5 opacity-70" />}
      <span className="truncate min-w-0">{label}</span>
      {meta && <span className="text-[10px] font-bold opacity-70 shrink-0">({meta})</span>}
      {onRemove && (
        <button 
          className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </Badge>
  );
};

const SectionHeader = ({ title, count, onAdd, children }: { title: string; count?: number; onAdd?: () => void; children?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-3 mt-6">
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold tracking-tight text-gray-900 uppercase">{title}</h3>
      {count !== undefined && <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>}
    </div>
    <div className="flex items-center gap-2">
      {children}
      {onAdd && (
        <Button size="sm" variant="outline" onClick={onAdd} className="h-7 text-xs gap-1 border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 bg-transparent" data-testid="button-add-subcomponent">
          <Plus className="w-3 h-3" /> Add
        </Button>
      )}
    </div>
  </div>
);

const ArtifactCard = ({ artifact }: { artifact: Artifact }) => (
  <div className="flex flex-col w-[160px] group cursor-pointer">
    <div className="relative aspect-[4/3] bg-gray-100 rounded-md border border-gray-200 overflow-hidden transition-all group-hover:shadow-md group-hover:border-gray-300">
      <img src={artifact.thumbnail} alt={artifact.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
    </div>
    <div className="mt-2 space-y-1">
      <h4 className="text-xs font-medium text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
        {artifact.title}
      </h4>
      <div className="flex flex-wrap gap-1">
        {artifact.tags?.map(tag => (
          <span key={tag.id} className="text-[10px] text-gray-500 bg-gray-50 px-1 py-0.5 rounded border border-gray-100">
            {tag.label}
          </span>
        ))}
      </div>
    </div>
  </div>
);

function SubcomponentCard({
  sub,
  onUpdate,
  onDelete,
  onOpen,
}: {
  sub: DESubcomponent;
  onUpdate: (updated: DESubcomponent) => void;
  onDelete: () => void;
  /** Omit to hide “Open” (e.g. adult modules v1 — name/remove only). */
  onOpen?: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(sub.name);

  useEffect(() => {
    setNameVal(sub.name);
  }, [sub.name]);

  const saveName = () => {
    if (nameVal.trim()) onUpdate({ ...sub, name: nameVal.trim() });
    setEditingName(false);
  };

  return (
    <div
      className="border rounded-lg bg-white border-gray-200 px-4 py-3 flex items-center justify-between gap-3"
      data-testid={`card-subcomponent-${sub.id}`}
    >
      <div className="flex-1 min-w-0">
        {editingName ? (
          <div className="flex items-center gap-1.5 flex-1">
            <Input
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setNameVal(sub.name);
                  setEditingName(false);
                }
              }}
              className="h-7 text-sm font-semibold max-w-md"
              autoFocus
              data-testid={`input-subcomponent-name-${sub.id}`}
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={saveName}>
              Save
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group/name">
            <h4 className="font-semibold text-sm text-gray-900" data-testid={`text-subcomponent-name-${sub.id}`}>
              {sub.name}
            </h4>
            <button
              type="button"
              className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5"
              onClick={() => setEditingName(true)}
              data-testid={`button-edit-name-${sub.id}`}
            >
              <Pencil className="w-3 h-3 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onOpen ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
            onClick={() => onOpen()}
            data-testid={`button-open-subcomponent-${sub.id}`}
          >
            Open
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 px-2"
          onClick={onDelete}
          data-testid={`button-delete-subcomponent-${sub.id}`}
        >
          <Trash2 className="w-3 h-3" /> Remove
        </Button>
      </div>
    </div>
  );
}

function KeyDesignElementsSummary({
  nodeId,
  isOverall,
  allComponents,
  subcomponents,
  elements,
  onChange,
  onViewOutcomes,
  onOpenOutcome,
  onViewSupports,
}: {
  nodeId?: string;
  isOverall: boolean;
  allComponents?: any[];
  subcomponents: DESubcomponent[];
  elements: KeyDesignElements;
  onChange: (updated: KeyDesignElements) => void;
  onViewOutcomes?: () => void;
  onOpenOutcome?: (label: string) => void;
  onViewSupports?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const aims = elements?.aims || [];
  const practices = elements?.practices || [];
  const supports = elements?.supports || [];
  const outcomes = aims.filter(a => a.type === "outcome");
  const leaps = aims.filter(a => a.type === "leap");
  const keyPractices = practices.filter(p => !!p.isKey);
  const keySupports = supports.filter(s => !!s.isKey);

  const aimLabels = aims.filter((a) => isTargetingAimActive(a as any)).map((a) => a.label);
  const practiceLabels = practices.map(p => p.label);
  const supportLabels = supports.map(s => s.label);

  const current = { aims, practices, supports };

  const toggleAim = (label: string, type: TagType) => {
    const aim = aims.find(
      (a) => String(a.label || "").trim().toLowerCase() === String(label || "").trim().toLowerCase() && a.type === type,
    );
    if (aim) {
      if (type === "leap" && leapAimUsesSoftDeselect(aim as any)) {
        if ((aim as any).selected === false) {
          onChange({
            ...current,
            aims: aims.map((a) =>
              String(a.label || "").trim().toLowerCase() === String(label || "").trim().toLowerCase() && a.type === "leap"
                ? ({
                    ...a,
                    selected: true,
                    overrideLevel: (a as any).overrideLevel || "M",
                    level: (a as any).level || "Medium",
                    levelMode: "override",
                  } as any)
                : a,
            ),
          });
        } else {
          onChange({
            ...current,
            aims: aims.map((a) =>
              String(a.label || "").trim().toLowerCase() === String(label || "").trim().toLowerCase() && a.type === "leap"
                ? ({ ...a, selected: false } as any)
                : a,
            ),
          });
        }
      } else {
        onChange({
          ...current,
          aims: aims.filter(
            (a) =>
              !(String(a.label || "").trim().toLowerCase() === String(label || "").trim().toLowerCase() && a.type === type),
          ),
        });
      }
    } else {
      const isNewUserLeap = type === "leap" && leapAimUsesSoftDeselect({ type: "leap", label } as any);
      onChange({
        ...current,
        aims: [
          ...aims,
          {
            id: generateId(),
            type,
            label,
            level: "Medium",
            levelMode: "override",
            overrideLevel: "M",
            ...(isNewUserLeap ? { isCustom: true } : {}),
          } as any,
        ],
      });
    }
  };

  const removeAim = (label: string) => {
    const aim = aims.find((a) => String(a.label || "").trim().toLowerCase() === String(label || "").trim().toLowerCase());
    if (aim?.type === "leap" && leapAimUsesSoftDeselect(aim as any)) {
      onChange({
        ...current,
        aims: aims.map((a) =>
          String(a.label || "").trim().toLowerCase() === String(label || "").trim().toLowerCase() && a.type === "leap"
            ? ({ ...a, selected: false } as any)
            : a,
        ),
      });
    } else {
      onChange({
        ...current,
        aims: aims.filter((a) => String(a.label || "").trim().toLowerCase() !== String(label || "").trim().toLowerCase()),
      });
    }
  };

  const togglePractice = (label: string) => {
    const exists = practices.some(p => p.label === label);
    if (exists) {
      onChange({ ...current, practices: practices.filter(p => p.label !== label) });
    } else {
      onChange({ ...current, practices: [...practices, { id: generateId(), type: "practice" as TagType, label }] });
    }
  };

  const removePractice = (label: string) => {
    onChange({ ...current, practices: practices.filter(p => p.label !== label) });
  };

  const toggleSupport = (label: string) => {
    const exists = supports.some(s => s.label === label);
    if (exists) {
      onChange({ ...current, supports: supports.filter(s => s.label !== label) });
    } else {
      onChange({ ...current, supports: [...supports, { id: generateId(), type: "support" as TagType, label }] });
    }
  };

  const removeSupport = (label: string) => {
    onChange({ ...current, supports: supports.filter(s => s.label !== label) });
  };

  const getIsKeyPractice = (label: string) => {
    return practices.find(p => p.label === label)?.isKey ?? false;
  };

  const setIsKeyPractice = (label: string, isKey: boolean) => {
    onChange({
      ...current,
      practices: practices.map(p => (p.label === label ? { ...p, isKey } : p)),
    });
  };

  const getIsKeySupport = (label: string) => {
    return supports.find(s => s.label === label)?.isKey ?? false;
  };

  const setIsKeySupport = (label: string, isKey: boolean) => {
    onChange({
      ...current,
      supports: supports.map(s => (s.label === label ? { ...s, isKey } : s)),
    });
  };

  const ringComponents = useMemo(
    () => (Array.isArray(allComponents) ? allComponents.filter((c: any) => String(c?.nodeId || c?.node_id || "") !== "overall") : []),
    [allComponents],
  );

  const outcomeScenarios = useMemo<TargetingScenario[]>(() => {
    if (isOverall) {
      return buildCenterScenarios({
        centerTopAims: aims,
        ringComponents,
        type: "outcome",
      });
    }
    return buildRingScenarios({
      topAims: aims,
      subcomponents,
      type: "outcome",
    });
  }, [aims, isOverall, ringComponents, subcomponents]);

  const leapScenarios = useMemo<TargetingScenario[]>(() => {
    if (isOverall) {
      return buildCenterScenarios({
        centerTopAims: aims,
        ringComponents,
        type: "leap",
      });
    }
    return buildRingScenarios({
      topAims: aims,
      subcomponents,
      type: "leap",
    });
  }, [aims, isOverall, ringComponents, subcomponents]);

  const intendedOutcomeScenarios = useMemo(() => outcomeScenarios.filter((s) => s.intended), [outcomeScenarios]);
  const realizedOnlyOutcomeScenarios = useMemo(() => outcomeScenarios.filter((s) => !s.intended && s.realized), [outcomeScenarios]);
  const intendedLeapScenarios = useMemo(() => leapScenarios.filter((s) => s.intended), [leapScenarios]);
  const realizedOnlyLeapScenarios = useMemo(() => leapScenarios.filter((s) => !s.intended && s.realized), [leapScenarios]);

  const upgradeRealizedToIntended = (scenario: TargetingScenario) => {
    const exists = aims.some((a) => a.type === scenario.type && String(a.label || "").trim().toLowerCase() === scenario.label.toLowerCase());
    if (exists) return;
    onChange({
      ...current,
      aims: [
        ...aims,
        {
          id: generateId(),
          type: scenario.type,
          label: scenario.label,
          level: rollupPriorityToLevel(scenario.resolvedLevel || scenario.computedLevel || "M"),
          computedLevel: scenario.computedLevel,
          levelMode: "override",
          overrideLevel: scenario.resolvedLevel || scenario.computedLevel || "M",
        } as any,
      ],
    });
  };

  const scenarioByKey = useMemo(() => {
    const m = new Map<string, TargetingScenario>();
    for (const s of [...outcomeScenarios, ...leapScenarios]) m.set(s.key, s);
    return m;
  }, [leapScenarios, outcomeScenarios]);

  const getScenarioMeta = (type: "outcome" | "leap", label: string): string | undefined => {
    const s = scenarioByKey.get(`${type}:${String(label || "").trim().toLowerCase()}`);
    if (!s?.resolvedLevel) return undefined;
    return s.resolvedLevel;
  };

  return (
    <section className="space-y-4" data-testid="section-key-design-elements">
      <div className="flex items-center justify-between">
        <SectionHeader title="Key Design Elements" />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-gray-500 hover:text-gray-900"
          data-testid="button-toggle-key-elements"
        >
          {isOpen ? (
            <>
              <ChevronDown className="w-3 h-3 mr-1" /> Collapse
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3 mr-1" /> Expand
            </>
          )}
        </Button>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-xl bg-gray-50/50 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                  <Target className="w-3.5 h-3.5 text-emerald-600" /> Aims
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1.5">{aims.length}</span>
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 rounded-full border border-emerald-100"
                  onClick={onViewOutcomes}
                  disabled={!onViewOutcomes}
                >
                  View more detail
                </Button>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Outcomes</span>
                    <div className="flex flex-wrap gap-1">
                      <TooltipProvider delayDuration={150}>
                        {intendedOutcomeScenarios.map((s) => {
                          const lowImplementation = isOverall && !s.realized;
                          const chip = (
                            <Chip
                              key={`outcome:${s.label}`}
                              type="outcome"
                              label={s.label}
                              meta={s.resolvedLevel || undefined}
                              className={lowImplementation ? "border-red-300 ring-1 ring-red-200" : undefined}
                              isPrimary={outcomes.find((o) => String(o.label || "").trim().toLowerCase() === s.label.toLowerCase())?.isPrimary}
                              onClick={onOpenOutcome ? () => onOpenOutcome(s.label) : undefined}
                              onRemove={() => removeAim(s.label)}
                            />
                          );
                          if (!lowImplementation) return chip;
                          return (
                            <Tooltip key={`tooltip:outcome:${s.label}`}>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">{chip}</span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-white text-gray-900 border border-gray-200 shadow-sm">
                                Little to no implementation across school design.
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                    <div className="pt-1">
                      <SchemaPickerSheet
                        title="Select Outcomes"
                        description="Add or remove outcome aims for this component."
                        schema={OUTCOME_SCHEMA}
                        selectedLabels={aimLabels}
                        onToggle={(label) => toggleAim(label, "outcome")}
                        getLevel={undefined}
                        onSetLevel={undefined}
                        type="outcome"
                        triggerLabel="Outcomes"
                        triggerIcon={Target}
                      />
                    </div>
                  </div>
                  {intendedLeapScenarios.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Leaps</span>
                      <div className="flex flex-wrap gap-1">
                        {intendedLeapScenarios.map((s) => (
                          <Chip key={`leap:${s.label}`} type="leap" label={s.label} meta={s.resolvedLevel || undefined} onRemove={() => removeAim(s.label)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {intendedOutcomeScenarios.length === 0 && intendedLeapScenarios.length === 0 && (!isOverall || (realizedOnlyOutcomeScenarios.length === 0 && realizedOnlyLeapScenarios.length === 0)) && (
                    <p className="text-xs text-gray-400 italic">No aims defined yet</p>
                  )}
                </div>
              </ScrollArea>
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                <SchemaPickerSheet
                  title="Select Leaps"
                  description="Add or remove leap aims for this component."
                  schema={LEAP_SCHEMA}
                  selectedLabels={aimLabels}
                  onToggle={(label) => toggleAim(label, "leap")}
                  getLevel={undefined}
                  onSetLevel={undefined}
                  type="leap"
                  triggerLabel="Leaps"
                  triggerIcon={Sparkles}
                />
              </div>
            </div>

            <div className="border rounded-xl bg-gray-50/50 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                  <RotateCw className="w-3.5 h-3.5 text-orange-600" /> Practices
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1.5">
                    {keyPractices.length}{keyPractices.length !== practices.length ? `/${practices.length}` : ""}
                  </span>
                </h3>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 rounded-full border border-orange-100">
                  View All Selected
                </Button>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="flex flex-wrap gap-1">
                  {keyPractices.map(p => (
                    <Chip key={p.id} type="practice" label={p.label} onRemove={() => removePractice(p.label)} />
                  ))}
                  {keyPractices.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No key practices yet</p>
                  )}
                </div>
              </ScrollArea>
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                <SchemaPickerSheet
                  title="Select Practices"
                  description="Add or remove practices for this component."
                  schema={PRACTICE_SCHEMA}
                  selectedLabels={practiceLabels}
                  onToggle={togglePractice}
                  getIsKey={getIsKeyPractice}
                  onSetIsKey={setIsKeyPractice}
                  type="practice"
                  triggerLabel="Practices"
                  triggerIcon={RotateCw}
                />
              </div>
            </div>

            <div className="border rounded-xl bg-gray-50/50 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                  <Wrench className="w-3.5 h-3.5 text-sky-600" /> Supports
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1.5">
                    {keySupports.length}{keySupports.length !== supports.length ? `/${supports.length}` : ""}
                  </span>
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2 rounded-full border border-sky-100"
                  onClick={onViewSupports}
                  disabled={!onViewSupports}
                  data-testid="button-view-all-selected-supports"
                >
                  View All Selected
                </Button>
              </div>
              <ScrollArea className="max-h-[280px]">
                <div className="flex flex-wrap gap-1">
                  {keySupports.map(s => (
                    <Chip key={s.id} type="support" label={s.label} onRemove={() => removeSupport(s.label)} />
                  ))}
                  {keySupports.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No key supports yet</p>
                  )}
                </div>
              </ScrollArea>
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                <SchemaPickerSheet
                  title="Select Supports"
                  description="Add or remove supports for this component."
                  schema={SUPPORT_SCHEMA}
                  selectedLabels={supportLabels}
                  onToggle={toggleSupport}
                  getIsKey={getIsKeySupport}
                  onSetIsKey={setIsKeySupport}
                  type="support"
                  triggerLabel="Supports"
                  triggerIcon={Wrench}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

export default function DesignedExperienceView({ nodeId, title, initialSubId, onSubIdConsumed, openSubId, onOpenSubIdChange, onRequestOpenComponent }: { nodeId?: string, title?: string, initialSubId?: string | null, onSubIdConsumed?: () => void, openSubId?: string | null, onOpenSubIdChange?: (id: string | null) => void, onRequestOpenComponent?: (nodeId: string) => void }) {
  const [description, setDescription] = useState("");
  const [keyDesignElements, setKeyDesignElements] = useState<KeyDesignElements>({ aims: [], practices: [], supports: [] });
  const [subcomponents, setSubcomponents] = useState<DESubcomponent[]>([]);
  const [adultSubcomponents, setAdultSubcomponents] = useState<DESubcomponent[]>([]);
  const [portraitOfGraduate, setPortraitOfGraduate] = useState<PortraitOfGraduate>({ attributes: [], linksByAttributeId: {} });
  const [portraitOfGraduatePlainText, setPortraitOfGraduatePlainText] = useState("");
  const [pogNav, setPogNav] = useState<
    { mode: "hub" } | { mode: "detail"; attributeId: string } | { mode: "outcomesFirst" }
  >({ mode: "hub" });
  const [pogReturnToDetailAttrId, setPogReturnToDetailAttrId] = useState<string | null>(null);
  const [pogOutcomesFirstDraft, setPogOutcomesFirstDraft] = useState<{ selectedKeys: string[]; step: 1 | 2 }>({ selectedKeys: [], step: 1 });
  const [loadedNodeId, setLoadedNodeId] = useState<string | null>(null);
  const [localOpenSubId, setLocalOpenSubId] = useState<string | null>(null);
  const [addingSubcomponent, setAddingSubcomponent] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [addingAdultSubcomponent, setAddingAdultSubcomponent] = useState(false);
  const [newAdultSubName, setNewAdultSubName] = useState("");
  const [showOutcomeSummary, setShowOutcomeSummary] = useState(false);
  const [showLeapSummary, setShowLeapSummary] = useState(false);
  const [showLearnersView, setShowLearnersView] = useState(false);
  const [showAdultsView, setShowAdultsView] = useState(false);
  /** When opening Adults from a role chip, land on that slice's detail page. */
  const [adultsInitialSliceKey, setAdultsInitialSliceKey] = useState<string | null>(null);
  const [showSchoolLearnerExperienceView, setShowSchoolLearnerExperienceView] = useState(false);
  const [showSchoolAdultExperienceView, setShowSchoolAdultExperienceView] = useState(false);
  const [showComponentLearnerManage, setShowComponentLearnerManage] = useState(false);
  const [showComponentAdultManage, setShowComponentAdultManage] = useState(false);
  /** When opening ring adult Manage from a pill, scroll to this module on the manage page. */
  const [componentAdultFocusSubId, setComponentAdultFocusSubId] = useState<string | null>(null);
  const [showPortraitOfGraduateManage, setShowPortraitOfGraduateManage] = useState(false);
  const [showPogManageLearnMore, setShowPogManageLearnMore] = useState(false);
  const [communityEcosystemOutcomes, setCommunityEcosystemOutcomes] = useState<CommunityEcosystemOutcome[]>([]);
  const [communityEcosystemPlainText, setCommunityEcosystemPlainText] = useState("");
  const [showCommunityEcosystemManage, setShowCommunityEcosystemManage] = useState(false);
  const [communityEcosystemDetailId, setCommunityEcosystemDetailId] = useState<string | null>(null);
  const [leapSummaryFocusLabel, setLeapSummaryFocusLabel] = useState<string | null>(null);
  const learnerModuleLibrary = useLearnerModuleLibraryOptional();
  const openLearnerLibrary = useCallback(() => {
    learnerModuleLibrary?.setModuleLibraryAudience("learner");
    learnerModuleLibrary?.toggleLibrary();
  }, [learnerModuleLibrary]);
  const openAdultLibrary = useCallback(() => {
    learnerModuleLibrary?.setModuleLibraryAudience("adult");
    learnerModuleLibrary?.toggleLibrary();
  }, [learnerModuleLibrary]);
  const [showOutcomeScore, setShowOutcomeScore] = useState(false);
  const [selectedOutcomeNav, setSelectedOutcomeNav] = useState<{ l2: string; l3?: string | null } | null>(null);
  const [selectedLeapLabel, setSelectedLeapLabel] = useState<string | null>(null);
  const [supportNav, setSupportNav] = useState<
    | { mode: "none" }
    | { mode: "hub" }
    | { mode: "group"; groupKey: SupportGroupKey }
    | { mode: "detail"; groupKey: SupportGroupKey; label: string; backTo: "hub" | "group" }
  >({ mode: "none" });
  const [elementsExpertData, setElementsExpertData] = useState<ElementsExpertData>({});
  const [expertViewOpen, setExpertViewOpen] = useState(false);
  const [expertViewInitialElement, setExpertViewInitialElement] = useState<string>("schedule");
  const [expertViewNonce, setExpertViewNonce] = useState(0);

  function openExpertView(elementId: string) {
    setExpertViewInitialElement(elementId);
    setExpertViewNonce((n) => n + 1);
    setExpertViewOpen(true);
  }

  const activeSubId = openSubId !== undefined ? openSubId : localOpenSubId;
  const setActiveSubId = (id: string | null) => {
    if (onOpenSubIdChange) onOpenSubIdChange(id);
    else setLocalOpenSubId(id);
  };

  const componentData = useMergedComponent(nodeId);
  const { data: allComponents } = useQuery(componentQueries.all);
  const updateMutation = useUpdateComponent();
  const createRingMutation = useCreateComponent();
  const deleteRingMutation = useDeleteComponent();

  const blueprintRingComponents = useMemo(
    () => (allComponents as any[] | undefined)?.filter((c) => String(c?.nodeId || "") !== "overall") ?? [],
    [allComponents],
  );
  const learnerBlueprintRings = useMemo(
    () => blueprintRingComponents.filter((c) => isLearnerRingComponent(c)),
    [blueprintRingComponents],
  );
  const adultBlueprintRings = useMemo(
    () => blueprintRingComponents.filter((c) => isAdultRingComponent(c)),
    [blueprintRingComponents],
  );
  const deRef = useRef<DesignedExperienceData>({});
  const descRef = useRef(description);
  const kdeRef = useRef(keyDesignElements);
  const elementsExpertRef = useRef(elementsExpertData);
  const subEditStashRef = useRef<{
    parentDescription: string;
    parentKeyDesignElements: KeyDesignElements;
    parentElementsExpertData: ElementsExpertData;
  } | null>(null);
  const prevActiveSubIdRef = useRef<string | null>(null);
  /** Last aims blob synced from server — refetches after detail saves must refresh local chips. */
  const aimsServerSyncSigRef = useRef<string>("");
  descRef.current = description;
  kdeRef.current = keyDesignElements;
  elementsExpertRef.current = elementsExpertData;
  const isOverall = String(nodeId || "") === "overall" || String((componentData as any)?.nodeId || "") === "overall";

  useEffect(() => {
    if (!isOverall || !componentData) return;
    const de = (componentData as any)?.designedExperienceData;
    scheduleMigrateLegacyOverallAdultSubcomponents({
      overallDesignedExperience: de,
      allRings: blueprintRingComponents,
      createMutateAsync: (body) => createRingMutation.mutateAsync(body),
      updateMutateAsync: (args) => updateMutation.mutateAsync(args),
    });
  }, [isOverall, componentData, blueprintRingComponents, createRingMutation, updateMutation]);

  const schoolWideElementsExpertData = useMemo(() => {
    const list = (allComponents as any[]) || [];
    const overall = list.find((c: any) => String(c?.nodeId || c?.node_id || "") === "overall");
    return ((overall?.designedExperienceData as DesignedExperienceData)?.elementsExpertData ??
      {}) as ElementsExpertData;
  }, [allComponents]);

  useEffect(() => {
    deRef.current = (componentData as any)?.designedExperienceData || {};
  }, [componentData]);

  useEffect(() => {
    if (!nodeId || !componentData) return;
    // Only hydrate local state once per nodeId; otherwise refetches from our own PATCHes
    // will overwrite local state and can cause save/refetch loops.
    if (loadedNodeId === nodeId) return;
    prevActiveSubIdRef.current = null;
    subEditStashRef.current = null;
    const de: DesignedExperienceData = (componentData as any).designedExperienceData || {};
    setDescription(de.description || "");
    const baseKdeInit = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    let portraitHydrated = normalizePortrait((de as any)?.portraitOfGraduate);
    if (!POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI) {
      portraitHydrated = stripPortraitOutcomeLinks(portraitHydrated);
      setKeyDesignElements(stripPogSourcedOutcomesFromKeyDesignElements(baseKdeInit));
    } else {
      setKeyDesignElements(baseKdeInit);
    }
    setSubcomponents((de.subcomponents || []).map((s: any) => ({
      ...s,
      id: s.id || generateId(),
      aims: s.aims || [],
      practices: s.practices || [],
      supports: s.supports || [],
    })));
    setAdultSubcomponents((de.adultSubcomponents || []).map((s: any) => ({
      ...s,
      id: s.id || generateId(),
      aims: s.aims || [],
      practices: s.practices || [],
      supports: s.supports || [],
    })));
    setPortraitOfGraduate(portraitHydrated);
    setCommunityEcosystemOutcomes(normalizeCommunityEcosystemOutcomes((de as any)?.communityEcosystemOutcomes));
    setCommunityEcosystemPlainText(
      typeof (de as any).communityEcosystemPlainText === "string" ? (de as any).communityEcosystemPlainText : "",
    );
    setPortraitOfGraduatePlainText(
      typeof (de as any).portraitOfGraduatePlainText === "string" ? (de as any).portraitOfGraduatePlainText : "",
    );
    setElementsExpertData((de as any)?.elementsExpertData ?? {});
    setPogReturnToDetailAttrId(null);
    setPogOutcomesFirstDraft({ selectedKeys: [], step: 1 });
    setPogNav({ mode: "hub" });
    setLoadedNodeId(nodeId);
  }, [componentData, loadedNodeId, nodeId]);

  useEffect(() => {
    aimsServerSyncSigRef.current = "";
  }, [nodeId, activeSubId]);

  useEffect(() => {
    if (!nodeId || !componentData || loadedNodeId !== nodeId) return;

    const de: any = (componentData as any)?.designedExperienceData || {};
    let stripBaseKde: any;
    let rawAims: any[] | undefined;

    if (!isOverall && activeSubId) {
      const serverSub = Array.isArray(de.subcomponents)
        ? de.subcomponents.find((s: any) => s.id === activeSubId)
        : undefined;
      if (!serverSub) return;
      stripBaseKde =
        serverSub.keyDesignElements ||
        ({
          aims: serverSub.aims || [],
          practices: serverSub.practices || [],
          supports: serverSub.supports || [],
        } as any);
      rawAims = stripBaseKde.aims;
    } else {
      stripBaseKde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
      rawAims = stripBaseKde.aims;
    }

    if (!Array.isArray(rawAims)) return;

    let nextAims = rawAims;
    if (!POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI) {
      nextAims = stripPogSourcedOutcomesFromKeyDesignElements(stripBaseKde).aims;
    }

    const sig = `${activeSubId ?? "parent"}:${JSON.stringify(
      nextAims.map((a: any) => [
        a?.id,
        a?.type,
        a?.label,
        a?.overrideLevel,
        a?.computedLevel,
        a?.level,
        a?.levelMode,
        a?.selected,
        a?.subSelections,
        a?.subPriorities,
        a?.notes,
      ]),
    )}`;

    if (aimsServerSyncSigRef.current === sig) return;
    aimsServerSyncSigRef.current = sig;

    setKeyDesignElements((prev) => ({ ...prev, aims: nextAims as any }));
  }, [activeSubId, componentData, isOverall, loadedNodeId, nodeId]);

  useEffect(() => {
    if (loadedNodeId !== nodeId || !componentData) return;
    const serverSubs: any[] =
      (componentData as any)?.designedExperienceData?.subcomponents || [];
    setSubcomponents((prev) => {
      const localIds = new Set(prev.map((s) => s.id));
      const additions = serverSubs
        .filter((s: any) => s.id && !localIds.has(s.id))
        .map((s: any) => ({
          ...s,
          aims: s.aims || [],
          practices: s.practices || [],
          supports: s.supports || [],
        }));
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
  }, [loadedNodeId, nodeId, componentData]);

  useEffect(() => {
    if (loadedNodeId !== nodeId || !componentData) return;
    const serverAdult: any[] =
      (componentData as any)?.designedExperienceData?.adultSubcomponents || [];
    setAdultSubcomponents((prev) => {
      const localIds = new Set(prev.map((s) => s.id));
      const additions = serverAdult
        .filter((s: any) => s.id && !localIds.has(s.id))
        .map((s: any) => ({
          ...s,
          aims: s.aims || [],
          practices: s.practices || [],
          supports: s.supports || [],
        }));
      if (additions.length === 0) return prev;
      return [...prev, ...additions];
    });
  }, [loadedNodeId, nodeId, componentData]);

  useEffect(() => {
    if (!isOverall || !POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI) return;
    const synced = syncKeyAimsOutcomesFromPortrait({ keyDesignElements }, portraitOfGraduate);
    const nextAims: any[] = (synced as any)?.keyDesignElements?.aims || [];
    const curAims: any[] = (keyDesignElements as any)?.aims || [];

    const keyOf = (t: any) =>
      `${t?.type || ""}:${normPogKey(t?.label)}:${String(t?.source || "")}:${String(t?.level || "")}:${t?.isPrimary ? "1" : "0"}`;

    if (curAims.length !== nextAims.length) {
      setKeyDesignElements((prev) => ({ ...prev, aims: nextAims as any }));
      return;
    }
    for (let i = 0; i < curAims.length; i++) {
      if (keyOf(curAims[i]) !== keyOf(nextAims[i])) {
        setKeyDesignElements((prev) => ({ ...prev, aims: nextAims as any }));
        return;
      }
    }
  }, [isOverall, keyDesignElements, portraitOfGraduate]);

  useEffect(() => {
    if (!isOverall || POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI) return;
    if (pogNav.mode !== "outcomesFirst") return;
    setPogNav({ mode: "hub" });
  }, [isOverall, pogNav.mode]);

  useEffect(() => {
    if (!communityEcosystemDetailId) return;
    if (!communityEcosystemOutcomes.some((o) => o.id === communityEcosystemDetailId)) {
      setCommunityEcosystemDetailId(null);
    }
  }, [communityEcosystemDetailId, communityEcosystemOutcomes]);

  const patchCommunityEcosystemOutcome = useCallback((id: string, patch: Partial<CommunityEcosystemOutcome>) => {
    setCommunityEcosystemOutcomes((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  useEffect(() => {
    if (initialSubId && subcomponents.length > 0) {
      const found = subcomponents.find(s => s.id === initialSubId);
      if (found) {
        setActiveSubId(initialSubId);
        onSubIdConsumed?.();
      }
    }
  }, [initialSubId, subcomponents]);

  useEffect(() => {
    if (isOverall || loadedNodeId !== nodeId || !nodeId) return;

    const prev = prevActiveSubIdRef.current;
    const cur = activeSubId;
    if (prev === cur) return;

    const flushPatch = (): Pick<DESubcomponent, "description" | "aims" | "practices" | "supports" | "keyDesignElements" | "elementsExpertData"> => {
      const kde = kdeRef.current;
      return {
        description: descRef.current,
        aims: kde.aims,
        practices: kde.practices,
        supports: kde.supports,
        keyDesignElements: {
          ...kde,
          aims: [...kde.aims],
          practices: [...kde.practices],
          supports: [...kde.supports],
        },
        elementsExpertData: { ...elementsExpertRef.current },
      };
    };

    let mergedSubs = subcomponents;

    if (prev && prev !== cur) {
      mergedSubs = subcomponents.map((s) => (s.id === prev ? { ...s, ...flushPatch() } : s));
      setSubcomponents(mergedSubs);
    } else if (prev && !cur) {
      mergedSubs = subcomponents.map((s) => (s.id === prev ? { ...s, ...flushPatch() } : s));
      setSubcomponents(mergedSubs);
      const stash = subEditStashRef.current;
      if (stash) {
        setDescription(stash.parentDescription);
        setKeyDesignElements(stash.parentKeyDesignElements);
        setElementsExpertData(stash.parentElementsExpertData);
        subEditStashRef.current = null;
      }
      prevActiveSubIdRef.current = cur;
      return;
    }

    if (!cur) {
      prevActiveSubIdRef.current = cur;
      return;
    }

    if (!prev) {
      subEditStashRef.current = {
        parentDescription: descRef.current,
        parentKeyDesignElements: {
          ...kdeRef.current,
          aims: [...kdeRef.current.aims],
          practices: [...kdeRef.current.practices],
          supports: [...kdeRef.current.supports],
        },
        parentElementsExpertData: { ...elementsExpertRef.current },
      };
    }

    const sub = (prev && prev !== cur ? mergedSubs : subcomponents).find((s) => s.id === cur);
    if (sub) {
      const kde = sub.keyDesignElements || {
        aims: sub.aims || [],
        practices: sub.practices || [],
        supports: sub.supports || [],
      };
      setDescription(sub.description || "");
      setKeyDesignElements({
        aims: [...kde.aims],
        practices: [...kde.practices],
        supports: [...kde.supports],
      });
      setElementsExpertData({ ...(sub.elementsExpertData ?? {}) });
    }

    prevActiveSubIdRef.current = cur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubId, isOverall, loadedNodeId, nodeId, subcomponents]);

  const saveData = useCallback(() => {
    if (!nodeId) return;
    const deCurrent = (deRef.current || {}) as DesignedExperienceData;

    if (!isOverall && activeSubId) {
      const focus = subcomponents.find((s) => s.id === activeSubId);
      if (!focus) return;

      const stash = subEditStashRef.current;
      const parentKde: KeyDesignElements =
        stash?.parentKeyDesignElements ??
        (deCurrent.keyDesignElements as KeyDesignElements) ?? { aims: [], practices: [], supports: [] };

      // Sub save: scenarios use only this sub's aims — no parent ring aims or sibling rollup.
      const subsForScenario = [
        {
          ...focus,
          aims: keyDesignElements.aims,
          practices: keyDesignElements.practices,
          supports: keyDesignElements.supports,
        },
      ];

      const baseAims = (keyDesignElements as any)?.aims || [];
      const outcomeScenarios = buildRingScenarios({
        topAims: keyDesignElements.aims,
        subcomponents: subsForScenario,
        type: "outcome",
      });
      const leapScenarios = buildRingScenarios({
        topAims: keyDesignElements.aims,
        subcomponents: subsForScenario,
        type: "leap",
      });

      const aimsWithResolvedLevels = applyScenarioLevelsToAims(
        applyScenarioLevelsToAims(baseAims, outcomeScenarios, "outcome"),
        leapScenarios,
        "leap",
      );
      const keyDesignElementsWithLevels: KeyDesignElements = {
        ...keyDesignElements,
        aims: aimsWithResolvedLevels as any,
      };

      const updatedSub: DESubcomponent = {
        ...focus,
        description,
        aims: keyDesignElementsWithLevels.aims,
        practices: keyDesignElementsWithLevels.practices,
        supports: keyDesignElementsWithLevels.supports,
        keyDesignElements: keyDesignElementsWithLevels,
        elementsExpertData,
      };

      const newSubs = subcomponents.map((s) => (s.id === activeSubId ? updatedSub : s));

      const designedExperienceData: DesignedExperienceData = {
        ...deCurrent,
        description: stash?.parentDescription ?? deCurrent.description,
        keyDesignElements: parentKde,
        subcomponents: newSubs,
        adultSubcomponents,
        portraitOfGraduate: deCurrent.portraitOfGraduate,
        portraitOfGraduatePlainText: deCurrent.portraitOfGraduatePlainText,
        communityEcosystemOutcomes: deCurrent.communityEcosystemOutcomes,
        communityEcosystemPlainText: deCurrent.communityEcosystemPlainText,
        elementsExpertData: stash?.parentElementsExpertData ?? deCurrent.elementsExpertData,
      };

      updateMutation.mutate({ nodeId, data: { designedExperienceData } });
      return;
    }

    const baseAims = (keyDesignElements as any)?.aims || [];
    const ringList = ((allComponents as any[]) || []).filter((c: any) => String(c?.nodeId || c?.node_id || "") !== "overall");
    const outcomeScenarios = isOverall
      ? buildCenterScenarios({ centerTopAims: baseAims, ringComponents: ringList, type: "outcome" })
      : buildRingScenarios({ topAims: baseAims, subcomponents, type: "outcome" });
    const leapScenarios = isOverall
      ? buildCenterScenarios({ centerTopAims: baseAims, ringComponents: ringList, type: "leap" })
      : buildRingScenarios({ topAims: baseAims, subcomponents, type: "leap" });

    const aimsWithResolvedLevels = applyScenarioLevelsToAims(
      applyScenarioLevelsToAims(baseAims, outcomeScenarios, "outcome"),
      leapScenarios,
      "leap",
    );
    const keyDesignElementsWithLevels: KeyDesignElements = {
      ...keyDesignElements,
      aims: aimsWithResolvedLevels as any,
    };

    const syncedDe =
      isOverall && POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI
        ? syncKeyAimsOutcomesFromPortrait({ keyDesignElements: keyDesignElementsWithLevels }, portraitOfGraduate)
        : { keyDesignElements: keyDesignElementsWithLevels };
    const keyDesignElementsToSave = (syncedDe as any)?.keyDesignElements || keyDesignElementsWithLevels;
    const designedExperienceData: DesignedExperienceData = {
      ...(deRef.current || {}),
      description,
      keyDesignElements: keyDesignElementsToSave,
      subcomponents,
      adultSubcomponents,
      portraitOfGraduate: isOverall ? portraitOfGraduate : (deRef.current as any)?.portraitOfGraduate,
      elementsExpertData,
    };
    if (isOverall) {
      designedExperienceData.communityEcosystemOutcomes = communityEcosystemOutcomes;
      designedExperienceData.communityEcosystemPlainText = communityEcosystemPlainText;
      designedExperienceData.portraitOfGraduatePlainText = portraitOfGraduatePlainText;
    }
    updateMutation.mutate({ nodeId, data: { designedExperienceData } });
  }, [
    nodeId,
    description,
    isOverall,
    activeSubId,
    keyDesignElements,
    portraitOfGraduate,
    communityEcosystemOutcomes,
    communityEcosystemPlainText,
    portraitOfGraduatePlainText,
    subcomponents,
    adultSubcomponents,
    elementsExpertData,
    updateMutation,
    allComponents,
  ]);

  useEffect(() => {
    if (!nodeId || !componentData) return;
    // While the supports workflow is open, do not autosave from this parent view.
    // Otherwise it can overwrite supportGroups/supportDetails written by the supports pages.
    if (supportNav.mode !== "none") return;
    const timer = setTimeout(() => {
      saveData();
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    description,
    isOverall,
    activeSubId,
    keyDesignElements,
    portraitOfGraduate,
    communityEcosystemOutcomes,
    communityEcosystemPlainText,
    portraitOfGraduatePlainText,
    subcomponents,
    adultSubcomponents,
    elementsExpertData,
    supportNav.mode,
  ]);

  const addSubcomponent = () => {
    if (!newSubName.trim()) return;
    const newSub: DESubcomponent = {
      id: generateId(),
      name: newSubName.trim(),
      description: "",
      aims: [],
      practices: [],
      supports: [],
    };
    setSubcomponents(prev => [...prev, newSub]);
    setNewSubName("");
    setAddingSubcomponent(false);
  };

  const updateSubcomponent = (updated: DESubcomponent) => {
    setSubcomponents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const addAdultSubcomponent = () => {
    if (!newAdultSubName.trim()) return;
    const newSub: DESubcomponent = {
      id: generateId(),
      name: newAdultSubName.trim(),
      description: "",
      aims: [],
      practices: [],
      supports: [],
    };
    setAdultSubcomponents((prev) => [...prev, newSub]);
    setNewAdultSubName("");
    setAddingAdultSubcomponent(false);
  };

  const updateAdultSubcomponent = (updated: DESubcomponent) => {
    setAdultSubcomponents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const deleteAdultSubcomponent = (id: string) => {
    setAdultSubcomponents((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteSubcomponent = (id: string) => {
    setSubcomponents(prev => prev.filter(s => s.id !== id));
    if (activeSubId === id) setActiveSubId(null);
  };

  const focusSub =
    !isOverall && activeSubId ? subcomponents.find((s) => s.id === activeSubId) ?? null : null;
  const isEditingSub = !!focusSub;

  const serverDeForProfiles = (componentData as any)?.designedExperienceData || {};
  const serverSubForProfiles =
    !isOverall && activeSubId
      ? (serverDeForProfiles.subcomponents || []).find((s: any) => s.id === activeSubId)
      : null;

  const subProfileContext =
    isEditingSub && nodeId && activeSubId ? { parentNodeId: nodeId, subId: activeSubId } : null;

  /** While editing a sub, chips reflect that sub only (no fallback to the ring component). */
  const designedExperienceProfileSelections = useMemo(() => {
    if (isEditingSub) {
      const adults = serverSubForProfiles?.adultsProfile?.selections;
      const learners = serverSubForProfiles?.learnersProfile?.selections;
      return {
        adults: Array.isArray(adults) ? adults : [],
        learners: Array.isArray(learners) ? learners : [],
      };
    }
    const adults = serverDeForProfiles?.adultsProfile?.selections;
    const learners = serverDeForProfiles?.learnersProfile?.selections;
    return {
      adults: Array.isArray(adults) ? adults : [],
      learners: Array.isArray(learners) ? learners : [],
    };
  }, [isEditingSub, serverDeForProfiles, serverSubForProfiles]);

  const deOutcomeTargetedChipRows = useMemo(
    () => deExpandedOutcomeChips((keyDesignElements?.aims || []) as Tag[]),
    [keyDesignElements.aims],
  );

  const linkedPogOutcomeKeys = useMemo(() => {
    const keys = new Set<string>();
    const linksByAttr = (portraitOfGraduate as any)?.linksByAttributeId || {};
    for (const links of Object.values(linksByAttr) as any[]) {
      for (const link of Array.isArray(links) ? links : []) {
        const key = normPogKey((link as any)?.outcomeLabel);
        if (key) keys.add(key);
      }
    }
    return Array.from(keys);
  }, [portraitOfGraduate]);

  if (showOutcomeScore) {
    return (
      <OutcomeScoreView
        nodeId={nodeId}
        title={title}
        variant="learningAdvancement"
        onBack={() => setShowOutcomeScore(false)}
      />
    );
  }

  if (selectedOutcomeNav) {
    return (
      <OutcomeDetailView
        nodeId={nodeId}
        title={title}
        outcomeLabel={selectedOutcomeNav.l2}
        l3OutcomeLabel={selectedOutcomeNav.l3 ?? undefined}
        onBack={() => setSelectedOutcomeNav(null)}
        onOpenOutcomeScore={() => setShowOutcomeScore(true)}
      />
    );
  }

  if (selectedLeapLabel) {
    return (
      <LeapDetailView
        nodeId={nodeId}
        title={title}
        leapLabel={selectedLeapLabel}
        onBack={() => setSelectedLeapLabel(null)}
      />
    );
  }

  const selectedCommunityEcosystem = communityEcosystemDetailId
    ? communityEcosystemOutcomes.find((o) => o.id === communityEcosystemDetailId)
    : undefined;
  if (communityEcosystemDetailId && isOverall && selectedCommunityEcosystem) {
    return (
      <CommunityEcosystemOutcomeDetailView
        outcome={selectedCommunityEcosystem}
        onBack={() => setCommunityEcosystemDetailId(null)}
        onSave={(patch) => patchCommunityEcosystemOutcome(selectedCommunityEcosystem.id, patch)}
      />
    );
  }

  if (showCommunityEcosystemManage && isOverall) {
    return (
      <CommunityEcosystemManageView
        plainText={communityEcosystemPlainText}
        onPlainTextChange={setCommunityEcosystemPlainText}
        outcomes={communityEcosystemOutcomes}
        onChange={setCommunityEcosystemOutcomes}
        onPatchOutcome={patchCommunityEcosystemOutcome}
        onManageDetails={(id) => {
          setShowCommunityEcosystemManage(false);
          setCommunityEcosystemDetailId(id);
        }}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          deRef.current = latestDe;
          setShowCommunityEcosystemManage(false);
        }}
      />
    );
  }

  if (showSchoolLearnerExperienceView && isOverall) {
    return (
      <SchoolLearnerExperienceView
        onBack={() => setShowSchoolLearnerExperienceView(false)}
        onOpenComponent={(targetNodeId) => {
          setShowSchoolLearnerExperienceView(false);
          onRequestOpenComponent?.(targetNodeId);
        }}
      />
    );
  }

  if (showComponentLearnerManage && !isOverall && nodeId) {
    return (
      <ComponentLearnerExperienceView
        nodeId={nodeId}
        componentTitle={title || "Component"}
        initialSubcomponents={subcomponents}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          deRef.current = latestDe;
          setShowComponentLearnerManage(false);
        }}
        onOpenSubcomponent={(subId) => {
          setShowComponentLearnerManage(false);
          setActiveSubId(subId);
        }}
        onSubcomponentsUpdated={(subs) => setSubcomponents(subs)}
      />
    );
  }

  if (showSchoolAdultExperienceView && isOverall) {
    return (
      <SchoolAdultExperienceView
        onBack={() => setShowSchoolAdultExperienceView(false)}
        onOpenComponent={(targetNodeId) => {
          setShowSchoolAdultExperienceView(false);
          onRequestOpenComponent?.(targetNodeId);
        }}
      />
    );
  }

  if (showComponentAdultManage && !isOverall && nodeId) {
    return (
      <ComponentAdultExperienceView
        nodeId={nodeId}
        componentTitle={title || "Component"}
        initialAdultSubcomponents={adultSubcomponents}
        focusSubId={componentAdultFocusSubId}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          deRef.current = latestDe;
          setComponentAdultFocusSubId(null);
          setShowComponentAdultManage(false);
        }}
        onAdultSubcomponentsUpdated={(subs) => setAdultSubcomponents(subs)}
      />
    );
  }

  if (showPortraitOfGraduateManage && isOverall) {
    if (showPogManageLearnMore) {
      return (
        <div className="min-h-screen bg-gray-50" data-testid="pog-learn-more-from-manage">
          <PogLearnMoreView onBack={() => setShowPogManageLearnMore(false)} />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50" data-testid="portrait-of-graduate-manage-page">
        <div className="max-w-4xl mx-auto px-6 py-6 pb-20 space-y-6">
          <button
            type="button"
            onClick={() => {
              setShowPogManageLearnMore(false);
              setShowPortraitOfGraduateManage(false);
            }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Designed Experience
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Portrait of a Graduate</h1>
              <p className="text-sm text-gray-500 mt-1">
                Define graduate attributes with a name, description, and icon.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-gray-600 shrink-0"
              onClick={() => setShowPogManageLearnMore(true)}
              data-testid="pog-manage-learn-more"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1" />
              Learn more
            </Button>
          </div>
          <PogHubView
            portraitPlainText={portraitOfGraduatePlainText}
            onPortraitPlainTextChange={setPortraitOfGraduatePlainText}
            portrait={portraitOfGraduate}
            onChange={setPortraitOfGraduate}
            onOpenAttribute={(attributeId) => {
              setShowPortraitOfGraduateManage(false);
              setPogNav({ mode: "detail", attributeId });
            }}
            onStartWithOutcomes={
              POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI
                ? () => {
                    setShowPortraitOfGraduateManage(false);
                    setPogReturnToDetailAttrId(null);
                    setPogOutcomesFirstDraft((prev) => {
                      const merged = new Set<string>([...prev.selectedKeys, ...linkedPogOutcomeKeys]);
                      return { ...prev, selectedKeys: Array.from(merged) };
                    });
                    setPogNav({ mode: "outcomesFirst" });
                  }
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  if (showAdultsView) {
    return (
      <AdultsView
        nodeId={nodeId}
        title={title}
        subProfileContext={subProfileContext}
        initialSliceKey={adultsInitialSliceKey}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          deRef.current = latestDe;
          setAdultsInitialSliceKey(null);
          setShowAdultsView(false);
        }}
      />
    );
  }

  if (showLearnersView) {
    return (
      <LearnersView
        nodeId={nodeId}
        title={title}
        subProfileContext={subProfileContext}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          deRef.current = latestDe;
          setShowLearnersView(false);
        }}
      />
    );
  }

  if (showLeapSummary) {
    return (
      <LeapSummaryView
        nodeId={nodeId}
        title={title}
        manageSubScope={!isOverall && activeSubId ? { flavor: "learner", subId: activeSubId } : null}
        focusLeapLabel={leapSummaryFocusLabel}
        onOpenLeapDetail={(label) => {
          setShowLeapSummary(false);
          setLeapSummaryFocusLabel(null);
          setSelectedLeapLabel(label);
        }}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          let latestKde = latestDe?.keyDesignElements || { aims: [], practices: [], supports: [] };
          if (!isOverall && activeSubId) {
            const sub = (latestDe.subcomponents || []).find((s: any) => s.id === activeSubId);
            latestKde =
              sub?.keyDesignElements || { aims: sub?.aims || [], practices: sub?.practices || [], supports: sub?.supports || [] };
          }
          setKeyDesignElements({
            aims: Array.isArray(latestKde?.aims) ? latestKde.aims : [],
            practices: Array.isArray(latestKde?.practices) ? latestKde.practices : [],
            supports: Array.isArray(latestKde?.supports) ? latestKde.supports : [],
          });
          setLeapSummaryFocusLabel(null);
          setShowLeapSummary(false);
        }}
      />
    );
  }

  if (showOutcomeSummary) {
    return (
      <OutcomeSummaryView
        nodeId={nodeId}
        title={title}
        manageSubScope={!isOverall && activeSubId ? { flavor: "learner", subId: activeSubId } : null}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          let latestKde = latestDe?.keyDesignElements || { aims: [], practices: [], supports: [] };
          if (!isOverall && activeSubId) {
            const sub = (latestDe.subcomponents || []).find((s: any) => s.id === activeSubId);
            latestKde =
              sub?.keyDesignElements || { aims: sub?.aims || [], practices: sub?.practices || [], supports: sub?.supports || [] };
          }
          setKeyDesignElements({
            aims: Array.isArray(latestKde?.aims) ? latestKde.aims : [],
            practices: Array.isArray(latestKde?.practices) ? latestKde.practices : [],
            supports: Array.isArray(latestKde?.supports) ? latestKde.supports : [],
          });
          setShowOutcomeSummary(false);
        }}
        onOpenOutcomeScore={() => setShowOutcomeScore(true)}
      />
    );
  }

  if (isOverall && pogNav.mode === "detail") {
    return (
      <div className="min-h-screen bg-gray-50" data-testid="pog-attribute-detail-page">
        <PogAttributeDetailView
          portrait={portraitOfGraduate}
          attributeId={pogNav.attributeId}
          onChange={setPortraitOfGraduate}
          onBack={() => setPogNav({ mode: "hub" })}
        />
      </div>
    );
  }

  if (isOverall && pogNav.mode === "outcomesFirst") {
    return (
      <div className="p-6">
        <PogOutcomesFirstView
          portrait={portraitOfGraduate}
          onChange={setPortraitOfGraduate}
          outcomeSchema={OUTCOME_SCHEMA as any}
          selectedKeys={pogOutcomesFirstDraft.selectedKeys}
          onSelectedKeysChange={(next) => setPogOutcomesFirstDraft((prev) => ({ ...prev, selectedKeys: next }))}
          step={pogOutcomesFirstDraft.step}
          onStepChange={(next) => setPogOutcomesFirstDraft((prev) => ({ ...prev, step: next }))}
          onOpenOutcome={(label) => setSelectedOutcomeNav({ l2: label })}
          onBack={() => {
            if (pogReturnToDetailAttrId) {
              const attrId = pogReturnToDetailAttrId;
              setPogReturnToDetailAttrId(null);
              setPogNav({ mode: "detail", attributeId: attrId });
              return;
            }
            setPogNav({ mode: "hub" });
          }}
        />
      </div>
    );
  }

  if (supportNav.mode === "hub") {
    return (
      <SupportGroupsHubView
        nodeId={nodeId}
        title={title}
        onBack={() => setSupportNav({ mode: "none" })}
        onOpenGroup={(groupKey) => setSupportNav({ mode: "group", groupKey })}
        onOpenSupport={(groupKey, label) => setSupportNav({ mode: "detail", groupKey, label, backTo: "hub" })}
      />
    );
  }

  if (supportNav.mode === "group") {
    return (
      <SupportGroupDetailView
        nodeId={nodeId}
        title={title}
        groupKey={supportNav.groupKey}
        onBack={() => setSupportNav({ mode: "hub" })}
        onOpenSupport={(label) => setSupportNav({ mode: "detail", groupKey: supportNav.groupKey, label, backTo: "group" })}
      />
    );
  }

  if (supportNav.mode === "detail") {
    return (
      <SupportDetailView
        nodeId={nodeId}
        title={title}
        supportLabel={supportNav.label}
        onBack={() =>
          setSupportNav(
            supportNav.backTo === "hub"
              ? { mode: "hub" }
              : { mode: "group", groupKey: supportNav.groupKey },
          )
        }
      />
    );
  }

  if (expertViewOpen) {
    return (
      <ExpertViewShell
        key={`${expertViewNonce}-${nodeId ?? ""}`}
        componentTitle={isEditingSub && focusSub?.name ? focusSub.name : title || "Component"}
        componentType={isOverall ? "center" : "ring"}
        initialActiveElement={expertViewInitialElement}
        data={elementsExpertData}
        onChange={setElementsExpertData}
        onBack={() => setExpertViewOpen(false)}
        schoolWideElementsExpertData={schoolWideElementsExpertData}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 space-y-8 pb-24 pt-6">
        
        <section className="space-y-4">
          {isEditingSub && focusSub && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Subcomponent</span>
              <Input
                value={focusSub.name}
                onChange={(e) => updateSubcomponent({ ...focusSub, name: e.target.value })}
                className="h-8 text-sm font-medium max-w-md"
                data-testid="input-subcomponent-focus-name"
              />
            </div>
          )}
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the designed experience for this component..."
            className="text-sm text-gray-700 leading-relaxed border-gray-200 focus:border-blue-300 min-h-[80px] resize-none bg-gray-50/50"
            data-testid="input-de-description"
          />
        </section>

        <section>
          <SectionHeader title="Featured Artifacts" onAdd={() => {}}>
            <Button variant="link" size="sm" className="text-xs text-gray-500 h-auto p-0 hover:text-gray-900">View all</Button>
          </SectionHeader>
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-4">
              {FEATURED_ARTIFACTS.map(artifact => (
                <ArtifactCard key={artifact.id} artifact={artifact} />
              ))}
              <div className="flex flex-col w-[160px] group cursor-pointer">
                <div className="relative aspect-[4/3] bg-gray-50 rounded-md border border-dashed border-gray-300 flex items-center justify-center transition-colors group-hover:bg-gray-100 group-hover:border-gray-400">
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <Plus className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Add Artifact</span>
                  </div>
                </div>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>

        {/* ── Targeted Impacts for Learners ────────────────────── */}
        <section className="border border-gray-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-tight">Targeted Impact for Learners</h3>
          </div>
          <div className="space-y-3">
            {/* Leaps & Design Principles */}
            <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Leaps &amp; Design Principles</span>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-gray-500 h-auto p-0"
                  onClick={() => {
                    setLeapSummaryFocusLabel(null);
                    setShowLeapSummary(true);
                  }}
                >
                  Manage
                </Button>
              </div>
              {keyDesignElements.aims.filter((a) => a.type === "leap" && isLeapAimActive(a as any)).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {keyDesignElements.aims
                    .filter((a) => a.type === "leap" && isLeapAimActive(a as any))
                    .map((tag) => {
                      const pri = aimPriorityAbbrev(tag);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors inline-flex items-center gap-1 max-w-full min-w-0"
                          onClick={() => setSelectedLeapLabel(tag.label)}
                        >
                          <span className="truncate min-w-0">{tag.label}</span>
                          {pri ? (
                            <span
                              className={cn(
                                "text-[9px] font-bold px-1 rounded border shrink-0",
                                DE_CHIP_PRIORITY_STYLES[pri] ?? "bg-gray-100 border-gray-200 text-gray-600",
                              )}
                            >
                              {pri}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No leaps selected yet</p>
              )}
            </div>
            {/* Outcomes */}
            <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Targeted Outcomes</span>
                <Button variant="link" size="sm" className="text-xs text-gray-500 h-auto p-0" onClick={() => setShowOutcomeSummary(true)}>
                  Manage
                </Button>
              </div>
              {deOutcomeTargetedChipRows.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {deOutcomeTargetedChipRows.map((row) => {
                    const priLetter = deOutcomeChipPriorityLetter(row.aim as any, row.l3);
                    return (
                      <button
                        key={row.reactKey}
                        type="button"
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 max-w-full min-w-0"
                        onClick={() =>
                          setSelectedOutcomeNav({
                            l2: row.aim.label,
                            l3: row.l3 ?? undefined,
                          })
                        }
                      >
                        <span className="truncate min-w-0">{row.chipLabel}</span>
                        {priLetter ? (
                          <span
                            className={cn(
                              "text-[9px] font-bold px-1 rounded border shrink-0",
                              DE_CHIP_PRIORITY_STYLES[priLetter] ?? "bg-gray-100 border-gray-200 text-gray-600",
                            )}
                          >
                            {priLetter}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No outcomes selected yet</p>
              )}
            </div>
            {/* Portrait of a Graduate — center component only */}
            {isOverall && (
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs font-medium text-gray-700">Portrait of a Graduate</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-gray-500 h-auto p-0"
                    onClick={() => {
                      setShowPogManageLearnMore(false);
                      setShowPortraitOfGraduateManage(true);
                    }}
                    data-testid="button-manage-portrait-of-graduate"
                  >
                    Manage
                  </Button>
                </div>
                {(portraitOfGraduate.attributes || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(portraitOfGraduate.attributes || []).map((attr) => (
                      <button
                        key={attr.id}
                        type="button"
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                        onClick={() => setPogNav({ mode: "detail", attributeId: attr.id })}
                      >
                        {attr.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No graduate portrait attributes yet — open Manage to add them.</p>
                )}
              </div>
            )}
            {/* Community & ecosystem outcomes — center only */}
            {isOverall && (
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs font-medium text-gray-700">Community &amp; ecosystem outcomes</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-gray-500 h-auto p-0"
                    onClick={() => setShowCommunityEcosystemManage(true)}
                    data-testid="button-manage-community-ecosystem-outcomes"
                  >
                    Manage
                  </Button>
                </div>
                {communityEcosystemOutcomes.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {communityEcosystemOutcomes.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors"
                        onClick={() => setCommunityEcosystemDetailId(o.id)}
                        data-testid={`chip-community-ecosystem-${o.id}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">None selected yet — open Manage to add outcomes.</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Learner Experience ───────────────────────────────── */}
        {!isEditingSub && (
        <section className="border border-gray-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Learner experience</h3>
            {isOverall ? (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {learnerModuleLibrary ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-gray-200 text-gray-700 hover:text-sky-800 hover:border-sky-300 bg-white"
                    onClick={openLearnerLibrary}
                  >
                    <Library className="w-3 h-3" />
                    Module library
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 bg-transparent"
                  onClick={() => setShowSchoolLearnerExperienceView(true)}
                >
                  <Plus className="w-3 h-3" /> Add component
                </Button>
                <Button variant="link" size="sm" className="text-xs text-gray-500 h-auto p-0" onClick={() => setShowSchoolLearnerExperienceView(true)}>
                  Manage
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {learnerModuleLibrary ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-gray-200 text-gray-700 hover:text-sky-800 hover:border-sky-300 bg-white"
                    onClick={openLearnerLibrary}
                  >
                    <Library className="w-3 h-3" />
                    Module library
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 bg-transparent"
                  onClick={() => setAddingSubcomponent(true)}
                >
                  <Plus className="w-3 h-3" /> Add subcomponent
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-gray-500 h-auto p-0"
                  onClick={() => setShowComponentLearnerManage(true)}
                  data-testid="button-manage-ring-learner-experience"
                >
                  Manage
                </Button>
              </div>
            )}
          </div>
          {isOverall ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Whole-school learner components are octagons on the blueprint. Open the module library strip, drag here or
                onto the canvas, or use Manage — same list everywhere.
              </p>
              {learnerBlueprintRings.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <Target className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-400">No learner components yet</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {learnerBlueprintRings.map((c: any) => (
                    <div
                      key={c.nodeId}
                      className="inline-flex items-stretch gap-0 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 max-w-[220px] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => onRequestOpenComponent?.(String(c.nodeId))}
                        className="text-left text-[11px] font-medium px-2.5 py-1.5 hover:bg-sky-100 transition-colors min-w-0 flex-1"
                      >
                        <span className="line-clamp-2">{c.title || c.nodeId}</span>
                      </button>
                      <button
                        type="button"
                        title="Remove from blueprint"
                        className="shrink-0 px-2 border-l border-sky-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          const label = String(c.title || c.nodeId);
                          if (confirm(`Delete “${label}” from the blueprint?`)) {
                            deleteRingMutation.mutate(String(c.nodeId));
                          }
                        }}
                        data-testid={`button-delete-learner-blueprint-ring-${c.nodeId}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Subcomponents organize learner experience within this ring. Use Manage for scratch adds, descriptions, and
                bulk editing in one place — similar to whole-school learner experience, scoped to this component.
              </p>
              <AnimatePresence>
                {addingSubcomponent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Input
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addSubcomponent();
                          if (e.key === "Escape") { setNewSubName(""); setAddingSubcomponent(false); }
                        }}
                        placeholder="Subcomponent name..."
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        data-testid="input-new-subcomponent-name"
                      />
                      <Button size="sm" className="h-8" onClick={addSubcomponent} data-testid="button-confirm-add-subcomponent">Add</Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => { setNewSubName(""); setAddingSubcomponent(false); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {subcomponents.length === 0 && !addingSubcomponent ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <Target className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-400">No subcomponents yet</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subcomponents.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveSubId(sub.id)}
                      className="text-left text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 transition-colors max-w-[200px]"
                      data-testid={`button-open-subcomponent-${sub.id}`}
                    >
                      <span className="line-clamp-2">{sub.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
        )}

        {/* ── Adults ───────────────────────────────────────────── */}
        <section className="border border-gray-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-tight">Adults</h3>
            <Button
              variant="link"
              size="sm"
              className="text-xs text-gray-500 h-auto p-0"
              onClick={() => {
                setAdultsInitialSliceKey(null);
                setShowAdultsView(true);
              }}
            >
              Manage
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Which adult roles this component is designed for, and demographics, skills, background, and staffing for each
            role — separate from learner-facing design below.
          </p>
          {(() => {
            const adultSels = designedExperienceProfileSelections.adults;
            const chips = adultLeafChipsFromSelections(adultSels);
            return chips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setAdultsInitialSliceKey(c.key);
                      setShowAdultsView(true);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium cursor-pointer hover:opacity-90",
                      c.isKey
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : "bg-sky-50 border-sky-200 text-sky-800",
                    )}
                  >
                    {c.isKey && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No adult roles yet — open Manage to add roles and detail.</p>
            );
          })()}
        </section>

        {/* ── Adult experience (catalog + manage) ─────────────── */}
        {!isEditingSub && (
          <section className="border border-violet-200/80 rounded-xl p-5 bg-violet-50/25">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-sm font-semibold text-gray-800">Adult experience</h3>
              {isOverall ? (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {learnerModuleLibrary ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-violet-200 text-violet-900 hover:bg-violet-100 bg-white"
                      onClick={openAdultLibrary}
                    >
                      <Library className="w-3 h-3" />
                      Module library
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-dashed border-violet-300 text-violet-800 hover:bg-violet-100 bg-transparent"
                    onClick={() => setShowSchoolAdultExperienceView(true)}
                  >
                    <Plus className="w-3 h-3" /> Add component
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-violet-800 h-auto p-0"
                    onClick={() => setShowSchoolAdultExperienceView(true)}
                  >
                    Manage
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {learnerModuleLibrary ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-violet-200 text-violet-900 hover:bg-violet-100 bg-white"
                      onClick={openAdultLibrary}
                    >
                      <Library className="w-3 h-3" />
                      Module library
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 border-dashed border-violet-300 text-violet-800 hover:bg-violet-100 bg-transparent"
                    onClick={() => setAddingAdultSubcomponent(true)}
                  >
                    <Plus className="w-3 h-3" /> Add subcomponent
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-violet-800 h-auto p-0"
                    onClick={() => {
                      setComponentAdultFocusSubId(null);
                      setShowComponentAdultManage(true);
                    }}
                    data-testid="button-manage-ring-adult-experience"
                  >
                    Manage
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-3">
              {isOverall
                ? "Whole-school adult components are octagons on the blueprint. Open the strip on Adult, drag here or onto the canvas, or use Manage — same list everywhere."
                : "Adult modules for this ring: strip on Adult, drag onto the working panel here or the blueprint. Use Manage for scratch adds and bulk editing."}
            </p>
            {isOverall ? (
              <>
                {adultBlueprintRings.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-violet-200 rounded-lg bg-white/60">
                    <Target className="w-6 h-6 mx-auto mb-2 text-violet-200" />
                    <p className="text-xs text-gray-400">No adult components yet</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {adultBlueprintRings.map((c: any) => (
                      <div
                        key={c.nodeId}
                        className="inline-flex items-stretch gap-0 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 max-w-[220px] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => onRequestOpenComponent?.(String(c.nodeId))}
                          className="text-left text-[11px] font-medium px-2.5 py-1.5 hover:bg-violet-100 transition-colors min-w-0 flex-1"
                        >
                          <span className="line-clamp-2">{c.title || c.nodeId}</span>
                        </button>
                        <button
                          type="button"
                          title="Remove from blueprint"
                          className="shrink-0 px-2 border-l border-violet-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            const label = String(c.title || c.nodeId);
                            if (confirm(`Delete “${label}” from the blueprint?`)) {
                              deleteRingMutation.mutate(String(c.nodeId));
                            }
                          }}
                          data-testid={`button-delete-adult-blueprint-ring-${c.nodeId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <AnimatePresence>
                  {addingAdultSubcomponent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                        <Input
                          value={newAdultSubName}
                          onChange={(e) => setNewAdultSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addAdultSubcomponent();
                            if (e.key === "Escape") {
                              setNewAdultSubName("");
                              setAddingAdultSubcomponent(false);
                            }
                          }}
                          placeholder="Adult module name..."
                          className="flex-1 h-8 text-sm"
                          autoFocus
                          data-testid="input-new-adult-subcomponent-name"
                        />
                        <Button size="sm" className="h-8" onClick={addAdultSubcomponent} data-testid="button-confirm-add-adult-subcomponent">
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => {
                            setNewAdultSubName("");
                            setAddingAdultSubcomponent(false);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {adultSubcomponents.length === 0 && !addingAdultSubcomponent ? (
                  <div className="text-center py-8 border border-dashed border-violet-200 rounded-lg bg-white/60">
                    <Target className="w-6 h-6 mx-auto mb-2 text-violet-200" />
                    <p className="text-xs text-gray-400">No adult modules yet</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {adultSubcomponents.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setComponentAdultFocusSubId(sub.id);
                          setShowComponentAdultManage(true);
                        }}
                        className="text-left text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 transition-colors max-w-[200px]"
                        data-testid={`button-open-adult-subcomponent-${sub.id}`}
                      >
                        <span className="line-clamp-2">{sub.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── Learners (schema root — not an “element” row) ─────── */}
        <section className="border border-gray-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-tight">Learners</h3>
            <Button variant="link" size="sm" className="text-xs text-gray-500 h-auto p-0" onClick={() => setShowLearnersView(true)}>
              Manage
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Demographics, incoming skills and mindsets, and selection gating — who experiences this component. Plain
            language and structured tags are separate from the other design elements below.
          </p>
          {designedExperienceProfileSelections.learners.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {designedExperienceProfileSelections.learners.map(
                (sel: { primaryId: string; isKey?: boolean; secondaryIds?: string[]; description?: string }) => (
                  <span
                    key={sel.primaryId}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium",
                      learnerSelectionIsKey(sel)
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : "bg-purple-50 border-purple-200 text-purple-800",
                    )}
                  >
                    {learnerSelectionIsKey(sel) && (
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                    )}
                    {formatLearnerSelectionPreview(sel)}
                  </span>
                ),
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No learner tags yet — open Manage to add tags.</p>
          )}
        </section>

        {/* ── Elements of the Designed Experience ─────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-tight">Elements of the Designed Experience</h3>
          </div>
          <button
            onClick={() => openExpertView("schedule")}
            className="w-full text-left border border-gray-200 rounded-xl p-5 bg-white hover:border-purple-300 hover:bg-purple-50/20 transition-all group mt-2"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 group-hover:text-purple-800 transition-colors">
                    Schedule &amp; Use of Time
                  </span>
                  {Object.keys(elementsExpertData['schedule'] ?? {}).filter(k => k !== '__plain__').length > 0 && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                      In progress
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">Time blocks, scheduling structures, tools &amp; resources</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </button>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => openExpertView("learning")}
              className="w-full text-left border border-gray-200 rounded-xl p-5 bg-white hover:border-purple-300 hover:bg-purple-50/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-purple-800 transition-colors">
                      Learning Activities, Instructional Practices, C&amp;A
                    </span>
                    {Object.keys(elementsExpertData["learning"] ?? {}).filter((k) => k !== "__plain__").length >
                      0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Learning activities, facilitation, curriculum &amp; assessment</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => openExpertView("culture")}
              className="w-full text-left border border-gray-200 rounded-xl p-5 bg-white hover:border-purple-300 hover:bg-purple-50/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-purple-800 transition-colors">
                      Systems &amp; Practices for School Culture
                    </span>
                    {Object.keys(elementsExpertData["culture"] ?? {}).filter((k) => k !== "__plain__").length >
                      0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Culture &amp; community activities, touchstones, adult materials</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => openExpertView("facilitator")}
              className="w-full text-left border border-gray-200 rounded-xl p-5 bg-white hover:border-purple-300 hover:bg-purple-50/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-purple-800 transition-colors">
                      Facilitator Roles &amp; Configurations
                    </span>
                    {Object.keys(elementsExpertData["facilitator"] ?? {}).filter((k) => k !== "__plain__").length > 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Staffing configurations, ratios, roles &amp; adult practices</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => openExpertView("partnerships")}
              className="w-full text-left border border-gray-200 rounded-xl p-5 bg-white hover:border-purple-300 hover:bg-purple-50/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-purple-800 transition-colors">
                      Community &amp; Family Partnerships
                    </span>
                    {Object.keys(elementsExpertData["partnerships"] ?? {}).filter((k) => k !== "__plain__").length > 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Community partnerships, family communications &amp; coordination systems</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => openExpertView("ops")}
              className="w-full text-left border border-gray-200 rounded-xl p-5 bg-white hover:border-purple-300 hover:bg-purple-50/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-purple-800 transition-colors">
                      Operations, Budget &amp; Infrastructure
                    </span>
                    {Object.keys(elementsExpertData["ops"] ?? {}).filter((k) => k !== "__plain__").length > 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Physical & digital space, transportation, food, cost & funding, and operational systems</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => openExpertView("improvement")}
              className="w-full text-left border border-gray-200 rounded-xl p-5 bg-white hover:border-purple-300 hover:bg-purple-50/20 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-purple-800 transition-colors">
                      Continuous Improvement &amp; Design
                    </span>
                    {Object.keys(elementsExpertData["improvement"] ?? {}).filter((k) => k !== "__plain__").length > 0 && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200 font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Who drives improvement, what practices are used &amp; what tools support them</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
