import React, { useState } from 'react';
import { Plus, Star, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BucketDef, A2Value, TagDef } from './expert-view-types';

interface A2BucketProps {
  bucket: BucketDef;
  value: A2Value;
  onChange: (value: A2Value) => void;
}

export function A2Bucket({ bucket, value, onChange }: A2BucketProps) {
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const tags: TagDef[] = bucket.tags ?? [];
  const allOptions: TagDef[] = value.isCustom && value.customLabel
    ? [...tags, { id: 'custom', label: value.customLabel }]
    : tags;

  function select(id: string, isCustom?: boolean, customLabel?: string) {
    onChange({ ...value, selectedId: id, isCustom, customLabel, notes: value.selectedId === id ? value.notes : '' });
  }

  function addCustom() {
    const label = customInput.trim();
    if (!label) return;
    select('custom', true, label);
    setCustomInput('');
    setShowCustomInput(false);
  }

  const selectedTag = allOptions.find((t) => t.id === value.selectedId);

  return (
    <div className="space-y-3">
      {/* Radio options */}
      <div className="space-y-1">
        {allOptions.map((tag) => {
          const isSelected = value.selectedId === tag.id;
          return (
            <div
              key={tag.id}
              className="flex items-center justify-between group"
            >
              <label className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-gray-50 flex-1 transition-colors">
                <input
                  type="radio"
                  checked={isSelected}
                  onChange={() => select(tag.id, tag.id === 'custom', value.customLabel)}
                  className="accent-purple-600 w-3.5 h-3.5"
                />
                <span className={cn('text-sm', isSelected ? 'text-gray-900 font-medium' : 'text-gray-700')}>
                  {tag.label}
                </span>
              </label>
              {isSelected && (
                <button
                  onClick={() => onChange({ ...value, isKey: !value.isKey })}
                  className={cn(
                    'flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors mr-1',
                    value.isKey
                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                      : 'text-gray-400 border-transparent hover:border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <Star className={cn('w-3 h-3', value.isKey ? 'fill-purple-600 text-purple-600' : 'text-gray-300')} />
                  {value.isKey ? 'Key' : 'Mark as key'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add custom option */}
      {bucket.customAllowed && (
        <div className="pl-2">
          {showCustomInput ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustom();
                  if (e.key === 'Escape') { setShowCustomInput(false); setCustomInput(''); }
                }}
                onBlur={() => { if (!customInput.trim()) setShowCustomInput(false); }}
                placeholder="Custom option..."
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 w-44"
              />
              <button onClick={addCustom} className="text-xs text-purple-700 hover:text-purple-900 font-medium">
                Add
              </button>
              <button
                onClick={() => { setShowCustomInput(false); setCustomInput(''); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add custom
            </button>
          )}
        </div>
      )}

      {/* Notes on selected */}
      {selectedTag && (
        <>
          <div className="border-t border-gray-100" />
          <div className="flex gap-2">
            <textarea
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              placeholder={`Notes on "${selectedTag.label}"...`}
              rows={2}
              className="flex-1 text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white"
            />
            <button
              onClick={() => alert('Upload functionality coming soon')}
              className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50 transition-colors self-start whitespace-nowrap"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
          </div>
        </>
      )}
    </div>
  );
}
