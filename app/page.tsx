"use client";

import React, { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Constants
const BTU_PER_KW = 3412.142;
const BTU_PER_TON = 12000;
const BTU_PER_HP = 2544.43;
const BTU_PER_THERM = 100000;
const BTU_PER_DTH = 1000000;

export default function EnergyProToolkit() {
  const [value, setValue] = useState<number>(9000000);
  const [unit, setUnit] = useState<string>("BTU/hr");
  const [hhv, setHhv] = useState<number>(1.035);
  const [sqft, setSqft] = useState<number>(2000);
  const [building, setBuilding] = useState<string>("average");

  // --- Core conversions ---
  const results = useMemo(() => {
    let btuPerHr = value;

    // Convert everything to BTU/hr
    switch (unit) {
      case "kW":
        btuPerHr = value * BTU_PER_KW;
        break;
      case "Ton":
        btuPerHr = value * BTU_PER_TON;
        break;
      case "HP":
        btuPerHr = value * BTU_PER_HP;
        break;
      case "Therm/hr":
        btuPerHr = value * BTU_PER_THERM;
        break;
      case "DTH/hr":
        btuPerHr = value * BTU_PER_DTH;
        break;
    }

    // Derived demand rates
    const kw = btuPerHr / BTU_PER_KW;
    const tons = btuPerHr / BTU_PER_TON;
    const hp = btuPerHr / BTU_PER_HP;

    // Energy quantities (based on 1 hour of operation)
    const therms = btuPerHr / BTU_PER_THERM; // Therms/hour
    const dth = btuPerHr / BTU_PER_DTH; // DTH/hour
    const mcf = btuPerHr / (hhv * 1_000_000); // MCF/hour
    const cfh = mcf * 1000; // CFH

    return { btuPerHr, kw, tons, hp, therms, dth, mcf, cfh };
  }, [value, unit, hhv]);

  // --- Load estimator ---
  const load = useMemo(() => {
    const factors = {
      tight: { heat: 25, cool: 15 },
      average: { heat: 30, cool: 20 },
      leaky: { heat: 40, cool: 28 },
    };
    const factor = factors[building as keyof typeof factors];
    const heatBtuh = sqft * factor.heat;
    const coolBtuh = sqft * factor.cool;
    const heatMbh = heatBtuh / 1000;
    const coolTons = coolBtuh / 12000;
    return { heatBtuh, coolBtuh, heatMbh, coolTons };
  }, [sqft, building]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">Energy Pro Toolkit</h1>

      <Tabs defaultValue="converter" className="w-full">
        <TabsList className="w-full overflow-x-auto flex-nowrap whitespace-nowrap sm:flex-wrap px-2">
          <TabsTrigger value="converter" className="flex-shrink-0">Converter</TabsTrigger>
          <TabsTrigger value="gasflow" className="flex-shrink-0">Gas Flow</TabsTrigger>
          <TabsTrigger value="ranges" className="flex-shrink-0">Typical Ranges</TabsTrigger>
          <TabsTrigger value="rates" className="flex-shrink-0">Rates</TabsTrigger>
          <TabsTrigger value="load" className="flex-shrink-0">Load Estimator</TabsTrigger>
          <TabsTrigger value="tests" className="flex-shrink-0">Tests</TabsTrigger>
        </TabsList>

        {/* === Converter Tab === */}
        <TabsContent value="converter">
          <Card>
            <CardContent className="space-y-4 mt-4">
              <Label>Value</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BTU/hr">BTU/hr (Demand)</SelectItem>
                      <SelectItem value="kW">kW (Demand)</SelectItem>
                      <SelectItem value="Ton">Tons (Cooling Demand)</SelectItem>
                      <SelectItem value="HP">HP (Mechanical)</SelectItem>
                      <SelectItem value="Therm/hr">Therm/hr (Energy Rate)</SelectItem>
                      <SelectItem value="DTH/hr">DTH/hr (Energy Rate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gas Heat Content (MBTU/MCF)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={hhv}
                    onChange={(e) => setHhv(parseFloat(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="text-sm italic text-gray-500">
                <strong>Note:</strong> Units below reflect one hour of operation (MCF/hr, Therms/hr, etc.).
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center font-mono">
                <div><strong>BTUH</strong><div>{results.btuPerHr.toLocaleString()}</div></div>
                <div><strong>TONS</strong><div>{results.tons.toFixed(1)}</div></div>
                <div><strong>KW</strong><div>{results.kw.toFixed(2)}</div></div>
                <div><strong>HP</strong><div>{results.hp.toFixed(2)}</div></div>
                <div><strong>THERMS/hr</strong><div>{results.therms.toFixed(2)}</div></div>
                <div><strong>DTH/hr</strong><div>{results.dth.toFixed(2)}</div></div>
                <div><strong>MCF/hr</strong><div>{results.mcf.toFixed(3)}</div></div>
                <div><strong>CFH</strong><div>{results.cfh.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Gas Flow Tab === */}
        <TabsContent value="gasflow">
          <Card>
            <CardContent className="mt-4 space-y-2">
              <p>Estimate gas flow rate based on demand:</p>
              <ul className="list-disc pl-6">
                <li>1 CFH ≈ 1,000 BTU/hr ÷ HHV</li>
                <li>Example: 9,000,000 BTUH ÷ (1.035 × 1,000) = 8,700 CFH</li>
                <li>Use 8,700 CFH for meter sizing and pipe sizing lookups.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Typical Ranges Tab === */}
        <TabsContent value="ranges">
          <Card>
            <CardContent className="mt-4">
              <ul className="list-disc pl-6">
                <li>Residential: 80–150 MBH</li>
                <li>Commercial small: 200–800 MBH</li>
                <li>Industrial: 1,000 MBH and above</li>
                <li>Cooling: 12,000 BTU/hr per ton</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Rates Tab === */}
        <TabsContent value="rates">
          <Card>
            <CardContent className="mt-4">
              <p><strong>Typical Fuel Rates (2025 est.):</strong></p>
              <ul className="list-disc pl-6">
                <li>Electricity: $0.14 / kWh</li>
                <li>Natural Gas: $13 / MCF</li>
                <li>Fuel Oil: $3.75 / gal</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Load Estimator Tab === */}
        <TabsContent value="load">
          <Card>
            <CardContent className="space-y-4 mt-4">
              <Label>Building Type</Label>
              <Select value={building} onValueChange={setBuilding}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tight">New/Tight Construction</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                  <SelectItem value="leaky">Older/Leaky</SelectItem>
                </SelectContent>
              </Select>

              <Label>Conditioned Area (sqft)</Label>
              <Input
                type="number"
                value={sqft}
                onChange={(e) => setSqft(parseFloat(e.target.value) || 0)}
              />

              <div className="grid grid-cols-2 gap-4 text-center font-mono">
                <div>
                  <strong>Heating Load (BTUH)</strong>
                  <div>{load.heatBtuh.toLocaleString()}</div>
                </div>
                <div>
                  <strong>Cooling Load (BTUH)</strong>
                  <div>{load.coolBtuh.toLocaleString()}</div>
                </div>
                <div>
                  <strong>Heating (MBH)</strong>
                  <div>{load.heatMbh.toFixed(1)}</div>
                </div>
                <div>
                  <strong>Cooling (Tons)</strong>
                  <div>{load.coolTons.toFixed(1)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Tests Tab === */}
        <TabsContent value="tests">
          <Card>
            <CardContent className="mt-4">
              <p>Verification:</p>
              <ul className="list-disc pl-6">
                <li>1 MCF/hr × 1.035 MBTU/MCF = 1.035 MMBTU/hr</li>
                <li>1 MMBTU/hr = 1,000,000 BTU/hr</li>
                <li>1 kW = 3,412 BTU/hr</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
