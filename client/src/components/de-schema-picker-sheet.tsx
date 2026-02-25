import React, { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type DESchemaPickerType = "outcome" | "leap" | "practice" | "support" | "artifact";
export type DETagLevel = "High" | "Medium" | "Low" | "Absent";

export function SchemaPickerSheet({
  title,
  description,
  schema,
  selectedLabels,
  onToggle,
  getLevel,
  onSetLevel,
  getIsKey,
  onSetIsKey,
  type,
  triggerLabel,
  triggerIcon: TriggerIcon,
  children,
}: {
  title: string;
  description: string;
  schema: Record<string, Record<string, string[]>> | Record<string, string[]>;
  selectedLabels: string[];
  onToggle: (label: string) => void;
  getLevel?: (label: string) => DETagLevel | undefined;
  onSetLevel?: (label: string, level: DETagLevel) => void;
  getIsKey?: (label: string) => boolean;
  onSetIsKey?: (label: string, isKey: boolean) => void;
  type: DESchemaPickerType;
  triggerLabel: string;
  triggerIcon?: any;
  children?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const searchLower = search.toLowerCase();

  const isNested = Object.values(schema).some((v) => typeof v === "object" && !Array.isArray(v));

  const colorMap: Record<string, { selected: string; icon: string }> = {
    outcome: { selected: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: "text-emerald-600" },
    leap: { selected: "bg-purple-50 border-purple-200 text-purple-800", icon: "text-purple-600" },
    practice: { selected: "bg-orange-50 border-orange-200 text-orange-800", icon: "text-orange-600" },
    support: { selected: "bg-sky-50 border-sky-200 text-sky-800", icon: "text-sky-600" },
    artifact: { selected: "bg-gray-50 border-gray-200 text-gray-800", icon: "text-gray-600" },
  };
  const colors = colorMap[type];

  const isPriorityEnabled = (type === "outcome" || type === "leap") && !!onSetLevel;
  const isKeyEnabled = (type === "practice" || type === "support") && !!onSetIsKey;

  const levelToHml = (level: DETagLevel | undefined): "H" | "M" | "L" => {
    if (level === "High") return "H";
    if (level === "Low") return "L";
    return "M";
  };
  const hmlToLevel = (hml: "H" | "M" | "L"): DETagLevel => (hml === "H" ? "High" : hml === "L" ? "Low" : "Medium");

  const PriorityMini = ({ label, selected }: { label: string; selected: boolean }) => {
    if (!isPriorityEnabled) return null;
    if (!selected) return null;
    const current = levelToHml(getLevel?.(label));
    return (
      <div className="inline-flex rounded-md border border-gray-200 overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
        {(["H", "M", "L"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-bold transition-colors",
              k !== "H" && "border-l border-gray-100",
              current === k ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-800",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSetLevel?.(label, hmlToLevel(k));
            }}
            data-testid={`${type}-priority-${label}-${k}`}
          >
            {k}
          </button>
        ))}
      </div>
    );
  };

  const KeyMini = ({ label, selected }: { label: string; selected: boolean }) => {
    if (!isKeyEnabled) return null;
    if (!selected) return null;
    const current = !!getIsKey?.(label);
    return (
      <button
        type="button"
        className={cn(
          "px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors",
          current ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:text-gray-800",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSetIsKey?.(label, !current);
        }}
        data-testid={`${type}-key-${label}`}
      >
        Key
      </button>
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <button
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium border border-dashed rounded-full px-2 py-0.5 transition-colors",
              type === "outcome"
                ? "text-emerald-500 border-emerald-300 hover:text-emerald-700 hover:border-emerald-400"
                : type === "leap"
                  ? "text-purple-500 border-purple-300 hover:text-purple-700 hover:border-purple-400"
                  : type === "practice"
                    ? "text-orange-500 border-orange-300 hover:text-orange-700 hover:border-orange-400"
                    : "text-sky-500 border-sky-300 hover:text-sky-700 hover:border-sky-400",
            )}
            data-testid={`button-add-${type}`}
            type="button"
          >
            {TriggerIcon && <TriggerIcon className="w-3 h-3" />}
            <Plus className="w-3 h-3" />
            {triggerLabel}
          </button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto bg-white">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              data-testid={`input-search-${type}`}
            />
          </div>
          {isNested ? (
            Object.entries(schema as Record<string, Record<string, string[]>>).map(([category, subcategories]) => {
              const hasMatch =
                !search || Object.values(subcategories).some((items) => items.some((item) => item.toLowerCase().includes(searchLower)));
              if (!hasMatch) return null;
              return (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-900 border-b pb-1">{category}</h4>
                  <div className="space-y-3 pl-1">
                    {Object.entries(subcategories).map(([subcategory, items]) => {
                      const filtered = search ? items.filter((i) => i.toLowerCase().includes(searchLower)) : items;
                      if (filtered.length === 0) return null;
                      return (
                        <div key={subcategory} className="space-y-1">
                          <h5 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{subcategory}</h5>
                          {filtered.map((item) => {
                            const isSelected = selectedLabels.includes(item);
                            return (
                              <div
                                key={item}
                                className={cn(
                                  "flex items-center justify-between gap-2 p-1.5 rounded cursor-pointer border transition-colors text-xs min-w-0",
                                  isSelected ? `${colors.selected}` : "hover:bg-gray-50 border-transparent hover:border-gray-100 text-gray-700",
                                )}
                                onClick={() => onToggle(item)}
                                data-testid={`${type}-option-${item}`}
                              >
                                <span className="truncate min-w-0">{item}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isSelected && <PriorityMini label={item} selected={isSelected} />}
                                  {isSelected && <KeyMini label={item} selected={isSelected} />}
                                  {isSelected ? (
                                    <Check className={cn("w-3.5 h-3.5", colors.icon)} />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 text-gray-300" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            Object.entries(schema as Record<string, string[]>).map(([category, items]) => {
              const filtered = search ? items.filter((i) => i.toLowerCase().includes(searchLower)) : items;
              if (filtered.length === 0) return null;
              return (
                <div key={category} className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-900 border-b pb-1">{category}</h4>
                  {filtered.map((item) => {
                    const isSelected = selectedLabels.includes(item);
                    return (
                      <div
                        key={item}
                        className={cn(
                          "flex items-center justify-between gap-2 p-1.5 rounded cursor-pointer border transition-colors text-xs min-w-0",
                          isSelected ? `${colors.selected}` : "hover:bg-gray-50 border-transparent hover:border-gray-100 text-gray-700",
                        )}
                        onClick={() => onToggle(item)}
                        data-testid={`${type}-option-${item}`}
                      >
                        <span className="truncate min-w-0">{item}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && <PriorityMini label={item} selected={isSelected} />}
                          {isSelected && <KeyMini label={item} selected={isSelected} />}
                          {isSelected ? (
                            <Check className={cn("w-3.5 h-3.5", colors.icon)} />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-gray-300" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

