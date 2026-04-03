"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_T_AND_D_LOSS_FRACTION,
  LEAK_SCENARIOS,
  computeFuelEmissionsRows,
  computeGasEmissionsForScenario,
  mapPjmFuelToFuelKey,
  prettyFuelLabel,
  type FuelKey,
} from "@/lib/emissions";

type GridMixEntry = {
  label: string;
  value: number;
  mw: number;
};

type FuelMixRow = {
  fuelKey: FuelKey;
  label: string;
  mw: number;
};

type PjmEmissionsResponse = {
  carbonIntensity: number | null;
  carbonIntensityUnits: string;
  gridMix: GridMixEntry[];
  totalMw?: number;
  timestamp: string | null;
  source: string;
};

type EmissionsApiResponse = PjmEmissionsResponse & {
  error?: string;
  carbon_intensity?: number | null;
  carbon_intensity_units?: string;
  grid_mix?: Array<Record<string, unknown>> | Record<string, number>;
  mix?: Array<Record<string, unknown>> | Record<string, number>;
};

type LeakScenarioKey = keyof typeof LEAK_SCENARIOS;
type PjmScenarioKey = "real_time" | "renewable" | "coal" | "annual";

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

const PJM_SCENARIOS: Record<PjmScenarioKey, { label: string; rows: FuelMixRow[] }> = {
  real_time: { label: "Real-time PJM (from API)", rows: [] },
  renewable: {
    label: "Example: Renewable-heavy hour",
    rows: [
      { fuelKey: "wind", label: prettyFuelLabel("wind"), mw: 9000 },
      { fuelKey: "solar", label: prettyFuelLabel("solar"), mw: 6500 },
      { fuelKey: "nuclear", label: prettyFuelLabel("nuclear"), mw: 7500 },
      { fuelKey: "ngcc", label: prettyFuelLabel("ngcc"), mw: 7000 },
      { fuelKey: "coal", label: prettyFuelLabel("coal"), mw: 2500 },
      { fuelKey: "hydro", label: prettyFuelLabel("hydro"), mw: 1200 },
      { fuelKey: "biomass", label: prettyFuelLabel("biomass"), mw: 500 },
      { fuelKey: "oil", label: prettyFuelLabel("oil"), mw: 300 },
    ],
  },
  coal: {
    label: "Example: Coal-heavy hour",
    rows: [
      { fuelKey: "coal", label: prettyFuelLabel("coal"), mw: 12000 },
      { fuelKey: "ngcc", label: prettyFuelLabel("ngcc"), mw: 9000 },
      { fuelKey: "nuclear", label: prettyFuelLabel("nuclear"), mw: 6500 },
      { fuelKey: "oil", label: prettyFuelLabel("oil"), mw: 1200 },
      { fuelKey: "wind", label: prettyFuelLabel("wind"), mw: 1200 },
      { fuelKey: "solar", label: prettyFuelLabel("solar"), mw: 700 },
      { fuelKey: "hydro", label: prettyFuelLabel("hydro"), mw: 800 },
      { fuelKey: "biomass", label: prettyFuelLabel("biomass"), mw: 400 },
    ],
  },
  annual: {
    label: "Example: PJM annual average",
    rows: [
      { fuelKey: "ngcc", label: prettyFuelLabel("ngcc"), mw: 18000 },
      { fuelKey: "coal", label: prettyFuelLabel("coal"), mw: 9500 },
      { fuelKey: "nuclear", label: prettyFuelLabel("nuclear"), mw: 11000 },
      { fuelKey: "wind", label: prettyFuelLabel("wind"), mw: 6000 },
      { fuelKey: "solar", label: prettyFuelLabel("solar"), mw: 3500 },
      { fuelKey: "hydro", label: prettyFuelLabel("hydro"), mw: 2000 },
      { fuelKey: "biomass", label: prettyFuelLabel("biomass"), mw: 700 },
      { fuelKey: "oil", label: prettyFuelLabel("oil"), mw: 500 },
    ],
  },
};

const fmt0 = (value: number | null | undefined) =>
  Number.isFinite(value) ? Math.round(value as number).toLocaleString() : "-";
const fmt1 = (value: number | null | undefined) =>
  Number.isFinite(value)
    ? (value as number).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "-";
