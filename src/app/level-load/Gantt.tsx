import { monthLabel } from "@/lib/date";
import type { SolveResult } from "@/lib/levelload";
import clsx from "clsx";

const PHASE_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
];

function colorFor(order: number): string {
  return PHASE_COLORS[order % PHASE_COLORS.length];
}

export function Gantt({ result }: { result: SolveResult }) {
  const { horizon, projects } = result;
  const monthIndex: Record<string, number> = {};
  horizon.forEach((m, i) => (monthIndex[m] = i));

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Portfolio Gantt (post-solve)</h3>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-600">
                Project
              </th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-center font-medium text-slate-500">
                Shift
              </th>
              {horizon.map((m) => (
                <th
                  key={m}
                  className="border-b border-slate-200 px-1 py-2 text-center font-medium text-slate-500"
                >
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const rowCls = p.infeasible ? "bg-red-50" : "";
              const constraintLabel =
                p.constraint === "MUST_START"
                  ? `must-start ${p.constraintMonth}`
                  : p.constraint === "MUST_FINISH"
                  ? `must-finish ${p.constraintMonth}`
                  : "ASAP";
              return (
              <tr key={p.projectId} className={rowCls}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-100 bg-white px-3 py-1.5">
                  <div className="font-medium text-slate-800">
                    <span className="mr-2 font-mono text-[10px] text-slate-500">{p.code}</span>
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Prio {p.priority} · {constraintLabel}
                    {p.infeasible && <span className="ml-1 font-semibold text-red-700">· INFEASIBLE</span>}
                  </div>
                </td>
                <td className="border-b border-r border-slate-100 px-2 py-1.5 text-center font-mono">
                  {p.shiftMonths > 0 ? `+${p.shiftMonths}` : "0"}
                </td>
                {horizon.map((m) => {
                  // Find phase(s) covering this month
                  const phase = p.phases.find((ph) => m >= ph.startMonth && m <= ph.endMonth);
                  return (
                    <td
                      key={m}
                      className="relative border-b border-slate-100 p-0"
                      style={{ minWidth: 42 }}
                    >
                      {phase ? (
                        <div
                          className={clsx(
                            "h-5 w-full",
                            colorFor(phase.phaseOrder),
                            p.infeasible && "opacity-60",
                          )}
                          title={`${phase.phaseName}: ${phase.startMonth} → ${phase.endMonth}`}
                        >
                          {m === phase.startMonth && (
                            <span className="pl-1 text-[10px] font-medium text-white">
                              {phase.phaseName}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={horizon.length + 2} className="p-4 text-center text-slate-500">
                  No planned or active projects.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
