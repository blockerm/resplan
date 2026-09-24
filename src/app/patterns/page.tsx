import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const patterns = await db.projectPattern.findMany({
    orderBy: { order: "asc" },
    include: {
      phaseWeights: { include: { phase: true }, orderBy: { order: "asc" } },
      _count: { select: { projects: true, roleIntensities: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Project patterns</h1>
        <p className="text-sm text-slate-500">
          Templates that define which phases apply to a project category, each phase&apos;s
          % of overall duration, and per-role FTE demand within each phase. Selecting a
          pattern on a project (with start + end dates) auto-generates phases and role
          demand.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {patterns.map((p) => (
          <Link
            key={p.id}
            href={`/patterns/${p.id}`}
            className="card hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-baseline justify-between">
              <div className="text-base font-semibold text-slate-900">{p.name}</div>
              <div className="text-[11px] text-slate-500">
                {p._count.projects} project{p._count.projects === 1 ? "" : "s"} · {p.phaseWeights.length} phases · {p._count.roleIntensities} role cells
              </div>
            </div>
            {p.description && (
              <div className="mt-1 text-xs text-slate-500">{p.description}</div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {p.phaseWeights.map((w) => (
                <span
                  key={w.id}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                >
                  {w.phase.name} {(w.weightPct * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </Link>
        ))}
        {patterns.length === 0 && (
          <div className="card text-sm text-slate-500">
            No patterns configured. Run <code>npx tsx prisma/seed-patterns.ts</code> to load the defaults.
          </div>
        )}
      </div>
    </div>
  );
}
