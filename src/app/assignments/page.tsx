import Link from "next/link";
import { db } from "@/lib/db";
import { removePhaseAssignment, setPhaseAssignment } from "./actions";
import { ProjectSelector } from "./ProjectSelector";

export const dynamic = "force-dynamic";

function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const [projectsList, allProjects, resources] = await Promise.all([
    // Selector list — planned/active only
    db.project.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE"] } },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    // All assignments across all projects — needed to detect over-allocation
    // even when the user is viewing a different project.
    db.project.findMany({
      include: {
        phases: {
          include: {
            assignments: true,
          },
        },
      },
    }),
    db.resource.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { capabilities: true, capacityOverrides: true },
    }),
  ]);

  const selectedId =
    (searchParams.project && projectsList.find((p) => p.id === searchParams.project)?.id) ||
    projectsList[0]?.id ||
    "";

  const project = selectedId
    ? await db.project.findUnique({
        where: { id: selectedId },
        include: {
          phases: {
            include: {
              phase: true,
              demands: { include: { role: true } },
              assignments: { include: { resource: true, role: true } },
            },
          },
        },
      })
    : null;

  // Cross-project utilization per resource per month
  const utilByResource: Record<string, Record<string, number>> = {};
  for (const r of resources) utilByResource[r.id] = {};
  for (const proj of allProjects) {
    for (const pp of proj.phases) {
      for (const a of pp.assignments) {
        utilByResource[a.resourceId] = utilByResource[a.resourceId] ?? {};
        utilByResource[a.resourceId][a.month] =
          (utilByResource[a.resourceId][a.month] ?? 0) + a.fte;
      }
    }
  }
  const overrideByResourceMonth: Record<string, Record<string, number>> = {};
  for (const r of resources) {
    overrideByResourceMonth[r.id] = {};
    for (const o of r.capacityOverrides) overrideByResourceMonth[r.id][o.month] = o.capacity;
  }
  function capFor(resourceId: string, month: string): number {
    const r = resources.find((x) => x.id === resourceId);
    if (!r) return 0;
    return overrideByResourceMonth[resourceId][month] ?? r.defaultCapacity;
  }

  const capableResourcesByRole: Record<string, typeof resources> = {};
  for (const r of resources) {
    for (const c of r.capabilities) {
      capableResourcesByRole[c.roleId] = capableResourcesByRole[c.roleId] ?? [];
      capableResourcesByRole[c.roleId].push(r);
    }
  }

  const overallocated: { resourceId: string; name: string; month: string; loaded: number; cap: number }[] = [];
  for (const [rid, byMonth] of Object.entries(utilByResource)) {
    const r = resources.find((x) => x.id === rid);
    if (!r) continue;
    for (const [m, load] of Object.entries(byMonth)) {
      const c = capFor(rid, m);
      if (load > c + 1e-9) overallocated.push({ resourceId: rid, name: r.name, month: m, loaded: load, cap: c });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assignments</h1>
        <p className="text-sm text-slate-500">
          Staff role demand with named resources. Assignments store FTE per month; the input
          below sets the same FTE across every month of the phase (uses solved dates if the
          project has been leveled, otherwise planned). Resources are filtered by their{" "}
          <Link href="/resources" className="text-blue-600 hover:underline">capabilities</Link>.
        </p>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Project</label>
          {projectsList.length === 0 ? (
            <div className="text-sm text-slate-500">No planned or active projects.</div>
          ) : (
            <ProjectSelector projects={projectsList} selectedId={selectedId} />
          )}
        </div>
      </div>

      {overallocated.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <div className="mb-1 text-sm font-semibold text-red-900">
            Over-allocated resources ({overallocated.length}) — across all projects
          </div>
          <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
            {overallocated
              .sort((a, b) => (a.name + a.month).localeCompare(b.name + b.month))
              .map((o) => (
                <li key={`${o.resourceId}-${o.month}`} className="text-xs text-red-900">
                  <span className="font-medium">{o.name}</span> · <span className="font-mono">{o.month}</span>
                  {" · "}
                  {o.loaded.toFixed(2)} / {o.cap.toFixed(2)} FTE
                </li>
              ))}
          </ul>
        </div>
      )}

      {project && (() => {
        const phases = [...project.phases].sort((a, b) => a.phase.order - b.phase.order);
        return (
          <div className="card">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">
                <span className="mr-2 font-mono text-sm text-slate-500">{project.code}</span>
                {project.name}
              </h2>
              <Link href={`/projects/${project.id}`} className="text-xs text-blue-600 hover:underline">
                Edit project
              </Link>
            </div>

            {phases.length === 0 && (
              <div className="text-sm text-slate-500">No phases configured.</div>
            )}

            <div className="space-y-4">
              {phases.map((pp) => {
                const start = pp.solvedStart ?? pp.plannedStart;
                const end = pp.solvedEnd ?? pp.plannedEnd;
                const isSolved = pp.solvedStart !== null;
                // Color-code phase header by phase.order to match the Level Load Gantt
                const phaseHeaderColors = [
                  "bg-blue-600",
                  "bg-indigo-600",
                  "bg-violet-600",
                  "bg-fuchsia-600",
                  "bg-rose-600",
                  "bg-orange-600",
                  "bg-amber-600",
                  "bg-emerald-600",
                  "bg-teal-600",
                  "bg-cyan-600",
                ];
                const headerBg = phaseHeaderColors[pp.phase.order % phaseHeaderColors.length];
                return (
                  <div key={pp.id} className="overflow-hidden rounded-md border border-slate-300 shadow-sm">
                    <div className={`${headerBg} flex items-baseline justify-between px-3 py-2 text-white`}>
                      <div className="text-sm font-bold uppercase tracking-wide">
                        {pp.phase.name}
                      </div>
                      <div className="text-[11px] font-medium opacity-90">
                        {isoDate(start)} → {isoDate(end)}
                        {isSolved && <span className="ml-1 rounded bg-white/20 px-1 py-0.5 text-[10px]">solved</span>}
                      </div>
                    </div>
                    <div className="p-3">

                    {pp.demands.length === 0 ? (
                      <div className="text-xs text-slate-500">No role demand for this phase.</div>
                    ) : (
                      <div className="space-y-2">
                        {pp.demands.map((demand) => {
                          const assignees = pp.assignments.filter(
                            (a) => a.roleId === demand.roleId,
                          );
                          const assignedByResource: Record<string, number> = {};
                          for (const a of assignees) {
                            assignedByResource[a.resourceId] = Math.max(
                              assignedByResource[a.resourceId] ?? 0,
                              a.fte,
                            );
                          }
                          const uniqueAssignees = Object.entries(assignedByResource);
                          const totalAssignedFte = uniqueAssignees.reduce(
                            (sum, [, f]) => sum + f,
                            0,
                          );
                          const remaining = demand.fte - totalAssignedFte;
                          const capable = capableResourcesByRole[demand.roleId] ?? [];
                          const assignedResourceIds = new Set(
                            uniqueAssignees.map(([id]) => id),
                          );
                          const available = capable.filter(
                            (r) => !assignedResourceIds.has(r.id),
                          );

                          return (
                            <div key={demand.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                                <div className="text-base font-semibold text-slate-800">
                                  {demand.role.name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  demand {demand.fte.toFixed(2)} FTE · assigned{" "}
                                  {totalAssignedFte.toFixed(2)} ·{" "}
                                  <span
                                    className={
                                      remaining > 1e-9
                                        ? "font-semibold text-amber-700"
                                        : remaining < -1e-9
                                        ? "font-semibold text-red-700"
                                        : "font-semibold text-emerald-700"
                                    }
                                  >
                                    {remaining > 1e-9
                                      ? `${remaining.toFixed(2)} unfilled`
                                      : remaining < -1e-9
                                      ? `${Math.abs(remaining).toFixed(2)} over`
                                      : "filled"}
                                  </span>
                                </div>
                              </div>

                              {uniqueAssignees.length > 0 && (
                                <ul className="mb-3 space-y-2">
                                  {uniqueAssignees.map(([resourceId, fte]) => {
                                    const r = resources.find((x) => x.id === resourceId);
                                    return (
                                      <li
                                        key={resourceId}
                                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded bg-slate-50 px-2 py-1.5 text-sm"
                                      >
                                        <span className="font-medium">{r?.name ?? "?"}</span>
                                        <form
                                          action={setPhaseAssignment}
                                          className="flex items-center gap-1"
                                        >
                                          <input type="hidden" name="projectPhaseId" value={pp.id} />
                                          <input type="hidden" name="roleId" value={demand.roleId} />
                                          <input type="hidden" name="resourceId" value={resourceId} />
                                          <label className="text-xs text-slate-500">FTE</label>
                                          <input
                                            name="fte"
                                            type="number"
                                            step="0.05"
                                            min={0}
                                            max={10}
                                            defaultValue={fte}
                                            className="input w-24"
                                            aria-label="FTE"
                                          />
                                          <button className="btn" type="submit">Save</button>
                                        </form>
                                        <form
                                          action={removePhaseAssignment.bind(
                                            null,
                                            pp.id,
                                            demand.roleId,
                                            resourceId,
                                          )}
                                        >
                                          <button className="btn-danger">Remove</button>
                                        </form>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}

                              {available.length > 0 ? (
                                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-2">
                                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Assign resource
                                  </div>
                                  <form
                                    action={setPhaseAssignment}
                                    className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_auto]"
                                  >
                                    <input type="hidden" name="projectPhaseId" value={pp.id} />
                                    <input type="hidden" name="roleId" value={demand.roleId} />
                                    <select
                                      name="resourceId"
                                      required
                                      className="input"
                                      aria-label="Resource"
                                    >
                                      <option value="">Choose resource…</option>
                                      {available.map((r) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                      ))}
                                    </select>
                                    <input
                                      name="fte"
                                      type="number"
                                      step="0.05"
                                      min={0}
                                      max={10}
                                      defaultValue={Math.max(0, Math.min(remaining, 1))}
                                      className="input"
                                      placeholder="FTE"
                                      aria-label="FTE"
                                    />
                                    <button className="btn-primary">Assign</button>
                                  </form>
                                </div>
                              ) : (
                                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500">
                                  {capable.length === 0
                                    ? "No named resources have this capability."
                                    : "All capable resources are already assigned."}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
