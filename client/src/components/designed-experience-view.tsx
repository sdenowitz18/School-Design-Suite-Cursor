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
  X,
  Star,
  Trash2,
  Pencil,
  Check,
  Search,
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
import { Separator } from "@/components/ui/separator";
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
import { componentQueries, useUpdateComponent } from "@/lib/api";
import OutcomeSummaryView from "./outcome-summary-view";
import OutcomeDetailView from "./outcome-detail-view";
import OutcomeScoreView from "./outcome-score-view";
import { SchemaPickerSheet } from "./de-schema-picker-sheet";
import { LEAP_SCHEMA, OUTCOME_SCHEMA, PRACTICE_SCHEMA, SUPPORT_SCHEMA } from "./designed-experience-schemas";
import SupportGroupsHubView from "./support-groups-hub-view";
import SupportGroupDetailView from "./support-group-detail-view";
import SupportDetailView from "./support-detail-view";
import type { SupportGroupKey } from "./support-groups-config";
import PogHubView from "./pog/pog-hub-view";
import PogAttributeDetailView from "./pog/pog-attribute-detail-view";
import PogOutcomesFirstView from "./pog/pog-outcomes-first-view";
import PogAttributesOverviewView from "./pog/pog-attributes-overview-view";
import type { PortraitOfGraduate } from "./pog/pog-types";
import { normalizePortrait, syncKeyAimsOutcomesFromPortrait, normKey as normPogKey } from "./pog/pog-utils";
import {
  applyScenarioLevelsToAims,
  buildCenterScenarios,
  buildRingScenarios,
  priorityToLevel as rollupPriorityToLevel,
  type TargetingScenario,
} from "./targeting-rollup-utils";

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

export interface DESubcomponent {
  id: string;
  name: string;
  description: string;
  aims: Tag[];
  practices: Tag[];
  supports: Tag[];
}

export interface KeyDesignElements {
  aims: Tag[];
  practices: Tag[];
  supports: Tag[];
}

