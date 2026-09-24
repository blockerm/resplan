"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const PatternInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

export async function createPattern(formData: FormData) {
  const parsed = PatternInput.parse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    order: formData.get("order") || 0,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  const created = await db.projectPattern.create({ data: parsed });
  revalidatePath("/patterns");
  redirect(`/patterns/${created.id}`);
}

export async function updatePattern(id: string, formData: FormData) {
  const parsed = PatternInput.parse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    order: formData.get("order") || 0,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  await db.projectPattern.update({ where: { id }, data: parsed });
  revalidatePath("/patterns");
  revalidatePath(`/patterns/${id}`);
}

export async function deletePattern(id: string) {
  const used = await db.project.count({ where: { patternId: id } });
  if (used > 0) {
    // Refuse hard delete — deactivate instead
    await db.projectPattern.update({ where: { id }, data: { active: false } });
  } else {
    await db.projectPattern.delete({ where: { id } });
  }
  revalidatePath("/patterns");
  redirect("/patterns");
}

// --- Phase weights ---

const WeightInput = z.object({
  phaseId: z.string().min(1),
  weightPct: z.coerce.number().min(0).max(1),
  order: z.coerce.number().int().default(0),
});

export async function upsertPatternPhaseWeight(patternId: string, formData: FormData) {
  const parsed = WeightInput.parse({
    phaseId: formData.get("phaseId"),
    weightPct: formData.get("weightPct"),
    order: formData.get("order"),
  });
  await db.patternPhaseWeight.upsert({
    where: {
      patternId_phaseId: { patternId, phaseId: parsed.phaseId },
    },
    update: { weightPct: parsed.weightPct, order: parsed.order },
    create: {
      patternId,
      phaseId: parsed.phaseId,
      weightPct: parsed.weightPct,
      order: parsed.order,
    },
  });
  revalidatePath(`/patterns/${patternId}`);
}

export async function removePatternPhaseWeight(id: string, patternId: string) {
  const weight = await db.patternPhaseWeight.findUnique({ where: { id } });
  if (!weight) return;
  await db.patternRoleIntensity.deleteMany({
    where: { patternId, phaseId: weight.phaseId },
  });
  await db.patternPhaseWeight.delete({ where: { id } });
  revalidatePath(`/patterns/${patternId}`);
}

// --- Intensity cells ---

const IntensityInput = z.object({
  phaseId: z.string().min(1),
  roleId: z.string().min(1),
  fte: z.coerce.number().min(0).max(10),
  engagement: z.enum(["CORE", "SITUATIONAL", "NOT_ENGAGED"]).default("CORE"),
});

export async function upsertPatternIntensity(patternId: string, formData: FormData) {
  const parsed = IntensityInput.parse({
    phaseId: formData.get("phaseId"),
    roleId: formData.get("roleId"),
    fte: formData.get("fte"),
    engagement: formData.get("engagement") || "CORE",
  });
  await db.patternRoleIntensity.upsert({
    where: {
      patternId_phaseId_roleId: {
        patternId,
        phaseId: parsed.phaseId,
        roleId: parsed.roleId,
      },
    },
    update: { fte: parsed.fte, engagement: parsed.engagement },
    create: {
      patternId,
      phaseId: parsed.phaseId,
      roleId: parsed.roleId,
      fte: parsed.fte,
      engagement: parsed.engagement,
    },
  });
  revalidatePath(`/patterns/${patternId}`);
}

// Set engagement for a whole role row (all phases) in one pattern.
export async function setRoleEngagementInPattern(
  patternId: string,
  roleId: string,
  engagement: "CORE" | "SITUATIONAL" | "NOT_ENGAGED",
) {
  await db.patternRoleIntensity.updateMany({
    where: { patternId, roleId },
    data: { engagement },
  });
  revalidatePath(`/patterns/${patternId}`);
}
