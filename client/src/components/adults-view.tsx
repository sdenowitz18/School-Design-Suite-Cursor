import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateComponent } from "@/lib/api";
import { useMergedComponent } from "@/lib/useMergedComponent";
import { PlainLanguageInput } from "@/components/expert-view/PlainLanguageInput";
import { PrimaryTagPill } from "@/components/expert-view/PrimaryTagPill";
import { A1Bucket } from "@/components/expert-view/A1Bucket";
import { TAGS_FAC_BACKGROUND } from "@/components/expert-view/facilitator-element-schema";
import type { A1Value, BucketDef, SecondarySelection, TagSelection } from "@/components/expert-view/expert-view-types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  ADULT_ROLE_SECTIONS,
  adultLeafChipsFromSelections,
  adultSliceKeysFromSelections,
  formatAdultSliceTitle,
  findAdultPrimary,
} from "./adult-design-schema";
import { learnerDemographicPrimariesAsTagDefs } from "./learner-design-schema";
import type { LearnerSelection } from "./learners-view";

export type AdultSelection = LearnerSelection;

const ADULT_Q2_QUESTION = "What other information about adults do you want to specify/design?";

/** Section heading for Q2 — plain typography only (no card). */
const ADULT_DEFINE_DETAIL_HEADING = "Define your adults in more detail";

