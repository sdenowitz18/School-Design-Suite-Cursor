"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { componentQueries, useUpdateComponent } from "@/lib/api";
import { calcFinalExperienceScore, migrateLegacyExperienceScoreData } from "@shared/experience-score-calc";
import {
  experienceHealthSubdimensions,
  experienceSubdimensionIdForAim,
  experienceTagOptionsFromTops,
  experienceWeightsForComponent,
  remapExperienceSubdimensionIdsOnMeasures,
} from "@shared/experience-subdimension-tree";
import { isLeapAimActive } from "@shared/aim-selection";
import { calcImplementationTopDimensionScore } from "@shared/implementation-score-calc";
import { listSelectableYearKeys } from "@shared/marking-period";
import { normActor, UNKNOWN_ACTOR_KEY } from "@shared/score-instances";
import type { ImplementationTopDimension } from "@shared/implementation-subdimension-tree";
import type { OutcomeSubDimL1 } from "@shared/outcome-subdimension-tree";
import type { OutcomeMeasure, ScoreFilter } from "@shared/schema";
import { LEAP_DESCRIPTIONS } from "./designed-experience-schemas";
import OutcomesLearnMoreView from "./outcomes-learn-more-view";
import { OutcomeMeasureCard, ScoreChip } from "./outcome-score-view";
import { useGlobalActors } from "@/lib/actors-store";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function levelToAbbrev(level: unknown, override?: string | null): string {
  if (override === "H" || override === "M" || override === "L") return override;
  if (level === "High") return "H";
  if (level === "Low") return "L";
  return "M";
}

function roundFinal1to5(score: number | null): number | null {
  if (score === null) return null;
  return Math.max(1, Math.min(5, Math.round(score)));
}

