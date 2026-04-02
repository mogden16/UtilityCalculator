"use client";

import { useMemo, useState } from "react";

import { ToolPageShell } from "@/components/tool-page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildComparisonNarrative,
  computeEnergySummary,
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
  title,
  state,
  onChange,
}: {
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
          <Label>Source label</Label>
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
              });
            }}
          >
            <SelectTrigger>
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
              value={state.name}
              onChange={(event) => onChange({ ...state, name: event.target.value })}
              placeholder="Custom source label"
            />
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Rate</Label>
            <Input value={state.rate} onChange={(event) => onChange({ ...state, rate: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Rate unit</Label>
            <Select
              value={state.rateUnit}
              onValueChange={(value) => onChange({ ...state, rateUnit: value as EnergyUnit })}
            >
              <SelectTrigger>
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
          <Label>Delivered efficiency</Label>
          <Input
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
  const [usageValue, setUsageValue] = useState("1200");
  const [usageUnit, setUsageUnit] = useState<EnergyUnit>("therm");
  const [sourceA, setSourceA] = useState<RateSourceInput>({
    name: "Natural Gas Furnace",
    rate: "1.20",
    rateUnit: "therm",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Natural Gas Furnace"].defaultEfficiency ?? 0.9),
  });
  const [sourceB, setSourceB] = useState<RateSourceInput>({
    name: "Electric Resistance",
    rate: "0.18",
    rateUnit: "kwh",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Electric Resistance"].defaultEfficiency ?? 1),
  });

  const summaryA = useMemo(
    () => computeEnergySummary(sourceA, usageValue, usageUnit, hhv),
    [hhv, sourceA, usageUnit, usageValue],
  );
  const summaryB = useMemo(
    () => computeEnergySummary(sourceB, usageValue, usageUnit, hhv),
    [hhv, sourceB, usageUnit, usageValue],
  );
  const comparison = useMemo(() => getComparisonMetrics(summaryA, summaryB), [summaryA, summaryB]);
  const narrative = useMemo(
    () => buildComparisonNarrative(summaryA, summaryB, comparison),
    [comparison, summaryA, summaryB],
  );

  return (
    <ToolPageShell
      eyebrow="Primary Tool"
      title="Energy Cost Comparison"
      description="Normalize billing units to delivered MMBtu so unlike energy sources can be compared on the same useful-load basis."
    >
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Gas HHV (MMBtu/MCF)</Label>
            <Input value={hhv} onChange={(event) => setHhv(event.target.value)} />
            <p className="text-xs text-muted-foreground">
              Adjust this if your gas tariff uses a different billing factor.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Modeled load</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={usageValue} onChange={(event) => setUsageValue(event.target.value)} />
              <Select value={usageUnit} onValueChange={(value) => setUsageUnit(value as EnergyUnit)}>
                <SelectTrigger>
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
              Usage is converted to delivered MMBtu before rate normalization.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <SourceCard title="Primary source" state={sourceA} onChange={setSourceA} />
        <SourceCard title="Comparison source" state={sourceB} onChange={setSourceB} />
      </div>

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
