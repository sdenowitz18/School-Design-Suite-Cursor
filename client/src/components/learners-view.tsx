import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateComponent } from "@/lib/api";
import { useMergedComponent } from "@/lib/useMergedComponent";
import { PlainLanguageInput } from "@/components/expert-view/PlainLanguageInput";
import { PrimaryTagPill } from "@/components/expert-view/PrimaryTagPill";
import { TagNoteBlock } from "@/components/expert-view/TagNoteBlock";
import {
  LEARNER_SECTIONS,
  formatLearnerSelectionPreview,
  learnerSelectionIsKey,
  type LearnerBucketDef,
  type LearnerPrimaryDef,
  type LearnerSectionDef,
} from "./learner-design-schema";

export interface LearnerSelection {
  primaryId: string;
  secondaryIds?: string[];
  /** Notes when no secondary refinements (A-1 primary note block). */
  description?: string;
  /** When secondaries are selected, notes per secondary id. */
  secondaryNotes?: Record<string, string>;
  /** Key at primary level when there are no secondary refinements. */
  isKey?: boolean;
  /** When secondaries are selected, key is per refinement (A-1 / Key Design Elements). */
  secondaryKeys?: Record<string, boolean>;
}

export interface LearnersProfile {
  selections: LearnerSelection[];
  sectionPlainText?: Record<string, string>;
}

function findPrimary(primaryId: string): LearnerPrimaryDef | undefined {
  for (const sec of LEARNER_SECTIONS) {
    for (const b of sec.buckets) {
      const p = b.primaries.find((x) => x.id === primaryId);
      if (p) return p;
    }
  }
  return undefined;
}

function secondaryLabel(primary: LearnerPrimaryDef, secondaryId: string): string {
  return primary.secondaries?.find((s) => s.id === secondaryId)?.label ?? secondaryId;
}

/** Persist learners profile on a ring component subcomponent (nested in `designedExperienceData.subcomponents`). */
export type LearnersSubProfileContext = { parentNodeId: string; subId: string };

export interface LearnersEditorProps {
  nodeId?: string;
  title?: string;
  variant?: "expert" | "standalone";
  subProfileContext?: LearnersSubProfileContext | null;
}

