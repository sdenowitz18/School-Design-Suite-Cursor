"use client";

import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { componentQueries } from "@/lib/api";
import type { PortraitOfGraduate } from "./pog-types";
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
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-sm text-muted-foreground">All Portrait attributes (read-only summary)</div>
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
              className="rounded-lg border p-4 bg-background text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-md border flex items-center justify-center text-base shrink-0">{a.icon || "★"}</div>
                    <div className="font-medium truncate">{a.name || "Untitled attribute"}</div>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {a.description || "No description yet."}
                  </div>
                </div>
              </div>

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
            </button>
          );
        })}
      </div>
    </div>
  );
}

