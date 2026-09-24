import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PatternDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pattern = await db.projectPattern.findUnique({
    where: { id: params.id },
    include: {
      phaseWeights: { include: { phase: true }, orderBy: { order: "asc" } },
      roleIntensities: { include: { role: true, phase: true } },
    },
  });
  if (!pattern) return notFound();

  const orderedPhases = pattern.phaseWeights.map((w) => w.phase);
  // Rows by role — order by role.order then name
  const roleMap: Record<string, { name: string; order: number }> = {};
  for (const it of pattern.roleIntensities) {
    roleMap[it.roleId] = { name: it.role.name, order: it.role.order };
  }
  const roleIds = Object.keys(roleMap).sort((a, b) => {
    const ao = roleMap[a].order;
    const bo = roleMap[b].order;
    return ao - bo || roleMap[a].name.localeCompare(roleMap[b].name);
  });

  const cellByKey: Record<string, { fte: number; engagement: string }> = {};
  const engagementByRole: Record<string, string> = {};
  for (const it of pattern.roleIntensities) {
    cellByKey[`${it.roleId}|${it.phaseId}`] = { fte: it.fte, engagement: it.engagement };
    // A role's engagement is the same across phases in the source data
    engagementByRole[it.roleId] = it.engagement;
  }

  const totalWeight = pattern.phaseWeights.reduce((s, w) => s + w.weightPct, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/patterns" className="text-sm text-blue-600 hover:underline">
          ← All patterns
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{pattern.name}</h1>
        {pattern.description && (
          <p className="mt-1 text-sm text-slate-500">{pattern.description}</p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Phase weights (% of overall duration)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="table-th">Phase</th>
              <th className="table-th w-24 text-right">Weight</th>
              <th className="table-th w-24 text-right">Sequence</th>
            </tr>
          </thead>
          <tbody>
            {pattern.phaseWeights.map((w) => (
              <tr key={w.id} className="border-b border-slate-100 last:border-0">
                <td className="table-td">{w.phase.name}</td>
                <td className="table-td text-right font-mono">{(w.weightPct * 100).toFixed(0)}%</td>
                <td className="table-td text-right text-slate-500">{w.order + 1}</td>
              </tr>
            ))}
            <tr>
              <td className="table-td font-semibold">Total</td>
              <td className="table-td text-right font-mono font-semibold">
                {(totalWeight * 100).toFixed(0)}%
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Role intensity matrix (FTE per phase)</h2>
        <p className="mb-3 text-xs text-slate-500">
          <span className="mr-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900">Core</span>
          <span className="mr-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Situational</span>
          <span className="mr-2 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">Not engaged</span>
        </p>
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-600">
                Role
              </th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-center font-medium text-slate-500">
                Engagement
              </th>
              {orderedPhases.map((p) => (
                <th
                  key={p.id}
                  className="border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-500"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roleIds.map((rid) => {
              const eng = engagementByRole[rid];
              const engColor =
                eng === "CORE"
                  ? "bg-emerald-50 text-emerald-900"
                  : eng === "SITUATIONAL"
                  ? "bg-amber-50 text-amber-900"
                  : "bg-slate-100 text-slate-500";
              return (
                <tr key={rid}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-100 bg-white px-3 py-1.5">
                    {roleMap[rid].name}
                  </td>
                  <td
                    className={clsx(
                      "border-b border-r border-slate-100 px-2 py-1.5 text-center text-[11px]",
                      engColor,
                    )}
                  >
                    {eng === "CORE"
                      ? "Core"
                      : eng === "SITUATIONAL"
                      ? "Situational"
                      : "Not engaged"}
                  </td>
                  {orderedPhases.map((ph) => {
                    const cell = cellByKey[`${rid}|${ph.id}`];
                    const isEngaged = eng !== "NOT_ENGAGED" && cell && cell.fte > 0;
                    return (
                      <td
                        key={ph.id}
                        className={clsx(
                          "border-b border-slate-100 px-2 py-1 text-center font-mono tabular-nums",
                          isEngaged ? "" : "bg-slate-50 text-slate-300",
                        )}
                      >
                        {cell ? cell.fte.toFixed(2) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
