"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BTU_PER_KW } from "@/lib/energy";
import { getElectricIntensity, type ElectricIntensityData } from "@/lib/electric-intensity";

// -----------------------------
// Helpers & constants
// -----------------------------
const BTU_PER_TON = 12000;
const BTU_PER_HP = 2544.4336;
const BTU_PER_THERM = 100000;
const BTU_PER_DTH = 1_000_000;
const BTU_PER_MLB = 1_000_000;
const DEFAULT_HHV_MBTU_PER_MCF = 1.035;
const DEFAULT_ELECTRIC_REGION = "PJM";
const ELECTRIC_ZONES = [
  { value: "PJM", label: "PJM (Mid-Atlantic)" },
  { value: "NYISO", label: "NYISO (New York)" },
  { value: "ISO-NE", label: "ISO-NE (New England)" },
  { value: "MISO", label: "MISO (Midwest)" },
  { value: "CAISO", label: "CAISO (California)" },
  { value: "ERCOT", label: "ERCOT (Texas)" },
  { value: "SPP", label: "SPP (Great Plains)" },
] as const;

const fmt0 = (n: number) => (isFinite(n) ? Math.round(n).toLocaleString() : "–");
const fmt1 = (n: number) =>
  isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "–";
const fmt2 = (n: number) =>
  isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–";
