export type SemesterLabel = "Fall" | "Spring";
export type QuarterLabel = "Q1" | "Q2" | "Q3" | "Q4";

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

export function getQuarterLabel(date: Date): QuarterLabel {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 9 && month <= 10) return "Q1";
  if (month >= 11 && month <= 12) return "Q2";
  if (month >= 1 && month <= 3) return "Q3";
  return "Q4";
}

// Quarter key based on school-year key: "YYYY-Q1" .. "YYYY-Q4"
export function getQuarterKey(date: Date): string {
  const yearKey = getSchoolYearKey(date);
  const label = getQuarterLabel(date);
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

export function listSelectableQuarterKeys(now: Date = new Date(), lookbackYears = 5): string[] {
  const years = listSelectableYearKeys(now, lookbackYears);
  const out: string[] = [];
  for (const y of years) {
    out.push(`${y}-Q1`, `${y}-Q2`, `${y}-Q3`, `${y}-Q4`);
  }
  return out;
}

export function minAsOfDate(now: Date = new Date(), lookbackYears = 5): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - lookbackYears);
  return toIsoDateString(d);
}

/**
 * Returns the ISO date string for the last day of the given marking period.
 * School year = Sep 1 (start year) → Aug 31 (start year + 1).
 * Semester Fall = Sep 1 → Dec 31 (within start year).
 * Semester Spring = Jan 1 → Aug 31 (start year + 1).
 * Quarter Q1 = Sep–Oct, Q2 = Nov–Dec, Q3 = Jan–Mar, Q4 = Apr–Aug.
 */
export function getPeriodEndDate(mode: "year" | "semester" | "quarter", key: string): string | null {
  if (mode === "year") {
    const y = Number(key);
    if (!Number.isFinite(y)) return null;
    return `${y + 1}-08-31`;
  }
  if (mode === "semester") {
    const [yRaw, label] = key.split("-");
    const y = Number(yRaw);
    if (!Number.isFinite(y)) return null;
    if (label === "Fall") return `${y}-12-31`;
    if (label === "Spring") return `${y + 1}-08-31`;
    return null;
  }
  if (mode === "quarter") {
    const [yRaw, label] = key.split("-");
    const y = Number(yRaw);
    if (!Number.isFinite(y)) return null;
    if (label === "Q1") return `${y}-10-31`;
    if (label === "Q2") return `${y}-12-31`;
    if (label === "Q3") return `${y + 1}-03-31`;
    if (label === "Q4") return `${y + 1}-08-31`;
    return null;
  }
  return null;
}

