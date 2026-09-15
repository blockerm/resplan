import Link from "next/link";
import { db } from "@/lib/db";
import { createResource } from "./actions";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const resources = await db.resource.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      capabilities: { include: { role: true } },
      _count: { select: { assignments: true, capacityOverrides: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resources</h1>
        <p className="text-sm text-slate-500">
          Named people, each capable of one or more roles. Resources are for post-solve staffing —
          you assign them to leveled project slots to plan who actually does the work. They do
          <em> not </em> contribute to level-load capacity (that's set per role&apos;s <em>Pool FTE</em>).
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Add resource</h2>
        <form
          action={createResource}
          className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_2fr_120px_100px_auto]"
        >
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Full name" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" placeholder="Optional" />
          </div>
          <div>
            <label className="label">Default FTE</label>
            <input name="defaultCapacity" type="number" step="0.05" min="0" max="2" defaultValue="1" className="input" />
          </div>
          <div>
            <label className="label">Active</label>
            <label className="inline-flex h-9 items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked />
              Active
            </label>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full md:w-auto">Add</button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="table-th">Name</th>
              <th className="table-th">Email</th>
              <th className="table-th text-center">Default FTE</th>
              <th className="table-th">Capabilities</th>
              <th className="table-th text-center">Overrides</th>
              <th className="table-th text-center">Assignments</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 && (
              <tr><td colSpan={7} className="py-4 text-sm text-slate-500">No resources yet.</td></tr>
            )}
            {resources.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="table-td">
                  <Link href={`/resources/${r.id}`} className="text-blue-600 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="table-td text-slate-500">{r.email ?? "—"}</td>
                <td className="table-td text-center">{r.defaultCapacity.toFixed(2)}</td>
                <td className="table-td">
                  {r.capabilities.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.capabilities.map((c) => (
                        <span key={c.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                          {c.role.name}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="table-td text-center text-slate-500">{r._count.capacityOverrides}</td>
                <td className="table-td text-center text-slate-500">{r._count.assignments}</td>
                <td className="table-td">
                  <span className={r.active ? "text-emerald-600" : "text-slate-400"}>
                    {r.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
