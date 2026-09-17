# Resource Loader

A web tool for project resource planning:

- Estimate role-level FTE demand per project phase (Select, Define, Build, Test, Deploy — configurable)
- Auto-level projects across a rolling monthly horizon, respecting priority, constraints, and dependencies
- Assign named resources to leveled role slots and evaluate utilization + overages
- Bulk import Roles / Projects / Dependencies from CSV

Stack: Next.js 14 (App Router) · TypeScript · Prisma · **PostgreSQL** · Tailwind.

---

## Local development

Requires **Node 20+** and a **Postgres** database. Easiest options:

### Option A — Neon (free, no install)
1. Create a project at https://neon.tech
2. Copy the connection string (pooled)
3. Copy the direct (non-pooled) connection string
4. Put both in `.env`:
   ```
   DATABASE_URL="<pooled url>"
   DIRECT_URL="<direct url>"
   ```

### Option B — Local Postgres via Docker
```bash
docker run --rm -d --name resplan-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
```
Then in `.env`:
```
DATABASE_URL="postgresql://postgres:dev@localhost:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:dev@localhost:5432/postgres?schema=public"
```

### Run it
```bash
npm install
npm run db:push        # apply schema to DB
npm run db:seed        # optional — loads sample roles/phases/resources/projects
npm run dev            # http://localhost:3000
```

Reset locally: `npm run db:reset` (drops all data, re-seeds).

---

## Deploy to Vercel

### 1. Push to GitHub (once)
Repo lives at https://github.com/blockerm/resplan.

### 2. Create the Vercel project
1. https://vercel.com/new
2. Import the GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Don't deploy yet — you need env vars first

### 3. Provision Postgres

**On Vercel** (Storage → Create Database → Postgres) *or* use **Neon / Supabase** and paste the URLs.

In **Project Settings → Environment Variables**, add for all environments:
```
DATABASE_URL   = <pooled connection string>
DIRECT_URL     = <direct/non-pooled connection string>
```

### 4. First deploy
Click **Deploy**. Vercel runs `npm run build` (which does `prisma generate && next build`).

### 5. Initialize the schema (one-time, from your laptop)
Pull the prod env vars locally and apply the schema:
```bash
vercel env pull .env.production.local
npx dotenv -e .env.production.local -- npx prisma db push
```
Or set them in a shell and run `npx prisma db push` directly.

### 6. Populate data
Once the app is live, open `/import` and upload CSVs for Roles, Projects, Dependencies. Or run `npm run db:seed` against the prod DB (dev seed data — probably not what you want).

---

## Notes

- **Migration from local SQLite**: earlier versions of this project used SQLite. If you had local data in `prisma/dev.db`, it isn't automatically brought over. Use the CSV import to rebuild.
- **Server actions**: the app uses Next.js server actions extensively — no separate API layer. Compatible with Vercel serverless.
- **Auth**: there is no authentication yet. If you're deploying to a public URL, put it behind Vercel's password protection (Settings → Deployment Protection) or add NextAuth.
