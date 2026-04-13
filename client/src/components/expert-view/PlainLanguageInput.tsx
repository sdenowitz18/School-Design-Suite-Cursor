import React, { useState } from 'react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlainLanguageInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** When false, hides the “Generate AI summary” demo button */
  showGenerateSummary?: boolean;
  /**
   * `default` — full panel (AI map demo, mic). `simple` — label + textarea only (no extra chrome).
   */
  variant?: 'default' | 'simple';
  /**
   * Show mic + action buttons but keep them non-interactive (layout spec / handoff only).
   */
  indicativeOnly?: boolean;
}

export function PlainLanguageInput({
  value,
  onChange,
  placeholder,
  showGenerateSummary = true,
  variant = 'default',
  indicativeOnly = false,
}: PlainLanguageInputProps) {
  const [isRecording, setIsRecording] = useState(false);

  if (variant === 'simple') {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">Describe in plain language</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ??
            'e.g. We need educators who can co-plan with teams and have experience with heterogeneous groups…'
          }
          rows={3}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 resize-y min-h-[5rem]"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-gray-50 overflow-hidden',
        indicativeOnly && 'opacity-95',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
        <span className="text-xs text-gray-600 font-medium">
          Describe in plain language — AI will map to the fields below
        </span>
      </div>

      {/* Textarea + mic */}
      <div className="px-3 pt-1 pb-2 flex gap-2 items-start">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ??
            'e.g. We run 90-minute block periods for core subjects that rotate across a 4-day cycle, with a 45-minute advisory every morning...'
          }
          rows={3}
          className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent border-none outline-none resize-none"
        />
        <button
          type="button"
          disabled={indicativeOnly}
          onClick={() => !indicativeOnly && setIsRecording((r) => !r)}
          title={
            indicativeOnly
              ? 'Voice recording (coming soon)'
              : isRecording
                ? 'Stop recording'
                : 'Start recording'
          }
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border transition-all mt-0.5',
            indicativeOnly && 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400',
            !indicativeOnly &&
              (isRecording
                ? 'bg-red-500 border-red-500 text-white animate-pulse'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-100'),
          )}
        >
          {isRecording && !indicativeOnly ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 border-t border-gray-200 bg-white/60">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          {indicativeOnly ? (
            'Type or record, then map to structured fields (actions not wired yet)'
          ) : isRecording ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Recording...
            </>
          ) : (
            'Type or record, then map to structured fields'
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            disabled={indicativeOnly}
            onClick={() => !indicativeOnly && alert('AI mapping coming soon')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
              indicativeOnly
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-gray-700',
            )}
          >
            Map to fields
          </button>
          {showGenerateSummary && (
            <button
              type="button"
              disabled={indicativeOnly}
              onClick={() =>
                !indicativeOnly &&
                alert(
                  'Demo: would synthesize a short summary from the structured choices you defined below so you can accept or edit it.',
                )
              }
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors',
                indicativeOnly
                  ? 'border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'border border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100',
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate AI summary
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
