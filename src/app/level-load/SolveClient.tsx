"use client";

import { useState, useTransition } from "react";
import { runSolve } from "./actions";
import type { SolveResult } from "@/lib/levelload";
import { Heatmap } from "./Heatmap";
import { Gantt } from "./Gantt";

function ResultSummary({ result }: { result: SolveResult }) {
  const infeasible = result.projects.filter((p) => p.infeasible);

  return (
    <div className="space-y-3">
      {infeasible.length === 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          All planned/active projects were placed within capacity and constraints.
        </div>
      )}

      {infeasible.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-900">
            Infeasible projects ({infeasible.length})
          </h3>
          <p className="mb-2 text-xs text-red-800">
            Hard constraints (capacity within horizon, must-start, must-finish, or
            dependency) cannot be satisfied.
          </p>
          <ul className="space-y-2 text-sm text-red-900">
            {infeasible.map((p) => (
              <li key={p.projectId}>
                <span className="font-mono text-xs text-red-700">{p.code}</span>{" "}
                <strong>{p.name}</strong>
                <div className="text-xs text-red-800">
                  {p.infeasibleReason}
                  {p.bottleneck && (
                    <>
                      {" "}
                      Bottleneck: <strong>{p.bottleneck.roleName}</strong> in{" "}
                      <strong>{p.bottleneck.month}</strong> — short{" "}
                      {p.bottleneck.shortfallFte.toFixed(2)} FTE.
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SolveClient({
  initialHorizonStart,
  initialHorizonEnd,
  initialResult,
}: {
  initialHorizonStart: string;
  initialHorizonEnd: string;
  initialResult: SolveResult | null;
}) {
  const [start, setStart] = useState(initialHorizonStart);
  const [end, setEnd] = useState(initialHorizonEnd);
  const [result, setResult] = useState<SolveResult | null>(initialResult);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"post" | "pre">("post");

  const doSolve = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await runSolve(start, end);
        setResult(r);
      } catch (e: any) {
        setError(e?.message ?? "Solve failed");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Horizon start (YYYY-MM)</label>
            <input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              pattern="\d{4}-\d{2}"
              className="input w-36"
            />
          </div>
          <div>
            <label className="label">Horizon end (YYYY-MM)</label>
            <input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              pattern="\d{4}-\d{2}"
              className="input w-36"
            />
          </div>
          <button className="btn-primary" onClick={doSolve} disabled={pending}>
            {pending ? "Solving…" : result ? "Re-solve" : "Solve"}
          </button>
          {result && (
            <div className="ml-auto flex items-center gap-1 text-xs">
              <button
                className={`rounded-md border px-2 py-1 ${view === "post" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                onClick={() => setView("post")}
              >
                Post-solve
              </button>
              <button
                className={`rounded-md border px-2 py-1 ${view === "pre" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                onClick={() => setView("pre")}
              >
                Pre-solve
              </button>
            </div>
          )}
        </div>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="card">
            <Heatmap
              horizon={result.horizon}
              roles={result.roles}
              capacityByRole={result.capacityByRole}
              demandByRole={view === "post" ? result.demandByRole : result.preSolveDemandByRole}
              title={
                view === "post"
                  ? "Role × Month utilization (post-solve)"
                  : "Role × Month utilization (as configured, pre-solve)"
              }
            />
          </div>
          <div className="card">
            <Gantt result={result} />
          </div>
          <ResultSummary result={result} />
        </>
      )}
    </div>
  );
}
