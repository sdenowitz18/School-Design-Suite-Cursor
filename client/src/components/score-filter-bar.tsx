"use client";

import { cn } from "@/lib/utils";
import type { ScoreFilter } from "@shared/schema";
import { UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";
import { listSelectableQuarterKeys, listSelectableSemesterKeys, listSelectableYearKeys } from "@shared/marking-period";
import { useMemo } from "react";

export default function ScoreFilterBar({
  filter,
  onChange,
  actors = [],
  className,
  testId,
}: {
  filter: ScoreFilter;
  onChange: (next: ScoreFilter) => void;
  actors?: string[];
  className?: string;
  testId?: string;
}) {
  const yearKeys = listSelectableYearKeys(new Date(), 5);
  const semesterKeys = listSelectableSemesterKeys(new Date(), 5);
  const quarterKeys = listSelectableQuarterKeys(new Date(), 5);

  const effectiveMode = (filter as any)?.mode || "none";
  const mode = effectiveMode === "none" ? "year" : effectiveMode;
  const actorKey = String((filter as any)?.actorKey || "");

  const markingPeriodValue =
    mode === "year"
      ? `year:${String((filter as any)?.yearKey || yearKeys[0])}`
      : mode === "semester"
        ? `sem:${String((filter as any)?.semesterKey || semesterKeys[0])}`
        : mode === "quarter"
          ? `qtr:${String((filter as any)?.quarterKey || quarterKeys[0])}`
        : `year:${String((filter as any)?.yearKey || yearKeys[0])}`;

  const markingPeriodOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const y of yearKeys) {
      opts.push({ value: `year:${y}`, label: String(y) });
      opts.push({ value: `sem:${y}-Fall`, label: `${y} S1` });
      opts.push({ value: `sem:${y}-Spring`, label: `${y} S2` });
      opts.push({ value: `qtr:${y}-Q1`, label: `${y} Q1` });
      opts.push({ value: `qtr:${y}-Q2`, label: `${y} Q2` });
      opts.push({ value: `qtr:${y}-Q3`, label: `${y} Q3` });
      opts.push({ value: `qtr:${y}-Q4`, label: `${y} Q4` });
    }
    return opts;
  }, [yearKeys]);

  const normalizedActors = useMemo(() => {
    const out: { label: string; key: string }[] = [];
    const seen = new Set<string>();
    const list = Array.isArray(actors) ? actors : [];
    for (const a of list) {
      const label = String(a || "").trim();
      if (!label) continue;
      const key = normActor(label);
      if (!key || key === UNKNOWN_ACTOR_KEY) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, key });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [actors]);

  return (
    <section
      className={cn("bg-white rounded-xl shadow-sm border border-gray-200 p-4", className)}
      data-testid={testId || "score-filter-bar"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Score filter</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* Marking period selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-600">Marking period</span>
          <select
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
            value={markingPeriodValue}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v.startsWith("year:")) {
                const yearKey = v.slice("year:".length);
                onChange({ ...(filter as any), mode: "year", yearKey, semesterKey: undefined, quarterKey: undefined } as any);
                return;
              }
              if (v.startsWith("sem:")) {
                const semesterKey = v.slice("sem:".length);
                onChange({ ...(filter as any), mode: "semester", semesterKey, yearKey: undefined, quarterKey: undefined } as any);
                return;
              }
              if (v.startsWith("qtr:")) {
                const quarterKey = v.slice("qtr:".length);
                onChange({ ...(filter as any), mode: "quarter", quarterKey, yearKey: undefined, semesterKey: undefined } as any);
                return;
              }
            }}
          >
            {markingPeriodOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actor filter — always visible when actors are available */}
        {normalizedActors.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-600">Actor</span>
            <select
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700"
              value={actorKey ? normActor(actorKey) : ""}
              onChange={(e) => {
                const v = e.currentTarget.value;
                onChange({ ...(filter as any), actorKey: v || undefined } as any);
              }}
            >
              <option value="">All actors</option>
              {normalizedActors.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </section>
  );
}
