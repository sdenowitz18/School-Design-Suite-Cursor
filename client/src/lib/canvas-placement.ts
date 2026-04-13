/** Canvas center used when placing new ring components around the school (overall) node. */
const DEFAULT_CX = 600;
const DEFAULT_CY = 300;

/**
 * Compute canvas positions for new components in a ring around the center, avoiding exact overlap.
 * Indices are 0-based among *all* non-overall components after existing count.
 */
export function computeRingPositions(
  existingCount: number,
  newCount: number,
  opts?: { cx?: number; cy?: number; baseRadius?: number; stepRadius?: number; perRing?: number },
): { canvasX: number; canvasY: number }[] {
  const cx = opts?.cx ?? DEFAULT_CX;
  const cy = opts?.cy ?? DEFAULT_CY;
  const baseR = opts?.baseRadius ?? 280;
  const stepR = opts?.stepRadius ?? 100;
  const perRing = opts?.perRing ?? 8;
  const out: { canvasX: number; canvasY: number }[] = [];
  for (let i = 0; i < newCount; i++) {
    const idx = existingCount + i;
    const ring = Math.floor(idx / perRing);
    const posInRing = idx % perRing;
    const r = baseR + ring * stepR;
    const angle = (posInRing / perRing) * 2 * Math.PI - Math.PI / 2;
    const x = Math.round(cx + r * Math.cos(angle));
    const y = Math.round(cy + r * Math.sin(angle));
    out.push({ canvasX: x, canvasY: y });
  }
  return out;
}

export function slugifyNodeId(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return s || "component";
}

export function uniqueNodeIdFromLabel(label: string, existing: Set<string>): string {
  const base = slugifyNodeId(label);
  let id = base;
  let n = 0;
  while (existing.has(id)) {
    n += 1;
    id = `${base}_${n}`;
  }
  return id;
}
