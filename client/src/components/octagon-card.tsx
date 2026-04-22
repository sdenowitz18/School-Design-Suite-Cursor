"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { scoreBgCls } from "@/lib/score-threshold-colors";

type OctagonStat = { label: string; value: string; className?: string; score?: number | null };

function statPillClassName(stat: OctagonStat, centerVariant: "text" | "pill" | "dataPreview", side: "left" | "right") {
  if (stat.className) return stat.className;
  if (stat.score !== undefined) return scoreBgCls(stat.score);
  if (centerVariant === "dataPreview") return scoreBgCls(null);
  return side === "left"
    ? "bg-yellow-300 text-yellow-900 border-yellow-400/30"
    : "bg-red-300 text-red-900 border-red-400/30";
}

export default function OctagonCard({
  title,
  subtitle,
  description,
  bgClassName,
  centerVariant = "text",
  centerText,
  dataPreviewContent,
  onOpenDataPreviewFullView,
  leftStat,
  rightStat,
  onLeftStatClick,
  onRightStatClick,
  footerLabel,
  footerValue,
  onClick,
  className,
  testId,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  bgClassName?: string;
  centerVariant?: "text" | "pill" | "dataPreview";
  centerText?: string;
  /** Rendered when centerVariant === "dataPreview". */
  dataPreviewContent?: React.ReactNode;
  /** Called when the user clicks the ring border around the data preview window. */
  onOpenDataPreviewFullView?: () => void;
  leftStat?: OctagonStat;
  rightStat?: OctagonStat;
  /** When provided, the left stat box becomes a clickable button. */
  onLeftStatClick?: () => void;
  /** When provided, the right stat box becomes a clickable button. */
  onRightStatClick?: () => void;
  footerLabel?: string;
  footerValue?: string;
  onClick?: () => void;
  className?: string;
  testId?: string;
}) {
  const showStats = !!leftStat && !!rightStat;
  /** Data preview embeds real `<button>`s (nav, drill). A native `<button>` root is invalid HTML and breaks dblclick — use `<div>`. */
  const useDivRoot = centerVariant === "dataPreview";

  const shellClassName = cn(
    "relative w-[220px] h-[220px] transition-transform hover:scale-[1.03] active:scale-[1.01]",
    !useDivRoot && "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
    useDivRoot && onClick && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20",
    className,
  );

  const inner = (
    <>
      <div
        className={cn(
          "w-full h-full flex flex-col items-center shadow-md transition-colors",
          centerVariant === "dataPreview"
            ? "justify-start px-4 pt-2 pb-2 gap-1"
            : "justify-between p-6",
          bgClassName || "bg-white",
        )}
        style={{
          clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
          border: "1px solid rgba(0,0,0,0.2)",
        }}
      >
        {/* ── Title area ── */}
        <div className={cn(
          "text-center w-full",
          centerVariant === "dataPreview" ? "space-y-0 mt-0" : "space-y-1 mt-2",
        )}>
          <div className={cn(
            "flex gap-1 justify-center",
            centerVariant === "dataPreview" ? "mb-0.5" : "mb-1",
          )} aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-gray-400/50" />
            ))}
          </div>
          <div className={cn(
            "font-bold text-gray-900 leading-tight line-clamp-2",
            centerVariant === "dataPreview" ? "text-xs px-1" : "text-sm px-2",
          )}>{title}</div>
          {subtitle && centerVariant !== "dataPreview" ? (
            <div className="text-[10px] text-gray-500 uppercase tracking-wider line-clamp-1">{subtitle}</div>
          ) : null}
        </div>

        {/* ── Center area ── */}
        {centerVariant === "dataPreview" ? (
          <div
            data-preview-ring
            onClick={(e) => {
              // Fire if clicked directly on the ring border padding (not on inner interactive content)
              if ((e.target as HTMLElement).closest("[data-preview-interactive]")) return;
              e.stopPropagation();
              onOpenDataPreviewFullView?.();
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("[data-preview-interactive]")) return;
              e.stopPropagation();
            }}
            className={cn(
              "flex-1 w-full overflow-hidden rounded-md bg-white/80 shadow-inner min-h-0",
              "border-[3px] transition-all",
              onOpenDataPreviewFullView
                ? "border-gray-400/50 hover:border-blue-500/70 hover:shadow-md cursor-default"
                : "border-gray-400/50",
              "pointer-events-auto",
            )}
          >
            {dataPreviewContent}
          </div>
        ) : (
          <div className="flex-1 w-full flex items-center justify-center">
            {centerVariant === "pill" ? (
              <div className="w-[80%] h-[40px] rounded-[50%] bg-blue-900/10 flex items-center justify-center px-3">
                <span className="text-[9px] text-gray-500 text-center line-clamp-2">
                  {centerText || description || "—"}
                </span>
              </div>
            ) : description ? (
              <div className="w-[86%] text-[10px] text-gray-600 leading-relaxed line-clamp-4 text-center">
                {description}
              </div>
            ) : (
              <div className="w-[80%] h-[40px] rounded-[50%] bg-blue-900/10 flex items-center justify-center">
                <span className="text-[9px] text-gray-400">No description</span>
              </div>
            )}
          </div>
        )}

        {/* ── Bottom stats ── */}
        <div className={cn(
          "flex w-full justify-between items-end gap-1",
          centerVariant === "dataPreview" ? "mt-0" : "mb-2",
        )}>
          {showStats ? (
            <>
              <div
                data-octagon-stat={onLeftStatClick ? "" : undefined}
                className={cn(
                  "flex flex-col items-center flex-1 min-w-0",
                  onLeftStatClick && "cursor-pointer group/lstat pointer-events-auto",
                )}
                onClick={onLeftStatClick ? (e) => { e.stopPropagation(); onLeftStatClick(); } : undefined}
                role={onLeftStatClick ? "button" : undefined}
                tabIndex={onLeftStatClick ? 0 : undefined}
                onKeyDown={onLeftStatClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onLeftStatClick(); } } : undefined}
              >
                <span className={cn(
                  "font-medium mb-0.5 truncate w-full text-center",
                  centerVariant === "dataPreview" ? "text-[7px] text-blue-600" : "text-[9px] text-blue-600",
                  onLeftStatClick && "group-hover/lstat:text-blue-700",
                )}>{leftStat.label}</span>
                <div
                  className={cn(
                    "font-bold rounded w-full text-center shadow-sm border",
                    centerVariant === "dataPreview" ? "text-[10px] px-1 py-px" : "text-sm px-2 py-0.5",
                    statPillClassName(leftStat, centerVariant, "left"),
                    onLeftStatClick && "hover:opacity-80 transition-opacity",
                  )}
                >
                  {leftStat.value}
                </div>
              </div>
              <div
                data-octagon-stat={onRightStatClick ? "" : undefined}
                className={cn(
                  "flex flex-col items-center flex-1 min-w-0",
                  onRightStatClick && "cursor-pointer group/rstat pointer-events-auto",
                )}
                onClick={onRightStatClick ? (e) => { e.stopPropagation(); onRightStatClick(); } : undefined}
                role={onRightStatClick ? "button" : undefined}
                tabIndex={onRightStatClick ? 0 : undefined}
                onKeyDown={onRightStatClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onRightStatClick(); } } : undefined}
              >
                <span className={cn(
                  "font-medium mb-0.5 truncate w-full text-center",
                  centerVariant === "dataPreview" ? "text-[7px] text-blue-600" : "text-[9px] text-blue-600",
                  onRightStatClick && "group-hover/rstat:text-blue-700",
                )}>{rightStat.label}</span>
                <div
                  className={cn(
                    "font-bold rounded w-full text-center shadow-sm border",
                    centerVariant === "dataPreview" ? "text-[10px] px-1 py-px" : "text-sm px-2 py-0.5",
                    statPillClassName(rightStat, centerVariant, "right"),
                    onRightStatClick && "hover:opacity-80 transition-opacity",
                  )}
                >
                  {rightStat.value}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center flex-1">
              <span className="text-[9px] text-blue-600 font-medium mb-0.5">{footerLabel || "Alignment"}</span>
              <div className="bg-gray-900/10 text-gray-900 font-bold px-2 py-0.5 rounded text-sm w-full text-center shadow-sm border border-gray-900/10">
                {footerValue || "—"}
              </div>
            </div>
          )}
        </div>

        {centerVariant !== "dataPreview" && (
          <div className="text-[9px] text-gray-500 font-medium -mt-1">{subtitle || ""}</div>
        )}
      </div>

      <div
        className="absolute inset-0 pointer-events-none border-2 border-gray-800/20"
        style={{
          clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
        }}
      />
    </>
  );

  if (useDivRoot) {
    return (
      <div
        className={shellClassName}
        data-testid={testId}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        {inner}
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className={shellClassName} data-testid={testId}>
      {inner}
    </button>
  );
}

