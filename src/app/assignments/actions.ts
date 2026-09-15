"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toMonthKey, monthsBetween } from "@/lib/date";
import { z } from "zod";

const AssignInput = z.object({
  projectPhaseId: z.string().min(1),
  roleId: z.string().min(1),
  resourceId: z.string().min(1),
  fte: z.coerce.number().min(0).max(10),
});

// Sets a resource's assignment to a single FTE across every month of the phase.
// If fte === 0, removes the assignment entirely.
export async function setPhaseAssignment(formData: FormData) {
  const parsed = AssignInput.parse({
    projectPhaseId: formData.get("projectPhaseId"),
    roleId: formData.get("roleId"),
    resourceId: formData.get("resourceId"),
    fte: formData.get("fte"),
  });

  await db.assignment.deleteMany({
    where: {
      projectPhaseId: parsed.projectPhaseId,
      roleId: parsed.roleId,
      resourceId: parsed.resourceId,
    },
  });

  if (parsed.fte > 0) {
    const pp = await db.projectPhase.findUnique({
      where: { id: parsed.projectPhaseId },
      select: { plannedStart: true, plannedEnd: true, solvedStart: true, solvedEnd: true },
    });
    if (!pp) return;
    // Prefer solved months if present, else planned
    const startD = pp.solvedStart ?? pp.plannedStart;
    const endD = pp.solvedEnd ?? pp.plannedEnd;
    const months = monthsBetween(toMonthKey(startD), toMonthKey(endD));
    for (const month of months) {
      await db.assignment.create({
        data: {
          projectPhaseId: parsed.projectPhaseId,
          roleId: parsed.roleId,
          resourceId: parsed.resourceId,
          month,
          fte: parsed.fte,
        },
      });
    }
  }

  revalidatePath("/assignments");
  revalidatePath("/utilization");
}

export async function removePhaseAssignment(
  projectPhaseId: string,
  roleId: string,
  resourceId: string,
) {
  await db.assignment.deleteMany({
    where: { projectPhaseId, roleId, resourceId },
  });
  revalidatePath("/assignments");
  revalidatePath("/utilization");
}
