"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  removePhaseAssignment,
  setPhaseAssignment,
} from "@/app/assignments/actions";

type ResAssignment = {
  projectPhaseId: string;
  phaseName: string;
  phaseOrder: number;
  roleId: string;
  roleName: string;
  ftePerMonth: number;
};

type ResourceLite = {
  id: string;
  name: string;
  defaultCapacity: number;
  capabilities: { roleName: string }[];
};

type ProjectLite = { id: string; code: string; name: string };

type Props = {
  horizon: string[];
  monthLabels: Record<string, string>;
  resources: ResourceLite[];
  projectsOrdered: ProjectLite[];
  totalLoad: Record<string, Record<string, number>>;
  capByResourceMonth: Record<string, Record<string, number>>;
  projectTotal: Record<string, Record<string, number>>;
  projectResources: Record<string, string[]>;
  projectLoad: Record<string, Record<string, Record<string, number>>>;
  resourceProjectAssignments: Record<string, Record<string, ResAssignment[]>>;
  showBreakdown: boolean;
};

function cellColor(load: number, cap: number): string {
  if (cap <= 0 && load <= 0) return "bg-slate-50 text-slate-300";
  if (cap <= 0 && load > 0) return "bg-red-600 text-white";
  const util = load / cap;
  if (util <= 0.0001) return "bg-slate-50 text-slate-300";
  if (util < 0.5) return "bg-emerald-50 text-emerald-900";
  if (util < 0.85) return "bg-emerald-100 text-emerald-900";
  if (util < 1.0) return "bg-amber-100 text-amber-900";
  if (util <= 1.0001) return "bg-amber-200 text-amber-900";
  if (util < 1.25) return "bg-red-200 text-red-900";
  return "bg-red-500 text-white";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={clsx(
        "inline-block h-3 w-3 shrink-0 transition-transform",
        open ? "rotate-90" : "",
      )}
    >
      ▸
    </span>
  );
}

