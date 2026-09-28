export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local calendar day key `YYYY-MM-DD`. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

/** Monday-first start of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

export function monthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function weekGrid(cursor: Date): Date[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function monthTitle(cursor: Date): string {
  return cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function weekTitle(cursor: Date): string {
  const start = startOfWeek(cursor);
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function combineLocalDateTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number.isFinite(hours) ? hours : 10,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
}

export function defaultTimeForDay(day: Date): string {
  if (!isToday(day)) return "10:00";

  const later = new Date(Date.now() + 60 * 60 * 1000);
  return `${pad2(later.getHours())}:${pad2(later.getMinutes())}`;
}
