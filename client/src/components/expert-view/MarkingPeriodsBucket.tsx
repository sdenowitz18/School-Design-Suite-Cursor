import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarkingPeriod, MarkingPeriodsValue, MarkingPeriodType } from './expert-view-types';

const PERIOD_TYPES: { id: MarkingPeriodType; label: string; description: string }[] = [
  { id: 'semester', label: 'Semester', description: '2 periods' },
  { id: 'trimester', label: 'Trimester', description: '3 periods' },
  { id: 'quarter', label: 'Quarter', description: '4 periods' },
];

const DEFAULT_NAMES: Record<MarkingPeriodType, string[]> = {
  semester: ['Semester 1', 'Semester 2'],
  trimester: ['Trimester 1', 'Trimester 2', 'Trimester 3'],
  quarter: ['Q1', 'Q2', 'Q3', 'Q4'],
};

const SHORT_PREFIX: Record<MarkingPeriodType, string> = {
  semester: 'Semester',
  trimester: 'Trimester',
  quarter: 'Q',
};

function buildDefaultPeriods(type: MarkingPeriodType): MarkingPeriod[] {
  return DEFAULT_NAMES[type].map((name, i) => ({
    id: `period-${i}`,
    name,
    startDate: '',
    endDate: '',
  }));
}

interface Props {
  value: MarkingPeriodsValue;
  onChange: (v: MarkingPeriodsValue) => void;
}

export function MarkingPeriodsBucket({ value, onChange }: Props) {
  const periods = value.periods ?? [];

  function selectType(type: MarkingPeriodType) {
    onChange({ periodType: type, periods: buildDefaultPeriods(type) });
  }

  function updatePeriod(id: string, patch: Partial<MarkingPeriod>) {
    onChange({ ...value, periods: periods.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }

  function addPeriod() {
    const num = periods.length + 1;
    const prefix = value.periodType ? SHORT_PREFIX[value.periodType] : 'Period';
    onChange({
      ...value,
      periods: [
        ...periods,
        { id: `period-${Date.now()}`, name: `${prefix} ${num}`, startDate: '', endDate: '' },
      ],
    });
  }

  function removePeriod(id: string) {
    onChange({ ...value, periods: periods.filter((p) => p.id !== id) });
  }

  return (
    <div className="space-y-5">
      {/* Period type selector */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">How is the year divided?</p>
        <div className="flex gap-2">
          {PERIOD_TYPES.map((type) => {
            const isActive = value.periodType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => selectType(type.id)}
                className={cn(
                  'flex flex-col items-start px-4 py-2.5 rounded-lg text-sm border transition-colors',
                  isActive
                    ? 'bg-purple-50 text-purple-700 border-purple-300 font-medium'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                <span className="font-medium">{type.label}</span>
                <span className={cn('text-[11px] mt-0.5', isActive ? 'text-purple-400' : 'text-gray-400')}>
                  {type.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Periods list */}
      {value.periodType && (
        <div className="space-y-2">
          {periods.length > 0 && (
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center mb-1 pl-1">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Period</span>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">Start</span>
              <span />
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">End</span>
              <span />
            </div>
          )}

          {periods.map((period) => (
            <div
              key={period.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center p-2 rounded-lg border border-gray-200 bg-gray-50/50"
            >
              <input
                type="text"
                value={period.name}
                onChange={(e) => updatePeriod(period.id, { name: e.target.value })}
                className="text-sm font-medium border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 w-full"
              />

              <input
                type="date"
                value={period.startDate}
                onChange={(e) => updatePeriod(period.id, { startDate: e.target.value })}
                className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300"
              />

              <span className="text-xs text-gray-400">to</span>

              <input
                type="date"
                value={period.endDate}
                onChange={(e) => updatePeriod(period.id, { endDate: e.target.value })}
                className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300"
              />

              <button
                onClick={() => removePeriod(period.id)}
                className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            onClick={addPeriod}
            className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors pt-1"
          >
            <Plus className="w-4 h-4" />
            Add period
          </button>
        </div>
      )}
    </div>
  );
}
