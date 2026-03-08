"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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

const BUILDING_ARCHETYPES = {
  hospital: { load_factor: 0.75, thermal_intensity: 90, hours: 8760 },
  hotel: { load_factor: 0.65, thermal_intensity: 45, hours: 8760 },
  multifamily: { load_factor: 0.55, thermal_intensity: 35, hours: 8760 },
  university: { load_factor: 0.6, thermal_intensity: 60, hours: 6500 },
  office: { load_factor: 0.35, thermal_intensity: 20, hours: 3000 },
  data_center: { load_factor: 0.95, thermal_intensity: 10, hours: 8760 },
  manufacturing: { load_factor: 0.7, thermal_intensity: 65, hours: 6000 },
  other: { load_factor: 0.5, thermal_intensity: 40, hours: 5000 },
};

const TECHNOLOGY = {
  microturbine: { heat_rate: 11500, thermal_efficiency: 0.44, installed_cost_per_kw: 3200 },
  recip_engine: { heat_rate: 9800, thermal_efficiency: 0.4, installed_cost_per_kw: 2500 },
  fuel_cell: { heat_rate: 8900, thermal_efficiency: 0.32, installed_cost_per_kw: 5500 },
};

const fmt0 = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : "-");
const fmt1 = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
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
  const [mode, setMode] = useState("simple");
  const [inputs, setInputs] = useState({
    facility_name: "",
    building_type: "hospital",
    square_footage: "120000",
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
  });

  const [showValidation, setShowValidation] = useState(false);

  const onChange = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const results = useMemo(() => {
    const building = BUILDING_ARCHETYPES[inputs.building_type] ?? BUILDING_ARCHETYPES.other;
    const tech = TECHNOLOGY[inputs.technology] ?? TECHNOLOGY.recip_engine;

    const annualElectric = toNum(inputs.annual_electric_kwh);
    const squareFootage = toNum(inputs.square_footage);
    const annualGas = toNum(inputs.annual_gas_dth);
    const electricRate = toNum(inputs.electric_rate);
    const gasRate = toNum(inputs.gas_rate);

    const estimatedPeakDemand = annualElectric / (8760 * (building.load_factor || 1));
    const annualHeatMmbtu = (squareFootage * building.thermal_intensity) / 1000;
    const estimatedHours = building.hours;
    const estimatedThermalBaseload = annualHeatMmbtu / Math.max(estimatedHours, 1);

    const peakDemandKw = mode === "simple" ? estimatedPeakDemand : toNum(inputs.peak_demand_kw) || estimatedPeakDemand;
    const hoursOfOperation =
      mode === "simple" ? estimatedHours : toNum(inputs.hours_of_operation) || estimatedHours;
    const thermalBaseload =
      mode === "simple"
        ? estimatedThermalBaseload
        : toNum(inputs.thermal_baseload_mmbtu_hr) || estimatedThermalBaseload;

    const avgLoadKw = annualElectric / Math.max(hoursOfOperation, 1);

    const heatRecoveryPerKw = (tech.heat_rate * tech.thermal_efficiency) / 1_000_000;

    const rawRecommendedKw = Math.min(
      avgLoadKw,
      peakDemandKw * 0.8,
      thermalBaseload / Math.max(heatRecoveryPerKw, 0.00001)
    );

    const recommendedKw = roundSize(Math.max(rawRecommendedKw, 0));

    const runtimeFraction = 0.9;
    const annualGeneration = recommendedKw * hoursOfOperation * runtimeFraction;
    const chpGasDth = (annualGeneration * tech.heat_rate) / 1_000_000;
    const recoverableHeatMmbtu = annualGeneration * heatRecoveryPerKw;

    const electricCostAvoided = annualGeneration * electricRate;
    const gasCostIncrease = chpGasDth * gasRate;
    const netAnnualSavings = electricCostAvoided - gasCostIncrease;

    const grossInstalledCost = recommendedKw * tech.installed_cost_per_kw;
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
      estimatedPeakDemand,
      estimatedThermalBaseload,
      estimatedHours,
      peakDemandKw,
      thermalBaseload,
      hoursOfOperation,
      avgLoadKw,
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
      annualGas,
    };
  }, [inputs, mode]);

  const hasValidationErrors = toNum(inputs.annual_electric_kwh) <= 0 || toNum(inputs.square_footage) <= 0;

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
          <div className="mt-4 inline-flex w-fit rounded-lg border p-1">
            <Button variant={mode === "simple" ? "default" : "ghost"} onClick={() => setMode("simple")}>
              SIMPLE
            </Button>
            <Button variant={mode === "advanced" ? "default" : "ghost"} onClick={() => setMode("advanced")}>
              ADVANCED
            </Button>
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
                <Label>Facility Name</Label>
                <Input value={inputs.facility_name} onChange={(e) => onChange("facility_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Building Type</Label>
                <Select value={inputs.building_type} onValueChange={(value) => onChange("building_type", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(BUILDING_ARCHETYPES).map((key) => (
                      <SelectItem key={key} value={key}>
                        {key.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Square Footage *</Label>
                <Input value={inputs.square_footage} onChange={(e) => onChange("square_footage", e.target.value)} />
              </div>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="microturbine">Microturbine</SelectItem>
                    <SelectItem value="recip_engine">Recip Engine</SelectItem>
                    <SelectItem value="fuel_cell">Fuel Cell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === "advanced" && (
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

            {showValidation && hasValidationErrors && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                Validation errors: Annual electric kWh and square footage must be greater than zero.
              </div>
            )}

            <Button onClick={() => setShowValidation(true)}>Run CHP Screening</Button>
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