const fmt2 = (value: number | null | undefined) =>
  Number.isFinite(value)
    ? (value as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "-";
const fmt3 = (value: number | null | undefined) =>
  Number.isFinite(value)
    ? (value as number).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : "-";

export function CHPGridEmissionsPanel() {
  const [data, setData] = useState<EmissionsApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeakScenario, setSelectedLeakScenario] = useState<LeakScenarioKey>("medium");
  const [selectedPjmScenario, setSelectedPjmScenario] = useState<PjmScenarioKey>("real_time");

  const loadPjmData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pjm-gen-emissions", { cache: "no-store" });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as EmissionsApiResponse)
        : ({ error: await response.text() } as EmissionsApiResponse);

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`);
      }

      setData(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load PJM emissions data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPjmData();
  }, []);

  const carbonIntensity = useMemo(() => {
    const value = data?.carbonIntensity ?? data?.carbon_intensity;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }, [data]);

  const carbonIntensityUnits = data?.carbonIntensityUnits ?? data?.carbon_intensity_units ?? "lbs CO2e/MWh";

  const gridMix = useMemo(() => {
    const rawMix = data?.gridMix ?? data?.grid_mix ?? data?.mix;
    if (!rawMix) return [] as GridMixEntry[];

    if (Array.isArray(rawMix)) {
      return rawMix
        .map((entry) => {
          const candidate = entry as Record<string, unknown>;
          const label =
            (typeof candidate.label === "string" && candidate.label.trim()) ||
            (typeof candidate.fuel === "string" && candidate.fuel.trim()) ||
            (typeof candidate.source === "string" && candidate.source.trim()) ||
            (typeof candidate.type === "string" && candidate.type.trim()) ||
            (typeof candidate.name === "string" && candidate.name.trim());
          const value = Number(
            candidate.value ?? candidate.percentage ?? candidate.percent ?? candidate.share ?? candidate.mix ?? 0,
          );
          const mw = Number(candidate.mw ?? candidate.MW ?? candidate.megawatts ?? candidate.amount ?? 0);
          if (!label || !Number.isFinite(value)) return null;
          return { label, value, mw: Number.isFinite(mw) ? mw : 0 };
        })
        .filter((entry): entry is GridMixEntry => Boolean(entry));
    }

    return Object.entries(rawMix)
      .map(([label, value]) => ({ label, value: Number(value), mw: 0 }))
      .filter((entry) => Number.isFinite(entry.value));
  }, [data]);

  const sortedGridMix = useMemo(() => [...gridMix].sort((a, b) => b.value - a.value), [gridMix]);
  const totalMw = data?.totalMw;
  const timestampUtc = data?.timestamp ?? null;

  const updatedLabel = useMemo(() => {
    if (!timestampUtc) return null;
    const dt = new Date(timestampUtc);
    return dt.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [timestampUtc]);

  const fuelMixRows = useMemo(() => {
    return sortedGridMix
      .map((entry) => {
        const fuelKey = mapPjmFuelToFuelKey(entry.label);
        const computedMw =
          Number.isFinite(entry.mw) && entry.mw > 0
            ? entry.mw
            : typeof totalMw === "number"
              ? (entry.value / 100) * totalMw
              : 0;
        const label = PRETTY_GRID_LABELS[entry.label] ?? entry.label ?? prettyFuelLabel(fuelKey);
        return { fuelKey, label, mw: Math.max(computedMw, 0) };
      })
      .filter((row) => row.mw > 0);
  }, [sortedGridMix, totalMw]);

  const emissionsSummary = useMemo(
    () => computeFuelEmissionsRows(fuelMixRows, DEFAULT_T_AND_D_LOSS_FRACTION),
    [fuelMixRows],
  );

  const computedCarbonIntensity = carbonIntensity ?? (emissionsSummary.totalGenerationLbPerMwh || null);
  const deliveredCarbonIntensity = emissionsSummary.totalDeliveredLbPerMwh || computedCarbonIntensity || null;

  const gasBreakdown = useMemo(
    () => computeGasEmissionsForScenario(selectedLeakScenario),
    [selectedLeakScenario],
  );

  const gridToNatGasRatio =
    deliveredCarbonIntensity !== null && gasBreakdown.directCo2LbPerKwh > 0
      ? deliveredCarbonIntensity / 1000 / gasBreakdown.directCo2LbPerKwh
      : null;

  const pjmScenarioRows = useMemo(() => {
    if (selectedPjmScenario === "real_time" && fuelMixRows.length > 0) {
      return fuelMixRows;
    }
    return PJM_SCENARIOS[selectedPjmScenario].rows;
  }, [fuelMixRows, selectedPjmScenario]);

  const pjmScenarioEmissions = useMemo(
    () => computeFuelEmissionsRows(pjmScenarioRows, DEFAULT_T_AND_D_LOSS_FRACTION),
    [pjmScenarioRows],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl">PJM Grid Emissions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Live grid mix and carbon intensity from PJM through a server-side route, so the API key stays in Cloudflare.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadPjmData()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh PJM Data"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">Loading PJM emissions data...</div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4 rounded-md border border-border/60 p-4">
            <div>
              <div className="text-sm text-muted-foreground">Carbon intensity (delivered)</div>
              <div className="text-3xl font-semibold">
                {deliveredCarbonIntensity !== null ? fmt1(deliveredCarbonIntensity) : "-"}
                <span className="ml-2 text-base font-normal text-muted-foreground">lbs CO2e/MWh</span>
              </div>
            </div>
            {computedCarbonIntensity !== null && (
              <p className="text-sm text-muted-foreground">
                Generation mix average: {fmt1(computedCarbonIntensity)} {carbonIntensityUnits}
              </p>
            )}
            {updatedLabel ? <p className="text-sm text-muted-foreground">Updated {updatedLabel}</p> : null}
            {typeof totalMw === "number" && totalMw > 0 ? (
              <p className="text-sm text-muted-foreground">Total generation represented: {fmt0(totalMw)} MW</p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border border-border/60 p-4">
            <div className="font-semibold">Grid Mix with Emissions</div>
            {emissionsSummary.rows.length === 0 || Boolean(error) ? (
              <div className="text-sm text-muted-foreground">
                No live grid mix data is available. The scenario comparison below still works with reference cases.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-3 py-2 font-medium">Fuel</th>
                      <th className="px-3 py-2 text-center font-medium">MW</th>
                      <th className="px-3 py-2 text-right font-medium">Share</th>
                      <th className="px-3 py-2 text-right font-medium">Factor</th>
                      <th className="px-3 py-2 text-right font-medium">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emissionsSummary.rows.map((row) => (
                      <tr key={row.label} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 align-top text-foreground">{row.label}</td>
                        <td className="px-3 py-2 text-center font-mono text-muted-foreground">{fmt0(row.mw)}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt1(row.sharePercent)}%</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt0(row.emissionFactorLbPerMwh)}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt1(row.contributionLbPerMwh)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Natural Gas Customer Emissions</h3>
              <Select value={selectedLeakScenario} onValueChange={(value) => setSelectedLeakScenario(value as LeakScenarioKey)}>
                <SelectTrigger className="w-[230px]">
                  <SelectValue placeholder="Leakage scenario" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAK_SCENARIOS).map(([key, scenario]) => (
                    <SelectItem key={key} value={key}>
                      {scenario.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Constant assumptions: 1.035 MMBtu per MCF and 117 lb CO2 per MMBtu direct combustion.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Direct CO2 (combustion)</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{fmt1(gasBreakdown.directCo2LbPerMmbtu)}</td>
                    <td className="py-2 pl-2 text-muted-foreground">lb CO2/MMBtu</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Methane upstream (CO2e)</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{fmt1(gasBreakdown.methaneCo2eLbPerMmbtu)}</td>
                    <td className="py-2 pl-2 text-muted-foreground">lb CO2e/MMBtu</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">Total CO2e per MMBtu</td>
                    <td className="py-2 text-right font-mono text-foreground">{fmt1(gasBreakdown.totalCo2eLbPerMmbtu)}</td>
                    <td className="py-2 pl-2 text-muted-foreground">lb CO2e/MMBtu</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Total CO2e per MCF</td>
                    <td className="py-2 text-right font-mono text-foreground">{fmt1(gasBreakdown.totalCo2eLbPerMcf)}</td>
                    <td className="py-2 pl-2 text-muted-foreground">lb CO2e/MCF</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">Total CO2e per thermal kWh</td>
                    <td className="py-2 text-right font-mono text-foreground">{fmt3(gasBreakdown.totalCo2eLbPerKwh)}</td>
                    <td className="py-2 pl-2 text-muted-foreground">lb CO2e/kWh</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">Electric vs. Gas Comparison</h3>
            <div className="space-y-2">
              <Label htmlFor="pjm-scenario-select">PJM scenario</Label>
              <Select value={selectedPjmScenario} onValueChange={(value) => setSelectedPjmScenario(value as PjmScenarioKey)}>
                <SelectTrigger id="pjm-scenario-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PJM_SCENARIOS).map(([key, scenario]) => (
                    <SelectItem key={key} value={key}>
                      {scenario.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium">Option</th>
                    <th className="px-3 py-2 text-right font-medium">lb CO2e per kWh</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/60">
                    <td className="px-3 py-2">PJM electricity (delivered)</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">
                      {pjmScenarioEmissions.totalDeliveredLbPerMwh
                        ? fmt3(pjmScenarioEmissions.totalDeliveredLbPerMwh / 1000)
                        : "-"}
                    </td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="px-3 py-2">Natural gas (direct CO2 only)</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt3(gasBreakdown.directCo2LbPerKwh)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Natural gas (including leakage)</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{fmt3(gasBreakdown.totalCo2eLbPerKwh)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>
            Delivered grid emissions assume {fmt2(DEFAULT_T_AND_D_LOSS_FRACTION * 100)}% transmission and distribution
            losses. Fuel-specific factors come from the engineering constants in <code>lib/emissions.ts</code>.
          </p>
          {deliveredCarbonIntensity !== null && gridToNatGasRatio !== null ? (
            <p className="mt-2">
              Compared to the current PJM delivered intensity of {fmt1(deliveredCarbonIntensity)} lbs/MWh, electricity
              is {fmt2(gridToNatGasRatio)}x the direct CO2 intensity of burning natural gas onsite, excluding methane
              leakage.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
