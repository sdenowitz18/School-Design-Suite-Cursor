import React, { useState, useRef } from 'react';
import { Plus, Star, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  BucketDef,
  TagDef,
  A1Value,
  TagSelection,
  SecondarySelection,
  ComponentType,
} from './expert-view-types';
import { allTagsFromBucket } from './bucket-tag-utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTagSelection(tagId: string, isCustom?: boolean, customLabel?: string): TagSelection {
  return { tagId, isCustom, customLabel, isKey: false, notes: '', selectedSecondaries: [] };
}

function makeSecondarySelection(tagId: string): SecondarySelection {
  return { tagId, isKey: false, notes: '' };
}

// ─── Notes Area ───────────────────────────────────────────────────────────────

interface NoteBlockProps {
  label: string;
  isPrimary: boolean;
  isKey: boolean;
  notes: string;
  onKeyToggle: () => void;
  onNotesChange: (v: string) => void;
}

function NoteBlock({ label, isPrimary, isKey, notes, onKeyToggle, onNotesChange }: NoteBlockProps) {
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
          <button
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
          <button
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

// ─── Primary Tag Pill ─────────────────────────────────────────────────────────

interface PrimaryPillProps {
  tag: TagDef;
  selection: TagSelection | undefined;
  onToggle: () => void;
  onKeyToggle: () => void;
  onSecondaryToggle: (secId: string) => void;
  /** When true, renders as a bullet-list row instead of a rounded pill. */
  listMode?: boolean;
}

function PrimaryPill({ tag, selection, onToggle, onKeyToggle, onSecondaryToggle, listMode }: PrimaryPillProps) {
  const isSelected = !!selection;
  const hasSecondaries = tag.secondaries && tag.secondaries.length > 0;

  if (listMode) {
    return (
      <div className="select-none">
        {/* Bullet row */}
        <div
          className="flex items-center gap-2 py-0.5 cursor-pointer group"
          onClick={onToggle}
        >
          {/* Bullet indicator */}
          <span
            className={cn(
              'flex-shrink-0 w-2 h-2 rounded-full transition-colors mt-px',
              isSelected ? 'bg-purple-600' : 'bg-gray-300 group-hover:bg-gray-400',
            )}
          />
          <span
            className={cn(
              'text-sm transition-colors leading-snug',
              isSelected ? 'text-gray-900 font-medium' : 'text-gray-600',
            )}
          >
            {tag.label}
          </span>
          {isSelected && ((selection?.selectedSecondaries ?? []).length === 0) && (
            <button
              onClick={(e) => { e.stopPropagation(); onKeyToggle(); }}
              className="ml-0.5 focus:outline-none"
              title={selection?.isKey ? 'Remove key' : 'Mark as key'}
            >
              <Star
                className={cn(
                  'w-3 h-3 transition-colors',
                  selection?.isKey ? 'fill-purple-600 text-purple-600' : 'text-gray-300 hover:text-purple-400',
                )}
              />
            </button>
          )}
        </div>

        {/* Sub-bullets when secondaries are selected */}
        {isSelected && hasSecondaries && (
          <div className="ml-4 mt-0.5 space-y-0.5">
            {tag.secondaries!.map((sec) => {
              const secSel = (selection!.selectedSecondaries ?? []).find((s) => s.tagId === sec.id);
              const isSecSelected = !!secSel;
              return (
                <div
                  key={sec.id}
                  className="flex items-center gap-2 py-0.5 cursor-pointer group"
                  onClick={(e) => { e.stopPropagation(); onSecondaryToggle(sec.id); }}
                >
                  <span
                    className={cn(
                      'flex-shrink-0 w-1.5 h-1.5 rounded-full transition-colors mt-px',
                      isSecSelected ? 'bg-emerald-600' : 'bg-gray-200 group-hover:bg-gray-300',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs transition-colors',
                      isSecSelected ? 'text-gray-800 font-medium' : 'text-gray-500',
                    )}
                  >
                    {sec.label}
                  </span>
                  {isSecSelected && secSel!.isKey && (
                    <Star className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex flex-col rounded-full transition-all cursor-pointer select-none',
        isSelected
          ? 'rounded-xl border border-purple-300 bg-purple-50 shadow-sm'
          : 'rounded-full border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
      )}
      style={{ display: 'inline-flex' }}
    >
      {/* Primary row */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <span
          className={cn(
            'text-sm transition-colors',
            isSelected ? 'text-purple-800 font-medium' : 'text-gray-700',
          )}
          onClick={onToggle}
        >
          {tag.label}
        </span>
        {isSelected && ((selection?.selectedSecondaries ?? []).length === 0) && (
          <button
            onClick={(e) => { e.stopPropagation(); onKeyToggle(); }}
            className="ml-0.5 focus:outline-none"
            title={selection?.isKey ? 'Remove key' : 'Mark as key'}
          >
            <Star
              className={cn(
                'w-3.5 h-3.5 transition-colors',
                selection?.isKey ? 'fill-purple-600 text-purple-600' : 'text-gray-300 hover:text-purple-400',
              )}
            />
          </button>
        )}
      </div>

      {/* Secondaries — shown inside the expanded pill when selected */}
      {isSelected && hasSecondaries && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {tag.secondaries!.map((sec) => {
            const secSel = (selection!.selectedSecondaries ?? []).find((s) => s.tagId === sec.id);
            const isSecSelected = !!secSel;
            return (
              <button
                key={sec.id}
                onClick={(e) => { e.stopPropagation(); onSecondaryToggle(sec.id); }}
                className={cn(
                  'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors',
                  isSecSelected
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium'
                    : 'bg-white text-gray-600 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                )}
              >
                {sec.label}
                {isSecSelected && secSel!.isKey && (
                  <Star className="w-3 h-3 fill-emerald-600 text-emerald-600 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── A1Bucket ─────────────────────────────────────────────────────────────────

interface A1BucketProps {
  bucket: BucketDef;
  value: A1Value;
  onChange: (value: A1Value) => void;
  componentType?: ComponentType;
  /** When true, tags render as a vertical bullet list instead of pill chips. */
  listMode?: boolean;
}

export function A1Bucket({ bucket, value, onChange, componentType = 'center', listMode }: A1BucketProps) {
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const selections = (value.selections ?? []).map((s) =>
    s.selectedSecondaries ? s : { ...s, selectedSecondaries: [] },
  );
  const inheritRing =
    bucket.ringSchoolWideChoice && componentType === 'ring' && value.inheritFromSchool === true;

  const allTags: TagDef[] = allTagsFromBucket(bucket);
  const disciplineGroups = bucket.disciplineGroups ?? [];

  function getSelection(tagId: string): TagSelection | undefined {
    return selections.find((s) => s.tagId === tagId);
  }

  function setSelections(next: TagSelection[]) {
    onChange({ ...value, selections: next });
  }

  function togglePrimary(tag: TagDef) {
    const existing = getSelection(tag.id);
    if (existing) {
      setSelections(selections.filter((s) => s.tagId !== tag.id));
    } else {
      setSelections([...selections, makeTagSelection(tag.id)]);
    }
  }

  function togglePrimaryKey(tagId: string) {
    setSelections(
      selections.map((s) => (s.tagId === tagId ? { ...s, isKey: !s.isKey } : s)),
    );
  }

  function toggleSecondary(primaryTagId: string, secTagId: string) {
    setSelections(
      selections.map((s) => {
        if (s.tagId !== primaryTagId) return s;
        const secs = s.selectedSecondaries ?? [];
        const hasSec = secs.some((sec) => sec.tagId === secTagId);
        const nextSecs = hasSec
          ? secs.filter((sec) => sec.tagId !== secTagId)
          : [...secs, makeSecondarySelection(secTagId)];
        return { ...s, selectedSecondaries: nextSecs };
      }),
    );
  }

  function addCustomTag() {
    const label = customInput.trim();
    if (!label) return;
    const id = `custom-${Date.now()}`;
    setSelections([...selections, makeTagSelection(id, true, label)]);
    setCustomInput('');
    setShowCustomInput(false);
  }

  function updateNotes(tagId: string, notes: string) {
    setSelections(selections.map((s) => (s.tagId === tagId ? { ...s, notes } : s)));
  }

  function updateSecNotes(primaryTagId: string, secTagId: string, notes: string) {
    setSelections(
      selections.map((s) => {
        if (s.tagId !== primaryTagId) return s;
        return {
          ...s,
          selectedSecondaries: (s.selectedSecondaries ?? []).map((sec) =>
            sec.tagId === secTagId ? { ...sec, notes } : sec,
          ),
        };
      }),
    );
  }

  function toggleNoteKey(tagId: string) {
    setSelections(selections.map((s) => (s.tagId === tagId ? { ...s, isKey: !s.isKey } : s)));
  }

  function toggleSecNoteKey(primaryTagId: string, secTagId: string) {
    setSelections(
      selections.map((s) => {
        if (s.tagId !== primaryTagId) return s;
        return {
          ...s,
          selectedSecondaries: (s.selectedSecondaries ?? []).map((sec) =>
            sec.tagId === secTagId ? { ...sec, isKey: !sec.isKey } : sec,
          ),
        };
      }),
    );
  }

  // Resolve all tag defs including custom ones
  function resolveTagDef(sel: TagSelection): TagDef | null {
    if (sel.isCustom) return { id: sel.tagId, label: sel.customLabel ?? sel.tagId };
    return allTags.find((t) => t.id === sel.tagId) ?? null;
  }

  function resolveSecDef(primaryTagId: string, secTagId: string): TagDef | null {
    const primary = allTags.find((t) => t.id === primaryTagId);
    return primary?.secondaries?.find((s) => s.id === secTagId) ?? null;
  }

  // Build the ordered list of note blocks:
  // If a primary has secondaries selected, only show secondary note blocks (not the primary's own block).
  // If no secondaries are selected, show just the primary note block.
  const noteBlocks: Array<
    | { type: 'primary'; sel: TagSelection; tagDef: TagDef }
    | { type: 'secondary'; primarySel: TagSelection; sec: SecondarySelection; secDef: TagDef }
  > = [];

  for (const sel of selections) {
    const tagDef = resolveTagDef(sel);
    if (!tagDef) continue;
    if ((sel.selectedSecondaries ?? []).length === 0) {
      noteBlocks.push({ type: 'primary', sel, tagDef });
    } else {
      for (const sec of (sel.selectedSecondaries ?? [])) {
        const secDef = resolveSecDef(sel.tagId, sec.tagId);
        if (!secDef) continue;
        noteBlocks.push({ type: 'secondary', primarySel: sel, sec, secDef });
      }
    }
  }

  const tagGrid = (tags: TagDef[]) =>
    tags.map((tag) => (
      <PrimaryPill
        key={tag.id}
        tag={tag}
        selection={getSelection(tag.id)}
        onToggle={() => togglePrimary(tag)}
        onKeyToggle={() => togglePrimaryKey(tag.id)}
        onSecondaryToggle={(secId) => toggleSecondary(tag.id, secId)}
        listMode={listMode}
      />
    ));

  return (
    <div className="space-y-4">
      {/* Tag grid — optional discipline sections */}
      {!inheritRing && disciplineGroups.length > 0 ? (
        <div className="space-y-5">
          {disciplineGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <h4 className="text-sm font-bold text-gray-900 tracking-tight">{group.label}</h4>
              <div className={listMode ? 'space-y-1' : 'flex flex-wrap gap-2'}>{tagGrid(group.tags)}</div>
            </div>
          ))}
        </div>
      ) : !inheritRing ? (
        <div className={listMode ? 'space-y-1' : 'flex flex-wrap gap-2'}>{tagGrid(allTags)}</div>
      ) : null}

      {/* Custom selected tags */}
      {!inheritRing && (
      <div className={listMode ? 'space-y-1' : 'flex flex-wrap gap-2'}>
        {selections
          .filter((s) => s.isCustom)
          .map((s) => {
            const tag: TagDef = { id: s.tagId, label: s.customLabel ?? s.tagId };
            return (
              <PrimaryPill
                key={s.tagId}
                tag={tag}
                selection={s}
                onToggle={() => togglePrimary(tag)}
                onKeyToggle={() => togglePrimaryKey(tag.id)}
                onSecondaryToggle={() => {}}
                listMode={listMode}
              />
            );
          })}
      </div>
      )}

      {/* Add custom */}
      {!inheritRing && bucket.customAllowed && (
        <div className="flex items-center gap-2">
          {showCustomInput ? (
            <>
              <input
                ref={customInputRef}
                autoFocus
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomTag();
                  if (e.key === 'Escape') { setShowCustomInput(false); setCustomInput(''); }
                }}
                onBlur={() => { if (!customInput.trim()) setShowCustomInput(false); }}
                placeholder="Custom tag name..."
                className="text-sm border border-gray-300 rounded-full px-3 py-1 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 w-44"
              />
              <button
                onClick={addCustomTag}
                className="text-xs text-purple-700 hover:text-purple-900 font-medium"
              >
                Add
              </button>
              <button
                onClick={() => { setShowCustomInput(false); setCustomInput(''); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => { setShowCustomInput(true); setTimeout(() => customInputRef.current?.focus(), 0); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add custom
            </button>
          )}
        </div>
      )}

      {/* Notes area */}
      {!inheritRing && noteBlocks.length > 0 && (
        <>
          <div className="border-t border-gray-100" />
          <div className="space-y-2">
            {noteBlocks.map((block) => {
              if (block.type === 'primary') {
                return (
                  <NoteBlock
                    key={`note-primary-${block.sel.tagId}`}
                    label={block.tagDef.label}
                    isPrimary={true}
                    isKey={block.sel.isKey}
                    notes={block.sel.notes}
                    onKeyToggle={() => toggleNoteKey(block.sel.tagId)}
                    onNotesChange={(v) => updateNotes(block.sel.tagId, v)}
                  />
                );
              } else {
                return (
                  <NoteBlock
                    key={`note-sec-${block.primarySel.tagId}-${block.sec.tagId}`}
                    label={block.secDef.label}
                    isPrimary={false}
                    isKey={block.sec.isKey}
                    notes={block.sec.notes}
                    onKeyToggle={() => toggleSecNoteKey(block.primarySel.tagId, block.sec.tagId)}
                    onNotesChange={(v) => updateSecNotes(block.primarySel.tagId, block.sec.tagId, v)}
                  />
                );
              }
            })}
          </div>
        </>
      )}
    </div>
  );
}
