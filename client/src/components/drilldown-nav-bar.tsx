"use client";

import React from "react";
import { ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type DrilldownAncestor = { label: string; onNavigate: () => void };

export function DrilldownNavBar({
  sectionTitle,
  onNavigateSectionRoot,
  ancestors,
  currentTitle,
  onBack,
}: {
  /** e.g. "Designed Experience" or "Status and Health" */
  sectionTitle: string;
  /** Clicking the first breadcrumb — return to that section’s home surface */
  onNavigateSectionRoot: () => void;
  ancestors: DrilldownAncestor[];
  currentTitle: string;
  onBack: () => void;
}) {
  return (
    <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
      <div className="flex items-start justify-between gap-4 max-w-5xl mx-auto w-full">
        <div className="flex-1 min-w-0 pr-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold hover:text-gray-800"
            onClick={onBack}
            data-testid="drilldown-nav-back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <Breadcrumb className="mt-2">
            <BreadcrumbList className="flex-nowrap gap-0.5 sm:gap-1 text-xs text-gray-500">
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbLink asChild>
                  <button
                    type="button"
                    className="font-medium text-gray-500 hover:text-gray-900 max-w-[12rem] sm:max-w-none truncate text-left"
                    onClick={onNavigateSectionRoot}
                    data-testid="drilldown-crumb-section-root"
                  >
                    {sectionTitle}
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {ancestors.map((a, i) => (
                <React.Fragment key={`${i}-${a.label}`}>
                  <BreadcrumbSeparator className="px-0.5 [&>svg]:size-3.5 text-gray-300" />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        className="font-medium text-gray-500 hover:text-gray-900 max-w-[12rem] sm:max-w-none truncate text-left"
                        onClick={a.onNavigate}
                        data-testid={`drilldown-crumb-${i}`}
                      >
                        {a.label}
                      </button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
              <BreadcrumbSeparator className="px-0.5 [&>svg]:size-3.5 text-gray-300" />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="font-semibold text-gray-900 whitespace-normal break-words leading-snug">
                  {currentTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
    </div>
  );
}
