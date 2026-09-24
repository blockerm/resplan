// Seed the 6 project patterns (phase weights + per-role phase intensities)
// from Resourcing_Allocation_Model.xlsx.
// Idempotent: safe to run multiple times. Won't touch existing projects.
//
// Run: DATABASE_URL=... DIRECT_URL=... npx tsx prisma/seed-patterns.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ---------------- Static data extracted from the spreadsheet ----------------

// Phases used by patterns — order matches spreadsheet columns.
const PATTERN_PHASES = ["Initiating", "Planning", "Executing", "Deploying", "Closing"];

// Roles used by patterns.
const PATTERN_ROLES = [
  "PM (Project Manager)",
  "BA (Business Analyst)",
  "EA (Enterprise Architect)",
  "OCM (Organizational Change Management)",
  "Server Ops",
  "Storage Ops",
  "Cloud Ops",
  "DBA (Database Administrator)",
  "Network Ops",
  "IAM (Identity and Access Management)",
  "Telecomm Ops (Telecommunications Operations)",
];

// From "Phase Weighting by Category" tab: phaseName -> weight (0..1).
// Value 0 means the pattern doesn't include that phase (N/A in sheet).
const PATTERN_WEIGHTS: Record<string, Record<string, number>> = {
  "Assessment": { Initiating: 0.2, Planning: 0.25, Executing: 0.55 },
  "Proof of Concept (POC)": { Initiating: 0.1, Planning: 0.15, Executing: 0.65, Deploying: 0.1 },
  "Limited Implementation": { Initiating: 0.1, Planning: 0.15, Executing: 0.4, Deploying: 0.2, Closing: 0.15 },
  "Full Implementation": { Initiating: 0.08, Planning: 0.17, Executing: 0.45, Deploying: 0.15, Closing: 0.15 },
  "Small - OOTB Purchase": { Initiating: 0.1, Planning: 0.1, Executing: 0.35, Deploying: 0.25, Closing: 0.2 },
  "Real Estate (IT)": { Initiating: 0.1, Planning: 0.3, Executing: 0.45, Deploying: 0.1, Closing: 0.05 },
};

// Per-pattern role×phase intensity + engagement. "N/A" -> not included.
// Ordered: [Initiating, Planning, Executing, Deploying, Closing]
type IntensityRow = {
  role: string;
  engagement: "Core" | "Situational" | "Not Engaged";
  values: (number | "N/A")[];
};

