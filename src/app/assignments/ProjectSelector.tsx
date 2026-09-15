"use client";

import { useRouter } from "next/navigation";

export function ProjectSelector({
  projects,
  selectedId,
}: {
  projects: { id: string; code: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <select
      className="input max-w-md"
      value={selectedId}
      onChange={(e) => {
        const id = e.target.value;
        const qs = id ? `?project=${encodeURIComponent(id)}` : "";
        router.push(`/assignments${qs}`);
      }}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.code} — {p.name}
        </option>
      ))}
    </select>
  );
}
