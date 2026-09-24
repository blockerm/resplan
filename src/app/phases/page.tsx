import { db } from "@/lib/db";
import { createPhase, deletePhase, updatePhase } from "./actions";

export const dynamic = "force-dynamic";

const ROW = "grid grid-cols-[64px_minmax(200px,1fr)_80px_80px_180px] items-center gap-2";

export default async function PhasesPage() {
  const phases = await db.phase.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          projectPhases: true,
          patternWeights: true,
          patternIntensities: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Phases</h1>
        <p className="text-sm text-slate-500">
          Standard project phases. Seed comes with Select / Define / Build / Test / Deploy — edit to fit your methodology.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Add phase</h2>
        <form action={createPhase} className={ROW}>
          <input name="order" type="number" defaultValue={phases.length} className="input" placeholder="Order" />
          <input name="name" required className="input" placeholder="Name (e.g. Discover)" />
          <label className="inline-flex items-center gap-1 text-sm">
            <input type="checkbox" name="active" defaultChecked />
            Active
          </label>
          <span />
          <button className="btn-primary">Add phase</button>
        </form>
      </div>

      <div className="card">
        <div className={`${ROW} border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500`}>
          <div>Order</div>
          <div>Name</div>
          <div>Active</div>
          <div className="text-center">Used</div>
          <div />
        </div>
        <div className="divide-y divide-slate-100">
          {phases.length === 0 && (
            <div className="py-4 text-sm text-slate-500">No phases yet.</div>
          )}
          {phases.map((p) => {
            const refs =
              p._count.projectPhases + p._count.patternWeights + p._count.patternIntensities;
            return (
              <form key={p.id} action={updatePhase.bind(null, p.id)} className={`${ROW} py-2`}>
                <input name="order" type="number" defaultValue={p.order} className="input" />
                <input name="name" defaultValue={p.name} required className="input" />
                <label className="inline-flex items-center gap-1 text-sm">
                  <input type="checkbox" name="active" defaultChecked={p.active} />
                </label>
                <div
                  className="text-center text-sm text-slate-500"
                  title={`Project phases: ${p._count.projectPhases}, pattern weights: ${p._count.patternWeights}, intensity cells: ${p._count.patternIntensities}`}
                >
                  {refs}
                </div>
                <div className="flex gap-2">
                  <button className="btn" type="submit">Save</button>
                  <button
                    className="btn-danger"
                    formAction={deletePhase.bind(null, p.id)}
                    formNoValidate
                  >
                    {refs > 0 ? "Hide" : "Delete"}
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
