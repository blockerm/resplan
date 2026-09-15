import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  deleteResource,
  updateResource,
  upsertCapacityOverride,
  deleteCapacityOverride,
} from "../actions";
import { CapabilityToggle } from "./CapabilityToggle";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({ params }: { params: { id: string } }) {
  const resource = await db.resource.findUnique({
    where: { id: params.id },
    include: {
      capabilities: true,
      capacityOverrides: { orderBy: { month: "asc" } },
    },
  });
  if (!resource) return notFound();

  const roles = await db.role.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  const capableRoleIds = new Set(resource.capabilities.map((c) => c.roleId));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/resources" className="text-sm text-blue-600 hover:underline">
            ← All resources
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{resource.name}</h1>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <form
          action={updateResource.bind(null, resource.id)}
          className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_2fr_120px_100px_auto]"
        >
          <div>
            <label className="label">Name</label>
            <input name="name" defaultValue={resource.name} required className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" defaultValue={resource.email ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Default FTE</label>
            <input
              name="defaultCapacity"
              type="number"
              step="0.05"
              min="0"
              max="2"
              defaultValue={resource.defaultCapacity}
              className="input"
            />
          </div>
          <div>
            <label className="label">Active</label>
            <label className="inline-flex h-9 items-center gap-1 text-sm">
              <input type="checkbox" name="active" defaultChecked={resource.active} />
              Active
            </label>
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary">Save</button>
            <button className="btn-danger" formAction={deleteResource.bind(null, resource.id)} formNoValidate>
              Delete
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Capabilities</h2>
        <p className="mb-3 text-xs text-slate-500">
          Which roles this resource can fill. Only these roles are offered when assigning them to a project slot.
        </p>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <CapabilityToggle
              key={r.id}
              resourceId={resource.id}
              roleId={r.id}
              label={r.name}
              enabled={capableRoleIds.has(r.id)}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Monthly capacity overrides</h2>
        <p className="mb-3 text-xs text-slate-500">
          Use to model PTO, part-time months, or ramp. Any month with no override falls back to the default FTE.
        </p>

        <form
          action={upsertCapacityOverride.bind(null, resource.id)}
          className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[140px_120px_1fr_auto]"
        >
          <input name="month" required placeholder="YYYY-MM" pattern="\d{4}-\d{2}" className="input" />
          <input name="capacity" required type="number" step="0.05" min="0" max="2" placeholder="FTE" className="input" />
          <input name="note" placeholder="Note (optional)" className="input" />
          <button className="btn-primary">Add / update</button>
        </form>

        {resource.capacityOverrides.length === 0 ? (
          <div className="text-sm text-slate-500">No overrides set.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-th w-32">Month</th>
                <th className="table-th w-24 text-center">FTE</th>
                <th className="table-th">Note</th>
                <th className="table-th w-24"></th>
              </tr>
            </thead>
            <tbody>
              {resource.capacityOverrides.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-0">
                  <td className="table-td font-mono text-xs">{o.month}</td>
                  <td className="table-td text-center">{o.capacity.toFixed(2)}</td>
                  <td className="table-td text-slate-500">{o.note ?? ""}</td>
                  <td className="table-td">
                    <form action={deleteCapacityOverride.bind(null, o.id, resource.id)}>
                      <button className="btn-danger">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
