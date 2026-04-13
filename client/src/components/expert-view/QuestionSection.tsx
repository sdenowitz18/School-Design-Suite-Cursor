import React from 'react';
import { Info, Star } from 'lucide-react';
import { PlainLanguageInput } from './PlainLanguageInput';
import { BucketHeader } from './BucketHeader';
import { A1Bucket } from './A1Bucket';
import { A2Bucket } from './A2Bucket';
import { A3Bucket } from './A3Bucket';
import { A3RatioBucket } from './A3RatioBucket';
import { A4Bucket } from './A4Bucket';
import { A5Bucket } from './A5Bucket';
import { A2TensionBucket } from './A2TensionBucket';
import { RingSchoolWideA1Controls } from './ring-school-wide-a1-controls';
import { allTagsFromBucket } from './bucket-tag-utils';
import type {
  QuestionDef,
  BucketDef,
  BucketValue,
  A1Value,
  A2Value,
  A2TensionValue,
  A3Value,
  A3RatioValue,
  A4Value,
  A5Value,
  ComponentType,
  ElementsExpertData,
} from './expert-view-types';

// ─── Default values ────────────────────────────────────────────────────────────

function defaultA1(): A1Value { return { selections: [] }; }
function defaultA2(): A2Value { return { selectedId: null, isKey: false, notes: '' }; }
function defaultA3(): A3Value { return { value: null, unit: '', description: '', isKey: false }; }
function defaultA3Ratio(): A3RatioValue { return { learners: null, facilitators: null, isKey: false }; }
function defaultA4(): A4Value { return { days: [], time: '', recurrence: '', notes: '', isKey: false }; }
function defaultA5(): A5Value { return { text: '', inheritFromSchool: false, isKey: false }; }
function defaultA2Tension(): A2TensionValue { return { selections: {} }; }

// ─── Tier Distribution View (center-level A2 for General Purpose) ─────────────

interface TierDistribution {
  tier1Core: number;
  tier1Enrichment: number;
  tier23Intervention: number;
}

function defaultTierDist(): TierDistribution {
  return { tier1Core: 0, tier1Enrichment: 0, tier23Intervention: 0 };
}

