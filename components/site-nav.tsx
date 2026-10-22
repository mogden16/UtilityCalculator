"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TOOL_ROUTES } from "@/lib/site";

export function SiteNav() {
  const pathname = usePathname();
  const activeTool = TOOL_ROUTES.find((tool) => tool.href === pathname) ?? TOOL_ROUTES[0];

  const links = TOOL_ROUTES.map((tool) => {
    const isActive = pathname === tool.href;
    return (
      <Link
        key={tool.href}
        href={tool.href}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
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
  });

  return (
    <nav aria-label="Calculator tools">
      <div className="hidden flex-wrap gap-2 sm:flex">{links}</div>
      <details className="group sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>{activeTool.shortLabel}</span>
          <span aria-hidden="true" className="text-muted-foreground transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-2 shadow-lg">
          {links}
        </div>
      </details>
    </nav>
  );
}
