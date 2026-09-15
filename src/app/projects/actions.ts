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
});

function parseProjectForm(formData: FormData) {
  let constraint = (formData.get("constraint") as string) || "ASAP";
  let constraintMonth =
    constraint === "ASAP" ? null : (formData.get("constraintMonth") as string) || null;
  // Safety net: if the client somehow submitted a non-ASAP constraint without
  // a month (client-side `required` should catch this), silently fall back to
  // ASAP rather than crash. The UI can then re-render with correct state.
  if (constraint !== "ASAP" && !constraintMonth) {
    constraint = "ASAP";
    constraintMonth = null;
  }
  return ProjectInput.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    priority: formData.get("priority") || 3,
    status: formData.get("status") || "PLANNED",
    constraint,
    constraintMonth,
  });
}

export async function createProject(formData: FormData) {
  const parsed = parseProjectForm(formData);
  const created = await db.project.create({ data: parsed });
  await enforceStatusConstraints(created.id);
  revalidatePath("/projects");
  redirect(`/projects/${created.id}`);
}

export async function updateProject(id: string, formData: FormData) {
  const parsed = parseProjectForm(formData);
  await db.project.update({ where: { id }, data: parsed });
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
