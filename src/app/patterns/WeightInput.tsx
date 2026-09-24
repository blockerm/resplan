"use client";

import { useState } from "react";

// Displays weight as a percentage (integer 0-100). Submits the actual fraction
// (0-1) via a hidden field so the server sees what the schema expects.
// `autoSubmit` (default true) triggers form.requestSubmit() on blur if the
// value changed — set false for forms that need an explicit submit click.
export function WeightInput({
  defaultPct,
  autoSubmit = true,
}: {
  defaultPct: number;
  autoSubmit?: boolean;
}) {
  const initialPct = Math.round((defaultPct ?? 0) * 100);
  const [pct, setPct] = useState<string>(String(initialPct));
  const numeric = Number(pct) || 0;
  return (
    <>
      <input
        type="number"
        step="1"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        className="input w-20 text-right"
        onBlur={(e) => {
          if (autoSubmit && numeric !== initialPct) {
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <input type="hidden" name="weightPct" value={numeric / 100} />
    </>
  );
}
