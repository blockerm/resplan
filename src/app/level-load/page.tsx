import { db } from "@/lib/db";
import { SolveClient } from "./SolveClient";
import { toMonthKey, addMonths } from "@/lib/date";
import { solve } from "@/lib/levelload";

export const dynamic = "force-dynamic";

async function computeDefaultHorizon(): Promise<{ start: string; end: string }> {
  const [minRow, maxRow] = await Promise.all([
    db.projectPhase.findFirst({ orderBy: { plannedStart: "asc" } }),
    db.projectPhase.findFirst({ orderBy: { plannedEnd: "desc" } }),
  ]);
  const now = new Date();
  const start = minRow ? toMonthKey(minRow.plannedStart) : toMonthKey(now);
  let end = maxRow ? toMonthKey(maxRow.plannedEnd) : toMonthKey(now);
  // Add a 6-month buffer on the end so shifted projects have room to spill
  end = addMonths(end, 6);
  return { start, end };
}

export default async function LevelLoadPage() {
  const { start, end } = await computeDefaultHorizon();
  const initialResult = await solve({ horizonStart: start, horizonEnd: end });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Level load</h1>
        <p className="text-sm text-slate-500">
          Priority-ordered greedy scheduler. Capacity per role×month comes from each role's
          <em> Pool FTE</em> (set on <a href="/roles" className="text-blue-600 hover:underline">Roles</a>);
          named resources are a separate staffing concern and are not part of this solve. For each
          project (highest priority first) the solver honors upstream dependencies plus lag, then
          shifts start month rightward by the minimum amount that clears any capacity overage —
          subject to the project's target-complete date. Projects that can't fit are listed with
          the specific bottleneck.
        </p>
      </div>
      <SolveClient
        initialHorizonStart={start}
        initialHorizonEnd={end}
        initialResult={initialResult}
      />
    </div>
  );
}
