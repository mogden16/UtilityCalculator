"use client";

import React, { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

// -----------------------------
// Helpers & constants
// -----------------------------
const BTU_PER_KW = 3412.142;
const BTU_PER_TON = 12000;
const BTU_PER_HP = 2544.4336;
const BTU_PER_THERM = 100000;
const BTU_PER_DTH = 1_000_000;
const BTU_PER_MLB = 1_000_000; // per your spec: 1 MLB = 1.0 MMBTU = 1,000,000 BTU
const DEFAULT_HHV_MBTU_PER_MCF = 1.035;

const fmt0 = (n: number) => {
  if (!isFinite(n)) return "–";
  const rounded = Math.round(n);
  return rounded.toLocaleString();
};

const num = (v: string | number) => {
  if (typeof v === "number") return v;
  return Number(String(v).replace(/[,\s]/g, "")) || 0;
};

// rate-type inputs (where MLB/hr derived should be shown)
const RATE_UNITS = new Set(["BTU/hr", "kW", "Ton", "HP", "Therm/hr", "DTH/hr", "MLB/hr"]);

// -----------------------------
// Converter (v3)
// -----------------------------
function Converter() {
  const [val, setVal] = useState<string>("9000000");
  const [unit, setUnit] = useState<string>("BTU/hr");
  const [hhv, setHhv] = useState<string>(String(DEFAULT_HHV_MBTU_PER_MCF));
  const [hours, setHours] = useState<string>("500");

  const calc = useMemo(() => {
    const value = num(val);
    const HHV = num(hhv); // MBTU/MCF
    const hrs = Math.max(num(hours), 0);

    // Convert input to BTU/hr
    let btuh = value;
    switch (unit) {
      case "kW": btuh = value * BTU_PER_KW; break;
      case "Ton": btuh = value * BTU_PER_TON; break;
      case "HP": btuh = value * BTU_PER_HP; break;
      case "Therm/hr": btuh = value * BTU_PER_THERM; break;
      case "DTH/hr": btuh = value * BTU_PER_DTH; break;
      case "MLB/hr": btuh = value * BTU_PER_MLB; break;
      // BTU/hr default
    }

    // Instantaneous demand
    const kW = btuh / BTU_PER_KW;
    const tons = btuh / BTU_PER_TON;
    const hp = btuh / BTU_PER_HP;
    const mlb_per_hr = RATE_UNITS.has(unit) ? btuh / BTU_PER_MLB : NaN;

    // Equivalent energy rates (per hour)
    const therm_per_hr = btuh / BTU_PER_THERM;
    const dth_per_hr = btuh / BTU_PER_DTH;
    const mmbtu_per_hr = btuh / 1_000_000;
    const cfh = btuh / (HHV * 1_000); // BTU/hr ÷ (MBTU/MCF × 1000 BTU/CF)

    // Totals over time (quantity)
    const totalCF = cfh * hrs;
    const totalTherms = therm_per_hr * hrs;
    const totalDTH = dth_per_hr * hrs;
    const totalMMBTU = mmbtu_per_hr * hrs;
    const totalMLB = (btuh / BTU_PER_MLB) * hrs;
    const totalKWh = kW * hrs;

    return {
      btuh, kW, tons, hp, mlb_per_hr,
      cfh, therm_per_hr, dth_per_hr, mmbtu_per_hr,
      totalCF, totalTherms, totalDTH, totalMMBTU, totalMLB, totalKWh,
    };
  }, [val, unit, hhv, hours]);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardContent className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                inputMode="decimal"
                value={val}
                onChange={(e) => setVal(e.target.value)}
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTU/hr">BTU/hr (Demand)</SelectItem>
                  <SelectItem value="kW">kW (Demand)</SelectItem>
                  <SelectItem value="Ton">Ton (Cooling Demand)</SelectItem>
                  <SelectItem value="HP">HP (Mechanical)</SelectItem>
                  <SelectItem value="Therm/hr">Therm/hr (Energy Rate)</SelectItem>
                  <SelectItem value="DTH/hr">DTH/hr (Energy Rate)</SelectItem>
                  <SelectItem value="MLB/hr">MLB/hr (Steam Flow Rate)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Options */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced">
              <AccordionTrigger>Advanced options</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label title="Higher Heating Value for natural gas">Gas HHV (MBTU/MCF)</Label>
                    <Input
                      inputMode="decimal"
                      value={hhv}
                      onChange={(e) => setHhv(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Default {DEFAULT_HHV_MBTU_PER_MCF} ≈ 1,035 BTU/CF
                    </p>
                  </div>
                  <div>
                    <Label title="Used to compute total energy usage (rate × hours)">Hours of operation</Label>
                    <Input
                      inputMode="numeric"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Totals below use this duration.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Instantaneous Demand */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2">Instantaneous Demand</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Readout label="BTU/hr" value={fmt0(calc.btuh)} hint="Rate of heat flow (power)" />
            <Readout label="kW" value={fmt0(calc.kW)} hint="Electrical demand" />
            <Readout label="Tons" value={fmt0(calc.tons)} hint="12,000 BTU/hr per ton" />
            <Readout label="HP" value={fmt0(calc.hp)} hint="Mechanical horsepower" />
            {RATE_UNITS.has(unit) && (
              <Readout label="MLB/hr" value={fmt0(calc.mlb_per_hr)} hint="Steam flow rate (1 MLB/hr = 1 MMBTU/hr)" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Equivalent Energy Rate (per hour) */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2">Equivalent Energy Rate (per hour)</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Readout label="CFH" value={fmt0(calc.cfh)} hint="Cubic feet per hour (gas)" />
            <Readout label="Therm/hr" value={fmt0(calc.therm_per_hr)} hint="100,000 BTU per Therm" />
            <Readout label="DTH/hr" value={fmt0(calc.dth_per_hr)} hint="Decatherm per hour" />
            <Readout label="MMBTU/hr" value={fmt0(calc.mmbtu_per_hr)} hint="Million BTU per hour" />
          </div>
        </CardContent>
      </Card>

      {/* Total Energy (Quantity over time) */}
      <Card>
        <CardContent className="mt-4">
          <h3 className="text-lg font-semibold border-b pb-2">Total Energy (Quantity over time)</h3>
          <p className="text-xs text-muted-foreground mt-1">Computed as hourly rate × hours of operation.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-6">
            <Readout label="Total CF" value={fmt0(calc.totalCF)} hint="Cubic feet of gas" />
            <Readout label="Therms" value={fmt0(calc.totalTherms)} hint="Total therms used" />
            <Readout label="DTH" value={fmt0(calc.totalDTH)} hint="Total decatherms" />
            <Readout label="MMBTU" value={fmt0(calc.totalMMBTU)} hint="Total million BTU" />
            <Readout label="kWh" value={fmt0(calc.totalKWh)} hint="Total kilowatt-hours" />
            <Readout label="MLB" value={fmt0(calc.totalMLB)} hint="Total thousand pounds of steam" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Readout({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg bg-muted/30 rounded px-2 py-1" title={hint}>{value}</div>
    </div>
  );
}

// -----------------------------
// Gas Flow & Sizing (restored)
// -----------------------------
function GasFlow() {
  const [btuh, setBtuh] = useState<string>("9000000");
  const [hhv, setHhv] = useState<string>(String(DEFAULT_HHV_MBTU_PER_MCF));
  const [hours, setHours] = useState<string>("24");

  const out = useMemo(() => {
    const Q = num(btuh);
    const HHV = num(hhv);
    const hrs = Math.max(num(hours), 0);
    const cfh = Q / (HHV * 1000);
    const mmbtuh = Q / 1_000_000;
    const totalCF = cfh * hrs;
    return { cfh, mmbtuh, totalCF };
  }, [btuh, hhv, hours]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Input Load (BTU/hr)</Label>
            <Input value={btuh} onChange={(e) => setBtuh(e.target.value)} />
          </div>
          <div>
            <Label>Gas HHV (MBTU/MCF)</Label>
            <Input value={hhv} onChange={(e) => setHhv(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Default {DEFAULT_HHV_MBTU_PER_MCF}</p>
          </div>
          <div>
            <Label>Run Hours</Label>
            <Input value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="mt-4 grid gap-3 sm:grid-cols-3">
          <Readout label="CFH" value={fmt0(out.cfh)} hint="Cubic feet per hour" />
          <Readout label="MMBTU/hr" value={fmt0(out.mmbtuh)} hint="Million BTU per hour" />
          <Readout label="Total CF" value={fmt0(out.totalCF)} hint="Total cubic feet over run hours" />
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------
// Typical Ranges (restored)
// -----------------------------
const archetypes = [
  { key: "res_furnace", name: "Residential furnace", range: [40000, 120000], note: "80–98% AFUE" },
  { key: "res_boiler", name: "Residential boiler", range: [60000, 200000], note: "Hydronic" },
  { key: "tankless_wh", name: "Tankless water heater", range: [150000, 199000], note: "Condensing" },
  { key: "rtu", name: "Commercial RTU", range: [150000, 1200000], note: "Packaged HVAC" },
  { key: "comm_boiler_small", name: "Commercial boiler (small)", range: [500000, 2000000], note: "Schools/small bldgs" },
  { key: "comm_boiler_med", name: "Commercial boiler (medium)", range: [2000000, 10000000], note: "Hospitals/large bldgs" },
  { key: "paint_booth", name: "Paint booth MUA", range: [1000000, 5000000], note: "Auto/body" },
  { key: "industrial_proc", name: "Industrial process heater", range: [10000000, 100000000], note: "Heavy industry" },
];

function Ranges() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {archetypes.map((a) => (
        <Card key={a.key}>
          <CardContent className="mt-3">
            <div className="font-medium">{a.name}</div>
            <div className="text-sm text-muted-foreground">
              {fmt0(a.range[0])} – {fmt0(a.range[1])} BTU/hr
            </div>
            {a.note && <div className="text-xs text-muted-foreground mt-1">{a.note}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -----------------------------
// Rates comparer (restored, simple)
// -----------------------------
function Rates() {
  const [elec, setElec] = useState<string>("0.16"); // $/kWh
  const [gas, setGas] = useState<string>("13");     // $/MCF
  const [oil, setOil] = useState<string>("3.75");   // $/gal

  // Very simple reference outputs (no cost/MMBTU calc right now per your preference)
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><Label>Electricity ($/kWh)</Label><Input value={elec} onChange={(e) => setElec(e.target.value)} /></div>
          <div><Label>Natural Gas ($/MCF)</Label><Input value={gas} onChange={(e) => setGas(e.target.value)} /></div>
          <div><Label>Fuel Oil ($/gal)</Label><Input value={oil} onChange={(e) => setOil(e.target.value)} /></div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Cost normalization ($/MMBTU, $/kWh-equiv) can be added later.</p>
    </div>
  );
}

// -----------------------------
// Load Estimator (Philadelphia rules of thumb)
// -----------------------------
function LoadEstimator() {
  const [sqft, setSqft] = useState<string>("2000");
  const [vintage, setVintage] = useState<string>("average");

  const out = useMemo(() => {
    const area = Math.max(num(sqft), 0);
    const factors = {
      tight: { heat: 25, cool: 15 },
      average: { heat: 30, cool: 20 },
      leaky: { heat: 40, cool: 28 },
    } as const;
    const f = factors[vintage as keyof typeof factors] || factors.average;
    const heat = area * f.heat;
    const cool = area * f.cool;
    const tons = cool / BTU_PER_TON;
    const mbh = heat / 1000;
    return { heat, cool, tons, mbh };
  }, [sqft, vintage]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-3">
          <div><Label>Square Footage</Label><Input value={sqft} onChange={(e) => setSqft(e.target.value)} /></div>
          <div>
            <Label>Building Condition</Label>
            <Select value={vintage} onValueChange={setVintage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tight">New/Tight</SelectItem>
                <SelectItem value="average">Average (2000s)</SelectItem>
                <SelectItem value="leaky">Older/Leaky</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="self-end text-xs text-muted-foreground">Rule-of-thumb for Philadelphia climate.</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="mt-4 grid gap-3 sm:grid-cols-4">
          <Readout label="Heating (BTU/hr)" value={fmt0(out.heat)} />
          <Readout label="Heating (MBH)" value={fmt0(out.mbh)} />
          <Readout label="Cooling (BTU/hr)" value={fmt0(out.cool)} />
          <Readout label="Cooling (Tons)" value={fmt0(out.tons)} />
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------
// Tests (sanity)
// -----------------------------
function Tests() {
  // simple display of reference equalities
  return (
    <Card>
      <CardContent className="mt-4">
        <ul className="list-disc pl-6 text-sm">
          <li>1 ton = 12,000 BTU/hr</li>
          <li>1 kW = 3,412 BTU/hr</li>
          <li>1 HP ≈ 2,544 BTU/hr</li>
          <li>1 Therm = 100,000 BTU</li>
          <li>1 DTH = 1,000,000 BTU</li>
          <li>1 MLB = 1,000,000 BTU (rounded)</li>
        </ul>
      </CardContent>
    </Card>
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
          <TabsTrigger value="converter" className="flex-shrink-0">Converter</TabsTrigger>
          <TabsTrigger value="gasflow" className="flex-shrink-0">Gas Flow</TabsTrigger>
          <TabsTrigger value="ranges" className="flex-shrink-0">Typical Ranges</TabsTrigger>
          <TabsTrigger value="rates" className="flex-shrink-0">Rates</TabsTrigger>
          <TabsTrigger value="load" className="flex-shrink-0">Load Estimator</TabsTrigger>
          <TabsTrigger value="tests" className="flex-shrink-0">Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="converter"><Converter /></TabsContent>
        <TabsContent value="gasflow"><GasFlow /></TabsContent>
        <TabsContent value="ranges"><Ranges /></TabsContent>
        <TabsContent value="rates"><Rates /></TabsContent>
        <TabsContent value="load"><LoadEstimator /></TabsContent>
        <TabsContent value="tests"><Tests /></TabsContent>
      </Tabs>
    </div>
  );
}
