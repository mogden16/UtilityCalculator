"use client";

import Link from "next/link";
import { Calculator, SlidersHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import ThemeToggle from "@/components/theme-toggle";

export function AppHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" prefetch={false} className="flex min-h-11 items-center gap-2.5" aria-label="UtilityCalc home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Calculator className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight">UtilityCalc</span>
            {!isHome ? <span className="hidden text-[11px] text-muted-foreground sm:block">Engineering &amp; customer solutions</span> : null}
          </span>
        </Link>
        {isHome ? (
          <div className="flex items-center gap-2">
            <Link href="/unit-conversions" prefetch={false} aria-label="Open conversions and assumptions" className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <SlidersHorizontal className="h-5 w-5" />
            </Link>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex items-center gap-2"><SiteNav /><ThemeToggle /></div>
        )}
      </div>
    </header>
  );
}
