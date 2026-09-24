"use client";

// Auto-saving integer input for the "Order" cell in the phase-weights table.
export function OrderInput({ defaultValue }: { defaultValue: number }) {
  return (
    <input
      name="order"
      type="number"
      defaultValue={defaultValue}
      className="input w-16 text-right"
      onBlur={(e) => {
        if (e.currentTarget.value !== String(defaultValue)) {
          e.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
