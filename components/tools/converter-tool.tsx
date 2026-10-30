"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Flame, Gauge } from "lucide-react";

import { CalculationActions } from "@/components/calculation-actions";
import { ResultSummary } from "@/components/result-summary";
import { ToolPageShell } from "@/components/tool-page-shell";
import { useSharedGasHhv } from "@/components/use-shared-engineering-assumptions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateConverter, CONVERTER_UNIT_OPTIONS, type ConverterUnit, type EnergyReference } from "@/lib/converter";
import { formatFixed, formatWhole } from "@/lib/format";

const DEFAULTS = { value: "250000", unit: "BTU/hr" as ConverterUnit, reference: "input" as EnergyReference, efficiency: "90", hhv: "1.035", hours: "400" };

export function ConverterTool() {
  const [value, setValue] = useState(DEFAULTS.value);
  const [unit, setUnit] = useState<ConverterUnit>(DEFAULTS.unit);
  const [energyReference, setEnergyReference] = useState<EnergyReference>(DEFAULTS.reference);
  const [efficiencyPercent, setEfficiencyPercent] = useState(DEFAULTS.efficiency);
  const [hhv, setHhv] = useSharedGasHhv(DEFAULTS.hhv);
  const [hours, setHours] = useState(DEFAULTS.hours);
  const result = useMemo(() => calculateConverter({ value, unit, energyReference, efficiencyPercent, hhv, hours }), [energyReference, efficiencyPercent, hhv, hours, unit, value]);
  const valid = Number(value.replace(/,/g, "")) > 0 && Number(efficiencyPercent) > 0 && Number(efficiencyPercent) <= 100 && Number(hhv) > 0;
  const reset = () => { setValue(DEFAULTS.value); setUnit(DEFAULTS.unit); setEnergyReference(DEFAULTS.reference); setEfficiencyPercent(DEFAULTS.efficiency); setHhv(DEFAULTS.hhv); setHours(DEFAULTS.hours); };
  const copyText = `UtilityCalc gas demand\nInput: ${formatWhole(result.inputBtuh)} BTU/hr\nDelivered output: ${formatWhole(result.outputBtuh)} BTU/hr\nGas flow: ${formatWhole(result.cfh)} CFH (${formatFixed(result.mcfh, 3)} MCFH)\nUse: ${formatFixed(result.totalDth, 2)} Dth over ${formatWhole(result.hours)} hours`;

  return (
    <ToolPageShell eyebrow="Gas demand" title="Gas Demand & Conversions" description="Enter either equipment input or useful output. Gas demand, delivered load, and operating totals update together.">
      <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
        <div className="space-y-1.5"><Label htmlFor="converter-value">Demand value</Label><Input id="converter-value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} aria-invalid={!valid} /></div>
        <div className="space-y-1.5"><Label htmlFor="converter-unit">Unit</Label><Select value={unit} onValueChange={(next) => setUnit(next as ConverterUnit)}><SelectTrigger id="converter-unit"><SelectValue /></SelectTrigger><SelectContent>{CONVERTER_UNIT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="converter-reference">Value represents</Label><Select value={energyReference} onValueChange={(next) => setEnergyReference(next as EnergyReference)}><SelectTrigger id="converter-reference"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="input">Equipment fuel input</SelectItem><SelectItem value="output">Useful delivered output</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="converter-efficiency">Thermal efficiency (%)</Label><Input id="converter-efficiency" inputMode="decimal" value={efficiencyPercent} onChange={(event) => setEfficiencyPercent(event.target.value)} aria-invalid={!valid} /></div>
        <div className="flex items-end rounded-xl border bg-muted/25 p-3 text-sm"><div><span className="text-xs text-muted-foreground">Application band</span><p className="font-semibold">{result.category}</p></div></div>
      </CardContent></Card>

      {!valid ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Enter a positive demand and gas heating value; efficiency must be greater than 0% and no more than 100%.</p> : null}

      <ResultSummary label="Required gas flow" value={valid ? formatWhole(result.cfh) : "—"} unit="CFH" detail={`${formatFixed(result.mcfh, 3)} MCFH · ${formatFixed(result.dthPerHour, 3)} Dth/h · ${formatWhole(result.inputBtuh)} BTU/h input`} actions={<CalculationActions compact copyText={copyText} onReset={reset} />} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Flame />} label="Fuel input" value={`${formatWhole(result.inputBtuh)} BTU/h`} />
        <Metric icon={<ArrowRight />} label="Useful output" value={`${formatWhole(result.outputBtuh)} BTU/h`} />
        <Metric icon={<Gauge />} label="Therms per hour" value={formatFixed(result.thermsPerHour, 2)} />
        <Metric icon={<Gauge />} label="Dth over modeled hours" value={formatFixed(result.totalDth, 2)} />
      </section>

      <Card><CardContent className="p-0"><Accordion type="multiple">
        <AccordionItem value="assumptions"><AccordionTrigger className="px-5">Operating and gas assumptions</AccordionTrigger><AccordionContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="converter-hhv">Gas HHV (MMBtu/MCF)</Label><Input id="converter-hhv" inputMode="decimal" value={hhv} onChange={(event) => setHhv(event.target.value)} /><p className="text-xs text-muted-foreground">Reused locally in compatible calculators.</p></div>
          <div className="space-y-1.5"><Label htmlFor="converter-hours">Modeled operating hours</Label><Input id="converter-hours" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} /></div>
        </AccordionContent></AccordionItem>
        <AccordionItem value="detail"><AccordionTrigger className="px-5">Detailed conversions</AccordionTrigger><AccordionContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <Line label="Input MBH" value={formatWhole(result.inputMbtuPerHour)} /><Line label="Output kW thermal" value={formatFixed(result.kw, 1)} /><Line label="Cooling tons" value={formatFixed(result.tons, 2)} /><Line label="Steam MLB/h" value={formatFixed(result.mlbPerHour, 3)} /><Line label="Total MCF" value={formatFixed(result.totalMcf, 2)} /><Line label="Total therms" value={formatFixed(result.totalTherms, 1)} /><Line label="Total input MMBtu" value={formatFixed(result.totalInputBtus / 1_000_000, 2)} /><Line label="Total useful MMBtu" value={formatFixed(result.totalOutputBtus / 1_000_000, 2)} />
        </AccordionContent></AccordionItem>
        <AccordionItem value="method"><AccordionTrigger className="px-5">How this is calculated</AccordionTrigger><AccordionContent className="space-y-2 px-5 pb-5 text-sm leading-6 text-muted-foreground"><p>Useful output equals fuel input multiplied by thermal efficiency. When useful output is entered, required fuel input is useful output divided by efficiency.</p><p>Gas flow divides input BTU/h by the editable higher heating value. The default 1.035 MMBtu/MCF is a screening value; use the applicable billing factor when known.</p><p>This result is connected load only and does not size service pipe, regulators, pressure drop, or diversity.</p></AccordionContent></AccordionItem>
      </Accordion></CardContent></Card>
    </ToolPageShell>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><span className="text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>{label}</div><p className="mt-2 font-mono text-lg font-semibold">{value}</p></div>; }
function Line({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3 border-b pb-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-mono font-medium">{value}</span></div>; }
