"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ModuleLibraryAudience = "learner" | "adult";

export type LearnerModuleLibraryContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openLibrary: () => void;
  closeLibrary: () => void;
  /** Open if closed, close if open (for the main Module library control). */
  toggleLibrary: () => void;
  /** Strip mode: learner catalog tabs vs adult role dropdown (drives drag target hints and overall panel drops). */
  moduleLibraryAudience: ModuleLibraryAudience;
  setModuleLibraryAudience: (v: ModuleLibraryAudience) => void;
  selectedCatalogKeys: Set<string>;
  setSelectedCatalogKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleCatalogKey: (key: string) => void;
  clearCatalogSelection: () => void;
};

const LearnerModuleLibraryContext = createContext<LearnerModuleLibraryContextValue | null>(null);

export function LearnerModuleLibraryProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [moduleLibraryAudience, setModuleLibraryAudience] = useState<ModuleLibraryAudience>("learner");
  const [selectedCatalogKeys, setSelectedCatalogKeys] = useState<Set<string>>(() => new Set());

  const toggleCatalogKey = useCallback((key: string) => {
    setSelectedCatalogKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }, []);

  const clearCatalogSelection = useCallback(() => setSelectedCatalogKeys(new Set()), []);

  const toggleLibrary = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const value = useMemo<LearnerModuleLibraryContextValue>(
    () => ({
      open,
      setOpen,
      openLibrary: () => setOpen(true),
      closeLibrary: () => setOpen(false),
      toggleLibrary,
      moduleLibraryAudience,
      setModuleLibraryAudience,
      selectedCatalogKeys,
      setSelectedCatalogKeys,
      toggleCatalogKey,
      clearCatalogSelection,
    }),
    [open, moduleLibraryAudience, selectedCatalogKeys, toggleLibrary, toggleCatalogKey, clearCatalogSelection],
  );

  return <LearnerModuleLibraryContext.Provider value={value}>{children}</LearnerModuleLibraryContext.Provider>;
}

export function useLearnerModuleLibrary(): LearnerModuleLibraryContextValue {
  const v = useContext(LearnerModuleLibraryContext);
  if (!v) {
    throw new Error("useLearnerModuleLibrary must be used within LearnerModuleLibraryProvider");
  }
  return v;
}

/** Safe when the provider is not mounted (e.g. isolated tests). */
export function useLearnerModuleLibraryOptional(): LearnerModuleLibraryContextValue | null {
  return useContext(LearnerModuleLibraryContext);
}
