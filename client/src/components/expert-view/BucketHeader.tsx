import React from 'react';
import { Upload, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Archetype } from './expert-view-types';

const ARCHETYPE_LABELS: Record<string, string> = {
  A1: 'A-1 multi-select',
  A2: 'A-2 single-select',
  A2Tension: 'A-2 tensions',
  A3: 'A-3 numeric',
  A3Ratio: 'A-3 ratio',
  A3Pair: 'A-3 paired numeric',
  A4: 'A-4 structured',
  A5: 'A-5 free text',
  MultiSelect: 'multi-select',
};

interface BucketHeaderProps {
  title: string;
  archetype: Archetype | 'MultiSelect';
  adultOnly?: boolean;
  contextNote?: string;
  showKeyButton?: boolean;
  isKey?: boolean;
  onKeyToggle?: () => void;
  collapsed: boolean;
  onCollapseToggle: () => void;
}

export function BucketHeader({
  title,
  archetype,
  adultOnly,
  contextNote,
  showKeyButton,
  isKey,
  onKeyToggle,
  collapsed,
  onCollapseToggle,
}: BucketHeaderProps) {
  return (
    <div className="space-y-1">
      {/* Row 1: title + badge + actions */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 leading-snug">
          {title}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {adultOnly && (
            <span className="text-[10px] font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
              Adult experience
            </span>
          )}
          <span className="text-[10px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full border border-gray-200 whitespace-nowrap">
            {ARCHETYPE_LABELS[archetype] ?? archetype}
          </span>

          {showKeyButton && (
            <button
              onClick={onKeyToggle}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors',
                isKey
                  ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  : 'text-gray-400 border-transparent hover:border-gray-200 hover:bg-gray-50',
              )}
            >
              <Star className={cn('w-3 h-3', isKey ? 'fill-purple-600 text-purple-600' : 'text-gray-300')} />
              {isKey ? 'Key' : 'Mark as key'}
            </button>
          )}

          <button
            onClick={() => alert('Upload functionality coming soon')}
            className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>

          <button
            onClick={onCollapseToggle}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Row 2: context note (if any) */}
      {contextNote && (
        <p className="text-[11px] text-gray-400 italic leading-snug pr-4">{contextNote}</p>
      )}
    </div>
  );
}
