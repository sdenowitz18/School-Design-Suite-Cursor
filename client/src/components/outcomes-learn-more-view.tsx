"use client";

import { ChevronLeft, BookOpen, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LEAP_DESCRIPTIONS, OUTCOME_DESCRIPTIONS } from "./designed-experience-schemas";

function outcomeDescription(label: string): string {
  const clean = String(label || "").trim();
  if (!clean) return "This outcome represents a target result for learners in this component.";
  const direct = (OUTCOME_DESCRIPTIONS as any)?.[clean];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return `${clean} is an outcome focus area describing what learners should develop over time. Use the notes on the outcome page to clarify what “${clean}” looks like in practice here.`;
}

function leapDescription(label: string): string {
  const clean = String(label || "").trim();
  if (!clean) return "This leap names a design principle for how learning is structured and supported.";
  const direct = LEAP_DESCRIPTIONS[clean];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return `${clean} is a design principle for this component. Use the notes on the leap page to say how it shows up in practice.`;
}

const PLACEHOLDER_LINKS = [
  "Video & written explanations",
  "Chat with chatbot for clarifying questions",
  "Key considerations for decision making",
  "Value proposition activities (virtual/in-person, solo/group)",
  "Examples applied in other blueprints",
];

export default function OutcomesLearnMoreView({
  mode,
  outcomeLabel,
  leapLabel,
  onBack,
}: {
  mode: "schema" | "outcome" | "leap";
  outcomeLabel?: string;
  leapLabel?: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto p-6" data-testid="outcomes-learn-more-view">
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
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  {mode === "schema"
                    ? "Learn about Outcomes"
                    : mode === "leap"
                      ? `Learn about: ${String(leapLabel || "").trim() || "Leap"}`
                      : `Learn about: ${String(outcomeLabel || "").trim() || "Outcome"}`}
                </h2>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {mode === "schema"
                  ? "What students will know and be able to do"
                  : mode === "leap"
                    ? "What this design principle means, in plain language"
                    : "What this outcome means, in plain language"}
              </p>
            </div>
            <Badge variant="secondary" className="bg-gray-200 text-gray-700 text-[10px] h-6">
              Learn more
            </Badge>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {mode === "schema" ? (
            <>
              <div className="text-sm text-gray-800 leading-relaxed">
                Outcomes define the specific results the school aims for in learners’ growth — the knowledge, skills, and mindsets students develop across the designed experience.
                They clarify what success looks like and guide how learning experiences are designed and assessed.
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">Categories</div>
                <div className="space-y-1.5 text-sm text-gray-800">
                  <div>
                    <span className="font-semibold text-blue-700">STEM</span>: Applying scientific and mathematical thinking to understand and solve real-world problems.
                  </div>
                  <div>
                    <span className="font-semibold text-blue-700">Arts &amp; Humanities</span>: Expressing ideas creatively and understanding human experience through culture, language, and history.
                  </div>
                  <div>
                    <span className="font-semibold text-blue-700">Learning &amp; Life</span>: Building essential skills for learning, collaboration, communication, and self-direction.
                  </div>
                  <div>
                    <span className="font-semibold text-blue-700">Wellbeing</span>: Developing the habits, relationships, and emotional resilience that support thriving.
                  </div>
                  <div>
                    <span className="font-semibold text-blue-700">Wayfinding</span>: Exploring identity, purpose, and future pathways for life, work, and contribution.
                  </div>
                </div>
              </div>
            </>
          ) : mode === "leap" ? (
            <div className="text-sm text-gray-800 leading-relaxed">{leapDescription(String(leapLabel || ""))}</div>
          ) : (
            <div className="text-sm text-gray-800 leading-relaxed">{outcomeDescription(String(outcomeLabel || ""))}</div>
          )}

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

