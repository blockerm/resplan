"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/level-load", label: "Level load" },
  { href: "/assignments", label: "Assignments" },
  { href: "/utilization", label: "Utilization" },
  { href: "/projects", label: "Projects" },
  { href: "/patterns", label: "Patterns" },
  { href: "/roles", label: "Roles" },
  { href: "/resources", label: "Resources" },
  { href: "/phases", label: "Phases" },
  { href: "/import", label: "Import CSV" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-sm font-semibold text-slate-900">Resource Loader</div>
        <div className="text-xs text-slate-500">Local · v0.1</div>
      </div>
      <nav className="p-2">
        {items.map((i) => {
          const active =
            i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={clsx(
                "block rounded-md px-3 py-2 text-sm font-medium",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
