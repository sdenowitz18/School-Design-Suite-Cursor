import { migrateLegacyExperienceScoreData } from "@shared/experience-score-calc";

export type ExecutiveSummary = {
  overview: string;
  designedExperience: string;
  statusAndHealth: string;
};

function clean(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function list(items: unknown): string[] {
  return Array.isArray(items) ? items.map((x) => clean(x)).filter(Boolean) : [];
}

function truncateText(s: string, maxChars: number): string {
  const t = clean(s);
  if (!t) return "";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function truncateList(items: string[], maxItems: number): { shown: string[]; remaining: number } {
  if (!items.length) return { shown: [], remaining: 0 };
  if (items.length <= maxItems) return { shown: items, remaining: 0 };
  return { shown: items.slice(0, maxItems), remaining: items.length - maxItems };
}

function joinTruncated(items: string[], maxItems: number): string {
  const { shown, remaining } = truncateList(items, maxItems);
  if (!shown.length) return "—";
  const base = shown.join(", ");
  return remaining > 0 ? `${base} (+${remaining} more)` : base;
}

function fmtScore(n: unknown): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : null;
  return v === null ? "—" : String(v);
}

function leapAimsFromDe(de: any): any[] {
  const kde: any = de?.keyDesignElements || {};
  const aims = Array.isArray(kde.aims) ? kde.aims : [];
  return aims.filter((a: any) => clean(a?.type) === "leap" && typeof a?.label === "string");
}

export function buildExecutiveSummary(component: any | null | undefined): ExecutiveSummary {
  const snap: any = component?.snapshotData || {};
  const de: any = component?.designedExperienceData || {};
  const hd: any = component?.healthData || {};

  // 1) Overview (Snapshot)
  const overviewLines: string[] = [];
  const snapDesc = truncateText(clean(snap.description), 180);
  if (snapDesc) overviewLines.push(snapDesc);

  const level = clean(snap.level) || "—";
  const type = clean(snap.componentType) || "—";
  const participation = clean(snap.participationModel) || clean(snap.selectionGating) || "—";
  overviewLines.push(`Level: ${level} • Type: ${type} • Participation: ${participation}`);

  const subcomponents = list(snap.subcomponents);
  const variants = list(snap.variants);
  const keyExperiences = Array.isArray(snap.keyExperiences)
    ? snap.keyExperiences
        .map((k: any) => (typeof k === "string" ? k : clean(k?.name)))
        .filter(Boolean)
    : [];

  if (subcomponents.length) overviewLines.push(`Subcomponents: ${joinTruncated(subcomponents, 6)}`);
  if (variants.length) overviewLines.push(`Variants: ${joinTruncated(variants, 5)}`);
  if (keyExperiences.length) overviewLines.push(`Key experiences: ${joinTruncated(keyExperiences, 5)}`);

  const students = clean(snap.amountStudents);
  const pct = clean(snap.amountPercentage);
  if (students || pct) {
    const bits = [
      students ? `${students} students` : "",
      pct ? `${pct}%` : "",
    ].filter(Boolean);
    if (bits.length) overviewLines.push(`Reach: ${bits.join(" • ")}`);
  }

  // 2) Designed Experience
  const deDesc = truncateText(clean(de.description), 180);
  const kde: any = de.keyDesignElements || {};
  const aims = Array.isArray(kde.aims) ? kde.aims : [];
  const practices = Array.isArray(kde.practices) ? kde.practices : [];
  const supports = Array.isArray(kde.supports) ? kde.supports : [];
  const deSubcomponents = Array.isArray(de.subcomponents) ? de.subcomponents : [];

  const deOutcomeAims = aims
    .filter((a: any) => clean(a?.type) === "outcome")
    .map((a: any) => clean(a?.label))
    .filter(Boolean);
  const deLeapAims = aims
    .filter((a: any) => clean(a?.type) === "leap")
    .map((a: any) => clean(a?.label))
    .filter(Boolean);
  const dePracticeItems = practices.map((p: any) => clean(p?.label)).filter(Boolean);
  const deSupportItems = supports.map((s: any) => clean(s?.label)).filter(Boolean);
  const deSubNames = deSubcomponents.map((s: any) => clean(s?.name)).filter(Boolean);

  const keyPractices = practices.filter((p: any) => !!p?.isKey).map((p: any) => clean(p?.label)).filter(Boolean);
  const keySupports = supports.filter((s: any) => !!s?.isKey).map((s: any) => clean(s?.label)).filter(Boolean);

  const designedExperienceLines: string[] = [];
  if (deDesc) designedExperienceLines.push(deDesc);
  designedExperienceLines.push(
    [
      `Outcomes: ${deOutcomeAims.length || "—"}`,
      `Leaps: ${deLeapAims.length || "—"}`,
      `Practices: ${dePracticeItems.length || "—"}`,
      `Supports: ${deSupportItems.length || "—"}`,
    ].join(" • "),
  );
  if (deOutcomeAims.length) designedExperienceLines.push(`Outcome aims: ${joinTruncated(deOutcomeAims, 6)}`);
  if (deLeapAims.length) designedExperienceLines.push(`Leap aims: ${joinTruncated(deLeapAims, 6)}`);
  if (keyPractices.length) designedExperienceLines.push(`Key practices: ${joinTruncated(keyPractices, 5)}`);
  if (keySupports.length) designedExperienceLines.push(`Key supports: ${joinTruncated(keySupports, 5)}`);
  if (deSubNames.length) designedExperienceLines.push(`Subcomponents: ${joinTruncated(deSubNames, 6)}`);

  // 3) Status & Health
  const learningOutcomeData: any = hd.learningAdvancementOutcomeScoreData || null;
  const wellbeingOutcomeData: any = hd.wellbeingConductOutcomeScoreData || null;
  const experienceScoreData: any = hd.experienceScoreData || null;
  const designScoreData: any = hd.designScoreData || null;
  const implementationScoreData: any = hd.implementationScoreData || null;
  const ringImplementationScoreData: any = hd.ringImplementationScoreData || null;
  const ringConditionsScoreData: any = hd.ringConditionsScoreData || null;

  const healthLines: string[] = [];

  const finalLearningOutcomeScore = learningOutcomeData ? learningOutcomeData.finalOutcomeScore ?? null : null;
  const finalWellbeingOutcomeScore = wellbeingOutcomeData ? wellbeingOutcomeData.finalOutcomeScore ?? null : null;
  const targetedLearning: any[] = Array.isArray(learningOutcomeData?.targetedOutcomes) ? learningOutcomeData.targetedOutcomes : [];
  const targetedWellbeing: any[] = Array.isArray(wellbeingOutcomeData?.targetedOutcomes) ? wellbeingOutcomeData.targetedOutcomes : [];
  const targetedOutcomes = targetedLearning.concat(targetedWellbeing);
  const highPriorityOutcomes = targetedOutcomes
    .filter((o: any) => String(o?.priority || "").toUpperCase() === "H" && !o?.skipped)
    .map((o: any) => clean(o?.outcomeName))
    .filter(Boolean);

  const finalExperienceScore = experienceScoreData ? experienceScoreData.finalExperienceScore ?? null : null;

  const ringDesignFinal = designScoreData ? designScoreData.finalDesignScore ?? null : null;
  const ringImplFinal = implementationScoreData
    ? implementationScoreData.finalImplementationScore ?? null
    : ringImplementationScoreData
      ? ringImplementationScoreData.finalImplementationScore ?? ringImplementationScoreData.overallImplementationScore ?? null
      : null;
  const ringConditionsFinal = ringConditionsScoreData ? ringConditionsScoreData.finalConditionsScore ?? null : null;

  healthLines.push(
    [
      `Learning outcomes: ${fmtScore(finalLearningOutcomeScore)}`,
      `Wellbeing & conduct: ${fmtScore(finalWellbeingOutcomeScore)}`,
      `Targeted outcomes: ${targetedOutcomes.length || "—"}`,
      `Experience score: ${fmtScore(finalExperienceScore)}`,
    ].join(" • "),
  );
  if (highPriorityOutcomes.length) healthLines.push(`High-priority outcomes: ${joinTruncated(highPriorityOutcomes, 5)}`);

  const dimParts: string[] = [];
  if (experienceScoreData) {
    const migrated = migrateLegacyExperienceScoreData(experienceScoreData, leapAimsFromDe(de));
    const expMode = String(experienceScoreData.scoringMode || "dimensions");
    const taggedCount = (migrated.measures || []).filter(
      (m: any) => Array.isArray(m.subDimensionIds) && m.subDimensionIds.length > 0,
    ).length;
    const overallCount = Array.isArray(migrated.overallMeasures) ? migrated.overallMeasures.length : 0;
    if (expMode === "overall") {
      if (overallCount > 0) {
        dimParts.push(`Experience data: ${overallCount} overall measure${overallCount === 1 ? "" : "s"}`);
      }
    } else if (taggedCount > 0 || overallCount > 0) {
      const bits: string[] = [];
      if (taggedCount) bits.push(`${taggedCount} by subdimension`);
      if (overallCount) bits.push(`${overallCount} overall`);
      dimParts.push(`Experience data: ${bits.join(", ")}`);
    }
  }
  if (dimParts.length) healthLines.push(dimParts.join(" • "));

  const ringParts = [
    `Ring design: ${fmtScore(ringDesignFinal)}`,
    `Implementation: ${fmtScore(ringImplFinal)}`,
    `Conditions: ${fmtScore(ringConditionsFinal)}`,
  ];
  // Only show ring line if at least one score exists.
  if ([ringDesignFinal, ringImplFinal, ringConditionsFinal].some((v) => typeof v === "number")) {
    healthLines.push(ringParts.join(" • "));
  }

  return {
    overview: overviewLines.filter(Boolean).join("\n"),
    designedExperience: designedExperienceLines.filter(Boolean).join("\n"),
    statusAndHealth: healthLines.filter(Boolean).join("\n"),
  };
}

export function buildExecutiveSummaryText(component: any | null | undefined): string {
  const c: any = component || {};
  const title = clean(c?.title) || clean(c?.nodeId) || "This component";
  const snap: any = c?.snapshotData || {};
  const de: any = c?.designedExperienceData || {};
  const hd: any = c?.healthData || {};

  const level = clean(snap.level) || "—";
  const type = clean(snap.componentType) || "—";
  const participation = clean(snap.participationModel) || clean(snap.selectionGating) || "—";

  const subcomponents = list(snap.subcomponents);
  const variants = list(snap.variants);

  const kde: any = de.keyDesignElements || {};
  const aims = Array.isArray(kde.aims) ? kde.aims : [];
  const practices = Array.isArray(kde.practices) ? kde.practices : [];
  const supports = Array.isArray(kde.supports) ? kde.supports : [];

  const outcomeAims = aims
    .filter((a: any) => clean(a?.type) === "outcome")
    .map((a: any) => clean(a?.label))
    .filter(Boolean);
  const leapAims = aims
    .filter((a: any) => clean(a?.type) === "leap")
    .map((a: any) => clean(a?.label))
    .filter(Boolean);
  const keyPractices = practices.filter((p: any) => !!p?.isKey).map((p: any) => clean(p?.label)).filter(Boolean);
  const keySupports = supports.filter((s: any) => !!s?.isKey).map((s: any) => clean(s?.label)).filter(Boolean);

  const laOsd: any = hd.learningAdvancementOutcomeScoreData || {};
  const wbOsd: any = hd.wellbeingConductOutcomeScoreData || {};
  const esd: any = hd.experienceScoreData || {};

  const learningOutcomeScore = typeof laOsd.finalOutcomeScore === "number" ? laOsd.finalOutcomeScore : null;
  const wellbeingOutcomeScore = typeof wbOsd.finalOutcomeScore === "number" ? wbOsd.finalOutcomeScore : null;
  const experienceScore = typeof esd.finalExperienceScore === "number" ? esd.finalExperienceScore : null;

  const targetedOutcomes: any[] = ([] as any[]).concat(
    Array.isArray(laOsd.targetedOutcomes) ? laOsd.targetedOutcomes : [],
    Array.isArray(wbOsd.targetedOutcomes) ? wbOsd.targetedOutcomes : [],
  );
  const highPriorityTargeted = targetedOutcomes
    .filter((o: any) => String(o?.priority || "").toUpperCase() === "H" && !o?.skipped)
    .map((o: any) => clean(o?.outcomeName))
    .filter(Boolean);

  const designScoreData: any = hd.designScoreData || null;
  const implementationScoreData: any = hd.implementationScoreData || null;
  const ringImplementationScoreData: any = hd.ringImplementationScoreData || null;
  const ringConditionsScoreData: any = hd.ringConditionsScoreData || null;
  const ringDesignFinal = designScoreData ? designScoreData.finalDesignScore ?? null : null;
  const ringImplFinal = implementationScoreData
    ? implementationScoreData.finalImplementationScore ?? null
    : ringImplementationScoreData
      ? ringImplementationScoreData.finalImplementationScore ?? ringImplementationScoreData.overallImplementationScore ?? null
      : null;
  const ringConditionsFinal = ringConditionsScoreData ? ringConditionsScoreData.finalConditionsScore ?? null : null;

  const overviewDesc = truncateText(clean(snap.description), 220);
  const deDesc = truncateText(clean(de.description), 220);

  const overview = [
    "Overview",
    `${title} is a ${level !== "—" ? level : ""}${level !== "—" && type !== "—" ? " " : ""}${type !== "—" ? type : "component"} with ${participation !== "—" ? participation : "an unspecified"} participation model.`.replace(/\s+/g, " ").trim(),
    overviewDesc ? overviewDesc : "",
    subcomponents.length ? `It includes ${subcomponents.length} subcomponents (e.g., ${joinTruncated(subcomponents, 4)}).` : "",
    variants.length ? `Variants: ${joinTruncated(variants, 5)}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const designedExperience = [
    "Designed Experience",
    deDesc ? deDesc : "",
    outcomeAims.length || leapAims.length
      ? `The design targets ${outcomeAims.length || 0} outcomes and ${leapAims.length || 0} leaps.`.trim()
      : "Key aims haven’t been captured yet.",
    keyPractices.length ? `Key practices: ${joinTruncated(keyPractices, 5)}.` : "",
    keySupports.length ? `Key supports: ${joinTruncated(keySupports, 5)}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const statusAndHealth = [
    "Status & Health",
    `Current scores: Learning outcomes ${fmtScore(learningOutcomeScore)} • Wellbeing & conduct ${fmtScore(wellbeingOutcomeScore)} • Experience ${fmtScore(experienceScore)}.`.trim(),
    targetedOutcomes.length ? `There are ${targetedOutcomes.length} targeted outcomes being measured.` : "",
    highPriorityTargeted.length ? `High-priority outcomes: ${joinTruncated(highPriorityTargeted, 5)}.` : "",
    [ringDesignFinal, ringImplFinal, ringConditionsFinal].some((v) => typeof v === "number")
      ? `Ring drivers: Design ${fmtScore(ringDesignFinal)} • Implementation ${fmtScore(ringImplFinal)} • Conditions ${fmtScore(ringConditionsFinal)}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [overview, "", designedExperience, "", statusAndHealth].join("\n");
}

