"use client";

import React, { Fragment, useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ArrowDown, ArrowLeftRight, ArrowRight, Flame, Zap } from "lucide-react";
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

// --- Helpers & constants ---
const BTU_PER_TON = 12000;
const BTU_PER_HP = 2544.4336;
const BTU_PER_THERM = 100000;
const BTU_PER_DTH = 1_000_000;
const BTU_PER_MLB = 1_000_000;
const BTU_PER_GAL_OIL_NO2 = 138500; // No. 2 fuel oil
const BTU_PER_GAL_DIESEL = 137000; // Diesel
const DEFAULT_HHV_MBTU_PER_MCF = 1.035;
const BTU_PER_MCF = DEFAULT_HHV_MBTU_PER_MCF * 1_000_000;
const BTU_PER_CCF = BTU_PER_MCF / 10;

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

const PRESET_SOURCE_METADATA: Record<(typeof LABEL_OPTIONS)[number], { defaultEfficiency?: number }> = {
  "Natural Gas Furnace": { defaultEfficiency: 0.9 },
  "Propane Furnace": { defaultEfficiency: 0.9 },
  "Electric Resistance": { defaultEfficiency: 1 },
  "Air-Source Heat Pump": { defaultEfficiency: 2.8 },
  "Ground-Source Heat Pump": { defaultEfficiency: 3.5 },
  "Fuel Oil Boiler": { defaultEfficiency: 0.87 },
  "Steam Boiler": { defaultEfficiency: 0.8 },
  "District Steam": { defaultEfficiency: 0.82 },
  "Other Custom": {},
};

const formatEfficiency = (value: number) => value.toFixed(2);

const ARCHETYPES = [
  // Residential / light commercial space heat
  { key: "res_furnace", name: "Residential furnace", range: [40000, 120000], note: "80–98% AFUE" },
  { key: "unit_heater", name: "Unit heater (suspended)", range: [30000, 400000], note: "Warehouse/garage" },
  { key: "res_boiler", name: "Residential boiler", range: [60000, 200000], note: "Hydronic" },

  // Water heating
  {
    key: "res_storage_wh",
    name: "Residential storage water heater",
    range: [30000, 75000],
    note: "Tank type",
  },
  {
    key: "tankless_wh",
    name: "Tankless water heater (res/com)",
    range: [150000, 199000],
    note: "Condensing",
  },
  {
    key: "comm_water_heater",
    name: "Commercial water heater",
    range: [199000, 1500000],
    note: "Condensing, restaurants/multi-use",
  },

  // Packaged HVAC with gas heat
  {
    key: "rtu_gas_heat",
    name: "Commercial RTU (gas heat section)",
    range: [100000, 1200000],
    note: "Packaged HVAC",
  },

  // Boilers (commercial/institutional)
  {
    key: "comm_boiler_small",
    name: "Commercial boiler (small)",
    range: [500000, 2000000],
    note: "Schools/small bldgs",
  },
  {
    key: "comm_boiler_med",
    name: "Commercial boiler (medium)",
    range: [2000000, 10000000],
    note: "Hospitals/large bldgs",
  },

  // Process & make-up air
  { key: "paint_booth", name: "Paint booth MUA", range: [1000000, 5000000], note: "Auto/body" },
  {
    key: "industrial_proc",
    name: "Industrial process heater",
    range: [10000000, 100000000],
    note: "Heavy industry",
  },

  // Foodservice (approximate per-appliance)
  {
    key: "range_6_burner",
    name: "Restaurant range (6-burner)",
    range: [60000, 210000],
    note: "10–35k BTU/hr per burner",
  },
  {
    key: "griddle_comm",
    name: "Commercial griddle",
    range: [60000, 160000],
    note: "Plate size dependent",
  },
  { key: "fryer_comm", name: "Commercial fryer", range: [80000, 200000], note: "Single vat" },
  { key: "pizza_oven", name: "Pizza deck/stone oven", range: [80000, 200000], note: "Style/size dependent" },

  // CHP / Fuel cells (thermal shown in BTU/hr; electric noted)
  {
    key: "chp_engine",
    name: "CHP (engine/turbine)",
    range: [1000000, 10000000],
    note: "Thermal 1–10 MMBtu/hr; Electric ~200 kW–5 MW",
  },
  {
    key: "fuel_cell",
    name: "Fuel cell CHP",
    range: [300000, 6000000],
    note: "Thermal 0.3–6 MMBtu/hr; Electric ~100 kW–2 MW",
  },
] as const;

