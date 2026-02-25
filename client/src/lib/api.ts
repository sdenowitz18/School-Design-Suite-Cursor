import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const componentQueries = {
  all: queryOptions({
    queryKey: ["components"],
    queryFn: () => fetchJson("/api/components"),
  }),
  byNodeId: (nodeId: string) =>
    queryOptions({
      queryKey: ["components", nodeId],
      queryFn: () => fetchJson(`/api/components/${nodeId}`),
      enabled: !!nodeId,
    }),
};

export function useUpdateComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ nodeId, data }: { nodeId: string; data: any }) => {
      return fetchJson(`/api/components/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data, variables) => {
      // Update cache immediately to prevent stale overwrites between competing autosaves.
      queryClient.setQueryData(["components", variables.nodeId], data);
      queryClient.setQueryData(["components"], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        const idx = prev.findIndex((c: any) => String(c?.nodeId) === String(variables.nodeId));
        if (idx < 0) return prev;
        const next = prev.slice();
        next[idx] = data;
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["components", variables.nodeId] });
    },
  });
}

export function useSeedComponents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return fetchJson("/api/seed", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
    },
  });
}
