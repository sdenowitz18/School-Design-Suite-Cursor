import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { QuestionSection } from '../QuestionSection';
import { SCHEDULE_ELEMENT } from '../expert-view-schema';
import { YearlyScheduleBucket } from '../YearlyScheduleBucket';
import { MarkingPeriodsBucket } from '../MarkingPeriodsBucket';
import type {
  BucketValue,
  ComponentType,
  ElementSection,
  ElementsExpertData,
  YearlyScheduleValue,
  MarkingPeriodsValue,
} from '../expert-view-types';
import {
  type CalendarType,
  type CalendarMarkingPeriod,
  type SchoolCalendarData,
  CALENDAR_TYPE_OPTIONS,
  countWeekdays,
  fmtCalDate,
  normalizeSchoolCalendar,
  buildDefaultPeriods,
} from '../../school-calendar-shared';

interface ScheduleElementProps {
  componentType: ComponentType;
  data: ElementsExpertData;
  onChange: (next: ElementsExpertData) => void;
  schoolCalendar?: SchoolCalendarData;
  onSchoolCalendarChange?: (next: SchoolCalendarData) => void;
}

const SECTION_TABS: { id: ElementSection; label: string }[] = [
  { id: 'practices', label: 'Practices & Approaches' },
  { id: 'tools', label: 'Tools & Resources' },
];

type StructureTab = 'yearly' | 'marking';
const STRUCTURE_TABS: { id: StructureTab; label: string }[] = [
  { id: 'yearly', label: 'Yearly Schedule' },
  { id: 'marking', label: 'Marking Periods' },
];

// ─── Calendar summary ─────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateCalendarSummary(
  yearly: YearlyScheduleValue,
  marking: MarkingPeriodsValue,
): string {
  const entries = yearly.entries ?? [];

  // Find the school year entry — one entry with both start + end representing the full year
  const yearEntry = entries.find((e) => /school.?year|academic.?year/i.test(e.label));
  const yearStart = yearEntry?.startDate ? fmtDate(yearEntry.startDate) : null;
  const yearEnd = yearEntry?.endDate ? fmtDate(yearEntry.endDate) : null;

  const periods = marking.periods ?? [];
  const periodType = marking.periodType;

  // Build year range string
  let yearPart = '';
  if (yearStart && yearEnd) yearPart = `School year runs from ${yearStart} to ${yearEnd}`;
  else if (yearStart) yearPart = `School year starts ${yearStart}`;
  else if (yearEnd) yearPart = `School year ends ${yearEnd}`;

  // Build periods string
  let periodPart = '';
  if (periodType && periods.length > 0) {
    const filledPeriods = periods.filter((p) => p.startDate || p.endDate);
    if (filledPeriods.length > 0) {
      const typeLabel = periodType.charAt(0).toUpperCase() + periodType.slice(1);
      const chunks = filledPeriods.map((p) => {
        const range =
          p.startDate && p.endDate
            ? `${fmtDate(p.startDate)}–${fmtDate(p.endDate)}`
            : p.startDate
              ? `starts ${fmtDate(p.startDate)}`
              : `ends ${fmtDate(p.endDate)}`;
        return `${p.name} (${range})`;
      });
      periodPart = `${typeLabel}s: ${chunks.join(', ')}`;
    } else if (periodType) {
      const typeLabel = periodType.charAt(0).toUpperCase() + periodType.slice(1);
      periodPart = `${typeLabel} schedule selected`;
    }
  }

  if (yearPart && periodPart) return `${yearPart}, with ${periodPart}.`;
  if (yearPart) return `${yearPart}.`;
  if (periodPart) return `${periodPart}.`;
  return '';
}