export default function LeapDetailView({
  nodeId,
  title,
  leapLabel,
  onBack,
  hideTopBack = false,
}: {
  nodeId?: string;
  title?: string;
  leapLabel: string;
  onBack: () => void;
  hideTopBack?: boolean;
}) {
  const { data: comp } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const { data: allComponents } = useQuery({ ...componentQueries.all, enabled: !!nodeId } as any);
  const updateMutation = useUpdateComponent();
  const { actors: globalActors, addActor: addGlobalActor, mergeActors: mergeGlobalActors } = useGlobalActors();
  const compRef = useRef(comp);
  compRef.current = comp;
  const allComponentsRef = useRef(allComponents);
  allComponentsRef.current = allComponents;
  const experienceBundleRef = useRef<{
    measures: OutcomeMeasure[];
    overallMeasures: OutcomeMeasure[];
    subDimensionWeights: Record<string, "H" | "M" | "L">;
    filter: ScoreFilter;
    tops: ImplementationTopDimension[];
  } | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextNotesPersist = useRef(true);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [actors, setActors] = useState<string[]>([]);
  const actorsForSaveRef = useRef<string[]>([]);
  actorsForSaveRef.current = actors;

  const isOverall = String(nodeId || "") === "overall" || String((comp as any)?.nodeId || "") === "overall";

  const leapAim = useMemo(() => {
    const aims: any[] = (comp as any)?.designedExperienceData?.keyDesignElements?.aims || [];
    return aims.find((a: any) => a?.type === "leap" && norm(a?.label) === norm(leapLabel)) || null;
  }, [comp, leapLabel]);

  const priority = leapAim?.overrideLevel ?? (leapAim?.level === "High" ? "H" : leapAim?.level === "Low" ? "L" : "M") ?? "M";

  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(String(leapAim?.notes ?? ""));
  }, [leapLabel, nodeId, leapAim?.notes]);

  useEffect(() => {
    const esd = (comp as any)?.healthData?.experienceScoreData;
    if (esd && Array.isArray(esd.actors)) setActors(esd.actors);
    else if (!comp) setActors([]);
  }, [comp?.healthData?.experienceScoreData, nodeId]);

  const shortDescription =
    LEAP_DESCRIPTIONS[leapLabel] ||
    `${leapLabel.trim()} is a design principle for this component. Add notes below to clarify how it shows up in practice.`;

  const setPriority = useCallback(
    (p: "H" | "M" | "L") => {
      if (!nodeId || !comp) return;
      const de: any = (comp as any).designedExperienceData || {};
      const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
      const aims: any[] = kde.aims || [];
      const levelMap = { H: "High", M: "Medium", L: "Low" };
      const nextAims = aims.map((a: any) =>
        a?.type === "leap" && norm(a?.label) === norm(leapLabel)
          ? { ...a, overrideLevel: p, level: levelMap[p], levelMode: "override" }
          : a,
      );
      updateMutation.mutate({
        nodeId,
        data: {
          designedExperienceData: {
            ...de,
            keyDesignElements: { ...kde, aims: nextAims },
          },
        },
      });
    },
    [comp, leapLabel, nodeId, updateMutation],
  );

  const persistNotes = useCallback(
    (text: string) => {
      if (!nodeId || !comp) return;
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
      notesTimerRef.current = setTimeout(() => {
        const de: any = (comp as any).designedExperienceData || {};
        const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
        const aims: any[] = kde.aims || [];
        updateMutation.mutate({
          nodeId,
          data: {
            designedExperienceData: {
              ...de,
              keyDesignElements: {
                ...kde,
                aims: aims.map((a: any) =>
                  a?.type === "leap" && norm(a?.label) === norm(leapLabel) ? { ...a, notes: text } : a,
                ),
              },
            },
          },
        });
      }, 500);
    },
    [comp, leapLabel, nodeId, updateMutation],
  );

  useEffect(() => {
    if (skipNextNotesPersist.current) {
      skipNextNotesPersist.current = false;
      return;
    }
    persistNotes(notes);
  }, [notes, persistNotes]);

  /** Same migration + weights + filter as Experience Score for this node. */
  const experienceBundle = useMemo(() => {
    if (!comp || allComponents === undefined) return null;
    const hd: any = comp.healthData || {};
    const esd: any = hd.experienceScoreData || {};
    const de: any = comp.designedExperienceData || {};
    const kde = de.keyDesignElements || {};
    const aims: any[] = kde.aims || [];
    const activeLeapAims = aims.filter(
      (a: any) => a?.type === "leap" && typeof a?.label === "string" && isLeapAimActive(a),
    );
    const tops = experienceHealthSubdimensions(allComponents as any[]);
    const migrated = migrateLegacyExperienceScoreData(esd, activeLeapAims);
    const measures = remapExperienceSubdimensionIdsOnMeasures(migrated.measures, comp);
    const overallMeasures = migrated.overallMeasures;
    const deW = experienceWeightsForComponent(comp, tops);
    const subDimensionWeights = {
      ...deW,
      ...migrated.subDimensionWeights,
      ...(typeof esd.subDimensionWeights === "object" ? esd.subDimensionWeights : {}),
    };
    const saved: any = esd.filter || {};
    const filter: ScoreFilter = saved?.mode
      ? (saved as any)
      : ({
          mode: "year",
          yearKey: listSelectableYearKeys(new Date(), 5)[0],
          aggregation: saved?.aggregation || "singleLatest",
          actorKey: saved?.actorKey,
        } as any);
    return { measures, overallMeasures, subDimensionWeights, filter, tops };
  }, [comp, allComponents]);

  useEffect(() => {
    experienceBundleRef.current = experienceBundle;
  }, [experienceBundle]);

  const persistExperienceScore = useCallback(
    (nextMeasures: OutcomeMeasure[], nextOverall: OutcomeMeasure[]) => {
      if (!nodeId) return;
      if (expSaveTimerRef.current) clearTimeout(expSaveTimerRef.current);
      expSaveTimerRef.current = setTimeout(() => {
        const c = compRef.current;
        const ac = allComponentsRef.current;
        if (!c || !ac) return;
        const hd: any = c.healthData || {};
        const esd: any = hd.experienceScoreData || {};
        const tops = experienceHealthSubdimensions(ac as any[]);
        const de: any = c.designedExperienceData || {};
        const kde = de.keyDesignElements || {};
        const aims: any[] = kde.aims || [];
        const activeLeapAims = aims.filter(
          (a: any) => a?.type === "leap" && typeof a?.label === "string" && isLeapAimActive(a),
        );
        const migratedBase = migrateLegacyExperienceScoreData(esd, activeLeapAims);
        const subDimensionWeights = {
          ...experienceWeightsForComponent(c, tops),
          ...migratedBase.subDimensionWeights,
          ...(typeof esd.subDimensionWeights === "object" ? esd.subDimensionWeights : {}),
        };
        const saved: any = esd.filter || {};
        const filter: ScoreFilter = saved?.mode
          ? (saved as any)
          : ({
              mode: "year",
              yearKey: listSelectableYearKeys(new Date(), 5)[0],
              aggregation: saved?.aggregation || "singleLatest",
              actorKey: saved?.actorKey,
            } as any);
        const finalExperienceScore = roundFinal1to5(
          calcFinalExperienceScore(nextMeasures, nextOverall, subDimensionWeights, filter, tops),
        );
        updateMutation.mutate({
          nodeId,
          data: {
            healthData: {
              ...hd,
              experienceScoreData: {
                ...esd,
                scoringMode: "dimensions",
                measures: nextMeasures,
                overallMeasures: nextOverall,
                subDimensionWeights,
                filter,
                actors: actorsForSaveRef.current,
                finalExperienceScore,
              },
            },
          },
        });
      }, 550);
    },
    [nodeId, updateMutation],
  );

  const handleMeasureUpdate = useCallback(
    (m: OutcomeMeasure) => {
      if (!experienceBundle || !nodeId) return;
      const shouldBeOverall = !(m.subDimensionIds?.length) || !!(m as any).crossOutcome;
      let nextMeasures = [...experienceBundle.measures];
      let nextOverall = [...experienceBundle.overallMeasures];
      if (shouldBeOverall) {
        nextMeasures = nextMeasures.filter((x) => x.id !== m.id);
        const i = nextOverall.findIndex((x) => x.id === m.id);
        nextOverall = i >= 0 ? nextOverall.map((x) => (x.id === m.id ? m : x)) : [...nextOverall, m];
      } else {
        nextOverall = nextOverall.filter((x) => x.id !== m.id);
        const i = nextMeasures.findIndex((x) => x.id === m.id);
        nextMeasures = i >= 0 ? nextMeasures.map((x) => (x.id === m.id ? m : x)) : [...nextMeasures, m];
      }
      persistExperienceScore(nextMeasures, nextOverall);
    },
    [experienceBundle, nodeId, persistExperienceScore],
  );

  const handleDeleteMeasure = useCallback(
    (id: string) => {
      if (!experienceBundle || !nodeId) return;
      persistExperienceScore(
        experienceBundle.measures.filter((x) => x.id !== id),
        experienceBundle.overallMeasures.filter((x) => x.id !== id),
      );
    },
    [experienceBundle, nodeId, persistExperienceScore],
  );

  const onAddActor = useCallback(
    (label: string) => {
      const clean = String(label ?? "").trim();
      if (!clean) return;
      addGlobalActor(clean);
      setActors((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const seen = new Set(list.map((p) => normActor(p)));
        const key = normActor(clean);
        if (key === UNKNOWN_ACTOR_KEY || seen.has(key)) return list;
        return [...list, clean];
      });
    },
    [addGlobalActor],
  );

  const actorOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (a: unknown) => {
      const clean = String(a ?? "").trim();
      if (!clean) return;
      const key = normActor(clean);
      if (!key || key === UNKNOWN_ACTOR_KEY || seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };
    for (const a of globalActors || []) add(a);
    for (const a of actors) add(a);
    const scanMs = (ms: OutcomeMeasure[]) => {
      for (const m of ms) {
        for (const i of m.instances || []) add((i as any)?.actor);
      }
    };
    if (experienceBundle) {
      scanMs(experienceBundle.measures);
      scanMs(experienceBundle.overallMeasures);
    }
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [globalActors, actors, experienceBundle]);

  useEffect(() => {
    mergeGlobalActors(actorOptions);
  }, [actorOptions, mergeGlobalActors]);

  const allTagOptions = useMemo(
    () => (experienceBundle ? experienceTagOptionsFromTops(experienceBundle.tops) : []),
    [experienceBundle],
  );

  const experienceTreeAsOutcome = (experienceBundle?.tops ?? []) as unknown as OutcomeSubDimL1[];

  const leapSubdimensionId = useMemo(
    () =>
      experienceSubdimensionIdForAim({
        id: leapAim?.id,
        label: leapLabel,
      }),
    [leapAim?.id, leapLabel],
  );

  const leapTop = useMemo(() => {
    if (!experienceBundle) return null;
    return experienceBundle.tops.find((t) => t.id === leapSubdimensionId) ?? null;
  }, [experienceBundle, leapSubdimensionId]);

  const leapTopForScore: ImplementationTopDimension | null = useMemo(() => {
    if (!leapTop) return { id: leapSubdimensionId, label: leapLabel, children: [] };
    return leapTop;
  }, [leapTop, leapSubdimensionId, leapLabel]);

  const subdimensionScore = useMemo(() => {
    if (!experienceBundle || !leapTopForScore) return null;
    return calcImplementationTopDimensionScore(
      leapTopForScore,
      experienceBundle.measures,
      experienceBundle.overallMeasures,
      experienceBundle.subDimensionWeights,
      experienceBundle.filter,
    );
  }, [experienceBundle, leapTopForScore]);

  const leapDimensionWeight = experienceBundle?.subDimensionWeights[leapSubdimensionId] ?? "M";

  const leapMeasures = useMemo(() => {
    if (!experienceBundle) return [];
    const tagId = leapSubdimensionId;
    const { measures, overallMeasures } = experienceBundle;
    const out: OutcomeMeasure[] = [];
    const seen = new Set<string>();
    const push = (m: OutcomeMeasure) => {
      if ((m as any).crossOutcome) return;
      if (!Array.isArray(m.subDimensionIds) || !m.subDimensionIds.includes(tagId)) return;
      if (seen.has(m.id)) return;
      seen.add(m.id);
      out.push(m);
    };
    for (const m of measures) push(m);
    for (const m of overallMeasures) push(m);
    return out;
  }, [experienceBundle, leapSubdimensionId]);

  const taggedSubRows = useMemo(() => {
    const subs: any[] = (comp as any)?.designedExperienceData?.subcomponents || [];
    return subs
      .map((s: any) => {
        const aim = (s?.aims || []).find((a: any) => a?.type === "leap" && norm(a?.label) === norm(leapLabel));
        if (!aim) return null;
        const abbrev = levelToAbbrev(aim.level, aim.overrideLevel);
        return { name: String(s?.name || "Untitled"), abbrev };
      })
      .filter(Boolean) as { name: string; abbrev: string }[];
  }, [comp, leapLabel]);

  const taggedComponents = useMemo(() => {
    if (!isOverall) return [];
    const list: any[] = Array.isArray(allComponents) ? allComponents : [];
    const key = norm(leapLabel);
    const out: { nodeId: string; title: string }[] = [];
    for (const c of list) {
      const cNodeId = String(c?.nodeId || "");
      if (!cNodeId || cNodeId === "overall") continue;
      const de: any = c?.designedExperienceData || {};
      const aims: any[] = de?.keyDesignElements?.aims || [];
      const hasAtComponent = aims.some((a: any) => a?.type === "leap" && norm(a?.label) === key);
      const subs: any[] = Array.isArray(de?.subcomponents) ? de.subcomponents : [];
      const hasAtSub = subs.some((s: any) => (s?.aims || []).some((a: any) => a?.type === "leap" && norm(a?.label) === key));
      if (hasAtComponent || hasAtSub) out.push({ nodeId: cNodeId, title: String(c?.title || cNodeId) });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  }, [allComponents, isOverall, leapLabel]);

  const componentName = title || (comp as any)?.title || "this component";

  if (showLearnMore) {
    return (
      <OutcomesLearnMoreView mode="leap" leapLabel={leapLabel} onBack={() => setShowLearnMore(false)} />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-16 space-y-8" data-testid="leap-detail-view">
      {!hideTopBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      ) : null}

      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{leapLabel}</h1>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-gray-600 shrink-0"
            onClick={() => setShowLearnMore(true)}
          >
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            Learn more
          </Button>
        </div>
        {(title || (comp as any)?.title) && <p className="text-sm text-gray-500">{title || (comp as any)?.title}</p>}
        <p className="text-sm text-gray-700 leading-relaxed">{shortDescription}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Priority</span>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {(["H", "M", "L"] as const).map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => setPriority(k)}
              className={cn(
                "px-3 py-1 text-xs font-semibold transition-colors",
                i > 0 && "border-l border-gray-200",
                priority === k ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {k === "H" ? "High" : k === "M" ? "Medium" : "Low"}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 tracking-tight">
          How this applies to {isOverall ? "the overall school" : componentName}
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <Label className="text-[11px] text-gray-500 sr-only">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Describe how “${leapLabel}” shows up in this design…`}
            className="text-sm min-h-[88px] bg-white"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Measures</h2>
          <div className="flex items-center gap-2 shrink-0">
            <ScoreChip score={subdimensionScore} size="sm" />
            <span className="text-[11px] text-gray-500 font-semibold tabular-nums">Wt {leapDimensionWeight}</span>
          </div>
        </div>
        <div className="space-y-3">
          {!experienceBundle ? (
            <p className="text-xs text-gray-400 italic">Loading experience data…</p>
          ) : leapMeasures.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No measures yet for this leap.</p>
          ) : (
            leapMeasures.map((m) => (
              <OutcomeMeasureCard
                key={m.id}
                measure={m}
                onUpdate={handleMeasureUpdate}
                onDelete={() => handleDeleteMeasure(m.id)}
                actors={actorOptions}
                onAddActor={onAddActor}
                filter={experienceBundle.filter}
                allL2s={allTagOptions}
                subDimensionWeights={experienceBundle.subDimensionWeights}
                measureScoringMode="design"
                dimensionTagTree={experienceTreeAsOutcome}
              />
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 tracking-tight">
          {isOverall ? "Tagged components" : "Tagged subcomponents"}
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {isOverall ? (
            taggedComponents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Not tagged on any ring components.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {taggedComponents.map((c) => (
                  <Badge key={c.nodeId} variant="secondary" className="text-[11px] bg-gray-100 text-gray-800 border-gray-200">
                    {c.title}
                  </Badge>
                ))}
              </div>
            )
          ) : taggedSubRows.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Not tagged on any subcomponents.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {taggedSubRows.map((row) => (
                <span
                  key={row.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium bg-purple-50 text-purple-900 border-purple-200"
                >
                  {row.name}
                  <span className="text-[10px] font-bold px-1 rounded bg-white/80 border border-purple-200">{row.abbrev}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
