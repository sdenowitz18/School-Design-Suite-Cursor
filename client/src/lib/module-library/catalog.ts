"use client";

import { parseCsvAsObjects } from "./csv";
import { fuzzyMapLabel, splitCsvList } from "./fuzzy-map";

export type ModuleModel = {
  id: string;
  name: string;
  grades: string;
  description: string;
  link?: string;
  outcomes: string[];
  practices: string[];
  supports: string[];
  leaps: string[];
  raw: {
    outcomeTypes: string[];
    keyPractices: string[];
    implementationSupports: string[];
  };
};

function stableId(seed: string) {
  return seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inferLeapsFromText(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  const add = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  if (/(autonomy|agency|self|ownership)/.test(t)) add("Agency");
  if (/(community|belonging|relationship|connection)/.test(t)) add("Connection & community");
  if (/(rigor|high expectations|challenging)/.test(t)) add("High expectations with rigorous learning");
  if (/(relevance|real-world|purpose|meaningful)/.test(t)) add("Relevance");
  if (/(custom|personalized|individualized|pathway)/.test(t)) add("Customization");
  if (/(whole-child|social emotional|well-being)/.test(t)) add("Whole-child focus");
  return out;
}

let cache: ModuleModel[] | null = null;

export async function loadModuleCatalog(): Promise<ModuleModel[]> {
  if (cache) return cache;
  const res = await fetch("/module-library/curriculum-models.csv", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load module catalog (${res.status})`);
  const text = await res.text();
  const rows = parseCsvAsObjects(text);

  const models: ModuleModel[] = rows.map((r) => {
    const name = r["Model Name"] || r["Model"] || "Untitled Model";
    const description = r["Description"] || "";
    const grades = r["Grades"] || "";
    const link = r["Model Link"] || "";

    const outcomeTypesRaw = splitCsvList(r["Outcome Types"] || "");
    const keyPracticesRaw = splitCsvList(r["Key Practices"] || "");
    const implSupportsRaw = splitCsvList(r["Implementation Supports"] || "");

    const seed = stableId(name);

    const outcomes = outcomeTypesRaw
      .map((raw) => fuzzyMapLabel({ type: "outcome", raw, seed }).mapped)
      .filter(Boolean) as string[];
    const practices = keyPracticesRaw
      .map((raw) => fuzzyMapLabel({ type: "practice", raw, seed }).mapped)
      .filter(Boolean) as string[];
    const supports = implSupportsRaw
      .map((raw) => fuzzyMapLabel({ type: "support", raw, seed }).mapped)
      .filter(Boolean) as string[];
    const leaps = inferLeapsFromText([name, description].filter(Boolean).join(" "));

    return {
      id: seed || stableId(`${name}-${grades}`) || `model-${Math.random().toString(16).slice(2)}`,
      name,
      grades,
      description,
      link: link || undefined,
      outcomes: Array.from(new Set(outcomes)),
      practices: Array.from(new Set(practices)),
      supports: Array.from(new Set(supports)),
      leaps,
      raw: {
        outcomeTypes: outcomeTypesRaw,
        keyPractices: keyPracticesRaw,
        implementationSupports: implSupportsRaw,
      },
    };
  });

  cache = models;
  return models;
}

