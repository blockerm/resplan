import { db } from "@/lib/db";
import { addMonths, monthsBetween, toMonthKey } from "@/lib/date";

// ---------- Types ----------

export type SolveInput = {
  horizonStart: string; // 'YYYY-MM'
  horizonEnd: string;   // 'YYYY-MM'
};

export type PhasePlacement = {
  projectPhaseId: string;
  phaseId: string;
  phaseName: string;
  phaseOrder: number;
  startMonth: string;
  endMonth: string;
  months: string[];
  monthlyFteByRole: Record<string, number>; // roleId -> fte per month
};

export type SolvedProject = {
  projectId: string;
  code: string;
  name: string;
  priority: number;
  constraint: string;                    // "ASAP" | "MUST_START" | "MUST_FINISH"
  constraintMonth: string | null;
  shiftMonths: number; // how many months we shifted the project as a whole
  // Hard failure: the plan cannot execute as configured (capacity unfittable
  // within horizon, MUST_START collides with capacity/dependency, dependency
  // pushes past horizon, MUST_FINISH exceeded).
  infeasible: boolean;
  infeasibleReason?: string;
  bottleneck?: { roleId: string; roleName: string; month: string; shortfallFte: number };
  phases: PhasePlacement[];
};

export type SolveResult = {
  horizon: string[];               // month keys
  roles: { id: string; name: string }[];
  capacityByRole: Record<string, Record<string, number>>; // roleId -> month -> fte
  demandByRole: Record<string, Record<string, number>>;   // roleId -> month -> fte (post-solve)
  preSolveDemandByRole: Record<string, Record<string, number>>; // roleId -> month -> fte (as configured)
  projects: SolvedProject[];
};

// ---------- Helpers ----------

function dateToMonthKey(d: Date): string {
  return toMonthKey(d);
}

function clampToHorizon(month: string, start: string, end: string): string {
  if (month < start) return start;
  if (month > end) return end;
  return month;
}

function ensure(obj: Record<string, Record<string, number>>, roleId: string) {
  if (!obj[roleId]) obj[roleId] = {};
  return obj[roleId];
}

// ---------- Loaders ----------

async function loadCapacity(
  months: string[],
): Promise<{
  roles: { id: string; name: string }[];
  capacityByRole: Record<string, Record<string, number>>;
}> {
  const rolesFull = await db.role.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  const roles = rolesFull.map((r) => ({ id: r.id, name: r.name }));

  // Per-role capacity per month is Role.defaultCapacity. Named resources are a
  // separate concern — they're used for post-solve assignment/utilization, not
  // to compute solver capacity.
  const capacityByRole: Record<string, Record<string, number>> = {};
  for (const role of rolesFull) {
    capacityByRole[role.id] = {};
    for (const month of months) capacityByRole[role.id][month] = role.defaultCapacity;
  }

  return { roles, capacityByRole };
}

async function loadPreSolveDemand(
  months: string[],
): Promise<{
  demandByRole: Record<string, Record<string, number>>;
  projectPhaseDemands: {
    projectPhaseId: string;
    projectId: string;
    startMonth: string;
    endMonth: string;
    demand: Record<string, number>; // roleId -> fte
  }[];
}> {
  const projectPhases = await db.projectPhase.findMany({
    include: {
      demands: true,
    },
  });

  const demandByRole: Record<string, Record<string, number>> = {};
  const projectPhaseDemands = projectPhases.map((pp) => {
    const startMonth = dateToMonthKey(pp.plannedStart);
    const endMonth = dateToMonthKey(pp.plannedEnd);
    const demand: Record<string, number> = {};
    for (const d of pp.demands) demand[d.roleId] = d.fte;
    for (const month of monthsBetween(startMonth, endMonth)) {
      if (month < months[0] || month > months[months.length - 1]) continue;
      for (const [roleId, fte] of Object.entries(demand)) {
        const row = ensure(demandByRole, roleId);
        row[month] = (row[month] ?? 0) + fte;
      }
    }
    return {
      projectPhaseId: pp.id,
      projectId: pp.projectId,
      startMonth,
      endMonth,
      demand,
    };
  });

  return { demandByRole, projectPhaseDemands };
}

// ---------- Solver ----------

