import React from 'react';
import { cn } from '@/lib/utils';

interface PlainLanguageInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  /** @deprecated Retained for backwards compatibility; no longer renders extra UI. */
  showGenerateSummary?: boolean;
  /** @deprecated Retained for backwards compatibility; no longer renders extra UI. */
  variant?: 'default' | 'simple';
  /** @deprecated Retained for backwards compatibility; no longer renders extra UI. */
  indicativeOnly?: boolean;
}

export function PlainLanguageInput({
  value,
  onChange,
  placeholder,
  className,
  rows = 2,
}: PlainLanguageInputProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Add details in plain language…'}
      rows={rows}
      className={cn(
        'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 resize-y min-h-[3rem] transition-shadow',
        className,
      )}
    />
  );
}
