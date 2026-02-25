"use client";

import { cn } from "@/lib/utils";

export default function OctagonCard({
  title,
  subtitle,
  description,
  bgClassName,
  centerVariant = "text",
  centerText,
  leftStat,
  rightStat,
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
  centerVariant?: "text" | "pill";
  centerText?: string;
  leftStat?: { label: string; value: string; className?: string };
  rightStat?: { label: string; value: string; className?: string };
  footerLabel?: string;
  footerValue?: string;
  onClick?: () => void;
  className?: string;
  testId?: string;
}) {
  const showStats = !!leftStat && !!rightStat;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-[220px] h-[220px] transition-transform hover:scale-[1.03] active:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-blue-500/20",
        className,
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "w-full h-full flex flex-col items-center justify-between p-6 shadow-md transition-colors",
          bgClassName || "bg-white",
        )}
        style={{
          clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
          border: "1px solid rgba(0,0,0,0.2)",
        }}
      >
        <div className="text-center space-y-1 mt-2">
          <div className="flex gap-1 justify-center mb-1" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-gray-400/50" />
            ))}
          </div>
          <div className="font-bold text-gray-900 text-sm leading-tight px-2 line-clamp-2">{title}</div>
          {subtitle ? (
            <div className="text-[10px] text-gray-500 uppercase tracking-wider line-clamp-1">{subtitle}</div>
          ) : null}
        </div>

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

        <div className="flex w-full justify-between items-end gap-2 mb-2">
          {showStats ? (
            <>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[9px] text-blue-600 font-medium mb-0.5">{leftStat.label}</span>
                <div
                  className={cn(
                    "font-bold px-2 py-0.5 rounded text-sm w-full text-center shadow-sm border",
                    leftStat.className || "bg-yellow-300 text-yellow-900 border-yellow-400/30",
                  )}
                >
                  {leftStat.value}
                </div>
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[9px] text-blue-600 font-medium mb-0.5">{rightStat.label}</span>
                <div
                  className={cn(
                    "font-bold px-2 py-0.5 rounded text-sm w-full text-center shadow-sm border",
                    rightStat.className || "bg-red-300 text-red-900 border-red-400/30",
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

        <div className="text-[9px] text-gray-500 font-medium -mt-1">{subtitle || ""}</div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none border-2 border-gray-800/20"
        style={{
          clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
        }}
      />
    </button>
  );
}