function ScheduleSchoolCalendarCard({
  summary,
  structureTab,
  setStructureTab,
  calendarCollapsed,
  setCalendarCollapsed,
  yearlyScheduleValue,
  markingPeriodsValue,
  onYearlyChange,
  onMarkingChange,
}: {
  summary: string;
  structureTab: StructureTab;
  setStructureTab: (t: StructureTab) => void;
  calendarCollapsed: boolean;
  setCalendarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  yearlyScheduleValue: YearlyScheduleValue;
  markingPeriodsValue: MarkingPeriodsValue;
  onYearlyChange: (v: YearlyScheduleValue) => void;
  onMarkingChange: (v: MarkingPeriodsValue) => void;
}) {
  return (
    <div className="mt-6 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-800">School Calendar</span>

        {!calendarCollapsed && (
          <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            {STRUCTURE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStructureTab(tab.id)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
                  structureTab === tab.id
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setCalendarCollapsed((c) => !c)}
          className={cn(
            'p-1 text-gray-400 hover:text-gray-600 transition-colors rounded',
            !calendarCollapsed && 'ml-2',
          )}
        >
          {calendarCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!calendarCollapsed && (
        <div className="p-5">
          {structureTab === 'yearly' && (
            <YearlyScheduleBucket value={yearlyScheduleValue} onChange={onYearlyChange} />
          )}
          {structureTab === 'marking' && (
            <MarkingPeriodsBucket value={markingPeriodsValue} onChange={onMarkingChange} />
          )}
        </div>
      )}

      <div className="flex items-start gap-2 px-5 py-3.5 bg-gray-50/80 border-t border-gray-100">
        <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed italic">
          {summary || 'Add dates above to generate a calendar summary.'}
        </p>
      </div>
    </div>
  );
}

function InlineSchoolCalendar({ cal, onChange }: { cal: SchoolCalendarData; onChange: (next: SchoolCalendarData) => void }) {
  const update = (patch: Partial<SchoolCalendarData>) => onChange({ ...cal, ...patch });
  const setCalType = (type: CalendarType) => update({ calendarType: type, markingPeriods: buildDefaultPeriods(type) });
  const updatePeriod = (id: string, patch: Partial<CalendarMarkingPeriod>) =>
    update({ markingPeriods: cal.markingPeriods.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const removePeriod = (id: string) => update({ markingPeriods: cal.markingPeriods.filter((p) => p.id !== id) });
  const autoWeekdays = countWeekdays(cal.schoolYearStart, cal.schoolYearEnd);

  return (
    <div className="mt-6 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-800">School Calendar</span>
      </div>
      <div className="px-5 py-5 space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">School Year</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Starts</div>
              <input type="date" value={cal.schoolYearStart} onChange={(e) => update({ schoolYearStart: e.target.value, instructionalDays: null })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Ends</div>
              <input type="date" value={cal.schoolYearEnd} onChange={(e) => update({ schoolYearEnd: e.target.value, instructionalDays: null })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" />
            </div>
          </div>
          {autoWeekdays > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium">Instructional Days:</span>
              <Input type="number" value={String(cal.instructionalDays ?? autoWeekdays)} onChange={(e) => { const v = e.target.value.trim(); update({ instructionalDays: v ? Number(v) : null }); }} className="h-7 w-20 text-xs" />
              {cal.instructionalDays !== null && cal.instructionalDays !== autoWeekdays && (
                <button type="button" onClick={() => update({ instructionalDays: null })} className="text-[11px] text-purple-600 hover:underline">Reset to auto ({autoWeekdays})</button>
              )}
            </div>
          )}
        </div>
        <Separator />
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Marking Periods</h4>
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendar Type</div>
            <select className="h-9 w-full max-w-[200px] rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700" value={cal.calendarType ?? ""} onChange={(e) => { const v = e.target.value as CalendarType; if (v) setCalType(v); }}>
              <option value="">Select…</option>
              {CALENDAR_TYPE_OPTIONS.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
            </select>
          </div>
          {cal.markingPeriods.length > 0 && (
            <div className="space-y-2 mt-3">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center mb-1 pl-1">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Name</span>
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">Start Date</span>
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide w-36 text-center">End Date</span>
                <span className="w-8" />
              </div>
              {cal.markingPeriods.map((period) => (
                <div key={period.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center p-2 rounded-lg border border-gray-200 bg-gray-50/50">
                  <input type="text" value={period.name} onChange={(e) => updatePeriod(period.id, { name: e.target.value })} className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300 w-full" />
                  <input type="date" value={period.startDate} onChange={(e) => updatePeriod(period.id, { startDate: e.target.value })} className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" />
                  <input type="date" value={period.endDate} onChange={(e) => updatePeriod(period.id, { endDate: e.target.value })} className="w-36 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-300" />
                  <button onClick={() => removePeriod(period.id)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScheduleElement({ componentType, data, onChange, schoolCalendar: schoolCalendarProp, onSchoolCalendarChange }: ScheduleElementProps) {
  const [activeSection, setActiveSection] = useState<ElementSection>('practices');
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [structureTab, setStructureTab] = useState<StructureTab>('yearly');
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const elementData = data['schedule'] ?? {};

  useEffect(() => {
    setOpenQuestionId(null);
  }, [activeSection]);

  function handleBucketChange(questionId: string, bucketId: string, value: BucketValue) {
    const key = `${questionId}__${bucketId}`;
    // Read from the freshest data (passed in) to avoid stale-closure overwrites
    // when multiple bucket edits batch in the same React tick.
    const latestSchedule = (data['schedule'] ?? {}) as Record<string, BucketValue>;
    onChange({ ...data, schedule: { ...latestSchedule, [key]: value } });
  }

  function getQuestionData(questionId: string): Record<string, BucketValue> {
    const result: Record<string, BucketValue> = {};
    const prefix = `${questionId}__`;
    for (const [k, v] of Object.entries(elementData)) {
      if (k.startsWith(prefix)) {
        result[k.slice(prefix.length)] = v as BucketValue;
      }
    }
    return result;
  }

  const yearlyScheduleValue: YearlyScheduleValue =
    (elementData['schedule-q2__yearly-schedule']?.yearlySchedule) ?? { entries: [] };

  const markingPeriodsValue: MarkingPeriodsValue =
    (elementData['schedule-q2__marking-periods']?.markingPeriods) ?? { periodType: null, periods: [] };

  function handleYearlyChange(v: YearlyScheduleValue) {
    const latestSchedule = (data['schedule'] ?? {}) as Record<string, BucketValue>;
    onChange({
      ...data,
      schedule: { ...latestSchedule, 'schedule-q2__yearly-schedule': { yearlySchedule: v } as any },
    });
  }

  function handleMarkingChange(v: MarkingPeriodsValue) {
    const latestSchedule = (data['schedule'] ?? {}) as Record<string, BucketValue>;
    onChange({
      ...data,
      schedule: { ...latestSchedule, 'schedule-q2__marking-periods': { markingPeriods: v } as any },
    });
  }

  const visibleQuestions = SCHEDULE_ELEMENT.questions.filter(
    (q) => q.section === activeSection,
  );

  return (
    <div className="space-y-0">
      {/* Section tab bar */}
      <div className="flex gap-0 border-b border-gray-200 mb-8 -mx-6 px-6">
        {SECTION_TABS.map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-[hsl(var(--leap))] text-[hsl(var(--leap))]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Questions for active section */}
      <div className="space-y-12">
        {visibleQuestions.map((question, i) => {
          const displayIndex = i + 1;
          const calendarSummary = generateCalendarSummary(yearlyScheduleValue, markingPeriodsValue);
          return (
            <div key={question.id}>
              {i > 0 && <div className="border-t border-gray-100 mb-12" />}
              <QuestionSection
                index={displayIndex}
                question={question}
                data={getQuestionData(question.id)}
                componentType={componentType}
                onChange={(bucketId, value) => handleBucketChange(question.id, bucketId, value)}
                bucketsExpanded={openQuestionId === question.id}
                onToggleBuckets={() =>
                  setOpenQuestionId((cur) => (cur === question.id ? null : question.id))
                }
              />

              {question.id === 'schedule-q2' &&
                componentType === 'center' &&
                openQuestionId === question.id &&
                schoolCalendarProp &&
                onSchoolCalendarChange && (
                  <InlineSchoolCalendar
                    cal={schoolCalendarProp}
                    onChange={onSchoolCalendarChange}
                  />
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
