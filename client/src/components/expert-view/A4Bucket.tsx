import React from 'react';
import { cn } from '@/lib/utils';
import type { BucketDef, A4Value } from './expert-view-types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RECURRENCE_OPTIONS = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly'];

interface A4BucketProps {
  bucket: BucketDef;
  value: A4Value;
  onChange: (value: A4Value) => void;
}

export function A4Bucket({ bucket: _bucket, value, onChange }: A4BucketProps) {
  function toggleDay(day: string) {
    const next = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day];
    onChange({ ...value, days: next });
  }

  return (
    <div className="space-y-4">
      {/* Days of week */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Days of the week</p>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={cn(
                'w-10 h-10 rounded-full text-xs font-medium border transition-colors',
                value.days.includes(day)
                  ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50',
              )}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Time of day */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Time of day</p>
        <input
          type="time"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white text-gray-700"
        />
      </div>

      {/* Recurrence */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium">Recurrence</p>
        <div className="flex gap-2 flex-wrap">
          {RECURRENCE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange({ ...value, recurrence: value.recurrence === opt ? '' : opt })}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                value.recurrence === opt
                  ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <textarea
        value={value.notes}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        placeholder="Additional notes on timing (optional)..."
        rows={2}
        className="w-full text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white"
      />
    </div>
  );
}
