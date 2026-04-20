import React from 'react';
import { cn } from '@/lib/utils';
import type { BucketDef, A5Value, ComponentType } from './expert-view-types';

interface A5BucketProps {
  bucket: BucketDef;
  value: A5Value;
  componentType: ComponentType;
  schoolWideText?: string;
  onChange: (value: A5Value) => void;
}

export function A5Bucket({ bucket, value, componentType, schoolWideText, onChange }: A5BucketProps) {
  // No school-wide value exists for buckets hidden at the center, so the toggle is meaningless.
  const showInheritance = componentType === 'ring' && !bucket.hideAtCenter;

  return (
    <div className="space-y-3">
      {/* Same as school-wide toggle — ring components only */}
      {showInheritance && (
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => onChange({ ...value, inheritFromSchool: !value.inheritFromSchool })}
            className={cn(
              'relative w-9 h-5 rounded-full border transition-colors',
              value.inheritFromSchool
                ? 'bg-purple-600 border-purple-600'
                : 'bg-gray-200 border-gray-300 group-hover:border-gray-400',
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                value.inheritFromSchool ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </div>
          <span className="text-sm text-gray-700">Same as school-wide</span>
        </label>
      )}

      {/* Text area — hidden when inheriting */}
      {showInheritance && value.inheritFromSchool && schoolWideText ? (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 italic">
          {schoolWideText}
        </div>
      ) : showInheritance && value.inheritFromSchool ? (
        <div className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 italic">
          Pull from center component once entered...
        </div>
      ) : (
        <textarea
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder={bucket.placeholder ?? 'Enter your response...'}
          rows={4}
          className="w-full text-sm text-gray-700 placeholder-gray-400 border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 bg-white"
        />
      )}
    </div>
  );
}
