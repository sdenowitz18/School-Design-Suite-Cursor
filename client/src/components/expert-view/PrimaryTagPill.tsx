import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Matches A-1 `PrimaryPill` in A1Bucket — shared visual language with Key Design / Elements expert tags. */

export type PrimaryTagPillSecondary = { id: string; label: string };

export type PrimaryTagPillSelection = {
  isKey: boolean;
  selectedSecondaryIds: string[];
  /** When secondaries are selected, keyed secondary ids (A-1: key lives at refinement level). */
  secondaryKeys?: Record<string, boolean>;
};

export function PrimaryTagPill({
  label,
  secondaries,
  selection,
  onToggle,
  onKeyToggle,
  onSecondaryToggle,
  /** Toggle “key” for a selected secondary (omit when keys are only edited in note blocks). */
  onSecondaryKeyToggle,
  /** `a1` = star only when no secondaries (expert A-1). `always` = star whenever selected (e.g. Learners summaries). */
  starMode = 'a1',
}: {
  label: string;
  secondaries?: PrimaryTagPillSecondary[];
  selection: PrimaryTagPillSelection | null;
  onToggle: () => void;
  onKeyToggle: () => void;
  onSecondaryToggle: (secondaryId: string) => void;
  onSecondaryKeyToggle?: (secondaryId: string) => void;
  starMode?: 'a1' | 'always';
}) {
  const isSelected = selection !== null;
  const hasSecondaries = (secondaries?.length ?? 0) > 0;
  const nSec = selection?.selectedSecondaryIds.length ?? 0;
  const showPrimaryStar =
    isSelected &&
    (starMode === 'always' || nSec === 0);

  return (
    <div
      className={cn(
        'inline-flex flex-col rounded-full transition-all cursor-pointer select-none',
        isSelected
          ? 'rounded-xl border border-purple-300 bg-purple-50 shadow-sm'
          : 'rounded-full border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
      )}
      style={{ display: 'inline-flex' }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <span
          className={cn('text-sm transition-colors', isSelected ? 'text-purple-800 font-medium' : 'text-gray-700')}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {label}
        </span>
        {showPrimaryStar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onKeyToggle();
            }}
            className="ml-0.5 focus:outline-none"
            title={selection?.isKey ? 'Remove key' : 'Mark as key'}
          >
            <Star
              className={cn(
                'w-3.5 h-3.5 transition-colors',
                selection?.isKey ? 'fill-purple-600 text-purple-600' : 'text-gray-300 hover:text-purple-400',
              )}
            />
          </button>
        )}
      </div>

      {isSelected && hasSecondaries && secondaries && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {secondaries.map((sec) => {
            const isSecSelected = selection!.selectedSecondaryIds.includes(sec.id);
            const secKey = !!(selection!.secondaryKeys?.[sec.id]);
            if (!isSecSelected) {
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSecondaryToggle(sec.id);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors',
                    'bg-white text-gray-600 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                  )}
                >
                  {sec.label}
                </button>
              );
            }
            return (
              <div
                key={sec.id}
                className="inline-flex items-center gap-0.5 rounded-full border bg-emerald-100 border-emerald-300 pr-0.5"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSecondaryToggle(sec.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-emerald-800 font-medium"
                >
                  {sec.label}
                  {!onSecondaryKeyToggle && secKey && (
                    <Star className="w-3 h-3 fill-emerald-600 text-emerald-600 flex-shrink-0" />
                  )}
                </button>
                {onSecondaryKeyToggle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSecondaryKeyToggle(sec.id);
                    }}
                    className="p-1 rounded-full focus:outline-none shrink-0"
                    title={secKey ? 'Remove key' : 'Mark as key'}
                  >
                    <Star
                      className={cn(
                        'w-3 h-3 flex-shrink-0',
                        secKey
                          ? 'fill-emerald-600 text-emerald-600'
                          : 'text-gray-400 hover:text-emerald-600',
                      )}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
