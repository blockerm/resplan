import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { db } from "@/lib/db";
import {
  deletePattern,
  removePatternPhaseWeight,
  updatePattern,
  upsertPatternIntensity,
  upsertPatternPhaseWeight,
} from "../actions";
import { WeightInput } from "../WeightInput";
import { IntensityCell } from "../IntensityCell";
import { EngagementSelector } from "../EngagementSelector";
import { OrderInput } from "../OrderInput";

export const dynamic = "force-dynamic";

export default async function PatternDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pattern = await db.projectPattern.findUnique({
    where: { id: params.id },
    include: {
      phaseWeights: { include: { phase: true }, orderBy: { order: "asc" } },
      roleIntensities: { include: { role: true, phase: true } },
    },
  });
  if (!pattern) return notFound();

  const [allPhases, allRoles] = await Promise.all([
    db.phase.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    db.role.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
  ]);

  const orderedPhases = pattern.phaseWeights.map((w) => w.phase);
  const usedPhaseIds = new Set(pattern.phaseWeights.map((w) => w.phaseId));
  const availableToAdd = allPhases.filter((p) => !usedPhaseIds.has(p.id));
  const totalWeight = pattern.phaseWeights.reduce((s, w) => s + w.weightPct, 0);

  const cellByKey: Record<
    string,
    { fte: number; engagement: "CORE" | "SITUATIONAL" | "NOT_ENGAGED" }
  > = {};
  const engagementByRole: Record<string, "CORE" | "SITUATIONAL" | "NOT_ENGAGED"> = {};
  for (const it of pattern.roleIntensities) {
    cellByKey[`${it.roleId}|${it.phaseId}`] = {
      fte: it.fte,
      engagement: it.engagement as "CORE" | "SITUATIONAL" | "NOT_ENGAGED",
    };
    engagementByRole[it.roleId] = it.engagement as "CORE" | "SITUATIONAL" | "NOT_ENGAGED";
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/patterns" className="text-sm text-blue-600 hover:underline">
          ← All patterns
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{pattern.name}</h1>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <form action={updatePattern.bind(null, pattern.id)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="col-span-2">
              <label className="label">Name</label>
              <input name="name" required defaultValue={pattern.name} className="input" />
            </div>
            <div>
              <label className="label">Order</label>
              <input name="order" type="number" defaultValue={pattern.order} className="input" />
            </div>
            <div>
              <label className="label">Active</label>
              <label className="inline-flex h-9 items-center gap-1 text-sm">
                <input type="checkbox" name="active" defaultChecked={pattern.active} />
                Active
              </label>
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="label">Description</label>
              <textarea
                name="description"
                defaultValue={pattern.description ?? ""}
                className="input min-h-[48px] w-full"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary">Save</button>
            <button
              className="btn-danger"
              formAction={deletePattern.bind(null, pattern.id)}
              formNoValidate
            >
              Delete
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Phase weights</h2>
        <p className="mb-3 text-xs text-slate-500">
          Each phase&apos;s % of overall project duration. Ideally these sum to 100%.
          Editing a weight auto-saves on blur.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="table-th">Phase</th>
              <th className="table-th w-32 text-right">Weight %</th>
              <th className="table-th w-24 text-right">Order</th>
              <th className="table-th w-24"></th>
            </tr>
          </thead>
          <tbody>
            {pattern.phaseWeights.map((w) => (
              <tr key={w.id} className="border-b border-slate-100 last:border-0">
                <td className="table-td">{w.phase.name}</td>
                <td className="table-td text-right">
                  <form
                    action={upsertPatternPhaseWeight.bind(null, pattern.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <input type="hidden" name="phaseId" value={w.phaseId} />
                    <input type="hidden" name="order" value={w.order} />
                    <WeightInput defaultPct={w.weightPct} />
                    <span className="text-xs text-slate-500">%</span>
                  </form>
                </td>
                <td className="table-td text-right">
                  <form
                    action={upsertPatternPhaseWeight.bind(null, pattern.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <input type="hidden" name="phaseId" value={w.phaseId} />
                    <input type="hidden" name="weightPct" value={w.weightPct} />
                    <OrderInput defaultValue={w.order} />
                  </form>
                </td>
                <td className="table-td text-right">
                  <form action={removePatternPhaseWeight.bind(null, w.id, pattern.id)}>
                    <button className="btn-danger" formNoValidate>Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            <tr>
              <td className="table-td font-semibold">Total</td>
              <td className="table-td text-right font-mono font-semibold">
                {(totalWeight * 100).toFixed(0)}%
                {Math.abs(totalWeight - 1) > 0.001 && (
                  <span className="ml-2 text-xs font-normal text-amber-600">
                    (should be 100%)
                  </span>
                )}
              </td>
              <td /><td />
            </tr>
          </tbody>
        </table>

        {availableToAdd.length > 0 && (
          <form
            action={upsertPatternPhaseWeight.bind(null, pattern.id)}
            className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_100px_auto]"
          >
            <div>
              <label className="label">Add phase</label>
              <select name="phaseId" required className="input">
                {availableToAdd.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Weight %</label>
              <WeightInput defaultPct={0} />
            </div>
            <div>
              <label className="label">Order</label>
              <input name="order" type="number" defaultValue={pattern.phaseWeights.length} className="input text-right" />
            </div>
            <div className="flex items-end">
              <button className="btn-primary">Add phase</button>
            </div>
          </form>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Role intensity matrix</h2>
        <p className="mb-3 text-xs text-slate-500">
          FTE demand per role per phase. Editing a cell auto-saves on blur. Use the
          engagement chip to mark a role Core / Situational / Not-engaged for this
          pattern (applies to all phases in this row).
        </p>
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-600">
                Role
              </th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-center font-medium text-slate-500">
                Engagement
              </th>
              {orderedPhases.map((p) => (
                <th
                  key={p.id}
                  className="border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-500"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRoles.map((role) => {
              const eng = engagementByRole[role.id] ?? "CORE";
              const rowBg =
                eng === "NOT_ENGAGED"
                  ? "bg-slate-50/60"
                  : eng === "SITUATIONAL"
                  ? "bg-amber-50/40"
                  : "";
              return (
                <tr key={role.id} className={rowBg}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-100 bg-white px-3 py-1.5">
                    {role.name}
                  </td>
                  <td className="border-b border-r border-slate-100 px-2 py-1.5 text-center">
                    <EngagementSelector
                      patternId={pattern.id}
                      roleId={role.id}
                      current={eng}
                    />
                  </td>
                  {orderedPhases.map((ph) => {
                    const cell = cellByKey[`${role.id}|${ph.id}`];
                    return (
                      <td
                        key={ph.id}
                        className={clsx(
                          "border-b border-slate-100 px-2 py-1 text-center",
                        )}
                      >
                        <form
                          action={upsertPatternIntensity.bind(null, pattern.id)}
                          className="inline-flex items-center"
                        >
                          <input type="hidden" name="phaseId" value={ph.id} />
                          <input type="hidden" name="roleId" value={role.id} />
                          <input type="hidden" name="engagement" value={eng} />
                          <IntensityCell defaultValue={cell?.fte ?? 0} />
                        </form>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
