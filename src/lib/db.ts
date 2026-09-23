// Auto-map various Postgres env-var naming schemes to what Prisma expects.
// Different providers use different names:
//   - Vercel Postgres (legacy): POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING
//   - Vercel Postgres (Neon-branded): POSTGRES_URL, POSTGRES_URL_NON_POOLING
//   - Neon direct: DATABASE_URL (or NEON_DATABASE_URL)
//   - Supabase: DATABASE_URL, DIRECT_URL
// Prisma always looks for DATABASE_URL / DIRECT_URL per our schema — this
// shim resolves them from whatever the provider actually injected.
const pooledCandidates = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.NEON_DATABASE_URL,
];
const directCandidates = [
  process.env.DIRECT_URL,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.POSTGRES_URL,
  process.env.DATABASE_URL,
];
const pooled = pooledCandidates.find(Boolean);
const direct = directCandidates.find(Boolean);
if (pooled) process.env.DATABASE_URL = pooled;
if (direct) process.env.DIRECT_URL = direct;

if (!process.env.DATABASE_URL) {
  const msg =
    "No Postgres connection URL found in env. Set DATABASE_URL (and DIRECT_URL), " +
    "or attach a Vercel Postgres integration which auto-injects POSTGRES_PRISMA_URL. " +
    "On Vercel: Project → Settings → Environment Variables (redeploy after adding).";
  // Warn loudly at startup, then let PrismaClient throw its own error too.
  // eslint-disable-next-line no-console
  console.error("[resource-loader] " + msg);
}

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
