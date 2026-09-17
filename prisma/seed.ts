import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding…");

  // Phases (configurable — user can edit later)
  const phaseNames = ["Select", "Define", "Build", "Test", "Deploy"];
  const phases = await Promise.all(
    phaseNames.map((name, i) =>
      db.phase.upsert({
        where: { name },
        update: { order: i },
        create: { name, order: i },
      }),
    ),
  );

  // Roles
  const roleNames = [
    "Project Manager",
    "Business Analyst",
    "Architect",
    "Developer",
    "QA Engineer",
    "DevOps Engineer",
  ];
  const roles = await Promise.all(
    roleNames.map((name, i) =>
      db.role.upsert({
        where: { name },
        update: { order: i },
        create: { name, order: i },
      }),
    ),
  );

  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r]));
  const phaseByName = Object.fromEntries(phases.map((p) => [p.name, p]));

  // Resources
  const resourceSeed = [
    { name: "Alex Chen", email: "alex@example.com", roles: ["Project Manager"] },
    { name: "Priya Shah", email: "priya@example.com", roles: ["Business Analyst"] },
    { name: "Marcus Reed", email: "marcus@example.com", roles: ["Architect", "Developer"] },
    { name: "Dana Kim", email: "dana@example.com", roles: ["Developer"] },
    { name: "Sam Patel", email: "sam@example.com", roles: ["Developer"] },
    { name: "Jordan Ellis", email: "jordan@example.com", roles: ["QA Engineer"] },
    { name: "Riley Ortiz", email: "riley@example.com", roles: ["DevOps Engineer"] },
  ];

  for (const r of resourceSeed) {
    const resource = await db.resource.upsert({
      where: { email: r.email },
      update: { name: r.name },
      create: { name: r.name, email: r.email },
    });
    for (const roleName of r.roles) {
      const role = roleByName[roleName];
      await db.resourceCapability.upsert({
        where: { resourceId_roleId: { resourceId: resource.id, roleId: role.id } },
        update: {},
        create: { resourceId: resource.id, roleId: role.id },
      });
    }
  }

  // Sample projects
  const projectSeed = [
    {
      code: "PRJ-001",
      name: "Customer Portal Refresh",
      description: "Redesign customer-facing portal with new brand and self-service flows.",
      priority: 1,
      status: "PLANNED",
      target: "2026-12-31",
      phases: [
        { name: "Select", start: "2026-09-01", end: "2026-09-30", demand: { "Project Manager": 0.5, "Business Analyst": 0.5 } },
        { name: "Define", start: "2026-10-01", end: "2026-11-30", demand: { "Project Manager": 0.5, "Business Analyst": 1.0, "Architect": 0.5 } },
        { name: "Build", start: "2026-12-01", end: "2027-03-31", demand: { "Project Manager": 0.5, "Developer": 2.0, "Architect": 0.25 } },
        { name: "Test", start: "2027-04-01", end: "2027-05-31", demand: { "Project Manager": 0.25, "QA Engineer": 1.5, "Developer": 0.5 } },
        { name: "Deploy", start: "2027-06-01", end: "2027-06-30", demand: { "Project Manager": 0.25, "DevOps Engineer": 1.0, "Developer": 0.5 } },
      ],
    },
    {
      code: "PRJ-002",
      name: "Data Warehouse Modernization",
      priority: 2,
      status: "PLANNED",
      target: "2027-06-30",
      phases: [
        { name: "Select", start: "2026-10-01", end: "2026-10-31", demand: { "Project Manager": 0.5, "Architect": 0.5 } },
        { name: "Define", start: "2026-11-01", end: "2026-12-31", demand: { "Project Manager": 0.5, "Business Analyst": 0.5, "Architect": 1.0 } },
        { name: "Build", start: "2027-01-01", end: "2027-04-30", demand: { "Project Manager": 0.5, "Developer": 1.5, "Architect": 0.5 } },
        { name: "Test", start: "2027-05-01", end: "2027-05-31", demand: { "QA Engineer": 1.0 } },
        { name: "Deploy", start: "2027-06-01", end: "2027-06-30", demand: { "DevOps Engineer": 1.0 } },
      ],
    },
    {
      code: "PRJ-003",
      name: "Mobile App v2",
      priority: 2,
      status: "PLANNED",
      target: "2027-09-30",
      phases: [
        { name: "Select", start: "2026-11-01", end: "2026-11-30", demand: { "Project Manager": 0.5 } },
        { name: "Define", start: "2026-12-01", end: "2027-01-31", demand: { "Business Analyst": 0.5, "Architect": 0.5 } },
        { name: "Build", start: "2027-02-01", end: "2027-06-30", demand: { "Developer": 2.0 } },
        { name: "Test", start: "2027-07-01", end: "2027-08-31", demand: { "QA Engineer": 1.5 } },
        { name: "Deploy", start: "2027-09-01", end: "2027-09-30", demand: { "DevOps Engineer": 0.5, "Developer": 0.5 } },
      ],
    },
    {
      code: "PRJ-004",
      name: "Legal Contract Automation",
      priority: 3,
      status: "PLANNED",
      target: "2027-04-30",
      phases: [
        { name: "Select", start: "2026-09-01", end: "2026-09-30", demand: { "Project Manager": 0.25 } },
        { name: "Define", start: "2026-10-01", end: "2026-11-30", demand: { "Business Analyst": 0.5, "Architect": 0.25 } },
        { name: "Build", start: "2026-12-01", end: "2027-02-28", demand: { "Developer": 1.0 } },
        { name: "Test", start: "2027-03-01", end: "2027-03-31", demand: { "QA Engineer": 0.5 } },
        { name: "Deploy", start: "2027-04-01", end: "2027-04-30", demand: { "DevOps Engineer": 0.25 } },
      ],
    },
  ];

  for (const p of projectSeed) {
    const project = await db.project.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        priority: p.priority,
        status: p.status,
      },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        priority: p.priority,
        status: p.status,
      },
    });

    for (const ph of p.phases) {
      const phase = phaseByName[ph.name];
      const projectPhase = await db.projectPhase.upsert({
        where: { projectId_phaseId: { projectId: project.id, phaseId: phase.id } },
        update: {
          plannedStart: new Date(ph.start),
          plannedEnd: new Date(ph.end),
        },
        create: {
          projectId: project.id,
          phaseId: phase.id,
          plannedStart: new Date(ph.start),
          plannedEnd: new Date(ph.end),
        },
      });

      for (const [roleName, fte] of Object.entries(ph.demand)) {
        const role = roleByName[roleName];
        await db.phaseRoleDemand.upsert({
          where: { projectPhaseId_roleId: { projectPhaseId: projectPhase.id, roleId: role.id } },
          update: { fte },
          create: { projectPhaseId: projectPhase.id, roleId: role.id, fte },
        });
      }
    }
  }

  // Sample dependency: Mobile App v2 depends on Customer Portal Refresh
  const portal = await db.project.findUnique({ where: { code: "PRJ-001" } });
  const mobile = await db.project.findUnique({ where: { code: "PRJ-003" } });
  if (portal && mobile) {
    await db.dependency.upsert({
      where: { dependentId_dependsOnId: { dependentId: mobile.id, dependsOnId: portal.id } },
      update: {},
      create: { dependentId: mobile.id, dependsOnId: portal.id, lagMonths: 0 },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
