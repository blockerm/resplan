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
  // Refuse if referenced by demand or assignments.
  const [demand, assign] = await Promise.all([
    db.phaseRoleDemand.count({ where: { roleId: id } }),
    db.assignment.count({ where: { roleId: id } }),
  ]);
  if (demand + assign > 0) {
    // Soft-deactivate instead of hard delete.
    await db.role.update({ where: { id }, data: { active: false } });
  } else {
    await db.role.delete({ where: { id } });
  }
  revalidatePath("/roles");
}
