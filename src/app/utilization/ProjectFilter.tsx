"use client";

import { useRouter } from "next/navigation";

export function ProjectFilter({
  projects,
  selectedId,
}: {
  projects: { id: string; code: string; name: string }[];
  selectedId: string; // "" means all projects
}) {
  const router = useRouter();
  return (
    <select
      className="input max-w-md"
      value={selectedId}
      onChange={(e) => {
        const id = e.target.value;
        const qs = id ? `?project=${encodeURIComponent(id)}` : "";
        router.push(`/utilization${qs}`);
      }}
    >
      <option value="">All projects</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.code} — {p.name}
        </option>
      ))}
    </select>
  );
}
