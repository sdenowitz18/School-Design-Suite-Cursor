"use client";

import { OUTCOME_SCHEMA } from "@/components/designed-experience-schemas";

export type OutcomeDomain = "STEM" | "Humanities" | "Wayfinding" | "Well-being" | "Cross-cutting" | "Unknown";

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
  // Prefer a “strongest” domain if mixed.
  const set = new Set(domains.filter((d) => d !== "Unknown"));
  const pick =
    (set.has("STEM") && "STEM") ||
    (set.has("Humanities") && "Humanities") ||
    (set.has("Wayfinding") && "Wayfinding") ||
    (set.has("Well-being") && "Well-being") ||
    (set.has("Cross-cutting") && "Cross-cutting") ||
    "Unknown";

  // Keep aligned with existing canvas palette.
  if (pick === "STEM") return "bg-emerald-100";
  if (pick === "Wayfinding") return "bg-blue-100";
  if (pick === "Humanities") return "bg-purple-100";
  if (pick === "Well-being") return "bg-rose-100";
  if (pick === "Cross-cutting") return "bg-gray-100";
  return "bg-white";
}

