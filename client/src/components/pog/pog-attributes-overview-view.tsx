"use client";

import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { componentQueries } from "@/lib/api";
import type { PortraitOfGraduate } from "./pog-types";
import { POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI } from "./pog-feature-flags";
import { buildWhereBuiltForOutcomeKeys, normKey } from "./pog-utils";
import PogOutcomePill from "./pog-outcome-pill";
import { cn } from "@/lib/utils";

function scoreChipClass(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-500 border-gray-200";
  if (score >= 4) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

export default function PogAttributesOverviewView({
  portrait,
  onBack,
  onOpenAttribute,
}: {
  portrait: PortraitOfGraduate;
  onBack: () => void;
  onOpenAttribute: (attributeId: string) => void;
}) {
  const showAdvanced = POG_SHOW_OUTCOME_LINKING_AND_ADVANCED_UI;
  const { data: allComponents } = useQuery(componentQueries.all);

  const whereBuiltCountByAttrId = useMemo(() => {
    const map = new Map<string, number>();
    for (const attr of portrait.attributes || []) {
      const links = portrait.linksByAttributeId?.[attr.id] || [];
      const keys = new Set((Array.isArray(links) ? links : []).map((l: any) => normKey(l?.outcomeLabel)).filter(Boolean));
      const refs = buildWhereBuiltForOutcomeKeys((allComponents as any[]) || [], keys);
      map.set(attr.id, refs.length);
    }
    return map;
  }, [allComponents, portrait.attributes, portrait.linksByAttributeId]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 pb-20 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">All attributes</h1>
        <p className="text-sm text-gray-500 mt-1">Read-only summary — tap a card to open details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(portrait.attributes || []).map((a) => {
          const links = portrait.linksByAttributeId?.[a.id] || [];
          const preview = (Array.isArray(links) ? links : []).slice(0, 4);
          const whereBuiltCount = whereBuiltCountByAttrId.get(a.id) || 0;
          const score = (a as any)?.score1to5 ?? null;
          const builtPercent = (a as any)?.builtPercent ?? null;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpenAttribute(a.id)}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-left hover:bg-gray-50/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-md border border-gray-200 flex items-center justify-center text-base shrink-0 bg-gray-50">
                      {a.icon || "★"}
                    </div>
                    <div className="font-medium truncate text-gray-900">{a.name || "Untitled attribute"}</div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 line-clamp-2">{a.description || "No description yet."}</div>
                </div>
              </div>

              {showAdvanced ? (
                <>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{(Array.isArray(links) ? links.length : 0)} supporting outcomes</span>
                    <span>{whereBuiltCount} where built</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className={cn("px-2 py-1 rounded border text-xs font-semibold", scoreChipClass(score))}>
                      Score: {score ?? "—"}
                    </span>
                    <span className="px-2 py-1 rounded border text-xs font-semibold bg-gray-100 text-gray-700">
                      Built: {builtPercent === null ? "—" : `${builtPercent}%`}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {preview.map((l: any) => (
                      <PogOutcomePill
                        key={`${a.id}:${normKey(l?.outcomeLabel)}`}
                        label={String(l?.outcomeLabel || "")}
                        meta={(l as any)?.priority || "M"}
                        className="max-w-[220px]"
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
