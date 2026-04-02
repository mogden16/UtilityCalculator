"use client";

import { useMemo, useState } from "react";

import { MetricCard } from "@/components/metric-card";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateGasFlow, GAS_FLOW_UNIT_OPTIONS, type GasFlowUnit } from "@/lib/gas-flow";
import type { EnergyReference } from "@/lib/converter";
import { formatFixed, formatWhole } from "@/lib/format";

export function GasFlowTool() {
  const [value, setValue] = useState("250000");
  const [unit, setUnit] = useState<GasFlowUnit>("BTU/hr");
  const [reference, setReference] = useState<EnergyReference>("input");
  const [efficiencyPercent, setEfficiencyPercent] = useState("90");
  const [hhv, setHhv] = useState("1.035");
  const [hours, setHours] = useState("400");

  const result = useMemo(
    () =>
      calculateGasFlow({
        value,
        unit,
        energyReference: reference,
        efficiencyPercent,
        hhv,
        hours,
      }),
    [efficiencyPercent, hhv, hours, reference, unit, value],
  );

  return (
    <ToolPageShell
      eyebrow="Primary Tool"
      title="Gas Flow"
      description="Translate thermal demand into gas flow rates using the heating value and efficiency assumption you actually want to carry."
    >
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label>Demand value</Label>
            <Input value={value} onChange={(event) => setValue(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Demand unit</Label>
            <Select value={unit} onValueChange={(next) => setUnit(next as GasFlowUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAS_FLOW_UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Select value={reference} onValueChange={(next) => setReference(next as EnergyReference)}>
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
            <Label>Efficiency (%)</Label>
            <Input value={efficiencyPercent} onChange={(event) => setEfficiencyPercent(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Gas HHV (MMBtu/MCF)</Label>
            <Input value={hhv} onChange={(event) => setHhv(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Modeled hours</Label>
            <Input value={hours} onChange={(event) => setHours(event.target.value)} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground sm:col-span-2">
            This route converts demand to flow. It does not size pipe, pressure regulators, or pressure-drop limits. Use
            the result here as the starting demand for those downstream checks.
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="CFH" value={formatWhole(result.cfh)} />
        <MetricCard label="MCFH" value={formatFixed(result.mcfh, 3)} />
        <MetricCard label="Therm/hr" value={formatFixed(result.thermsPerHour, 2)} />
        <MetricCard label="Dth/hr" value={formatFixed(result.dthPerHour, 3)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Demand basis</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Input BTU/hr" value={formatWhole(result.inputBtuh)} />
              <MetricCard label="Output BTU/hr" value={formatWhole(result.outputBtuh)} />
              <MetricCard label="Thermal kW output" value={formatFixed(result.kw, 2)} />
              <MetricCard label="Steam MLB/hr equivalent" value={formatFixed(result.mlbPerHour, 3)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Totals over modeled hours</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="MCF" value={formatFixed(result.totalMcf, 2)} />
              <MetricCard label="Therms" value={formatFixed(result.totalTherms, 1)} />
              <MetricCard label="Dth" value={formatFixed(result.totalDth, 2)} />
              <MetricCard label="Input MMBtu" value={formatFixed(result.totalInputMmbtu, 2)} />
            </div>
          </CardContent>
        </Card>
      </section>
    </ToolPageShell>
  );
}
