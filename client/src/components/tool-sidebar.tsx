"use client";

import React from "react";
import { Bot, ChevronLeft, ChevronRight, FileDown, Library, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ToolId = "aiChat" | "moduleLibrary" | "exportBuilder";

export type ToolMeta = {
  id: ToolId;
  name: string;
  description: string;
  icon: React.ReactNode;
};

const TOOL_META: ToolMeta[] = [
  {
    id: "aiChat",
    name: "AI Chatbot",
    description: "Analyze, summarize, compare, and scaffold edits without losing context.",
    icon: <Bot className="w-4 h-4" />,
  },
  {
    id: "moduleLibrary",
    name: "Module Library",
    description: "Browse compatible models and modules to inform design choices.",
    icon: <Library className="w-4 h-4" />,
  },
  {
    id: "exportBuilder",
    name: "Export Builder",
    description: "Build an export-ready artifact from this component.",
    icon: <FileDown className="w-4 h-4" />,
  },
];

export function getToolMeta(id: ToolId): ToolMeta {
  return TOOL_META.find((t) => t.id === id) ?? TOOL_META[0]!;
}

export default function ToolSidebar({
  expanded,
  onToggleExpanded,
  pane2Tool,
  pane3Tool,
  onToggleTool,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
  pane2Tool: ToolId | null;
  pane3Tool: ToolId | null;
  onToggleTool: (toolId: ToolId) => void;
}) {
  const inUsePaneFor = (id: ToolId): 2 | 3 | null => {
    if (pane2Tool === id) return 2;
    if (pane3Tool === id) return 3;
    return null;
  };

  const widthClass = expanded ? "w-[320px]" : "w-14";

  return (
    <div
      className={cn(
        "h-full border-l border-gray-200 bg-white flex flex-col shrink-0",
        widthClass,
      )}
      data-testid="tool-sidebar"
    >
      <div className={cn("px-2 py-2 border-b border-gray-100 flex items-center", expanded ? "justify-between" : "justify-center")}>
        {expanded ? (
          <>
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wide px-1">Tools</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpanded}
              title="Collapse tools"
              data-testid="tool-sidebar-collapse"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleExpanded}
            title="Expand tools"
            data-testid="tool-sidebar-expand"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Button>
        )}
      </div>

      <div className={cn("flex-1 overflow-y-auto", expanded ? "p-2 space-y-2" : "py-3 flex flex-col items-center gap-2")}>
        {TOOL_META.map((t) => {
          const inUse = inUsePaneFor(t.id);
          const active = !!inUse;

          if (!expanded) {
            return (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "relative w-10 h-10 rounded-lg border flex items-center justify-center transition-colors",
                  active ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                )}
                onClick={() => onToggleTool(t.id)}
                title={t.name}
                data-testid={`tool-sidebar-icon-${t.id}`}
              >
                {t.icon}
                {inUse && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-900 text-white text-[10px] leading-4 font-bold text-center">
                    {inUse}
                  </span>
                )}
              </button>
            );
          }

          return (
            <button
              key={t.id}
              type="button"
              className={cn(
                "w-full text-left rounded-xl border transition-colors p-3 shadow-sm",
                active ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200 hover:bg-gray-50",
              )}
              onClick={() => onToggleTool(t.id)}
              data-testid={`tool-sidebar-row-${t.id}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                    active ? "border-blue-200 bg-white text-blue-700" : "border-gray-200 bg-gray-50 text-gray-700",
                  )}
                >
                  {t.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-gray-900">{t.name}</div>
                    {inUse && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-900 text-white">
                        Pane {inUse}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{t.description}</div>
                  {active && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-blue-700 font-semibold">
                      <X className="w-3.5 h-3.5" />
                      Click to close
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

