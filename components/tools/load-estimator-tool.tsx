"use client";

import { useMemo, useState } from "react";

import { CalculationActions } from "@/components/calculation-actions";
import { ResultSummary } from "@/components/result-summary";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const maxChartLoad = Math.max(...chartData.flatMap((row) => [row.heating, row.cooling]), 1);
  const reset = () => { setSqft("2000"); setScenario("average"); setHeatingOverride(""); setCoolingOverride(""); };
  const copyText = `UtilityCalc facility load screen\nArea: ${formatWhole(estimate.area)} ft²\nHeating: ${formatWhole(estimate.heatBtuh)} BTU/hr (${formatFixed(estimate.heatMbh, 1)} MBH)\nCooling: ${formatWhole(estimate.coolBtuh)} BTU/hr (${formatFixed(estimate.coolTons, 2)} tons)\nRule-of-thumb screening only.`;

  return (
    <ToolPageShell
      eyebrow="Facility screening"
      title="Facility Load Screening"
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
            <Label htmlFor="load-sqft">Square footage</Label>
            <Input id="load-sqft" value={sqft} onChange={(event) => setSqft(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="load-scenario">Building condition</Label>
            <Select value={scenario} onValueChange={(value) => setScenario(value as LoadScenarioKey)}>
              <SelectTrigger id="load-scenario">
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

      <ResultSummary
        label="Estimated heating load"
        value={formatFixed(estimate.heatMbh, 1)}
        unit="MBH"
        detail={`${formatFixed(estimate.coolTons, 2)} cooling tons · ${formatWhole(estimate.area)} ft² · ${LOAD_SCENARIOS.find((item) => item.key === scenario)?.label}`}
        actions={<CalculationActions compact copyText={copyText} onReset={reset} />}
      />

      <Card><CardContent className="p-0"><Accordion type="multiple">
        <AccordionItem value="factors"><AccordionTrigger className="px-5">Advanced load factors</AccordionTrigger><AccordionContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="load-heating-factor">Heating factor override (BTU/hr per ft²)</Label><Input id="load-heating-factor" inputMode="decimal" value={heatingOverride} onChange={(event) => setHeatingOverride(event.target.value)} placeholder={String(estimate.defaultHeatingFactor)} /></div>
          <div className="space-y-2"><Label htmlFor="load-cooling-factor">Cooling factor override (BTU/hr per ft²)</Label><Input id="load-cooling-factor" inputMode="decimal" value={coolingOverride} onChange={(event) => setCoolingOverride(event.target.value)} placeholder={String(estimate.defaultCoolingFactor)} /></div>
        </AccordionContent></AccordionItem>
        <AccordionItem value="scenarios"><AccordionTrigger className="px-5">Compare building-condition scenarios</AccordionTrigger><AccordionContent className="space-y-5 px-5 pb-5" role="img" aria-label="Heating and cooling loads by building condition">
          <div className="flex gap-5 text-xs text-muted-foreground" aria-hidden="true"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Heating</span><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Cooling</span></div>
          {chartData.map((row) => <div key={row.name} className="space-y-2"><div className="text-sm font-medium">{row.name}</div><div className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-xs"><span className="text-muted-foreground">{formatWhole(row.heating)}</span><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-amber-500" style={{ width: `${(row.heating / maxChartLoad) * 100}%` }} /></div><span className="text-muted-foreground">{formatWhole(row.cooling)}</span><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${(row.cooling / maxChartLoad) * 100}%` }} /></div></div></div>)}
        </AccordionContent></AccordionItem>
        <AccordionItem value="equipment"><AccordionTrigger className="px-5">Typical gas appliance input ranges</AccordionTrigger><AccordionContent className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
          {APPLIANCE_ARCHETYPES.map((item) => <div key={item.key} className="rounded-xl border bg-muted/20 p-3"><div className="text-sm font-semibold">{item.name}</div><div className="mt-1 font-mono text-sm">{formatArchetypeRange(item.range)}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.note}</p></div>)}
        </AccordionContent></AccordionItem>
        <AccordionItem value="method"><AccordionTrigger className="px-5">How this is calculated</AccordionTrigger><AccordionContent className="space-y-2 px-5 pb-5 text-sm leading-6 text-muted-foreground"><p>Heating and cooling loads equal floor area multiplied by the selected rule-of-thumb load factors. Overrides replace only the selected scenario factors.</p><p>This is an early screen, not a weather-normalized or code-compliant equipment-sizing calculation.</p></AccordionContent></AccordionItem>
      </Accordion></CardContent></Card>
    </ToolPageShell>
  );
}
