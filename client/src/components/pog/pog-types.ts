"use client";

export type POGPriority = "H" | "M" | "L";

export type PortraitAttribute = {
  id: string;
  name: string;
  description: string;
  icon: string; // lightweight (emoji or short text)
  score1to5?: 1 | 2 | 3 | 4 | 5 | null;
  builtPercent?: 0 | 25 | 50 | 75 | 100 | null;
};

export type PortraitAttributeLink = {
  outcomeLabel: string;
  priority: POGPriority; // emphasis within this attribute (not propagated)
};

export type PortraitOfGraduate = {
  attributes: PortraitAttribute[];
  linksByAttributeId: Record<string, PortraitAttributeLink[]>;
};

