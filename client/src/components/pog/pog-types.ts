"use client";

export type POGPriority = "H" | "M" | "L";

export type PortraitAttribute = {
  id: string;
  name: string;
  description: string;
  icon: string; // lightweight (emoji or short text)
};

export type PortraitAttributeLink = {
  outcomeLabel: string;
  priority: POGPriority; // emphasis within this attribute (not propagated)
};

export type PortraitOfGraduate = {
  attributes: PortraitAttribute[];
  linksByAttributeId: Record<string, PortraitAttributeLink[]>;
};

