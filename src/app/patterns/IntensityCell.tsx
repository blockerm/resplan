"use client";

// Auto-saving FTE input for a single (pattern, role, phase) intensity cell.
export function IntensityCell({ defaultValue }: { defaultValue: number }) {
  return (
    <input
      name="fte"
      type="number"
      step="0.01"
      min={0}
      max={10}
      defaultValue={defaultValue}
      className="input w-16 text-right text-xs"
      onBlur={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        if (e.currentTarget.value !== String(defaultValue)) {
          form.requestSubmit();
        }
      }}
    />
  );
}
