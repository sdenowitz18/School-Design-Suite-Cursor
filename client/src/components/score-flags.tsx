"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Flag, FlagTriangleRight } from "lucide-react";

export type ScoreFlagItem = {
  key: string;
  label: string;
  score: number | null;
};

export type SignalFlagItem = {
  key: string;
  label: string;
  value: number | null; // positive = tailwind/up, negative = headwind/down
};

function scoreChip(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-400 border-gray-200";
  if (score >= 4) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function round1(x: number) {
  // Keep helper (used for signal values), but scores are now whole numbers.
  return Math.round(x * 10) / 10;
}

function roundClamp1to5(n: number): number {
  if (!Number.isFinite(n)) return 3;
  const r = Math.round(n);
  if (r < 1) return 1;
  if (r > 5) return 5;
  return r;
}

export default function ScoreFlags({
  overallScore,
  items,
  threshold = 2,
  maxPerSide,
  title = "Flags",
  collapsible = true,
  defaultOpen = false,
  className,
  testId,
}: {
  overallScore: number | null;
  items: ScoreFlagItem[];
  threshold?: number;
  maxPerSide?: number;
  title?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  testId?: string;
}) {
  const { up, down } = useMemo(() => {
    const baseRaw = overallScore;
    if (baseRaw === null || baseRaw === undefined) return { up: [] as any[], down: [] as any[] };
    const base = roundClamp1to5(Number(baseRaw));
    const eligible = (Array.isArray(items) ? items : [])
      .filter((it) => it && it.score !== null && it.score !== undefined)
      .map((it) => ({
        ...it,
        roundedScore: roundClamp1to5(Number(it.score)),
        delta: roundClamp1to5(Number(it.score)) - base,
      }))
      .filter((it) => Math.abs(it.delta) >= threshold);

    const rawUp = eligible.filter((x) => x.delta >= threshold).sort((a, b) => b.delta - a.delta);
    const rawDown = eligible.filter((x) => x.delta <= -threshold).sort((a, b) => a.delta - b.delta);
    const lim = typeof maxPerSide === "number" && maxPerSide > 0 ? maxPerSide : null;
    return { up: lim ? rawUp.slice(0, lim) : rawUp, down: lim ? rawDown.slice(0, lim) : rawDown };
  }, [items, maxPerSide, overallScore, threshold]);

  const count = up.length + down.length;

  const Content = (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      {overallScore === null ? (
        <div className="text-xs text-gray-400 italic">No flags until an overall score is available.</div>
      ) : count === 0 ? (
        <div className="text-xs text-gray-400 italic">No flags (nothing differs from overall by {threshold}+ points).</div>
      ) : (
        <div className="space-y-2">
          {up.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                <Flag className="w-3 h-3" /> Sub area of excellence
              </div>
              <div className="space-y-1">
                {up.map((it) => (
                  <div key={it.key} className="flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={cn("w-7 h-6 rounded flex items-center justify-center text-[11px] font-bold border shrink-0", scoreChip(it.roundedScore))}>
                        {String(it.roundedScore)}
                      </span>
                      <span className="text-gray-700 truncate">{it.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {down.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-red-700 uppercase tracking-wide flex items-center gap-1">
                <FlagTriangleRight className="w-3 h-3" /> Sub area of concern
              </div>
              <div className="space-y-1">
                {down.map((it) => (
                  <div key={it.key} className="flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={cn("w-7 h-6 rounded flex items-center justify-center text-[11px] font-bold border shrink-0", scoreChip(it.roundedScore))}>
                        {String(it.roundedScore)}
                      </span>
                      <span className="text-gray-700 truncate">{it.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  if (!collapsible) return Content;

  return (
    <Collapsible defaultOpen={defaultOpen} data-testid={testId ? `${testId}-collapsible` : undefined}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <ChevronDown className="w-4 h-4 text-gray-400" />
            {title}
          </button>
        </CollapsibleTrigger>
        <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
          {count}
        </Badge>
      </div>
      <CollapsibleContent className="pt-2">{Content}</CollapsibleContent>
    </Collapsible>
  );
}

export function SignalFlags({
  title = "Flags",
  items,
  maxPerSide = 3,
  showValues = true,
  collapsible = true,
  defaultOpen = false,
  className,
  testId,
}: {
  title?: string;
  items: SignalFlagItem[];
  maxPerSide?: number;
  showValues?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  testId?: string;
}) {
  const { up, down } = useMemo(() => {
    const eligible = (Array.isArray(items) ? items : []).filter((it) => it && it.value !== null && it.value !== undefined) as Array<
      SignalFlagItem & { value: number }
    >;
    const pos = eligible.filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, Math.max(1, maxPerSide));
    const neg = eligible.filter((x) => x.value < 0).sort((a, b) => a.value - b.value).slice(0, Math.max(1, maxPerSide));
    return { up: pos, down: neg };
  }, [items, maxPerSide]);

  const count = up.length + down.length;
  const Content = (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      {count === 0 ? (
        <div className="text-xs text-gray-400 italic">No flags yet.</div>
      ) : (
        <div className="space-y-2">
          {up.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                <Flag className="w-3 h-3" /> Sub area of excellence
              </div>
              <div className="space-y-1">
                {up.map((it) => (
                  <div key={it.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-700 truncate">{it.label}</span>
                    {showValues ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] h-5 shrink-0">
                        +{String(round1(it.value))}
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {down.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-red-700 uppercase tracking-wide flex items-center gap-1">
                <FlagTriangleRight className="w-3 h-3" /> Sub area of concern
              </div>
              <div className="space-y-1">
                {down.map((it) => (
                  <div key={it.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-700 truncate">{it.label}</span>
                    {showValues ? (
                      <Badge className="bg-red-50 text-red-700 border border-red-200 text-[10px] h-5 shrink-0">
                        {String(round1(it.value))}
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  if (!collapsible) return Content;

  return (
    <Collapsible defaultOpen={defaultOpen} data-testid={testId ? `${testId}-collapsible` : undefined}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <ChevronDown className="w-4 h-4 text-gray-400" />
            {title}
          </button>
        </CollapsibleTrigger>
        <Badge variant="secondary" className="text-[9px] h-5 bg-gray-200 text-gray-600">
          {count}
        </Badge>
      </div>
      <CollapsibleContent className="pt-2">{Content}</CollapsibleContent>
    </Collapsible>
  );
}

