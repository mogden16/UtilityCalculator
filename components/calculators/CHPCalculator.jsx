"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CHPGridEmissionsPanel } from "@/components/calculators/CHPGridEmissionsPanel";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BUILDING_ARCHETYPES = {
  hospital: { load_factor: 0.75, thermal_intensity: 90, hours: 8500 },
  hotel: { load_factor: 0.65, thermal_intensity: 45, hours: 8500 },
  multifamily: { load_factor: 0.55, thermal_intensity: 35, hours: 3000 },
  university: { load_factor: 0.6, thermal_intensity: 60, hours: 6500 },
  office: { load_factor: 0.35, thermal_intensity: 20, hours: 3000 },
  data_center: { load_factor: 0.95, thermal_intensity: 10, hours: 8500 },
  manufacturing: { load_factor: 0.7, thermal_intensity: 65, hours: 6000 },
  other: { load_factor: 0.5, thermal_intensity: 40, hours: 5000 },
};

const TECHNOLOGY = {
  microturbine: {
    label: "Microturbine",
    installed_cost_per_kw: 3200,
  },
  recip_engine: {
    label: "Reciprocating Engine",
    installed_cost_per_kw: 2500,
  },
  turbine: {
    label: "Turbine",
    installed_cost_per_kw: 2900,
  },
  fuel_cell: {
    label: "Fuel Cell",
    installed_cost_per_kw: 5500,
  },
  combined_cycle: {
    label: "Combined Cycle",
    installed_cost_per_kw: 4200,
  },
};

const TECHNOLOGY_EFFICIENCY_DEFAULTS = {
  microturbine: { electrical: 28, thermal: 44 },
  recip_engine: { electrical: 37, thermal: 45 },
  turbine: { electrical: 34, thermal: 36 },
  fuel_cell: { electrical: 47, thermal: 32 },
  combined_cycle: { electrical: 50, thermal: 30 },
};

const roundCHPSize = (kw) => {
  if (kw <= 0) return 0;
  if (kw < 100) return Math.round(kw / 5) * 5;
  if (kw <= 1000) return Math.round(kw / 25) * 25;
  return Math.round(kw / 50) * 50;
};

