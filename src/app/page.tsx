import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projects, resources, roles, phases] = await Promise.all([
    db.project.count(),
    db.resource.count({ where: { active: true } }),
    db.role.count({ where: { active: true } }),
    db.phase.count({ where: { active: true } }),
  ]);

  const activeProjects = await db.project.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE"] } },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    take: 5,
    select: { id: true, code: true, name: true, priority: true, status: true },
  });

  const stats = [
    { label: "Projects", value: projects, href: "/projects" },
    { label: "Resources", value: resources, href: "/resources" },
    { label: "Roles", value: roles, href: "/roles" },
    { label: "Phases", value: phases, href: "/phases" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Level-loading and utilization views land in the next milestone. For now,
          configure your roles, phases, resources, and projects.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card hover:shadow-md">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Top-priority active projects</h2>
          <Link href="/projects" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {activeProjects.length === 0 ? (
          <div className="text-sm text-slate-500">No planned or active projects yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="table-th">Code</th>
                <th className="table-th">Name</th>
                <th className="table-th">Priority</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeProjects.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="table-td font-mono text-xs">{p.code}</td>
                  <td className="table-td">
                    <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="table-td">{p.priority}</td>
                  <td className="table-td">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
