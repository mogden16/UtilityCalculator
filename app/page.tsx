"use client";

import React, { useMemo, useState } from "react";
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

// -----------------------------
// Helpers & constants
// -----------------------------
const BTU_PER_KW = 3412.142;
const BTU_PER_TON = 12000;
const BTU_PER_HP = 2544.4336;
const BTU_PER_THERM = 100000;
const BTU_PER_DTH = 1_000_000;
const BTU_PER_MLB = 1_000_000;
const DEFAULT_HHV_MBTU_PER_MCF = 1.035;

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

const RATE_UNITS = new Set(["BTU/hr", "kW", "Ton", "HP", "Therm/hr", "DTH/hr", "Steam MLB/hr"]);

const RANGE_ROWS = [
  {
    segment: "Residential — Tight Envelope",
    heating: "18 – 28",
    cooling: "10 – 16",
    notes: "Energy Star homes, high-efficiency equipment, limited infiltration.",
  },
  {
    segment: "Residential — Typical",
    heating: "25 – 35",
    cooling: "15 – 22",
    notes: "Detached single-family or row homes built 1980–2010 with standard insulation.",
  },
  {
    segment: "Multifamily / Small Commercial",
    heating: "30 – 45",
    cooling: "18 – 28",
    notes: "Garden apartments, small offices, retail bays with mixed occupancy.",
  },
  {
    segment: "Commercial — High Ventilation",
    heating: "40 – 60",
    cooling: "22 – 32",
    notes: "Restaurants, fitness centers, or spaces with elevated air changes.",
  },
  {
    segment: "Industrial / Warehouse",
    heating: "15 – 25",
    cooling: "8 – 14",
    notes: "High-bay storage, light manufacturing with intermittent occupancy.",
  },
  {
    segment: "Process / Heavy Industrial",
    heating: "60 – 90",
    cooling: "28 – 40",
    notes: "Process loads, make-up air, or high-infiltration industrial facilities.",
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
    const mmbtu_per_hr = btuh / 1_000_000;
    const cfh = btuh / (HHV * 1_000);

    const totalCF = cfh * hrs;
    const totalMCF = totalCF / 1_000;
    const totalTherms = therm_per_hr * hrs;
    const totalDTH = dth_per_hr * hrs;
    const totalMMBTU = mmbtu_per_hr * hrs;
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
      mmbtu_per_hr,
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
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Readout label="BTU/hr" value={fmt0(calc.btuh)} />
            <Readout label="kW" value={fmt0(calc.kW)} />
            <Readout label="Tons" value={fmt0(calc.tons)} />
            <Readout label="HP" value={fmt0(calc.hp)} />
            {RATE_UNITS.has(unit) && <Readout label="MLB/hr" value={fmt0(calc.mlb_per_hr)} />}
          </div>
        </CardContent>
      </Card>

      {/* Equivalent Energy Rate */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2">Equivalent Energy Rate (per hour)</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Readout label="CFH" value={fmt0(calc.cfh)} />
            <Readout label="Therm/hr" value={fmt0(calc.therm_per_hr)} />
            <Readout label="DTH/hr" value={fmt0(calc.dth_per_hr)} />
            <Readout label="MMBTU/hr" value={fmt0(calc.mmbtu_per_hr)} />
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
      <div className="mt-1 font-mono text-lg bg-muted/30 rounded px-2 py-1">{value}</div>
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
            <h3 className="text-lg font-semibold">Rule-of-Thumb Load Density</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Heating and cooling factors shown in BTU/ft²-hour. Use them as starting points and
              refine with actual audits or design calculations when available.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Segment</th>
                  <th className="px-3 py-2 font-medium">Heating (BTU/ft²·hr)</th>
                  <th className="px-3 py-2 font-medium">Cooling (BTU/ft²·hr)</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {RANGE_ROWS.map((row) => (
                  <tr key={row.segment} className="border-b last:border-0 border-border/60">
                    <td className="px-3 py-2 align-top font-medium text-foreground">{row.segment}</td>
                    <td className="px-3 py-2 align-top font-mono">{row.heating}</td>
                    <td className="px-3 py-2 align-top font-mono">{row.cooling}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Multiply the factor by square footage to get an approximate peak BTU/hr load, or
            convert to tons by dividing the cooling value by 12,000.
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
  usage: string;
  usageUnit: EnergyUnit;
  efficiency: string;
};

type EnergySummary = {
  name: string;
  ratePerMMBtu: number;
  usageMMBtu: number;
  deliveredMMBtu: number;
  totalCost: number;
  efficiency: number;
  costPerDelivered: number;
};

function computeEnergySummary(source: RateSourceState, ctx: ConversionContext): EnergySummary {
  const rateValue = Math.max(num(source.rate), 0);
  const usageValue = Math.max(num(source.usage), 0);
  const unitRate = ENERGY_UNITS[source.rateUnit];
  const unitUsage = ENERGY_UNITS[source.usageUnit];

  const rateUnitMMBtu = unitRate.toMMBtu(1, ctx);
  const usageMMBtu = unitUsage.toMMBtu(usageValue, ctx);
  const ratePerMMBtu = rateUnitMMBtu > 0 ? rateValue / rateUnitMMBtu : 0;

  const rawEfficiency = num(source.efficiency);
  let efficiency = rawEfficiency;
  if (rawEfficiency > 1.5) {
    efficiency = rawEfficiency / 100;
  }
  if (!isFinite(efficiency) || efficiency <= 0) {
    efficiency = 1;
  }

  const totalCost = ratePerMMBtu * usageMMBtu;
  const deliveredMMBtu = usageMMBtu * efficiency;
  const costPerDelivered = deliveredMMBtu > 0 ? totalCost / deliveredMMBtu : 0;

  return {
    name: source.name.trim() || "Source",
    ratePerMMBtu,
    usageMMBtu,
    deliveredMMBtu,
    totalCost,
    efficiency,
    costPerDelivered,
  };
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
            Enter the delivered nameplate, billing rate, and expected usage for this energy source.
          </p>
        </div>

        <div>
          <Label>Label</Label>
          <Input value={state.name} onChange={(e) => onChange({ ...state, name: e.target.value })} />
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
          <div>
            <Label>Projected Usage</Label>
            <Input value={state.usage} onChange={(e) => onChange({ ...state, usage: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Annual or seasonal consumption.</p>
          </div>
          <div>
            <Label>Usage Unit</Label>
            <Select value={state.usageUnit} onValueChange={(value) => onChange({ ...state, usageUnit: value as EnergyUnit })}>
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
            <p className="text-xs text-muted-foreground mt-1">{ENERGY_UNITS[state.usageUnit].description}</p>
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
            Enter as a decimal fraction of delivered energy (e.g., 0.90 = 90%). Values above 1 will
            be treated as percentages.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EnergyComparison() {
  const [hhv, setHhv] = useState(String(DEFAULT_HHV_MBTU_PER_MCF));
  const [sourceA, setSourceA] = useState<RateSourceState>({
    name: "Natural Gas",
    rate: "1.20",
    rateUnit: "therm",
    usage: "1200",
    usageUnit: "therm",
    efficiency: "0.90",
  });
  const [sourceB, setSourceB] = useState<RateSourceState>({
    name: "Electric Resistance",
    rate: "0.18",
    rateUnit: "kwh",
    usage: "4000",
    usageUnit: "kwh",
    efficiency: "1.00",
  });

  const context = useMemo(() => {
    const parsed = num(hhv);
    const fallback = parsed > 0 ? parsed : DEFAULT_HHV_MBTU_PER_MCF;
    return { hhv: fallback };
  }, [hhv]);

  const summaryA = useMemo(() => computeEnergySummary(sourceA, context), [sourceA, context]);
  const summaryB = useMemo(() => computeEnergySummary(sourceB, context), [sourceB, context]);

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
          <div className="text-xs text-muted-foreground self-end">
            Costs are normalized to delivered MMBtu so you can compare against alternate fuels or
            electric heat pumps.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <RateSourceCard title="Primary Energy" state={sourceA} onChange={setSourceA} />
        <RateSourceCard title="Comparison Energy" state={sourceB} onChange={setSourceB} />
      </div>

      <Card>
        <CardContent className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Cost Summary</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Rate inputs are converted to $/MMBtu and multiplied by the projected usage in matching
              units. Delivered MMBtu accounts for the efficiency you entered.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Rate ($/MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Usage (MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Delivered (MMBtu)</th>
                  <th className="px-3 py-2 font-medium">Total Cost</th>
                  <th className="px-3 py-2 font-medium">Cost / Delivered MMBtu</th>
                </tr>
              </thead>
              <tbody>
                {[summaryA, summaryB].map((row) => (
                  <tr key={row.name} className="border-b last:border-0 border-border/60">
                    <td className="px-3 py-2 align-top font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2 align-top font-mono">{fmtCurrency(row.ratePerMMBtu)}</td>
                    <td className="px-3 py-2 align-top font-mono">{fmt1(row.usageMMBtu)}</td>
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
