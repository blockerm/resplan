import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  addDependency,
  deleteProject,
  deleteProjectPhase,
  removeDependency,
  updateProject,
  upsertDemand,
  upsertProjectPhase,
} from "../actions";
import { ConstraintInputs } from "../ConstraintInputs";
import { DemandFteInput } from "../DemandFteInput";
import { PhaseDates } from "../PhaseDates";
import { GenerateFromPatternButton } from "../GenerateFromPatternButton";

export const dynamic = "force-dynamic";

function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      phases: {
        include: {
          phase: true,
          demands: { include: { role: true } },
        },
      },
      dependsOn: { include: { dependsOn: true } },
    },
  });
  if (!project) return notFound();

  const [phases, roles, allProjects, patterns] = await Promise.all([
    db.phase.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.role.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.project.findMany({
      where: { id: { not: project.id } },
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    db.projectPattern.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Order projectPhases by the underlying phase order
  const orderedProjectPhases = [...project.phases].sort(
    (a, b) => a.phase.order - b.phase.order,
  );
  const usedPhaseIds = new Set(project.phases.map((p) => p.phaseId));
  const availableToAdd = phases.filter((p) => !usedPhaseIds.has(p.id));

  // Default "Start" for the next-added phase = day after the latest existing phase's End
  const latestEnd = project.phases.reduce<Date | null>((mx, p) => {
    if (!mx || p.plannedEnd > mx) return p.plannedEnd;
    return mx;
  }, null);
  const nextStartIso = (() => {
    if (!latestEnd) return "";
    const d = new Date(latestEnd);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">
          ← All projects
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          <span className="mr-2 font-mono text-base text-slate-500">{project.code}</span>
          {project.name}
        </h1>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <form
          action={updateProject.bind(null, project.id)}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="label">Code</label>
              <input name="code" required defaultValue={project.code} className="input" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="label">Name</label>
              <input name="name" required defaultValue={project.name} className="input" />
            </div>
            <div>
              <label className="label">Priority</label>
              <input name="priority" type="number" min={1} max={5} defaultValue={project.priority} className="input" />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input" defaultValue={project.status}>
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="COMPLETE">Complete</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Pattern</label>
              <select
                name="patternId"
                className="input"
                defaultValue={project.patternId ?? ""}
              >
                <option value="">— none —</option>
                {patterns.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start date</label>
              <input
                name="startDate"
                type="date"
                defaultValue={isoDate(project.startDate)}
                className="input"
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                name="endDate"
                type="date"
                defaultValue={isoDate(project.endDate)}
                className="input"
              />
            </div>
            <ConstraintInputs
              defaultConstraint={project.constraint}
              defaultConstraintMonth={project.constraintMonth}
              locked={project.status !== "PLANNED"}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              defaultValue={project.description ?? ""}
              className="input mt-1 min-h-[64px] w-full"
              placeholder="Optional narrative"
            />
          </div>

          <div className="flex gap-2">
            <button className="btn-primary">Save</button>
            <button className="btn-danger" formAction={deleteProject.bind(null, project.id)} formNoValidate>
              Delete
            </button>
          </div>
        </form>

        {project.patternId && project.startDate && project.endDate && (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            <span>
              This project has a pattern selected. Click regenerate to (re)build phases
              + role demand from the pattern — this <strong>replaces</strong> current
              phases, demand, and any manual FTE adjustments.
            </span>
            <GenerateFromPatternButton projectId={project.id} />
          </div>
        )}

        {project.status !== "PLANNED" && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Status is <strong>{project.status}</strong>: constraint is auto-locked to
            <strong> Must start on {project.constraintMonth ?? "(pending first phase)"}</strong>.
            The solver cannot move this project. Set status back to <em>Planned</em> to unlock.
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Phases & role demand</h2>

        {orderedProjectPhases.length === 0 && (
          <div className="mb-3 text-sm text-slate-500">No phases added yet.</div>
        )}

        <div className="space-y-4">
          {orderedProjectPhases.map((pp) => (
            <div key={pp.id} className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-sm font-semibold">
                  {pp.phase.name}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {isoDate(pp.plannedStart)} → {isoDate(pp.plannedEnd)}
                  </span>
                </div>
              </div>

              <form
                action={upsertProjectPhase.bind(null, project.id)}
                className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[160px_140px_160px_1fr_auto_auto]"
              >
                <input type="hidden" name="phaseId" value={pp.phaseId} />
                <PhaseDates
                  defaultStart={isoDate(pp.plannedStart)}
                  defaultEnd={isoDate(pp.plannedEnd)}
                  required
                />
                <div>
                  <label className="label">Note</label>
                  <input name="note" defaultValue={pp.note ?? ""} className="input" />
                </div>
                <div className="flex items-end">
                  <button className="btn">Save phase</button>
                </div>
                <div className="flex items-end">
                  <button
                    className="btn-danger"
                    formAction={deleteProjectPhase.bind(null, pp.id, project.id)}
                    formNoValidate
                  >
                    Remove
                  </button>
                </div>
              </form>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role demand (FTE)
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {roles.map((role) => {
                    const existing = pp.demands.find((d) => d.roleId === role.id);
                    return (
                      <form
                        key={role.id}
                        action={upsertDemand.bind(null, project.id)}
                        className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1"
                      >
                        <input type="hidden" name="projectPhaseId" value={pp.id} />
                        <input type="hidden" name="roleId" value={role.id} />
                        <div className="flex-1 text-sm">{role.name}</div>
                        <DemandFteInput defaultValue={existing?.fte ?? 0} />
                      </form>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {availableToAdd.length > 0 && (
          <form
            action={upsertProjectPhase.bind(null, project.id)}
            className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[200px_160px_140px_160px_1fr_auto]"
          >
            <div>
              <label className="label">Add phase</label>
              <select name="phaseId" required className="input">
                {availableToAdd.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <PhaseDates defaultStart={nextStartIso} required />
            <div>
              <label className="label">Note</label>
              <input name="note" className="input" />
            </div>
            <div className="flex items-end">
              <button className="btn-primary w-full md:w-auto">Add phase</button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Dependencies</h2>
        <p className="mb-3 text-xs text-slate-500">
          Predecessor projects that constrain when this project can start or finish.
          <br />
          <span className="font-medium">FS</span> finish-to-start (default) ·
          {" "}<span className="font-medium">SS</span> start-to-start ·
          {" "}<span className="font-medium">FF</span> finish-to-finish ·
          {" "}<span className="font-medium">SF</span> start-to-finish.
          Lag is in months (negative = lead).
        </p>

        {project.dependsOn.length === 0 ? (
          <div className="mb-3 text-sm text-slate-500">None.</div>
        ) : (
          <ul className="mb-3 space-y-1">
            {project.dependsOn.map((d) => (
              <li key={d.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-slate-500">{d.dependsOn.code}</span>
                <span className="flex-1">{d.dependsOn.name}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                  {d.type}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {d.lagMonths === 0
                    ? "no lag"
                    : d.lagMonths > 0
                    ? `+${d.lagMonths} mo`
                    : `${d.lagMonths} mo`}
                </span>
                <form action={removeDependency.bind(null, d.id, project.id)}>
                  <button className="btn-danger">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addDependency.bind(null, project.id)}
          className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_100px_120px_auto]"
        >
          <select name="dependsOnId" required className="input">
            <option value="">Depends on…</option>
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <select name="type" className="input" defaultValue="FS">
            <option value="FS">FS</option>
            <option value="SS">SS</option>
            <option value="FF">FF</option>
            <option value="SF">SF</option>
          </select>
          <input
            name="lagMonths"
            type="number"
            defaultValue={0}
            placeholder="Lag (mo)"
            className="input"
          />
          <button className="btn-primary">Add dependency</button>
        </form>
      </div>
    </div>
  );
}
