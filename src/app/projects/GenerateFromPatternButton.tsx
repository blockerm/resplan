"use client";

import { useTransition, useState } from "react";
import { generateFromPattern } from "./actions";

export function GenerateFromPatternButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="ml-auto flex items-center gap-2">
      {msg && <span className="text-xs">{msg}</span>}
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => {
          if (!confirm("Replace current phases and role demand with pattern-generated ones?")) return;
          setMsg(null);
          startTransition(async () => {
            try {
              const r = await generateFromPattern(projectId);
              setMsg(r.ok ? r.message : `Error: ${r.message}`);
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Failed");
            }
          });
        }}
      >
        {pending ? "Generating…" : "Regenerate from pattern"}
      </button>
    </div>
  );
}
