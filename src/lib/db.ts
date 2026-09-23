// Auto-map Vercel Postgres integration's env vars to what Prisma expects,
// so attaching a Vercel Postgres to the project works with zero extra config.
// Runs before PrismaClient is constructed (`new PrismaClient()` reads env at
// call time, not at module import time).
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}
// If only DATABASE_URL is set (Neon-style, no direct URL), reuse it.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
