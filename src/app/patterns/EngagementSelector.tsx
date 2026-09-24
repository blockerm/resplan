"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { setRoleEngagementInPattern } from "./actions";

const OPTIONS: { value: "CORE" | "SITUATIONAL" | "NOT_ENGAGED"; label: string; cls: string }[] = [
  { value: "CORE", label: "Core", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { value: "SITUATIONAL", label: "Sit.", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  { value: "NOT_ENGAGED", label: "None", cls: "bg-slate-100 text-slate-600 border-slate-300" },
];

export function EngagementSelector({
  patternId,
  roleId,
  current,
}: {
  patternId: string;
  roleId: string;
  current: "CORE" | "SITUATIONAL" | "NOT_ENGAGED";
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300 text-[10px]">
      {OPTIONS.map((o) => {
        const selected = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={pending || selected}
            onClick={() =>
              startTransition(async () => {
                await setRoleEngagementInPattern(patternId, roleId, o.value);
              })
            }
            className={clsx(
              "px-1.5 py-0.5",
              selected ? o.cls : "bg-white text-slate-500 hover:bg-slate-50",
              pending && "opacity-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
