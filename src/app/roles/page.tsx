import { db } from "@/lib/db";
import { createRole, deleteRole, updateRole } from "./actions";

export const dynamic = "force-dynamic";

const ROW = "grid grid-cols-[64px_minmax(180px,1fr)_minmax(220px,2fr)_80px_90px_60px_60px_180px] items-center gap-2";

export default async function RolesPage() {
  const roles = await db.role.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { demands: true, capabilities: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Roles</h1>
        <p className="text-sm text-slate-500">
          Skills or job types that projects consume (e.g. Developer, QA Engineer).
          <span className="font-medium"> Pool FTE</span> is the total capacity available for this role every month —
          the level-load solver uses this number alone. Named resources are a separate concern (staffing);
          they're assigned to leveled slots after solving and don't affect capacity here.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Add role</h2>
        <form action={createRole} className={ROW}>
          <input name="order" type="number" defaultValue={roles.length} className="input" placeholder="Order" />
          <input name="name" required className="input" placeholder="Name (e.g. Data Engineer)" />
          <input name="description" className="input" placeholder="Description (optional)" />
          <label className="inline-flex items-center gap-1 text-sm text-slate-600">
            <input type="checkbox" name="active" defaultChecked />
            Active
          </label>
          <input
            name="defaultCapacity"
            type="number"
            step="0.05"
            min="0"
            defaultValue={0}
            placeholder="Pool FTE"
            className="input"
            title="Unnamed FTE available for this role every month"
          />
          <span />
          <span />
          <button className="btn-primary">Add role</button>
        </form>
      </div>

      <div className="card">
        <div className={`${ROW} border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500`}>
          <div>Order</div>
          <div>Name</div>
          <div>Description</div>
          <div>Active</div>
          <div className="text-center">Pool FTE</div>
          <div className="text-center">Demand</div>
          <div className="text-center">Skilled</div>
          <div />
        </div>
        <div className="divide-y divide-slate-100">
          {roles.length === 0 && (
            <div className="py-4 text-sm text-slate-500">No roles yet.</div>
          )}
          {roles.map((r) => (
            <form key={r.id} action={updateRole.bind(null, r.id)} className={`${ROW} py-2`}>
              <input name="order" type="number" defaultValue={r.order} className="input" />
              <input name="name" defaultValue={r.name} required className="input" />
              <input name="description" defaultValue={r.description ?? ""} className="input" />
              <label className="inline-flex items-center gap-1 text-sm">
                <input type="checkbox" name="active" defaultChecked={r.active} />
              </label>
              <input
                name="defaultCapacity"
                type="number"
                step="0.05"
                min="0"
                defaultValue={r.defaultCapacity}
                className="input"
                title="Unnamed FTE available for this role every month"
              />
              <div className="text-center text-sm text-slate-500">{r._count.demands}</div>
              <div className="text-center text-sm text-slate-500">{r._count.capabilities}</div>
              <div className="flex gap-2">
                <button className="btn" type="submit">Save</button>
                <button
                  className="btn-danger"
                  formAction={deleteRole.bind(null, r.id)}
                  formNoValidate
                >
                  {r._count.demands + r._count.capabilities > 0 ? "Hide" : "Delete"}
                </button>
              </div>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
