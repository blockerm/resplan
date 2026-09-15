"use client";

export function DemandFteInput({ defaultValue }: { defaultValue: number }) {
  return (
    <input
      name="fte"
      type="number"
      step="0.05"
      min="0"
      max="10"
      defaultValue={defaultValue}
      className="input w-20"
      onBlur={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        // Only submit if the value actually changed to avoid pointless writes
        // on every focus in/out.
        if (e.currentTarget.value !== String(defaultValue)) {
          form.requestSubmit();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
