"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

const TECHNOLOGY_DEFAULTS = {
  microturbine: {
    label: "Microturbine",
    electric_efficiency: 0.3,
    thermal_efficiency: 0.45,
    overall_efficiency: 0.75,
    installed_cost_per_kw: 3200,
  },
  recip_engine: {
    label: "Reciprocating Engine",
    electric_efficiency: 0.35,
    thermal_efficiency: 0.4,
    overall_efficiency: 0.75,
    installed_cost_per_kw: 2500,
  },
  gas_turbine: {
    label: "Gas Turbine",
    electric_efficiency: 0.32,
    thermal_efficiency: 0.4,
    overall_efficiency: 0.72,
    installed_cost_per_kw: 2200,
  },
  fuel_cell: {
    label: "Fuel Cell",
    electric_efficiency: 0.45,
    thermal_efficiency: 0.35,
    overall_efficiency: 0.8,
    installed_cost_per_kw: 5500,
  },
  combined_cycle: {
    label: "Combined Cycle",
    electric_efficiency: 0.55,
    thermal_efficiency: 0.3,
    overall_efficiency: 0.85,
    installed_cost_per_kw: 1800,
  },
};

const fmt0 = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : "-");
const fmt1 = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "-";
const fmt2 = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "-";
const fmtCurrency = (n) =>
  Number.isFinite(n)
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : "-";

const toNum = (v) => {
  const value = Number(String(v ?? "").replace(/[,$\s]/g, ""));
  return Number.isFinite(value) ? value : 0;
};

const roundSize = (kw) => {
  if (!Number.isFinite(kw) || kw <= 0) return 0;
  if (kw < 100) return Math.round(kw / 5) * 5;
  if (kw <= 1000) return Math.round(kw / 25) * 25;
  return Math.round(kw / 50) * 50;
};

