"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { CalculationActions } from "@/components/calculation-actions";
import { ResultSummary } from "@/components/result-summary";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculateChp,
  CHP_BUILDING_ARCHETYPES,
  CHP_TECHNOLOGIES,
  deriveSimpleChpInputs,
  type ChpBuildingType,
  type ChpTechnology,
} from "@/lib/chp";
import { formatCurrency, formatFixed, formatWhole } from "@/lib/format";

const DEFAULT_INPUTS = {
  buildingType: "hospital" as ChpBuildingType,
  annualElectricKwh: "12000000",
  annualGasDth: "85000",
  electricRatePerKwh: "0.12",
  gasRatePerDth: "11",
  technology: "recip_engine" as ChpTechnology,
  electricalEfficiencyPercent: "37",
  thermalEfficiencyPercent: "45",
  heatUtilizationPercent: "80",
  baselineThermalEfficiencyPercent: "82",
  maintenancePerKwh: "0.018",
  demandRatePerKwMonth: "0",
  standbyChargesAnnual: "0",
  installedCostPerKw: "2500",
  incentivePerKw: "0",
  peakDemandKw: "1800",
  thermalBaseloadMmbtuPerHour: "8",
  hoursOfOperation: "7000",
};

type Inputs = typeof DEFAULT_INPUTS;

