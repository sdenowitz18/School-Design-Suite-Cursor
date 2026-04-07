import React from 'react';
import { cn } from '@/lib/utils';
import type { BucketDef, A2TensionValue } from './expert-view-types';

interface A2TensionBucketProps {
  bucket: BucketDef;
  value: A2TensionValue;
  onChange: (v: A2TensionValue) => void;
}

export function A2TensionBucket({ bucket, value, onChange }: A2TensionBucketProps) {
  const pairs = bucket.tensions ?? [];
  const selections = value.selections ?? {};

  function setSide(id: string, side: 'left' | 'right') {
    const cur = selections[id];
    onChange({
      selections: { ...selections, [id]: cur === side ? null : side },
    });
  }

  return (
    <div className="space-y-4">
      {pairs.map((t) => {
        const sel = selections[t.id] ?? null;
        return (
          <div key={t.id} className="rounded-lg border border-gray-200 bg-gray-50/40 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-800 leading-snug">{t.question}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setSide(t.id, 'left')}
                className={cn(
                  'flex-1 text-left text-sm px-4 py-3 rounded-lg border transition-colors',
                  sel === 'left'
                    ? 'border-purple-400 bg-purple-50 text-purple-900 ring-1 ring-purple-200'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                )}
              >
                {t.leftLabel}
              </button>
              <button
                type="button"
                onClick={() => setSide(t.id, 'right')}
                className={cn(
                  'flex-1 text-left text-sm px-4 py-3 rounded-lg border transition-colors',
                  sel === 'right'
                    ? 'border-purple-400 bg-purple-50 text-purple-900 ring-1 ring-purple-200'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                )}
              >
                {t.rightLabel}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
