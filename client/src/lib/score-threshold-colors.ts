/**
 * 1–5 health / dimension scores: rounded value 1–2 concern, 3 middling, 4–5 strong.
 * Used for pills, chips, and small score badges so coloring stays consistent app-wide.
 */
export function scoreBgCls(score: number | null): string {
  if (score === null || Number.isNaN(score)) {
    return "bg-gray-100 text-gray-400 border-gray-200";
  }
  const r = Math.round(score);
  if (r <= 2) return "bg-red-100 text-red-700 border-red-200";
  if (r === 3) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}