const PATTERN_INTENSITIES: Record<string, IntensityRow[]> = {
  "Assessment": [
    // Only 3 phases; values are [Init, Plan, Exec]
    { role: "PM (Project Manager)", engagement: "Core", values: [0.9, 0.9, 1] },
    { role: "BA (Business Analyst)", engagement: "Core", values: [0.8, 1, 0.9] },
    { role: "EA (Enterprise Architect)", engagement: "Core", values: [0.9, 1, 0.6] },
    { role: "OCM (Organizational Change Management)", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A"] },
    { role: "Server Ops", engagement: "Situational", values: ["N/A", "N/A", 0.4] },
    { role: "Storage Ops", engagement: "Situational", values: ["N/A", "N/A", 0.4] },
    { role: "Cloud Ops", engagement: "Situational", values: ["N/A", "N/A", 0.4] },
    { role: "DBA (Database Administrator)", engagement: "Situational", values: ["N/A", "N/A", 0.4] },
    { role: "Network Ops", engagement: "Situational", values: ["N/A", "N/A", 0.4] },
    { role: "IAM (Identity and Access Management)", engagement: "Situational", values: ["N/A", "N/A", 0.4] },
    { role: "Telecomm Ops (Telecommunications Operations)", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A"] },
  ],
  "Proof of Concept (POC)": [
    // 4 phases: [Init, Plan, Exec, Deploy]
    { role: "PM (Project Manager)", engagement: "Core", values: [0.85, 0.9, 1, 0.6] },
    { role: "BA (Business Analyst)", engagement: "Core", values: [0.7, 0.9, 0.8, 0.15] },
    { role: "EA (Enterprise Architect)", engagement: "Core", values: [0.8, 1, 0.7, 0.1] },
    { role: "OCM (Organizational Change Management)", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A", "N/A"] },
    { role: "Server Ops", engagement: "Situational", values: ["N/A", 0.2, 1, 0.3] },
    { role: "Storage Ops", engagement: "Situational", values: ["N/A", 0.2, 1, 0.3] },
    { role: "Cloud Ops", engagement: "Situational", values: ["N/A", 0.2, 1, 0.3] },
    { role: "DBA (Database Administrator)", engagement: "Situational", values: ["N/A", 0.2, 1, 0.3] },
    { role: "Network Ops", engagement: "Situational", values: ["N/A", 0.2, 1, 0.3] },
    { role: "IAM (Identity and Access Management)", engagement: "Situational", values: ["N/A", 0.2, 1, 0.3] },
    { role: "Telecomm Ops (Telecommunications Operations)", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A", "N/A"] },
  ],
  "Limited Implementation": [
    // 5 phases
    { role: "PM (Project Manager)", engagement: "Core", values: [0.95, 1, 1, 0.9, 0.4] },
    { role: "BA (Business Analyst)", engagement: "Core", values: [0.7, 1, 0.5, 0.15, 0] },
    { role: "EA (Enterprise Architect)", engagement: "Core", values: [0.8, 1, 0.6, 0.15, 0] },
    { role: "OCM (Organizational Change Management)", engagement: "Core", values: [0.1, 0.3, 0.4, 1, 0.5] },
    { role: "Server Ops", engagement: "Core", values: ["N/A", 0.3, 1, 0.7, 0.2] },
    { role: "Storage Ops", engagement: "Core", values: ["N/A", 0.3, 1, 0.7, 0.2] },
    { role: "Cloud Ops", engagement: "Core", values: ["N/A", 0.4, 1, 0.6, 0.2] },
    { role: "DBA (Database Administrator)", engagement: "Situational", values: ["N/A", 0.2, 1, 0.6, 0.2] },
    { role: "Network Ops", engagement: "Core", values: ["N/A", 0.2, 0.9, 0.8, 0.2] },
    { role: "IAM (Identity and Access Management)", engagement: "Core", values: ["N/A", 0.3, 0.8, 0.9, 0.2] },
    { role: "Telecomm Ops (Telecommunications Operations)", engagement: "Situational", values: ["N/A", 0.2, 0.8, 0.8, 0.2] },
  ],
  "Full Implementation": [
    { role: "PM (Project Manager)", engagement: "Core", values: [1, 1, 1, 1, 0.5] },
    { role: "BA (Business Analyst)", engagement: "Core", values: [0.6, 1, 0.4, 0.1, 0] },
    { role: "EA (Enterprise Architect)", engagement: "Core", values: [0.7, 1, 0.6, 0.15, 0] },
    { role: "OCM (Organizational Change Management)", engagement: "Core", values: [0.1, 0.4, 0.6, 1, 0.7] },
    { role: "Server Ops", engagement: "Core", values: ["N/A", 0.3, 1, 0.7, 0.3] },
    { role: "Storage Ops", engagement: "Core", values: ["N/A", 0.3, 1, 0.7, 0.3] },
    { role: "Cloud Ops", engagement: "Core", values: ["N/A", 0.4, 1, 0.6, 0.3] },
    { role: "DBA (Database Administrator)", engagement: "Core", values: ["N/A", 0.2, 1, 0.6, 0.3] },
    { role: "Network Ops", engagement: "Core", values: ["N/A", 0.2, 0.9, 0.8, 0.3] },
    { role: "IAM (Identity and Access Management)", engagement: "Core", values: ["N/A", 0.3, 0.8, 0.9, 0.3] },
    { role: "Telecomm Ops (Telecommunications Operations)", engagement: "Core", values: ["N/A", 0.2, 0.8, 1, 0.3] },
  ],
  "Small - OOTB Purchase": [
    { role: "PM (Project Manager)", engagement: "Core", values: [0.9, 0.8, 0.9, 1, 0.4] },
    { role: "BA (Business Analyst)", engagement: "Core", values: [0.7, 1, 0.5, 0.1, 0] },
    { role: "EA (Enterprise Architect)", engagement: "Situational", values: [0.5, 0.8, 0.2, 0.05, 0] },
    { role: "OCM (Organizational Change Management)", engagement: "Core", values: [0.1, 0.3, 0.4, 1, 0.8] },
    { role: "Server Ops", engagement: "Situational", values: ["N/A", 0.1, 0.4, 0.3, 0.1] },
    { role: "Storage Ops", engagement: "Situational", values: ["N/A", 0.1, 0.4, 0.3, 0.1] },
    { role: "Cloud Ops", engagement: "Situational", values: ["N/A", 0.2, 0.6, 0.4, 0.1] },
    { role: "DBA (Database Administrator)", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A", "N/A", "N/A"] },
    { role: "Network Ops", engagement: "Situational", values: ["N/A", 0.1, 0.4, 0.4, 0.1] },
    { role: "IAM (Identity and Access Management)", engagement: "Core", values: ["N/A", 0.4, 0.8, 1, 0.3] },
    { role: "Telecomm Ops (Telecommunications Operations)", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A", "N/A", "N/A"] },
  ],
  "Real Estate (IT)": [
    { role: "PM (Project Manager)", engagement: "Core", values: [0.9, 1, 1, 0.7, 0.3] },
    { role: "BA (Business Analyst)", engagement: "Situational", values: [0.5, 1, 0.4, 0.1, 0] },
    { role: "EA (Enterprise Architect)", engagement: "Situational", values: ["N/A", 0.8, 0.6, 0.2, 0] },
    { role: "OCM (Organizational Change Management)", engagement: "Core", values: [0.1, 0.4, 0.5, 1, 0.4] },
    { role: "Server Ops", engagement: "Situational", values: ["N/A", 0.4, 1, 0.5, 0.1] },
    { role: "Storage Ops", engagement: "Situational", values: ["N/A", 0.4, 1, 0.5, 0.1] },
    { role: "Cloud Ops", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A", "N/A", "N/A"] },
    { role: "DBA (Database Administrator)", engagement: "Not Engaged", values: ["N/A", "N/A", "N/A", "N/A", "N/A"] },
    { role: "Network Ops", engagement: "Core", values: ["N/A", 0.5, 1, 0.5, 0.1] },
    { role: "IAM (Identity and Access Management)", engagement: "Core", values: ["N/A", 0.4, 0.6, 1, 0.2] },
    { role: "Telecomm Ops (Telecommunications Operations)", engagement: "Core", values: ["N/A", 0.5, 1, 0.5, 0.1] },
  ],
};

const PATTERN_ORDER = [
  "Assessment",
  "Proof of Concept (POC)",
  "Limited Implementation",
  "Full Implementation",
  "Small - OOTB Purchase",
  "Real Estate (IT)",
];

const ENGAGEMENT_MAP: Record<string, string> = {
  "Core": "CORE",
  "Situational": "SITUATIONAL",
  "Not Engaged": "NOT_ENGAGED",
};

async function main() {
  console.log("Seeding phases…");
  const phaseByName: Record<string, string> = {};
  for (let i = 0; i < PATTERN_PHASES.length; i++) {
    const name = PATTERN_PHASES[i];
    // Use a high starting order (100+) so pattern phases don't collide with
    // any existing tool-configured phases (e.g., Select/Define/Build/Test/Deploy).
    const p = await db.phase.upsert({
      where: { name },
      update: {},
      create: { name, order: 100 + i, active: true },
    });
    phaseByName[name] = p.id;
  }

  console.log("Seeding roles…");
  const roleByName: Record<string, string> = {};
  for (let i = 0; i < PATTERN_ROLES.length; i++) {
    const name = PATTERN_ROLES[i];
    const r = await db.role.upsert({
      where: { name },
      update: {},
      create: { name, order: 100 + i, active: true, defaultCapacity: 0 },
    });
    roleByName[name] = r.id;
  }

  console.log("Seeding patterns…");
  for (let pi = 0; pi < PATTERN_ORDER.length; pi++) {
    const name = PATTERN_ORDER[pi];
    const pattern = await db.projectPattern.upsert({
      where: { name },
      update: { order: pi, active: true },
      create: { name, order: pi, active: true },
    });

    // Weights — only phases present in this pattern's weights map
    const weights = PATTERN_WEIGHTS[name];
    // Clear then re-create weights so re-runs align with source of truth
    await db.patternPhaseWeight.deleteMany({ where: { patternId: pattern.id } });
    let orderIdx = 0;
    for (const phaseName of PATTERN_PHASES) {
      const w = weights[phaseName];
      if (w === undefined) continue;
      await db.patternPhaseWeight.create({
        data: {
          patternId: pattern.id,
          phaseId: phaseByName[phaseName],
          weightPct: w,
          order: orderIdx,
        },
      });
      orderIdx += 1;
    }

    // Intensities
    await db.patternRoleIntensity.deleteMany({ where: { patternId: pattern.id } });
    const rows = PATTERN_INTENSITIES[name];
    // Determine which phases this pattern uses (in order)
    const usedPhases = PATTERN_PHASES.filter((p) => weights[p] !== undefined);
    for (const row of rows) {
      const roleId = roleByName[row.role];
      const engagement = ENGAGEMENT_MAP[row.engagement];
      for (let pIdx = 0; pIdx < usedPhases.length; pIdx++) {
        const phaseName = usedPhases[pIdx];
        const v = row.values[pIdx];
        const fte = typeof v === "number" ? v : 0;
        await db.patternRoleIntensity.create({
          data: {
            patternId: pattern.id,
            phaseId: phaseByName[phaseName],
            roleId,
            fte,
            engagement,
          },
        });
      }
    }
    console.log(`  ✓ ${name}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