// Compute placement for a project given its earliest allowed start month.
// Preserves the *original* month-length of each phase. Shifts every phase by
// the same offset relative to its planned start, so relative phase order and
// durations are preserved.
function placeProject(opts: {
  phases: {
    id: string;
    phaseId: string;
    phaseName: string;
    phaseOrder: number;
    startMonth: string;
    endMonth: string;
    demand: Record<string, number>;
  }[];
  shiftMonths: number;
}): PhasePlacement[] {
  return opts.phases.map((p) => {
    const startMonth = addMonths(p.startMonth, opts.shiftMonths);
    const endMonth = addMonths(p.endMonth, opts.shiftMonths);
    const months = monthsBetween(startMonth, endMonth);
    return {
      projectPhaseId: p.id,
      phaseId: p.phaseId,
      phaseName: p.phaseName,
      phaseOrder: p.phaseOrder,
      startMonth,
      endMonth,
      months,
      monthlyFteByRole: p.demand,
    };
  });
}

// Given a proposed set of placements for a project, return the first month
// where *any* role would exceed capacity (aggregated with alreadyLoaded demand).
function findFirstOverage(
  placements: PhasePlacement[],
  alreadyLoaded: Record<string, Record<string, number>>,
  capacityByRole: Record<string, Record<string, number>>,
): { roleId: string; month: string; overFte: number } | null {
  for (const p of placements) {
    for (const month of p.months) {
      for (const [roleId, fte] of Object.entries(p.monthlyFteByRole)) {
        if (fte <= 0) continue;
        const existing = alreadyLoaded[roleId]?.[month] ?? 0;
        const cap = capacityByRole[roleId]?.[month] ?? 0;
        if (existing + fte > cap + 1e-9) {
          return { roleId, month, overFte: existing + fte - cap };
        }
      }
    }
  }
  return null;
}

function addPlacementsToLoad(
  placements: PhasePlacement[],
  loaded: Record<string, Record<string, number>>,
) {
  for (const p of placements) {
    for (const month of p.months) {
      for (const [roleId, fte] of Object.entries(p.monthlyFteByRole)) {
        if (fte <= 0) continue;
        const row = ensure(loaded, roleId);
        row[month] = (row[month] ?? 0) + fte;
      }
    }
  }
}

