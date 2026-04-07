import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlainLanguageInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function PlainLanguageInput({ value, onChange, placeholder }: PlainLanguageInputProps) {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
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
          onClick={() => setIsRecording((r) => !r)}
          title={isRecording ? 'Stop recording' : 'Start recording'}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border transition-all mt-0.5',
            isRecording
              ? 'bg-red-500 border-red-500 text-white animate-pulse'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-100',
          )}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-white/60">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          {isRecording ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Recording...
            </>
          ) : (
            'Type or record, then map to structured fields'
          )}
        </span>
        <button
          onClick={() => alert('AI mapping coming soon')}
          className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Map to fields
        </button>
      </div>
    </div>
  );
}
