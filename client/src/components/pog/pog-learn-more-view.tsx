"use client";

import { ChevronLeft, BookOpen, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PLACEHOLDER_LINKS = [
  "Video & written explanations",
  "Chat with chatbot for clarifying questions",
  "Key considerations for decision making",
  "Value proposition activities (virtual/in-person, solo/group)",
  "Examples applied in other blueprints",
];

export default function PogLearnMoreView({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="pog-learn-more-view">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900 truncate">Learn about Portrait of a Graduate</h2>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">How POG attributes connect your vision to outcomes</p>
            </div>
            <Badge variant="secondary" className="bg-gray-200 text-gray-700 text-[10px] h-6">
              Learn more
            </Badge>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-gray-800 leading-relaxed">
            Portrait of a Graduate is a way to describe the characteristics you want graduates to embody (attributes), and explicitly connect those attributes
            to the outcomes your school is targeting.
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">How it works</div>
            <div className="space-y-1.5 text-sm text-gray-800">
              <div>
                <span className="font-semibold text-blue-700">Create attributes</span>: Define a name, description, and icon (e.g., “Resilient achiever”).
              </div>
              <div>
                <span className="font-semibold text-blue-700">Link outcomes</span>: Choose outcomes that build that attribute, and set H/M/L emphasis for the
                link.
              </div>
              <div>
                <span className="font-semibold text-blue-700">Auto-add to Whole School outcomes</span>: Any linked outcome is added to Whole School outcomes.
                Portrait links do not set or override center-level outcome priority.
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">Links to learn more</div>
            <ul className="space-y-1.5">
              {PLACEHOLDER_LINKS.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-gray-500">
                  <Link2 className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="text-[11px] text-gray-400 italic">These links are placeholders for now.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

