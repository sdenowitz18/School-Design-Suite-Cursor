"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildExecutiveSummary, buildExecutiveSummaryText, type ExecutiveSummary } from "@/lib/executive-summary";
import { useUpdateComponent } from "@/lib/api";
import { listOutcomesByDomain, searchSchemaItems, type SchemaType } from "@/lib/schema-catalog";

type Role = "user" | "assistant";

type Message =
  | { id: string; role: Role; kind: "text"; content: string }
  | {
      id: string;
      role: Role;
      kind: "question";
      questionId: string;
      prompt: string;
      options: { id: string; label: string }[];
    }
  | {
      id: string;
      role: Role;
      kind: "proposal";
      proposalId: string;
      title: string;
      body: string;
      patch: { nodeId: string; data: any };
    };

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function deId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function stripQuotes(s: string) {
  return s.trim().replace(/^["“”']+|["“”']+$/g, "").trim();
}

function toTagLevel(s: string): "High" | "Medium" | "Low" | null {
  const t = normalize(s);
  if (t.startsWith("h")) return "High";
  if (t.startsWith("m")) return "Medium";
  if (t.startsWith("l")) return "Low";
  return null;
}

function formatSchemaResults(title: string, items: { label: string; description: string; categoryPath?: string[] }[], total: number) {
  if (!items.length) return `${title}\nNo matches found.`;
  const lines = items.map((it) => {
    const cat = it.categoryPath && it.categoryPath.length ? ` (${it.categoryPath.join(" / ")})` : "";
    return `- ${it.label}${cat}: ${it.description}`;
  });
  const more = total > items.length ? `\n\nShowing ${items.length} of ${total}.` : "";
  return `${title}\n${lines.join("\n")}${more}`;
}

const STARTERS = [
  { id: "evaluate", label: "Please evaluate my component design" },
  { id: "exec_summary", label: "Give me an executive summary of this component" },
  { id: "updates", label: "Help me make updates to this component" },
  { id: "side_by_side", label: "Open a side-by-side with an earlier version of this component" },
  { id: "search_library", label: "Search for compatible models in the module library" },
] as const;

type UpdateFlowStep = "idle" | "choose_area" | "de_freeform";

export default function AICompanionPanel({
  component,
  embedded = false,
  onExitChat,
}: {
  component: any | null;
  embedded?: boolean;
  onExitChat?: () => void;
}) {
  const updateMutation = useUpdateComponent();

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: uid(),
      role: "assistant",
      kind: "text",
      content:
        "A thinking partner that can help support Design Partners and design team members to engage with components within the design to support general sense-making, designing, testing, and implementation.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [pendingOutcomeAdd, setPendingOutcomeAdd] = useState<{
    label: string;
    priority: "H" | "M" | "L";
  } | null>(null);
  const [lastSummary, setLastSummary] = useState<ExecutiveSummary | null>(null);
  const [updateFlowStep, setUpdateFlowStep] = useState<UpdateFlowStep>("idle");
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const hasOnlyIntro = messages.length === 1;

  const componentLabel = useMemo(() => {
    const title = String(component?.title || "").trim();
    return title || String(component?.nodeId || "Component");
  }, [component]);

  const resetChat = () => {
    setMessages([
      {
        id: uid(),
        role: "assistant",
        kind: "text",
        content:
          "A thinking partner that can help support Design Partners and design team members to engage with components within the design to support general sense-making, designing, testing, and implementation.",
      },
    ]);
    setDraft("");
    setPendingOutcomeAdd(null);
    setLastSummary(null);
    setUpdateFlowStep("idle");
    setApplyingProposalId(null);
  };

  const pushUser = (content: string) => {
    const text = content.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: uid(), role: "user", kind: "text", content: text }]);
  };

  const pushAssistantText = (content: string) => {
    setMessages((prev) => [...prev, { id: uid(), role: "assistant", kind: "text", content }]);
  };

  const pushQuestion = (questionId: string, prompt: string, options: { id: string; label: string }[]) => {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "assistant", kind: "question", questionId, prompt, options },
    ]);
  };

  const pushProposal = (title: string, body: string, patch: { nodeId: string; data: any }) => {
    const proposalId = deId("proposal");
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        kind: "proposal",
        proposalId,
        title,
        body,
        patch,
      },
    ]);
  };

  const pushExecutiveSummary = () => {
    const summary = buildExecutiveSummary(component);
    setLastSummary(summary);
    pushAssistantText(buildExecutiveSummaryText(component));
  };

  const pushOutcomePriorityQuestion = (label: string, priority: "H" | "M" | "L") => {
    setPendingOutcomeAdd({ label, priority });
    pushQuestion(
      "outcome_priority_isPriority",
      `Before I add “${label}” at ${priority === "H" ? "high" : priority === "M" ? "medium" : "low"} priority: is this a priority outcome?`,
      [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    );
  };

  const handleStarter = (id: (typeof STARTERS)[number]["id"]) => {
    const starter = STARTERS.find((s) => s.id === id);
    if (!starter) return;
    pushUser(starter.label);

    if (id === "exec_summary") {
      pushExecutiveSummary();
      return;
    }

    if (id === "updates") {
      setUpdateFlowStep("choose_area");
      pushQuestion("choose_update_area", "What area do you want to update?", [
        { id: "designed_experience", label: "Designed Experience" },
        { id: "status_health", label: "Status & Health" },
      ]);
      return;
    }

    if (id === "evaluate") {
      pushAssistantText("Coming soon: automated evaluation of design coherence, gaps, and risks.");
      return;
    }

    if (id === "side_by_side") {
      pushAssistantText("Coming soon: side-by-side comparison requires version history for this component.");
      return;
    }

    pushAssistantText("Coming soon: module library search will appear here once the library is available.");
  };

  const buildDesignedExperiencePatchFromText = (raw: string) => {
    const nodeId = String(component?.nodeId || "").trim();
    if (!nodeId) return { error: "No component is in focus." as const };

    const de: any = (component as any)?.designedExperienceData || {};
    const keyDesignElements: any = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const subcomponents: any[] = Array.isArray(de.subcomponents) ? de.subcomponents : [];

    const text = raw.trim();
    const q = normalize(text);

    // Common patterns.
    const mAddSub = text.match(/^(?:add|create)\s+(?:a\s+)?subcomponent\s+(?:named\s+)?(.+)$/i);
    if (mAddSub?.[1]) {
      const name = stripQuotes(mAddSub[1]);
      if (!name) return { error: "What should the new subcomponent be named?" as const };
      const exists = subcomponents.some((s) => normalize(String(s?.name || "")) === normalize(name));
      if (exists) return { error: `A subcomponent named “${name}” already exists.` as const };
      const nextSubs = [
        ...subcomponents,
        { id: deId("sc"), name, description: "", aims: [], practices: [], supports: [] },
      ];
      return {
        patch: {
          nodeId,
          data: { designedExperienceData: { ...de, subcomponents: nextSubs } },
        },
        summary: `Add subcomponent “${name}”.`,
      };
    }

    const mDeleteSub = text.match(/^(?:delete|remove)\s+subcomponent\s+(.+)$/i);
    if (mDeleteSub?.[1]) {
      const name = stripQuotes(mDeleteSub[1]);
      const idx = subcomponents.findIndex((s) => normalize(String(s?.name || "")) === normalize(name));
      if (idx < 0) return { error: `I couldn’t find a subcomponent named “${name}”.` as const };
      const nextSubs = subcomponents.filter((_, i) => i !== idx);
      return {
        patch: { nodeId, data: { designedExperienceData: { ...de, subcomponents: nextSubs } } },
        summary: `Delete subcomponent “${name}”.`,
      };
    }

    const mRenameSub = text.match(/^rename\s+subcomponent\s+(.+?)\s+to\s+(.+)$/i);
    if (mRenameSub?.[1] && mRenameSub?.[2]) {
      const from = stripQuotes(mRenameSub[1]);
      const to = stripQuotes(mRenameSub[2]);
      const idx = subcomponents.findIndex((s) => normalize(String(s?.name || "")) === normalize(from));
      if (idx < 0) return { error: `I couldn’t find a subcomponent named “${from}”.` as const };
      if (!to) return { error: "What should the new name be?" as const };
      const collision = subcomponents.some((s, i) => i !== idx && normalize(String(s?.name || "")) === normalize(to));
      if (collision) return { error: `A subcomponent named “${to}” already exists.` as const };
      const nextSubs = subcomponents.map((s, i) => (i === idx ? { ...s, name: to } : s));
      return {
        patch: { nodeId, data: { designedExperienceData: { ...de, subcomponents: nextSubs } } },
        summary: `Rename subcomponent “${from}” → “${to}”.`,
      };
    }

    const mSetDeDesc = text.match(/^(?:set|update)\s+(?:the\s+)?designed\s+experience\s+description\s+to\s+(.+)$/i);
    if (mSetDeDesc?.[1]) {
      const next = stripQuotes(mSetDeDesc[1]);
      if (!next) return { error: "What should the Designed Experience description be?" as const };
      return {
        patch: { nodeId, data: { designedExperienceData: { ...de, description: next } } },
        summary: "Update Designed Experience description.",
      };
    }

    // Add/remove tags (key design elements or a specific subcomponent).
    const mTag = text.match(/^(add|remove)\s+(?:an?\s+)?(outcome|leap|practice|support)\s+(.+?)(?:\s+(?:to|in|for)\s+(?:the\s+)?subcomponent\s+(.+))?$/i);
    if (mTag?.[1] && mTag?.[2] && mTag?.[3]) {
      const action = normalize(mTag[1]);
      const tagType = normalize(mTag[2]) as "outcome" | "leap" | "practice" | "support";
      const label = stripQuotes(mTag[3]);
      const subNameRaw = mTag[4] ? stripQuotes(mTag[4]) : "";

      if (!label) return { error: `What ${tagType} should I ${action}?` as const };

      const applyToKeyDesignElements = !subNameRaw;
      const targetIdx = subNameRaw
        ? subcomponents.findIndex((s) => normalize(String(s?.name || "")) === normalize(subNameRaw))
        : -1;
      if (subNameRaw && targetIdx < 0) {
        return { error: `I couldn’t find a subcomponent named “${subNameRaw}”.` as const };
      }

      const addTag = (arr: any[], tag: any) => {
        const exists = arr.some((t) => normalize(String(t?.label || "")) === normalize(tag.label) && normalize(String(t?.type || "")) === normalize(tag.type));
        return exists ? arr : [...arr, tag];
      };
      const removeTag = (arr: any[]) =>
        arr.filter((t) => !(normalize(String(t?.label || "")) === normalize(label) && normalize(String(t?.type || "")) === normalize(tagType)));

      if (applyToKeyDesignElements) {
        const nextKde = { ...keyDesignElements };
        if (action === "add") {
          const base = { id: deId("tag"), type: tagType, label };
          const withLevel =
            tagType === "outcome" || tagType === "leap" ? { ...base, level: "Medium" as const } : base;
          if (tagType === "practice") nextKde.practices = addTag(Array.isArray(nextKde.practices) ? nextKde.practices : [], withLevel);
          else if (tagType === "support") nextKde.supports = addTag(Array.isArray(nextKde.supports) ? nextKde.supports : [], withLevel);
          else nextKde.aims = addTag(Array.isArray(nextKde.aims) ? nextKde.aims : [], withLevel);
        } else {
          if (tagType === "practice") nextKde.practices = removeTag(Array.isArray(nextKde.practices) ? nextKde.practices : []);
          else if (tagType === "support") nextKde.supports = removeTag(Array.isArray(nextKde.supports) ? nextKde.supports : []);
          else nextKde.aims = removeTag(Array.isArray(nextKde.aims) ? nextKde.aims : []);
        }
        return {
          patch: { nodeId, data: { designedExperienceData: { ...de, keyDesignElements: nextKde } } },
          summary: `${action === "add" ? "Add" : "Remove"} ${tagType} “${label}” in Key Design Elements.`,
        };
      }

      const nextSubs = subcomponents.map((s, i) => {
        if (i !== targetIdx) return s;
        const next = { ...s };
        const aimsArr = Array.isArray(next.aims) ? next.aims : [];
        const practicesArr = Array.isArray(next.practices) ? next.practices : [];
        const supportsArr = Array.isArray(next.supports) ? next.supports : [];
        if (action === "add") {
          const base = { id: deId("tag"), type: tagType, label };
          const withLevel =
            tagType === "outcome" || tagType === "leap" ? { ...base, level: "Medium" as const } : base;
          if (tagType === "practice") next.practices = addTag(practicesArr, withLevel);
          else if (tagType === "support") next.supports = addTag(supportsArr, withLevel);
          else next.aims = addTag(aimsArr, withLevel);
        } else {
          if (tagType === "practice") next.practices = removeTag(practicesArr);
          else if (tagType === "support") next.supports = removeTag(supportsArr);
          else next.aims = removeTag(aimsArr);
        }
        return next;
      });

      const targetName = String(subcomponents[targetIdx]?.name || subNameRaw);
      return {
        patch: { nodeId, data: { designedExperienceData: { ...de, subcomponents: nextSubs } } },
        summary: `${action === "add" ? "Add" : "Remove"} ${tagType} “${label}” in subcomponent “${targetName}”.`,
      };
    }

    // Set aim level (priority) for outcomes/leaps, optionally within a subcomponent.
    const mLevel = text.match(/^(?:set|make)\s+(outcome|leap)\s+(.+?)\s+(high|medium|low)(?:\s+(?:in|for)\s+(?:the\s+)?subcomponent\s+(.+))?$/i);
    if (mLevel?.[1] && mLevel?.[2] && mLevel?.[3]) {
      const tagType = normalize(mLevel[1]) as "outcome" | "leap";
      const label = stripQuotes(mLevel[2]);
      const level = toTagLevel(mLevel[3]);
      const subNameRaw = mLevel[4] ? stripQuotes(mLevel[4]) : "";
      if (!label || !level) return { error: "Tell me which outcome/leap and whether it should be High/Medium/Low." as const };

      const setLevelIn = (arr: any[]) => {
        const idx = arr.findIndex((t) => normalize(String(t?.label || "")) === normalize(label) && normalize(String(t?.type || "")) === normalize(tagType));
        if (idx < 0) return { arr, found: false };
        const next = arr.slice();
        next[idx] = { ...next[idx], level };
        return { arr: next, found: true };
      };

      if (!subNameRaw) {
        const aimsArr = Array.isArray(keyDesignElements.aims) ? keyDesignElements.aims : [];
        const { arr, found } = setLevelIn(aimsArr);
        if (!found) return { error: `I couldn’t find ${tagType} “${label}” in Key Design Elements. Add it first?` as const };
        const nextKde = { ...keyDesignElements, aims: arr };
        return {
          patch: { nodeId, data: { designedExperienceData: { ...de, keyDesignElements: nextKde } } },
          summary: `Set ${tagType} “${label}” to ${level} in Key Design Elements.`,
        };
      }

      const targetIdx = subcomponents.findIndex((s) => normalize(String(s?.name || "")) === normalize(subNameRaw));
      if (targetIdx < 0) return { error: `I couldn’t find a subcomponent named “${subNameRaw}”.` as const };
      const nextSubs = subcomponents.map((s, i) => {
        if (i !== targetIdx) return s;
        const aimsArr = Array.isArray(s?.aims) ? s.aims : [];
        const { arr, found } = setLevelIn(aimsArr);
        if (!found) return s;
        return { ...s, aims: arr };
      });
      const changed = nextSubs[targetIdx] !== subcomponents[targetIdx];
      if (!changed) return { error: `I couldn’t find ${tagType} “${label}” in subcomponent “${subNameRaw}”. Add it first?` as const };
      return {
        patch: { nodeId, data: { designedExperienceData: { ...de, subcomponents: nextSubs } } },
        summary: `Set ${tagType} “${label}” to ${level} in subcomponent “${subNameRaw}”.`,
      };
    }

    return {
      error:
        "I can help update Designed Experience. Try one of these:\n- Add outcome <label>\n- Remove practice <label>\n- Set outcome <label> high/medium/low\n- Add subcomponent <name>\n- Delete subcomponent <name>\n- Rename subcomponent <from> to <to>\n(Optionally: “… in subcomponent <name>”)",
    } as const;
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    pushUser(text);

    const q = normalize(text);
    const wantsExecSummary =
      q.includes("executive summary") ||
      (q.includes("summary") && (q.includes("component") || q.includes("this")));
    if (wantsExecSummary) {
      pushExecutiveSummary();
      return;
    }

    // Schema discovery Q&A (helps users make better choices while editing).
    const looksLikeSchemaQuestion =
      q.startsWith("what ") ||
      q.startsWith("which ") ||
      q.startsWith("show ") ||
      q.startsWith("list ") ||
      q.includes("related to") ||
      q.includes("options") ||
      q.includes("available");

    const mentions = (word: string) => q.includes(word);
    const askedOutcomes = mentions("outcome");
    const askedLeaps = mentions("leap");
    const askedPractices = mentions("practice");
    const askedSupports = mentions("support") || mentions("resource") || mentions("resources");

    const isCommandLike =
      q.startsWith("add ") ||
      q.startsWith("remove ") ||
      q.startsWith("delete ") ||
      q.startsWith("rename ") ||
      q.startsWith("set ") ||
      q.startsWith("make ");

    if (looksLikeSchemaQuestion && !isCommandLike) {
      // Domain filter example: "related to STEM"
      if (askedOutcomes && (q.includes("stem") || q.includes("humanities") || q.includes("well-being") || q.includes("wellbeing") || q.includes("conduct") || q.includes("engagement") || q.includes("thinking") || q.includes("relating") || q.includes("advancement") || q.includes("professional") || q.includes("practical"))) {
        const domain =
          q.includes("stem")
            ? "STEM"
            : q.includes("humanities")
              ? "Arts & Humanities"
              : q.includes("conduct") || q.includes("engagement")
                ? "Conduct & Engagement"
                : q.includes("thinking") || q.includes("relating")
                  ? "Thinking & Relating"
                  : q.includes("advancement")
                    ? "Advancement"
                    : q.includes("professional") || q.includes("practical")
                      ? "Professional & Practical"
                      : "Wellbeing";
        const { items, total } = listOutcomesByDomain(domain, 20);
        pushAssistantText(formatSchemaResults(`Outcomes related to ${domain}`, items, total));
        return;
      }

      const type: SchemaType | undefined =
        askedOutcomes ? "outcome" : askedLeaps ? "leap" : askedPractices ? "practice" : askedSupports ? "support" : undefined;
      const { items, total } = searchSchemaItems({ query: text, type, limit: 12 });

      const title =
        type === "outcome"
          ? "Outcome options"
          : type === "leap"
            ? "Leap options"
            : type === "practice"
              ? "Practice options"
              : type === "support"
                ? "Support options"
                : "Schema options";

      pushAssistantText(formatSchemaResults(title, items, total));
      return;
    }

    const hasSummary = !!lastSummary;

    // Deterministic follow-up Q&A once summary exists.
    if (hasSummary) {
      const snap: any = component?.snapshotData || {};
      const de: any = component?.designedExperienceData || {};
      const hd: any = component?.healthData || {};

      const answer = (() => {
        if (!lastSummary) {
          // If user asked Q before we stored summary state (e.g. reload), rebuild quickly.
          return buildExecutiveSummary(component);
        }
        return lastSummary;
      })();

      const reply = (content: string) => {
        pushAssistantText(content);
      };

      const wantsOverview =
        q.includes("overview") ||
        q.includes("snapshot") ||
        q.includes("participation") ||
        q.includes("reach") ||
        q.includes("variants");
      const wantsDE =
        q.includes("designed experience") ||
        q.includes("design") ||
        q.includes("aim") ||
        q.includes("aims") ||
        q.includes("practice") ||
        q.includes("practices") ||
        q.includes("support") ||
        q.includes("supports") ||
        q.includes("leap") ||
        q.includes("leaps");
      const wantsHealth =
        q.includes("status") ||
        q.includes("health") ||
        q.includes("score") ||
        q.includes("outcome score") ||
        q.includes("experience score") ||
        q.includes("implementation") ||
        q.includes("conditions");

      // Specific list-type questions.
      if (q.includes("primary outcome") || (q.includes("outcome") && q.includes("primary"))) {
        const primary = Array.isArray(snap.primaryOutcomes) ? snap.primaryOutcomes : [];
        const list = primary.map((x: any) => String(x || "").trim()).filter(Boolean);
        reply(list.length ? `Primary outcomes: ${list.join(", ")}` : "Primary outcomes: —");
        return;
      }
      if (q.includes("subcomponent")) {
        const subs = Array.isArray(snap.subcomponents) ? snap.subcomponents : [];
        const list = subs.map((x: any) => String(x || "").trim()).filter(Boolean);
        reply(list.length ? `Subcomponents: ${list.join(", ")}` : "Subcomponents: —");
        return;
      }
      if (q.includes("practice")) {
        const kde: any = de.keyDesignElements || {};
        const practices = Array.isArray(kde.practices) ? kde.practices : [];
        const list = practices.map((p: any) => String(p?.label || "").trim()).filter(Boolean);
        reply(list.length ? `Practices: ${list.join(", ")}` : "Practices: —");
        return;
      }
      if (q.includes("support")) {
        const kde: any = de.keyDesignElements || {};
        const supports = Array.isArray(kde.supports) ? kde.supports : [];
        const list = supports.map((s: any) => String(s?.label || "").trim()).filter(Boolean);
        reply(list.length ? `Supports: ${list.join(", ")}` : "Supports: —");
        return;
      }
      if (q.includes("leap")) {
        const kde: any = de.keyDesignElements || {};
        const aims = Array.isArray(kde.aims) ? kde.aims : [];
        const list = aims
          .filter((a: any) => String(a?.type || "").trim().toLowerCase() === "leap")
          .map((a: any) => String(a?.label || "").trim())
          .filter(Boolean);
        reply(list.length ? `Leap aims: ${list.join(", ")}` : "Leap aims: —");
        return;
      }
      if (q.includes("targeted outcome")) {
        const osd: any = hd.outcomeScoreData || {};
        const tos = Array.isArray(osd.targetedOutcomes) ? osd.targetedOutcomes : [];
        const list = tos.map((o: any) => String(o?.outcomeName || "").trim()).filter(Boolean);
        reply(
          list.length
            ? `Targeted outcomes (${list.length}): ${list.slice(0, 12).join(", ")}${list.length > 12 ? "…" : ""}`
            : "Targeted outcomes: —",
        );
        return;
      }
      if (q.includes("outcome score")) {
        const osd: any = hd.outcomeScoreData || {};
        const v = typeof osd.finalOutcomeScore === "number" ? osd.finalOutcomeScore : null;
        reply(`Outcome score: ${v === null ? "—" : v}`);
        return;
      }
      if (q.includes("experience score")) {
        const esd: any = hd.experienceScoreData || {};
        const v = typeof esd.finalExperienceScore === "number" ? esd.finalExperienceScore : null;
        reply(`Experience score: ${v === null ? "—" : v}`);
        return;
      }

      if (wantsOverview && !wantsDE && !wantsHealth) {
        reply(`Overview\n${answer.overview}`);
        return;
      }
      if (wantsDE && !wantsOverview && !wantsHealth) {
        reply(`Designed Experience\n${answer.designedExperience}`);
        return;
      }
      if (wantsHealth && !wantsOverview && !wantsDE) {
        reply(`Status & Health\n${answer.statusAndHealth}`);
        return;
      }
      if (wantsOverview || wantsDE || wantsHealth) {
        // If mixed, ask a quick disambiguation to keep it short.
        reply("Which section should I focus on: Overview, Designed Experience, or Status & Health?");
        return;
      }
    }

    // Guided Designed Experience update flow (v1).
    if (updateFlowStep === "de_freeform") {
      const res: any = buildDesignedExperiencePatchFromText(text);
      if (res?.error) {
        pushAssistantText(res.error);
        return;
      }
      const patch = res?.patch as { nodeId: string; data: any } | undefined;
      const summary = String(res?.summary || "Proposed update.");
      if (!patch?.nodeId) {
        pushAssistantText("I couldn’t build a valid patch for this component.");
        return;
      }
      pushProposal(
        "Proposed change",
        `${summary}\n\nConfirm to apply this change.`,
        patch,
      );
      return;
    }

    // Basic UI-only scaffolding for the specific “add outcome at high priority” flow.
    const match = text.match(/add\s+(.+?)\s+outcome/i);
    const wantsHigh = /high\s+priority/i.test(text) || /\bpriority\s+H\b/i.test(text);
    if (match && match[1] && wantsHigh) {
      pushOutcomePriorityQuestion(match[1].trim(), "H");
      return;
    }

    pushAssistantText(
      "I can generate an executive summary (Snapshot / Designed Experience / Status & Health). Try “Give me an executive summary of this component”.",
    );
  };

  const handleQuestionOption = async (questionId: string, optionId: string) => {
    if (questionId === "choose_update_area") {
      if (optionId === "designed_experience") {
        setUpdateFlowStep("de_freeform");
        pushAssistantText(
          "Okay — tell me what you want to change in Designed Experience (key aims/practices/supports, or subcomponents).",
        );
        return;
      }
      setUpdateFlowStep("idle");
      pushAssistantText("Status & Health updates are next. For now, I can apply Designed Experience updates end-to-end.");
      return;
    }

    if (questionId === "outcome_priority_isPriority") {
      const pending = pendingOutcomeAdd;
      if (!pending) return;
      pushUser(optionId === "yes" ? "Yes, it’s a priority outcome." : "No, it’s not a priority outcome.");
      if (optionId === "no") {
        pushAssistantText(
          `Okay — I’ll proceed.\n\nProposed change (not yet applied): add outcome “${pending.label}” at high priority.`,
        );
      } else {
        pushAssistantText(
          `Got it.\n\nProposed change (not yet applied): add priority outcome “${pending.label}” at high priority.`,
        );
      }
      setPendingOutcomeAdd(null);
      return;
    }
  };

  const handleProposalAction = async (proposalId: string, action: "confirm" | "cancel", patch: { nodeId: string; data: any }) => {
    if (action === "cancel") {
      pushUser("Cancel");
      pushAssistantText("Canceled.");
      return;
    }
    if (!patch?.nodeId) {
      pushAssistantText("I couldn’t apply that change because the component is missing a nodeId.");
      return;
    }
    try {
      setApplyingProposalId(proposalId);
      pushUser("Confirm");
      await updateMutation.mutateAsync({ nodeId: patch.nodeId, data: patch.data });
      pushAssistantText("Applied.");
    } catch (e: any) {
      pushAssistantText(`Couldn’t apply that change. ${String(e?.message || e || "")}`.trim());
    } finally {
      setApplyingProposalId(null);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className={cn("border-b border-gray-100", embedded ? "px-4 py-3" : "px-6 py-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {!embedded && <div className="text-lg font-bold text-gray-900">Transcend AI Companion</div>}
            <div className={cn("text-xs text-gray-500", !embedded && "mt-1")}>
              Component in focus: <span className="font-semibold text-gray-700">{componentLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={resetChat}
              title="Clear chat"
              data-testid="ai-clear-chat"
            >
              <Trash2 className="w-4 h-4 text-gray-600" />
            </Button>
            {onExitChat && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onExitChat}
                title="Back to tools"
                data-testid="ai-exit-chat"
              >
                <X className="w-4 h-4 text-gray-600" />
              </Button>
            )}
            {!embedded && (
              <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center ml-1">
                <Bot className="w-4 h-4 text-gray-700" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-white">
        {messages.map((m) => {
          const isUser = m.role === "user";
          const bubbleClass = cn(
            "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
            isUser ? "ml-auto bg-blue-900 text-white" : "mr-auto bg-gray-50 text-gray-800 border border-gray-200",
          );

          if (m.kind === "question") {
            return (
              <div key={m.id} className="mr-auto">
                <div className={bubbleClass}>
                  <div>{m.prompt}</div>
                  <div className="mt-3 flex items-center gap-2">
                    {m.options.map((o) => (
                      <Button
                        key={o.id}
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => handleQuestionOption(m.questionId, o.id)}
                        data-testid={`ai-q-${m.questionId}-${o.id}`}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          if (m.kind === "proposal") {
            const isApplying = applyingProposalId === m.proposalId;
            return (
              <div key={m.id} className="mr-auto">
                <div className={cn(bubbleClass, "bg-white")}>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{m.title}</div>
                  <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{m.body}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-blue-900 hover:bg-blue-800"
                      disabled={isApplying}
                      onClick={() => handleProposalAction(m.proposalId, "confirm", m.patch)}
                      data-testid={`ai-proposal-confirm-${m.proposalId}`}
                    >
                      {isApplying ? "Applying…" : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={isApplying}
                      onClick={() => handleProposalAction(m.proposalId, "cancel", m.patch)}
                      data-testid={`ai-proposal-cancel-${m.proposalId}`}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
              <div className={bubbleClass}>{m.content}</div>
            </div>
          );
        })}

        {hasOnlyIntro && (
          <div className="pt-2">
            <div className="text-xs font-semibold text-gray-500 mb-3">Conversation starters</div>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStarter(s.id)}
                  className="px-3 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs text-gray-700 shadow-sm"
                  data-testid={`ai-starter-${s.id}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-100 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            placeholder="Ask anything"
            className={cn(
              "flex-1 min-h-[44px] max-h-[140px] resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-testid="ai-input"
          />
          <Button
            className="bg-blue-900 hover:bg-blue-800 h-11 px-4 rounded-xl"
            onClick={handleSend}
            data-testid="ai-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-[11px] text-gray-400 mt-2">Press Enter to send • Shift+Enter for a new line</div>
      </div>
    </div>
  );
}

