import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Building2, Clock, Globe, HeartHandshake, RefreshCw, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduleElement } from './elements/ScheduleElement';
import { CultureElement } from './elements/CultureElement';
import { FacilitatorElement } from './elements/FacilitatorElement';
import { LearningElement } from './elements/LearningElement';
import { ImprovementElement } from './elements/ImprovementElement';
import { OpsElement } from './elements/OpsElement';
import { PartnershipsElement } from './elements/PartnershipsElement';
import type { ComponentType, ElementsExpertData } from './expert-view-types';

const ELEMENT_META: Record<
  string,
  { title: string; subtitle: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  schedule: {
    title: 'Schedule & Use of Time',
    subtitle:
      'Define the time blocks, scheduling structures, and tools that shape this component\u2019s experience.',
    Icon: Clock,
  },
  learning: {
    title: 'Learning Activities, Instructional Practices, C&A',
    subtitle:
      'Define learning activities, facilitation approaches, curriculum, and assessment for this component.',
    Icon: BookOpen,
  },
  culture: {
    title: 'Systems & Practices for School Culture',
    subtitle:
      'Define culture- and community-focused activities, facilitation support, and cultural touchstones for this component.',
    Icon: HeartHandshake,
  },
  facilitator: {
    title: 'Facilitator Roles & Configurations',
    subtitle:
      'Define who facilitates this component, in what configurations and ratios, and what supports their role.',
    Icon: Users,
  },
  partnerships: {
    title: 'Community & Family Partnerships',
    subtitle:
      'Define the community partnerships, family communications, and coordination systems that connect this component to the broader community.',
    Icon: Globe,
  },
  ops: {
    title: 'Operations, Budget & Infrastructure',
    subtitle:
      'Define the physical & digital spaces, transportation, food, cost & funding, and operational systems that enable this component.',
    Icon: Building2,
  },
  improvement: {
    title: 'Continuous Improvement & Design',
    subtitle:
      'Define who drives improvement and design of this component, what practices are used, and what tools support them.',
    Icon: RefreshCw,
  },
};

const ELEMENTS = [
  { id: 'schedule', label: 'Schedule & Use of Time' },
  { id: 'learning', label: 'Learning Activities, Instructional Practices, C&A' },
  { id: 'culture', label: 'Systems & Practices for School Culture' },
  { id: 'facilitator', label: 'Facilitator Roles & Configurations' },
  { id: 'partnerships', label: 'Community & Family Partnerships' },
  { id: 'ops', label: 'Operations, Budget & Infrastructure' },
  { id: 'improvement', label: 'Continuous Improvement & Design' },
] as const;

interface ExpertViewShellProps {
  componentTitle: string;
  componentType: ComponentType;
  /** Which top element tab to show (e.g. `schedule`, `learning`). */
  initialActiveElement?: string;
  data: ElementsExpertData;
  onChange: (next: ElementsExpertData) => void;
  onBack: () => void;
  /** School-wide (`overall`) expert data — passed to ring views for “same as school-wide” mirrors. */
  schoolWideElementsExpertData?: ElementsExpertData;
}

export function ExpertViewShell({
  componentTitle,
  componentType: initialType,
  initialActiveElement = 'schedule',
  data,
  onChange,
  onBack,
  schoolWideElementsExpertData,
}: ExpertViewShellProps) {
  const [activeElement, setActiveElement] = useState<string>(initialActiveElement);
  // Demo-only toggle for switching center/ring
  const [componentType, setComponentType] = useState<ComponentType>(initialType);

  useEffect(() => {
    setComponentType(initialType);
  }, [initialType]);

  const headerMeta = ELEMENT_META[activeElement] ?? ELEMENT_META.schedule;
  const HeaderIcon = headerMeta.Icon;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Back row */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Designed Experience
          </button>

          {/* Context badge + demo toggle */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full border',
                componentType === 'center'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200',
              )}
            >
              {componentTitle} · {componentType === 'center' ? 'Center component' : 'Ring component'}
            </span>

            {/* Demo toggle */}
            <button
              onClick={() => setComponentType((t) => (t === 'center' ? 'ring' : 'center'))}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded px-1.5 py-0.5 transition-colors"
              title="Demo: switch component type"
            >
              {componentType === 'center' ? (
                <ToggleLeft className="w-3.5 h-3.5" />
              ) : (
                <ToggleRight className="w-3.5 h-3.5" />
              )}
              demo
            </button>
          </div>
        </div>

        {/* Element tab bar */}
        <div className="overflow-x-auto">
          <div className="flex border-t border-gray-100 px-4 gap-1 min-w-max">
            {ELEMENTS.map((el) => {
              const isActive = activeElement === el.id;
              return (
                <button
                  key={el.id}
                  onClick={() => setActiveElement(el.id)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-3 py-2.5 border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-purple-600 text-purple-700 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
                  )}
                >
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0" />}
                  {el.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Element header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <HeaderIcon className="w-4 h-4 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">{headerMeta.title}</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">{headerMeta.subtitle}</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 pb-24 max-w-3xl mx-auto w-full">
        {activeElement === 'schedule' && (
          <ScheduleElement
            componentType={componentType}
            data={data}
            onChange={onChange}
          />
        )}
        {activeElement === 'learning' && (
          <LearningElement
            componentType={componentType}
            data={data}
            onChange={onChange}
          />
        )}
        {activeElement === 'culture' && (
          <CultureElement
            componentType={componentType}
            data={data}
            onChange={onChange}
            schoolWideElementsExpertData={schoolWideElementsExpertData}
          />
        )}
        {activeElement === 'facilitator' && (
          <FacilitatorElement componentType={componentType} data={data} onChange={onChange} />
        )}
        {activeElement === 'partnerships' && (
          <PartnershipsElement componentType={componentType} data={data} onChange={onChange} />
        )}
        {activeElement === 'ops' && (
          <OpsElement componentType={componentType} data={data} onChange={onChange} />
        )}
        {activeElement === 'improvement' && (
          <ImprovementElement componentType={componentType} data={data} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
