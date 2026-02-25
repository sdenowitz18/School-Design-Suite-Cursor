"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Filter, Link as LinkIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import OctagonCard from "@/components/octagon-card";
import { toast } from "@/hooks/use-toast";
import { listSchemaItems, type SchemaItem, type SchemaType } from "@/lib/schema-catalog";
import { loadModuleCatalog, type ModuleModel } from "@/lib/module-library/catalog";
import {
  computeAlignment,
  extractBlueprintSignals,
  modelMatchesAllFilters,
  recommendModels,
  type AlignmentLevel,
  type ModuleFilters,
} from "@/lib/module-library/recommend";
import { octagonBgForDomains, outcomeDomainForLabel } from "@/lib/module-library/colors";

type TopTab = "components" | "practices" | "supports" | "principles";
type ComponentSource = "versions" | "other_blueprints" | "catalog";

function levelBadgeClass(l: AlignmentLevel) {
  return l === "H"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : l === "M"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : "bg-gray-100 text-gray-800 border-gray-200";
}

function Pill({
  active,
  children,
  onClick,
  testId,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors",
        active ? "bg-blue-900 text-white border-blue-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
      )}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function MultiSelectFilter({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: SchemaType;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => listSchemaItems(type), [type]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const toggle = (v: string) => {
    const next = new Set(value);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };

  const clear = () => onChange([]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="font-semibold">{label}</span>
            {value.length ? (
              <Badge variant="secondary" className="bg-blue-50 text-blue-800 border border-blue-200">
                {value.length}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[340px] p-0">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup heading={label}>
                {items.map((it: SchemaItem) => {
                  const checked = selectedSet.has(it.label);
                  return (
                    <CommandItem
                      key={it.label}
                      onSelect={() => toggle(it.label)}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{it.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{it.categoryPath.join(" / ")}</div>
                      </div>
                      {checked && <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t border-gray-100 p-2 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={clear} disabled={!value.length}>
              Clear
            </Button>
            <Button size="sm" className="bg-blue-900 hover:bg-blue-800" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {value.length ? (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 2).map((v) => (
            <Badge key={v} variant="secondary" className="bg-gray-100 text-gray-800 border border-gray-200">
              {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                className="ml-1 text-gray-500 hover:text-gray-900"
                aria-label={`Remove ${v}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {value.length > 2 && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-800 border border-gray-200">
              +{value.length - 2}
            </Badge>
          )}
        </div>
      ) : null}
    </div>
  );
}

function alignmentSummary(al: { aims: AlignmentLevel; practices: AlignmentLevel; supports: AlignmentLevel }) {
  return `A:${al.aims} P:${al.practices} S:${al.supports}`;
}

export default function ModuleLibraryPanel({ component }: { component: any | null }) {
  const [topTab, setTopTab] = useState<TopTab>("components");
  const [source, setSource] = useState<ComponentSource>("catalog");

  const [models, setModels] = useState<ModuleModel[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ModuleFilters>({ outcomes: [], leaps: [], practices: [], supports: [] });

  const blueprint = useMemo(() => extractBlueprintSignals(component), [component]);

  const [recommended, setRecommended] = useState<ModuleModel[] | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadModuleCatalog()
      .then((m) => {
        if (cancelled) return;
        setModels(m);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setLoadError(String(e?.message || e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleModels = useMemo(() => {
    const list = models || [];
    const q = search.trim().toLowerCase();
    const bySearch = q
      ? list.filter((m) => `${m.name} ${m.description} ${m.grades}`.toLowerCase().includes(q))
      : list;
    const byFilters = bySearch.filter((m) => modelMatchesAllFilters(m, filters));
    return byFilters;
  }, [filters, models, search]);

  const recommendedModels = useMemo(() => {
    if (!models) return [];
    return recommended ?? [];
  }, [models, recommended]);

  const selectedModel = useMemo(() => {
    const list = models || [];
    const id = selectedModelId;
    if (!id) return null;
    return list.find((m) => m.id === id) ?? null;
  }, [models, selectedModelId]);

  const onRecommend = () => {
    if (!models) return;
    const rec = recommendModels({ models, blueprint, filters, limit: 5 });
    setRecommended(rec);
  };

  const modelsToRender = recommended ? recommendedModels : visibleModels.slice(0, 12);

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900">Module Library</div>
          <div className="text-xs text-gray-500 mt-1">
            Find models and point solutions aligned to <span className="font-semibold text-gray-700">{String(component?.title || component?.nodeId || "this component")}</span>.
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <Pill active={topTab === "components"} onClick={() => setTopTab("components")} testId="ml-tab-components">
          Components
        </Pill>
        <Pill active={topTab === "practices"} onClick={() => setTopTab("practices")} testId="ml-tab-practices">
          Practices
        </Pill>
        <Pill active={topTab === "supports"} onClick={() => setTopTab("supports")} testId="ml-tab-supports">
          Supporting Resources
        </Pill>
        <Pill active={topTab === "principles"} onClick={() => setTopTab("principles")} testId="ml-tab-principles">
          Design Principles
        </Pill>
      </div>

      <div className="flex-1 overflow-y-auto">
        {topTab !== "components" ? (
          <div className="p-6 text-sm text-gray-600">Coming soon.</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill active={source === "versions"} onClick={() => setSource("versions")} testId="ml-source-versions">
                Other versions of this component
              </Pill>
              <Pill
                active={source === "other_blueprints"}
                onClick={() => setSource("other_blueprints")}
                testId="ml-source-blueprints"
              >
                Select from Other Blueprints
              </Pill>
              <Pill active={source === "catalog"} onClick={() => setSource("catalog")} testId="ml-source-catalog">
                Module / Point Solutions Catalog
              </Pill>
            </div>

            {source !== "catalog" ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
                Coming soon.
              </div>
            ) : (
              <>
                {loadError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{loadError}</div>
                ) : null}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      className="bg-blue-900 hover:bg-blue-800 gap-2"
                      onClick={onRecommend}
                      disabled={!models || models.length === 0}
                      data-testid="ml-recommend"
                    >
                      <Sparkles className="w-4 h-4" />
                      Recommend Models / Point Solutions
                    </Button>
                    {recommended ? (
                      <Button variant="outline" onClick={() => setRecommended(null)} data-testid="ml-clear-recommendations">
                        Clear recommendations
                      </Button>
                    ) : null}
                  </div>

                  <div className="w-[260px]">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search models..."
                      data-testid="ml-search"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <MultiSelectFilter
                    label="Outcomes"
                    type={"outcome" as SchemaType}
                    value={filters.outcomes}
                    onChange={(next) => setFilters((f) => ({ ...f, outcomes: next }))}
                  />
                  <MultiSelectFilter
                    label="Leaps"
                    type={"leap" as SchemaType}
                    value={filters.leaps}
                    onChange={(next) => setFilters((f) => ({ ...f, leaps: next }))}
                  />
                  <MultiSelectFilter
                    label="Practices"
                    type={"practice" as SchemaType}
                    value={filters.practices}
                    onChange={(next) => setFilters((f) => ({ ...f, practices: next }))}
                  />
                  <MultiSelectFilter
                    label="Supporting Resources"
                    type={"support" as SchemaType}
                    value={filters.supports}
                    onChange={(next) => setFilters((f) => ({ ...f, supports: next }))}
                  />
                </div>

                {selectedModel ? (
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedModelId(null)} data-testid="ml-back">
                          <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{selectedModel.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{selectedModel.grades}</div>
                        </div>
                      </div>
                      {selectedModel.link ? (
                        <a
                          className="text-xs font-semibold text-blue-800 hover:underline inline-flex items-center gap-1"
                          href={selectedModel.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          Model link
                        </a>
                      ) : null}
                    </div>

                    <div className="p-5 space-y-6">
                      <div className="text-sm text-gray-700 leading-relaxed">{selectedModel.description}</div>

                      {(() => {
                        const overlap = {
                          outcomes: new Set(selectedModel.outcomes.filter((o) => blueprint.outcomes.has(o))),
                          leaps: new Set(selectedModel.leaps.filter((l) => blueprint.leaps.has(l))),
                          practices: new Set(selectedModel.practices.filter((p) => blueprint.practices.has(p))),
                          supports: new Set(selectedModel.supports.filter((s) => blueprint.supports.has(s))),
                        };

                        const section = (title: string, items: string[], overlaps: Set<string>) => (
                          <div>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {items.length ? (
                                items.map((it) => (
                                  <Badge
                                    key={it}
                                    variant="secondary"
                                    className={cn(
                                      "border",
                                      overlaps.has(it)
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : "bg-gray-100 text-gray-800 border-gray-200",
                                    )}
                                  >
                                    {it}
                                  </Badge>
                                ))
                              ) : (
                                <div className="text-xs text-gray-400">—</div>
                              )}
                            </div>
                          </div>
                        );

                        return (
                          <div className="space-y-5">
                            <div className="text-sm font-bold text-gray-900">Designed Experience</div>
                            {section("Outcomes", selectedModel.outcomes, overlap.outcomes)}
                            {section("Leaps", selectedModel.leaps, overlap.leaps)}
                            {section("Key Practices", selectedModel.practices, overlap.practices)}
                            {section("Supporting Resources & Routines", selectedModel.supports, overlap.supports)}
                          </div>
                        );
                      })()}

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Key Design Artifacts</div>
                        <div className="text-sm text-gray-700 mt-2">
                          Prototype: artifacts will appear here once we wire in real content.
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() =>
                            toast({
                              title: "Prototype",
                              description: "Add Model to Blueprint (dummy for now).",
                            })
                          }
                          data-testid="ml-add-blueprint"
                        >
                          Add Model to Blueprint
                        </Button>
                        <Button
                          className="bg-blue-900 hover:bg-blue-800"
                          onClick={() =>
                            toast({
                              title: "Prototype",
                              description: "Add Model as Subcomponent (dummy for now).",
                            })
                          }
                          data-testid="ml-add-subcomponent"
                        >
                          Add Model as Subcomponent
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {modelsToRender.map((m) => {
                        const domains = m.outcomes.map(outcomeDomainForLabel);
                        const bg = octagonBgForDomains(domains);
                        const align = computeAlignment(m, blueprint);
                        return (
                          <div key={m.id} className="flex flex-col gap-3 items-center">
                            <OctagonCard
                              title={m.name}
                              subtitle="Model"
                              description={m.description}
                              bgClassName={bg}
                              footerLabel="Alignment"
                              footerValue={alignmentSummary(align)}
                              onClick={() => setSelectedModelId(m.id)}
                              testId={`ml-model-${m.id}`}
                            />
                            <div className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-gray-900">Assessed alignment</div>
                                <div className="text-gray-500">{m.grades}</div>
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                {(
                                  [
                                    { k: "Aims", v: align.aims },
                                    { k: "Practices", v: align.practices },
                                    { k: "Supports", v: align.supports },
                                  ] as const
                                ).map((x) => (
                                  <div key={x.k} className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-center">
                                    <div className="text-[10px] text-gray-500 font-semibold">{x.k}</div>
                                    <div className={cn("mt-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full border text-xs font-bold", levelBadgeClass(x.v))}>
                                      {x.v}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!modelsToRender.length ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
                        No models match your filters.
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

