import React from 'react';
import type { BucketDef, A3Value } from './expert-view-types';

interface A3BucketProps {
  bucket: BucketDef;
  value: A3Value;
  onChange: (value: A3Value) => void;
}

export function A3Bucket({ bucket, value, onChange }: A3BucketProps) {
  const units = bucket.units ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          value={value.value ?? ''}
          onChange={(e) => onChange({ ...value, value: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="0"
          className="w-24 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white text-right"
        />
        <select
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value })}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white text-gray-700 cursor-pointer"
        >
          {!value.unit && <option value="">Select unit</option>}
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        placeholder="Additional notes (optional)..."
        rows={2}
        className="w-full text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white"
      />
    </div>
  );
}
