import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { A3RatioValue } from './expert-view-types';

interface A3RatioBucketProps {
  value: A3RatioValue;
  onChange: (value: A3RatioValue) => void;
}

export function A3RatioBucket({ value, onChange }: A3RatioBucketProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* Learners */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Learners</label>
          <input
            type="number"
            min={1}
            value={value.learners ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                learners: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="e.g. 25"
            className="w-24 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white tabular-nums"
          />
        </div>

        <span className="text-lg text-gray-400 font-light mt-5">:</span>

        {/* Facilitators */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Facilitators</label>
          <input
            type="number"
            min={1}
            value={value.facilitators ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                facilitators: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="e.g. 1"
            className="w-24 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white tabular-nums"
          />
        </div>

        {value.learners != null && value.facilitators != null && (
          <span className="mt-5 text-sm text-gray-500 font-medium tabular-nums">
            = {value.learners}:{value.facilitators}
          </span>
        )}
      </div>

      {/* Mark as key */}
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
