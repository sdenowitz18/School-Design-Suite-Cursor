"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UNKNOWN_ACTOR_KEY, normActor } from "@shared/score-instances";

const ACTORS_LS_KEY = "sds_actor_options_v1";

function safeParse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function uniqueActors(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of Array.isArray(list) ? list : []) {
    const clean = String(a ?? "").trim();
    if (!clean) continue;
    const key = normActor(clean);
    if (!key || key === UNKNOWN_ACTOR_KEY) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useGlobalActors(): {
  actors: string[];
  addActor: (label: string) => void;
  mergeActors: (extra: string[]) => void;
} {
  const [actors, setActors] = useState<string[]>([]);

  useEffect(() => {
    setActors(uniqueActors(safeParse(localStorage.getItem(ACTORS_LS_KEY))));
  }, []);

  const persist = useCallback((next: string[]) => {
    const clean = uniqueActors(next);
    setActors((prev) => {
      if (arraysEqual(prev, clean)) return prev;
      try {
        localStorage.setItem(ACTORS_LS_KEY, JSON.stringify(clean));
      } catch {}
      return clean;
    });
  }, []);

  const addActor = useCallback(
    (label: string) => {
      const clean = String(label ?? "").trim();
      if (!clean) return;
      persist([...actors, clean]);
    },
    [actors, persist],
  );

  const mergeActors = useCallback(
    (extra: string[]) => {
      persist([...actors, ...(Array.isArray(extra) ? extra : [])]);
    },
    [actors, persist],
  );

  return useMemo(() => ({ actors, addActor, mergeActors }), [actors, addActor, mergeActors]);
}

