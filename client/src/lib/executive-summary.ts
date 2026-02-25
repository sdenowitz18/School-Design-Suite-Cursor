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

function count(items: unknown): number | null {
  return Array.isArray(items) ? items.length : null;
}

function fmtScore(n: unknown): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : null;
  return v === null ? "—" : String(v);
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

  const primaryOutcomes = list(snap.primaryOutcomes);
  const subcomponents = list(snap.subcomponents);
  const variants = list(snap.variants);
  const keyExperiences = Array.isArray(snap.keyExperiences)
    ? snap.keyExperiences
        .map((k: any) => (typeof k === "string" ? k : clean(k?.name)))
        .filter(Boolean)
    : [];

  if (primaryOutcomes.length) overviewLines.push(`Primary outcomes: ${joinTruncated(primaryOutcomes, 6)}`);
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
  const outcomeScoreData: any = hd.outcomeScoreData || null;
  const experienceScoreData: any = hd.experienceScoreData || null;
  const ringDesignScoreData: any = hd.ringDesignScoreData || null;
  const ringImplementationScoreData: any = hd.ringImplementationScoreData || null;
  const ringConditionsScoreData: any = hd.ringConditionsScoreData || null;

  const healthLines: string[] = [];

  const finalOutcomeScore = outcomeScoreData ? outcomeScoreData.finalOutcomeScore ?? null : null;
  const targetedOutcomes: any[] = Array.isArray(outcomeScoreData?.targetedOutcomes) ? outcomeScoreData.targetedOutcomes : [];
  const highPriorityOutcomes = targetedOutcomes
    .filter((o: any) => String(o?.priority || "").toUpperCase() === "H" && !o?.skipped)
    .map((o: any) => clean(o?.outcomeName))
    .filter(Boolean);

  const finalExperienceScore = experienceScoreData ? experienceScoreData.finalExperienceScore ?? null : null;
  const leapItemsCount = count(experienceScoreData?.leapItems);

  const ringDesignFinal = ringDesignScoreData ? ringDesignScoreData.finalDesignScore ?? ringDesignScoreData.overallDesignScore ?? null : null;
  const ringImplFinal = ringImplementationScoreData
    ? ringImplementationScoreData.finalImplementationScore ?? ringImplementationScoreData.overallImplementationScore ?? null
    : null;
  const ringConditionsFinal = ringConditionsScoreData ? ringConditionsScoreData.finalConditionsScore ?? null : null;

  healthLines.push(
    [
      `Outcomes score: ${fmtScore(finalOutcomeScore)}`,
      `Targeted outcomes: ${targetedOutcomes.length || "—"}`,
      `Experience score: ${fmtScore(finalExperienceScore)}`,
    ].join(" • "),
  );
  if (highPriorityOutcomes.length) healthLines.push(`High-priority outcomes: ${joinTruncated(highPriorityOutcomes, 5)}`);

  const dimParts: string[] = [];
  if (experienceScoreData) {
    const leapsDim = experienceScoreData.leapsDimensionScore ?? null;
    const healthDim = experienceScoreData.healthDimensionScore ?? null;
    const behaviorDim = experienceScoreData.behaviorDimensionScore ?? null;
    if (leapsDim !== null || healthDim !== null || behaviorDim !== null) {
      dimParts.push(`Leaps: ${fmtScore(leapsDim)}`);
      dimParts.push(`Health: ${fmtScore(healthDim)}`);
      dimParts.push(`Behavior: ${fmtScore(behaviorDim)}`);
    }
    if (leapItemsCount !== null && leapItemsCount > 0) dimParts.push(`Leap items: ${leapItemsCount}`);
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

  const primaryOutcomes = list(snap.primaryOutcomes);
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

  const osd: any = hd.outcomeScoreData || {};
  const esd: any = hd.experienceScoreData || {};

  const outcomeScore = typeof osd.finalOutcomeScore === "number" ? osd.finalOutcomeScore : null;
  const experienceScore = typeof esd.finalExperienceScore === "number" ? esd.finalExperienceScore : null;

  const targetedOutcomes: any[] = Array.isArray(osd.targetedOutcomes) ? osd.targetedOutcomes : [];
  const highPriorityTargeted = targetedOutcomes
    .filter((o: any) => String(o?.priority || "").toUpperCase() === "H" && !o?.skipped)
    .map((o: any) => clean(o?.outcomeName))
    .filter(Boolean);

  const ringDesignScoreData: any = hd.ringDesignScoreData || null;
  const ringImplementationScoreData: any = hd.ringImplementationScoreData || null;
  const ringConditionsScoreData: any = hd.ringConditionsScoreData || null;
  const ringDesignFinal = ringDesignScoreData ? ringDesignScoreData.finalDesignScore ?? ringDesignScoreData.overallDesignScore ?? null : null;
  const ringImplFinal = ringImplementationScoreData
    ? ringImplementationScoreData.finalImplementationScore ?? ringImplementationScoreData.overallImplementationScore ?? null
    : null;
  const ringConditionsFinal = ringConditionsScoreData ? ringConditionsScoreData.finalConditionsScore ?? null : null;

  const overviewDesc = truncateText(clean(snap.description), 220);
  const deDesc = truncateText(clean(de.description), 220);

  const overview = [
    "Overview",
    `${title} is a ${level !== "—" ? level : ""}${level !== "—" && type !== "—" ? " " : ""}${type !== "—" ? type : "component"} with ${participation !== "—" ? participation : "an unspecified"} participation model.`.replace(/\s+/g, " ").trim(),
    overviewDesc ? overviewDesc : "",
    primaryOutcomes.length ? `Primary outcomes include ${joinTruncated(primaryOutcomes, 6)}.` : "",
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
    `Current scores: Outcomes ${fmtScore(outcomeScore)} • Experience ${fmtScore(experienceScore)}.`.trim(),
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