function TierDistributionView({
  value,
}: {
  value: TierDistribution;
}) {
  const total = value.tier1Core + value.tier1Enrichment + value.tier23Intervention;
  const tiers = [
    { label: 'Tier 1 core', pct: value.tier1Core, color: 'bg-emerald-500' },
    { label: 'Tier 1 enrichment', pct: value.tier1Enrichment, color: 'bg-blue-400' },
    { label: 'Tier 2/3 intervention', pct: value.tier23Intervention, color: 'bg-amber-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
        <span>
          This distribution is calculated from ring component entries. Go into individual ring components to set their purpose.
        </span>
      </div>

      {/* Bar */}
      {total > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden gap-px bg-gray-100">
          {tiers.map((t) =>
            t.pct > 0 ? (
              <div
                key={t.label}
                className={t.color}
                style={{ width: `${(t.pct / total) * 100}%` }}
                title={`${t.label}: ${t.pct}%`}
              />
            ) : null,
          )}
        </div>
      )}

      {/* Tier rows */}
      <div className="space-y-2">
        {tiers.map((t) => (
          <div key={t.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${t.color}`} />
              <span className="text-sm text-gray-700">{t.label}</span>
            </div>
            <span className="text-sm font-semibold text-gray-500 tabular-nums">
              {total === 0 ? '—' : `${Math.round((t.pct / total) * 100)}%`}
            </span>
          </div>
        ))}
      </div>

      {total === 0 && (
        <p className="text-xs text-gray-400 italic">No ring components have set a general purpose yet.</p>
      )}
    </div>
  );
}

// ─── Collapsed Summary ────────────────────────────────────────────────────────

function BucketCollapsedSummary({ bucket, value }: { bucket: BucketDef; value: BucketValue }) {
  const { archetype } = bucket;

  if (archetype === 'A1' || archetype === 'MultiSelect') {
    const sels = value.archetypeA1?.selections ?? [];
    if (sels.length === 0) return null;
    const allTags = allTagsFromBucket(bucket);
    return (
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {sels.map((sel) => {
          const primaryLabel = sel.isCustom
            ? (sel.customLabel ?? sel.tagId)
            : (allTags.find((t) => t.id === sel.tagId)?.label ?? sel.tagId);
          const primaryTag = allTags.find((t) => t.id === sel.tagId);
          const secLabels = sel.selectedSecondaries.map((sec) => ({
            label: primaryTag?.secondaries?.find((s) => s.id === sec.tagId)?.label ?? sec.tagId,
            isKey: sec.isKey,
          }));
          return (
            <div key={sel.tagId} className="flex items-center gap-1 flex-wrap">
              {secLabels.length === 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                  {primaryLabel}
                  {sel.isKey && <Star className="w-3 h-3 fill-purple-600 text-purple-600" />}
                </span>
              )}
              {secLabels.map(({ label, isKey }) => (
                <span key={label} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  {label}
                  {isKey && <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  if (archetype === 'A2') {
    const a2 = value.archetypeA2;
    if (!a2?.selectedId) return null;
    const label = a2.isCustom
      ? a2.customLabel
      : (bucket.tags ?? []).find((t) => t.id === a2.selectedId)?.label;
    if (!label) return null;
    return (
      <p className="mt-2 text-sm text-gray-600 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
        {label}
        {a2.isKey && <Star className="w-3.5 h-3.5 fill-purple-600 text-purple-600 ml-0.5" />}
      </p>
    );
  }

  if (archetype === 'A3') {
    const a3 = value.archetypeA3;
    if (a3?.value == null) return null;
    return (
      <p className="mt-2 text-sm text-gray-600">
        {a3.value} {a3.unit}
        {a3.description && <span className="text-gray-400 ml-2">— {a3.description}</span>}
      </p>
    );
  }

  if (archetype === 'A3Ratio') {
    const r = value.archetypeA3Ratio;
    if (r?.learners == null && r?.facilitators == null) return null;
    return (
      <p className="mt-2 text-sm text-gray-600 tabular-nums">
        {r.learners ?? '?'}:{r.facilitators ?? '?'} (learners:facilitators)
      </p>
    );
  }

  if (archetype === 'A4') {
    const a4 = value.archetypeA4;
    const parts: string[] = [];
    if (a4?.days && a4.days.length > 0) parts.push(a4.days.join(', '));
    if (a4?.time) parts.push(a4.time);
    if (a4?.recurrence) parts.push(a4.recurrence);
    if (parts.length === 0) return null;
    return <p className="mt-2 text-sm text-gray-600">{parts.join(' · ')}</p>;
  }

  if (archetype === 'A5') {
    const a5 = value.archetypeA5;
    if (a5?.inheritFromSchool) {
      return <p className="mt-2 text-sm text-gray-400 italic">Inherited from school-wide</p>;
    }
    if (!a5?.text) return null;
    const truncated = a5.text.length > 120 ? a5.text.slice(0, 117) + '…' : a5.text;
    return <p className="mt-2 text-sm text-gray-500 line-clamp-1">{truncated}</p>;
  }

  if (archetype === 'A2Tension') {
    const sel = value.archetypeA2Tension?.selections ?? {};
    const pairs = bucket.tensions ?? [];
    const parts = pairs
      .map((t) => {
        const side = sel[t.id];
        if (!side) return null;
        const label = side === 'left' ? t.leftLabel : t.rightLabel;
        return `${t.question}: ${label}`;
      })
      .filter(Boolean) as string[];
    if (parts.length === 0) return null;
    return <p className="mt-2 text-sm text-gray-600 leading-snug">{parts.join(' · ')}</p>;
  }

  return null;
}

// ─── Single Bucket ─────────────────────────────────────────────────────────────

interface BucketSectionProps {
  bucket: BucketDef;
  value: BucketValue;
  componentType: ComponentType;
  onChange: (v: BucketValue) => void;
  questionId?: string;
  elementId?: string;
  schoolWideElementsExpertData?: ElementsExpertData;
}

function BucketSection({
  bucket,
  value,
  componentType,
  onChange,
  questionId,
  elementId,
  schoolWideElementsExpertData,
}: BucketSectionProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  const schoolWideBucketValue =
    questionId && elementId && schoolWideElementsExpertData
      ? schoolWideElementsExpertData[elementId]?.[`${questionId}__${bucket.id}`]
      : undefined;

  const collapsedSummaryValue = React.useMemo(() => {
    const a1 = value.archetypeA1;
    if (
      bucket.ringSchoolWideChoice &&
      componentType === 'ring' &&
      a1?.inheritFromSchool &&
      schoolWideBucketValue?.archetypeA1
    ) {
      return { ...value, archetypeA1: schoolWideBucketValue.archetypeA1 };
    }
    return value;
  }, [bucket.ringSchoolWideChoice, bucket.archetype, componentType, value, schoolWideBucketValue]);

  // Center-only bucket shown at ring level
  if (bucket.centerOnly && componentType !== 'center') {
    return (
      <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
        <BucketHeader
          title={bucket.title}
          archetype={bucket.archetype}
          adultOnly={bucket.adultOnly}
          contextNote="Center component only — configure at the whole-school level"
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed(c => !c)}
        />
      </div>
    );
  }

  // Ring-only bucket shown at center level — special case: general purpose shows tier distribution
  if (bucket.ringOnly && componentType === 'center') {
    const tierDist: TierDistribution = (value as any).tierDistribution ?? defaultTierDist();
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <BucketHeader
          title={bucket.title}
          archetype={bucket.archetype}
          adultOnly={bucket.adultOnly}
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed(c => !c)}
        />
        {!collapsed && (
          <div className="mt-4">
            <TierDistributionView value={tierDist} />
          </div>
        )}
      </div>
    );
  }

  const isA3orA4orA5 = ['A3', 'A3Ratio', 'A4', 'A5'].includes(bucket.archetype);
  const bucketIsKey =
    value.archetypeA3?.isKey ||
    value.archetypeA3Ratio?.isKey ||
    value.archetypeA4?.isKey ||
    value.archetypeA5?.isKey ||
    false;

  function toggleBucketKey() {
    if (bucket.archetype === 'A3') onChange({ ...value, archetypeA3: { ...(value.archetypeA3 ?? defaultA3()), isKey: !value.archetypeA3?.isKey } });
    if (bucket.archetype === 'A3Ratio') onChange({ ...value, archetypeA3Ratio: { ...(value.archetypeA3Ratio ?? defaultA3Ratio()), isKey: !value.archetypeA3Ratio?.isKey } });
    if (bucket.archetype === 'A4') onChange({ ...value, archetypeA4: { ...(value.archetypeA4 ?? defaultA4()), isKey: !value.archetypeA4?.isKey } });
    if (bucket.archetype === 'A5') onChange({ ...value, archetypeA5: { ...(value.archetypeA5 ?? defaultA5()), isKey: !value.archetypeA5?.isKey } });
  }

  const showRingSchoolWideA1 =
    bucket.ringSchoolWideChoice &&
    (bucket.archetype === 'A1' || bucket.archetype === 'MultiSelect');

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <BucketHeader
        title={bucket.title}
        archetype={bucket.archetype}
        adultOnly={bucket.adultOnly}
        contextNote={bucket.contextNote}
        showKeyButton={isA3orA4orA5}
        isKey={bucketIsKey}
        onKeyToggle={toggleBucketKey}
        collapsed={collapsed}
        onCollapseToggle={() => setCollapsed((c) => !c)}
      />

      {collapsed && <BucketCollapsedSummary bucket={bucket} value={collapsedSummaryValue} />}

      {!collapsed && showRingSchoolWideA1 && (
        <div className="mt-4">
          <RingSchoolWideA1Controls
            bucket={bucket}
            componentType={componentType}
            value={value.archetypeA1 ?? defaultA1()}
            onChange={(v) => onChange({ ...value, archetypeA1: v })}
            schoolWideValue={schoolWideBucketValue?.archetypeA1}
          />
        </div>
      )}

      {!collapsed && (
        <div className={showRingSchoolWideA1 ? 'mt-4' : 'mt-5'}>
          {bucket.archetype === 'A1' || bucket.archetype === 'MultiSelect' ? (
            <A1Bucket
              bucket={bucket}
              value={value.archetypeA1 ?? defaultA1()}
              onChange={(v) => onChange({ ...value, archetypeA1: v })}
              componentType={componentType}
            />
          ) : bucket.archetype === 'A2' ? (
            <A2Bucket
              bucket={bucket}
              value={value.archetypeA2 ?? defaultA2()}
              onChange={(v) => onChange({ ...value, archetypeA2: v })}
            />
          ) : bucket.archetype === 'A2Tension' ? (
            <A2TensionBucket
              bucket={bucket}
              value={value.archetypeA2Tension ?? defaultA2Tension()}
              onChange={(v) => onChange({ ...value, archetypeA2Tension: v })}
            />
          ) : bucket.archetype === 'A3' ? (
            <A3Bucket
              bucket={bucket}
              value={value.archetypeA3 ?? defaultA3()}
              onChange={(v) => onChange({ ...value, archetypeA3: v })}
            />
          ) : bucket.archetype === 'A3Ratio' ? (
            <A3RatioBucket
              value={value.archetypeA3Ratio ?? defaultA3Ratio()}
              onChange={(v) => onChange({ ...value, archetypeA3Ratio: v })}
            />
          ) : bucket.archetype === 'A4' ? (
            <A4Bucket
              bucket={bucket}
              value={value.archetypeA4 ?? defaultA4()}
              onChange={(v) => onChange({ ...value, archetypeA4: v })}
            />
          ) : bucket.archetype === 'A5' ? (
            <A5Bucket
              bucket={bucket}
              value={value.archetypeA5 ?? defaultA5()}
              componentType={componentType}
              onChange={(v) => onChange({ ...value, archetypeA5: v })}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── QuestionSection ──────────────────────────────────────────────────────────

interface QuestionSectionProps {
  question: QuestionDef;
  index: number;
  data: Record<string, BucketValue>;
  componentType: ComponentType;
  onChange: (bucketId: string, value: BucketValue) => void;
  /** Choice buckets expanded; parent keeps at most one question open (accordion). */
  bucketsExpanded: boolean;
  /** Toggle this question’s buckets; parent closes others when opening this one. */
  onToggleBuckets: () => void;
  /** e.g. `culture` — used with school-wide expert data for ring mirrors. */
  elementId?: string;
  schoolWideElementsExpertData?: ElementsExpertData;
  /** Shared cross-element bucket values, keyed by syncedBucketId. */
  sharedData?: Record<string, BucketValue>;
  /** Called when a synced bucket changes; receives the syncedBucketId and new value. */
  onSharedBucketChange?: (syncedBucketId: string, value: BucketValue) => void;
}

export function QuestionSection({
  question,
  index,
  data,
  componentType,
  onChange,
  bucketsExpanded,
  onToggleBuckets,
  elementId,
  schoolWideElementsExpertData,
  sharedData,
  onSharedBucketChange,
}: QuestionSectionProps) {
  const [plainText, setPlainText] = React.useState(
    data['__plain__']?.plainLanguageAnswer ?? '',
  );
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!bucketsExpanded) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [bucketsExpanded]);

  function handlePlainChange(v: string) {
    setPlainText(v);
    onChange('__plain__', { plainLanguageAnswer: v });
  }

  return (
    <div ref={rootRef} className="space-y-5">
      {/* Question header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggleBuckets}
          className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-0.5 hover:bg-purple-200 transition-colors cursor-pointer"
          title={bucketsExpanded ? 'Collapse choice buckets' : 'Expand choice buckets'}
        >
          {index}
        </button>
        <p className="text-sm font-medium text-gray-800 leading-relaxed pt-0.5">{question.question}</p>
      </div>

      {/* Plain language AI input */}
      <PlainLanguageInput value={plainText} onChange={handlePlainChange} />

      {/* Buckets — hidden when collapsed (Key Design style: question + PL stay visible) */}
      {bucketsExpanded && (
      <div className="space-y-3">
        {question.buckets.map((bucket) => {
          const isShared = !!bucket.syncedBucketId;
          const bucketValue = isShared
            ? (sharedData?.[bucket.syncedBucketId!] ?? {})
            : (data[bucket.id] ?? {});
          const bucketOnChange = isShared
            ? (v: BucketValue) => onSharedBucketChange?.(bucket.syncedBucketId!, v)
            : (v: BucketValue) => onChange(bucket.id, v);
          return (
            <BucketSection
              key={bucket.id}
              bucket={bucket}
              value={bucketValue}
              componentType={componentType}
              onChange={bucketOnChange}
              questionId={question.id}
              elementId={elementId}
              schoolWideElementsExpertData={schoolWideElementsExpertData}
            />
          );
        })}
      </div>
      )}
    </div>
  );
}
