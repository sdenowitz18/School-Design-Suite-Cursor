import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { A3PairValue, BucketDef } from './expert-view-types';

interface A3PairBucketProps {
  bucket: BucketDef;
  value: A3PairValue;
  onChange: (value: A3PairValue) => void;
}

export function A3PairBucket({ bucket, value, onChange }: A3PairBucketProps) {
  const [firstLabel, secondLabel] = bucket.pairLabels ?? ['First', 'Second'];
  const [firstPh, secondPh] = bucket.pairPlaceholders ?? ['e.g. 0', 'e.g. 0'];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">{firstLabel}</label>
          <input
            type="number"
            min={0}
            value={value.first ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                first: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder={firstPh}
            className="w-28 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">{secondLabel}</label>
          <input
            type="number"
            min={0}
            value={value.second ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                second: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder={secondPh}
            className="w-28 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white tabular-nums"
          />
        </div>
      </div>

      <button
        onClick={() => onChange({ ...value, isKey: !value.isKey })}
        className={cn(
          'flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors w-fit',
          value.isKey
            ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
            : 'text-gray-400 border-transparent hover:border-gray-200 hover:bg-gray-50',
        )}
      >
        <Star className={cn('w-3 h-3', value.isKey ? 'fill-purple-600 text-purple-600' : 'text-gray-300')} />
        {value.isKey ? 'Key' : 'Mark as key'}
      </button>
    </div>
  );
}
