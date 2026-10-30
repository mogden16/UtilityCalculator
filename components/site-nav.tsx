"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, ChartNoAxesCombined, Factory, Flame, Home, Settings2 } from "lucide-react";

import { TOOL_ROUTES } from "@/lib/site";

const MOBILE_ROUTES = [
  { href: "/", label: "Home", icon: Home },
  { href: "/load-converter", label: "Gas", icon: Flame },
  { href: "/gas-equipment-sizing", label: "Size", icon: Settings2 },
  { href: "/energy-cost-comparison", label: "Compare", icon: ChartNoAxesCombined },
  { href: "/chp", label: "CHP", icon: Factory },
  { href: "/unit-conversions", label: "Convert", icon: Calculator },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Calculator tools" className="hidden items-center gap-1 lg:flex">
      {TOOL_ROUTES.map((tool) => {
        const active = pathname === tool.href;
        return (
          <Link
            key={tool.href}
            href={tool.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tool.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  if (isHome) return null;
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 border-t border-border/80 bg-background/95 px-1 backdrop-blur lg:hidden"
    >
      {MOBILE_ROUTES.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === "/load-converter" && pathname === "/gas-flow");
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