export async function solve(opts: SolveInput): Promise<SolveResult> {
  const horizon = monthsBetween(opts.horizonStart, opts.horizonEnd);

  const { roles, capacityByRole } = await loadCapacity(horizon);
  const { demandByRole: preSolveDemandByRole } = await loadPreSolveDemand(horizon);

  const roleNameById: Record<string, string> = Object.fromEntries(
    roles.map((r) => [r.id, r.name]),
  );

  // Load projects with phases + demands + dependencies
  const projects = await db.project.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE"] } },
    include: {
      phases: {
        include: { phase: true, demands: true },
        orderBy: { phase: { order: "asc" } },
      },
      dependsOn: true,
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  // Solved state per project (post-solve): first-phase start month and last-phase end month
  const projectSolvedStartMonth: Record<string, string> = {};
  const projectSolvedEndMonth: Record<string, string> = {};
  // Solved load: every placed project contributes (feasible or not), so
  // successor projects plan around infeasible peers' demand.
  const solvedLoad: Record<string, Record<string, number>> = {};
  const solvedProjects: SolvedProject[] = [];

  // Given a predecessor's solved bounds and a dep type/lag, compute the minimum
  // shift this successor project needs so the constraint holds. Uses the
  // successor's original bounds so we can express the shift in months.
  function minShiftFromDep(
    predStart: string,
    predEnd: string,
    successorOrigFirstStart: string,
    successorOrigLastEnd: string,
    type: string,
    lag: number,
  ): number {
    switch (type) {
      case "SS":
        // firstStart(succ) >= predStart + lag
        return monthDiff(successorOrigFirstStart, predStart) + lag;
      case "FF":
        // lastEnd(succ) >= predEnd + lag
        return monthDiff(successorOrigLastEnd, predEnd) + lag;
      case "SF":
        // lastEnd(succ) >= predStart + lag
        return monthDiff(successorOrigLastEnd, predStart) + lag;
      case "FS":
      default:
        // firstStart(succ) >= predEnd + 1 + lag  (next month after predecessor finishes)
        return monthDiff(successorOrigFirstStart, predEnd) + 1 + lag;
    }
  }

  for (const proj of projects) {
    // Non-PLANNED projects are treated as MUST_START pinned to their earliest
    // planned phase, regardless of the stored constraint — the project is committed.
    let constraint = (proj.constraint ?? "ASAP") as "ASAP" | "MUST_START" | "MUST_FINISH";
    let constraintMonth = proj.constraintMonth ?? null;
    if (proj.status !== "PLANNED" && proj.phases.length > 0) {
      const earliest = proj.phases
        .map((p) => dateToMonthKey(p.plannedStart))
        .reduce((a, b) => (a < b ? a : b));
      constraint = "MUST_START";
      constraintMonth = earliest;
    }

    if (proj.phases.length === 0) {
      solvedProjects.push({
        projectId: proj.id,
        code: proj.code,
        name: proj.name,
        priority: proj.priority,
        constraint,
        constraintMonth,
        shiftMonths: 0,
        infeasible: false,
        phases: [],
      });
      projectSolvedEndMonth[proj.id] = opts.horizonStart;
      continue;
    }

    // Base phases sorted by phase order
    const basePhases = proj.phases.map((pp) => ({
      id: pp.id,
      phaseId: pp.phaseId,
      phaseName: pp.phase.name,
      phaseOrder: pp.phase.order,
      startMonth: dateToMonthKey(pp.plannedStart),
      endMonth: dateToMonthKey(pp.plannedEnd),
      demand: Object.fromEntries(pp.demands.map((d) => [d.roleId, d.fte])),
    }));

    const originalFirstStart = basePhases.reduce(
      (min, p) => (p.startMonth < min ? p.startMonth : min),
      basePhases[0].startMonth,
    );
    const originalLastEnd = basePhases.reduce(
      (max, p) => (p.endMonth > max ? p.endMonth : max),
      basePhases[0].endMonth,
    );

    // Minimum shift required by all dependencies (max across deps). Applied to the
    // successor's original firstStart. Only planned/active predecessors count;
    // ignore missing (unplanned or infeasible) predecessors.
    let depsMinShift = 0;
    for (const dep of proj.dependsOn) {
      const predStart = projectSolvedStartMonth[dep.dependsOnId];
      const predEnd = projectSolvedEndMonth[dep.dependsOnId];
      if (!predStart || !predEnd) continue;
      const shift = minShiftFromDep(
        predStart,
        predEnd,
        originalFirstStart,
        originalLastEnd,
        dep.type ?? "FS",
        dep.lagMonths ?? 0,
      );
      if (shift > depsMinShift) depsMinShift = shift;
    }
    // The dependency-derived earliest start of the first phase, expressed as a month key.
    const depsEarliestStart = addMonths(originalFirstStart, Math.max(0, depsMinShift));

    // Compute final placement + infeasibility per constraint. Both feasible and
    // infeasible projects always contribute to solvedLoad and record their
    // solved start/end — an infeasible project is still planned, so its
    // demand and end month should still constrain subsequent projects.

    let shiftMonths: number;
    let placements: PhasePlacement[];
    let infeasible = false;
    let infeasibleReason: string | undefined;
    let bottleneck: SolvedProject["bottleneck"];

    if (constraint === "MUST_START" && constraintMonth) {
      shiftMonths = monthDiff(originalFirstStart, constraintMonth);
      placements = placeProject({ phases: basePhases, shiftMonths });

      if (constraintMonth < depsEarliestStart) {
        infeasible = true;
        infeasibleReason = `Must-start ${constraintMonth} is earlier than the earliest month allowed by dependencies (${depsEarliestStart}).`;
      }
      const overage = findFirstOverage(placements, solvedLoad, capacityByRole);
      if (overage) {
        infeasible = true;
        infeasibleReason =
          infeasibleReason ??
          `Must-start ${constraintMonth} conflicts with role capacity; solver isn't allowed to shift.`;
        bottleneck = {
          roleId: overage.roleId,
          roleName: roleNameById[overage.roleId] ?? overage.roleId,
          month: overage.month,
          shortfallFte: overage.overFte,
        };
      }
    } else {
      // ASAP or MUST_FINISH — shift right as needed to fit capacity.
      // Cap at the planning horizon; if MUST_FINISH, additionally cap so
      // the finish stays on/before constraintMonth.
      shiftMonths = Math.max(0, depsMinShift);
      const horizonMaxShift = monthDiff(originalLastEnd, opts.horizonEnd);
      const mustFinishCap =
        constraint === "MUST_FINISH" && constraintMonth
          ? Math.max(0, monthDiff(originalLastEnd, constraintMonth))
          : Infinity;
      const hardMax = Math.min(horizonMaxShift, mustFinishCap);

      placements = placeProject({ phases: basePhases, shiftMonths });
      let overage = findFirstOverage(placements, solvedLoad, capacityByRole);
      let iterations = 0;
      while (overage && shiftMonths < hardMax && iterations < 240) {
        shiftMonths += 1;
        placements = placeProject({ phases: basePhases, shiftMonths });
        overage = findFirstOverage(placements, solvedLoad, capacityByRole);
        iterations += 1;
      }
      if (overage) {
        infeasible = true;
        infeasibleReason =
          constraint === "MUST_FINISH" && constraintMonth
            ? `No shift within must-finish (${constraintMonth}) clears all role capacity conflicts.`
            : `No shift within the planning horizon clears all role capacity conflicts.`;
        bottleneck = {
          roleId: overage.roleId,
          roleName: roleNameById[overage.roleId] ?? overage.roleId,
          month: overage.month,
          shortfallFte: overage.overFte,
        };
      }

      // MUST_FINISH: if the resolved finish exceeds constraintMonth, that's a
      // hard failure too (loop terminated early due to hardMax cap).
      if (constraint === "MUST_FINISH" && constraintMonth) {
        const finalLastEnd = placements.reduce(
          (max, p) => (p.endMonth > max ? p.endMonth : max),
          placements[0].endMonth,
        );
        if (finalLastEnd > constraintMonth) {
          infeasible = true;
          const reason = `Finish (${finalLastEnd}) is past must-finish (${constraintMonth}).`;
          infeasibleReason = infeasibleReason ? `${infeasibleReason} Also: ${reason}` : reason;
        }
      }
    }

    // Commit: always add to solvedLoad, always record solved bounds. Infeasible
    // projects are still planned — successor projects should still plan around
    // their demand and end month.
    addPlacementsToLoad(placements, solvedLoad);
    const firstStart = placements.reduce(
      (min, p) => (p.startMonth < min ? p.startMonth : min),
      placements[0].startMonth,
    );
    const lastEnd = placements.reduce(
      (max, p) => (p.endMonth > max ? p.endMonth : max),
      placements[0].endMonth,
    );
    projectSolvedStartMonth[proj.id] = firstStart;
    projectSolvedEndMonth[proj.id] = lastEnd;

    solvedProjects.push({
      projectId: proj.id,
      code: proj.code,
      name: proj.name,
      priority: proj.priority,
      constraint,
      constraintMonth,
      shiftMonths,
      infeasible,
      infeasibleReason,
      bottleneck,
      phases: placements,
    });
  }

  // Zero-fill demand map for horizon so heatmap cells all render
  const demandByRole: Record<string, Record<string, number>> = {};
  for (const role of roles) {
    demandByRole[role.id] = {};
    for (const m of horizon) {
      demandByRole[role.id][m] = solvedLoad[role.id]?.[m] ?? 0;
    }
  }
  for (const role of roles) {
    if (!preSolveDemandByRole[role.id]) preSolveDemandByRole[role.id] = {};
    for (const m of horizon) {
      preSolveDemandByRole[role.id][m] = preSolveDemandByRole[role.id][m] ?? 0;
    }
  }

  return {
    horizon,
    roles,
    capacityByRole,
    demandByRole,
    preSolveDemandByRole,
    projects: solvedProjects,
  };
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// Persist solvedStart/solvedEnd back to ProjectPhase rows
export async function persistSolve(result: SolveResult): Promise<void> {
  // First clear all previous solves so removed placements don't linger
  await db.projectPhase.updateMany({
    data: { solvedStart: null, solvedEnd: null },
  });

  for (const proj of result.projects) {
    for (const p of proj.phases) {
      const startDate = new Date(`${p.startMonth}-01T00:00:00Z`);
      const endDate = new Date(`${p.endMonth}-01T00:00:00Z`);
      // set to first of end month for simplicity; month is the unit of truth
      await db.projectPhase.update({
        where: { id: p.projectPhaseId },
        data: { solvedStart: startDate, solvedEnd: endDate },
      });
    }
  }
}
