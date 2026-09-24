"use client";

import { useState } from "react";

// Displays weight as a percentage (integer 0-100) for user editing, but
// submits the actual fraction (0-1) via a hidden field so the server sees
// what the schema expects.
export function WeightInput({ defaultPct }: { defaultPct: number }) {
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
          if (numeric !== initialPct) {
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <input type="hidden" name="weightPct" value={numeric / 100} />
    </>
  );
}
