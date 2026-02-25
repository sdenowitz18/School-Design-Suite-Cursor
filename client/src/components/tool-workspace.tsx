"use client";

import React, { useMemo, useState } from "react";
import { Bot, FileDown, Library, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AICompanionPanel from "./ai-companion-panel";

type ToolId = "none" | "aiChat" | "exportBuilder" | "moduleLibrary";

function ToolCard({
  title,
  description,
  icon,
  onClick,
  testId,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors p-4 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
      )}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500 mt-1">{description}</div>
        </div>
      </div>
    </button>
  );
}

export default function ToolWorkspace({
  component,
  onOpenChat,
}: {
  component: any | null;
  onOpenChat?: () => void;
}) {
  const [activeTool, setActiveTool] = useState<ToolId>("none");

  const headerTitle = useMemo(() => {
    if (activeTool === "aiChat") return "AI Chatbot";
    if (activeTool === "exportBuilder") return "Export Builder";
    if (activeTool === "moduleLibrary") return "Module Library";
    return "Tools";
  }, [activeTool]);

  const toolHeader = (
    <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-900">{headerTitle}</div>
        {activeTool === "none" ? (
          <div className="text-xs text-gray-500 mt-1">Choose a tool to open in this workspace.</div>
        ) : (
          <div className="text-xs text-gray-500 mt-1">
            Component in focus: <span className="font-semibold text-gray-700">{String(component?.title || component?.nodeId || "—")}</span>
          </div>
        )}
      </div>

      {activeTool !== "none" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveTool("none")}
          data-testid="tool-close"
          title="Close tool"
        >
          <X className="w-4 h-4 text-gray-500" />
        </Button>
      )}
    </div>
  );

  const toolBody = (() => {
    if (activeTool === "none") {
      return (
        <div className="p-6 space-y-3">
          <ToolCard
            title="AI Chatbot"
            description="Analyze, summarize, compare, and scaffold edits without losing context."
            icon={<Bot className="w-4 h-4 text-gray-700" />}
            onClick={() => (onOpenChat ? onOpenChat() : setActiveTool("aiChat"))}
            testId="toolcard-ai-chat"
          />
          <ToolCard
            title="Export Builder"
            description="Build an export-ready artifact from this component."
            icon={<FileDown className="w-4 h-4 text-gray-700" />}
            onClick={() => setActiveTool("exportBuilder")}
            testId="toolcard-export-builder"
          />
          <ToolCard
            title="Module Library"
            description="Browse compatible models and modules to inform design choices."
            icon={<Library className="w-4 h-4 text-gray-700" />}
            onClick={() => setActiveTool("moduleLibrary")}
            testId="toolcard-module-library"
          />
        </div>
      );
    }

    if (activeTool === "aiChat") {
      return (
        <AICompanionPanel component={component} embedded />
      );
    }

    if (activeTool === "exportBuilder") {
      return (
        <div className="p-6 text-sm text-gray-600">
          Export Builder is coming soon.
        </div>
      );
    }

    return (
      <div className="p-6 text-sm text-gray-600">
        Module Library is coming soon.
      </div>
    );
  })();

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {toolHeader}
      <div className="flex-1 overflow-y-auto">{toolBody}</div>
    </div>
  );
}