export function LearnersEditor({ nodeId, title, variant = "standalone", subProfileContext = null }: LearnersEditorProps) {
  const effectiveNodeId = subProfileContext?.parentNodeId ?? nodeId;
  const comp = useMergedComponent(effectiveNodeId);
  const updateMutation = useUpdateComponent();

  const serverProfile = useMemo((): LearnersProfile => {
    const de: any = (comp as any)?.designedExperienceData || {};
    if (subProfileContext) {
      const subs = de.subcomponents || [];
      const sub = subs.find((s: any) => s.id === subProfileContext.subId);
      const lp = sub?.learnersProfile;
      if (lp && Array.isArray(lp.selections)) {
        const spt = lp.sectionPlainText;
        return {
          selections: lp.selections,
          sectionPlainText:
            spt && typeof spt === "object" && !Array.isArray(spt) ? { ...spt } : {},
        };
      }
      return { selections: [], sectionPlainText: {} };
    }
    const lp = de.learnersProfile;
    if (lp && Array.isArray(lp.selections)) {
      const spt = lp.sectionPlainText;
      return {
        selections: lp.selections,
        sectionPlainText:
          spt && typeof spt === "object" && !Array.isArray(spt) ? { ...spt } : {},
      };
    }
    return { selections: [], sectionPlainText: {} };
  }, [comp, subProfileContext]);

  const selections = serverProfile.selections;
  const sectionPlainText = serverProfile.sectionPlainText ?? {};

  const writeProfile = useCallback(
    (next: LearnerSelection[]) => {
      if (subProfileContext) {
        const de: any = (comp as any)?.designedExperienceData || {};
        const subs = [...(de.subcomponents || [])];
        const idx = subs.findIndex((s: any) => s.id === subProfileContext.subId);
        if (idx < 0) return;
        const prevLp = subs[idx].learnersProfile || {};
        const sub = {
          ...subs[idx],
          learnersProfile: { ...prevLp, selections: next },
        };
        subs[idx] = sub;
        updateMutation.mutate({
          nodeId: subProfileContext.parentNodeId,
          data: { designedExperienceData: { ...de, subcomponents: subs } },
        });
        return;
      }
      if (!nodeId) return;
      const de: any = (comp as any)?.designedExperienceData || {};
      const prevLp = de.learnersProfile || {};
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            learnersProfile: {
              ...prevLp,
              selections: next,
            },
          },
        },
      });
    },
    [nodeId, comp, updateMutation, subProfileContext],
  );

  const setSectionPlainText = useCallback(
    (sectionId: string, text: string) => {
      if (subProfileContext) {
        const de: any = (comp as any)?.designedExperienceData || {};
        const subs = [...(de.subcomponents || [])];
        const idx = subs.findIndex((s: any) => s.id === subProfileContext.subId);
        if (idx < 0) return;
        const prevLp = subs[idx].learnersProfile || {};
        const basePlain =
          prevLp.sectionPlainText && typeof prevLp.sectionPlainText === "object" && !Array.isArray(prevLp.sectionPlainText)
            ? prevLp.sectionPlainText
            : {};
        const nextPlain = { ...basePlain, [sectionId]: text };
        const sub = {
          ...subs[idx],
          learnersProfile: {
            ...prevLp,
            selections: Array.isArray(prevLp.selections) ? prevLp.selections : [],
            sectionPlainText: nextPlain,
          },
        };
        subs[idx] = sub;
        updateMutation.mutate({
          nodeId: subProfileContext.parentNodeId,
          data: { designedExperienceData: { ...de, subcomponents: subs } },
        });
        return;
      }
      if (!nodeId) return;
      const de: any = (comp as any)?.designedExperienceData || {};
      const prevLp = de.learnersProfile || {};
      const basePlain =
        prevLp.sectionPlainText && typeof prevLp.sectionPlainText === "object" && !Array.isArray(prevLp.sectionPlainText)
          ? prevLp.sectionPlainText
          : {};
      const nextPlain = { ...basePlain, [sectionId]: text };
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            learnersProfile: {
              ...prevLp,
              selections: Array.isArray(prevLp.selections) ? prevLp.selections : [],
              sectionPlainText: nextPlain,
            },
          },
        },
      });
    },
    [nodeId, comp, updateMutation, subProfileContext],
  );

  const isPrimarySelected = (primaryId: string) => selections.some((s) => s.primaryId === primaryId);
  const getSelection = (primaryId: string) => selections.find((s) => s.primaryId === primaryId);

  function togglePrimary(primaryId: string) {
    const p = findPrimary(primaryId);
    if (!p) return;
    if (isPrimarySelected(primaryId)) {
      writeProfile(selections.filter((s) => s.primaryId !== primaryId));
    } else {
      writeProfile([
        ...selections,
        {
          primaryId,
          secondaryIds: p.secondaries?.length ? [] : undefined,
          description: "",
          isKey: false,
        },
      ]);
    }
  }

  function toggleSecondary(primaryId: string, secondaryId: string) {
    const sel = getSelection(primaryId);
    if (!sel) return;
    const cur = sel.secondaryIds ?? [];
    const removing = cur.includes(secondaryId);
    const nextSec = removing ? cur.filter((id) => id !== secondaryId) : [...cur, secondaryId];
    writeProfile(
      selections.map((s) => {
        if (s.primaryId !== primaryId) return s;
        const next: LearnerSelection = {
          ...s,
          secondaryIds: nextSec.length ? nextSec : undefined,
        };
        if (nextSec.length > 0) {
          next.isKey = false;
        }
        if (removing) {
          const sk = { ...(s.secondaryKeys ?? {}) };
          delete sk[secondaryId];
          next.secondaryKeys = Object.keys(sk).length ? sk : undefined;
        }
        return next;
      }),
    );
  }

  function toggleSecondaryKey(primaryId: string, secondaryId: string) {
    writeProfile(
      selections.map((s) => {
        if (s.primaryId !== primaryId) return s;
        const sk = { ...(s.secondaryKeys ?? {}) };
        if (sk[secondaryId]) {
          delete sk[secondaryId];
        } else {
          sk[secondaryId] = true;
        }
        return { ...s, secondaryKeys: Object.keys(sk).length ? sk : undefined };
      }),
    );
  }

  function setDescription(primaryId: string, text: string) {
    writeProfile(selections.map((s) => (s.primaryId === primaryId ? { ...s, description: text } : s)));
  }

  function setSecondaryNote(primaryId: string, secondaryId: string, text: string) {
    writeProfile(
      selections.map((s) => {
        if (s.primaryId !== primaryId) return s;
        const nextNotes = { ...(s.secondaryNotes ?? {}), [secondaryId]: text };
        return { ...s, secondaryNotes: nextNotes };
      }),
    );
  }

  function toggleKey(primaryId: string) {
    writeProfile(selections.map((s) => (s.primaryId === primaryId ? { ...s, isKey: !s.isKey } : s)));
  }

  const summaryBlock =
    variant === "expert" ? (
      <div className="rounded-xl border border-purple-100 bg-purple-50/40 px-4 py-3 space-y-2">
        <p className="text-xs text-gray-600 leading-relaxed">
          Plain language per question, then tags like Key Design Elements. Mark Key on the primary when there are no
          refinements; with refinements (e.g. Geography → Rural), mark Key on each secondary. Notes sit below the grid.
        </p>
        {selections.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selections.map((sel) => (
              <span
                key={sel.primaryId}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium",
                  sel.isKey
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-white border-purple-200 text-purple-900",
                )}
              >
                {sel.isKey && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                {formatLearnerSelectionPreview(sel)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No tags selected yet — use the sections below.</p>
        )}
      </div>
    ) : (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Learners</h2>
          {(title || (comp as any)?.title) && (
            <p className="text-sm text-gray-500 mt-0.5">{title || (comp as any)?.title}</p>
          )}
        </div>
        <div className="px-5 py-2.5 text-xs text-gray-500 border-b border-gray-100">
          Same idea as Key Design Elements: plain language for each question, then pill tags. Click the section number to
          collapse or expand the choice buckets. Notes for selected tags appear in a section below the tags.
        </div>
        {selections.length > 0 ? (
          <div className="px-5 py-3 flex flex-wrap gap-1.5 border-b border-gray-100">
            {selections.map((sel) => (
              <span
                key={sel.primaryId}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium",
                  learnerSelectionIsKey(sel)
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800",
                )}
              >
                {learnerSelectionIsKey(sel) && (
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                )}
                {formatLearnerSelectionPreview(sel)}
              </span>
            ))}
          </div>
        ) : (
          <div className="px-5 py-3 text-xs text-gray-400 italic border-b border-gray-100">
            No learner tags selected yet — use the sections below.
          </div>
        )}
      </div>
    );

  return (
    <div className={cn("space-y-5", variant === "standalone" && "max-w-3xl mx-auto p-6 pb-16")} data-testid="learners-editor">
      {summaryBlock}

      <div className="space-y-4">
        {LEARNER_SECTIONS.map((section) => {
          const sectionIndex = LEARNER_SECTIONS.findIndex((s) => s.id === section.id) + 1;
          return (
            <SectionBlock
              key={section.id}
              section={section}
              sectionIndex={sectionIndex}
              variant={variant}
              plainValue={sectionPlainText[section.id] ?? ""}
              onPlainChange={(v) => setSectionPlainText(section.id, v)}
              isPrimarySelected={isPrimarySelected}
              getSelection={getSelection}
              togglePrimary={togglePrimary}
              toggleSecondary={toggleSecondary}
              setDescription={setDescription}
              setSecondaryNote={setSecondaryNote}
              toggleKey={toggleKey}
              toggleSecondaryKey={toggleSecondaryKey}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function LearnersView({
  nodeId,
  title,
  onBack,
  subProfileContext,
  hideShellBackButton = false,
}: {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  subProfileContext?: LearnersSubProfileContext | null;
  hideShellBackButton?: boolean;
}) {
  return (
    <div data-testid="learners-view">
      {!hideShellBackButton ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group px-6 pt-6"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      ) : null}
      <LearnersEditor nodeId={nodeId} title={title} variant="standalone" subProfileContext={subProfileContext} />
    </div>
  );
}

function SectionBlock({
  section,
  sectionIndex,
  variant: _variant,
  plainValue,
  onPlainChange,
  isPrimarySelected,
  getSelection,
  togglePrimary,
  toggleSecondary,
  setDescription,
  setSecondaryNote,
  toggleKey,
  toggleSecondaryKey,
}: {
  section: LearnerSectionDef;
  sectionIndex: number;
  variant: "expert" | "standalone";
  plainValue: string;
  onPlainChange: (v: string) => void;
  isPrimarySelected: (id: string) => boolean;
  getSelection: (id: string) => LearnerSelection | undefined;
  togglePrimary: (id: string) => void;
  toggleSecondary: (pid: string, sid: string) => void;
  setDescription: (pid: string, text: string) => void;
  setSecondaryNote: (pid: string, sid: string, text: string) => void;
  toggleKey: (pid: string) => void;
  toggleSecondaryKey: (pid: string, sid: string) => void;
}) {
  const [bucketsCollapsed, setBucketsCollapsed] = useState(false);

  return (
    <div className="space-y-5">
      {/* Question header — inline, no card (matches Key Design Elements / QuestionSection) */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setBucketsCollapsed((c) => !c)}
          className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-0.5 hover:bg-purple-200 transition-colors cursor-pointer"
          title={bucketsCollapsed ? "Expand choice buckets" : "Collapse choice buckets"}
        >
          {sectionIndex}
        </button>
        <p className="text-sm font-medium text-gray-800 leading-relaxed pt-0.5">{section.setOfDesignChoices}</p>
      </div>

      {/* Plain language input — bare textarea, directly under question */}
      <PlainLanguageInput value={plainValue} onChange={onPlainChange} />

      {/* Choice buckets — each its own card */}
      {!bucketsCollapsed && (
        <div className="space-y-3">
          {section.buckets.map((bucket) => (
            <BucketCard
              key={bucket.id}
              bucket={bucket}
              isPrimarySelected={isPrimarySelected}
              getSelection={getSelection}
              togglePrimary={togglePrimary}
              toggleSecondary={toggleSecondary}
              setDescription={setDescription}
              setSecondaryNote={setSecondaryNote}
              toggleKey={toggleKey}
              toggleSecondaryKey={toggleSecondaryKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BucketCard({
  bucket,
  isPrimarySelected,
  getSelection,
  togglePrimary,
  toggleSecondary,
  setDescription,
  setSecondaryNote,
  toggleKey,
  toggleSecondaryKey,
}: {
  bucket: LearnerBucketDef;
  isPrimarySelected: (id: string) => boolean;
  getSelection: (id: string) => LearnerSelection | undefined;
  togglePrimary: (id: string) => void;
  toggleSecondary: (pid: string, sid: string) => void;
  setDescription: (pid: string, text: string) => void;
  setSecondaryNote: (pid: string, sid: string, text: string) => void;
  toggleKey: (pid: string) => void;
  toggleSecondaryKey: (pid: string, sid: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const noteRows: React.ReactNode[] = [];
  for (const primary of bucket.primaries) {
    const sel = getSelection(primary.id);
    if (!sel) continue;
    const secIds = sel.secondaryIds ?? [];
    if (secIds.length === 0) {
      noteRows.push(
        <TagNoteBlock
          key={`n-${primary.id}-p`}
          label={primary.label}
          isPrimary
          isKey={!!sel.isKey}
          notes={sel.description ?? ""}
          onKeyToggle={() => toggleKey(primary.id)}
          onNotesChange={(v) => setDescription(primary.id, v)}
        />,
      );
    } else {
      for (const sid of secIds) {
        noteRows.push(
          <TagNoteBlock
            key={`n-${primary.id}-${sid}`}
            label={secondaryLabel(primary, sid)}
            isPrimary={false}
            isKey={!!sel.secondaryKeys?.[sid]}
            notes={sel.secondaryNotes?.[sid] ?? ""}
            onKeyToggle={() => toggleSecondaryKey(primary.id, sid)}
            onNotesChange={(v) => setSecondaryNote(primary.id, sid, v)}
          />,
        );
      }
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 text-left group"
        title={collapsed ? "Expand bucket" : "Collapse bucket"}
      >
        <h4 className="text-sm font-semibold text-gray-900">{bucket.title}</h4>
        <ChevronDown
          className={cn(
            "w-4 h-4 shrink-0 text-gray-400 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>

      {!collapsed && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {bucket.primaries.map((primary) => {
              const selected = isPrimarySelected(primary.id);
              const sel = getSelection(primary.id);
              const pillSel = selected && sel
                ? {
                    isKey: !!sel.isKey,
                    selectedSecondaryIds: sel.secondaryIds ?? [],
                    secondaryKeys: sel.secondaryKeys,
                  }
                : null;
              return (
                <PrimaryTagPill
                  key={primary.id}
                  label={primary.label}
                  secondaries={primary.secondaries}
                  selection={pillSel}
                  onToggle={() => togglePrimary(primary.id)}
                  onKeyToggle={() => toggleKey(primary.id)}
                  onSecondaryToggle={(secId) => toggleSecondary(primary.id, secId)}
                  onSecondaryKeyToggle={(secId) => toggleSecondaryKey(primary.id, secId)}
                  starMode="a1"
                />
              );
            })}
          </div>

          {noteRows.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notes on selected tags</p>
              <div className="space-y-2">{noteRows}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