export default function CHPCalculator() {
  const [mode, setMode] = useState("simplified");
  const [inputs, setInputs] = useState({
    annual_electric_kwh: "8500000",
    annual_gas_dth: "95000",
    electric_rate: "0.12",
    gas_rate: "8.50",
    technology: "recip_engine",
    peak_demand_kw: "",
    thermal_baseload_mmbtu_hr: "",
    hours_of_operation: "",
    existing_heating_system: "Boiler",
    incentive_per_kw: "0",
    itc_fraction: "0",
    existing_backup_gen: "no",
    electric_efficiency: "",
    thermal_efficiency: "",
  });

  const onChange = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));

  const isSimplified = mode === "simplified";
  const annualElectric = toNum(inputs.annual_electric_kwh);
  const annualGas = toNum(inputs.annual_gas_dth);
  const hasValidationErrors = annualElectric <= 0;

  const results = useMemo(() => {
    const defaults = TECHNOLOGY_DEFAULTS[inputs.technology] ?? TECHNOLOGY_DEFAULTS.recip_engine;
    const electricEfficiency = toNum(inputs.electric_efficiency) || defaults.electric_efficiency;
    const thermalEfficiency = toNum(inputs.thermal_efficiency) || defaults.thermal_efficiency;

    const safeElecEff = Math.max(electricEfficiency, 0.05);
    const heatRate = 3412 / safeElecEff;

    const electricRate = toNum(inputs.electric_rate);
    const gasRate = toNum(inputs.gas_rate);

    const avgLoadKwSimplified = annualElectric / 8760;
    const estimatedPeakDemand = avgLoadKwSimplified / 0.6;
    const estimatedRunHours = 8000;
    const estimatedThermalBaseload = annualGas / Math.max(estimatedRunHours, 1);

    const avgLoadKw = isSimplified
      ? avgLoadKwSimplified
      : annualElectric / Math.max(toNum(inputs.hours_of_operation) || estimatedRunHours, 1);

    const peakDemandKw = isSimplified ? estimatedPeakDemand : toNum(inputs.peak_demand_kw) || estimatedPeakDemand;
    const hoursOfOperation = isSimplified ? estimatedRunHours : toNum(inputs.hours_of_operation) || estimatedRunHours;
    const thermalBaseload =
      isSimplified
        ? estimatedThermalBaseload
        : toNum(inputs.thermal_baseload_mmbtu_hr) || estimatedThermalBaseload;

    const heatRecoveryPerKw = (heatRate * Math.max(thermalEfficiency, 0.05)) / 1_000_000;

    const recommendedKwRaw = isSimplified
      ? Math.min(avgLoadKwSimplified * 0.6, thermalBaseload / Math.max(heatRecoveryPerKw, 0.00001))
      : Math.min(avgLoadKw, peakDemandKw * 0.8, thermalBaseload / Math.max(heatRecoveryPerKw, 0.00001));

    const recommendedKw = hasValidationErrors ? 0 : roundSize(Math.max(recommendedKwRaw, 0));

    const runtimeFraction = 0.9;
    const annualGeneration = recommendedKw * hoursOfOperation * runtimeFraction;
    const chpGasDth = (annualGeneration * heatRate) / 1_000_000;
    const recoverableHeatMmbtu = annualGeneration * heatRecoveryPerKw;

    const electricCostAvoided = annualGeneration * electricRate;
    const gasCostIncrease = chpGasDth * gasRate;
    const netAnnualSavings = electricCostAvoided - gasCostIncrease;

    const grossInstalledCost = recommendedKw * defaults.installed_cost_per_kw;
    const incentive = recommendedKw * toNum(inputs.incentive_per_kw);
    const postIncentiveCost = Math.max(grossInstalledCost - incentive, 0);
    const installedCost = Math.max(postIncentiveCost * (1 - toNum(inputs.itc_fraction)), 0);
    const simplePayback = netAnnualSavings > 0 ? installedCost / netAnnualSavings : Infinity;

    const capacityFactor =
      recommendedKw > 0 && hoursOfOperation > 0
        ? (annualGeneration / (recommendedKw * hoursOfOperation)) * 100
        : 0;

    const electricOffset = annualElectric > 0 ? (annualGeneration / annualElectric) * 100 : 0;

    return {
      techLabel: defaults.label,
      electricEfficiency,
      thermalEfficiency,
      avgLoadKw,
      estimatedPeakDemand,
      estimatedRunHours,
      estimatedThermalBaseload,
      annualGas,
      recommendedKw,
      annualGeneration,
      chpGasDth,
      recoverableHeatMmbtu,
      electricCostAvoided,
      gasCostIncrease,
      netAnnualSavings,
      installedCost,
      simplePayback,
      capacityFactor,
      electricOffset,
    };
  }, [annualElectric, annualGas, hasValidationErrors, inputs, isSimplified]);

  const gasComparisonData = [
    { name: "Before CHP", value: results.annualGas },
    { name: "After CHP", value: results.annualGas + results.chpGasDth },
  ];

  const savingsBreakdownData = [
    { name: "Electric Cost Avoided", value: results.electricCostAvoided },
    { name: "Gas Cost Increase", value: -results.gasCostIncrease },
    { name: "Net Annual Savings", value: results.netAnnualSavings },
  ];

  const offsetData = [
    { name: "CHP Offset", value: Math.max(0, Math.min(100, results.electricOffset)) },
    { name: "Remaining", value: Math.max(0, 100 - results.electricOffset) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl">CHP Feasibility Calculator</CardTitle>
          <div className="mt-3">
            <p className="mb-2 text-sm text-muted-foreground">Mode:</p>
            <div className="inline-flex w-fit rounded-lg border p-1">
              <button
                type="button"
                className={`rounded px-3 py-1 text-sm font-medium ${isSimplified ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => setMode("simplified")}
              >
                Simplified
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-sm font-medium ${!isSimplified ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => setMode("advanced")}
              >
                Advanced
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Annual Electric (kWh) *</Label>
                <Input
                  value={inputs.annual_electric_kwh}
                  onChange={(e) => onChange("annual_electric_kwh", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Annual Gas (Dth)</Label>
                <Input value={inputs.annual_gas_dth} onChange={(e) => onChange("annual_gas_dth", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Technology Type</Label>
                <Select value={inputs.technology} onValueChange={(value) => onChange("technology", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TECHNOLOGY_DEFAULTS).map(([key, tech]) => (
                      <SelectItem key={key} value={key}>
                        {tech.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Electric Rate ($/kWh)</Label>
                <Input value={inputs.electric_rate} onChange={(e) => onChange("electric_rate", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Gas Rate ($/Dth)</Label>
                <Input value={inputs.gas_rate} onChange={(e) => onChange("gas_rate", e.target.value)} />
              </div>
            </div>

            {!isSimplified && (
              <div className="mt-2 grid gap-4 rounded-md border p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Peak Demand (kW)</Label>
                  <Input value={inputs.peak_demand_kw} onChange={(e) => onChange("peak_demand_kw", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Thermal Baseload (MMBtu/hr)</Label>
                  <Input
                    value={inputs.thermal_baseload_mmbtu_hr}
                    onChange={(e) => onChange("thermal_baseload_mmbtu_hr", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hours of Operation</Label>
                  <Input
                    value={inputs.hours_of_operation}
                    onChange={(e) => onChange("hours_of_operation", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Existing Heating System</Label>
                  <Input
                    value={inputs.existing_heating_system}
                    onChange={(e) => onChange("existing_heating_system", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Incentive ($/kW)</Label>
                  <Input value={inputs.incentive_per_kw} onChange={(e) => onChange("incentive_per_kw", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>ITC Fraction (0-1)</Label>
                  <Input value={inputs.itc_fraction} onChange={(e) => onChange("itc_fraction", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Existing Backup Gen</Label>
                  <Select value={inputs.existing_backup_gen} onValueChange={(value) => onChange("existing_backup_gen", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="text-sm font-medium">Technology Assumptions</p>
                <p className="text-xs text-muted-foreground">
                  Typical total CHP efficiency ranges are often around 65–80% with heat recovery.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Electric Efficiency (fraction)</Label>
                <Input
                  value={inputs.electric_efficiency}
                  onChange={(e) => onChange("electric_efficiency", e.target.value)}
                  placeholder={String(results.electricEfficiency || "")}
                />
              </div>
              <div className="space-y-2">
                <Label>Thermal Efficiency (fraction)</Label>
                <Input
                  value={inputs.thermal_efficiency}
                  onChange={(e) => onChange("thermal_efficiency", e.target.value)}
                  placeholder={String(results.thermalEfficiency || "")}
                />
              </div>
            </div>

            {hasValidationErrors && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                Validation error: Annual electric kWh must be greater than zero.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estimated Facility Characteristics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Metric label="Estimated Peak Demand (kW)" value={fmt0(results.estimatedPeakDemand)} />
              <Metric label="Average Electric Load (kW)" value={fmt1(results.avgLoadKw)} />
              <Metric label="Estimated CHP Run Hours" value={fmt0(results.estimatedRunHours)} />
              <Metric label="Estimated Thermal Baseload (MMBtu/hr)" value={fmt2(results.estimatedThermalBaseload)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Metric label="Recommended CHP Size (kW)" value={fmt0(results.recommendedKw)} />
              <Metric label="Annual Generation (kWh)" value={fmt0(results.annualGeneration)} />
              <Metric label="CHP Gas Consumption (Dth)" value={fmt0(results.chpGasDth)} />
              <Metric label="Recoverable Heat (MMBtu)" value={fmt0(results.recoverableHeatMmbtu)} />
              <Metric label="Electric Cost Avoided" value={fmtCurrency(results.electricCostAvoided)} />
              <Metric label="Gas Cost Increase" value={fmtCurrency(results.gasCostIncrease)} />
              <Metric label="Net Annual Savings" value={fmtCurrency(results.netAnnualSavings)} />
              <Metric label="Installed Cost" value={fmtCurrency(results.installedCost)} />
              <Metric
                label="Simple Payback (years)"
                value={Number.isFinite(results.simplePayback) ? fmt1(results.simplePayback) : "N/A"}
              />
              <Metric label="Capacity Factor (%)" value={fmt1(results.capacityFactor)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Electric Offset %</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={offsetData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                  <Cell fill="#10b981" />
                  <Cell fill="#94a3b8" />
                </Pie>
                <Tooltip formatter={(value) => `${fmt1(Number(value))}%`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gas Use Comparison</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gasComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => fmt0(Number(value))} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Annual Savings Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savingsBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(value) => fmtCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