const toNumber = (value) => {
  const num = Number(String(value).replace(/[,$\s]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const fmt0 = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : "-");
const fmt2 = (n) => (Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-");
const fmtCurrency = (n) => (Number.isFinite(n) ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "-");

const defaultInputs = {
  building_type: "hospital",
  annual_electric_kwh: 12000000,
  annual_gas_dth: 85000,
  electric_rate: 0.12,
  gas_rate: 11,
  technology: "recip_engine",
  electrical_efficiency: TECHNOLOGY_EFFICIENCY_DEFAULTS.recip_engine.electrical,
  thermal_efficiency: TECHNOLOGY_EFFICIENCY_DEFAULTS.recip_engine.thermal,
  square_footage: 150000,
  use_sqft_override: false,
  peak_demand_kw: 1800,
  thermal_baseload_mmbtu_hr: 8,
  hours_of_operation: 7000,
  existing_heating_system: "boiler",
  incentive_per_kw: 200,
  itc_fraction: 0.1,
  existing_backup_gen: "no",
};

export default function CHPCalculator() {
  const [mode, setMode] = useState("simple");
  const [inputs, setInputs] = useState(defaultInputs);

  const onChange = (key, value) => {
    if (key === "technology") {
      const defaults = TECHNOLOGY_EFFICIENCY_DEFAULTS[value] || TECHNOLOGY_EFFICIENCY_DEFAULTS.recip_engine;
      setInputs((prev) => ({
        ...prev,
        technology: value,
        electrical_efficiency: defaults.electrical,
        thermal_efficiency: defaults.thermal,
      }));
      return;
    }

    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const result = useMemo(() => {
    const annualElectric = toNumber(inputs.annual_electric_kwh);
    const annualGas = toNumber(inputs.annual_gas_dth);
    const electricRate = toNumber(inputs.electric_rate);
    const gasRate = toNumber(inputs.gas_rate);
    const sqft = toNumber(inputs.square_footage);

    if (annualElectric <= 0 || sqft <= 0) {
      return { error: "Enter valid values: annual_electric_kwh > 0 and square_footage > 0." };
    }

    const archetype = BUILDING_ARCHETYPES[inputs.building_type] || BUILDING_ARCHETYPES.other;
    const tech = TECHNOLOGY[inputs.technology] || TECHNOLOGY.recip_engine;
    const electricalEfficiency = Math.max(0.01, toNumber(inputs.electrical_efficiency) / 100);
    const thermalEfficiency = Math.max(0, toNumber(inputs.thermal_efficiency) / 100);
    const heatRate = 3412 / electricalEfficiency;

    const estimatedPeakDemand = annualElectric / (8760 * archetype.load_factor);
    const annualHeatMMBtu = annualGas;
    const estimatedHours = archetype.hours;
    const thermalFromGas = annualHeatMMBtu / estimatedHours;
    const thermalFromSqft = (sqft * archetype.thermal_intensity) / 1000 / estimatedHours;

    const hoursOfOperation =
      mode === "simple" ? estimatedHours : Math.max(1, toNumber(inputs.hours_of_operation));
    const peakDemandKW =
      mode === "simple" ? estimatedPeakDemand : Math.max(0, toNumber(inputs.peak_demand_kw));
    const thermalBaseload =
      mode === "simple"
        ? inputs.use_sqft_override
          ? thermalFromSqft
          : thermalFromGas
        : Math.max(0, toNumber(inputs.thermal_baseload_mmbtu_hr));

    const heatRecoveryPerKW = (heatRate * thermalEfficiency) / 1_000_000;
    const avgLoadKW = annualElectric / hoursOfOperation;
    let candidateKW = Math.min(avgLoadKW, peakDemandKW * 0.8, thermalBaseload / heatRecoveryPerKW);

    if (mode === "advanced" && inputs.existing_backup_gen === "yes") {
      candidateKW *= 0.95;
    }

    const recommendedKW = roundCHPSize(Math.max(0, candidateKW));
    const annualGenerationKWh = recommendedKW * hoursOfOperation;
    const chpGasConsumptionDth = (annualGenerationKWh * heatRate) / 1_000_000;
    const recoverableHeatMMBtu = (annualGenerationKWh * heatRate * thermalEfficiency) / 1_000_000;
    const electricCostAvoided = annualGenerationKWh * electricRate;
    const gasCostIncrease = Math.max(0, chpGasConsumptionDth - annualGas) * gasRate;
    const netAnnualSavings = electricCostAvoided - gasCostIncrease;

    const grossInstalledCost = recommendedKW * tech.installed_cost_per_kw;
    const incentive = recommendedKW * toNumber(inputs.incentive_per_kw);
    const afterIncentive = Math.max(0, grossInstalledCost - incentive);
    const installedCost = afterIncentive * (1 - Math.max(0, Math.min(1, toNumber(inputs.itc_fraction))));

    const simplePaybackYears = netAnnualSavings > 0 ? installedCost / netAnnualSavings : Infinity;
    const capacityFactor = recommendedKW > 0 ? (annualGenerationKWh / (recommendedKW * 8760)) * 100 : 0;
    const electricOffsetPct = annualElectric > 0 ? (annualGenerationKWh / annualElectric) * 100 : 0;

    return {
      inputsUsed: {
        hoursOfOperation,
        peakDemandKW,
        thermalBaseload,
      },
      recommendedKW,
      annualGenerationKWh,
      chpGasConsumptionDth,
      recoverableHeatMMBtu,
      electricCostAvoided,
      gasCostIncrease,
      netAnnualSavings,
      installedCost,
      simplePaybackYears,
      capacityFactor,
      electricOffsetPct,
      annualGas,
    };
  }, [inputs, mode]);

  const savingsData = [
    { name: "Electric Cost Avoided", value: result.electricCostAvoided || 0 },
    { name: "Gas Cost Increase", value: -(result.gasCostIncrease || 0) },
    { name: "Net Annual Savings", value: result.netAnnualSavings || 0 },
  ];

  const gasUseData = [
    { name: "Baseline Gas (Dth)", value: result.annualGas || 0 },
    { name: "CHP Gas (Dth)", value: result.chpGasConsumptionDth || 0 },
  ];

  const offsetPie = [
    { name: "Electric Offset", value: Math.max(0, Math.min(100, result.electricOffsetPct || 0)) },
    { name: "Remaining", value: Math.max(0, 100 - (result.electricOffsetPct || 0)) },
  ];

  const isAdvanced = mode === "advanced";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <Card>
        <CardHeader className="space-y-4">
          <h1 className="text-2xl font-semibold">CHP Feasibility Calculator</h1>
          <div className="inline-flex rounded-md border p-1">
            <Button variant={!isAdvanced ? "default" : "ghost"} onClick={() => setMode("simple")}>SIMPLE</Button>
            <Button variant={isAdvanced ? "default" : "ghost"} onClick={() => setMode("advanced")}>ADVANCED</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Building Type</Label>
            <Select value={inputs.building_type} onValueChange={(value) => onChange("building_type", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(BUILDING_ARCHETYPES).map((k) => (
                  <SelectItem key={k} value={k}>{k.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Annual Electric (kWh)</Label>
            <Input value={inputs.annual_electric_kwh} onChange={(e) => onChange("annual_electric_kwh", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Annual Gas (Dth)</Label>
            <Input value={inputs.annual_gas_dth} onChange={(e) => onChange("annual_gas_dth", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Electric Rate ($/kWh)</Label>
            <Input value={inputs.electric_rate} onChange={(e) => onChange("electric_rate", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Gas Rate ($/Dth)</Label>
            <Input value={inputs.gas_rate} onChange={(e) => onChange("gas_rate", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Technology</Label>
            <Select value={inputs.technology} onValueChange={(value) => onChange("technology", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TECHNOLOGY).map(([key, tech]) => (
                  <SelectItem key={key} value={key}>
                    {tech.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Electrical Efficiency (%)</Label>
            <Input value={inputs.electrical_efficiency} onChange={(e) => onChange("electrical_efficiency", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Thermal Efficiency (%)</Label>
            <Input value={inputs.thermal_efficiency} onChange={(e) => onChange("thermal_efficiency", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Square Footage (required)</Label>
            <Input value={inputs.square_footage} onChange={(e) => onChange("square_footage", e.target.value)} />
          </div>

          {!isAdvanced && (
            <div className="flex items-end">
              <Button
                variant={inputs.use_sqft_override ? "default" : "outline"}
                onClick={() => onChange("use_sqft_override", !inputs.use_sqft_override)}
              >
                Thermal Baseload from SqFt
              </Button>
            </div>
          )}

          {isAdvanced && (
            <>
              <div className="space-y-2">
                <Label>Peak Demand (kW)</Label>
                <Input value={inputs.peak_demand_kw} onChange={(e) => onChange("peak_demand_kw", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Thermal Baseload (MMBtu/hr)</Label>
                <Input value={inputs.thermal_baseload_mmbtu_hr} onChange={(e) => onChange("thermal_baseload_mmbtu_hr", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hours of Operation</Label>
                <Input value={inputs.hours_of_operation} onChange={(e) => onChange("hours_of_operation", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Existing Heating System</Label>
                <Select value={inputs.existing_heating_system} onValueChange={(value) => onChange("existing_heating_system", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boiler">Boiler</SelectItem>
                    <SelectItem value="furnace">Furnace</SelectItem>
                    <SelectItem value="steam">Steam</SelectItem>
                    <SelectItem value="district">District Heat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incentive ($/kW)</Label>
                <Input value={inputs.incentive_per_kw} onChange={(e) => onChange("incentive_per_kw", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ITC Fraction</Label>
                <Input value={inputs.itc_fraction} onChange={(e) => onChange("itc_fraction", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Existing Backup Gen</Label>
                <Select value={inputs.existing_backup_gen} onValueChange={(value) => onChange("existing_backup_gen", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {result.error && <p className="text-sm font-medium text-red-500">{result.error}</p>}

      {!result.error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Recommended CHP Size (kW)" value={fmt0(result.recommendedKW)} />
            <MetricCard title="Annual Generation (kWh)" value={fmt0(result.annualGenerationKWh)} />
            <MetricCard title="CHP Gas Consumption (Dth)" value={fmt0(result.chpGasConsumptionDth)} />
            <MetricCard title="Recoverable Heat (MMBtu)" value={fmt0(result.recoverableHeatMMBtu)} />
            <MetricCard title="Electric Cost Avoided ($)" value={fmtCurrency(result.electricCostAvoided)} />
            <MetricCard title="Gas Cost Increase ($)" value={fmtCurrency(result.gasCostIncrease)} />
            <MetricCard title="Net Annual Savings ($)" value={fmtCurrency(result.netAnnualSavings)} />
            <MetricCard title="Installed Cost ($)" value={fmtCurrency(result.installedCost)} />
            <MetricCard
              title="Simple Payback (years)"
              value={Number.isFinite(result.simplePaybackYears) ? fmt2(result.simplePaybackYears) : "No Payback"}
            />
            <MetricCard title="Capacity Factor (%)" value={fmt2(result.capacityFactor)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Simple-mode assumptions used</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3 text-sm text-muted-foreground">
              <p>Peak Demand: <span className="font-medium text-foreground">{fmt2(result.inputsUsed.peakDemandKW)} kW</span></p>
              <p>Thermal Baseload: <span className="font-medium text-foreground">{fmt2(result.inputsUsed.thermalBaseload)} MMBtu/hr</span></p>
              <p>Hours of Operation: <span className="font-medium text-foreground">{fmt0(result.inputsUsed.hoursOfOperation)} hr</span></p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="h-[300px]">
              <CardHeader><CardTitle className="text-base">Electric Offset %</CardTitle></CardHeader>
              <CardContent className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={offsetPie} dataKey="value" nameKey="name" outerRadius={80}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#d1d5db" />
                    </Pie>
                    <Tooltip formatter={(value) => `${fmt2(value)}%`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="h-[300px]">
              <CardHeader><CardTitle className="text-base">Gas Use Comparison</CardTitle></CardHeader>
              <CardContent className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gasUseData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip formatter={(value) => fmt0(value)} />
                    <Bar dataKey="value" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="h-[300px]">
              <CardHeader><CardTitle className="text-base">Annual Savings Breakdown</CardTitle></CardHeader>
              <CardContent className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={savingsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(value) => fmtCurrency(value)} />
                    <Bar dataKey="value">
                      {savingsData.map((entry) => (
                        <Cell key={entry.name} fill={entry.value >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <CHPGridEmissionsPanel />
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
