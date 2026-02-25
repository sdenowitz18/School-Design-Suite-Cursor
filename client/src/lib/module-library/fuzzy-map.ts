"use client";

import { listSchemaItems, type SchemaItem, type SchemaType } from "@/lib/schema-catalog";

function norm(s: string) {
  return s.trim().toLowerCase();
}

function tokenize(s: string) {
  return norm(s)
    .replace(/[^a-z0-9\s&/-]+/g, " ")
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  sa.forEach((x) => {
    if (sb.has(x)) inter++;
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function scoreMatch(query: string, item: SchemaItem): number {
  const q = norm(query);
  const label = norm(item.label);
  const cat = item.categoryPath.map(norm).join(" / ");

  let score = 0;
  if (!q) return 0;
  if (label === q) score += 10;
  if (label.includes(q) || q.includes(label)) score += 6;
  if (cat.includes(q)) score += 4;

  const qt = tokenize(query);
  const it = tokenize([item.label, item.description, ...item.categoryPath].join(" "));
  score += jaccard(qt, it) * 6;

  return score;
}

function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

export function fuzzyBestMatches(type: SchemaType, query: string, limit = 5): SchemaItem[] {
  const items = listSchemaItems(type);
  const scored = items
    .map((it) => ({ it, score: scoreMatch(query, it) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.it.label.localeCompare(b.it.label));
  return scored.slice(0, limit).map((x) => x.it);
}

export function fuzzyMapLabel({
  type,
  raw,
  seed,
  topN = 4,
}: {
  type: SchemaType;
  raw: string;
  seed: string;
  topN?: number;
}): { mapped: string | null; candidates: string[] } {
  const q = raw.trim();
  if (!q) return { mapped: null, candidates: [] };
  const matches = fuzzyBestMatches(type, q, topN);
  if (matches.length === 0) return { mapped: null, candidates: [] };
  // deterministic “random”: pick from topN based on seed+raw hash
  const idx = djb2Hash(`${seed}::${type}::${q}`) % matches.length;
  return { mapped: matches[idx]!.label, candidates: matches.map((m) => m.label) };
}

export function splitCsvList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

