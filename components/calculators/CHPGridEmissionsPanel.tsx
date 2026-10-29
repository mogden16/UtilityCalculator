"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleOff, RefreshCw } from "lucide-react";

import { CalculationActions } from "@/components/calculation-actions";
import { ResultSummary } from "@/components/result-summary";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_T_AND_D_LOSS_FRACTION,
  LEAK_SCENARIOS,
  compareHeatingEmissions,
  computeFuelEmissionsRows,
  computeGasEmissionsForScenario,
  mapPjmFuelToFuelKey,
  type FuelKey,
  type LeakScenarioKey,
} from "@/lib/emissions";
import { formatFixed, formatWhole } from "@/lib/format";

type GridMixEntry = { label: string; value: number; mw: number };
type PjmResponse = { carbonIntensity: number | null; carbonIntensityUnits: string; gridMix: GridMixEntry[]; totalMw?: number; timestamp: string | null; source: string; error?: string };

const LIVE_REDISTRIBUTION_AUTHORIZED = process.env.NEXT_PUBLIC_PJM_REDISTRIBUTION_AUTHORIZED === "true";

export function CHPGridEmissionsPanel() {
  const [data, setData] = useState<PjmResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualGridFactor, setManualGridFactor] = useState("");
  const [deliveredHeat, setDeliveredHeat] = useState("100");
  const [gasEfficiency, setGasEfficiency] = useState("90");
  const [heatPumpCop, setHeatPumpCop] = useState("3.0");
  const [leakScenario, setLeakScenario] = useState<LeakScenarioKey>("medium");

  async function loadPjmData() {
    if (!LIVE_REDISTRIBUTION_AUTHORIZED) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/pjm-gen-emissions", { cache: "no-store" });
      const payload = (await response.json()) as PjmResponse;
      if (!response.ok) throw new Error(payload.error || `PJM request failed (${response.status})`);
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Live PJM data is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (LIVE_REDISTRIBUTION_AUTHORIZED) void loadPjmData();
  }, []);

  const fuelRows = useMemo(() => (data?.gridMix ?? []).map((entry) => ({
    fuelKey: mapPjmFuelToFuelKey(entry.label) as FuelKey,
    label: entry.label,
    mw: entry.mw > 0 ? entry.mw : ((data?.totalMw ?? 0) * entry.value) / 100,
  })).filter((row) => row.mw > 0), [data]);
  const gridSummary = useMemo(() => computeFuelEmissionsRows(fuelRows, DEFAULT_T_AND_D_LOSS_FRACTION), [fuelRows]);
  const timestamp = data?.timestamp ? new Date(data.timestamp) : null;
  const stale = timestamp ? Date.now() - timestamp.getTime() > 60 * 60 * 1_000 : false;
  const liveFactor = typeof data?.carbonIntensity === "number"
    ? data.carbonIntensity / (1 - DEFAULT_T_AND_D_LOSS_FRACTION)
    : gridSummary.isComplete && gridSummary.totalDeliveredLbPerMwh > 0
      ? gridSummary.totalDeliveredLbPerMwh
      : 0;
  const enteredFactor = Number(manualGridFactor);
  const gridFactor = liveFactor > 0 ? liveFactor : Number.isFinite(enteredFactor) && enteredFactor > 0 ? enteredFactor : 0;
  const gas = useMemo(() => computeGasEmissionsForScenario(leakScenario), [leakScenario]);
  const comparison = useMemo(() => compareHeatingEmissions({
    deliveredHeatMmbtu: Number(deliveredHeat) || 0,
    gasEfficiency: (Number(gasEfficiency) || 0) / 100,
    heatPumpCop: Number(heatPumpCop) || 0,
    gridLbCo2ePerMwh: gridFactor,
    upstreamGasLbCo2ePerMmbtu: gas.methaneCo2eLbPerMmbtu,
  }), [deliveredHeat, gas.methaneCo2eLbPerMmbtu, gasEfficiency, gridFactor, heatPumpCop]);
  const hasGridFactor = gridFactor > 0;
  const electricLower = hasGridFactor && comparison.gridAverageLb < comparison.totalGasLb;
  const difference = hasGridFactor ? Math.abs(comparison.gridAverageLb - comparison.totalGasLb) : 0;
  const reset = () => { setManualGridFactor(""); setDeliveredHeat("100"); setGasEfficiency("90"); setHeatPumpCop("3.0"); setLeakScenario("medium"); };
  const copyText = `UtilityCalc equal-heat emissions screen\nDelivered heat: ${formatFixed(comparison.deliveredHeatMmbtu, 1)} MMBtu\nGas direct combustion: ${formatWhole(comparison.directGasLb)} lb CO2\nGas upstream assumption: ${formatWhole(comparison.upstreamGasLb)} lb CO2e\nHeat-pump grid average: ${hasGridFactor ? `${formatWhole(comparison.gridAverageLb)} lb CO2e` : "grid factor required"}`;

  return (
    <div className="space-y-4">
      <Card><CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex gap-3">
          {LIVE_REDISTRIBUTION_AUTHORIZED ? <RefreshCw className="mt-0.5 h-5 w-5 text-primary" /> : <CircleOff className="mt-0.5 h-5 w-5 text-amber-600" />}
          <div><p className="font-semibold">PJM live data: {LIVE_REDISTRIBUTION_AUTHORIZED ? (error ? "unavailable" : stale ? "stale" : data ? "live" : "loading") : "not displayed"}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{LIVE_REDISTRIBUTION_AUTHORIZED ? "Live display is enabled for an authorized deployment. Timestamp and freshness are shown with the result." : "Public redistribution is disabled by default because PJM Data Miner terms require applicable membership or redistribution authorization. Enter a documented grid-average factor below for screening."}</p></div>
        </div>
        <Button variant="outline" disabled={!LIVE_REDISTRIBUTION_AUTHORIZED || loading} onClick={() => void loadPjmData()}>{loading ? "Refreshing…" : "Refresh licensed feed"}</Button>
      </CardContent></Card>

      <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <Field id="emissions-heat" label="Delivered heat" value={deliveredHeat} onChange={setDeliveredHeat} suffix="MMBtu" />
        <Field id="emissions-gas-eff" label="Combustion efficiency" value={gasEfficiency} onChange={setGasEfficiency} suffix="%" />
        <Field id="emissions-cop" label="Heat pump COP" value={heatPumpCop} onChange={setHeatPumpCop} />
        <Field id="emissions-grid" label="Grid average factor" value={liveFactor > 0 ? formatFixed(liveFactor, 1) : manualGridFactor} onChange={setManualGridFactor} suffix="lb/MWh" disabled={liveFactor > 0} />
        <div className="min-w-0 space-y-1.5"><Label htmlFor="emissions-upstream">Upstream gas scenario</Label><Select value={leakScenario} onValueChange={(value) => setLeakScenario(value as LeakScenarioKey)}><SelectTrigger id="emissions-upstream" className="w-full min-w-0 max-w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(LEAK_SCENARIOS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      </CardContent></Card>

      <ResultSummary label="Lower modeled emissions" value={hasGridFactor ? (electricLower ? "Heat pump" : "Natural gas") : "Grid factor required"} detail={hasGridFactor ? `${formatWhole(difference)} lb CO2e difference for ${formatFixed(comparison.deliveredHeatMmbtu, 1)} MMBtu of delivered heat. This is a grid-average comparison, not a marginal-emissions claim.` : "Enter a documented grid-average emissions factor to complete the equal-delivered-heat comparison."} actions={<CalculationActions compact copyText={copyText} onReset={reset} />} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Direct gas combustion" value={`${formatWhole(comparison.directGasLb)} lb CO2`} detail={`${formatFixed(comparison.gasInputMmbtu, 1)} MMBtu fuel input`} />
        <Metric label="Upstream gas assumption" value={`${formatWhole(comparison.upstreamGasLb)} lb CO2e`} detail="Shown separately from direct combustion" />
        <Metric label="Grid-average heat pump" value={hasGridFactor ? `${formatWhole(comparison.gridAverageLb)} lb CO2e` : "—"} detail={`${formatWhole(comparison.electricInputKwh)} kWh at COP ${heatPumpCop}`} />
      </section>

      {gridSummary.unknownMw > 0 ? <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="h-5 w-5 shrink-0" /><p>{formatWhole(gridSummary.unknownMw)} MW is unclassified. It is not assigned a zero-emission factor, so the fuel-mix-derived average is incomplete.</p></div> : null}
      {error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      <Card><CardContent className="p-0"><Accordion type="multiple">
        <AccordionItem value="inputs"><AccordionTrigger className="px-5">Inputs and assumptions used</AccordionTrigger><AccordionContent className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4"><Line label="Delivered heat" value={`${formatFixed(comparison.deliveredHeatMmbtu, 1)} MMBtu`} /><Line label="Gas efficiency" value={`${gasEfficiency}%`} /><Line label="Heat pump COP" value={heatPumpCop} /><Line label="Grid average" value={hasGridFactor ? `${formatFixed(gridFactor, 1)} lb/MWh` : "Not entered"} /><Line label="Direct gas factor" value={`${formatFixed(gas.directCo2LbPerMmbtu, 1)} lb/MMBtu`} /><Line label="Upstream assumption" value={`${formatFixed(gas.methaneCo2eLbPerMmbtu, 1)} lb CO2e/MMBtu`} /></AccordionContent></AccordionItem>
        <AccordionItem value="method"><AccordionTrigger className="px-5">How this is calculated, sources, and uncertainty</AccordionTrigger><AccordionContent className="space-y-3 px-5 pb-5 text-sm leading-6 text-muted-foreground"><p>Both options deliver the same useful heat. Gas input equals delivered heat divided by thermal efficiency. Heat-pump electricity equals delivered heat converted to kWh and divided by COP.</p><p>Direct natural-gas combustion uses a rounded 117 lb CO2/MMBtu screening factor. Upstream methane is scenario-based and is displayed separately. Grid electricity uses the entered or licensed live grid-average factor plus a 5% delivery-loss assumption.</p><p>Sources reviewed October 2026: U.S. EPA 2025 GHG Emission Factors Hub, U.S. EIA Energy Units and Calculators Explained, and PJM Data Miner API Guide dated February 10, 2026. Replace defaults with project-specific, current sources for reporting. Fuel-mix averages do not support a marginal-emissions claim; marginal emissions are intentionally not calculated here.</p></AccordionContent></AccordionItem>
        <AccordionItem value="pjm"><AccordionTrigger className="px-5">PJM data status and licensing</AccordionTrigger><AccordionContent className="space-y-2 px-5 pb-5 text-sm leading-6 text-muted-foreground"><p>PJM’s Data Miner page states that redistribution is prohibited without applicable membership or a redistribution license. This public build therefore does not request or display the feed unless <code>NEXT_PUBLIC_PJM_REDISTRIBUTION_AUTHORIZED=true</code> is set after authorization is documented.</p>{timestamp ? <p>Feed timestamp: {timestamp.toLocaleString()} · status: {stale ? "stale (older than 60 minutes)" : "current"} · source: {data?.source}</p> : null}</AccordionContent></AccordionItem>
      </Accordion></CardContent></Card>
    </div>
  );
}

function Field({ id, label, value, onChange, suffix, disabled = false }: { id: string; label: string; value: string; onChange: (value: string) => void; suffix?: string; disabled?: boolean }) { return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label><div className="relative min-w-0"><Input id={id} disabled={disabled} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className={suffix ? "pr-16" : undefined} />{suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span> : null}</div></div>; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-semibold">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>; }
function Line({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3 border-b pb-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-mono font-medium">{value}</span></div>; }