function Field({ id, label, value, onChange, suffix }: { id: string; label: string; value: string; onChange: (value: string) => void; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} value={value} inputMode="decimal" onChange={(event) => onChange(event.target.value)} className={suffix ? "pr-14" : undefined} />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

export default function CHPCalculator() {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const update = <K extends keyof Inputs>(key: K, value: Inputs[K]) => setInputs((current) => ({ ...current, [key]: value }));

  const simple = useMemo(() => deriveSimpleChpInputs(inputs), [inputs]);
  const sizingInputs = mode === "simple" ? simple : inputs;
  const result = useMemo(
    () => calculateChp({ ...inputs, ...sizingInputs }),
    [inputs, sizingInputs],
  );

  function selectTechnology(value: ChpTechnology) {
    const technology = CHP_TECHNOLOGIES[value];
    setInputs((current) => ({
      ...current,
      technology: value,
      electricalEfficiencyPercent: String(technology.electricalEfficiency * 100),
      thermalEfficiencyPercent: String(technology.thermalEfficiency * 100),
      installedCostPerKw: String(technology.installedCostPerKw),
    }));
  }

  const copyText = [
    "UtilityCalc CHP preliminary screening",
    `Recommended size: ${formatWhole(result.recommendedKw)} kW`,
    `Annual generation: ${formatWhole(result.annualGenerationKwh)} kWh`,
    `Useful recovered heat: ${formatWhole(result.utilizedRecoveredHeatMmbtu)} MMBtu`,
    `Avoided boiler fuel: ${formatWhole(result.avoidedBoilerFuelDth)} Dth`,
    `Net annual savings: ${formatCurrency(result.annualSavings)}`,
    `Simple payback: ${Number.isFinite(result.simplePaybackYears) ? `${formatFixed(result.simplePaybackYears, 1)} years` : "No payback"}`,
    "Preliminary screening only; verify load profiles, tariffs, interconnection, and vendor data.",
  ].join("\n");

  return (
    <ToolPageShell
      eyebrow="Onsite generation"
      title="CHP Feasibility"
      description="Size against coincident electric and useful thermal loads, then screen operating savings and simple payback."
    >
      <div className="flex gap-2" role="group" aria-label="CHP input mode">
        <Button variant={mode === "simple" ? "default" : "outline"} onClick={() => setMode("simple")}>Quick screen</Button>
        <Button variant={mode === "advanced" ? "default" : "outline"} onClick={() => setMode("advanced")}>Detailed inputs</Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="chp-building">Facility type</Label>
            <Select value={inputs.buildingType} onValueChange={(value) => update("buildingType", value as ChpBuildingType)}>
              <SelectTrigger id="chp-building"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CHP_BUILDING_ARCHETYPES).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Field id="chp-electric" label="Annual electricity" value={inputs.annualElectricKwh} onChange={(value) => update("annualElectricKwh", value)} suffix="kWh" />
          <Field id="chp-gas" label="Annual gas" value={inputs.annualGasDth} onChange={(value) => update("annualGasDth", value)} suffix="Dth" />
          <Field id="chp-electric-rate" label="Blended electric rate" value={inputs.electricRatePerKwh} onChange={(value) => update("electricRatePerKwh", value)} suffix="$/kWh" />
          <Field id="chp-gas-rate" label="Gas rate" value={inputs.gasRatePerDth} onChange={(value) => update("gasRatePerDth", value)} suffix="$/Dth" />
          <div className="space-y-1.5">
            <Label htmlFor="chp-technology">Technology</Label>
            <Select value={inputs.technology} onValueChange={(value) => selectTechnology(value as ChpTechnology)}>
              <SelectTrigger id="chp-technology"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CHP_TECHNOLOGIES).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <ResultSummary
        label="Recommended CHP size"
        value={formatWhole(result.recommendedKw)}
        unit="kW"
        detail={`${formatWhole(result.annualGenerationKwh)} kWh/year · ${formatWhole(result.utilizedRecoveredHeatMmbtu)} MMBtu/year useful recovered heat · ${formatFixed(result.electricOffsetPercent, 1)}% electric offset`}
        actions={<CalculationActions compact copyText={copyText} onReset={() => setInputs(DEFAULT_INPUTS)} />}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="CHP key economics">
        <Metric label="Annual savings" value={formatCurrency(result.annualSavings)} accent />
        <Metric label="Simple payback" value={Number.isFinite(result.simplePaybackYears) ? `${formatFixed(result.simplePaybackYears, 1)} years` : "No payback"} />
        <Metric label="Net capital" value={formatCurrency(result.netCapitalCost)} />
        <Metric label="Net added gas" value={`${formatWhole(result.netIncrementalGasDth)} Dth/yr`} />
      </section>

      <Card>
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={mode === "advanced" ? ["performance"] : []}>
            <AccordionItem value="performance">
              <AccordionTrigger className="px-5">Performance and load assumptions</AccordionTrigger>
              <AccordionContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
                {mode === "advanced" ? <>
                  <Field id="chp-peak" label="Peak demand" value={inputs.peakDemandKw} onChange={(value) => update("peakDemandKw", value)} suffix="kW" />
                  <Field id="chp-thermal-base" label="Useful thermal baseload" value={inputs.thermalBaseloadMmbtuPerHour} onChange={(value) => update("thermalBaseloadMmbtuPerHour", value)} suffix="MMBtu/h" />
                  <Field id="chp-hours" label="Operating hours" value={inputs.hoursOfOperation} onChange={(value) => update("hoursOfOperation", value)} suffix="hr/yr" />
                </> : <div className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">Quick screen derives {formatWhole(simple.peakDemandKw)} kW peak, {formatFixed(simple.thermalBaseloadMmbtuPerHour, 2)} MMBtu/h thermal baseload, and {formatWhole(simple.hoursOfOperation)} annual hours from the selected facility profile and annual use.</div>}
                <Field id="chp-electric-eff" label="Electrical efficiency" value={inputs.electricalEfficiencyPercent} onChange={(value) => update("electricalEfficiencyPercent", value)} suffix="%" />
                <Field id="chp-thermal-eff" label="Recoverable thermal efficiency" value={inputs.thermalEfficiencyPercent} onChange={(value) => update("thermalEfficiencyPercent", value)} suffix="%" />
                <Field id="chp-heat-use" label="Recoverable heat utilized" value={inputs.heatUtilizationPercent} onChange={(value) => update("heatUtilizationPercent", value)} suffix="%" />
                <Field id="chp-boiler-eff" label="Baseline boiler efficiency" value={inputs.baselineThermalEfficiencyPercent} onChange={(value) => update("baselineThermalEfficiencyPercent", value)} suffix="%" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="economics">
              <AccordionTrigger className="px-5">Detailed economics</AccordionTrigger>
              <AccordionContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-5">
                <Field id="chp-maintenance" label="Maintenance" value={inputs.maintenancePerKwh} onChange={(value) => update("maintenancePerKwh", value)} suffix="$/kWh" />
                <Field id="chp-demand-rate" label="Avoidable demand rate" value={inputs.demandRatePerKwMonth} onChange={(value) => update("demandRatePerKwMonth", value)} suffix="$/kW-mo" />
                <Field id="chp-standby" label="Standby/other charges" value={inputs.standbyChargesAnnual} onChange={(value) => update("standbyChargesAnnual", value)} suffix="$/yr" />
                <Field id="chp-capital" label="Installed cost" value={inputs.installedCostPerKw} onChange={(value) => update("installedCostPerKw", value)} suffix="$/kW" />
                <Field id="chp-incentive" label="Eligible incentive" value={inputs.incentivePerKw} onChange={(value) => update("incentivePerKw", value)} suffix="$/kW" />
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-5">Incentives default to zero. Enter only documented, project-eligible incentives; no tax credit is applied automatically.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="detail">
              <AccordionTrigger className="px-5">Energy and savings detail</AccordionTrigger>
              <AccordionContent className="grid gap-x-6 gap-y-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
                <Line label="CHP fuel input" value={`${formatWhole(result.chpFuelInputDth)} Dth/yr`} />
                <Line label="Available recovered heat" value={`${formatWhole(result.availableRecoveredHeatMmbtu)} MMBtu/yr`} />
                <Line label="Utilized recovered heat" value={`${formatWhole(result.utilizedRecoveredHeatMmbtu)} MMBtu/yr (${formatFixed(result.heatUtilizationPercent, 1)}%)`} />
                <Line label="Avoided boiler fuel" value={`${formatWhole(result.avoidedBoilerFuelDth)} Dth/yr`} />
                <Line label="Residual boiler fuel" value={`${formatWhole(result.residualBoilerFuelDth)} Dth/yr`} />
                <Line label="Electric energy avoided" value={formatCurrency(result.avoidedElectricEnergyCost)} />
                <Line label="Demand cost avoided" value={formatCurrency(result.avoidedDemandCost)} />
                <Line label="Incremental gas cost" value={formatCurrency(result.incrementalGasCost)} />
                <Line label="Maintenance" value={formatCurrency(result.maintenanceCost)} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="method">
              <AccordionTrigger className="px-5">How this is calculated</AccordionTrigger>
              <AccordionContent className="space-y-3 px-5 pb-5 text-sm leading-6 text-muted-foreground">
                <p>CHP size is limited by average electric load, 80% of peak demand, and the thermal baseload that can accept recovered heat. Fuel input follows the selected electrical efficiency.</p>
                <p>Only recovered heat that is both available and usable displaces boiler output. Avoided boiler fuel divides useful recovered heat by the baseline boiler efficiency; remaining baseline fuel is retained.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>Preliminary screening estimate.</strong> Hourly load profiles, tariffs, standby service, interconnection, emissions permitting, thermal integration, and vendor performance can materially change the result.</p>
      </div>
    </ToolPageShell>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "bg-card"}`}><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-semibold">{value}</p></div>;
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b pb-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-mono font-medium">{value}</span></div>;
}
