"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

function niceError(context: string, e: unknown): Error {
  // eslint-disable-next-line no-console
  console.error(`[patterns.${context}]`, e);
  if (e instanceof z.ZodError) {
    return new Error(`${context}: ${e.errors.map((x) => x.message).join(", ")}`);
  }
  if (e instanceof Error) return new Error(`${context}: ${e.message}`);
  return new Error(`${context}: unknown error`);
}

const PatternInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

export async function createPattern(formData: FormData) {
  let createdId: string;
  try {
    const parsed = PatternInput.parse({
      name: formData.get("name"),
      description: formData.get("description") || null,
      order: formData.get("order") || 0,
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });
    const created = await db.projectPattern.create({ data: parsed });
    createdId = created.id;
  } catch (e) {
    throw niceError("createPattern", e);
  }
  revalidatePath("/patterns");
  redirect(`/patterns/${createdId}`);
}

export async function updatePattern(id: string, formData: FormData) {
  try {
    const parsed = PatternInput.parse({
      name: formData.get("name"),
      description: formData.get("description") || null,
      order: formData.get("order") || 0,
      active: formData.get("active") === "on" || formData.get("active") === "true",
    });
    await db.projectPattern.update({ where: { id }, data: parsed });
  } catch (e) {
    throw niceError("updatePattern", e);
  }
  revalidatePath("/patterns");
  revalidatePath(`/patterns/${id}`);
}

export async function deletePattern(id: string) {
  try {
    const used = await db.project.count({ where: { patternId: id } });
    if (used > 0) {
      await db.projectPattern.update({ where: { id }, data: { active: false } });
    } else {
      await db.projectPattern.delete({ where: { id } });
    }
  } catch (e) {
    throw niceError("deletePattern", e);
  }
  revalidatePath("/patterns");
  redirect("/patterns");
}

const WeightInput = z.object({
  phaseId: z.string().min(1),
  weightPct: z.coerce.number().min(0).max(1),
  order: z.coerce.number().int().default(0),
});

export async function upsertPatternPhaseWeight(patternId: string, formData: FormData) {
  try {
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
  } catch (e) {
    throw niceError("upsertPatternPhaseWeight", e);
  }
  revalidatePath(`/patterns/${patternId}`);
}

export async function removePatternPhaseWeight(id: string, patternId: string) {
  try {
    const weight = await db.patternPhaseWeight.findUnique({ where: { id } });
    if (!weight) return;
    await db.patternRoleIntensity.deleteMany({
      where: { patternId, phaseId: weight.phaseId },
    });
    await db.patternPhaseWeight.delete({ where: { id } });
  } catch (e) {
    throw niceError("removePatternPhaseWeight", e);
  }
  revalidatePath(`/patterns/${patternId}`);
}

const IntensityInput = z.object({
  phaseId: z.string().min(1),
  roleId: z.string().min(1),
  fte: z.coerce.number().min(0).max(10),
  engagement: z.enum(["CORE", "SITUATIONAL", "NOT_ENGAGED"]).default("CORE"),
});

export async function upsertPatternIntensity(patternId: string, formData: FormData) {
  try {
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
  } catch (e) {
    throw niceError("upsertPatternIntensity", e);
  }
  revalidatePath(`/patterns/${patternId}`);
}

export async function setRoleEngagementInPattern(
  patternId: string,
  roleId: string,
  engagement: "CORE" | "SITUATIONAL" | "NOT_ENGAGED",
) {
  try {
    // Ensure at least one row exists for the (pattern, role) so the badge
    // reflects choice even before any cells are edited. updateMany won't
    // touch missing rows; upsert one per phase in this pattern.
    const weights = await db.patternPhaseWeight.findMany({
      where: { patternId },
      select: { phaseId: true },
    });
    for (const w of weights) {
      await db.patternRoleIntensity.upsert({
        where: {
          patternId_phaseId_roleId: {
            patternId,
            phaseId: w.phaseId,
            roleId,
          },
        },
        update: { engagement },
        create: { patternId, phaseId: w.phaseId, roleId, fte: 0, engagement },
      });
    }
  } catch (e) {
    throw niceError("setRoleEngagementInPattern", e);
  }
  revalidatePath(`/patterns/${patternId}`);
}
