"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Flame,
  Home,
  LayoutGrid,
  Leaf,
  Search,
  Settings2,
  Zap,
  type LucideIcon,
} from "lucide-react";

const TOOLS: Array<{
  href: string;
  name: string;
  description: string;
  keywords: string;
  icon: LucideIcon;
  primary?: boolean;
}> = [
  { href: "/load-converter", name: "Load Converter", description: "BTU, MCF, CFH", keywords: "gas demand mbh therm dth flow", icon: Flame, primary: true },
  { href: "/gas-equipment-sizing", name: "Gas Equipment Sizing", description: "Service, meter, regulator", keywords: "pipe service capacity diaphragm rotary turbine regulator threaded welded", icon: Settings2, primary: true },
  { href: "/energy-cost-comparison", name: "Energy Savings", description: "Compare fuel costs", keywords: "cost payback electric oil propane heat pump cop", icon: CircleDollarSign, primary: true },
  { href: "/unit-conversions", name: "Conversions", description: "Energy, power and pressure", keywords: "unit temperature flow btu kwh mmbtu", icon: ArrowLeftRight, primary: true },
  { href: "/chp", name: "Onsite Power", description: "CHP and generation", keywords: "cogeneration engine turbine payback", icon: Zap },
  { href: "/emissions", name: "Emissions", description: "Carbon comparison", keywords: "co2 grid pjm gas heat pump", icon: Leaf },
  { href: "/load-estimator", name: "Facility Load", description: "Heating and cooling screen", keywords: "square feet tons mbh building", icon: Building2 },
];

export function HomeDashboard() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(
    () => normalizedQuery
      ? TOOLS.filter((tool) => `${tool.name} ${tool.description} ${tool.keywords}`.toLowerCase().includes(normalizedQuery))
      : [],
    [normalizedQuery],
  );
  const primaryTools = TOOLS.filter((tool) => tool.primary);
  const secondaryTools = TOOLS.filter((tool) => !tool.primary);

  return (
    <div className="-mx-3 -mt-4 min-h-[calc(100vh-4rem)] px-4 pb-5 pt-5 text-foreground sm:mx-0 sm:mt-0 sm:min-h-0 sm:p-8 lg:px-10 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a calculator or calculation…"
            aria-label="Find a calculator or calculation"
            className="h-16 w-full rounded-2xl border border-border bg-card pl-14 pr-4 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15 sm:text-lg"
          />
        </div>

        {normalizedQuery ? (
          <section aria-labelledby="search-results-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h1 id="search-results-heading" className="text-xl font-semibold">Search results</h1>
              <span className="text-sm text-muted-foreground">{matches.length} found</span>
            </div>
            {matches.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {matches.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">No calculator matches “{query}”. Try a unit such as CFH, kWh, COP, or MMBtu.</div>
            )}
          </section>
        ) : (
          <>
            <section aria-labelledby="primary-tools-heading" className="space-y-4">
              <h1 id="primary-tools-heading" className="text-xl font-semibold sm:text-2xl">What do you want to calculate?</h1>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {primaryTools.map((tool) => <ToolCard key={tool.href} tool={tool} />)}
              </div>
            </section>

            <section aria-labelledby="more-tools-heading" className="space-y-3">
              <h2 id="more-tools-heading" className="text-base font-semibold">More engineering tools</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                {secondaryTools.map(({ href, name, description, icon: Icon }) => (
                  <Link key={href} href={href} prefetch={false} className="group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 shadow-sm transition hover:border-primary/40 hover:bg-accent">
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0"><span className="block text-sm font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{description}</span></span>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </section>

            <section aria-labelledby="quick-conversion-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 id="quick-conversion-heading" className="text-lg font-semibold">Quick conversions</h2>
                <Link href="/unit-conversions" prefetch={false} className="min-h-11 py-3 text-sm text-primary hover:underline">View all</Link>
              </div>
              <Link href="/unit-conversions" prefetch={false} className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-lg font-medium sm:text-xl">
                  <span>1 MMBtu</span>
                  <ArrowLeftRight className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="text-right">0.966 MCF</span>
                </div>
                <div className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground sm:text-base">Natural gas HHV: 1.035 MMBtu/MCF</div>
              </Link>
            </section>
          </>
        )}

        <nav aria-label="Homepage navigation" className="grid grid-cols-4 rounded-2xl border border-border bg-card p-1 shadow-lg lg:hidden">
          <HomeNavLink href="/" label="Home" icon={Home} active />
          <HomeNavLink href="/load-converter" label="Tools" icon={LayoutGrid} />
          <HomeNavLink href="/load-estimator" label="Loads" icon={Building2} />
          <HomeNavLink href="/unit-conversions" label="Assumptions" icon={ArrowLeftRight} />
        </nav>
      </div>
    </div>
  );
}

function HomeNavLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: LucideIcon; active?: boolean }) {
  return <Link href={href} prefetch={false} aria-current={active ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}><Icon className="h-5 w-5" /><span>{label}</span></Link>;
}

function ToolCard({ tool }: { tool: (typeof TOOLS)[number] }) {
  const Icon = tool.icon;
  return (
    <Link href={tool.href} prefetch={false} className="group flex min-h-44 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent sm:min-h-48 sm:p-5">
      <Icon className="h-7 w-7 text-primary" strokeWidth={1.8} />
      <span className="mt-auto block text-lg font-medium leading-tight sm:text-xl">{tool.name}</span>
      <span className="mt-2 block text-sm leading-5 text-muted-foreground sm:text-base">{tool.description}</span>
    </Link>
  );
}
