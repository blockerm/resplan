"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { setCapability } from "../actions";

export function CapabilityToggle({
  resourceId,
  roleId,
  label,
  enabled,
}: {
  resourceId: string;
  roleId: string;
  label: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setCapability(resourceId, roleId, !enabled);
        })
      }
      className={clsx(
        "rounded-full border px-3 py-1 text-sm transition",
        enabled
          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-500"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
        pending && "opacity-50",
      )}
    >
      {label}
    </button>
  );
}
