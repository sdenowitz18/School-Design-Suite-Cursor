import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { YearlyScheduleEntry, YearlyScheduleValue } from './expert-view-types';

const COMMON_LABELS = [
  'School year',
  'Fall break',
  'Thanksgiving break',
  'Winter break',
  'Spring break',
  'Professional development day',
  'Testing week',
  'Graduation',
];

interface Props {
  value: YearlyScheduleValue;
  onChange: (v: YearlyScheduleValue) => void;
}

export function YearlyScheduleBucket({ value, onChange }: Props) {
  const entries = value.entries ?? [];

  function addEntry() {
    const id = `entry-${Date.now()}`;
    onChange({ entries: [...entries, { id, label: '', startDate: '', endDate: '' }] });
  }

  function updateEntry(id: string, patch: Partial<YearlyScheduleEntry>) {
    onChange({ entries: entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  function removeEntry(id: string) {
    onChange({ entries: entries.filter((e) => e.id !== id) });
  }

  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center mb-1">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide pl-1">Label</span>
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">Start</span>
          <span />
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">End</span>
          <span />
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center p-2 rounded-lg border border-gray-200 bg-gray-50/50">
          <input
            type="text"
            value={entry.label}
            onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
            placeholder="e.g. First day of school"
            list="yearly-schedule-labels"
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 w-full"
          />
          <datalist id="yearly-schedule-labels">
            {COMMON_LABELS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>

          <input
            type="date"
            value={entry.startDate}
            onChange={(e) => updateEntry(entry.id, { startDate: e.target.value })}
            className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300"
          />

          <span className="text-xs text-gray-400">to</span>

          <input
            type="date"
            value={entry.endDate}
            onChange={(e) => updateEntry(entry.id, { endDate: e.target.value })}
            className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300"
          />

          <button
            onClick={() => removeEntry(entry.id)}
            className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addEntry}
        className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors pt-1"
      >
        <Plus className="w-4 h-4" />
        Add date
      </button>
    </div>
  );
}
