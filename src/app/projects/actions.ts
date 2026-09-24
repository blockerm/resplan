"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { toMonthKey } from "@/lib/date";

// Any status other than PLANNED means the project is committed / in flight —
// its start is a fact, not a planning variable. Force MUST_START pinned to
// the earliest phase's planned start.
async function enforceStatusConstraints(projectId: string): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      phases: { orderBy: { plannedStart: "asc" }, take: 1 },
    },
  });
  if (!project) return;
  if (project.status === "PLANNED") return;
  if (project.phases.length === 0) return;
  const derivedMonth = toMonthKey(project.phases[0].plannedStart);
  if (project.constraint === "MUST_START" && project.constraintMonth === derivedMonth) return;
  await db.project.update({
    where: { id: projectId },
    data: { constraint: "MUST_START", constraintMonth: derivedMonth },
  });
}

const ProjectInput = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETE", "CANCELLED"]),
  constraint: z.enum(["ASAP", "MUST_START", "MUST_FINISH"]).default("ASAP"),
  constraintMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
    .optional()
    .nullable(),
  patternId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

function toDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseProjectForm(formData: FormData) {
  let constraint = (formData.get("constraint") as string) || "ASAP";
  let constraintMonth =
    constraint === "ASAP" ? null : (formData.get("constraintMonth") as string) || null;
  if (constraint !== "ASAP" && !constraintMonth) {
    constraint = "ASAP";
    constraintMonth = null;
  }
  const patternId = ((formData.get("patternId") as string) || "").trim() || null;
  return ProjectInput.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    priority: formData.get("priority") || 3,
    status: formData.get("status") || "PLANNED",
    constraint,
    constraintMonth,
    patternId,
    startDate: (formData.get("startDate") as string) || null,
    endDate: (formData.get("endDate") as string) || null,
  });
}

