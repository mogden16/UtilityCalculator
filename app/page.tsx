import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Calculator, Flame, Gauge, Scale, Thermometer } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TOOL_ROUTES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Utility Calculator",
  description: "Engineering calculators for thermal loads, CHP screening, gas demand, and utility rate comparisons.",
};

const ICONS = {
  calculator: Calculator,
  flame: Flame,
  gauge: Gauge,
  scale: Scale,
  thermometer: Thermometer,
} as const;

export default function HomePage() {
  return (
    <div className="space-y-10 pb-8">
      <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-10 text-slate-50 shadow-sm">
        <div className="mx-auto max-w-4xl space-y-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Engineering Toolkit</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Utility workflows split into focused pages, with live PJM data where server-side logic actually helps.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300">
            Pick the route that matches the engineering question you are solving: load conversion, cost comparison,
            CHP feasibility, load estimation, gas flow, or general unit conversion.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TOOL_ROUTES.filter((tool) => tool.href !== "/").map((tool) => {
          const Icon = ICONS[tool.icon];
          return (
            <Link key={tool.href} href={tool.href} className="group">
              <Card className="h-full border-border/70 transition hover:border-slate-400 hover:shadow-md">
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle>{tool.label}</CardTitle>
                    <CardDescription className="text-sm leading-6">{tool.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span>{tool.shortLabel}</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>What changed in this refactor</CardTitle>
            <CardDescription>The app keeps the route split, tests, and domain modules, while restoring server-backed PJM data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Each calculator is a dedicated route, so the browser no longer loads every widget and chart at once.</p>
            <p>Core equations now live in typed domain modules under <code>lib/</code>, which allows real tests.</p>
            <p>The repo is ready for CI, browser smoke testing, and a Cloudflare Worker deployment for live grid data.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation posture</CardTitle>
            <CardDescription>The load estimator remains heuristic by design.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Unit conversions and rate comparisons are deterministic.</p>
            <p>Load estimation is still a rule-of-thumb workflow and is labeled that way on its own page.</p>
            <p>For final equipment selections, verify with project-specific load calculations and code requirements.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
