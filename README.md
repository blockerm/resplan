# Resource Loader

A local, single-user tool for project resource planning:

- Estimate role-level FTE demand per project phase (Select, Define, Build, Test, Deploy — configurable)
- Auto-level projects across a rolling monthly horizon, respecting priority and dependencies
- Assign named resources to leveled role slots and evaluate utilization + overages

Stack: Next.js 14 (App Router) · TypeScript · Prisma · SQLite · Tailwind. No cloud dependencies.

## Quickstart

Requires Node 20+.

```bash
cd /Users/blockerm/resource-loader
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000.

## Reset the database

```bash
npm run db:reset
```

Deletes and recreates `dev.db`, then re-seeds.
