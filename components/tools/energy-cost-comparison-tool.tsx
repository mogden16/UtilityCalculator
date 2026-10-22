"use client";

import { useMemo, useState } from "react";

import { ToolPageShell } from "@/components/tool-page-shell";
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
          <Label htmlFor={`${idPrefix}-efficiency`}>Delivered efficiency</Label>
          <Input
            id={`${idPrefix}-efficiency`}
            value={state.efficiency}
            onChange={(event) => onChange({ ...state, efficiency: event.target.value })}
            placeholder="0.90"
          />
          <p className="text-xs text-muted-foreground">Enter a decimal, COP, or percent such as 0.90, 3.20, or 90.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnergyCostComparisonTool() {
  const [hhv, setHhv] = useState(String(DEFAULT_HHV_MMBTU_PER_MCF));
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

  return (
    <ToolPageShell
      eyebrow="Primary Tool"
      title="Energy Cost Comparison"
      description="Convert known fuel use into the amount and cost of another energy source needed to deliver the same useful heat."
    >
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="energy-hhv">Gas HHV (MMBtu/MCF)</Label>
            <Input id="energy-hhv" value={hhv} onChange={(event) => setHhv(event.target.value)} />
            <p className="text-xs text-muted-foreground">
              Adjust this if your gas tariff uses a different billing factor.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="energy-usage">Known primary-source usage</Label>
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
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Normalized cost table</h2>
            <p className="text-sm text-muted-foreground">
              Rates are converted to dollars per MMBtu of input energy, then adjusted for delivered efficiency.
            </p>
          </div>

          <div className="overflow-x-auto">
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

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="text-sm font-medium text-foreground">{narrative.headline}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{narrative.detail}</p>
          </div>
        </CardContent>
      </Card>
    </ToolPageShell>
  );
}