// Generate ProjectPhase + PhaseRoleDemand rows from the project's pattern.
// Wipes any existing phases and demands for the project first.
export async function generateFromPattern(projectId: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const proj = await db.project.findUnique({
    where: { id: projectId },
    include: {
      pattern: {
        include: {
          phaseWeights: { include: { phase: true }, orderBy: { order: "asc" } },
          roleIntensities: true,
        },
      },
    },
  });
  if (!proj) return { ok: false, message: "Project not found" };
  if (!proj.pattern) return { ok: false, message: "No pattern selected" };
  if (!proj.startDate || !proj.endDate)
    return { ok: false, message: "Start and end dates required" };
  if (proj.endDate <= proj.startDate)
    return { ok: false, message: "End date must be after start date" };
  const weights = proj.pattern.phaseWeights;
  if (weights.length === 0)
    return { ok: false, message: "Pattern has no phases configured" };

  // Wipe existing phases (cascades to demand + assignments)
  await db.projectPhase.deleteMany({ where: { projectId } });

  // Total inclusive day span
  const totalDays =
    Math.round(
      (proj.endDate.getTime() - proj.startDate.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
  const totalWeight = weights.reduce((s, w) => s + w.weightPct, 0);
  const norm = totalWeight > 0 ? totalWeight : 1;

  let cursor = new Date(proj.startDate);
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    const isLast = i === weights.length - 1;
    let phaseDays = Math.max(1, Math.round((w.weightPct / norm) * totalDays));
    const phaseStart = new Date(cursor);
    let phaseEnd: Date;
    if (isLast) {
      phaseEnd = new Date(proj.endDate);
    } else {
      phaseEnd = new Date(phaseStart);
      phaseEnd.setUTCDate(phaseEnd.getUTCDate() + phaseDays - 1);
    }
    const pp = await db.projectPhase.create({
      data: {
        projectId,
        phaseId: w.phaseId,
        plannedStart: phaseStart,
        plannedEnd: phaseEnd,
      },
    });

    // Role demand for this phase from the pattern's intensity matrix
    const intensities = proj.pattern.roleIntensities.filter(
      (r) => r.phaseId === w.phaseId,
    );
    for (const it of intensities) {
      if (it.engagement === "NOT_ENGAGED") continue;
      if (it.fte <= 0) continue;
      await db.phaseRoleDemand.create({
        data: { projectPhaseId: pp.id, roleId: it.roleId, fte: it.fte },
      });
    }

    cursor = new Date(phaseEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/level-load");
  return {
    ok: true,
    message: `Regenerated ${weights.length} phases + role demand from "${proj.pattern.name}".`,
  };
}

export async function createProject(formData: FormData) {
  const parsed = parseProjectForm(formData);
  const created = await db.project.create({
    data: {
      ...parsed,
      startDate: toDateOrNull(parsed.startDate),
      endDate: toDateOrNull(parsed.endDate),
    },
  });
  await enforceStatusConstraints(created.id);
  // Auto-generate phases + demand if pattern + dates were provided
  if (parsed.patternId && parsed.startDate && parsed.endDate) {
    await generateFromPattern(created.id);
  }
  revalidatePath("/projects");
  redirect(`/projects/${created.id}`);
}

export async function updateProject(id: string, formData: FormData) {
  const parsed = parseProjectForm(formData);
  await db.project.update({
    where: { id },
    data: {
      ...parsed,
      startDate: toDateOrNull(parsed.startDate),
      endDate: toDateOrNull(parsed.endDate),
    },
  });
  await enforceStatusConstraints(id);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  await db.project.delete({ where: { id } });
  revalidatePath("/projects");
  redirect("/projects");
}

// --- Phases on a project ---

const PhaseRowInput = z.object({
  phaseId: z.string().min(1),
  plannedStart: z.string().min(1),
  plannedEnd: z.string().min(1),
  note: z.string().optional().nullable(),
});

export async function upsertProjectPhase(projectId: string, formData: FormData) {
  const parsed = PhaseRowInput.parse({
    phaseId: formData.get("phaseId"),
    plannedStart: formData.get("plannedStart"),
    plannedEnd: formData.get("plannedEnd"),
    note: formData.get("note") || null,
  });
  await db.projectPhase.upsert({
    where: { projectId_phaseId: { projectId, phaseId: parsed.phaseId } },
    update: {
      plannedStart: new Date(parsed.plannedStart),
      plannedEnd: new Date(parsed.plannedEnd),
      note: parsed.note,
    },
    create: {
      projectId,
      phaseId: parsed.phaseId,
      plannedStart: new Date(parsed.plannedStart),
      plannedEnd: new Date(parsed.plannedEnd),
      note: parsed.note,
    },
  });
  await enforceStatusConstraints(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectPhase(id: string, projectId: string) {
  await db.projectPhase.delete({ where: { id } });
  await enforceStatusConstraints(projectId);
  revalidatePath(`/projects/${projectId}`);
}

// --- Demands per project-phase ---

const DemandInput = z.object({
  projectPhaseId: z.string().min(1),
  roleId: z.string().min(1),
  fte: z.coerce.number().min(0).max(10),
});

export async function upsertDemand(projectId: string, formData: FormData) {
  const parsed = DemandInput.parse({
    projectPhaseId: formData.get("projectPhaseId"),
    roleId: formData.get("roleId"),
    fte: formData.get("fte"),
  });
  if (parsed.fte === 0) {
    await db.phaseRoleDemand.deleteMany({
      where: { projectPhaseId: parsed.projectPhaseId, roleId: parsed.roleId },
    });
  } else {
    await db.phaseRoleDemand.upsert({
      where: {
        projectPhaseId_roleId: {
          projectPhaseId: parsed.projectPhaseId,
          roleId: parsed.roleId,
        },
      },
      update: { fte: parsed.fte },
      create: parsed,
    });
  }
  revalidatePath(`/projects/${projectId}`);
}

// --- Dependencies ---

const DEP_TYPES = ["FS", "SS", "FF", "SF"] as const;
type DepType = (typeof DEP_TYPES)[number];

export async function addDependency(projectId: string, formData: FormData) {
  const dependsOnId = String(formData.get("dependsOnId") ?? "");
  const lagMonths = Number(formData.get("lagMonths") ?? 0);
  const rawType = String(formData.get("type") ?? "FS");
  const type: DepType = (DEP_TYPES as readonly string[]).includes(rawType)
    ? (rawType as DepType)
    : "FS";
  if (!dependsOnId || dependsOnId === projectId) return;
  await db.dependency.upsert({
    where: { dependentId_dependsOnId: { dependentId: projectId, dependsOnId } },
    update: { lagMonths, type },
    create: { dependentId: projectId, dependsOnId, lagMonths, type },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeDependency(id: string, projectId: string) {
  await db.dependency.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}
