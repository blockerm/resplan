"use client";

import { useState } from "react";

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fromIso(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: string, b: string): number | "" {
  const da = fromIso(a);
  const db = fromIso(b);
  if (!da || !db) return "";
  // Inclusive-end convention: Sep 1 → Sep 30 = 30 days
  const diff = Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : "";
}

function addDaysIso(s: string, days: number): string {
  const d = fromIso(s);
  if (!d) return "";
  d.setUTCDate(d.getUTCDate() + days - 1); // inclusive-end
  return toIso(d);
}

export function PhaseDates({
  defaultStart = "",
  defaultEnd = "",
  required = false,
}: {
  defaultStart?: string;
  defaultEnd?: string;
  required?: boolean;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [duration, setDuration] = useState<number | "">(daysBetween(defaultStart, defaultEnd));

  function onStartChange(v: string) {
    setStart(v);
    if (typeof duration === "number" && duration > 0) {
      setEnd(addDaysIso(v, duration));
    } else if (end) {
      setDuration(daysBetween(v, end));
    }
  }
  function onEndChange(v: string) {
    setEnd(v);
    setDuration(daysBetween(start, v));
  }
  function onDurationChange(v: string) {
    const n = v === "" ? "" : Math.max(1, Math.round(Number(v)));
    setDuration(n);
    if (typeof n === "number" && start) {
      setEnd(addDaysIso(start, n));
    }
  }

  return (
    <>
      <div>
        <label className="label">Start</label>
        <input
          name="plannedStart"
          type="date"
          value={start}
          onChange={(e) => onStartChange(e.target.value)}
          required={required}
          className="input"
        />
      </div>
      <div>
        <label className="label">Duration (days)</label>
        <input
          type="number"
          min={1}
          value={duration}
          onChange={(e) => onDurationChange(e.target.value)}
          className="input"
          title="Inclusive of both start and end days. Editing this recomputes End."
        />
      </div>
      <div>
        <label className="label">End</label>
        <input
          name="plannedEnd"
          type="date"
          value={end}
          onChange={(e) => onEndChange(e.target.value)}
          required={required}
          className="input"
        />
      </div>
    </>
  );
}
