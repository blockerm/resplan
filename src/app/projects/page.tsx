import Link from "next/link";
import { db } from "@/lib/db";
import { createProject } from "./actions";
import { ConstraintInputs } from "./ConstraintInputs";

export const dynamic = "force-dynamic";

function constraintLabel(c: string, month: string | null): React.ReactNode {
  if (c === "MUST_START") return <>Must start <span className="font-mono">{month ?? "?"}</span></>;
  if (c === "MUST_FINISH") return <>Must finish <span className="font-mono">{month ?? "?"}</span></>;
  return <>ASAP</>;
}

export default async function ProjectsPage() {
  const [projects, patterns] = await Promise.all([
    db.project.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      include: {
        pattern: { select: { name: true } },
        _count: { select: { phases: true, dependsOn: true } },
      },
    }),
    db.projectPattern.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-slate-500">
          Priority-ordered. Set phase date ranges and per-role FTE demand on each project&apos;s detail page.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Add project</h2>
        <form action={createProject} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="label">Code</label>
              <input name="code" required className="input" placeholder="PRJ-005" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="label">Name</label>
              <input name="name" required className="input" />
            </div>
            <div>
              <label className="label">Priority</label>
              <input name="priority" type="number" min={1} max={5} defaultValue={3} className="input" />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input" defaultValue="PLANNED">
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="COMPLETE">Complete</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Pattern (auto-generates phases + role demand)</label>
              <select name="patternId" className="input" defaultValue="">
                <option value="">— none —</option>
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start date</label>
              <input name="startDate" type="date" className="input" />
            </div>
            <div>
              <label className="label">End date</label>
              <input name="endDate" type="date" className="input" />
            </div>
            <ConstraintInputs />
          </div>
          <div>
            <button className="btn-primary">Add project</button>
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="table-th w-24">Code</th>
              <th className="table-th">Name</th>
              <th className="table-th w-20 text-center">Priority</th>
              <th className="table-th w-28">Status</th>
              <th className="table-th w-40">Pattern</th>
              <th className="table-th w-40">Constraint</th>
              <th className="table-th w-20 text-center">Phases</th>
              <th className="table-th w-20 text-center">Deps</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-sm text-slate-500">No projects yet.</td></tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="table-td font-mono text-xs">{p.code}</td>
                <td className="table-td">
                  <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="table-td text-center">{p.priority}</td>
                <td className="table-td">{p.status}</td>
                <td className="table-td text-xs text-slate-600">
                  {p.pattern?.name ?? "—"}
                </td>
                <td className="table-td text-xs">
                  {constraintLabel(p.constraint, p.constraintMonth)}
                </td>
                <td className="table-td text-center text-slate-500">{p._count.phases}</td>
                <td className="table-td text-center text-slate-500">{p._count.dependsOn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
