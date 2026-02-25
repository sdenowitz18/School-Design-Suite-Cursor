export type SemesterLabel = "Fall" | "Spring";

export function toIsoDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// School year runs Sep–Aug. The key is the starting calendar year (e.g. "2025" for Sep 2025–Aug 2026).
export function getSchoolYearKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  return String(month >= 9 ? year : year - 1);
}

export function getSemesterLabel(date: Date): SemesterLabel {
  const month = date.getMonth() + 1; // 1-12
  return month >= 9 && month <= 12 ? "Fall" : "Spring";
}

// Semester key based on school-year key: "YYYY-Fall" or "YYYY-Spring"
export function getSemesterKey(date: Date): string {
  const yearKey = getSchoolYearKey(date);
  const label = getSemesterLabel(date);
  return `${yearKey}-${label}`;
}

export function formatSchoolYearLabel(yearKey: string): string {
  const start = Number(yearKey);
  if (!Number.isFinite(start)) return yearKey;
  const end2 = String((start + 1) % 100).padStart(2, "0");
  return `${start}–${end2}`;
}

export function listSelectableYearKeys(now: Date = new Date(), lookbackYears = 5): string[] {
  const currentKey = Number(getSchoolYearKey(now));
  const keys: string[] = [];
  for (let i = 0; i < lookbackYears; i++) keys.push(String(currentKey - i));
  return keys;
}

export function listSelectableSemesterKeys(now: Date = new Date(), lookbackYears = 5): string[] {
  const years = listSelectableYearKeys(now, lookbackYears);
  const out: string[] = [];
  for (const y of years) {
    out.push(`${y}-Fall`, `${y}-Spring`);
  }
  return out;
}

export function minAsOfDate(now: Date = new Date(), lookbackYears = 5): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - lookbackYears);
  return toIsoDateString(d);
}

