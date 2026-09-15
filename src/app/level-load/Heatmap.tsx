import { monthLabel } from "@/lib/date";
import clsx from "clsx";

type Props = {
  horizon: string[];
  roles: { id: string; name: string }[];
  demandByRole: Record<string, Record<string, number>>;
  capacityByRole: Record<string, Record<string, number>>;
  title: string;
};

function cellColor(demand: number, capacity: number): string {
  if (capacity <= 0 && demand <= 0) return "bg-slate-50 text-slate-300";
  if (capacity <= 0 && demand > 0) return "bg-red-600 text-white";
  const util = demand / capacity;
  if (util <= 0.0001) return "bg-slate-50 text-slate-300";
  if (util < 0.5) return "bg-emerald-50 text-emerald-900";
  if (util < 0.85) return "bg-emerald-100 text-emerald-900";
  if (util < 1.0) return "bg-amber-100 text-amber-900";
  if (util <= 1.0001) return "bg-amber-200 text-amber-900";
  if (util < 1.25) return "bg-red-200 text-red-900";
  return "bg-red-500 text-white";
}

export function Heatmap({ horizon, roles, demandByRole, capacityByRole, title }: Props) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-600">
                Role
              </th>
              {horizon.map((m) => (
                <th
                  key={m}
                  className="border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-500"
                >
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-slate-100 bg-white px-3 py-1.5 font-medium text-slate-700">
                  {role.name}
                </td>
                {horizon.map((m) => {
                  const d = demandByRole[role.id]?.[m] ?? 0;
                  const c = capacityByRole[role.id]?.[m] ?? 0;
                  const cls = cellColor(d, c);
                  const title = `${role.name} · ${monthLabel(m)}\nDemand ${d.toFixed(2)} / Cap ${c.toFixed(2)}`;
                  return (
                    <td
                      key={m}
                      title={title}
                      className={clsx(
                        "border-b border-slate-100 px-1.5 py-1 text-center font-mono tabular-nums",
                        cls,
                      )}
                    >
                      {d > 0 || c > 0 ? (
                        <span>
                          {d.toFixed(1)}
                          <span className="text-[10px] opacity-70">/{c.toFixed(1)}</span>
                        </span>
                      ) : (
                        "·"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <Legend cls="bg-emerald-50" label="< 50%" />
        <Legend cls="bg-emerald-100" label="50–85%" />
        <Legend cls="bg-amber-100" label="85–100%" />
        <Legend cls="bg-red-200" label="100–125%" />
        <Legend cls="bg-red-500" label="> 125%" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-4 rounded-sm border border-slate-200 ${cls}`} />
      {label}
    </span>
  );
}