const fmtCurrency = (n: number) =>
  isFinite(n)
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "–";
const num = (v: string | number) => (typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, "")) || 0);
const formatEmissions = (pounds: number) => {
  if (!isFinite(pounds)) {
    return "–";
  }
  const value = Math.max(pounds, 0);
  if (value < 1e-6) {
    return "0 lb";
  }
  if (value >= 2000) {
    const tons = value / 2000;
    return `${tons.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tons`;
  }
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} lb`;
};

const RATE_UNITS = new Set(["BTU/hr", "kW", "Ton", "HP", "Therm/hr", "DTH/hr", "Steam MLB/hr"]);

const LABEL_OPTIONS = [
  "Natural Gas Furnace",
  "Propane Furnace",
  "Electric Resistance",
  "Air-Source Heat Pump",
  "Ground-Source Heat Pump",
  "Fuel Oil Boiler",
  "Steam Boiler",
  "District Steam",
  "Other Custom",
] as const;

type FuelOptionKey = "naturalGas" | "propane" | "distillateOil" | "gridElectricity";

const PRESET_SOURCE_METADATA: Record<
  (typeof LABEL_OPTIONS)[number],
  { defaultEfficiency?: number; defaultFuel?: FuelOptionKey; defaultElectricRegion?: string }
> = {
  "Natural Gas Furnace": { defaultEfficiency: 0.9, defaultFuel: "naturalGas" },
  "Propane Furnace": { defaultEfficiency: 0.9, defaultFuel: "propane" },
  "Electric Resistance": {
    defaultEfficiency: 1,
    defaultFuel: "gridElectricity",
    defaultElectricRegion: DEFAULT_ELECTRIC_REGION,
  },
  "Air-Source Heat Pump": {
    defaultEfficiency: 2.8,
    defaultFuel: "gridElectricity",
    defaultElectricRegion: DEFAULT_ELECTRIC_REGION,
  },
  "Ground-Source Heat Pump": {
    defaultEfficiency: 3.5,
    defaultFuel: "gridElectricity",
    defaultElectricRegion: DEFAULT_ELECTRIC_REGION,
  },
  "Fuel Oil Boiler": { defaultEfficiency: 0.87, defaultFuel: "distillateOil" },
  "Steam Boiler": { defaultEfficiency: 0.8, defaultFuel: "naturalGas" },
  "District Steam": { defaultEfficiency: 0.82, defaultFuel: "naturalGas" },
  "Other Custom": {},
};

type FuelOption = {
  key: FuelOptionKey;
  label: string;
  description: string;
  co2eLbPerMMBtu: number;
  noxLbPerMMBtu: number;
  soxLbPerMMBtu: number;
  isElectric?: boolean;
};

const FUEL_OPTIONS: FuelOption[] = [
  {
    key: "naturalGas",
    label: "Natural Gas",
    description: "EPA stationary combustion factors for pipeline-quality natural gas.",
    // Factors sourced from EPA AP-42 Table 1.4-1 and GHG Inventory (CO2, CH4, N2O, NOx, SO2).
    co2eLbPerMMBtu: 117.12,
    noxLbPerMMBtu: 0.092,
    soxLbPerMMBtu: 0.0006,
  },
  {
    key: "propane",
    label: "Propane / LPG",
    description: "EPA AP-42 LPG combustion factors for commercial boilers.",
    co2eLbPerMMBtu: 138.71,
    noxLbPerMMBtu: 0.142,
    soxLbPerMMBtu: 0.0006,
  },
  {
    key: "distillateOil",
    label: "Fuel Oil No. 2",
    description: "EPA AP-42 distillate oil factors (assumes 0.5% sulfur by weight).",
    co2eLbPerMMBtu: 163.53,
    noxLbPerMMBtu: 0.146,
    soxLbPerMMBtu: 0.518,
  },
  {
    key: "gridElectricity",
    label: "Electricity (Grid)",
    description:
      "Uses 30-day average carbon intensity from ElectricityMaps for the selected ISO region.",
    co2eLbPerMMBtu: 0,
    noxLbPerMMBtu: 0,
    soxLbPerMMBtu: 0,
    isElectric: true,
  },
];

const FUEL_OPTION_MAP = Object.fromEntries(FUEL_OPTIONS.map((option) => [option.key, option])) as Record<
  FuelOptionKey,
  FuelOption
>;

const DEFAULT_FUEL: FuelOptionKey = FUEL_OPTIONS[0]?.key ?? "naturalGas";

const formatEfficiency = (value: number) => value.toFixed(2);

const RANGE_ROWS = [
  {
    segment: "Residential",
    range: "30,000 – 120,000 BTU/hr",
    notes: "Single-family homes and low-rise multifamily with conventional comfort systems.",
  },
  {
    segment: "Commercial",
    range: "120,000 – 1,200,000 BTU/hr",
    notes: "Mid-size offices, retail pads, and schools served by packaged rooftops or split systems.",
  },
  {
    segment: "Industrial",
    range: "1,000,000 – 5,000,000+ BTU/hr",
    notes: "Warehouses, production floors, or make-up air units with process-driven loads.",
  },
] as const;

const LOAD_SCENARIOS = [
  { key: "tight", label: "Tight / New" },
  { key: "average", label: "Average (2000s)" },
  { key: "leaky", label: "Older / Leaky" },
] as const;

type LoadScenarioKey = (typeof LOAD_SCENARIOS)[number]["key"];

const LOAD_FACTORS: Record<LoadScenarioKey, { heat: number; cool: number }> = {
  tight: { heat: 25, cool: 15 },
  average: { heat: 30, cool: 20 },
  leaky: { heat: 40, cool: 28 },
};

type ConversionContext = { hhv: number };

const ENERGY_UNITS = {
  mcf: {
    label: "MCF",
    rateLabel: "$/MCF",
    description: "Thousands of cubic feet of natural gas",
    toMMBtu: (value: number, ctx: ConversionContext) => value * ctx.hhv,
  },
  therm: {
    label: "Therm",
    rateLabel: "$/Therm",
    description: "Therms of natural gas",
    toMMBtu: (value: number, _ctx: ConversionContext) => value * 0.1,
  },
  dth: {
    label: "Dth",
    rateLabel: "$/Dth",
    description: "Dekatherms (1 MMBtu)",
    toMMBtu: (value: number, _ctx: ConversionContext) => value,
  },
  mlb: {
    label: "MLB",
    rateLabel: "$/MLB",
    description: "Thousand pounds of steam",
    toMMBtu: (value: number, _ctx: ConversionContext) => value,
  },
  kwh: {
    label: "kWh",
    rateLabel: "$/kWh",
    description: "Kilowatt-hours of electricity",
    toMMBtu: (value: number, _ctx: ConversionContext) => (value * BTU_PER_KW) / 1_000_000,
  },
} satisfies Record<
  string,
  { label: string; rateLabel: string; description: string; toMMBtu: (value: number, ctx: ConversionContext) => number }
>;

type EnergyUnit = keyof typeof ENERGY_UNITS;
const ENERGY_UNIT_ENTRIES = Object.entries(ENERGY_UNITS) as Array<
  [EnergyUnit, (typeof ENERGY_UNITS)[EnergyUnit]]
>;

// -----------------------------
// Converter
// -----------------------------
function Converter() {
  const [val, setVal] = useState("9000000");
  const [unit, setUnit] = useState("BTU/hr");
  const [hhv, setHhv] = useState(String(DEFAULT_HHV_MBTU_PER_MCF));
  const [hours, setHours] = useState("500");

  const calc = useMemo(() => {
    const value = num(val);
    const HHV = num(hhv);
    const hrs = Math.max(num(hours), 0);

    let btuh = value;
    switch (unit) {
      case "kW":
        btuh = value * BTU_PER_KW;
        break;
      case "Ton":
        btuh = value * BTU_PER_TON;
        break;
      case "HP":
        btuh = value * BTU_PER_HP;
        break;
      case "Therm/hr":
        btuh = value * BTU_PER_THERM;
        break;
      case "DTH/hr":
        btuh = value * BTU_PER_DTH;
        break;
      case "Steam MLB/hr":
        btuh = value * BTU_PER_MLB;
        break;
    }

    // Auto-classification
    let category = "Unknown";
    let colorClass = "text-muted-foreground";
    if (btuh < 300000) {
      category = "Residential";
      colorClass = "text-green-500";
    } else if (btuh < 3000000) {
      category = "Commercial";
      colorClass = "text-yellow-500";
    } else {
      category = "Industrial";
      colorClass = "text-red-500";
    }

    const kW = btuh / BTU_PER_KW;
    const tons = btuh / BTU_PER_TON;
    const hp = btuh / BTU_PER_HP;
    const mlb_per_hr = RATE_UNITS.has(unit) ? btuh / BTU_PER_MLB : NaN;
    const therm_per_hr = btuh / BTU_PER_THERM;
    const dth_per_hr = btuh / BTU_PER_DTH;
    const cfh = btuh / (HHV * 1_000);

    const totalCF = cfh * hrs;
    const totalMCF = totalCF / 1_000;
    const totalTherms = therm_per_hr * hrs;
    const totalDTH = dth_per_hr * hrs;
    const totalMMBTU = (btuh / 1_000_000) * hrs;
    const totalMLB = (btuh / BTU_PER_MLB) * hrs;
    const totalKWh = kW * hrs;

    return {
      btuh,
      kW,
      tons,
      hp,
      mlb_per_hr,
      cfh,
      therm_per_hr,
      dth_per_hr,
      totalMCF,
      totalTherms,
      totalDTH,
      totalMMBTU,
      totalMLB,
      totalKWh,
      category,
      colorClass,
    };
  }, [val, unit, hhv, hours]);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardContent className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 items-end">
            <div>
              <Label>Value</Label>
              <Input value={val} onChange={(e) => setVal(e.target.value)} />
            </div>

            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTU/hr">BTU/hr (Demand)</SelectItem>
                  <SelectItem value="kW">kW (Demand)</SelectItem>
                  <SelectItem value="Ton">Ton (Cooling Demand)</SelectItem>
                  <SelectItem value="HP">HP (Mechanical)</SelectItem>
                  <SelectItem value="Therm/hr">Therm/hr (Energy Rate)</SelectItem>
                  <SelectItem value="DTH/hr">DTH/hr (Energy Rate)</SelectItem>
                  <SelectItem value="Steam MLB/hr">MLB/hr (Steam Flow Rate)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto Classification */}
            <div className="flex items-end justify-end">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-right cursor-help">
                      <div className="text-xs text-muted-foreground">Application Type</div>
                      <div className={`font-medium ${calc.colorClass}`}>{calc.category}</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-relaxed">
                    <div className="font-semibold mb-1 text-foreground">Classification thresholds</div>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>Residential — &lt; 300,000 BTU/hr</li>
                      <li>Commercial — 300,000 to 3,000,000 BTU/hr</li>
                      <li>Industrial — &gt; 3,000,000 BTU/hr</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="border-t border-border pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced options</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Gas HHV (MBTU/MCF)</Label>
                      <Input value={hhv} onChange={(e) => setHhv(e.target.value)} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Default {DEFAULT_HHV_MBTU_PER_MCF} ≈ 1,035 BTU/CF
                      </p>
                    </div>
                    <div>
                      <Label>Hours of operation</Label>
                      <Input value={hours} onChange={(e) => setHours(e.target.value)} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Totals below use this duration.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CardContent>
      </Card>

      {/* Instantaneous Demand */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2">Instantaneous Demand</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <Readout label="BTU/hr" value={fmt0(calc.btuh)} />
            <Readout label="kW" value={fmt0(calc.kW)} />
            <Readout label="Tons" value={fmt0(calc.tons)} />
            <Readout label="HP" value={fmt0(calc.hp)} />
            <Readout label="CFH" value={fmt0(calc.cfh)} />
            <Readout label="Therm/hr" value={fmt0(calc.therm_per_hr)} />
            <Readout label="DTH/hr" value={fmt0(calc.dth_per_hr)} />
            {RATE_UNITS.has(unit) && <Readout label="MLB/hr" value={fmt0(calc.mlb_per_hr)} />}
          </div>
        </CardContent>
      </Card>

      {/* Total Energy */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2">Total Energy (Quantity over time)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Computed as hourly rate × hours of operation.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-6">
            <Readout label="MCF" value={fmt0(calc.totalMCF)} />
            <Readout label="Therms" value={fmt0(calc.totalTherms)} />
            <Readout label="DTH" value={fmt0(calc.totalDTH)} />
            <Readout label="MMBTU" value={fmt0(calc.totalMMBTU)} />
            <Readout label="kWh" value={fmt0(calc.totalKWh)} />
            <Readout label="MLB" value={fmt0(calc.totalMLB)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-base bg-muted/30 rounded px-2 py-1 sm:text-lg">{value}</div>
    </div>
  );
}

// -----------------------------
// Typical Ranges Table
// -----------------------------
function TypicalRangesTable() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Typical Load Size Bands</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Representative peak BTU/hr ranges for common building types. Treat these as quick
              gut-checks alongside detailed load calculations or measured demand data.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Segment</th>
                  <th className="px-3 py-2 font-medium">Typical BTU/hr Range</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {RANGE_ROWS.map((row) => (
                  <tr key={row.segment} className="border-b last:border-0 border-border/60">
                    <td className="px-3 py-2 align-top font-medium text-foreground">{row.segment}</td>
                    <td className="px-3 py-2 align-top font-mono">{row.range}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Compare your calculated peak load or installed capacity to these bands to sanity
            check sizing before committing to equipment selections.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------
// Load Estimator (with chart)
// -----------------------------
function LoadEstimator() {
  const [sqft, setSqft] = useState("2000");
  const [vintage, setVintage] = useState<LoadScenarioKey>("average");
  const [heatOverride, setHeatOverride] = useState("");
  const [coolOverride, setCoolOverride] = useState("");
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(max-width: 640px)");
    const update = (event: MediaQueryListEvent | MediaQueryList) => setIsSmallScreen(event.matches);

    update(media);
    const listener = (event: MediaQueryListEvent) => update(event);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }

    media.addListener(listener);
    return () => media.removeListener(listener);
  }, []);

  const f = LOAD_FACTORS[vintage] || LOAD_FACTORS.average;

  const heatingFactor = heatOverride ? num(heatOverride) : f.heat;
  const coolingFactor = coolOverride ? num(coolOverride) : f.cool;

  const area = useMemo(() => Math.max(num(sqft), 0), [sqft]);

  const out = useMemo(() => {
    const heat = area * heatingFactor;
    const cool = area * coolingFactor;
    const tons = cool / BTU_PER_TON;
    const mbh = heat / 1000;
    return { heat, cool, tons, mbh };
  }, [area, heatingFactor, coolingFactor]);

  const chartData = useMemo(
    () =>
      LOAD_SCENARIOS.map(({ key, label }) => {
        const defaults = LOAD_FACTORS[key];
        const heatFactorForScenario = key === vintage ? heatingFactor : defaults.heat;
        const coolFactorForScenario = key === vintage ? coolingFactor : defaults.cool;

        return {
          name: label,
          heating: area * heatFactorForScenario,
          cooling: area * coolFactorForScenario,
        };
      }),
    [area, coolingFactor, heatingFactor, vintage]
  );

  const axisFontSize = isSmallScreen ? 10 : 12;
  const legendWrapperStyle = useMemo(
    () => ({ fontSize: isSmallScreen ? 11 : 12, paddingTop: isSmallScreen ? 8 : 0 }),
    [isSmallScreen],
  );

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Square Footage</Label>
            <Input value={sqft} onChange={(e) => setSqft(e.target.value)} />
          </div>
          <div>
            <Label>Building Condition</Label>
            <Select value={vintage} onValueChange={(value) => setVintage(value as LoadScenarioKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOAD_SCENARIOS.map(({ key, label }) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="self-end text-xs text-muted-foreground">
            Rule-of-thumb for Philadelphia climate.
          </div>
        </CardContent>
      </Card>
      {/* Override Inputs */}
      <Card>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Heating Factor Override (BTU/ft²)</Label>
            <Input
              value={heatOverride}
              onChange={(e) => setHeatOverride(e.target.value)}
              placeholder={`${f.heat}`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Default {f.heat} for selected condition.
            </p>
          </div>
          <div>
            <Label>Cooling Factor Override (BTU/ft²)</Label>
            <Input
              value={coolOverride}
              onChange={(e) => setCoolOverride(e.target.value)}
              placeholder={`${f.cool}`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Default {f.cool} for selected condition.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Outputs */}
      <Card>
        <CardContent className="mt-4 grid gap-3 sm:grid-cols-4">
          <Readout label="Heating (BTU/hr)" value={fmt0(out.heat)} />
          <Readout label="Heating (MBH)" value={fmt0(out.mbh)} />
          <Readout label="Cooling (BTU/hr)" value={fmt0(out.cool)} />
          <Readout label="Cooling (Tons)" value={fmt0(out.tons)} />
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardContent className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Modeled Load by Building Condition</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Each bar shows the total heating and cooling load in BTU/hr for the modeled square
              footage using the default multipliers or your overrides for the selected condition.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                <XAxis dataKey="name" tick={{ fill: "#888" }} interval={0} height={40} />
                <YAxis
                  tick={{ fill: "#888" }}
                  tickFormatter={(value) => fmt0(Number(value))}
                  label={{
                    value: "Load (BTU/hr)",
                    angle: -90,
                    position: "insideLeft",
                    offset: -5,
                    style: { fill: "#888", textAnchor: "middle" },
                  }}
                />
                <RechartTooltip
                  formatter={(value: string | number, name: string) => [
                    `${fmt0(Number(value))} BTU/hr`,
                    name,
                  ]}
                  labelStyle={{ color: "white" }}
                  contentStyle={{
                    backgroundColor: "rgba(20,20,20,0.9)",
                    border: "1px solid rgba(80,80,80,0.5)",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ color: "#888" }} />
                <Bar dataKey="heating" name="Heating Load" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cooling" name="Cooling Load" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type RateSourceState = {
  name: string;
  rate: string;
  rateUnit: EnergyUnit;
  efficiency: string;
  fuel: FuelOptionKey;
  electricRegion: string;
};

type EnergySummary = {
  name: string;
  ratePerMMBtu: number;
  inputMMBtu: number;
  deliveredMMBtu: number;
  totalCost: number;
  efficiency: number;
  costPerDelivered: number;
  fuel: FuelOption;
  emissions: {
    co2eLb: number;
    noxLb: number;
    soxLb: number;
  };
};

type ElectricIntensityHookState = {
  status: "idle" | "loading" | "success" | "error";
  data: ElectricIntensityData | null;
  error: string | null;
};

function useElectricIntensity(zone: string | null | undefined): ElectricIntensityHookState {
  const [status, setStatus] = useState<ElectricIntensityHookState["status"]>("idle");
  const [data, setData] = useState<ElectricIntensityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalized = zone?.trim().toUpperCase() ?? "";

  useEffect(() => {
    if (!normalized) {
      setStatus("idle");
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    getElectricIntensity(normalized)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setData(result);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setData(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load electricity data");
      });

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  return { status, data, error };
}

function computeEnergySummary(
  source: RateSourceState,
  usageValue: string,
  usageUnit: EnergyUnit,
  ctx: ConversionContext,
  electricIntensityLbPerMMBtu?: number | null,
): EnergySummary {
  const rateValue = Math.max(num(source.rate), 0);
  const unitRate = ENERGY_UNITS[source.rateUnit];
  const unitUsage = ENERGY_UNITS[usageUnit];

  const rateUnitMMBtu = unitRate.toMMBtu(1, ctx);
  const loadValue = Math.max(num(usageValue), 0);
  const loadMMBtu = unitUsage.toMMBtu(loadValue, ctx);
  const ratePerMMBtu = rateUnitMMBtu > 0 ? rateValue / rateUnitMMBtu : 0;

  const rawEfficiency = num(source.efficiency);
  let efficiency = rawEfficiency;
  if (rawEfficiency > 10) {
    efficiency = rawEfficiency / 100;
  }
  if (!isFinite(efficiency) || efficiency <= 0) {
    efficiency = 1;
  }

  const deliveredMMBtu = loadMMBtu;
  const inputMMBtu = efficiency > 0 ? loadMMBtu / efficiency : 0;
  const totalCost = ratePerMMBtu * inputMMBtu;
  const costPerDelivered = deliveredMMBtu > 0 ? totalCost / deliveredMMBtu : 0;

  const baseFuel = FUEL_OPTION_MAP[source.fuel] ?? FUEL_OPTION_MAP.naturalGas;
  const isElectricFuel = baseFuel.isElectric === true;
  const electricFactor = electricIntensityLbPerMMBtu ?? 0;
  const co2eFactor = isElectricFuel ? electricFactor : baseFuel.co2eLbPerMMBtu;
  const co2eLb = co2eFactor * inputMMBtu;
  const noxLb = (isElectricFuel ? 0 : baseFuel.noxLbPerMMBtu) * inputMMBtu;
  const soxLb = (isElectricFuel ? 0 : baseFuel.soxLbPerMMBtu) * inputMMBtu;
  const electricLabelSuffix = source.electricRegion?.trim().toUpperCase() || "";
  const fuel =
    isElectricFuel && electricLabelSuffix
      ? { ...baseFuel, label: `${baseFuel.label} – ${electricLabelSuffix}` }
      : baseFuel;

  return {
    name: source.name.trim() || "Source",
    ratePerMMBtu,
    inputMMBtu,
    deliveredMMBtu,
    totalCost,
    efficiency,
    costPerDelivered,
    fuel,
    emissions: {
      co2eLb,
      noxLb,
      soxLb,
    },
  };
}

function SourceLabelSelect({
  state,
  onChange,
}: {
  state: RateSourceState;
  onChange: (next: RateSourceState) => void;
}) {
  const labelIsPreset = LABEL_OPTIONS.includes(state.name as (typeof LABEL_OPTIONS)[number]);
  const selectValue = labelIsPreset ? state.name : "other";

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(value) => {
          if (value === "other") {
            onChange({ ...state, name: labelIsPreset ? "" : state.name });
          } else {
            const presetDefaults = PRESET_SOURCE_METADATA[value as (typeof LABEL_OPTIONS)[number]];
            const nextEfficiency =
              presetDefaults?.defaultEfficiency != null
                ? formatEfficiency(presetDefaults.defaultEfficiency)
                : state.efficiency;
            const nextFuel = presetDefaults?.defaultFuel ?? state.fuel ?? DEFAULT_FUEL;
            const fuelMeta = FUEL_OPTION_MAP[nextFuel] ?? FUEL_OPTION_MAP[DEFAULT_FUEL];
            const nextElectricRegion = presetDefaults?.defaultElectricRegion
              ? presetDefaults.defaultElectricRegion
              : fuelMeta.isElectric
                ? state.electricRegion || DEFAULT_ELECTRIC_REGION
                : state.electricRegion;
            onChange({
              ...state,
              name: value,
              efficiency: nextEfficiency,
              fuel: nextFuel,
              electricRegion: nextElectricRegion,
            });
          }
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
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
      {selectValue === "other" && (
        <Input
          value={state.name}
          onChange={(event) => onChange({ ...state, name: event.target.value })}
          placeholder="Custom label"
        />
      )}
    </div>
  );
}

function RateSourceCard({
  title,
  state,
  onChange,
  electricState,
}: {
  title: string;
  state: RateSourceState;
  onChange: (next: RateSourceState) => void;
  electricState?: ElectricIntensityHookState;
}) {
  const selectedFuelKey = state.fuel ?? DEFAULT_FUEL;
  const selectedFuel = FUEL_OPTION_MAP[selectedFuelKey] ?? FUEL_OPTION_MAP[DEFAULT_FUEL];
  const isElectric = selectedFuel.isElectric === true;
  const electricRegion = state.electricRegion || DEFAULT_ELECTRIC_REGION;
  const intensityData = electricState?.data;

  return (
    <Card>
      <CardContent className="mt-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Select a preset or custom label. Presets preload a typical delivered efficiency that you can
            adjust after entering the billing rate for this energy source.
          </p>
        </div>

        <div>
          <Label>Label</Label>
          <SourceLabelSelect state={state} onChange={onChange} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Rate</Label>
            <Input value={state.rate} onChange={(e) => onChange({ ...state, rate: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Dollar cost per billing unit.</p>
          </div>
          <div>
            <Label>Rate Unit</Label>
            <Select value={state.rateUnit} onValueChange={(value) => onChange({ ...state, rateUnit: value as EnergyUnit })}>
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
            <p className="text-xs text-muted-foreground mt-1">
              {ENERGY_UNITS[state.rateUnit].description}
            </p>
          </div>
        </div>

        <div>
          <Label>Delivered Efficiency</Label>
          <Input
            value={state.efficiency}
            onChange={(e) => onChange({ ...state, efficiency: e.target.value })}
            placeholder="0.90"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter as a decimal fraction, COP, or percentage (e.g., 0.90, 3.20, or 90%). Presets use
            typical efficiencies for each technology, but you can override them.
          </p>
        </div>

        <div>
          <Label>Emissions Profile</Label>
          <Select
            value={selectedFuelKey}
            onValueChange={(value) => {
              const nextFuel = value as FuelOptionKey;
              const meta = FUEL_OPTION_MAP[nextFuel] ?? FUEL_OPTION_MAP[DEFAULT_FUEL];
              const nextRegion = meta.isElectric
                ? state.electricRegion || DEFAULT_ELECTRIC_REGION
                : state.electricRegion;
              onChange({ ...state, fuel: nextFuel, electricRegion: nextRegion });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUEL_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">{selectedFuel.description}</p>
        </div>

        {isElectric && (
          <div>
            <Label>Grid Region (ISO)</Label>
            <Select
              value={electricRegion}
              onValueChange={(value) =>
                onChange({ ...state, electricRegion: value || DEFAULT_ELECTRIC_REGION })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ELECTRIC_ZONES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Carbon intensity is sourced from ElectricityMaps using the selected ISO's rolling window.
            </p>
            {electricState?.status === "loading" && (
              <p className="text-xs text-muted-foreground mt-1">Loading ElectricityMaps intensity…</p>
            )}
            {electricState?.status === "error" && electricState.error && (
              <p className="text-xs text-destructive mt-1">{electricState.error}</p>
            )}
            {electricState?.status === "success" && intensityData && (
              <p className="text-xs text-muted-foreground mt-1">
                {fmt1(intensityData.gCO2PerKWh)} gCO₂/kWh ({fmt1(intensityData.lbPerMMBtu)} lb/MMBtu · {" "}
                {intensityData.samples} samples, {intensityData.window} avg)
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EnergyComparison() {
  const [hhv, setHhv] = useState(String(DEFAULT_HHV_MBTU_PER_MCF));
  const [usageValue, setUsageValue] = useState("1200");
  const [usageUnit, setUsageUnit] = useState<EnergyUnit>("therm");
  const [sourceA, setSourceA] = useState<RateSourceState>({
    name: "Natural Gas Furnace",
    rate: "1.20",
    rateUnit: "therm",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Natural Gas Furnace"].defaultEfficiency ?? 0.9),
    fuel: PRESET_SOURCE_METADATA["Natural Gas Furnace"].defaultFuel ?? DEFAULT_FUEL,
    electricRegion: DEFAULT_ELECTRIC_REGION,
  });
  const [sourceB, setSourceB] = useState<RateSourceState>({
    name: "Electric Resistance",
    rate: "0.18",
    rateUnit: "kwh",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Electric Resistance"].defaultEfficiency ?? 1),
    fuel: PRESET_SOURCE_METADATA["Electric Resistance"].defaultFuel ?? DEFAULT_FUEL,
    electricRegion:
      PRESET_SOURCE_METADATA["Electric Resistance"].defaultElectricRegion ?? DEFAULT_ELECTRIC_REGION,
  });

  const context = useMemo(() => {
    const parsed = num(hhv);
    const fallback = parsed > 0 ? parsed : DEFAULT_HHV_MBTU_PER_MCF;
    return { hhv: fallback };
  }, [hhv]);

  const fuelOptionA = FUEL_OPTION_MAP[sourceA.fuel] ?? FUEL_OPTION_MAP[DEFAULT_FUEL];
  const fuelOptionB = FUEL_OPTION_MAP[sourceB.fuel] ?? FUEL_OPTION_MAP[DEFAULT_FUEL];
  const electricZoneA = fuelOptionA.isElectric ? sourceA.electricRegion || DEFAULT_ELECTRIC_REGION : null;
  const electricZoneB = fuelOptionB.isElectric ? sourceB.electricRegion || DEFAULT_ELECTRIC_REGION : null;

  const electricInfoA = useElectricIntensity(electricZoneA);
  const electricInfoB = useElectricIntensity(electricZoneB);
  const electricIntensityA = electricInfoA.data?.lbPerMMBtu ?? null;
  const electricIntensityB = electricInfoB.data?.lbPerMMBtu ?? null;

  const summaryA = useMemo(
    () => computeEnergySummary(sourceA, usageValue, usageUnit, context, electricIntensityA),
    [sourceA, usageValue, usageUnit, context, electricIntensityA],
  );
  const summaryB = useMemo(
    () => computeEnergySummary(sourceB, usageValue, usageUnit, context, electricIntensityB),
    [sourceB, usageValue, usageUnit, context, electricIntensityB],
  );

  const deliveredLoad = Math.max(summaryA.deliveredMMBtu, summaryB.deliveredMMBtu);
  const hasLoad = deliveredLoad > 0;
  const normalizedCostA = hasLoad ? summaryA.costPerDelivered * deliveredLoad : 0;
  const normalizedCostB = hasLoad ? summaryB.costPerDelivered * deliveredLoad : 0;
  const relative = summaryA.costPerDelivered > 0 ? summaryB.costPerDelivered / summaryA.costPerDelivered : NaN;
  const savings = normalizedCostB - normalizedCostA;

  let savingsMessage = "";
  if (hasLoad && isFinite(savings)) {
    if (Math.abs(savings) < 1e-6) {
      savingsMessage = "Both options are cost-equivalent for the modeled load.";
    } else if (savings > 0) {
      savingsMessage = `${summaryA.name} saves ${fmtCurrency(savings)} versus ${summaryB.name} for ${fmt1(
        deliveredLoad
      )} MMBtu delivered.`;
    } else {
      savingsMessage = `${summaryB.name} saves ${fmtCurrency(Math.abs(savings))} versus ${summaryA.name} for ${fmt1(
        deliveredLoad
      )} MMBtu delivered.`;
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Gas HHV (MMBtu/MCF)</Label>
            <Input value={hhv} onChange={(e) => setHhv(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Defaults to {DEFAULT_HHV_MBTU_PER_MCF}. Adjust to match your territory billing factor.
            </p>
          </div>
          <div>
            <Label>Modeled Load</Label>
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
            <p className="text-xs text-muted-foreground mt-1">
              Enter the shared load to evaluate. Usage is converted to delivered MMBtu for each
              option.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <RateSourceCard
          title="Primary Energy"
          state={sourceA}
          onChange={setSourceA}
          electricState={electricInfoA}
        />
        <RateSourceCard
          title="Comparison Energy"
          state={sourceB}
          onChange={setSourceB}
          electricState={electricInfoB}
        />
      </div>

      <Card>
        <CardContent className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Cost Summary</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Rate inputs are converted to $/MMBtu, scaled to the shared load, and adjusted by each
              source's delivered efficiency.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Rate ($/MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Input Energy (MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Delivered Load (MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Total Cost</th>
                  <th className="px-3 py-2 font-medium">Cost / Delivered MMBtu</th>
                </tr>
              </thead>
              <tbody>
                {[summaryA, summaryB].map((row) => (
                  <tr key={row.name} className="border-b last:border-0 border-border/60">
                    <td className="px-3 py-2 align-top font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2 align-top font-mono">{fmtCurrency(row.ratePerMMBtu)}</td>
                    <td className="px-3 py-2 align-top font-mono">{fmt1(row.inputMMBtu)}</td>
                    <td className="px-3 py-2 align-top font-mono">{fmt1(row.deliveredMMBtu)}</td>
                    <td className="px-3 py-2 align-top font-mono">{fmtCurrency(row.totalCost)}</td>
                    <td className="px-3 py-2 align-top font-mono">{fmtCurrency(row.costPerDelivered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isFinite(relative) && relative > 0 && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
              <div className="font-medium text-foreground">
                {summaryB.name} is {fmt2(relative)}× the delivered cost of {summaryA.name}.
              </div>
              {savingsMessage && <div className="text-muted-foreground mt-1">{savingsMessage}</div>}
            </div>
          )}
          {!isFinite(relative) && savingsMessage && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              {savingsMessage}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Emissions Impact</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Emissions are based on input energy, EPA stationary combustion factors for on-site fuels,
              and ElectricityMaps' rolling grid carbon intensity for electric regions.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Fuel</th>
                  <th className="px-3 py-2 font-medium">CO₂e</th>
                  <th className="px-3 py-2 font-medium">NOₓ</th>
                  <th className="px-3 py-2 font-medium">SOₓ</th>
                </tr>
              </thead>
              <tbody>
                {[summaryA, summaryB].map((row) => (
                  <tr key={row.name} className="border-b last:border-0 border-border/60">
                    <td className="px-3 py-2 align-top font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{row.fuel.label}</td>
                    <td className="px-3 py-2 align-top font-mono">{formatEmissions(row.emissions.co2eLb)}</td>
                    <td className="px-3 py-2 align-top font-mono">{formatEmissions(row.emissions.noxLb)}</td>
                    <td className="px-3 py-2 align-top font-mono">{formatEmissions(row.emissions.soxLb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            CO₂e includes CO₂, CH₄, and N₂O using 100-year global warming potentials. Grid emission
            factors come from ElectricityMaps' 30-day average for the selected ISO. NOₓ and SOₓ reflect
            site-level combustion only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------
// Tests tab
// -----------------------------
function Tests() {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <ul className="list-disc list-inside">
        <li>1 ton = 12,000 BTU/hr</li>
        <li>1 kW = 3,412 BTU/hr</li>
        <li>1 HP ≈ 2,544 BTU/hr</li>
        <li>1 Therm = 100,000 BTU</li>
        <li>1 DTH = 1,000,000 BTU</li>
        <li>1 MLB = 1,000,000 BTU (rounded)</li>
      </ul>
    </div>
  );
}

// -----------------------------
// Page
// -----------------------------
export default function EnergyProToolkit() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="converter" className="w-full">
        <TabsList className="w-full overflow-x-auto flex-nowrap whitespace-nowrap sm:flex-wrap px-2">
          <TabsTrigger value="converter">Converter</TabsTrigger>
          <TabsTrigger value="load">Load Estimator</TabsTrigger>
          <TabsTrigger value="gasflow">Gas Flow</TabsTrigger>
          <TabsTrigger value="ranges">Typical Ranges</TabsTrigger>
          <TabsTrigger value="rates">Energy Comparison</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="converter">
          <Converter />
        </TabsContent>
        <TabsContent value="load">
          <LoadEstimator />
        </TabsContent>
        <TabsContent value="gasflow">
          <Card>
            <CardContent className="mt-4 space-y-3 text-sm text-muted-foreground">
              <h3 className="text-lg font-semibold text-foreground">Gas Flow Toolkit (in progress)</h3>
              <p>
                Use the converter and load estimator to approximate CFH today. Planned updates will
                add line sizing lookups and pressure drop tools in this tab.
              </p>
              <p className="text-xs">
                Have a specific worksheet you rely on? Drop a note so we can prioritize building it
                into this experience.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ranges">
          <TypicalRangesTable />
        </TabsContent>
        <TabsContent value="rates">
          <EnergyComparison />
        </TabsContent>
        <TabsContent value="tests">
          <Tests />
        </TabsContent>
      </Tabs>
    </div>
  );
}
