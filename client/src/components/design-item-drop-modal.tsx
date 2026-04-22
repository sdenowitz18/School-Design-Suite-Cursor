import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Drag payload ─────────────────────────────────────────────────────────────

export type DesignItemDragPayload =
  | {
      kind: "outcome";
      label: string;
      /** "l2::l3" or just "l2" */
      key: string;
    }
  | {
      kind: "leap";
      label: string;
    }
  | {
      kind: "designElement";
      label: string;
      elementId: string;
      /** "questionId__bucketId" */
      bucketKey: string;
      tagId: string;
      archetype: "A1" | "A2";
    };

export const DESIGN_ITEM_DRAG_TYPE = "application/x-design-item";

export function encodeDesignItemPayload(payload: DesignItemDragPayload): string {
  return JSON.stringify(payload);
}

export function decodeDesignItemPayload(raw: string): DesignItemDragPayload | null {
  try {
    return JSON.parse(raw) as DesignItemDragPayload;
  } catch {
    return null;
  }
}

// ─── Subcomponent shape (minimal, matching DESubcomponent) ────────────────────

export interface SubcomponentOption {
  id: string;
  name: string;
  kind: "learner" | "adult";
}

// ─── Confirm options (branched by payload type) ───────────────────────────────

export type DropConfirmOpts =
  | { priority: "Low" | "Medium" | "High" }   // for outcome / leap
  | { markAsKey: boolean };                    // for designElement

// ─── Modal ────────────────────────────────────────────────────────────────────

interface DesignItemDropModalProps {
  payload: DesignItemDragPayload;
  targetName: string;
  subcomponents: SubcomponentOption[];
  onConfirm: (targetSubId: string | null, opts: DropConfirmOpts) => void;
  onCancel: () => void;
}

const PRIORITY_OPTIONS: Array<{ value: "Low" | "Medium" | "High"; label: string; color: string }> = [
  { value: "High",   label: "High",   color: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" },
  { value: "Medium", label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200" },
  { value: "Low",    label: "Low",    color: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200" },
];

export function DesignItemDropModal({
  payload,
  targetName,
  subcomponents,
  onConfirm,
  onCancel,
}: DesignItemDropModalProps) {
  const [targetSubId, setTargetSubId] = useState<string>("__component__");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [markAsKey, setMarkAsKey] = useState(false);

  const hasSubcomponents = subcomponents.length > 0;
  const isTagType = payload.kind === "designElement";

  const kindLabel =
    payload.kind === "outcome"
      ? "outcome"
      : payload.kind === "leap"
        ? "LEAP"
        : "design element tag";

  const handleConfirm = () => {
    const subId = targetSubId === "__component__" ? null : targetSubId;
    if (isTagType) {
      onConfirm(subId, { markAsKey });
    } else {
      onConfirm(subId, { priority });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add to component</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-gray-700">
            You're about to add the {kindLabel}{" "}
            <span className="font-semibold">"{payload.label}"</span> to{" "}
            <span className="font-semibold">{targetName}</span>.
          </p>

          {hasSubcomponents && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Add to</label>
              <Select value={targetSubId} onValueChange={setTargetSubId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__component__" className="text-xs">
                    {targetName} (component)
                  </SelectItem>
                  {subcomponents.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                      <span className="ml-1.5 text-gray-400">
                        ({s.kind === "learner" ? "learner exp." : "adult exp."})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isTagType ? (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-blue-600 h-3.5 w-3.5"
                checked={markAsKey}
                onChange={(e) => setMarkAsKey(e.target.checked)}
              />
              <span className="text-xs text-gray-700">Mark as key (★)</span>
            </label>
          ) : (
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-600">Priority</span>
              <div className="flex gap-1.5">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={cn(
                      "flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors",
                      opt.color,
                      priority === opt.value
                        ? "ring-2 ring-offset-1 ring-blue-400"
                        : "opacity-70",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
