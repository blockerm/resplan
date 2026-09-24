"use client";

// Editable weight input (0-100%). Displays as percentage, stores as fraction.
// Auto-submits its enclosing form on blur if the value changed.
export function WeightInput({ defaultPct }: { defaultPct: number }) {
  return (
    <input
      name="weightPct"
      type="number"
      step="1"
      min={0}
      max={100}
      defaultValue={Math.round(defaultPct * 100)}
      className="input w-20 text-right"
      onBlur={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const cur = e.currentTarget.value;
        if (cur !== String(Math.round(defaultPct * 100))) {
          // Convert to fraction before submit — set hidden field via a swap
          const asFrac = String((Number(cur) || 0) / 100);
          e.currentTarget.value = asFrac;
          form.requestSubmit();
        }
      }}
    />
  );
}
