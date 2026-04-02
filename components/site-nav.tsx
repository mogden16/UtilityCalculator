"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TOOL_ROUTES } from "@/lib/site";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {TOOL_ROUTES.map((tool) => {
        const isActive = pathname === tool.href;
        return (
          <Link
            key={tool.href}
            href={tool.href}
            className={[
              "rounded-full border px-3 py-1.5 text-sm transition",
              isActive
                ? "border-slate-900 bg-slate-900 text-slate-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                : "border-border bg-background text-foreground hover:border-slate-400 hover:bg-muted/60",
            ].join(" ")}
          >
            {tool.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
