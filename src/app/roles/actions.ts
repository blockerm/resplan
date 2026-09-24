"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RoleInput = z.object({
  name: z.string().trim().min(1, "Name required"),
  description: z.string().trim().optional().nullable(),
  order: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(true),
  defaultCapacity: z.coerce.number().min(0).max(100).default(0),
});

export async function createRole(formData: FormData) {
  const parsed = RoleInput.parse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    order: formData.get("order") || 0,
    active: formData.get("active") === "on" || formData.get("active") === "true",
    defaultCapacity: formData.get("defaultCapacity") || 0,
  });
  await db.role.create({ data: parsed });
  revalidatePath("/roles");
}

export async function updateRole(id: string, formData: FormData) {
  const parsed = RoleInput.parse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    order: formData.get("order") || 0,
    active: formData.get("active") === "on" || formData.get("active") === "true",
    defaultCapacity: formData.get("defaultCapacity") || 0,
  });
  await db.role.update({ where: { id }, data: parsed });
  revalidatePath("/roles");
}

export async function deleteRole(id: string) {
  // Role is referenced by PhaseRoleDemand, ResourceCapability, Assignment,
  // and PatternRoleIntensity. Any reference means we can't hard-delete.
  const [demand, capability, assign, patternUse] = await Promise.all([
    db.phaseRoleDemand.count({ where: { roleId: id } }),
    db.resourceCapability.count({ where: { roleId: id } }),
    db.assignment.count({ where: { roleId: id } }),
    db.patternRoleIntensity.count({ where: { roleId: id } }),
  ]);
  if (demand + capability + assign + patternUse > 0) {
    await db.role.update({ where: { id }, data: { active: false } });
  } else {
    await db.role.delete({ where: { id } });
  }
  revalidatePath("/roles");
  revalidatePath("/patterns");
}
