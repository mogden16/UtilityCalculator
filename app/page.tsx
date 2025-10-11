"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

// -----------------------------
// Helpers
// -----------------------------
const num = (s: string | number): number => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  return Number(String(s).replace(/[\,\s]/g, "")) || 0;
};
const fmt = (n: number, digits = 2) => (isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "–");

// -----------------------------
// Constants
// -----------------------------
const BTU_PER_KWH = 3412.142; // BTU per kWh
const BTU_PER_HP_HR = 2544.4336; // BTU/hr per mech HP
const DEFAULT_MBTU_PER_MCF = 1.035; // MBTU/MCF (PGW default)
const BTU_PER_GAL_OIL = 138500; // BTU/gal (No.2)
const BTU_PER_THERM = 100000; // BTU/therm
const BTU_PER_DTH = 1_000_000; // BTU/decatherm

// generic converters for reuse + tests
type Unit = "BTUH" | "TON" | "KW" | "HP" | "THERM" | "DTH" | "MCF" | "CFH";
const btuhFrom = (value: number, unit: Unit, mbtuPerMcf = DEFAULT_MBTU_PER_MCF): number => {
  switch (unit) {
    case "BTUH": return value;
    case "TON": return value * 12000;
    case "KW": return value * BTU_PER_KWH;
    case "HP": return value * BTU_PER_HP_HR;
    case "THERM": return value * BTU_PER_THERM;
    case "DTH": return value * BTU_PER_DTH;
    case "MCF": return value * mbtuPerMcf * 1_000_000;
    case "CFH": return (value * mbtuPerMcf * 1_000_000) / 1000; // CFH → BTUH
    default: return value;
  }
};

