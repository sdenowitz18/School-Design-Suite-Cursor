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
    onSuccess: (_data, variables) => {
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
