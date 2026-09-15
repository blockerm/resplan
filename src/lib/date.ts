export function toMonthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function fromMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function addMonths(key: string, n: number): string {
  const d = fromMonthKey(key);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toMonthKey(d);
}

export function monthsBetween(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  let cur = startKey;
  while (cur <= endKey) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export function monthLabel(key: string): string {
  const d = fromMonthKey(key);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}
