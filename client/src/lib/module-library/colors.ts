"use client";

import { OUTCOME_SCHEMA } from "@/components/designed-experience-schemas";

export type OutcomeDomain =
  | "STEM"
  | "Arts & Humanities"
  | "Thinking & Relating"
  | "Professional & Practical"
  | "Advancement"
  | "Wellbeing"
  | "Conduct & Engagement"
  | "Unknown";

export function outcomeDomainForLabel(label: string): OutcomeDomain {
  const l = String(label || "").trim();
  if (!l) return "Unknown";
  for (const [domain, strands] of Object.entries(OUTCOME_SCHEMA)) {
    for (const items of Object.values(strands)) {
      if (items.includes(l)) return domain as OutcomeDomain;
    }
  }
  return "Unknown";
}

export function octagonBgForDomains(domains: OutcomeDomain[]): string {
  const set = new Set(domains.filter((d) => d !== "Unknown"));
  const pick =
    (set.has("STEM") && "STEM") ||
    (set.has("Arts & Humanities") && "Arts & Humanities") ||
    (set.has("Advancement") && "Advancement") ||
    (set.has("Wellbeing") && "Wellbeing") ||
    (set.has("Conduct & Engagement") && "Conduct & Engagement") ||
    (set.has("Thinking & Relating") && "Thinking & Relating") ||
    (set.has("Professional & Practical") && "Professional & Practical") ||
    "Unknown";

  if (pick === "STEM") return "bg-emerald-100";
  if (pick === "Arts & Humanities") return "bg-purple-100";
  if (pick === "Thinking & Relating") return "bg-gray-100";
  if (pick === "Professional & Practical") return "bg-blue-100";
  if (pick === "Advancement") return "bg-amber-100";
  if (pick === "Wellbeing") return "bg-rose-100";
  if (pick === "Conduct & Engagement") return "bg-orange-100";
  return "bg-white";
}
