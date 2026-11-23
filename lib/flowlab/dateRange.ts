// Date-range checks for the Flow Lab log export. Pure, unit-tested.
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_RANGE_DAYS = 92;
const DAY = 86_400_000;

/** Validates a yyyy-mm-dd range (real dates, from <= to, at most MAX_RANGE_DAYS days). Returns an error text or null. */
export function checkRange(from: string | undefined, to: string | undefined): string | null {
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) return 'Dates must look like 2026-11-30.';
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || new Date(a).toISOString().slice(0, 10) !== from || new Date(b).toISOString().slice(0, 10) !== to) return 'Not a real date.';
  if (b < a) return '"From" must not be after "to".';
  if ((b - a) / DAY + 1 > MAX_RANGE_DAYS) return `Choose at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

/** Adds days to a yyyy-mm-dd date string. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
