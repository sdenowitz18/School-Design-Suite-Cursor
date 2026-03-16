import React, { useState, useEffect } from "react";
import { Target, Sparkles, RotateCw, Wrench, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { DESubcomponent, Tag, TagType } from "./designed-experience-view";

interface SubcomponentSnapshotViewProps {
  sub: DESubcomponent;
  parentTitle: string;
  onUpdate: (updated: DESubcomponent) => void;
}

const tagStyles: Record<TagType, { bg: string; icon: any; iconColor: string }> = {
  outcome: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Target, iconColor: "text-emerald-600" },
  leap: { bg: "bg-purple-50 text-purple-700 border-purple-200", icon: Sparkles, iconColor: "text-purple-600" },
  practice: { bg: "bg-orange-50 text-orange-700 border-orange-200", icon: RotateCw, iconColor: "text-orange-600" },
  support: { bg: "bg-sky-50 text-sky-700 border-sky-200", icon: Wrench, iconColor: "text-sky-600" },
  artifact: { bg: "bg-gray-50 text-gray-600 border-gray-200", icon: Target, iconColor: "text-gray-600" },
};

export default function SubcomponentSnapshotView({ sub, parentTitle, onUpdate }: SubcomponentSnapshotViewProps) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState(sub.description);

  useEffect(() => {
    setDescVal(sub.description);
  }, [sub.description]);

  const saveDesc = () => {
    onUpdate({ ...sub, description: descVal });
    setEditingDesc(false);
  };

  const outcomes = sub.aims.filter(a => a.type === "outcome");
  const leaps = sub.aims.filter(a => a.type === "leap");

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10 space-y-8 pb-24 pt-6">

        <section className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">Subcomponent</Badge>
              <span className="text-xs text-gray-400">of {parentTitle}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-2">Description</h3>
            {editingDesc ? (
              <div className="space-y-2">
                <Textarea
                  value={descVal}
                  onChange={(e) => setDescVal(e.target.value)}
                  className="text-sm min-h-[80px] resize-none"
                  placeholder="Describe this subcomponent..."
                  autoFocus
                  data-testid="input-sub-snapshot-desc"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDescVal(sub.description); setEditingDesc(false); }}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={saveDesc}>Save</Button>
                </div>
              </div>
            ) : (
              <div
                className="group cursor-pointer hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                onClick={() => setEditingDesc(true)}
              >
                <p className="text-sm text-gray-700 leading-relaxed" data-testid="text-sub-snapshot-desc">
                  {sub.description || <span className="italic text-gray-400">Click to add a description...</span>}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <h3 className="text-sm font-semibold tracking-tight text-gray-900 uppercase">Summary</h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-emerald-700">{sub.aims.length}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">Aims</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-orange-700">{sub.practices.length}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">Practices</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-sky-700">{sub.supports.length}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">Supports</div>
            </div>
          </div>
        </section>

        {outcomes.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <h3 className="text-xs font-semibold uppercase text-gray-500">Outcome Aims</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {outcomes.map(tag => (
                <Badge key={tag.id} variant="outline" className={cn("text-[11px] gap-1 px-2 py-0.5", tagStyles.outcome.bg)}>
                  <Target className="w-2.5 h-2.5 opacity-70" />
                  {tag.label}
                  <span className="text-[9px] font-bold ml-0.5">
                    (From: {String(tag.source || parentTitle || "Component")})
                  </span>
                </Badge>
              ))}
            </div>
          </section>
        )}

        {leaps.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <h3 className="text-xs font-semibold uppercase text-gray-500">Leap Aims</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {leaps.map(tag => (
                <Badge key={tag.id} variant="outline" className={cn("text-[11px] gap-1 px-2 py-0.5", tagStyles.leap.bg)}>
                  <Sparkles className="w-2.5 h-2.5 opacity-70" />
                  {tag.label}
                  <span className="text-[9px] font-bold ml-0.5">
                    (From: {String(tag.source || parentTitle || "Component")})
                  </span>
                </Badge>
              ))}
            </div>
          </section>
        )}

        {sub.practices.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <RotateCw className="w-3.5 h-3.5 text-orange-600" />
              <h3 className="text-xs font-semibold uppercase text-gray-500">Practices</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {sub.practices.map(tag => (
                <Badge key={tag.id} variant="outline" className={cn("text-[11px] gap-1 px-2 py-0.5", tagStyles.practice.bg)}>
                  <RotateCw className="w-2.5 h-2.5 opacity-70" />
                  {tag.label}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {sub.supports.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-sky-600" />
              <h3 className="text-xs font-semibold uppercase text-gray-500">Supports</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {sub.supports.map(tag => (
                <Badge key={tag.id} variant="outline" className={cn("text-[11px] gap-1 px-2 py-0.5", tagStyles.support.bg)}>
                  <Wrench className="w-2.5 h-2.5 opacity-70" />
                  {tag.label}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {sub.aims.length === 0 && sub.practices.length === 0 && sub.supports.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No aims, practices, or supports defined yet.</p>
            <p className="text-xs mt-1">Switch to the Designed Experience tab to add them.</p>
          </div>
        )}
      </div>
    </div>
  );
}
