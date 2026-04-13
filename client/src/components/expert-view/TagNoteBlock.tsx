import React, { useState } from 'react';
import { Star, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Same pattern as `NoteBlock` in A1Bucket — notes live below the tag grid (Key Design Elements style). */

export function TagNoteBlock({
  label,
  isPrimary,
  isKey,
  notes,
  onKeyToggle,
  onNotesChange,
  /** When false, hides “Mark as key” (e.g. secondary-only note rows). */
  showKeyToggle = true,
}: {
  label: string;
  isPrimary: boolean;
  isKey: boolean;
  notes: string;
  onKeyToggle: () => void;
  onNotesChange: (v: string) => void;
  showKeyToggle?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80">
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full border',
            isPrimary
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200',
          )}
        >
          {label}
        </span>
        <span className="text-xs text-gray-400">notes</span>
        <div className="ml-auto flex items-center gap-1">
          {showKeyToggle && (
            <button
              type="button"
              onClick={onKeyToggle}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                isKey
                  ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50',
              )}
            >
              <Star className={cn('w-3 h-3', isKey ? 'fill-purple-600 text-purple-600' : 'text-gray-300')} />
              Mark as key
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-3 flex gap-2">
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={`Notes on ${label.toLowerCase()}...`}
            rows={2}
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white"
          />
          <button
            type="button"
            onClick={() => alert('Upload functionality coming soon')}
            className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50 transition-colors self-start whitespace-nowrap"
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>
        </div>
      )}
    </div>
  );
}
