import Link from "next/link";
import { db } from "@/lib/db";
import { addMonths, monthLabel, monthsBetween, toMonthKey } from "@/lib/date";
import { ProjectFilter } from "./ProjectFilter";
import { UtilizationTable } from "./UtilizationTable";

export const dynamic = "force-dynamic";

type Contribution = {
  projectId: string;
  projectCode: string;
  projectName: string;
  phase: string;
  role: string;
  fte: number;
};

type ResAssignment = {
  projectPhaseId: string;
  phaseName: string;
  phaseOrder: number;
  roleId: string;
  roleName: string;
  ftePerMonth: number;
};

export default async function UtilizationPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const [resources, projectsList, projects] = await Promise.all([
    db.resource.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { capacityOverrides: true, capabilities: { include: { role: true } } },
    }),
    db.project.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    db.project.findMany({
      include: {
        phases: {
          include: {
            phase: true,
            assignments: { include: { role: true } },
          },
        },
      },
    }),
  ]);

  const selectedProjectId = searchParams.project ?? "";
  const filteredToProject = selectedProjectId
    ? projectsList.find((p) => p.id === selectedProjectId)
    : null;

  const totalLoad: Record<string, Record<string, number>> = {};
  const projectLoad: Record<string, Record<string, Record<string, number>>> = {};
  const projectTotal: Record<string, Record<string, number>> = {};
  const projectResourcesSet: Record<string, Set<string>> = {};
  const contribList: Record<string, Record<string, Contribution[]>> = {};
  // resourceProjectAssignments[rid][pid] = per-phase/role FTE (dedup across months)
  const rpaAcc: Record<
    string,
    Record<string, Map<string, ResAssignment>>
  > = {};

  for (const r of resources) {
    totalLoad[r.id] = {};
    projectLoad[r.id] = {};
    contribList[r.id] = {};
    rpaAcc[r.id] = {};
  }

  let minMonth: string | null = null;
  let maxMonth: string | null = null;

  for (const proj of projects) {
    if (selectedProjectId && proj.id !== selectedProjectId) continue;
    projectTotal[proj.id] = projectTotal[proj.id] ?? {};
    projectResourcesSet[proj.id] = projectResourcesSet[proj.id] ?? new Set();
    for (const pp of proj.phases) {
      for (const a of pp.assignments) {
        totalLoad[a.resourceId] = totalLoad[a.resourceId] ?? {};
        totalLoad[a.resourceId][a.month] =
          (totalLoad[a.resourceId][a.month] ?? 0) + a.fte;

        projectLoad[a.resourceId] = projectLoad[a.resourceId] ?? {};
        projectLoad[a.resourceId][proj.id] = projectLoad[a.resourceId][proj.id] ?? {};
        projectLoad[a.resourceId][proj.id][a.month] =
          (projectLoad[a.resourceId][proj.id][a.month] ?? 0) + a.fte;

        projectTotal[proj.id][a.month] =
          (projectTotal[proj.id][a.month] ?? 0) + a.fte;
        projectResourcesSet[proj.id].add(a.resourceId);

        contribList[a.resourceId] = contribList[a.resourceId] ?? {};
        contribList[a.resourceId][a.month] = contribList[a.resourceId][a.month] ?? [];
        contribList[a.resourceId][a.month].push({
          projectId: proj.id,
          projectCode: proj.code,
          projectName: proj.name,
          phase: pp.phase.name,
          role: a.role.name,
          fte: a.fte,
        });

        // Assignment representative (per phase+role for this resource+project);
        // FTE is stored per month with the same value across months of a phase in
        // our model. Take the max seen — matches how the Assign UI writes.
        rpaAcc[a.resourceId] = rpaAcc[a.resourceId] ?? {};
        rpaAcc[a.resourceId][proj.id] = rpaAcc[a.resourceId][proj.id] ?? new Map();
        const key = `${pp.id}:${a.roleId}`;
        const existing = rpaAcc[a.resourceId][proj.id].get(key);
        if (!existing || a.fte > existing.ftePerMonth) {
          rpaAcc[a.resourceId][proj.id].set(key, {
            projectPhaseId: pp.id,
            phaseName: pp.phase.name,
            phaseOrder: pp.phase.order,
            roleId: a.roleId,
            roleName: a.role.name,
            ftePerMonth: Math.max(a.fte, existing?.ftePerMonth ?? 0),
          });
        }

        if (minMonth === null || a.month < minMonth) minMonth = a.month;
        if (maxMonth === null || a.month > maxMonth) maxMonth = a.month;
      }
    }
  }

  if (!minMonth || !maxMonth) {
    const now = toMonthKey(new Date());
    minMonth = now;
    maxMonth = addMonths(now, 11);
  }
  const horizon = monthsBetween(minMonth, maxMonth);

  const overrideByResourceMonth: Record<string, Record<string, number>> = {};
  for (const r of resources) {
    overrideByResourceMonth[r.id] = {};
    for (const o of r.capacityOverrides) overrideByResourceMonth[r.id][o.month] = o.capacity;
  }
  const capByResourceMonth: Record<string, Record<string, number>> = {};
  for (const r of resources) {
    capByResourceMonth[r.id] = {};
    for (const m of horizon) {
      capByResourceMonth[r.id][m] =
        overrideByResourceMonth[r.id][m] ?? r.defaultCapacity;
    }
  }

  // Overages panel
  const overages: {
    resourceId: string;
    resourceName: string;
    month: string;
    load: number;
    cap: number;
    contributors: Contribution[];
  }[] = [];
  for (const r of resources) {
    for (const m of horizon) {
      const load = totalLoad[r.id][m] ?? 0;
      const cap = capByResourceMonth[r.id][m];
      if (load > cap + 1e-9) {
        overages.push({
          resourceId: r.id,
          resourceName: r.name,
          month: m,
          load,
          cap,
          contributors: contribList[r.id][m] ?? [],
        });
      }
    }
  }

  const legendItems = [
    { cls: "bg-emerald-50", label: "< 50%" },
    { cls: "bg-emerald-100", label: "50–85%" },
    { cls: "bg-amber-100", label: "85–100%" },
    { cls: "bg-red-200", label: "100–125%" },
    { cls: "bg-red-500", label: "> 125%" },
  ];

  const showBreakdown = !selectedProjectId;

  // Serialize inputs for client component
  const monthLabels: Record<string, string> = {};
  for (const m of horizon) monthLabels[m] = monthLabel(m);

  const resourcesLite = resources.map((r) => ({
    id: r.id,
    name: r.name,
    defaultCapacity: r.defaultCapacity,
    capabilities: r.capabilities.map((c) => ({ roleName: c.role.name })),
  }));

  // For All-projects: project list ordered by priority; for specific project: just that one.
  const projectsOrdered = selectedProjectId
    ? projectsList.filter((p) => p.id === selectedProjectId)
    : projectsList;

  const projectResources: Record<string, string[]> = {};
  for (const [pid, s] of Object.entries(projectResourcesSet)) {
    const orderedRids = resources
      .map((r) => r.id)
      .filter((rid) => s.has(rid));
    projectResources[pid] = orderedRids;
  }

  const resourceProjectAssignments: Record<string, Record<string, ResAssignment[]>> = {};
  for (const [rid, byProj] of Object.entries(rpaAcc)) {
    resourceProjectAssignments[rid] = {};
    for (const [pid, map] of Object.entries(byProj)) {
      resourceProjectAssignments[rid][pid] = Array.from(map.values());
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resource utilization</h1>
        <p className="text-sm text-slate-500">
          Per resource, per month: assigned FTE (from{" "}
          <Link href="/assignments" className="text-blue-600 hover:underline">Assignments</Link>){" "}
          against monthly capacity (default FTE plus{" "}
          <Link href="/resources" className="text-blue-600 hover:underline">per-month overrides</Link>).
          {" "}Red cells indicate over-allocation. <span className="font-medium">Click a resource</span> to expand an inline FTE editor.
        </p>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Project scope</label>
          <ProjectFilter projects={projectsList} selectedId={selectedProjectId} />
        </div>
        <div className="text-xs text-slate-500">
          {filteredToProject ? (
            <>Showing assignments from <strong>{filteredToProject.code}</strong> only.</>
          ) : (
            <>Showing all projects, grouped by project with resources nested under each.</>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Utilization heatmap</h2>
        <UtilizationTable
          horizon={horizon}
          monthLabels={monthLabels}
          resources={resourcesLite}
          projectsOrdered={projectsOrdered}
          totalLoad={totalLoad}
          capByResourceMonth={capByResourceMonth}
          projectTotal={projectTotal}
          projectResources={projectResources}
          projectLoad={projectLoad}
          resourceProjectAssignments={resourceProjectAssignments}
          showBreakdown={showBreakdown}
        />
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
          {legendItems.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className={`inline-block h-3 w-4 rounded-sm border border-slate-200 ${l.cls}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Overages ({overages.length})
          {filteredToProject ? (
            <span className="ml-2 text-xs font-normal text-slate-500">
              within {filteredToProject.code}
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-slate-500">across all projects</span>
          )}
        </h2>
        {overages.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            No resource is over capacity in any month in the current scope.
          </div>
        ) : (
          <div className="space-y-2">
            {overages
              .sort((a, b) =>
                (a.resourceName + a.month).localeCompare(b.resourceName + b.month),
              )
              .map((o) => (
                <div
                  key={`${o.resourceId}-${o.month}`}
                  className="rounded-md border border-red-200 bg-red-50 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <div className="text-red-900">
                      <span className="font-semibold">{o.resourceName}</span>
                      <span className="ml-2 font-mono text-xs">{o.month}</span>
                    </div>
                    <div className="text-xs text-red-900">
                      Assigned <span className="font-mono">{o.load.toFixed(2)}</span> /{" "}
                      Cap <span className="font-mono">{o.cap.toFixed(2)}</span> ·{" "}
                      <span className="font-semibold">
                        {(o.load - o.cap).toFixed(2)} over
                      </span>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-red-900">
                    {o.contributors.map((c, i) => (
                      <li key={i}>
                        <Link
                          href={`/assignments?project=${c.projectId}`}
                          className="font-mono text-red-800 hover:underline"
                        >
                          {c.projectCode}
                        </Link>
                        {" · "}
                        {c.projectName} · {c.phase} · {c.role} ·{" "}
                        <span className="font-mono">{c.fte.toFixed(2)} FTE</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
