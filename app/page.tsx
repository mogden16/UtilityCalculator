"use client";

import React, { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Conversion constants
const BTU_PER_KW = 3412.142;
const BTU_PER_TON = 12000;
const BTU_PER_HP = 2544.43;

export default function EnergyProToolkit() {
  const [value, setValue] = useState<number>(9000000);
  const [unit, setUnit] = useState<string>("BTU/hr");
  const [hhv, setHhv] = useState<number>(1.035);

  const results = useMemo(() => {
    let btuPerHr = value;

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
        btuPerHr = value * 100000;
        break;
      case "DTH/hr":
        btuPerHr = value * 1000000;
        break;
      default:
        break;
    }

    const kw = btuPerHr / BTU_PER_KW;
    const tons = btuPerHr / BTU_PER_TON;
    const hp = btuPerHr / BTU_PER_HP;
    const therms = btuPerHr / 100000;
    const dth = btuPerHr / 1000000;
    const mcf = btuPerHr / (hhv * 1_000_000);
    const cfh = (btuPerHr / (hhv * 1_000_000)) * 1000;

    return { btuPerHr, kw, tons, hp, therms, dth, mcf, cfh };
  }, [value, unit, hhv]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">Energy Pro Toolkit</h1>

      <Tabs defaultValue="converter" className="w-full">
        <TabsList className="w-full overflow-x-auto flex-nowrap whitespace-nowrap sm:flex-wrap px-2">
          <TabsTrigger value="converter" className="flex-shrink-0">
            Converter
          </TabsTrigger>
          <TabsTrigger value="gasflow" className="flex-shrink-0">
            Gas Flow
          </TabsTrigger>
          <TabsTrigger value="ranges" className="flex-shrink-0">
            Typical Ranges
          </TabsTrigger>
          <TabsTrigger value="rates" className="flex-shrink-0">
            Rates
          </TabsTrigger>
          <TabsTrigger value="load" className="flex-shrink-0">
            Load Estimator
          </TabsTrigger>
          <TabsTrigger value="tests" className="flex-shrink-0">
            Tests
          </TabsTrigger>
        </TabsList>

        {/* ===== Converter Tab ===== */}
        <TabsContent value="converter">
          <Card>
            <CardContent className="space-y-4 mt-4">
              <div>
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={value}
                  onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BTU/hr">BTU/hr</SelectItem>
                      <SelectItem value="kW">kW</SelectItem>
                      <SelectItem value="Ton">Ton</SelectItem>
                      <SelectItem value="HP">HP</SelectItem>
                      <SelectItem value="Therm/hr">Therm/hr</SelectItem>
                      <SelectItem value="DTH/hr">DTH/hr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Gas Heat Content (MBTU/MCF)</Label>
                  <Input
                    type="number"
                    value={hhv}
                    step="0.001"
                    onChange={(e) => setHhv(parseFloat(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center font-mono">
                <div><strong>BTUH</strong><div>{results.btuPerHr.toLocaleString()}</div></div>
                <div><strong>TONS</strong><div>{results.tons.toFixed(0)}</div></div>
                <div><strong>KW</strong><div>{results.kw.toFixed(2)}</div></div>
                <div><strong>HP</strong><div>{results.hp.toFixed(2)}</div></div>
                <div><strong>THERMS</strong><div>{results.therms.toFixed(0)}</div></div>
                <div><strong>DTH</strong><div>{results.dth.toFixed(1)}</div></div>
                <div><strong>MCF</strong><div>{results.mcf.toFixed(1)}</div></div>
                <div><strong>CFH</strong><div>{results.cfh.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Gas Flow Tab ===== */}
        <TabsContent value="gasflow">
          <Card><CardContent className="mt-4">Gas flow sizing and velocity tools coming soon.</CardContent></Card>
        </TabsContent>

        {/* ===== Typical Ranges Tab ===== */}
        <TabsContent value="ranges">
          <Card><CardContent className="mt-4">Typical appliance and system load ranges will appear here.</CardContent></Card>
        </TabsContent>

        {/* ===== Rates Tab ===== */}
        <TabsContent value="rates">
          <Card><CardContent className="mt-4">Utility rate comparison table placeholder.</CardContent></Card>
        </TabsContent>

        {/* ===== Load Estimator Tab ===== */}
        <TabsContent value="load">
          <Card><CardContent className="mt-4">Heating and cooling load estimator for Philadelphia climate under development.</CardContent></Card>
        </TabsContent>

        {/* ===== Tests Tab ===== */}
        <TabsContent value="tests">
          <Card><CardContent className="mt-4">Unit conversion verification tests placeholder.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
