"use client";

import { useState, useTransition } from "react";
import type { ImportResult } from "./actions";

export function ImportForm({
  title,
  helpText,
  sample,
  action,
}: {
  title: string;
  helpText: string;
  sample: string;
  action: (formData: FormData) => Promise<ImportResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  return (
    <div className="card">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-slate-500">{helpText}</p>
      <details className="mb-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
          Sample CSV
        </summary>
        <pre className="mt-1 whitespace-pre overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
{sample}
        </pre>
      </details>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setResult(null);
          startTransition(async () => {
            try {
              const r = await action(fd);
              setResult(r);
            } catch (e) {
              setResult({
                ok: false,
                message: e instanceof Error ? e.message : "Import failed",
                created: 0,
                updated: 0,
                errors: [],
              });
            }
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          name="file"
          type="file"
          accept=".csv,text/csv,text/plain"
          required
          className="text-sm"
        />
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Importing…" : "Import CSV"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="font-medium">{result.message}</div>
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.errors.slice(0, 20).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {result.errors.length > 20 && (
                <li>…and {result.errors.length - 20} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
