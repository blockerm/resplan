"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const PhaseInput = z.object({
  name: z.string().trim().min(1, "Name required"),
  order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
});

export async function createPhase(formData: FormData) {
  const parsed = PhaseInput.parse({
    name: formData.get("name"),
    order: formData.get("order") || 0,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  await db.phase.create({ data: parsed });
  revalidatePath("/phases");
}

export async function updatePhase(id: string, formData: FormData) {
  const parsed = PhaseInput.parse({
    name: formData.get("name"),
    order: formData.get("order") || 0,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  await db.phase.update({ where: { id }, data: parsed });
  revalidatePath("/phases");
}

export async function deletePhase(id: string) {
  const used = await db.projectPhase.count({ where: { phaseId: id } });
  if (used > 0) {
    await db.phase.update({ where: { id }, data: { active: false } });
  } else {
    await db.phase.delete({ where: { id } });
  }
  revalidatePath("/phases");
}