const formatArchetypeRange = ([min, max]: readonly [number, number]) => `${fmt0(min)} – ${fmt0(max)} BTU/hr`;

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

// --- Converter ---
function Converter() {
  const [val, setVal] = useState("9000000");
  const [unit, setUnit] = useState("BTU/hr");
  const [energyReference, setEnergyReference] = useState<"input" | "output">("output");
  const [hhv, setHhv] = useState(String(DEFAULT_HHV_MBTU_PER_MCF));
  const [hours, setHours] = useState("500");
  const [efficiency, setEfficiency] = useState("90");

  const calc = useMemo(() => {
    const value = num(val);
    const parsedHHV = num(hhv);
    const HHV = parsedHHV > 0 ? parsedHHV : DEFAULT_HHV_MBTU_PER_MCF;
    const hrs = Math.max(num(hours), 0);
    const efficiencyInput = efficiency.trim();
    const parsedEfficiency = num(efficiencyInput);
    const efficiencyPct = parsedEfficiency > 0 ? parsedEfficiency : 90;

    const efficiencyDecimal = efficiencyPct > 0 ? efficiencyPct / 100 : 0.9;

    let baseBtuh = value;
    switch (unit) {
      case "kW":
        baseBtuh = value * BTU_PER_KW;
        break;
      case "Ton":
        baseBtuh = value * BTU_PER_TON;
        break;
      case "HP":
        baseBtuh = value * BTU_PER_HP;
        break;
      case "Therm/hr":
        baseBtuh = value * BTU_PER_THERM;
        break;
      case "DTH/hr":
        baseBtuh = value * BTU_PER_DTH;
        break;
      case "Steam MLB/hr":
        baseBtuh = value * BTU_PER_MLB;
        break;
      case "No. 2 Oil (gal/hr)":
        baseBtuh = value * BTU_PER_GAL_OIL_NO2;
        break;
      case "Diesel (gal/hr)":
        baseBtuh = value * BTU_PER_GAL_DIESEL;
        break;
      case "MBtu/hr":
        baseBtuh = value * 1_000;
        break;
      case "MMBtu/hr":
        baseBtuh = value * 1_000_000;
        break;
      case "CFH":
        baseBtuh = value * HHV * 1_000;
        break;
    }

    let btuh_input = baseBtuh;
    let btuh_output = baseBtuh;

    if (energyReference === "input") {
      btuh_input = baseBtuh;
      btuh_output = btuh_input * efficiencyDecimal;
    } else {
      btuh_output = baseBtuh;
      btuh_input = efficiencyDecimal > 0 ? btuh_output / efficiencyDecimal : btuh_output;
    }

    // Auto-classification
    let category = "Unknown";
    let colorClass = "text-muted-foreground";
    if (btuh_output < 300000) {
      category = "Residential";
      colorClass = "text-green-500";
    } else if (btuh_output < 3000000) {
      category = "Commercial";
      colorClass = "text-yellow-500";
    } else {
      category = "Industrial";
      colorClass = "text-red-500";
    }

    const kW = btuh_output / BTU_PER_KW;
    const tons = btuh_output / BTU_PER_TON;
    const hp = btuh_output / BTU_PER_HP;
    const mlb_per_hr = btuh_output / BTU_PER_MLB;
    const therm_per_hr = btuh_input / BTU_PER_THERM;
    const dth_per_hr = btuh_input / BTU_PER_DTH;
    const mbtu_per_hr_input = btuh_input / 1_000;
    const cfh = btuh_input / (HHV * 1_000);
    const oil_gph = btuh_input / BTU_PER_GAL_OIL_NO2;
    const diesel_gph = btuh_input / BTU_PER_GAL_DIESEL;

    const totalCF = cfh * hrs;
    const totalMCF = totalCF / 1_000;
    const totalTherms = therm_per_hr * hrs;
    const totalDTH = dth_per_hr * hrs;
    const totalBtusInput = btuh_input * hrs;
    const totalBtusOutput = btuh_output * hrs;
    const totalMBtuInput = mbtu_per_hr_input * hrs;
    const totalMLB = mlb_per_hr * hrs;
    const totalKWh = kW * hrs;
    const totalTons = tons * hrs;
    const totalOilGallons = oil_gph * hrs;
    const totalDieselGallons = diesel_gph * hrs;

    return {
      btuh_input,
      btuh_output,
      kW,
      tons,
      hp,
      mlb_per_hr,
      therm_per_hr,
      dth_per_hr,
      mbtu_per_hr_input,
      cfh,
      oil_gph,
      diesel_gph,
      totalMCF,
      totalTherms,
      totalDTH,
      totalBtusInput,
      totalBtusOutput,
      totalMBtuInput,
      totalMLB,
      totalKWh,
      totalTons,
      totalOilGallons,
      totalDieselGallons,
      efficiencyPct,
      category,
      colorClass,
    };
  }, [val, unit, hhv, hours, energyReference, efficiency]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-muted-foreground mt-2 mb-4">
        <div className="flex items-center gap-2 text-foreground">
          <Flame className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">Input Fuel</span>
        </div>
        <ArrowDown className="h-4 w-4 sm:hidden" />
        <ArrowRight className="hidden h-4 w-4 sm:block" />
        <div className="border rounded-lg px-3 py-1 bg-muted/50 font-medium text-foreground">
          Efficiency: {fmt0(calc.efficiencyPct)}%
        </div>
        <ArrowDown className="h-4 w-4 sm:hidden" />
        <ArrowRight className="hidden h-4 w-4 sm:block" />
        <div className="flex items-center gap-2 text-foreground">
          <Zap className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">Delivered Output</span>
        </div>
      </div>

      {/* Inputs */}
      <Card>
        <CardContent className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
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
                  <SelectItem value="No. 2 Oil (gal/hr)">No. 2 Oil (gal/hr)</SelectItem>
                  <SelectItem value="Diesel (gal/hr)">Diesel (gal/hr)</SelectItem>
                  <SelectItem value="MBtu/hr">MBtu/hr (Energy Rate)</SelectItem>
                  <SelectItem value="MMBtu/hr">MMBtu/hr (Energy Rate)</SelectItem>
                  <SelectItem value="CFH">CFH (Gas Flow Rate)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Energy Reference</Label>
              <Select
                value={energyReference}
                onValueChange={(value) => setEnergyReference(value as "input" | "output")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="input">
                    <span className="flex items-center gap-2">
                      <Flame className="h-4 w-4" aria-hidden="true" />
                      <span>Input Fuel</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="output">
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" aria-hidden="true" />
                      <span>Delivered Output</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Select whether the entered value represents input fuel or delivered output energy.
              </p>
            </div>

            <div>
              <Label>Efficiency (%)</Label>
              <Input value={efficiency} onChange={(e) => setEfficiency(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Represents system efficiency. Used to convert between input fuel and delivered output energy.
              </p>
            </div>

            {/* Auto Classification */}
            <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
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

      {/* Input Demand */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Flame className="h-4 w-4" aria-hidden="true" />
            <span>Input Demand (Fuel Energy Rate)</span>
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <Readout label="BTU/hr (Input)" value={fmt0(calc.btuh_input)} />
            <Readout label="MBtu/hr (Input)" value={fmt0(calc.mbtu_per_hr_input)} />
            <Readout label="CFH" value={fmt0(calc.cfh)} />
            <Readout label="Therm/hr" value={fmt0(calc.therm_per_hr)} />
            <Readout label="DTH/hr" value={fmt0(calc.dth_per_hr)} />
            <Readout label="No. 2 Oil (gal/hr)" value={fmt2(calc.oil_gph)} />
            <Readout label="Diesel (gal/hr)" value={fmt2(calc.diesel_gph)} />
          </div>
        </CardContent>
      </Card>

      {/* Output Demand */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span>Output Demand (Delivered Energy Rate)</span>
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <Readout label="BTU/hr (Output)" value={fmt0(calc.btuh_output)} />
            <Readout label="kW" value={fmt0(calc.kW)} />
            <Readout label="Tons" value={fmt0(calc.tons)} />
            <Readout label="HP" value={fmt0(calc.hp)} />
            <Readout label="MLBs/hr" value={fmt0(calc.mlb_per_hr)} />
          </div>
        </CardContent>
      </Card>

      {/* Total Fuel Energy */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Flame className="h-4 w-4" aria-hidden="true" />
            <span>Total Fuel Energy (over time)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Computed as fuel input × hours of operation.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <Readout label="BTU" value={fmt0(calc.totalBtusInput)} />
            <Readout label="MBtu" value={fmt0(calc.totalMBtuInput)} />
            <Readout label="MCF" value={fmt0(calc.totalMCF)} />
            <Readout label="Therms" value={fmt0(calc.totalTherms)} />
            <Readout label="DTH" value={fmt0(calc.totalDTH)} />
            <Readout label="No. 2 Oil (gal)" value={fmt2(calc.totalOilGallons)} />
            <Readout label="Diesel (gal)" value={fmt2(calc.totalDieselGallons)} />
          </div>
        </CardContent>
      </Card>

      {/* Total Delivered Energy */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span>Total Delivered Energy (over time)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Computed as delivered output × hours of operation.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <Readout label="BTU" value={fmt0(calc.totalBtusOutput)} />
            <Readout label="kWh" value={fmt0(calc.totalKWh)} />
            <Readout label="Tons" value={fmt0(calc.totalTons)} />
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

// --- Gas Flow ---
function GasFlow() {
  return (
    <Card>
      <CardContent className="mt-4 space-y-3 text-sm text-muted-foreground">
        <h3 className="text-lg font-semibold text-foreground">Gas Flow Toolkit (in progress)</h3>
        <p>
          Use the converter and load estimator to approximate CFH today. Planned updates will add line sizing
          lookups and pressure drop tools in this tab.
        </p>
        <p className="text-xs">
          Have a specific worksheet you rely on? Drop a note so we can prioritize building it into this
          experience.
        </p>
      </CardContent>
    </Card>
  );
}

// --- Typical Ranges ---
function Ranges() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Typical Gas Appliance Input Ranges</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Representative BTU/hr inputs for common combustion equipment. Use these to contextualize
              load calculations, installed nameplate values, or replacement opportunities.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ARCHETYPES.map((item) => (
              <div
                key={item.key}
                className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-2"
              >
                <div className="text-sm font-semibold text-foreground">{item.name}</div>
                <div className="font-mono text-lg text-foreground">
                  {formatArchetypeRange(item.range)}
                </div>
                <p className="text-xs text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Compare your calculated peak load or installed capacity to these references as a
            sanity check before committing to equipment selections.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Load Estimator (with chart) ---
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
};

type EnergySummary = {
  name: string;
  ratePerMMBtu: number;
  inputMMBtu: number;
  deliveredMMBtu: number;
  totalCost: number;
  efficiency: number;
  costPerDelivered: number;
};

function computeEnergySummary(
  source: RateSourceState,
  usageValue: string,
  usageUnit: EnergyUnit,
  ctx: ConversionContext,
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
  return {
    name: source.name.trim() || "Source",
    ratePerMMBtu,
    inputMMBtu,
    deliveredMMBtu,
    totalCost,
    efficiency,
    costPerDelivered,
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
            onChange({
              ...state,
              name: value,
              efficiency: nextEfficiency,
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
}: {
  title: string;
  state: RateSourceState;
  onChange: (next: RateSourceState) => void;
}) {
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
      </CardContent>
    </Card>
  );
}

// --- Energy Comparison ---
function EnergyComparison() {
  const [hhv, setHhv] = useState(String(DEFAULT_HHV_MBTU_PER_MCF));
  const [usageValue, setUsageValue] = useState("1200");
  const [usageUnit, setUsageUnit] = useState<EnergyUnit>("therm");
  const [sourceA, setSourceA] = useState<RateSourceState>({
    name: "Natural Gas Furnace",
    rate: "1.20",
    rateUnit: "therm",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Natural Gas Furnace"].defaultEfficiency ?? 0.9),
  });
  const [sourceB, setSourceB] = useState<RateSourceState>({
    name: "Electric Resistance",
    rate: "0.18",
    rateUnit: "kwh",
    efficiency: formatEfficiency(PRESET_SOURCE_METADATA["Electric Resistance"].defaultEfficiency ?? 1),
  });

  const context = useMemo(() => {
    const parsed = num(hhv);
    const fallback = parsed > 0 ? parsed : DEFAULT_HHV_MBTU_PER_MCF;
    return { hhv: fallback };
  }, [hhv]);

  const summaryA = useMemo(
    () => computeEnergySummary(sourceA, usageValue, usageUnit, context),
    [sourceA, usageValue, usageUnit, context],
  );
  const summaryB = useMemo(
    () => computeEnergySummary(sourceB, usageValue, usageUnit, context),
    [sourceB, usageValue, usageUnit, context],
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
        />
        <RateSourceCard
          title="Comparison Energy"
          state={sourceB}
          onChange={setSourceB}
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

    </div>
  );
}

// --- Emissions Comparison ---
type GridMixEntry = {
  label: string;
  value: number; // percent of total
  mw: number; // absolute MW
};

type PjmEmissionsResponse = {
  carbonIntensity: number | null;
  carbonIntensityUnits: string;
  gridMix: GridMixEntry[];
  totalMw?: number;
  timestamp: string | null;
  timestampEpt?: string | null;
  source: string;
  updatedAt?: string | null;
};

type EmissionsApiResponse = PjmEmissionsResponse & {
  carbon_intensity?: number | null;
  carbon_intensity_units?: string;
  grid_mix?: Array<Record<string, unknown>> | Record<string, number>;
  mix?: Array<Record<string, unknown>> | Record<string, number>;
};

const PRETTY_GRID_LABELS: Record<string, string> = {
  COAL: "Coal",
  NG: "Natural Gas",
  HYDRO: "Hydro",
  OTHER: "Other",
  NUCLEAR: "Nuclear",
  OIL: "Oil",
  SOLAR: "Solar",
  WIND: "Wind",
};

const NAT_GAS_CI = 400; // lbs/MWh, approx 117 lb/MMBtu * 3.412

function EmissionsComparison() {
  const [data, setData] = useState<EmissionsApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carbonIntensity = useMemo(() => {
    const value = data?.carbonIntensity ?? data?.carbon_intensity;
    return typeof value === "number" && isFinite(value) ? value : null;
  }, [data]);

  const carbonIntensityUnits = data?.carbonIntensityUnits ?? data?.carbon_intensity_units ?? "lbs CO₂/MWh";

  const gridMix = useMemo(() => {
    const rawMix = (data?.gridMix ?? data?.grid_mix ?? data?.mix) as
      | Array<Record<string, unknown>>
      | Record<string, unknown>
      | undefined;

    if (!rawMix) return [] as GridMixEntry[];

    if (Array.isArray(rawMix)) {
      return rawMix
        .map((entry) => {
          const labelCandidate =
            (typeof entry.label === "string" && entry.label.trim()) ||
            (typeof entry.fuel === "string" && entry.fuel.trim()) ||
            (typeof entry.source === "string" && entry.source.trim()) ||
            (typeof entry.type === "string" && entry.type.trim()) ||
            (typeof entry.name === "string" && entry.name.trim());
          const value = Number(
            entry.value ??
              entry.percentage ??
              entry.percent ??
              entry.share ??
              entry.mix ??
              0,
          );
          const mw = Number(entry.mw ?? entry.MW ?? entry.megawatts ?? entry.amount ?? 0);
          if (!labelCandidate || !isFinite(value)) return null;
          return {
            label: labelCandidate,
            value,
            mw: Number.isFinite(mw) ? mw : 0,
          } satisfies GridMixEntry;
        })
        .filter((entry): entry is GridMixEntry => Boolean(entry));
    }

    return Object.entries(rawMix)
      .map(([label, value]) => ({ label, value: Number(value), mw: 0 }))
      .filter((entry) => isFinite(entry.value));
  }, [data]);

  const sortedGridMix = useMemo(
    () => [...gridMix].sort((a, b) => b.value - a.value),
    [gridMix],
  );

  const totalMw = data?.totalMw;

  const formatLocalTime = (utcString: string | null) => {
    if (!utcString) return null;
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dt = new Date(utcString);
    return dt.toLocaleString("en-US", {
      timeZone: localTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const updatedLabel = formatLocalTime(data?.timestamp ?? null);

  const gridCarbonIntensity = carbonIntensity ?? null;
  const gridToNatGasRatio =
    gridCarbonIntensity !== null ? gridCarbonIntensity / NAT_GAS_CI : null;

  useEffect(() => {
    let isMounted = true;

    const fetchEmissions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/pjm-gen-emissions");
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload: EmissionsApiResponse = await response.json();
        if (isMounted) {
          setData(payload);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load emissions data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchEmissions();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">PJM Generation Emissions</h3>
            <p className="text-sm text-muted-foreground">
              Live grid mix and carbon intensity from the PJM Data Miner feed.
            </p>
          </div>

          {loading && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">Loading emissions data…</div>
          )}

          {error && !loading && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && (
            <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
              <div className="rounded-md border border-border/60 p-4 space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Carbon Intensity</div>
                  <div className="text-3xl font-semibold">
                    {carbonIntensity !== null ? fmt1(carbonIntensity) : "–"}
                    <span className="ml-2 text-base font-normal text-muted-foreground">{carbonIntensityUnits}</span>
                  </div>
                </div>
                {updatedLabel ? (
                  <p className="text-sm text-muted-foreground">Updated {updatedLabel}</p>
                ) : null}
              </div>

              <div className="rounded-md border border-border/60 p-4">
                <div className="font-semibold mb-2">Grid Mix</div>
                {sortedGridMix.length === 0 || error ? (
                  <div className="text-sm text-muted-foreground">No grid mix data available.</div>
                ) : (
                  <div className="grid grid-cols-[minmax(0,1fr)_110px_70px] gap-y-1 text-sm">
                    <span className="font-semibold">Fuel</span>
                    <span className="text-center font-semibold tabular-nums whitespace-nowrap">MW</span>
                    <span className="text-right font-semibold tabular-nums whitespace-nowrap">Share</span>
                    {sortedGridMix.map((entry) => {
                      const readableLabel = PRETTY_GRID_LABELS[entry.label] ?? entry.label;
                      const percent = Number.isFinite(entry.value) ? entry.value : 0;

                      return (
                        <Fragment key={entry.label}>
                          <span className="text-foreground">{readableLabel}</span>
                          <span className="text-center tabular-nums whitespace-nowrap font-mono text-muted-foreground">
                            {entry.mw.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-right tabular-nums whitespace-nowrap font-mono text-muted-foreground">
                            {fmt1(percent)}%
                          </span>
                        </Fragment>
                      );
                    })}
                    {typeof totalMw === "number" && (
                      <>
                        <span className="text-xs text-muted-foreground">Total Generation</span>
                        <span className="text-center tabular-nums whitespace-nowrap text-xs text-muted-foreground">
                          {totalMw.toLocaleString("en-US", { maximumFractionDigits: 0 })} MW
                        </span>
                        <span />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 border rounded-xl p-4">
            <h3 className="font-semibold mb-2">Natural Gas Customer Emissions</h3>
            <p className="text-sm mb-2">
              Onsite natural gas combustion (typical boiler or furnace) has an emissions factor of approximately:
            </p>
            <p className="text-2xl font-semibold">
              {NAT_GAS_CI.toFixed(0)} <span className="text-base font-normal">lbs/MWh</span>
            </p>
            {gridCarbonIntensity !== null && gridToNatGasRatio !== null && (
              <p className="text-sm text-muted-foreground mt-3">
                Compared to the current PJM grid intensity of{" "}
                <strong>{gridCarbonIntensity.toFixed(1)} lbs/MWh</strong>, electricity is{" "}
                <strong>{gridToNatGasRatio.toFixed(2)}×</strong> more carbon intensive per unit of delivered
                energy than burning natural gas onsite.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Conversions tab utilities ---
const TEMPERATURE_OFFSETS = {
  freezingFahrenheit: 32,
  kelvinOffset: 273.15,
};

type ConversionCategoryKey = "energy" | "power" | "temperature" | "flow" | "pressure";

type UnitDefinition = {
  label: string;
  description?: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
};

type CategoryDefinition = {
  label: string;
  units: Record<string, UnitDefinition>;
  placeholder?: string;
};

const CONVERSION_CATEGORY_DEFINITIONS: Record<ConversionCategoryKey, CategoryDefinition> = {
  energy: {
    label: "Energy",
    placeholder: "Enter energy value",
    units: {
      btu: {
        label: "BTU",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      therm: {
        label: "Therm",
        toBase: (value) => value * 100_000,
        fromBase: (value) => value / 100_000,
      },
      dth: {
        label: "Dth",
        toBase: (value) => value * 1_000_000,
        fromBase: (value) => value / 1_000_000,
      },
      mmbtu: {
        label: "MMBTU",
        toBase: (value) => value * 1_000_000,
        fromBase: (value) => value / 1_000_000,
      },
      mcf: {
        label: "MCF",
        toBase: (value) => value * BTU_PER_MCF,
        fromBase: (value) => value / BTU_PER_MCF,
      },
      ccf: {
        label: "CCF",
        toBase: (value) => value * BTU_PER_CCF,
        fromBase: (value) => value / BTU_PER_CCF,
      },
      kwh: {
        label: "kWh",
        toBase: (value) => value * 3_412,
        fromBase: (value) => value / 3_412,
      },
      oilno2: {
        label: "No. 2 Oil (gal)",
        toBase: (value) => value * BTU_PER_GAL_OIL_NO2,
        fromBase: (value) => value / BTU_PER_GAL_OIL_NO2,
      },
      diesel: {
        label: "Diesel (gal)",
        toBase: (value) => value * BTU_PER_GAL_DIESEL,
        fromBase: (value) => value / BTU_PER_GAL_DIESEL,
      },
    },
  },
  power: {
    label: "Power",
    placeholder: "Enter power value",
    units: {
      btuperhour: {
        label: "BTU/hr",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      kw: {
        label: "kW",
        toBase: (value) => value * 3_412,
        fromBase: (value) => value / 3_412,
      },
      ton: {
        label: "Ton",
        toBase: (value) => value * 12_000,
        fromBase: (value) => value / 12_000,
      },
      hp: {
        label: "HP",
        toBase: (value) => value * 2_544,
        fromBase: (value) => value / 2_544,
      },
    },
  },
  temperature: {
    label: "Temperature",
    placeholder: "Enter temperature",
    units: {
      fahrenheit: {
        label: "°F",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      celsius: {
        label: "°C",
        toBase: (value) => (value * 9) / 5 + TEMPERATURE_OFFSETS.freezingFahrenheit,
        fromBase: (value) => ((value - TEMPERATURE_OFFSETS.freezingFahrenheit) * 5) / 9,
      },
      kelvin: {
        label: "K",
        toBase: (value) => ((value - TEMPERATURE_OFFSETS.kelvinOffset) * 9) / 5 + TEMPERATURE_OFFSETS.freezingFahrenheit,
        fromBase: (value) => ((value - TEMPERATURE_OFFSETS.freezingFahrenheit) * 5) / 9 + TEMPERATURE_OFFSETS.kelvinOffset,
      },
    },
  },
  flow: {
    label: "Flow",
    placeholder: "Enter flow rate",
    units: {
      cfh: {
        label: "CFH",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      mcfh: {
        label: "MCFH",
        toBase: (value) => value * 1_000,
        fromBase: (value) => value / 1_000,
      },
      scfh: {
        label: "SCFH",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      mmbtuhr: {
        label: "MMBTU/hr",
        toBase: (value) => (value * 1_000) / 1.035,
        fromBase: (value) => (value * 1.035) / 1_000,
      },
    },
  },
  pressure: {
    label: "Pressure",
    placeholder: "Enter pressure",
    units: {
      psig: {
        label: "psig",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      psia: {
        label: "psia",
        toBase: (value) => value - 14.7,
        fromBase: (value) => value + 14.7,
      },
      inwc: {
        label: "inWC",
        toBase: (value) => value / 27.68,
        fromBase: (value) => value * 27.68,
      },
      kpa: {
        label: "kPa",
        toBase: (value) => value / 6.89476,
        fromBase: (value) => value * 6.89476,
      },
      bar: {
        label: "bar",
        toBase: (value) => value / 0.0689476,
        fromBase: (value) => value * 0.0689476,
      },
    },
  },
};

const parseConversionNumericInput = (value: string) => {
  const sanitized = value.replace(/,/g, "").trim();
  if (!sanitized) return Number.NaN;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatConversionResult = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

// --- Conversions ---
function Conversions() {
  const [category, setCategory] = useState<ConversionCategoryKey>("energy");
  const [fromUnit, setFromUnit] = useState<string>("btu");
  const [toUnit, setToUnit] = useState<string>("therm");
  const [inputValue, setInputValue] = useState<string>("1");

  const unitsForCategory = CONVERSION_CATEGORY_DEFINITIONS[category].units;
  const unitEntries = useMemo(() => Object.entries(unitsForCategory), [unitsForCategory]);

  useEffect(() => {
    const unitKeys = unitEntries.map(([key]) => key);
    if (!unitKeys.includes(fromUnit) || !unitKeys.includes(toUnit)) {
      setFromUnit(unitKeys[0] ?? "");
      setToUnit(unitKeys[1] ?? unitKeys[0] ?? "");
    }
  }, [unitEntries, fromUnit, toUnit]);

  const conversion = useMemo(() => {
    const fromDefinition = unitsForCategory[fromUnit];
    const toDefinition = unitsForCategory[toUnit];
    if (!fromDefinition || !toDefinition) {
      return { formatted: "", numeric: undefined };
    }

    const numericValue = parseConversionNumericInput(inputValue);
    if (!Number.isFinite(numericValue)) {
      return { formatted: "", numeric: undefined };
    }

    const baseValue = fromDefinition.toBase(numericValue);
    const converted = toDefinition.fromBase(baseValue);

    return {
      numeric: converted,
      formatted: formatConversionResult(converted),
    };
  }, [inputValue, fromUnit, toUnit, unitsForCategory]);

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    if (conversion.numeric !== undefined && Number.isFinite(conversion.numeric)) {
      setInputValue(String(conversion.numeric));
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground">
            Quickly convert between common energy, power, temperature, flow, and pressure units.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="conversion-category">Conversion Category</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value as ConversionCategoryKey)}
                  >
                    <SelectTrigger id="conversion-category" className="w-full md:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONVERSION_CATEGORY_DEFINITIONS).map(([key, definition]) => (
                        <SelectItem key={key} value={key}>
                          {definition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
                <TooltipContent>
                  Choose the measurement family to update the available units.
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="conversion-input-value">Input Value</Label>
                  <Input
                    id="conversion-input-value"
                    inputMode="decimal"
                    placeholder={CONVERSION_CATEGORY_DEFINITIONS[category].placeholder}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conversion-from-unit">From Unit</Label>
                  <Select value={fromUnit} onValueChange={setFromUnit}>
                    <SelectTrigger id="conversion-from-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitEntries.map(([key, definition]) => (
                        <SelectItem key={key} value={key}>
                          {definition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-center pb-4 md:pb-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" onClick={handleSwap}>
                      <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden="true" />
                      Swap Units
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reverse the conversion direction.</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="conversion-output-value">Output Value</Label>
                  <Input id="conversion-output-value" readOnly value={conversion.formatted} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conversion-to-unit">To Unit</Label>
                  <Select value={toUnit} onValueChange={setToUnit}>
                    <SelectTrigger id="conversion-to-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitEntries.map(([key, definition]) => (
                        <SelectItem key={key} value={key}>
                          {definition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

// --- Tests ---
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

// --- Page ---
export default function EnergyProToolkit() {
  return (
    <div className="space-y-6 pb-6">
      <Tabs defaultValue="converter" className="w-full">
        <TabsList className="w-full overflow-x-auto flex-nowrap whitespace-nowrap sm:flex-wrap px-2">
          <TabsTrigger value="converter">Converter</TabsTrigger>
          <TabsTrigger value="energy">Energy Comparison</TabsTrigger>
          <TabsTrigger value="emissions">Emissions Comparison</TabsTrigger>
          <TabsTrigger value="load">Load Estimator</TabsTrigger>
          <TabsTrigger value="gasflow">Gas Flow</TabsTrigger>
          <TabsTrigger value="convert" className="flex-shrink-0">
            Conversions
          </TabsTrigger>
          <TabsTrigger value="ranges">Typical Ranges</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="converter">
          <Converter />
        </TabsContent>
        <TabsContent value="energy">
          <EnergyComparison />
        </TabsContent>
        <TabsContent value="emissions">
          <EmissionsComparison />
        </TabsContent>
        <TabsContent value="load">
          <LoadEstimator />
        </TabsContent>
        <TabsContent value="gasflow">
          <GasFlow />
        </TabsContent>
        <TabsContent value="convert">
          <Conversions />
        </TabsContent>
        <TabsContent value="ranges">
          <Ranges />
        </TabsContent>
        <TabsContent value="tests">
          <Tests />
        </TabsContent>
      </Tabs>
    </div>
  );
}
