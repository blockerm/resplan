"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { parseCsv, toBool } from "@/lib/csv";

export type ImportResult = {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  errors: string[];
};

function readFile(formData: FormData): Promise<string> {
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string" || file.size === 0) {
    return Promise.reject(new Error("No CSV file provided."));
  }
  return file.text();
}

// ---------- Roles ----------
// Columns: name, description, order, active, defaultCapacity
export async function importRoles(formData: FormData): Promise<ImportResult> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  try {
    const text = await readFile(formData);
    const rows = parseCsv(text);
    for (const [i, row] of rows.entries()) {
      const name = (row.name || "").trim();
      if (!name) {
        errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      const data = {
        name,
        description: (row.description || "").trim() || null,
        order: Number.isFinite(Number(row.order)) ? Math.round(Number(row.order)) : 0,
        active: row.active === undefined || row.active === "" ? true : toBool(row.active),
        defaultCapacity: Number.isFinite(Number(row.defaultCapacity))
          ? Math.max(0, Number(row.defaultCapacity))
          : 0,
      };
      const existing = await db.role.findUnique({ where: { name } });
      if (existing) {
        await db.role.update({ where: { name }, data });
        updated += 1;
      } else {
        await db.role.create({ data });
        created += 1;
      }
    }
  } catch (e: unknown) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      created,
      updated,
      errors,
    };
  }
  revalidatePath("/roles");
  revalidatePath("/level-load");
  return {
    ok: errors.length === 0,
    message: `Roles: ${created} created, ${updated} updated${
      errors.length ? `, ${errors.length} errors` : ""
    }.`,
    created,
    updated,
    errors,
  };
}

// ---------- Projects ----------
// Columns: code, name, description, priority, status, constraint, constraintMonth
export async function importProjects(formData: FormData): Promise<ImportResult> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  const validStatus = new Set(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETE", "CANCELLED"]);
  const validConstraint = new Set(["ASAP", "MUST_START", "MUST_FINISH"]);
  try {
    const text = await readFile(formData);
    const rows = parseCsv(text);
    for (const [i, row] of rows.entries()) {
      const code = (row.code || "").trim();
      const name = (row.name || "").trim();
      if (!code || !name) {
        errors.push(`Row ${i + 2}: code and name are required`);
        continue;
      }
      const rawStatus = (row.status || "PLANNED").trim().toUpperCase();
      if (!validStatus.has(rawStatus)) {
        errors.push(`Row ${i + 2}: invalid status "${rawStatus}"`);
        continue;
      }
      const rawConstraint = (row.constraint || "ASAP").trim().toUpperCase();
      if (!validConstraint.has(rawConstraint)) {
        errors.push(`Row ${i + 2}: invalid constraint "${rawConstraint}"`);
        continue;
      }
      const constraintMonth =
        rawConstraint === "ASAP" ? null : (row.constraintMonth || "").trim() || null;
      if (rawConstraint !== "ASAP" && !constraintMonth) {
        errors.push(`Row ${i + 2}: ${rawConstraint} requires constraintMonth (YYYY-MM)`);
        continue;
      }
      if (constraintMonth && !/^\d{4}-\d{2}$/.test(constraintMonth)) {
        errors.push(`Row ${i + 2}: constraintMonth must be YYYY-MM`);
        continue;
      }
      const priorityN = Number(row.priority);
      const priority =
        Number.isFinite(priorityN) && priorityN >= 1 && priorityN <= 5
          ? Math.round(priorityN)
          : 3;
      const data = {
        code,
        name,
        description: (row.description || "").trim() || null,
        priority,
        status: rawStatus,
        constraint: rawConstraint,
        constraintMonth,
      };
      const existing = await db.project.findUnique({ where: { code } });
      if (existing) {
        await db.project.update({ where: { code }, data });
        updated += 1;
      } else {
        await db.project.create({ data });
        created += 1;
      }
    }
  } catch (e: unknown) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      created,
      updated,
      errors,
    };
  }
  revalidatePath("/projects");
  revalidatePath("/level-load");
  return {
    ok: errors.length === 0,
    message: `Projects: ${created} created, ${updated} updated${
      errors.length ? `, ${errors.length} errors` : ""
    }.`,
    created,
    updated,
    errors,
  };
}

// ---------- Dependencies ----------
// Columns: dependentCode, dependsOnCode, type (FS|SS|FF|SF), lagMonths, note
export async function importDependencies(formData: FormData): Promise<ImportResult> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  const validTypes = new Set(["FS", "SS", "FF", "SF"]);
  try {
    const text = await readFile(formData);
    const rows = parseCsv(text);
    const codes = new Set<string>();
    for (const r of rows) {
      if (r.dependentCode) codes.add(r.dependentCode.trim());
      if (r.dependsOnCode) codes.add(r.dependsOnCode.trim());
    }
    const projects = await db.project.findMany({
      where: { code: { in: Array.from(codes) } },
      select: { id: true, code: true },
    });
    const idByCode = new Map(projects.map((p) => [p.code, p.id]));

    for (const [i, row] of rows.entries()) {
      const depCode = (row.dependentCode || "").trim();
      const predCode = (row.dependsOnCode || "").trim();
      if (!depCode || !predCode) {
        errors.push(`Row ${i + 2}: dependentCode and dependsOnCode are required`);
        continue;
      }
      if (depCode === predCode) {
        errors.push(`Row ${i + 2}: dependent cannot equal dependsOn (${depCode})`);
        continue;
      }
      const dependentId = idByCode.get(depCode);
      const dependsOnId = idByCode.get(predCode);
      if (!dependentId) {
        errors.push(`Row ${i + 2}: unknown dependent project "${depCode}"`);
        continue;
      }
      if (!dependsOnId) {
        errors.push(`Row ${i + 2}: unknown predecessor project "${predCode}"`);
        continue;
      }
      const rawType = (row.type || "FS").trim().toUpperCase();
      if (!validTypes.has(rawType)) {
        errors.push(`Row ${i + 2}: invalid type "${rawType}" (expected FS/SS/FF/SF)`);
        continue;
      }
      const lagN = Number(row.lagMonths);
      const lagMonths = Number.isFinite(lagN) ? Math.round(lagN) : 0;
      const note = (row.note || "").trim() || null;
      const existing = await db.dependency.findUnique({
        where: { dependentId_dependsOnId: { dependentId, dependsOnId } },
      });
      if (existing) {
        await db.dependency.update({
          where: { dependentId_dependsOnId: { dependentId, dependsOnId } },
          data: { type: rawType, lagMonths, note },
        });
        updated += 1;
      } else {
        await db.dependency.create({
          data: { dependentId, dependsOnId, type: rawType, lagMonths, note },
        });
        created += 1;
      }
    }
  } catch (e: unknown) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      created,
      updated,
      errors,
    };
  }
  revalidatePath("/projects");
  revalidatePath("/level-load");
  return {
    ok: errors.length === 0,
    message: `Dependencies: ${created} created, ${updated} updated${
      errors.length ? `, ${errors.length} errors` : ""
    }.`,
    created,
    updated,
    errors,
  };
}
