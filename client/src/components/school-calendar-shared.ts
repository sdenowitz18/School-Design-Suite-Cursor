export type CalendarType = "semester" | "trimester" | "quarter";

export interface CalendarMarkingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface SchoolCalendarData {
  schoolYearStart: string;
  schoolYearEnd: string;
  instructionalDays: number | null;
  calendarType: CalendarType | null;
  markingPeriods: CalendarMarkingPeriod[];
}

export const CALENDAR_TYPE_OPTIONS: { id: CalendarType; label: string; count: number }[] = [
  { id: "semester", label: "Semester", count: 2 },
  { id: "trimester", label: "Trimester", count: 3 },
  { id: "quarter", label: "Quarter", count: 4 },
];

export const DEFAULT_PERIOD_NAMES: Record<CalendarType, string[]> = {
  semester: ["Semester 1", "Semester 2"],
  trimester: ["Trimester 1", "Trimester 2", "Trimester 3"],
  quarter: ["Q1", "Q2", "Q3", "Q4"],
};

export function countWeekdays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function fmtCalDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function emptySchoolCalendar(): SchoolCalendarData {
  return {
    schoolYearStart: "",
    schoolYearEnd: "",
    instructionalDays: null,
    calendarType: null,
    markingPeriods: [],
  };
}

export function normalizeSchoolCalendar(raw: any): SchoolCalendarData {
  if (!raw || typeof raw !== "object") return emptySchoolCalendar();
  const ct = ["semester", "trimester", "quarter"].includes(raw.calendarType) ? raw.calendarType : null;
  return {
    schoolYearStart: typeof raw.schoolYearStart === "string" ? raw.schoolYearStart : "",
    schoolYearEnd: typeof raw.schoolYearEnd === "string" ? raw.schoolYearEnd : "",
    instructionalDays: typeof raw.instructionalDays === "number" ? raw.instructionalDays : null,
    calendarType: ct,
    markingPeriods: Array.isArray(raw.markingPeriods)
      ? raw.markingPeriods.map((p: any) => ({
          id: String(p?.id ?? `period-${Date.now()}-${Math.random()}`),
          name: String(p?.name ?? ""),
          startDate: String(p?.startDate ?? ""),
          endDate: String(p?.endDate ?? ""),
        }))
      : [],
  };
}

export function buildDefaultPeriods(type: CalendarType): CalendarMarkingPeriod[] {
  return DEFAULT_PERIOD_NAMES[type].map((name, i) => ({
    id: `period-${i}`,
    name,
    startDate: "",
    endDate: "",
  }));
}