export function UtilizationTable(props: Props) {
  const {
    horizon,
    monthLabels,
    resources,
    projectsOrdered,
    totalLoad,
    capByResourceMonth,
    projectTotal,
    projectResources,
    projectLoad,
    resourceProjectAssignments,
    showBreakdown,
  } = props;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleKey = (k: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const colCount = horizon.length + 2;

  function editorRow(
    key: string,
    resource: ResourceLite,
    projectId: string,
  ) {
    const list = resourceProjectAssignments[resource.id]?.[projectId] ?? [];
    return (
      <tr key={`edit-${key}`}>
        <td colSpan={colCount} className="bg-blue-50/40 px-6 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Adjust {resource.name}&apos;s assignments in this project
          </div>
          {list.length === 0 ? (
            <div className="mt-2 text-xs text-slate-500">
              No assignments to edit here. Add one from the{" "}
              <Link
                href={`/assignments?project=${projectId}`}
                className="text-blue-600 hover:underline"
              >
                Assignments page
              </Link>
              .
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {list
                .slice()
                .sort((a, b) => a.phaseOrder - b.phaseOrder)
                .map((a) => (
                  <li
                    key={`${a.projectPhaseId}-${a.roleId}`}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-2 rounded bg-white px-2 py-1.5 text-sm shadow-sm"
                  >
                    <span className="font-medium">{a.phaseName}</span>
                    <span className="text-slate-600">{a.roleName}</span>
                    <form action={setPhaseAssignment} className="flex items-center gap-1">
                      <input type="hidden" name="projectPhaseId" value={a.projectPhaseId} />
                      <input type="hidden" name="roleId" value={a.roleId} />
                      <input type="hidden" name="resourceId" value={resource.id} />
                      <label className="text-xs text-slate-500">FTE</label>
                      <input
                        name="fte"
                        type="number"
                        step="0.05"
                        min={0}
                        max={10}
                        defaultValue={a.ftePerMonth}
                        className="input w-24"
                        aria-label="FTE"
                      />
                      <button className="btn" type="submit">Save</button>
                    </form>
                    <form
                      action={removePhaseAssignment.bind(
                        null,
                        a.projectPhaseId,
                        a.roleId,
                        resource.id,
                      )}
                    >
                      <button className="btn-danger">Remove</button>
                    </form>
                    <Link
                      href={`/assignments?project=${projectId}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      More…
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-600">
              {showBreakdown ? "Project / Resource" : "Resource"}
            </th>
            <th className="border-b border-r border-slate-200 px-2 py-2 text-center font-medium text-slate-500">
              Cap
            </th>
            {horizon.map((m) => (
              <th
                key={m}
                className="border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-500"
              >
                {monthLabels[m]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showBreakdown
            ? (() => {
                const ids = projectsOrdered
                  .map((p) => p.id)
                  .filter((pid) => (projectResources[pid] ?? []).length > 0);
                if (ids.length === 0) {
                  return (
                    <tr>
                      <td colSpan={colCount} className="p-4 text-center text-slate-500">
                        No assignments yet.
                      </td>
                    </tr>
                  );
                }
                return ids.flatMap((pid) => {
                  const meta = projectsOrdered.find((p) => p.id === pid)!;
                  const parentRow = (
                    <tr key={`proj-${pid}`} className="bg-slate-100/70">
                      <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-200 bg-slate-100/70 px-3 py-1.5">
                        <Link href={`/assignments?project=${pid}`} className="hover:underline">
                          <span className="mr-2 font-mono text-[10px] text-slate-500">
                            {meta.code}
                          </span>
                          <span className="font-semibold text-slate-800">{meta.name}</span>
                        </Link>
                      </td>
                      <td className="border-b border-r border-slate-200 bg-slate-100/70 px-2 py-1.5 text-center text-slate-400">
                        —
                      </td>
                      {horizon.map((m) => {
                        const total = projectTotal[pid]?.[m] ?? 0;
                        return (
                          <td
                            key={m}
                            className="border-b border-slate-100 bg-slate-100/70 px-1.5 py-1 text-center font-mono font-semibold tabular-nums text-slate-800"
                            title={`${meta.code} · ${monthLabels[m]}\nTotal ${total.toFixed(2)} FTE`}
                          >
                            {total > 0 ? total.toFixed(1) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  );

                  const rids = projectResources[pid] ?? [];
                  const childRows = rids.flatMap((rid) => {
                    const r = resources.find((x) => x.id === rid);
                    if (!r) return [];
                    const key = `${rid}:${pid}`;
                    const open = expanded.has(key);
                    const row = (
                      <tr key={`proj-${pid}-res-${rid}`}>
                        <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-100 bg-white px-3 py-1 pl-8 text-slate-700">
                          <button
                            type="button"
                            onClick={() => toggleKey(key)}
                            className="inline-flex items-center gap-1 hover:text-blue-700"
                            title="Show inline editor"
                          >
                            <Chevron open={open} />
                            <span className="font-medium">{r.name}</span>
                          </button>
                          <span className="ml-2 text-[10px] text-slate-500">
                            {r.capabilities.map((c) => c.roleName).join(", ")}
                          </span>
                        </td>
                        <td className="border-b border-r border-slate-100 bg-white px-2 py-1 text-center font-mono text-slate-500">
                          {r.defaultCapacity.toFixed(2)}
                        </td>
                        {horizon.map((m) => {
                          const load = projectLoad[rid]?.[pid]?.[m] ?? 0;
                          const totalRes = totalLoad[rid]?.[m] ?? 0;
                          const cap = capByResourceMonth[rid]?.[m] ?? 0;
                          const overCls =
                            totalRes > cap + 1e-9 && load > 0
                              ? "bg-red-100 text-red-900"
                              : "text-slate-700";
                          return (
                            <td
                              key={m}
                              className={clsx(
                                "border-b border-slate-100 bg-white px-1.5 py-1 text-center font-mono tabular-nums",
                                overCls,
                              )}
                              title={`${r.name} · ${monthLabels[m]}\nThis project: ${load.toFixed(2)} FTE\nTotal across projects: ${totalRes.toFixed(2)} / ${cap.toFixed(2)}`}
                            >
                              {load > 0 ? load.toFixed(1) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                    if (open) return [row, editorRow(key, r, pid)];
                    return [row];
                  });

                  return [parentRow, ...childRows];
                });
              })()
            : resources.flatMap((r) => {
                // Specific-project mode: each resource has one row, expandable to
                // edit their assignments in the selected project (there's only one).
                const projectId = projectsOrdered[0]?.id; // caller passes only the selected project
                const key = `${r.id}:${projectId ?? ""}`;
                const open = expanded.has(key);
                const row = (
                  <tr key={r.id} className="bg-slate-50/60">
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-200 bg-slate-50/60 px-3 py-1.5">
                      {projectId ? (
                        <button
                          type="button"
                          onClick={() => toggleKey(key)}
                          className="inline-flex items-center gap-1 hover:text-blue-700"
                          title="Show inline editor"
                        >
                          <Chevron open={open} />
                          <span className="font-semibold text-slate-800">{r.name}</span>
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-800">{r.name}</span>
                      )}
                      <div className="text-[10px] text-slate-500">
                        {r.capabilities.length > 0
                          ? r.capabilities.map((c) => c.roleName).join(", ")
                          : "— no capabilities —"}
                      </div>
                    </td>
                    <td className="border-b border-r border-slate-200 px-2 py-1.5 text-center font-mono text-slate-700">
                      {r.defaultCapacity.toFixed(2)}
                    </td>
                    {horizon.map((m) => {
                      const load = totalLoad[r.id]?.[m] ?? 0;
                      const cap = capByResourceMonth[r.id]?.[m] ?? 0;
                      const cls = cellColor(load, cap);
                      const title = `${r.name} · ${monthLabels[m]}\nAssigned ${load.toFixed(2)} / Cap ${cap.toFixed(2)}`;
                      return (
                        <td
                          key={m}
                          title={title}
                          className={clsx(
                            "border-b border-slate-100 px-1.5 py-1 text-center font-mono font-semibold tabular-nums",
                            cls,
                          )}
                        >
                          {load > 0 || cap > 0 ? (
                            <span>
                              {load.toFixed(1)}
                              <span className="text-[10px] opacity-70">/{cap.toFixed(1)}</span>
                            </span>
                          ) : (
                            "·"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
                if (open && projectId) return [row, editorRow(key, r, projectId)];
                return [row];
              })}
          {resources.length === 0 && (
            <tr>
              <td colSpan={colCount} className="p-4 text-center text-slate-500">
                No active resources.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
