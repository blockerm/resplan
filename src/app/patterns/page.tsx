import Link from "next/link";
import { db } from "@/lib/db";
import { createPattern } from "./actions";

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
          % of overall duration, and per-role FTE demand within each phase. Click a
          pattern to edit its weights and role intensities.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Add pattern</h2>
        <form action={createPattern} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <input name="description" className="input" placeholder="Optional" />
          </div>
          <div>
            <label className="label">Order</label>
            <input name="order" type="number" defaultValue={patterns.length} className="input" />
          </div>
          <div className="col-span-2 md:col-span-4">
            <button className="btn-primary">Add pattern</button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {patterns.map((p) => (
          <Link
            key={p.id}
            href={`/patterns/${p.id}`}
            className="card hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-baseline justify-between">
              <div className="text-base font-semibold text-slate-900">
                {p.name}
                {!p.active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
              </div>
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
            No patterns configured. Run <code>npm run db:seed</code> to load the six defaults.
          </div>
        )}
      </div>
    </div>
  );
}