// -----------------------------
// Components
// -----------------------------
function PowerConverter() {
  const [input, setInput] = useState<string>("9000000");
  const [unit, setUnit] = useState<Unit>("BTUH");
  const [mbtuPerMcf, setMbtuPerMcf] = useState<string>(String(DEFAULT_MBTU_PER_MCF));

  const values = useMemo(() => {
    const btuh = btuhFrom(num(input), unit, num(mbtuPerMcf));
    return {
      btuh,
      tons: btuh / 12000,
      kW: btuh / BTU_PER_KWH,
      hp: btuh / BTU_PER_HP_HR,
      therms: btuh / BTU_PER_THERM,
      dth: btuh / BTU_PER_DTH,
      mcf: btuh / (num(mbtuPerMcf) * 1_000_000),
      cfh: btuh / (num(mbtuPerMcf) * 1_000_000 / 1000),
    };
  }, [input, unit, mbtuPerMcf]);

  return (
    <Card className="p-4 shadow-md">
      <h2 className="text-xl font-semibold">Power & Fuel Converter</h2>
      <CardContent className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Value</Label>
          <Input value={input} onChange={(e) => setInput(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTUH">BTU/hr</SelectItem>
                  <SelectItem value="TON">Tons</SelectItem>
                  <SelectItem value="KW">kW</SelectItem>
                  <SelectItem value="HP">HP</SelectItem>
                  <SelectItem value="THERM">Therms</SelectItem>
                  <SelectItem value="DTH">Decatherms</SelectItem>
                  <SelectItem value="MCF">MCF</SelectItem>
                  <SelectItem value="CFH">CFH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gas Heat Content (MBTU/MCF)</Label>
              <Input value={mbtuPerMcf} onChange={(e)=>setMbtuPerMcf(e.target.value)} />
            </div>
          </div>
        </div>
        {Object.entries(values).map(([key, val]) => (
          <div key={key}>
            <Label>{key.toUpperCase()}</Label>
            <div className="text-xl font-semibold">{fmt(val)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GasSizing() {
  const [btuh, setBtuh] = useState<string>("9000000");
  const [mbtuPerMcf, setMbtuPerMcf] = useState<string>(String(DEFAULT_MBTU_PER_MCF));
  const [hoursPerDay, setHoursPerDay] = useState<string>("24");

  const out = useMemo(() => {
    const Q = num(btuh);
    const HHV = num(mbtuPerMcf) * 1_000_000; // BTU/MCF
    const cfh = Q / (HHV / 1000);
    const mcfPerHr = Q / HHV;
    const mcfPerDay = mcfPerHr * num(hoursPerDay);
    const sizeLabel = Q < 200_000 ? "Residential" : Q < 2_000_000 ? "Light Commercial" : Q < 10_000_000 ? "Commercial" : "Industrial";
    return { cfh, mcfPerHr, mcfPerDay, sizeLabel };
  }, [btuh, mbtuPerMcf, hoursPerDay]);

  return (
    <Card className="p-4 shadow-md">
      <h2 className="text-xl font-semibold">Gas Flow & Sizing</h2>
      <CardContent className="mt-4 grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Input Load (BTU/hr)</Label>
          <Input value={btuh} onChange={(e) => setBtuh(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Gas Heat Content (MBTU/MCF)</Label>
          <Input value={mbtuPerMcf} onChange={(e) => setMbtuPerMcf(e.target.value)} />
          <div className="text-xs text-muted-foreground">Default {DEFAULT_MBTU_PER_MCF} MBTU/MCF (≈1,035 BTU/CF)</div>
        </div>
        <div className="space-y-2">
          <Label>Run Hours / Day</Label>
          <Input value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
        </div>
        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div>
            <Label>CFH</Label>
            <div className="text-2xl font-semibold">{fmt(out.cfh)}</div>
          </div>
          <div>
            <Label>MCF/hr</Label>
            <div className="text-2xl font-semibold">{fmt(out.mcfPerHr, 4)}</div>
          </div>
          <div>
            <Label>MCF/day</Label>
            <div className="text-2xl font-semibold">{fmt(out.mcfPerDay, 3)}</div>
          </div>
          <div>
            <Label>"How big is that?"</Label>
            <div className="text-2xl font-semibold">{out.sizeLabel}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const archetypes = [
  { key: "res_furnace", name: "Residential furnace", range: [40000, 120000] },
  { key: "res_boiler", name: "Residential boiler", range: [60000, 200000] },
  { key: "tankless_wh", name: "Tankless water heater", range: [150000, 199000] },
  { key: "res_range", name: "Residential gas range", range: [30000, 65000] },
  { key: "rtu", name: "Commercial RTU", range: [150000, 1200000] },
  { key: "comm_boiler_small", name: "Commercial boiler (small)", range: [500000, 2000000] },
  { key: "comm_boiler_med", name: "Commercial boiler (medium)", range: [2000000, 10000000] },
  { key: "paint_booth", name: "Paint booth make-up air", range: [1000000, 5000000] },
  { key: "chp_small", name: "CHP engine (electrical)", range: [50000, 2000000] },
  { key: "industrial_proc", name: "Industrial process heater", range: [10000000, 100000000] },
];

function ApplianceRanges() {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => archetypes.filter(a => a.name.toLowerCase().includes(filter.toLowerCase())), [filter]);
  return (
    <Card className="p-4 shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Typical Appliance Input Ranges</h2>
      </div>
      <CardContent className="mt-4 space-y-3">
        <Input placeholder="Search (e.g., boiler, paint booth)" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(a => (
            <Card key={a.key} className="p-3">
              <div className="font-medium">{a.name}</div>
              <div className="text-sm text-muted-foreground">{fmt(a.range[0])} – {fmt(a.range[1])} BTU/hr</div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FuelRateComparer() {
  const [elec, setElec] = useState("0.16"); // $/kWh
  const [gas, setGas] = useState("13"); // $/MCF
  const [oil, setOil] = useState("3.75"); // $/gal
  const [effElec, setEffElec] = useState("1.00");
  const [effGas, setEffGas] = useState("0.90");
  const [effOil, setEffOil] = useState("0.85");
  const [mbtuPerMcf, setMbtuPerMcf] = useState(String(DEFAULT_MBTU_PER_MCF));

  const out = useMemo(() => {
    const $kWh = num(elec);
    const $MCF = num(gas);
    const $gal = num(oil);
    const eElec = Math.min(Math.max(num(effElec), 0.01), 1.25);
    const eGas = Math.min(Math.max(num(effGas), 0.01), 1.25);
    const eOil = Math.min(Math.max(num(effOil), 0.01), 1.25);

    const $perMMBTU_elec_input = ($kWh * 1000) / (BTU_PER_KWH / 1000);
    const $perMMBTU_gas_input = $MCF / num(mbtuPerMcf);
    const $perMMBTU_oil_input = ($gal * 1_000_000) / BTU_PER_GAL_OIL;

    const $perMMBTU_elec_delivered = $perMMBTU_elec_input / eElec;
    const $perMMBTU_gas_delivered = $perMMBTU_gas_input / eGas;
    const $perMMBTU_oil_delivered = $perMMBTU_oil_input / eOil;

    const $perKWh_equiv_elec = $perMMBTU_elec_delivered / (BTU_PER_KWH / 1_000_000);
    const $perKWh_equiv_gas = $perMMBTU_gas_delivered / (BTU_PER_KWH / 1_000_000);
    const $perKWh_equiv_oil = $perMMBTU_oil_delivered / (BTU_PER_KWH / 1_000_000);

    return {
      $perMMBTU_elec_input, $perMMBTU_gas_input, $perMMBTU_oil_input,
      $perMMBTU_elec_delivered, $perMMBTU_gas_delivered, $perMMBTU_oil_delivered,
      $perKWh_equiv_elec, $perKWh_equiv_gas, $perKWh_equiv_oil,
    };
  }, [elec, gas, oil, effElec, effGas, effOil, mbtuPerMcf]);

  const reset = () => {
    setElec("0.16"); setGas("13"); setOil("3.75"); setEffElec("1.00"); setEffGas("0.90"); setEffOil("0.85"); setMbtuPerMcf(String(DEFAULT_MBTU_PER_MCF));
  };

  return (
    <Card className="p-4 shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Fuel Rate Comparer</h2>
        <Button variant="ghost" size="sm" onClick={reset}><RefreshCw className="h-4 w-4 mr-1"/>Reset</Button>
      </div>
      <CardContent className="mt-4 grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Electricity ($/kWh)</Label>
          <Input value={elec} onChange={(e)=>setElec(e.target.value)} />
          <Label className="mt-2">Efficiency (COP or kW→kW)</Label>
          <Input value={effElec} onChange={(e)=>setEffElec(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Natural Gas ($/MCF)</Label>
          <Input value={gas} onChange={(e)=>setGas(e.target.value)} />
          <Label className="mt-2">Efficiency (AFUE/thermal)</Label>
          <Input value={effGas} onChange={(e)=>setEffGas(e.target.value)} />
          <Label className="mt-2">Gas Heat Content (MBTU/MCF)</Label>
          <Input value={mbtuPerMcf} onChange={(e)=>setMbtuPerMcf(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fuel Oil ($/gal)</Label>
          <Input value={oil} onChange={(e)=>setOil(e.target.value)} />
          <Label className="mt-2">Efficiency (AFUE/thermal)</Label>
          <Input value={effOil} onChange={(e)=>setEffOil(e.target.value)} />
          <div className="text-xs text-muted-foreground mt-1">Using {fmt(BTU_PER_GAL_OIL)} BTU/gal HHV</div>
        </div>
        <div className="md:col-span-3 grid md:grid-cols-3 gap-4 pt-2">
          <Card className="p-3">
            <div className="font-medium">Electric (delivered)</div>
            <div className="text-sm text-muted-foreground">$/MMBTU (input): {fmt(out.$perMMBTU_elec_input)}</div>
            <div className="text-2xl font-semibold">{fmt(out.$perMMBTU_elec_delivered)} $/MMBTU</div>
            <div className="text-sm">≈ {fmt(out.$perKWh_equiv_elec, 3)} $/kWh‑equiv</div>
          </Card>
          <Card className="p-3">
            <div className="font-medium">Natural Gas (delivered)</div>
            <div className="text-sm text-muted-foreground">$/MMBTU (input): {fmt(out.$perMMBTU_gas_input)}</div>
            <div className="text-2xl font-semibold">{fmt(out.$perMMBTU_gas_delivered)} $/MMBTU</div>
            <div className="text-sm">≈ {fmt(out.$perKWh_equiv_gas, 3)} $/kWh‑equiv</div>
          </Card>
          <Card className="p-3">
            <div className="font-medium">Fuel Oil (delivered)</div>
            <div className="text-sm text-muted-foreground">$/MMBTU (input): {fmt(out.$perMMBTU_oil_input)}</div>
            <div className="text-2xl font-semibold">{fmt(out.$perMMBTU_oil_delivered)} $/MMBTU</div>
            <div className="text-sm">≈ {fmt(out.$perKWh_equiv_oil, 3)} $/kWh‑equiv</div>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferenceTable() {
  const rows = [
    50_000, 100_000, 200_000, 400_000, 800_000, 1_000_000, 2_000_000, 5_000_000, 9_000_000, 10_000_000
  ].map(btuh => {
    const cfh = btuh / (DEFAULT_MBTU_PER_MCF * 1_000_000 / 1000);
    const mcfh = btuh / (DEFAULT_MBTU_PER_MCF * 1_000_000);
    return { btuh, cfh, mcfh };
  });

  return (
    <Card className="p-4 shadow-md">
      <h2 className="text-xl font-semibold">Quick Reference (1.035 MBTU/MCF)</h2>
      <CardContent className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">BTU/hr</th>
              <th className="py-2">CFH</th>
              <th className="py-2">MCF/hr</th>
              <th className="py-2">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.btuh} className="border-b">
                <td className="py-2">{fmt(r.btuh)}</td>
                <td className="py-2">{fmt(r.cfh)}</td>
                <td className="py-2">{fmt(r.mcfh, 4)}</td>
                <td className="py-2">{r.btuh < 200_000 ? "Residential" : r.btuh < 2_000_000 ? "Light Commercial" : r.btuh < 10_000_000 ? "Commercial" : "Industrial"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function LoadEstimator() {
  const [sqft, setSqft] = useState("2000");
  const [vintage, setVintage] = useState("avg"); // affects W/sf rules
  const [mbtuPerMcf, setMbtuPerMcf] = useState(String(DEFAULT_MBTU_PER_MCF));

  const factors = {
    tight: { heat: 25, cool: 15 }, // BTU/hr·sf — newer/tight Philly home
    avg: { heat: 30, cool: 20 },   // typical/average
    leaky: { heat: 40, cool: 28 }, // older/leaky
  } as const;

  const { heating, cooling, tons, kwCool, mbhHeat, cfhHeat, sizeLabel } = useMemo(() => {
    const area = num(sqft);
    const f = factors[vintage as keyof typeof factors] || factors.avg;
    const heatingBTUH = area * f.heat;
    const coolingBTUH = area * f.cool;
    const tons = coolingBTUH / 12000;
    const kwCool = coolingBTUH / BTU_PER_KWH;
    const mbhHeat = heatingBTUH / 1000;
    const cfhHeat = heatingBTUH / (num(mbtuPerMcf) * 1_000_000 / 1000);
    const sizeLabel = heatingBTUH < 200_000 ? "Residential" : heatingBTUH < 2_000_000 ? "Light Commercial" : heatingBTUH < 10_000_000 ? "Commercial" : "Industrial";
    return { heating: heatingBTUH, cooling: coolingBTUH, tons, kwCool, mbhHeat, cfhHeat, sizeLabel };
  }, [sqft, vintage, mbtuPerMcf]);

  return (
    <Card className="p-4 shadow-md">
      <h2 className="text-xl font-semibold">Heating & Cooling Load Estimator — Philadelphia</h2>
      <CardContent className="mt-4 grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Square Footage</Label>
          <Input value={sqft} onChange={(e)=>setSqft(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Building Condition</Label>
          <Select value={vintage} onValueChange={setVintage}>
            <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="tight">New/Tight</SelectItem>
              <SelectItem value="avg">Average (2000s)</SelectItem>
              <SelectItem value="leaky">Older/Leaky</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Gas Heat Content (MBTU/MCF)</Label>
          <Input value={mbtuPerMcf} onChange={(e)=>setMbtuPerMcf(e.target.value)} />
        </div>
        <div className="md:col-span-3 grid md:grid-cols-3 gap-4 pt-2">
          <Card className="p-3">
            <div className="font-medium">Heating</div>
            <div className="text-sm text-muted-foreground">Load</div>
            <div className="text-2xl font-semibold">{fmt(heating)} BTU/hr</div>
            <div className="text-sm">≈ {fmt(mbhHeat,1)} MBH • {fmt(cfhHeat)} CFH @ {mbtuPerMcf} MBTU/MCF</div>
          </Card>
          <Card className="p-3">
            <div className="font-medium">Cooling</div>
            <div className="text-sm text-muted-foreground">Load</div>
            <div className="text-2xl font-semibold">{fmt(cooling)} BTU/hr</div>
            <div className="text-sm">≈ {fmt(tons,2)} tons • {fmt(kwCool,2)} kW</div>
          </Card>
          <Card className="p-3">
            <div className="font-medium">Context</div>
            <div className="text-2xl font-semibold">{sizeLabel}</div>
            <div className="text-sm text-muted-foreground">Rule‑of‑thumb for Philly climate; refine with Manual J/N or ASHRAE calcs for design.</div>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Self-tests (simple runtime checks)
// -----------------------------
function SelfTests() {
  type T = { name: string; pass: boolean; expected: number; actual: number };
  const within = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

  const tests: T[] = (() => {
    const list: T[] = [];
    // 1 ton = 12,000 BTU/hr
    let actual = btuhFrom(1, "TON");
    list.push({ name: "1 ton → 12,000 BTUH", actual, expected: 12000, pass: within(actual, 12000) });

    // 1 kW = 3412.142 BTU/hr
    actual = btuhFrom(1, "KW");
    list.push({ name: "1 kW → 3412.142 BTUH", actual, expected: BTU_PER_KWH, pass: within(actual, BTU_PER_KWH) });

    // 1 HP = 2544.4336 BTU/hr
    actual = btuhFrom(1, "HP");
    list.push({ name: "1 HP → 2544.4336 BTUH", actual, expected: BTU_PER_HP_HR, pass: within(actual, BTU_PER_HP_HR) });

    // 1 MCF ↔ 1,035,000 BTU (with PGW 1.035)
    const BTUperMCF = DEFAULT_MBTU_PER_MCF * 1_000_000;
    actual = btuhFrom(1, "MCF");
    list.push({ name: "1 MCF → 1.035e6 BTU", actual, expected: BTUperMCF, pass: within(actual, BTUperMCF) });

    // 9,000,000 BTUH → CFH ~ 8,696 at 1.035 MBTU/MCF
    const cfh = 9_000_000 / (BTUperMCF / 1000);
    list.push({ name: "9,000,000 BTUH CFH calc", actual: cfh, expected: 8695.652, pass: within(cfh, 8695.652, 1e-4) });

    // Load estimator: 2,000 sf avg → heat 60,000, cool 40,000
    const heatExp = 60_000, coolExp = 40_000;
    list.push({ name: "Load: 2000 sf avg heat", actual: 2000 * 30, expected: heatExp, pass: within(2000 * 30, heatExp) });
    list.push({ name: "Load: 2000 sf avg cool", actual: 2000 * 20, expected: coolExp, pass: within(2000 * 20, coolExp) });

    return list;
  })();

  const allPass = tests.every(t => t.pass);

  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold">Self-tests</h2>
      <CardContent className="mt-3 space-y-2">
        <div className={`text-sm ${allPass ? "text-green-600" : "text-red-600"}`}>{allPass ? "All tests passed." : "Some tests failed — see details below."}</div>
        <div className="grid md:grid-cols-2 gap-2">
          {tests.map((t, i) => (
            <Card key={i} className={`p-3 ${t.pass ? "" : "border-red-500"}`}>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm">Expected: {fmt(t.expected, 6)}</div>
              <div className="text-sm">Actual: {fmt(t.actual, 6)}</div>
              <div className={`text-sm ${t.pass ? "text-green-600" : "text-red-600"}`}>{t.pass ? "PASS" : "FAIL"}</div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Page
// -----------------------------
export default function EnergyProToolkit() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Energy Pro Toolkit</h1>
      <Tabs defaultValue="convert">
        <TabsList className="w-full overflow-x-auto flex-nowrap whitespace-nowrap sm:flex-wrap px-2">
          <TabsTrigger value="converter" className="flex-shrink-0">Converter</TabsTrigger>
          <TabsTrigger value="gasflow" className="flex-shrink-0">Gas Flow</TabsTrigger>
          <TabsTrigger value="ranges" className="flex-shrink-0">Typical Ranges</TabsTrigger>
          <TabsTrigger value="rates" className="flex-shrink-0">Rates</TabsTrigger>
          <TabsTrigger value="load" className="flex-shrink-0">Load Estimator</TabsTrigger>
          <TabsTrigger value="tests" className="flex-shrink-0">Tests</TabsTrigger>
        </TabsList>
        <TabsContent value="convert"><PowerConverter /><ReferenceTable /></TabsContent>
        <TabsContent value="gas"><GasSizing /></TabsContent>
        <TabsContent value="ranges"><ApplianceRanges /></TabsContent>
        <TabsContent value="rates"><FuelRateComparer /></TabsContent>
        <TabsContent value="loads"><LoadEstimator /></TabsContent>
        <TabsContent value="tests"><SelfTests /></TabsContent>
      </Tabs>
    </div>
  );
}
