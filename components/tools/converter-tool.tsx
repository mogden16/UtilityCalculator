"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Flame, Info, Zap } from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateConverter, CONVERTER_UNIT_OPTIONS, type ConverterUnit, type EnergyReference } from "@/lib/converter";
import { formatCurrency, formatFixed, formatWhole } from "@/lib/format";

const CATEGORY_STYLES = {
  Residential: "text-emerald-600",
  Commercial: "text-amber-600",
  Industrial: "text-rose-600",
} as const;

export function ConverterTool() {
  const [value, setValue] = useState("9000000");
  const [unit, setUnit] = useState<ConverterUnit>("BTU/hr");
  const [energyReference, setEnergyReference] = useState<EnergyReference>("output");
  const [efficiencyPercent, setEfficiencyPercent] = useState("90");
  const [hhv, setHhv] = useState("1.035");
  const [hours, setHours] = useState("500");

  const result = useMemo(
    () =>
      calculateConverter({
        value,
        unit,
        energyReference,
        efficiencyPercent,
        hhv,
        hours,
      }),
    [energyReference, efficiencyPercent, hhv, hours, unit, value],
  );

  return (
    <TooltipProvider>
      <ToolPageShell
        eyebrow="Primary Tool"
        title="Load Converter"
        description="Translate between fuel input, delivered output, and common thermal demand units. Totals update from the operating-hour assumption so the page can support quick annualized estimates."
      >
        <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-foreground">
            <Flame className="h-4 w-4" />
            <span>Input fuel</span>
          </div>
          <ArrowDown className="h-4 w-4 sm:hidden" />
          <ArrowRight className="hidden h-4 w-4 sm:block" />
          <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 font-medium text-foreground">
            Efficiency {formatWhole(result.efficiencyPercent)}%
          </div>
          <ArrowDown className="h-4 w-4 sm:hidden" />
          <ArrowRight className="hidden h-4 w-4 sm:block" />
          <div className="flex items-center gap-2 text-foreground">
            <Zap className="h-4 w-4" />
            <span>Delivered output</span>
          </div>
        </div>

        <Card>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="converter-value">Value</Label>
              <Input id="converter-value" value={value} onChange={(event) => setValue(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(next) => setUnit(next as ConverterUnit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONVERTER_UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Select value={energyReference} onValueChange={(next) => setEnergyReference(next as EnergyReference)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="input">Input fuel</SelectItem>
                  <SelectItem value="output">Delivered output</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="converter-efficiency">Efficiency (%)</Label>
              <Input
                id="converter-efficiency"
                value={efficiencyPercent}
                onChange={(event) => setEfficiencyPercent(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Application type</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-6">
                    Residential under 300,000 BTU/hr, commercial between 300,000 and 3,000,000 BTU/hr, industrial above
                    3,000,000 BTU/hr.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                className={`rounded-xl border border-border/70 px-4 py-3 text-sm font-semibold ${CATEGORY_STYLES[result.category]}`}
              >
                {result.category}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced" className="border-0">
                <AccordionTrigger className="px-6">Advanced assumptions</AccordionTrigger>
                <AccordionContent className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="converter-hhv">Gas HHV (MMBtu/MCF)</Label>
                    <Input id="converter-hhv" value={hhv} onChange={(event) => setHhv(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="converter-hours">Hours of operation</Label>
                    <Input id="converter-hours" value={hours} onChange={(event) => setHours(event.target.value)} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">Input demand</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="BTU/hr" value={formatWhole(result.inputBtuh)} />
                <MetricCard label="MBtu/hr" value={formatWhole(result.inputMbtuPerHour)} />
                <MetricCard label="CFH" value={formatWhole(result.cfh)} />
                <MetricCard label="Therm/hr" value={formatFixed(result.thermsPerHour, 2)} />
                <MetricCard label="Dth/hr" value={formatFixed(result.dthPerHour, 3)} />
                <MetricCard label="MCFH" value={formatFixed(result.mcfh, 3)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">Delivered output</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="BTU/hr" value={formatWhole(result.outputBtuh)} />
                <MetricCard label="kW" value={formatFixed(result.kw, 1)} />
                <MetricCard label="Tons" value={formatFixed(result.tons, 2)} />
                <MetricCard label="HP" value={formatFixed(result.hp, 1)} />
                <MetricCard label="Steam MLB/hr" value={formatFixed(result.mlbPerHour, 3)} />
                <MetricCard
                  label="Fuel to output ratio"
                  value={formatFixed(result.inputBtuh / Math.max(result.outputBtuh, 1), 2)}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">Fuel totals over time</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="BTU" value={formatWhole(result.totalInputBtus)} />
                <MetricCard label="MBtu" value={formatWhole(result.totalInputMbtu)} />
                <MetricCard label="MCF" value={formatFixed(result.totalMcf, 2)} />
                <MetricCard label="Therms" value={formatFixed(result.totalTherms, 1)} />
                <MetricCard label="Dth" value={formatFixed(result.totalDth, 2)} />
                <MetricCard label="Hours modeled" value={formatFixed(result.hours, 0)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">Delivered totals over time</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="BTU" value={formatWhole(result.totalOutputBtus)} />
                <MetricCard label="kWh" value={formatWhole(result.totalKwh)} />
                <MetricCard label="Ton-hours" value={formatFixed(result.totalTonHours, 1)} />
                <MetricCard label="Steam MLB" value={formatFixed(result.totalMlb, 2)} />
                <MetricCard
                  label="Estimated fuel cost"
                  value={formatCurrency(0)}
                  detail="Cost inputs are handled on the energy comparison route."
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </ToolPageShell>
    </TooltipProvider>
  );
}
