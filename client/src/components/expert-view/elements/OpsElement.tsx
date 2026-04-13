import React, { useEffect, useState } from 'react';
import { QuestionSection } from '../QuestionSection';
import { OPS_ELEMENT } from '../ops-element-schema';
import type { BucketValue, ComponentType, ElementSection, ElementsExpertData } from '../expert-view-types';

interface OpsElementProps {
  componentType: ComponentType;
  data: ElementsExpertData;
  onChange: (next: ElementsExpertData) => void;
}

const SECTION_TABS: { id: ElementSection; label: string }[] = [
  { id: 'practices', label: 'Practices & Approaches' },
  { id: 'tools', label: 'Tools & Resources' },
];

export function OpsElement({ componentType, data, onChange }: OpsElementProps) {
  const [activeSection, setActiveSection] = useState<ElementSection>('practices');
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const elementData = data['ops'] ?? {};

  useEffect(() => {
    setOpenQuestionId(null);
  }, [activeSection]);

  function handleBucketChange(questionId: string, bucketId: string, value: BucketValue) {
    const key = `${questionId}__${bucketId}`;
    onChange({ ...data, ops: { ...elementData, [key]: value } });
  }

  function getQuestionData(questionId: string): Record<string, BucketValue> {
    const result: Record<string, BucketValue> = {};
    const prefix = `${questionId}__`;
    for (const [k, v] of Object.entries(elementData)) {
      if (k.startsWith(prefix)) result[k.slice(prefix.length)] = v as BucketValue;
    }
    return result;
  }

  const visibleQuestions = OPS_ELEMENT.questions.filter((q) => q.section === activeSection);

  return (
    <div className="space-y-0">
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

      <div className="space-y-12">
        {visibleQuestions.map((question, i) => (
          <div key={question.id}>
            {i > 0 && <div className="border-t border-gray-100 mb-12" />}
            <QuestionSection
              index={i + 1}
              question={question}
              data={getQuestionData(question.id)}
              componentType={componentType}
              onChange={(bucketId, value) => handleBucketChange(question.id, bucketId, value)}
              bucketsExpanded={openQuestionId === question.id}
              onToggleBuckets={() =>
                setOpenQuestionId((cur) => (cur === question.id ? null : question.id))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
