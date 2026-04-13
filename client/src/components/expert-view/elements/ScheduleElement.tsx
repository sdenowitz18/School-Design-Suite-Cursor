import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface ScheduleElementProps {
  componentType: ComponentType;
  data: ElementsExpertData;
  onChange: (next: ElementsExpertData) => void;
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

export function ScheduleElement({ componentType, data, onChange }: ScheduleElementProps) {
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
    const nextElementData = { ...elementData, [key]: value };
    onChange({ ...data, schedule: nextElementData });
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
    onChange({ ...data, schedule: { ...elementData, 'schedule-q2__yearly-schedule': { yearlySchedule: v } } });
  }

  function handleMarkingChange(v: MarkingPeriodsValue) {
    onChange({ ...data, schedule: { ...elementData, 'schedule-q2__marking-periods': { markingPeriods: v } } });
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

              {question.id === 'schedule-q2' && componentType === 'center' && (
                <ScheduleSchoolCalendarCard
                  summary={calendarSummary}
                  structureTab={structureTab}
                  setStructureTab={setStructureTab}
                  calendarCollapsed={calendarCollapsed}
                  setCalendarCollapsed={setCalendarCollapsed}
                  yearlyScheduleValue={yearlyScheduleValue}
                  markingPeriodsValue={markingPeriodsValue}
                  onYearlyChange={handleYearlyChange}
                  onMarkingChange={handleMarkingChange}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
