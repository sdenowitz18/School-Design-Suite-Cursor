"use client";

import {
  OUTCOME_SCHEMA,
  LEAP_SCHEMA,
  PRACTICE_SCHEMA,
  SUPPORT_SCHEMA,
  OUTCOME_DESCRIPTIONS,
  LEAP_DESCRIPTIONS,
  PRACTICE_DESCRIPTIONS,
  SUPPORT_DESCRIPTIONS,
} from "@/components/designed-experience-schemas";

export type SchemaType = "outcome" | "leap" | "practice" | "support";

export type SchemaItem = {
  type: SchemaType;
  label: string;
  description: string;
  categoryPath: string[]; // e.g. ["STEM", "Mathematics"]
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function defaultDescription(type: SchemaType, label: string): string {
  if (type === "outcome") return `A learning outcome focused on ${label}.`;
  if (type === "leap") return `A student-experience design principle focused on ${label}.`;
  if (type === "practice") return `An instructional practice focused on ${label}.`;
  return `A support or resource that enables ${label}.`;
}

function descriptionFor(type: SchemaType, label: string): string {
  const map =
    type === "outcome"
      ? OUTCOME_DESCRIPTIONS
      : type === "leap"
        ? LEAP_DESCRIPTIONS
        : type === "practice"
          ? PRACTICE_DESCRIPTIONS
          : SUPPORT_DESCRIPTIONS;
  return map[label] || defaultDescription(type, label);
}

export function listSchemaItems(type?: SchemaType): SchemaItem[] {
  const out: SchemaItem[] = [];

  if (!type || type === "outcome") {
    for (const [domain, strands] of Object.entries(OUTCOME_SCHEMA)) {
      for (const [strand, items] of Object.entries(strands)) {
        for (const label of items) {
          out.push({ type: "outcome", label, description: descriptionFor("outcome", label), categoryPath: [domain, strand] });
        }
      }
    }
  }

  const flat = (t: Exclude<SchemaType, "outcome">, schema: Record<string, string[]>) => {
    for (const [category, items] of Object.entries(schema)) {
      for (const label of items) {
        out.push({ type: t, label, description: descriptionFor(t, label), categoryPath: [category] });
      }
    }
  };

  if (!type || type === "leap") flat("leap", LEAP_SCHEMA);
  if (!type || type === "practice") flat("practice", PRACTICE_SCHEMA);
  if (!type || type === "support") flat("support", SUPPORT_SCHEMA);

  // Stable sort for predictable outputs.
  out.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
  return out;
}

export function searchSchemaItems({
  query,
  type,
  limit = 12,
}: {
  query: string;
  type?: SchemaType;
  limit?: number;
}): { items: SchemaItem[]; total: number } {
  const q = norm(query);
  const items = listSchemaItems(type);
  if (!q) return { items: items.slice(0, limit), total: items.length };

  const scored = items
    .map((it) => {
      const hay = [it.label, it.description, ...it.categoryPath].map(norm).join(" | ");
      const idx = hay.indexOf(q);
      const score =
        idx === -1
          ? 0
          : // prefer label matches, then earlier matches
            (hay.startsWith(norm(it.label)) && norm(it.label).includes(q) ? 5 : 1) + (idx === 0 ? 3 : idx < 20 ? 2 : 1);
      return { it, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.it.label.localeCompare(b.it.label));

  const results = scored.map((s) => s.it);
  return { items: results.slice(0, limit), total: results.length };
}

export function listOutcomesByDomain(domainLabel: string, limit = 20): { items: SchemaItem[]; total: number } {
  const domainKey = domainLabel.trim();
  const domain = OUTCOME_SCHEMA[domainKey as keyof typeof OUTCOME_SCHEMA];
  if (!domain) return { items: [], total: 0 };
  const out: SchemaItem[] = [];
  for (const [strand, labels] of Object.entries(domain)) {
    for (const label of labels) {
      out.push({ type: "outcome", label, description: descriptionFor("outcome", label), categoryPath: [domainKey, strand] });
    }
  }
  out.sort((a, b) => a.categoryPath.join(" / ").localeCompare(b.categoryPath.join(" / ")) || a.label.localeCompare(b.label));
  return { items: out.slice(0, limit), total: out.length };
}

