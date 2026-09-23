// Prefixes any command with Vercel Postgres → Prisma env-var aliases,
// so `node scripts/pg-env.mjs prisma db push` works when only
// POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING are set (Vercel Postgres
// integration).

import { spawn } from "node:child_process";

if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error("Usage: node scripts/pg-env.mjs <command> [...args]");
  process.exit(2);
}

const child = spawn(cmd, args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
