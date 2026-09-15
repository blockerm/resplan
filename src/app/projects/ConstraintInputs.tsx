"use client";

import { useState } from "react";

export function ConstraintInputs({
  defaultConstraint = "ASAP",
  defaultConstraintMonth = null,
  locked = false,
}: {
  defaultConstraint?: string;
  defaultConstraintMonth?: string | null;
  locked?: boolean;
}) {
  const initial = locked ? "MUST_START" : (defaultConstraint || "ASAP");
  const [constraint, setConstraint] = useState<string>(initial);
  const needsMonth = constraint !== "ASAP";
  const monthLabel = constraint === "MUST_FINISH" ? "Must-finish month" : "Must-start month";

  return (
    <>
      <div>
        <label className="label">Constraint</label>
        <select
          name="constraint"
          defaultValue={initial}
          onChange={(e) => setConstraint(e.target.value)}
          className="input"
          disabled={locked}
          title={locked ? "Auto-fixed once the project is Active or beyond." : undefined}
        >
          <option value="MUST_START">Must start on</option>
          <option value="ASAP">As soon as possible</option>
          <option value="MUST_FINISH">Must finish on</option>
        </select>
      </div>
      <div>
        <label className="label">{needsMonth ? monthLabel : "Month (n/a for ASAP)"}</label>
        <input
          name="constraintMonth"
          placeholder="YYYY-MM"
          pattern="\d{4}-\d{2}"
          defaultValue={defaultConstraintMonth ?? ""}
          className="input"
          disabled={locked || !needsMonth}
          required={!locked && needsMonth}
          title={
            locked
              ? "Derived from the earliest planned phase."
              : needsMonth
              ? "Required — format YYYY-MM"
              : "Not required for ASAP"
          }
        />
      </div>
    </>
  );
}