export interface DesignedExperienceData {
  description?: string;
  keyDesignElements?: KeyDesignElements;
  subcomponents?: DESubcomponent[];
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

const levelToHml = (level: TagLevel | undefined): "H" | "M" | "L" => {
  if (level === "High") return "H";
  if (level === "Low") return "L";
  return "M";
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

function CompactTagRow({
  aims,
  practices,
  supports,
  onToggleAim,
  onSetAimLevel,
  getAimLevel,
  onRemoveAim,
  onTogglePractice,
  onRemovePractice,
  onToggleSupport,
  onRemoveSupport,
}: {
  aims: Tag[];
  practices: Tag[];
  supports: Tag[];
  onToggleAim: (label: string, type: TagType) => void;
  onSetAimLevel?: (label: string, type: "outcome" | "leap", level: TagLevel) => void;
  getAimLevel?: (label: string, type: "outcome" | "leap") => TagLevel | undefined;
  onRemoveAim: (id: string) => void;
  onTogglePractice: (label: string) => void;
  onRemovePractice: (id: string) => void;
  onToggleSupport: (label: string) => void;
  onRemoveSupport: (id: string) => void;
}) {
  const aimLabels = aims.map(a => a.label);
  const practiceLabels = practices.map(p => p.label);
  const supportLabels = supports.map(s => s.label);

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 min-w-[70px]">
            <Target className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] font-semibold uppercase text-gray-500">Aims</span>
          </div>
          <div className="flex flex-wrap gap-1 flex-1">
            {aims.map(tag => (
              <Chip
                key={tag.id}
                type={tag.type}
                label={tag.label}
                isPrimary={tag.isPrimary}
                meta={tag.type === "outcome" || tag.type === "leap" ? levelToHml(tag.level) : undefined}
                onRemove={() => onRemoveAim(tag.id)}
              />
            ))}
            <SchemaPickerSheet
              title="Select Outcomes"
              description="Choose outcome aims for this subcomponent."
              schema={OUTCOME_SCHEMA}
              selectedLabels={aimLabels}
              onToggle={(label) => onToggleAim(label, "outcome")}
              getLevel={getAimLevel ? (label) => getAimLevel(label, "outcome") : undefined}
              onSetLevel={onSetAimLevel ? (label, level) => onSetAimLevel(label, "outcome", level) : undefined}
              type="outcome"
              triggerLabel="Outcomes"
              triggerIcon={Target}
            />
            <SchemaPickerSheet
              title="Select Leaps"
              description="Choose leap aims for this subcomponent."
              schema={LEAP_SCHEMA}
              selectedLabels={aimLabels}
              onToggle={(label) => onToggleAim(label, "leap")}
              getLevel={getAimLevel ? (label) => getAimLevel(label, "leap") : undefined}
              onSetLevel={onSetAimLevel ? (label, level) => onSetAimLevel(label, "leap", level) : undefined}
              type="leap"
              triggerLabel="Leaps"
              triggerIcon={Sparkles}
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 min-w-[70px]">
            <RotateCw className="w-3 h-3 text-orange-600" />
            <span className="text-[10px] font-semibold uppercase text-gray-500">Practices</span>
          </div>
          <div className="flex flex-wrap gap-1 flex-1">
            {practices.map(tag => (
              <Chip key={tag.id} type="practice" label={tag.label} onRemove={() => onRemovePractice(tag.id)} />
            ))}
            <SchemaPickerSheet
              title="Select Practices"
              description="Choose instructional practices for this subcomponent."
              schema={PRACTICE_SCHEMA}
              selectedLabels={practiceLabels}
              onToggle={onTogglePractice}
              type="practice"
              triggerLabel="Practices"
              triggerIcon={RotateCw}
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 min-w-[70px]">
            <Wrench className="w-3 h-3 text-sky-600" />
            <span className="text-[10px] font-semibold uppercase text-gray-500">Supports</span>
          </div>
          <div className="flex flex-wrap gap-1 flex-1">
            {supports.map(tag => (
              <Chip key={tag.id} type="support" label={tag.label} onRemove={() => onRemoveSupport(tag.id)} />
            ))}
            <SchemaPickerSheet
              title="Select Supports"
              description="Choose supports and resources for this subcomponent."
              schema={SUPPORT_SCHEMA}
              selectedLabels={supportLabels}
              onToggle={onToggleSupport}
              type="support"
              triggerLabel="Supports"
              triggerIcon={Wrench}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SubcomponentCard({ 
  sub, 
  onUpdate, 
  onDelete, 
  onOpen 
}: { 
  sub: DESubcomponent; 
  onUpdate: (updated: DESubcomponent) => void; 
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState(sub.name);
  const [descVal, setDescVal] = useState(sub.description);

  useEffect(() => {
    setNameVal(sub.name);
    setDescVal(sub.description);
  }, [sub.name, sub.description]);

  const toggleAim = (label: string, type: TagType) => {
    const existing = sub.aims.find(a => a.label === label);
    if (existing) {
      onUpdate({ ...sub, aims: sub.aims.filter(a => a.id !== existing.id) });
    } else {
      onUpdate({ ...sub, aims: [...sub.aims, { id: generateId(), type, label, level: "Medium" }] });
    }
  };

  const togglePractice = (label: string) => {
    const existing = sub.practices.find(p => p.label === label);
    if (existing) {
      onUpdate({ ...sub, practices: sub.practices.filter(p => p.id !== existing.id) });
    } else {
      onUpdate({ ...sub, practices: [...sub.practices, { id: generateId(), type: "practice", label }] });
    }
  };

  const toggleSupport = (label: string) => {
    const existing = sub.supports.find(s => s.label === label);
    if (existing) {
      onUpdate({ ...sub, supports: sub.supports.filter(s => s.id !== existing.id) });
    } else {
      onUpdate({ ...sub, supports: [...sub.supports, { id: generateId(), type: "support", label }] });
    }
  };

  const saveName = () => {
    if (nameVal.trim()) {
      onUpdate({ ...sub, name: nameVal.trim() });
    }
    setEditingName(false);
  };

  const saveDesc = () => {
    onUpdate({ ...sub, description: descVal });
    setEditingDesc(false);
  };

  return (
    <motion.div 
      initial={false}
      className={cn(
        "border rounded-lg bg-white transition-all duration-200 overflow-hidden", 
        isOpen ? "shadow-sm ring-1 ring-black/5 border-gray-300" : "border-gray-200 hover:border-gray-300",
      )}
      data-testid={`card-subcomponent-${sub.id}`}
    >
      <div className="px-4 py-3 cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {editingName ? (
                <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                  <Input 
                    value={nameVal} 
                    onChange={(e) => setNameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameVal(sub.name); setEditingName(false); } }}
                    className="h-7 text-sm font-semibold"
                    autoFocus
                    data-testid={`input-subcomponent-name-${sub.id}`}
                  />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={saveName}>Save</Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group/name">
                  <h4 className="font-semibold text-sm text-gray-900" data-testid={`text-subcomponent-name-${sub.id}`}>{sub.name}</h4>
                  <button
                    className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5"
                    onClick={(e) => { e.stopPropagation(); setEditingName(true); }}
                    data-testid={`button-edit-name-${sub.id}`}
                  >
                    <Pencil className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              )}
            </div>
            {!isOpen && (
              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                <span>{sub.aims.length} aims</span>
                <span>·</span>
                <span>{sub.practices.length} practices</span>
                <span>·</span>
                <span>{sub.supports.length} supports</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              data-testid={`button-open-subcomponent-${sub.id}`}
            >
              Open
            </Button>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", isOpen && "rotate-180")} />
          </div>
        </div>
      </div>

      <Collapsible open={isOpen}>
        <CollapsibleContent>
          <div className="px-4 pb-3 pt-0 space-y-3">
            <Separator className="mb-2" />
            
            <div onClick={(e) => e.stopPropagation()}>
              {editingDesc ? (
                <div className="space-y-1.5">
                  <Textarea 
                    value={descVal} 
                    onChange={(e) => setDescVal(e.target.value)}
                    className="text-xs min-h-[50px] resize-none"
                    placeholder="Describe this subcomponent..."
                    autoFocus
                    data-testid={`input-subcomponent-desc-${sub.id}`}
                  />
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { setDescVal(sub.description); setEditingDesc(false); }}>Cancel</Button>
                    <Button size="sm" className="h-6 text-[11px]" onClick={saveDesc}>Save</Button>
                  </div>
                </div>
              ) : (
                <p 
                  className="text-xs text-gray-600 leading-relaxed cursor-pointer hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
                  onClick={() => setEditingDesc(true)}
                  data-testid={`text-subcomponent-desc-${sub.id}`}
                >
                  {sub.description || <span className="italic text-gray-400">Click to add description...</span>}
                </p>
              )}
            </div>

            <div onClick={(e) => e.stopPropagation()}>
              <CompactTagRow
                aims={sub.aims}
                practices={sub.practices}
                supports={sub.supports}
                onToggleAim={toggleAim}
                getAimLevel={(label, type) => sub.aims.find(a => a.type === type && a.label === label)?.level}
                onSetAimLevel={(label, type, level) =>
                  onUpdate({ ...sub, aims: sub.aims.map(a => (a.type === type && a.label === label ? { ...a, level } : a)) })
                }
                onRemoveAim={(id) => onUpdate({ ...sub, aims: sub.aims.filter(a => a.id !== id) })}
                onTogglePractice={togglePractice}
                onRemovePractice={(id) => onUpdate({ ...sub, practices: sub.practices.filter(p => p.id !== id) })}
                onToggleSupport={toggleSupport}
                onRemoveSupport={(id) => onUpdate({ ...sub, supports: sub.supports.filter(s => s.id !== id) })}
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1 h-6 px-2"
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                data-testid={`button-view-full-${sub.id}`}
              >
                View full page <ChevronRight className="w-3 h-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[11px] text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 h-6 px-2"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                data-testid={`button-delete-subcomponent-${sub.id}`}
              >
                <Trash2 className="w-3 h-3" /> Remove
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

function SubcomponentDetailPage({ 
  sub, 
  parentTitle, 
  onBack, 
  onUpdate 
}: { 
  sub: DESubcomponent; 
  parentTitle: string; 
  onBack: () => void; 
  onUpdate: (updated: DESubcomponent) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState(sub.name);
  const [descVal, setDescVal] = useState(sub.description);

  useEffect(() => {
    setNameVal(sub.name);
    setDescVal(sub.description);
  }, [sub.name, sub.description]);

  const toggleAim = (label: string, type: TagType) => {
    const existing = sub.aims.find(a => a.label === label);
    if (existing) {
      onUpdate({ ...sub, aims: sub.aims.filter(a => a.id !== existing.id) });
    } else {
      onUpdate({ ...sub, aims: [...sub.aims, { id: generateId(), type, label, level: "Medium" }] });
    }
  };

  const togglePractice = (label: string) => {
    const existing = sub.practices.find(p => p.label === label);
    if (existing) {
      onUpdate({ ...sub, practices: sub.practices.filter(p => p.id !== existing.id) });
    } else {
      onUpdate({ ...sub, practices: [...sub.practices, { id: generateId(), type: "practice", label }] });
    }
  };

  const toggleSupport = (label: string) => {
    const existing = sub.supports.find(s => s.label === label);
    if (existing) {
      onUpdate({ ...sub, supports: sub.supports.filter(s => s.id !== existing.id) });
    } else {
      onUpdate({ ...sub, supports: [...sub.supports, { id: generateId(), type: "support", label }] });
    }
  };

  const saveName = () => {
    if (nameVal.trim()) onUpdate({ ...sub, name: nameVal.trim() });
    setEditingName(false);
  };

  const saveDesc = () => {
    onUpdate({ ...sub, description: descVal });
    setEditingDesc(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 space-y-8 pb-24 pt-6">
        <section className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input 
                    value={nameVal} 
                    onChange={(e) => setNameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameVal(sub.name); setEditingName(false); } }}
                    className="h-10 text-xl font-serif font-bold max-w-md"
                    autoFocus
                    data-testid="input-subcomponent-detail-name"
                  />
                  <Button size="sm" onClick={saveName}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => { setNameVal(sub.name); setEditingName(false); }}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-2xl font-serif font-bold text-gray-900" data-testid="text-subcomponent-detail-name">{sub.name}</h2>
                  <Button variant="ghost" size="sm" className="h-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingName(true)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2 max-w-2xl">
                <Textarea 
                  value={descVal} 
                  onChange={(e) => setDescVal(e.target.value)}
                  className="text-sm min-h-[80px]"
                  autoFocus
                  data-testid="input-subcomponent-detail-desc"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDesc}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => { setDescVal(sub.description); setEditingDesc(false); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2 max-w-2xl">
                <p className="text-gray-600 leading-relaxed" data-testid="text-subcomponent-detail-desc">
                  {sub.description || <span className="italic text-gray-400">Click to add a description...</span>}
                </p>
                <Button variant="ghost" size="sm" className="h-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => setEditingDesc(true)}>
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionHeader title="Featured Artifacts" />
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-4">
              {FEATURED_ARTIFACTS.slice(0, 2).map(artifact => (
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

        <section className="space-y-6">
          <SectionHeader title="Key Design Elements" />
          <CompactTagRow
            aims={sub.aims}
            practices={sub.practices}
            supports={sub.supports}
            onToggleAim={toggleAim}
            getAimLevel={(label, type) => sub.aims.find(a => a.type === type && a.label === label)?.level}
            onSetAimLevel={(label, type, level) =>
              onUpdate({ ...sub, aims: sub.aims.map(a => (a.type === type && a.label === label ? { ...a, level } : a)) })
            }
            onRemoveAim={(id) => onUpdate({ ...sub, aims: sub.aims.filter(a => a.id !== id) })}
            onTogglePractice={togglePractice}
            onRemovePractice={(id) => onUpdate({ ...sub, practices: sub.practices.filter(p => p.id !== id) })}
            onToggleSupport={toggleSupport}
            onRemoveSupport={(id) => onUpdate({ ...sub, supports: sub.supports.filter(s => s.id !== id) })}
          />
        </section>
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

  const aimLabels = aims.map(a => a.label);
  const practiceLabels = practices.map(p => p.label);
  const supportLabels = supports.map(s => s.label);

  const current = { aims, practices, supports };

  const toggleAim = (label: string, type: TagType) => {
    const exists = aims.some(a => a.label === label);
    if (exists) {
      onChange({ ...current, aims: aims.filter(a => a.label !== label) });
    } else {
      onChange({
        ...current,
        aims: [
          ...aims,
          { id: generateId(), type, label, level: null, levelMode: "auto", overrideLevel: null } as any,
        ],
      });
    }
  };

  const removeAim = (label: string) => {
    onChange({ ...current, aims: aims.filter(a => a.label !== label) });
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
          levelMode: "auto",
          overrideLevel: null,
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

export default function DesignedExperienceView({ nodeId, title, initialSubId, onSubIdConsumed, openSubId, onOpenSubIdChange }: { nodeId?: string, title?: string, initialSubId?: string | null, onSubIdConsumed?: () => void, openSubId?: string | null, onOpenSubIdChange?: (id: string | null) => void }) {
  const [description, setDescription] = useState("");
  const [keyDesignElements, setKeyDesignElements] = useState<KeyDesignElements>({ aims: [], practices: [], supports: [] });
  const [subcomponents, setSubcomponents] = useState<DESubcomponent[]>([]);
  const [portraitOfGraduate, setPortraitOfGraduate] = useState<PortraitOfGraduate>({ attributes: [], linksByAttributeId: {} });
  const [pogNav, setPogNav] = useState<{ mode: "hub" } | { mode: "detail"; attributeId: string } | { mode: "outcomesFirst" } | { mode: "all" }>({ mode: "hub" });
  const [pogReturnToDetailAttrId, setPogReturnToDetailAttrId] = useState<string | null>(null);
  const [pogOutcomesFirstDraft, setPogOutcomesFirstDraft] = useState<{ selectedKeys: string[]; step: 1 | 2 }>({ selectedKeys: [], step: 1 });
  const [loadedNodeId, setLoadedNodeId] = useState<string | null>(null);
  const [localOpenSubId, setLocalOpenSubId] = useState<string | null>(null);
  const [addingSubcomponent, setAddingSubcomponent] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [showOutcomeSummary, setShowOutcomeSummary] = useState(false);
  const [showOutcomeScore, setShowOutcomeScore] = useState(false);
  const [selectedOutcomeLabel, setSelectedOutcomeLabel] = useState<string | null>(null);
  const [supportNav, setSupportNav] = useState<
    | { mode: "none" }
    | { mode: "hub" }
    | { mode: "group"; groupKey: SupportGroupKey }
    | { mode: "detail"; groupKey: SupportGroupKey; label: string; backTo: "hub" | "group" }
  >({ mode: "none" });

  const activeSubId = openSubId !== undefined ? openSubId : localOpenSubId;
  const setActiveSubId = (id: string | null) => {
    if (onOpenSubIdChange) onOpenSubIdChange(id);
    else setLocalOpenSubId(id);
  };

  const { data: componentData } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const { data: allComponents } = useQuery(componentQueries.all);
  const updateMutation = useUpdateComponent();
  const deRef = useRef<DesignedExperienceData>({});
  const isOverall = String(nodeId || "") === "overall" || String((componentData as any)?.nodeId || "") === "overall";

  useEffect(() => {
    deRef.current = (componentData as any)?.designedExperienceData || {};
  }, [componentData]);

  useEffect(() => {
    if (!nodeId || !componentData) return;
    // Only hydrate local state once per nodeId; otherwise refetches from our own PATCHes
    // will overwrite local state and can cause save/refetch loops.
    if (loadedNodeId === nodeId) return;
    const de: DesignedExperienceData = (componentData as any).designedExperienceData || {};
    setDescription(de.description || "");
    setKeyDesignElements(de.keyDesignElements || { aims: [], practices: [], supports: [] });
    setSubcomponents((de.subcomponents || []).map((s: any) => ({
      ...s,
      id: s.id || generateId(),
      aims: s.aims || [],
      practices: s.practices || [],
      supports: s.supports || [],
    })));
    setPortraitOfGraduate(normalizePortrait((de as any)?.portraitOfGraduate));
    setPogReturnToDetailAttrId(null);
    setPogOutcomesFirstDraft({ selectedKeys: [], step: 1 });
    setPogNav({ mode: "hub" });
    setLoadedNodeId(nodeId);
  }, [componentData, loadedNodeId, nodeId]);

  useEffect(() => {
    if (!isOverall) return;
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
    if (initialSubId && subcomponents.length > 0) {
      const found = subcomponents.find(s => s.id === initialSubId);
      if (found) {
        setActiveSubId(initialSubId);
        onSubIdConsumed?.();
      }
    }
  }, [initialSubId, subcomponents]);

  const saveData = useCallback(() => {
    if (!nodeId) return;
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

    const syncedDe = isOverall ? syncKeyAimsOutcomesFromPortrait({ keyDesignElements: keyDesignElementsWithLevels }, portraitOfGraduate) : { keyDesignElements: keyDesignElementsWithLevels };
    const keyDesignElementsToSave = (syncedDe as any)?.keyDesignElements || keyDesignElementsWithLevels;
    const designedExperienceData: DesignedExperienceData = {
      ...(deRef.current || {}),
      description,
      keyDesignElements: keyDesignElementsToSave,
      subcomponents,
      portraitOfGraduate: isOverall ? portraitOfGraduate : (deRef.current as any)?.portraitOfGraduate,
    };
    updateMutation.mutate({ nodeId, data: { designedExperienceData } });
  }, [nodeId, description, isOverall, keyDesignElements, portraitOfGraduate, subcomponents, updateMutation, allComponents]);

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
  }, [description, isOverall, keyDesignElements, portraitOfGraduate, subcomponents, supportNav.mode]);

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

  const deleteSubcomponent = (id: string) => {
    setSubcomponents(prev => prev.filter(s => s.id !== id));
    if (activeSubId === id) setActiveSubId(null);
  };

  const openSub = activeSubId ? subcomponents.find(s => s.id === activeSubId) : null;
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
    return <OutcomeScoreView nodeId={nodeId} title={title} onBack={() => setShowOutcomeScore(false)} />;
  }

  if (selectedOutcomeLabel) {
    return (
      <OutcomeDetailView
        nodeId={nodeId}
        title={title}
        outcomeLabel={selectedOutcomeLabel}
        onBack={() => setSelectedOutcomeLabel(null)}
        onOpenOutcomeScore={() => setShowOutcomeScore(true)}
      />
    );
  }

  if (showOutcomeSummary) {
    return (
      <OutcomeSummaryView
        nodeId={nodeId}
        title={title}
        onBack={() => {
          const latestDe: any = (componentData as any)?.designedExperienceData || {};
          const latestKde = latestDe?.keyDesignElements || { aims: [], practices: [], supports: [] };
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
      <div className="p-6">
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
          onOpenOutcome={(label) => setSelectedOutcomeLabel(label)}
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

  if (isOverall && pogNav.mode === "all") {
    return (
      <div className="p-6">
        <PogAttributesOverviewView
          portrait={portraitOfGraduate}
          onBack={() => setPogNav({ mode: "hub" })}
          onOpenAttribute={(attributeId) => setPogNav({ mode: "detail", attributeId })}
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

  if (openSub) {
    return (
      <SubcomponentDetailPage
        sub={openSub}
        parentTitle={title || "Component"}
        onBack={() => setActiveSubId(null)}
        onUpdate={(updated) => updateSubcomponent(updated)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 space-y-8 pb-24 pt-6">
        
        <section className="space-y-4">
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

        <KeyDesignElementsSummary
          nodeId={nodeId}
          isOverall={isOverall}
          allComponents={(allComponents as any[]) || []}
          subcomponents={subcomponents}
          elements={keyDesignElements}
          onChange={setKeyDesignElements}
          onViewOutcomes={() => setShowOutcomeSummary(true)}
          onOpenOutcome={(label) => setSelectedOutcomeLabel(label)}
          onViewSupports={() => setSupportNav({ mode: "hub" })}
        />

        <section className="mb-6">
          {isOverall ? (
            <PogHubView
              portrait={portraitOfGraduate}
              onChange={setPortraitOfGraduate}
              onOpenAttribute={(attributeId) => setPogNav({ mode: "detail", attributeId })}
              onViewAll={() => setPogNav({ mode: "all" })}
              onStartWithOutcomes={() => {
                setPogReturnToDetailAttrId(null);
                setPogOutcomesFirstDraft((prev) => {
                  const merged = new Set<string>([...prev.selectedKeys, ...linkedPogOutcomeKeys]);
                  return { ...prev, selectedKeys: Array.from(merged) };
                });
                setPogNav({ mode: "outcomesFirst" });
              }}
            />
          ) : (
            <>
              <SectionHeader
                title="Subcomponents"
                count={subcomponents.length}
                onAdd={() => setAddingSubcomponent(true)}
              />

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
                          if (e.key === "Escape") {
                            setNewSubName("");
                            setAddingSubcomponent(false);
                          }
                        }}
                        placeholder="Subcomponent name..."
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        data-testid="input-new-subcomponent-name"
                      />
                      <Button size="sm" className="h-8" onClick={addSubcomponent} data-testid="button-confirm-add-subcomponent">
                        Add
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => { setNewSubName(""); setAddingSubcomponent(false); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {subcomponents.length === 0 && !addingSubcomponent && (
                <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <div className="text-gray-400 mb-3">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No subcomponents yet</p>
                    <p className="text-xs mt-1">Add subcomponents to define the detailed experiences within this component.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => setAddingSubcomponent(true)}
                  >
                    <Plus className="w-3 h-3" /> Add First Subcomponent
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {subcomponents.map((sub) => (
                  <SubcomponentCard
                    key={sub.id}
                    sub={sub}
                    onUpdate={updateSubcomponent}
                    onDelete={() => deleteSubcomponent(sub.id)}
                    onOpen={() => setActiveSubId(sub.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