function adultSliceSectionDomId(sliceKey: string) {
  return `adult-slice-${sliceKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

const DEMOGRAPHICS_BUCKET: BucketDef = {
  id: "adult-demographics",
  title: "Demographic & situational factors",
  archetype: "A1",
  customAllowed: true,
  tags: learnerDemographicPrimariesAsTagDefs(),
};

export interface AdultSliceDetail {
  /** Plain language for this stakeholder group only — maps to the buckets below for this slice. */
  plainLanguage?: string;
  /** A1-style demographics (same tag set as learners; includes custom + per-tag notes). */
  demographicsA1?: A1Value;
  /** @deprecated migrated to demographicsA1 on read */
  demographicSelections?: LearnerSelection[];
  incomingSkills?: { text: string; isKey?: boolean };
  background?: A1Value;
  staffing?: { text: string; isKey?: boolean };
}

export interface AdultsProfile {
  selections: AdultSelection[];
  sliceDetail?: Record<string, AdultSliceDetail>;
  /** Plain language for Q1 (adult roles). */
  q1PlainText?: string;
  /**
   * Legacy: single Q2 plain-language field before per-slice `plainLanguage`.
   * Shown only when a slice has no `plainLanguage` yet.
   */
  q2PlainText?: string;
}

const ADULT_BACKGROUND_BUCKET: BucketDef = {
  id: "adult-background",
  title: "Adult background",
  archetype: "A1",
  customAllowed: true,
  tags: TAGS_FAC_BACKGROUND,
};

function emptyA1(): A1Value {
  return { selections: [] };
}

function learnerSelectionsToA1Value(rows: LearnerSelection[]): A1Value {
  return {
    selections: rows.map(
      (sel): TagSelection => ({
        tagId: sel.primaryId,
        isKey: sel.isKey ?? false,
        notes: sel.description ?? "",
        selectedSecondaries: (sel.secondaryIds ?? []).map(
          (sid): SecondarySelection => ({
            tagId: sid,
            isKey: !!(sel.secondaryKeys?.[sid]),
            notes: sel.secondaryNotes?.[sid] ?? "",
          }),
        ),
      }),
    ),
  };
}

function normalizeSliceDetail(raw: AdultSliceDetail | undefined): AdultSliceDetail {
  if (!raw || typeof raw !== "object") return {};
  const out: AdultSliceDetail = { ...raw };
  const legacy = raw.demographicSelections;
  if (!out.demographicsA1?.selections?.length && Array.isArray(legacy) && legacy.length > 0) {
    out.demographicsA1 = learnerSelectionsToA1Value(legacy);
  }
  return out;
}

const bucketTriggerClass =
  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left bg-gray-50/80 border-b border-gray-100 hover:bg-gray-50 transition-colors [&[data-state=open]>svg]:rotate-180";

function AdultSliceSection({
  sliceKey,
  detail,
  legacyQ2PlainText,
  onChangeDetail,
  layout = "collapsible",
}: {
  sliceKey: string;
  detail: AdultSliceDetail;
  /** Shown in the plain-language field until this slice has its own `plainLanguage`. */
  legacyQ2PlainText?: string;
  onChangeDetail: (patch: Partial<AdultSliceDetail>) => void;
  /** `page` = dedicated full-page editor (no outer accordion). */
  layout?: "collapsible" | "page";
}) {
  const [roleOpen, setRoleOpen] = useState(true);
  const title = formatAdultSliceTitle(sliceKey);
  const plainLanguageValue =
    detail.plainLanguage !== undefined ? detail.plainLanguage : legacyQ2PlainText ?? "";

  const body = (
    <div className={cn("space-y-4", layout === "page" ? "" : "p-4")}>
      <PlainLanguageInput
        value={plainLanguageValue}
        onChange={(text) => onChangeDetail({ plainLanguage: text })}
        placeholder="Describe what you want to specify for this stakeholder group — optional; later this can help map to the fields below."
      />

      <Collapsible defaultOpen className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <CollapsibleTrigger className={bucketTriggerClass}>
              <span className="text-xs font-semibold text-gray-800">Demographic &amp; situational factors</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-100 bg-white">
                <p className="text-[11px] text-gray-500">Same tag set as Learners — independent saved state for adults.</p>
                <A1Bucket
                  bucket={DEMOGRAPHICS_BUCKET}
                  value={detail.demographicsA1 ?? emptyA1()}
                  onChange={(v) => onChangeDetail({ demographicsA1: v })}
                  componentType="center"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <CollapsibleTrigger className={bucketTriggerClass}>
              <span className="text-xs font-semibold text-gray-800">Incoming skills, knowledge, &amp; mindsets</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-2 space-y-2 border-t border-gray-100 bg-white">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeDetail({
                        incomingSkills: {
                          text: detail.incomingSkills?.text ?? "",
                          isKey: !detail.incomingSkills?.isKey,
                        },
                      });
                    }}
                    className={cn(
                      "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors",
                      detail.incomingSkills?.isKey
                        ? "bg-amber-50 text-amber-900 border-amber-200"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50",
                    )}
                  >
                    <Star className={cn("w-3 h-3", detail.incomingSkills?.isKey ? "fill-amber-500 text-amber-500" : "text-gray-300")} />
                    Key
                  </button>
                </div>
                <Textarea
                  value={detail.incomingSkills?.text ?? ""}
                  onChange={(e) =>
                    onChangeDetail({
                      incomingSkills: {
                        text: e.target.value,
                        isKey: detail.incomingSkills?.isKey,
                      },
                    })
                  }
                  placeholder="Free text — prior knowledge, mindsets, relevant experience…"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <CollapsibleTrigger className={bucketTriggerClass}>
              <span className="text-xs font-semibold text-gray-800">Adult background</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-100 bg-white">
                <p className="text-[11px] text-gray-500">Same taxonomy as Facilitator → Facilitator background and allocation (separate saved state).</p>
                <A1Bucket
                  bucket={ADULT_BACKGROUND_BUCKET}
                  value={detail.background ?? emptyA1()}
                  onChange={(v) => onChangeDetail({ background: v })}
                  componentType="center"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <CollapsibleTrigger className={bucketTriggerClass}>
              <span className="text-xs font-semibold text-gray-800">Approach to staffing</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 pt-2 space-y-2 border-t border-gray-100 bg-white">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeDetail({
                        staffing: {
                          text: detail.staffing?.text ?? "",
                          isKey: !detail.staffing?.isKey,
                        },
                      });
                    }}
                    className={cn(
                      "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors",
                      detail.staffing?.isKey
                        ? "bg-amber-50 text-amber-900 border-amber-200"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50",
                    )}
                  >
                    <Star className={cn("w-3 h-3", detail.staffing?.isKey ? "fill-amber-500 text-amber-500" : "text-gray-300")} />
                    Key
                  </button>
                </div>
                <Textarea
                  value={detail.staffing?.text ?? ""}
                  onChange={(e) =>
                    onChangeDetail({
                      staffing: {
                        text: e.target.value,
                        isKey: detail.staffing?.isKey,
                      },
                    })
                  }
                  placeholder="How staffing works for this role in this component…"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
    </div>
  );

  if (layout === "page") {
    return (
      <div className="space-y-4" id={adultSliceSectionDomId(sliceKey)}>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Plain language and structured buckets for this role — saved with your design.
          </p>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Collapsible open={roleOpen} onOpenChange={setRoleOpen} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <CollapsibleTrigger
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left bg-sky-50/40 border-b border-gray-100 hover:bg-sky-50/70 transition-colors [&[data-state=open]>svg]:rotate-180"
        id={adultSliceSectionDomId(sliceKey)}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Plain language + choice buckets — expand or collapse this role</p>
        </div>
        <ChevronDown className="w-4 h-4 shrink-0 text-gray-500 transition-transform" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>{body}</CollapsibleContent>
    </Collapsible>
  );
}

export type AdultsSubProfileContext = { parentNodeId: string; subId: string };

export function AdultsEditor({
  nodeId,
  title,
  variant = "standalone",
  subProfileContext = null,
  focusedSliceKey = null,
  onFocusedSliceKeyChange,
}: {
  nodeId?: string;
  title?: string;
  variant?: "expert" | "standalone";
  subProfileContext?: AdultsSubProfileContext | null;
  /** When set (standalone), editor shows a dedicated page for this slice only. */
  focusedSliceKey?: string | null;
  onFocusedSliceKeyChange?: (key: string | null) => void;
}) {
  const effectiveNodeId = subProfileContext?.parentNodeId ?? nodeId;
  const comp = useMergedComponent(effectiveNodeId);
  const updateMutation = useUpdateComponent();

  const [q1Open, setQ1Open] = useState(true);

  const serverProfile = useMemo((): AdultsProfile => {
    const de: any = (comp as any)?.designedExperienceData || {};
    const readAp = (): any => {
      if (subProfileContext) {
        const subs = de.subcomponents || [];
        const sub = subs.find((s: any) => s.id === subProfileContext.subId);
        return sub?.adultsProfile;
      }
      return de.adultsProfile;
    };
    const ap = readAp();
    if (ap && typeof ap === "object" && !Array.isArray(ap)) {
      const selections = Array.isArray(ap.selections) ? ap.selections : [];
      const sd = ap.sliceDetail;
      const rawDetail =
        sd && typeof sd === "object" && !Array.isArray(sd) ? { ...sd } : {};
      const normalizedDetail: Record<string, AdultSliceDetail> = {};
      for (const [k, v] of Object.entries(rawDetail)) {
        normalizedDetail[k] = normalizeSliceDetail(v as AdultSliceDetail);
      }
      return {
        selections,
        sliceDetail: normalizedDetail,
        q1PlainText: typeof ap.q1PlainText === "string" ? ap.q1PlainText : "",
        q2PlainText: typeof ap.q2PlainText === "string" ? ap.q2PlainText : "",
      };
    }
    return { selections: [], sliceDetail: {}, q1PlainText: "", q2PlainText: "" };
  }, [comp, subProfileContext]);

  const selections = serverProfile.selections;
  const sliceDetail = serverProfile.sliceDetail ?? {};
  const q1PlainText = serverProfile.q1PlainText ?? "";
  /** Fallback when a slice has no `plainLanguage` yet (legacy saved data). */
  const legacyQ2PlainText = serverProfile.q2PlainText ?? "";

  const writeProfile = useCallback(
    (patch: Partial<AdultsProfile> & { selections?: AdultSelection[] }) => {
      const de: any = (comp as any)?.designedExperienceData || {};
      if (subProfileContext) {
        const subs = [...(de.subcomponents || [])];
        const idx = subs.findIndex((s: any) => s.id === subProfileContext.subId);
        if (idx < 0) return;
        const prevAp = subs[idx].adultsProfile || {};
        const nextSelections = patch.selections ?? prevAp.selections ?? [];
        const validKeys = new Set(adultSliceKeysFromSelections(nextSelections));
        const baseDetail =
          patch.sliceDetail ??
          (prevAp.sliceDetail && typeof prevAp.sliceDetail === "object" ? prevAp.sliceDetail : {});
        const pruned: Record<string, AdultSliceDetail> = {};
        for (const k of Array.from(validKeys)) {
          if (baseDetail[k]) pruned[k] = normalizeSliceDetail(baseDetail[k]);
        }
        const sub = {
          ...subs[idx],
          adultsProfile: {
            ...prevAp,
            selections: nextSelections,
            sliceDetail: pruned,
            q1PlainText: patch.q1PlainText ?? prevAp.q1PlainText ?? "",
            q2PlainText: patch.q2PlainText ?? prevAp.q2PlainText ?? "",
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
      const prevAp = de.adultsProfile || {};
      const nextSelections = patch.selections ?? prevAp.selections ?? [];
      const validKeys = new Set(adultSliceKeysFromSelections(nextSelections));
      const baseDetail =
        patch.sliceDetail ??
        (prevAp.sliceDetail && typeof prevAp.sliceDetail === "object" ? prevAp.sliceDetail : {});
      const pruned: Record<string, AdultSliceDetail> = {};
      for (const k of Array.from(validKeys)) {
        if (baseDetail[k]) pruned[k] = normalizeSliceDetail(baseDetail[k]);
      }
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            adultsProfile: {
              ...prevAp,
              selections: nextSelections,
              sliceDetail: pruned,
              q1PlainText: patch.q1PlainText ?? prevAp.q1PlainText ?? "",
              q2PlainText: patch.q2PlainText ?? prevAp.q2PlainText ?? "",
            },
          },
        },
      });
    },
    [nodeId, comp, updateMutation, subProfileContext],
  );

  const updateSliceDetail = useCallback(
    (sliceKey: string, patch: Partial<AdultSliceDetail>) => {
      const de: any = (comp as any)?.designedExperienceData || {};
      if (subProfileContext) {
        const subs = [...(de.subcomponents || [])];
        const idx = subs.findIndex((s: any) => s.id === subProfileContext.subId);
        if (idx < 0) return;
        const prevAp = subs[idx].adultsProfile || {};
        const cur: Record<string, AdultSliceDetail> =
          prevAp.sliceDetail && typeof prevAp.sliceDetail === "object" && !Array.isArray(prevAp.sliceDetail)
            ? { ...prevAp.sliceDetail }
            : {};
        const prevSlice = normalizeSliceDetail(cur[sliceKey]);
        cur[sliceKey] = { ...prevSlice, ...patch };
        const sub = {
          ...subs[idx],
          adultsProfile: {
            ...prevAp,
            selections: Array.isArray(prevAp.selections) ? prevAp.selections : [],
            sliceDetail: cur,
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
      const prevAp = de.adultsProfile || {};
      const cur: Record<string, AdultSliceDetail> =
        prevAp.sliceDetail && typeof prevAp.sliceDetail === "object" && !Array.isArray(prevAp.sliceDetail)
          ? { ...prevAp.sliceDetail }
          : {};
      const prevSlice = normalizeSliceDetail(cur[sliceKey]);
      cur[sliceKey] = { ...prevSlice, ...patch };
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            adultsProfile: {
              ...prevAp,
              selections: Array.isArray(prevAp.selections) ? prevAp.selections : [],
              sliceDetail: cur,
            },
          },
        },
      });
    },
    [nodeId, comp, updateMutation, subProfileContext],
  );

  const setQ1PlainText = useCallback(
    (text: string) => writeProfile({ q1PlainText: text }),
    [writeProfile],
  );
  const isPrimarySelected = (primaryId: string) => selections.some((s) => s.primaryId === primaryId);
  const getSelection = (primaryId: string) => selections.find((s) => s.primaryId === primaryId);

  function togglePrimary(primaryId: string) {
    const p = findAdultPrimary(primaryId);
    if (!p) return;
    if (isPrimarySelected(primaryId)) {
      writeProfile({ selections: selections.filter((s) => s.primaryId !== primaryId) });
    } else {
      writeProfile({
        selections: [
          ...selections,
          {
            primaryId,
            secondaryIds: p.secondaries?.length ? [] : undefined,
            description: "",
            isKey: false,
          },
        ],
      });
    }
  }

  function toggleSecondary(primaryId: string, secondaryId: string) {
    const sel = getSelection(primaryId);
    if (!sel) return;
    const cur = sel.secondaryIds ?? [];
    const removing = cur.includes(secondaryId);
    const nextSec = removing ? cur.filter((id) => id !== secondaryId) : [...cur, secondaryId];
    writeProfile({
      selections: selections.map((s) => {
        if (s.primaryId !== primaryId) return s;
        const next: AdultSelection = {
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
    });
  }

  function toggleSecondaryKey(primaryId: string, secondaryId: string) {
    writeProfile({
      selections: selections.map((s) => {
        if (s.primaryId !== primaryId) return s;
        const sk = { ...(s.secondaryKeys ?? {}) };
        if (sk[secondaryId]) {
          delete sk[secondaryId];
        } else {
          sk[secondaryId] = true;
        }
        return { ...s, secondaryKeys: Object.keys(sk).length ? sk : undefined };
      }),
    });
  }

  function toggleKey(primaryId: string) {
    writeProfile({
      selections: selections.map((s) => (s.primaryId === primaryId ? { ...s, isKey: !s.isKey } : s)),
    });
  }

  const sliceKeys = useMemo(() => adultSliceKeysFromSelections(selections), [selections]);
  const leafChips = useMemo(() => adultLeafChipsFromSelections(selections), [selections]);

  useEffect(() => {
    if (focusedSliceKey != null && !sliceKeys.includes(focusedSliceKey)) {
      onFocusedSliceKeyChange?.(null);
    }
  }, [focusedSliceKey, sliceKeys, onFocusedSliceKeyChange]);

  const summaryBlock =
    variant === "expert" ? (
      <div className="rounded-xl border border-sky-100 bg-sky-50/40 px-4 py-3 space-y-2">
        <p className="text-xs text-gray-600 leading-relaxed">
          Select adult roles in Question 1, then specify additional information for each role in Question 2.
        </p>
        {leafChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {leafChips.map((c) => (
              <span
                key={c.key}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium",
                  c.isKey ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-white border-sky-200 text-sky-900",
                )}
              >
                {c.isKey && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                {c.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No adult roles selected yet.</p>
        )}
      </div>
    ) : (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Adults</h2>
          {(title || (comp as any)?.title) && (
            <p className="text-sm text-gray-500 mt-0.5">{title || (comp as any)?.title}</p>
          )}
        </div>
        <div className="px-5 py-2.5 text-xs text-gray-500 border-b border-gray-100">
          Question 1: choose adult roles below. Each selected role opens its own page for plain language and structured detail
          (demographics, skills, background, staffing). Click a chip or a row under Question 2 to edit.
        </div>
        {leafChips.length > 0 ? (
          <div className="px-5 py-3 flex flex-wrap gap-1.5 border-b border-gray-100">
            {leafChips.map((c) => {
              const chipClass = cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium",
                c.isKey ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-sky-50 border-sky-200 text-sky-800",
              );
              if (onFocusedSliceKeyChange) {
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => onFocusedSliceKeyChange(c.key)}
                    className={cn(chipClass, "cursor-pointer hover:bg-sky-100/80")}
                  >
                    {c.isKey && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                    {c.label}
                  </button>
                );
              }
              return (
                <span key={c.key} className={chipClass}>
                  {c.isKey && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                  {c.label}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-3 text-xs text-gray-400 italic border-b border-gray-100">
            No adult roles selected yet — use Question 1 below.
          </div>
        )}
      </div>
    );

  const q1Section = ADULT_ROLE_SECTIONS[0];

  const showStandaloneDetail =
    variant === "standalone" &&
    focusedSliceKey != null &&
    sliceKeys.includes(focusedSliceKey);

  if (showStandaloneDetail) {
    return (
      <div className={cn("space-y-5", "max-w-3xl mx-auto p-6 pb-16")} data-testid="adults-editor">
        <AdultSliceSection
          sliceKey={focusedSliceKey}
          detail={normalizeSliceDetail(sliceDetail[focusedSliceKey])}
          legacyQ2PlainText={legacyQ2PlainText}
          onChangeDetail={(patch) => updateSliceDetail(focusedSliceKey, patch)}
          layout="page"
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", variant === "standalone" && "max-w-3xl mx-auto p-6 pb-16")} data-testid="adults-editor">
      {summaryBlock}

      {/* Question 1 — full header row toggles collapse (same pattern as per-role blocks) */}
      <Collapsible open={q1Open} onOpenChange={setQ1Open} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <CollapsibleTrigger className="flex w-full items-start gap-3 px-4 py-3 text-left bg-sky-50/40 border-b border-gray-100 hover:bg-sky-50/70 transition-colors [&[data-state=open]>svg]:rotate-180">
          <span
            className="flex-shrink-0 w-7 h-7 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center mt-0.5 pointer-events-none"
            aria-hidden
          >
            1
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">{q1Section.title}</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{q1Section.setOfDesignChoices}</p>
          </div>
          <ChevronDown className="w-4 h-4 shrink-0 text-gray-500 transition-transform mt-1" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 py-4 space-y-4">
            <PlainLanguageInput
              value={q1PlainText}
              onChange={setQ1PlainText}
              placeholder="Describe your design choices in plain language — optional for now; later this could help pre-select tags."
            />
            {q1Section.buckets.map((bucket) => (
              <Collapsible key={bucket.id} defaultOpen className="border border-gray-100 rounded-lg bg-gray-50/30 overflow-hidden">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50/80 transition-colors [&[data-state=open]>svg]:rotate-180">
                  {bucket.title}
                  <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 flex flex-wrap gap-2">
                    {bucket.primaries.map((primary) => {
                      const selected = isPrimarySelected(primary.id);
                      const sel = getSelection(primary.id);
                      const pillSel =
                        selected && sel
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
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Question 2 — expert: stacked collapsible sections; standalone: hub list → dedicated page per role */}
      {sliceKeys.length > 0 && variant === "expert" ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">{ADULT_DEFINE_DETAIL_HEADING}</h2>
            <p className="text-xs text-gray-500 leading-relaxed">{ADULT_Q2_QUESTION}</p>
          </div>
          <div className="space-y-12">
            {sliceKeys.map((sliceKey) => (
              <AdultSliceSection
                key={sliceKey}
                sliceKey={sliceKey}
                detail={normalizeSliceDetail(sliceDetail[sliceKey])}
                legacyQ2PlainText={legacyQ2PlainText}
                onChangeDetail={(patch) => updateSliceDetail(sliceKey, patch)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {sliceKeys.length > 0 && variant === "standalone" ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">{ADULT_DEFINE_DETAIL_HEADING}</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Open a role to work on its own page — demographics, incoming skills, adult background, and staffing.
            </p>
          </div>
          <div className="space-y-2">
            {sliceKeys.map((sk) => {
              const d = normalizeSliceDetail(sliceDetail[sk]);
              const preview = (d.plainLanguage ?? "").trim();
              return (
                <button
                  key={sk}
                  type="button"
                  onClick={() => onFocusedSliceKeyChange?.(sk)}
                  className="w-full text-left rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-sky-200 hover:bg-sky-50/30 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{formatAdultSliceTitle(sk)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                      {preview || "Open to add detail…"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdultsView({
  nodeId,
  title,
  onBack,
  subProfileContext,
  focusedSliceKey,
  onFocusedSliceKeyChange,
  hideShellBackButton = false,
}: {
  nodeId?: string;
  title?: string;
  onBack: () => void;
  subProfileContext?: AdultsSubProfileContext | null;
  focusedSliceKey: string | null;
  onFocusedSliceKeyChange: (key: string | null) => void;
  hideShellBackButton?: boolean;
}) {
  return (
    <div data-testid="adults-view">
      {!hideShellBackButton ? (
        <button
          type="button"
          onClick={() => {
            if (focusedSliceKey) onFocusedSliceKeyChange(null);
            else onBack();
          }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group px-6 pt-6"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {focusedSliceKey ? "Back to roles" : "Back to Designed Experience"}
        </button>
      ) : null}
      <AdultsEditor
        nodeId={nodeId}
        title={title}
        variant="standalone"
        subProfileContext={subProfileContext ?? null}
        focusedSliceKey={focusedSliceKey}
        onFocusedSliceKeyChange={onFocusedSliceKeyChange}
      />
    </div>
  );
}
