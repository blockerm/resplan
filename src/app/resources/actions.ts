"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ResourceInput = z.object({
  name: z.string().trim().min(1, "Name required"),
  email: z.string().trim().email().or(z.literal("")).transform((v) => (v === "" ? null : v)),
  defaultCapacity: z.coerce.number().min(0).max(2).default(1),
  active: z.coerce.boolean().default(true),
});

export async function createResource(formData: FormData) {
  const parsed = ResourceInput.parse({
    name: formData.get("name"),
    email: formData.get("email") || "",
    defaultCapacity: formData.get("defaultCapacity") || 1,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  const created = await db.resource.create({ data: parsed });
  revalidatePath("/resources");
  redirect(`/resources/${created.id}`);
}

export async function updateResource(id: string, formData: FormData) {
  const parsed = ResourceInput.parse({
    name: formData.get("name"),
    email: formData.get("email") || "",
    defaultCapacity: formData.get("defaultCapacity") || 1,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  await db.resource.update({ where: { id }, data: parsed });
  revalidatePath("/resources");
  revalidatePath(`/resources/${id}`);
}

export async function deleteResource(id: string) {
  const assigned = await db.assignment.count({ where: { resourceId: id } });
  if (assigned > 0) {
    await db.resource.update({ where: { id }, data: { active: false } });
  } else {
    await db.resource.delete({ where: { id } });
  }
  revalidatePath("/resources");
  redirect("/resources");
}

export async function setCapability(resourceId: string, roleId: string, enabled: boolean) {
  if (enabled) {
    await db.resourceCapability.upsert({
      where: { resourceId_roleId: { resourceId, roleId } },
      update: {},
      create: { resourceId, roleId },
    });
  } else {
    await db.resourceCapability.deleteMany({ where: { resourceId, roleId } });
  }
  revalidatePath(`/resources/${resourceId}`);
}

const OverrideInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
  capacity: z.coerce.number().min(0).max(2),
  note: z.string().trim().optional().nullable(),
});

export async function upsertCapacityOverride(resourceId: string, formData: FormData) {
  const parsed = OverrideInput.parse({
    month: formData.get("month"),
    capacity: formData.get("capacity"),
    note: formData.get("note") || null,
  });
  await db.capacityOverride.upsert({
    where: { resourceId_month: { resourceId, month: parsed.month } },
    update: { capacity: parsed.capacity, note: parsed.note },
    create: { resourceId, ...parsed },
  });
  revalidatePath(`/resources/${resourceId}`);
}

export async function deleteCapacityOverride(id: string, resourceId: string) {
  await db.capacityOverride.delete({ where: { id } });
  revalidatePath(`/resources/${resourceId}`);
}
