"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricCard } from "@/components/metric-card";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  APPLIANCE_ARCHETYPES,
  buildLoadScenarioChart,
  calculateLoadEstimate,
  formatArchetypeRange,
  LOAD_SCENARIOS,
  type LoadScenarioKey,
} from "@/lib/load-estimator";
import { formatFixed, formatWhole } from "@/lib/format";

export function LoadEstimatorTool() {
  const [sqft, setSqft] = useState("2000");
  const [scenario, setScenario] = useState<LoadScenarioKey>("average");
  const [heatingOverride, setHeatingOverride] = useState("");
  const [coolingOverride, setCoolingOverride] = useState("");

  const estimate = useMemo(
    () =>
      calculateLoadEstimate({
        sqft,
        scenario,
        heatingOverride,
        coolingOverride,
      }),
    [coolingOverride, heatingOverride, scenario, sqft],
  );

  const chartData = useMemo(
    () => buildLoadScenarioChart(estimate.area, scenario, estimate.heatingFactor, estimate.coolingFactor),
    [estimate.area, estimate.coolingFactor, estimate.heatingFactor, scenario],
  );

  return (
    <ToolPageShell
      eyebrow="Primary Tool"
      title="Load Estimator"
      description="Rule-of-thumb heating and cooling estimate for early-stage screening. These defaults reflect a Philadelphia-style climate assumption and should not replace project-specific load calculations."
    >
      <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-950/20">
        <CardContent className="space-y-2 p-6 text-sm leading-6 text-amber-950 dark:text-amber-100">
          <p className="font-medium">Heuristic workflow</p>
          <p>
            Use this page to bracket a likely load range, not to finalize equipment selection. Confirm with Manual J,
            code-required calculations, or project-specific engineering before procurement.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Square footage</Label>
            <Input value={sqft} onChange={(event) => setSqft(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Building condition</Label>
            <Select value={scenario} onValueChange={(value) => setScenario(value as LoadScenarioKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOAD_SCENARIOS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Default multipliers reflect a mixed heating and cooling climate and should be tuned for your project when
            better data exists.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Heating factor override (BTU/hr per ft^2)</Label>
            <Input
              value={heatingOverride}
              onChange={(event) => setHeatingOverride(event.target.value)}
              placeholder={String(estimate.defaultHeatingFactor)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cooling factor override (BTU/hr per ft^2)</Label>
            <Input
              value={coolingOverride}
              onChange={(event) => setCoolingOverride(event.target.value)}
              placeholder={String(estimate.defaultCoolingFactor)}
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Heating load" value={`${formatWhole(estimate.heatBtuh)} BTU/hr`} />
        <MetricCard label="Heating MBH" value={formatFixed(estimate.heatMbh, 1)} />
        <MetricCard label="Cooling load" value={`${formatWhole(estimate.coolBtuh)} BTU/hr`} />
        <MetricCard label="Cooling tons" value={formatFixed(estimate.coolTons, 2)} />
      </section>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Modeled load by scenario</h2>
            <p className="text-sm text-muted-foreground">
              The selected scenario uses your overrides. The other bars stay anchored to the default multipliers for
              comparison.
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatWhole(Number(value))} />
                <RechartsTooltip
                  formatter={(value: number | string, name: string) => [
                    `${formatWhole(Number(value))} BTU/hr`,
                    name,
                  ]}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Legend />
                <Bar dataKey="heating" fill="#f59e0b" name="Heating load" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cooling" fill="#2563eb" name="Cooling load" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Typical gas appliance input ranges</h2>
            <p className="text-sm text-muted-foreground">
              Use these as context when your estimated load needs a reality check against common equipment sizes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {APPLIANCE_ARCHETYPES.map((item) => (
              <div key={item.key} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="text-sm font-semibold text-foreground">{item.name}</div>
                <div className="mt-2 font-mono text-lg">{formatArchetypeRange(item.range)}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </ToolPageShell>
  );
}
