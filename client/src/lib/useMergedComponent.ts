import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { componentQueries } from "@/lib/api";

/**
 * Resolves a component for `nodeId` from GET /api/components (list) and GET /api/components/:nodeId.
 * If the detail query fails (e.g. race) but the row exists in the list, use the list row so PATCH payloads can merge.
 */
export function useMergedComponent(nodeId: string | undefined) {
  const { data: allList } = useQuery(componentQueries.all);
  const fromList = useMemo(
    () =>
      nodeId && Array.isArray(allList)
        ? allList.find((c: any) => String(c?.nodeId) === String(nodeId))
        : undefined,
    [allList, nodeId],
  );
  const { data: byId } = useQuery({
    ...componentQueries.byNodeId(nodeId || ""),
    enabled: !!nodeId,
  });
  return byId ?? fromList ?? null;
}
