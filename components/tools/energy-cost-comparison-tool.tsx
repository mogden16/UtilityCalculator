"use client";

import { useMemo, useState } from "react";

import { CalculationActions } from "@/components/calculation-actions";
import { ResultSummary } from "@/components/result-summary";
import { ToolPageShell } from "@/components/tool-page-shell";
import { useSharedGasHhv } from "@/components/use-shared-engineering-assumptions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildComparisonNarrative,
  computeEnergyComparison,
  ENERGY_UNIT_ENTRIES,
  formatEfficiency,
  getComparisonMetrics,
  LABEL_OPTIONS,
  PRESET_SOURCE_METADATA,
  type EnergyUnit,
  type RateSourceInput,
} from "@/lib/energy-comparison";
import { DEFAULT_HHV_MMBTU_PER_MCF } from "@/lib/energy";
import { formatCurrency, formatFixed } from "@/lib/format";

function SourceCard({
  idPrefix,
  title,
  state,
  onChange,
}: {
  idPrefix: string;
  title: string;
  state: RateSourceInput;
  onChange: (next: RateSourceInput) => void;
}) {
  const isPreset = LABEL_OPTIONS.includes(state.name as (typeof LABEL_OPTIONS)[number]);
  const selectValue = isPreset ? state.name : "Custom";
  const isHeatPump = state.name.toLowerCase().includes("heat pump");

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Presets preload a representative delivered efficiency that you can override.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-source-preset`}>Source label</Label>
          <Select
            value={selectValue}
            onValueChange={(value) => {
              if (value === "Custom") {
                onChange({ ...state, name: isPreset ? "" : state.name });
                return;
              }

              const defaults = PRESET_SOURCE_METADATA[value as keyof typeof PRESET_SOURCE_METADATA];
              onChange({
                ...state,
                name: value,
                efficiency: formatEfficiency(defaults?.defaultEfficiency ?? 1),
                rateUnit: defaults?.defaultRateUnit ?? state.rateUnit,
              });
            }}
          >
            <SelectTrigger id={`${idPrefix}-source-preset`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABEL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {selectValue === "Custom" ? (
            <Input
              id={`${idPrefix}-source-custom`}
              aria-label={`${title} custom source label`}
              value={state.name}
              onChange={(event) => onChange({ ...state, name: event.target.value })}
              placeholder="Custom source label"
            />
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-rate`}>Rate</Label>
            <Input id={`${idPrefix}-rate`} value={state.rate} onChange={(event) => onChange({ ...state, rate: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-rate-unit`}>Rate unit</Label>
            <Select
              value={state.rateUnit}
              onValueChange={(value) => onChange({ ...state, rateUnit: value as EnergyUnit })}
            >
              <SelectTrigger id={`${idPrefix}-rate-unit`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENERGY_UNIT_ENTRIES.map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.rateLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ENERGY_UNIT_ENTRIES.find(([key]) => key === state.rateUnit)?.[1].description}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-efficiency`}>{isHeatPump ? "Coefficient of performance (COP)" : "Thermal efficiency"}</Label>
          <Input
            id={`${idPrefix}-efficiency`}
            value={state.efficiency}
            onChange={(event) => onChange({ ...state, efficiency: event.target.value })}
            placeholder="0.90"
          />
          <p className="text-xs text-muted-foreground">
            {isHeatPump ? "COP is useful heat output divided by electric input (for example, 3.20)." : "Efficiency is useful heat divided by fuel input (for example, 0.90 or 90%)."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnergyCostComparisonTool() {
  const [hhv, setHhv] = useSharedGasHhv(String(DEFAULT_HHV_MMBTU_PER_MCF));
  const [usageValue, setUsageValue] = useState("10");
  const [usageUnit, setUsageUnit] = useState<EnergyUnit>("mcf");
  const [sourceA, setSourceA] = useState<RateSourceInput>({
    name: "Natural Gas Furnace",
    rate: "12.00",
    rateUnit: "mcf",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Natural Gas Furnace"].defaultEfficiency ?? 0.9),
  });
  const [sourceB, setSourceB] = useState<RateSourceInput>({
    name: "Fuel Oil Boiler",
    rate: "4.00",
    rateUnit: "oil_gallon",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Fuel Oil Boiler"].defaultEfficiency ?? 0.87),
  });
  const [capitalCostDifference, setCapitalCostDifference] = useState("0");

  const summaries = useMemo(
    () => computeEnergyComparison(sourceA, sourceB, usageValue, usageUnit, hhv),
    [hhv, sourceA, sourceB, usageUnit, usageValue],
  );
  const summaryA = summaries.primary;
  const summaryB = summaries.comparison;
  const comparison = useMemo(() => getComparisonMetrics(summaryA, summaryB), [summaryA, summaryB]);
  const narrative = useMemo(
    () => buildComparisonNarrative(summaryA, summaryB, comparison),
    [comparison, summaryA, summaryB],
  );
  const annualSavings = summaryA.totalCost - summaryB.totalCost;
  const capitalCost = Math.max(0, Number(capitalCostDifference.replace(/[,$\s]/g, "")) || 0);
  const payback = annualSavings > 0 && capitalCost > 0 ? capitalCost / annualSavings : Number.POSITIVE_INFINITY;
  const reset = () => {
    setHhv(String(DEFAULT_HHV_MMBTU_PER_MCF));
    setUsageValue("10");
    setUsageUnit("mcf");
    setSourceA({ name: "Natural Gas Furnace", rate: "12.00", rateUnit: "mcf", efficiency: "0.90" });
    setSourceB({ name: "Fuel Oil Boiler", rate: "4.00", rateUnit: "oil_gallon", efficiency: "0.87" });
    setCapitalCostDifference("0");
  };
  const copyText = `${summaryA.name} vs ${summaryB.name}\nDelivered load: ${formatFixed(summaryA.deliveredMMBtu, 2)} MMBtu\n${summaryA.name}: ${formatCurrency(summaryA.totalCost)}\n${summaryB.name}: ${formatCurrency(summaryB.totalCost)}\nSavings with ${summaryB.name}: ${formatCurrency(annualSavings)}`;

  return (
    <ToolPageShell
      eyebrow="Customer energy"
      title="Customer Energy Comparison"
      description="Convert known fuel use into the amount and cost of another energy source needed to deliver the same useful heat."
    >
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="energy-hhv">Gas HHV (MMBtu/MCF)</Label>
            <Input id="energy-hhv" value={hhv} onChange={(event) => setHhv(event.target.value)} />
            <p className="text-xs text-muted-foreground">
              Adjust this if your gas tariff uses a different billing factor. This non-customer assumption is reused locally in compatible tools.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="energy-usage">Annual primary-source usage</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input id="energy-usage" value={usageValue} onChange={(event) => setUsageValue(event.target.value)} />
              <Select value={usageUnit} onValueChange={(value) => setUsageUnit(value as EnergyUnit)}>
                <SelectTrigger id="energy-usage-unit" aria-label="Known usage unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENERGY_UNIT_ENTRIES.map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              This is fuel consumed, not heat already delivered. Primary efficiency is applied before comparison.
            </p>
          </div>
        </CardContent>
      </Card>

      <ResultSummary
        label={`Equivalent ${summaryB.name} use`}
        value={formatFixed(summaryB.equivalentUsage, 2)}
        unit={ENERGY_UNIT_ENTRIES.find(([key]) => key === summaryB.equivalentUsageUnit)?.[1].label}
        detail={`${formatFixed(summaryA.deliveredMMBtu, 2)} MMBtu useful heat · ${summaryB.name} cost ${formatCurrency(summaryB.totalCost)} · ${annualSavings >= 0 ? "Savings" : "Added cost"} ${formatCurrency(Math.abs(annualSavings))}`}
        actions={<CalculationActions compact copyText={copyText} onReset={reset} />}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SourceCard idPrefix="primary" title="Primary source" state={sourceA} onChange={setSourceA} />
        <SourceCard idPrefix="comparison" title="Comparison source" state={sourceB} onChange={setSourceB} />
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Equivalent {summaryB.name} usage</p>
            <p className="text-3xl font-semibold tracking-tight">
              {formatFixed(summaryB.equivalentUsage, 2)} {ENERGY_UNIT_ENTRIES.find(([key]) => key === summaryB.equivalentUsageUnit)?.[1].label}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {formatFixed(Number(usageValue.replace(/[,\s]/g, "")) || 0, 2)} {ENERGY_UNIT_ENTRIES.find(([key]) => key === usageUnit)?.[1].label} of {summaryA.name} at {formatFixed(summaryA.efficiency * 100, 1)}% efficiency delivers {formatFixed(summaryA.deliveredMMBtu, 2)} MMBtu. {summaryB.name} at {formatFixed(summaryB.efficiency * 100, 1)}% requires {formatFixed(summaryB.inputMMBtu, 2)} MMBtu of input energy.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              No. 2 oil uses 138,500 BTU/gal, the U.S. EIA heating-oil conversion factor. Adjust the gas HHV and both equipment efficiencies to match the bill and installed equipment.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Equal useful heat basis
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="equipment-capital">Incremental equipment capital cost</Label>
            <Input id="equipment-capital" inputMode="decimal" value={capitalCostDifference} onChange={(event) => setCapitalCostDifference(event.target.value)} />
          </div>
          <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Annual savings</p><p className="mt-2 font-mono text-xl font-semibold">{formatCurrency(annualSavings)}</p></div>
          <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Simple payback</p><p className="mt-2 font-mono text-xl font-semibold">{Number.isFinite(payback) ? `${formatFixed(payback, 1)} years` : "—"}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Normalized cost table</h2>
            <p className="text-sm text-muted-foreground">
              Rates are converted to dollars per MMBtu of input energy, then adjusted for delivered efficiency.
            </p>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Rate ($/MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Equivalent usage</th>
                  <th className="px-3 py-2 font-medium">Input energy (MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Delivered load (MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Total cost</th>
                  <th className="px-3 py-2 font-medium">Cost per delivered MMBtu</th>
                </tr>
              </thead>
              <tbody>
                {[summaryA, summaryB].map((row) => (
                  <tr key={row.name} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(row.ratePerMMBtu)}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatFixed(row.equivalentUsage, 2)} {ENERGY_UNIT_ENTRIES.find(([key]) => key === row.equivalentUsageUnit)?.[1].label}
                    </td>
                    <td className="px-3 py-2 font-mono">{formatFixed(row.inputMMBtu, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatFixed(row.deliveredMMBtu, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(row.totalCost)}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(row.costPerDelivered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {[summaryA, summaryB].map((row) => (
              <div key={row.name} className="rounded-xl border bg-muted/20 p-4 text-sm">
                <p className="font-semibold">{row.name}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <dt className="text-muted-foreground">Equivalent use</dt><dd className="text-right font-mono">{formatFixed(row.equivalentUsage, 2)} {ENERGY_UNIT_ENTRIES.find(([key]) => key === row.equivalentUsageUnit)?.[1].label}</dd>
                  <dt className="text-muted-foreground">Total cost</dt><dd className="text-right font-mono">{formatCurrency(row.totalCost)}</dd>
                  <dt className="text-muted-foreground">$/delivered MMBtu</dt><dd className="text-right font-mono">{formatCurrency(row.costPerDelivered)}</dd>
                </dl>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="text-sm font-medium text-foreground">{narrative.headline}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{narrative.detail}</p>
          </div>
        </CardContent>
      </Card>
    </ToolPageShell>
  );
}
