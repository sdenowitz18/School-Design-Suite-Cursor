"use client";

import React from "react";
import { Target, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function PogOutcomePill({
  label,
  meta,
  isPrimary,
  onClick,
  onRemove,
  className,
}: {
  label: string;
  meta?: string;
  isPrimary?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  const clean = String(label || "").trim();
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium gap-1 px-2 py-0.5 transition-all cursor-default text-[11px] max-w-full min-w-0 overflow-hidden",
        "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
        onClick && "cursor-pointer",
        isPrimary && "font-bold border-2",
        className,
      )}
      onClick={onClick}
      title={clean}
    >
      {isPrimary ? (
        <Star className="w-2.5 h-2.5 fill-current text-current opacity-100" />
      ) : (
        <Target className="w-2.5 h-2.5 opacity-70" />
      )}
      <span className="truncate min-w-0">{clean}</span>
      {meta && <span className="text-[10px] font-bold opacity-70 shrink-0">({meta})</span>}
      {onRemove && (
        <button
          className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </Badge>
  );
}

