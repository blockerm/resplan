"use server";

import { revalidatePath } from "next/cache";
import { persistSolve, solve, SolveResult } from "@/lib/levelload";

export async function runSolve(horizonStart: string, horizonEnd: string): Promise<SolveResult> {
  const result = await solve({ horizonStart, horizonEnd });
  await persistSolve(result);
  revalidatePath("/level-load");
  return result;
}
