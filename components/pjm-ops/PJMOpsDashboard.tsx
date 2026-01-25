"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  asNumber,
  fetchPjmOpsFeed,
  formatTimeEt,
  formatTimestampEt,
  parseRecordTimestamp,
  toEtDateKey,
  toEtTodayKey,
  usePjmOpsDataset,
} from "@/lib/pjm-ops/data";
import { aggregateEmissionsMedian, computeMinMax, computePeak } from "@/lib/pjm-ops/transforms";
import { mapPjmFuelToFuelKey, prettyFuelLabel } from "@/lib/emissions";

const FIVE_MIN_MS = 5 * 60 * 1000;
const HOURLY_MS = 60 * 60 * 1000;

const TIME_RANGES = ["today", "24h", "7d"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

type LoadPoint = { timestamp: Date; value: number; forecast?: number };

type LmpPoint = { timestamp: Date; value: number };

type FuelMixPoint = { timestamp: Date; [key: string]: number | Date };

type ConstraintRow = {
  id: string;
  name: string;
  flow: number;
  limit: number;
  loading: number;
  marginalValue: number;
  timestamp: Date | null;
};

type EmissionsPoint = { timestamp: Date; value: number };

type Pollutant = "co2" | "nox" | "so2";

const fmt0 = (value: number) => (Number.isFinite(value) ? Math.round(value).toLocaleString() : "–");
const fmt1 = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "–";
const fmt2 = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "–";

const formatPercent = (value: number) => (Number.isFinite(value) ? `${fmt1(value)}%` : "–");

const getFieldNumber = (record: Record<string, unknown>, fields: string[]) => {
  for (const field of fields) {
    const value = asNumber(record[field]);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
};

const getFieldString = (record: Record<string, unknown>, fields: string[]) => {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
};

const isWithinRange = (date: Date, range: TimeRange) => {
  if (range === "24h") {
    return Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
  }
  if (range === "7d") {
    return Date.now() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }
  return toEtDateKey(date) === toEtTodayKey();
};

const KpiCard = ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
  <Card className="flex-1">
    <CardContent className="p-4 space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </CardContent>
  </Card>
);

const DataStatus = ({
  timestamp,
  cadence,
  isStale,
}: {
  timestamp: string | null;
  cadence: string;
  isStale: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
    <span>Data as of: {formatTimestampEt(timestamp)}</span>
    <span>Cadence: {cadence}</span>
    {isStale && (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-700">
        Data delayed
      </span>
    )}
  </div>
);

const PageHeader = ({
  title,
  description,
  timestamp,
  cadence,
  isStale,
}: {
  title: string;
  description: string;
  timestamp: string | null;
  cadence: string;
  isStale: boolean;
}) => (
  <div className="space-y-2">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">{description}</p>
      </div>
      <DefinitionsHelp />
    </div>
    <DataStatus timestamp={timestamp} cadence={cadence} isStale={isStale} />
  </div>
);

const DefinitionsHelp = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs text-muted-foreground"
        >
          <Info className="h-3.5 w-3.5" />
          Definitions
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs" side="left">
        <p className="font-medium">Definitions & cadence</p>
        <ul className="mt-2 space-y-1">
          <li>LMP: Locational Marginal Price; unverified values can change after settlement.</li>
          <li>Marginal emissions: estimated emissions impact of the next MW served.</li>
          <li>Cadence reflects PJM publish frequency; Data delayed shows missed updates.</li>
        </ul>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const EmptyState = ({ message, detail }: { message: string; detail?: string | null }) => (
  <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground space-y-2">
    <p>{message}</p>
    {detail ? <p className="text-xs">{detail}</p> : null}
  </div>
);

export const PJMOpsDashboard = () => {
  const [activePage, setActivePage] = useState("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [selectedLoadZone, setSelectedLoadZone] = useState("RTO");
  const [selectedPriceNode, setSelectedPriceNode] = useState("RTO");
  const [pollutant, setPollutant] = useState<Pollutant>("co2");

  const loadFetcher = useCallback(
    () =>
      fetchPjmOpsFeed("instantaneous_load", {
        rowCount: "400",
        order: "Desc",
      }),
    []
  );

  const forecastFetcher = useCallback(
    () =>
      fetchPjmOpsFeed("five_min_load_forecast", {
        rowCount: "400",
        order: "Desc",
      }),
    []
  );

  const lmpFetcher = useCallback(
    () =>
      fetchPjmOpsFeed("rt_lmp_unverified", {
        rowCount: "500",
        order: "Desc",
      }),
    []
  );

  const fuelMixFetcher = useCallback(
    () =>
      fetchPjmOpsFeed("gen_by_fuel", {
        rowCount: "2000",
        order: "Desc",
      }),
    []
  );

  const constraintFetcher = useCallback(
    () =>
      fetchPjmOpsFeed("rt_constraints", {
        rowCount: "200",
        order: "Desc",
      }),
    []
  );

  const emissionsFetcher = useCallback(
    () =>
      fetchPjmOpsFeed("marginal_emission_rates", {
        rowCount: "2000",
        order: "Desc",
      }),
    []
  );

  const shouldLoad = activePage === "load" || activePage === "overview";
  const shouldPrice = activePage === "prices" || activePage === "overview";
  const shouldFuel = activePage === "fuel" || activePage === "overview";
  const shouldCongestion = activePage === "congestion";
  const shouldEmissions = activePage === "emissions";

  const loadState = usePjmOpsDataset({
    key: "instantaneous_load",
    fetcher: loadFetcher,
    cadenceMs: FIVE_MIN_MS,
    pollMs: 60 * 1000,
    ttlMs: FIVE_MIN_MS,
    enabled: shouldLoad,
  });

  const forecastState = usePjmOpsDataset({
    key: "five_min_load_forecast",
    fetcher: forecastFetcher,
    cadenceMs: FIVE_MIN_MS,
    pollMs: 60 * 1000,
    ttlMs: FIVE_MIN_MS,
    enabled: shouldLoad,
  });

  const lmpState = usePjmOpsDataset({
    key: "rt_lmp_unverified",
    fetcher: lmpFetcher,
    cadenceMs: FIVE_MIN_MS,
    pollMs: 60 * 1000,
    ttlMs: FIVE_MIN_MS,
    enabled: shouldPrice,
  });

  const fuelMixState = usePjmOpsDataset({
    key: "gen_by_fuel",
    fetcher: fuelMixFetcher,
    cadenceMs: HOURLY_MS,
    pollMs: 10 * 60 * 1000,
    ttlMs: HOURLY_MS,
    enabled: shouldFuel,
  });

  const constraintState = usePjmOpsDataset({
    key: "rt_constraints",
    fetcher: constraintFetcher,
    cadenceMs: FIVE_MIN_MS,
    pollMs: 60 * 1000,
    ttlMs: FIVE_MIN_MS,
    enabled: shouldCongestion,
  });

  const emissionsState = usePjmOpsDataset({
    key: "marginal_emission_rates",
    fetcher: emissionsFetcher,
    cadenceMs: FIVE_MIN_MS,
    pollMs: 60 * 1000,
    ttlMs: FIVE_MIN_MS,
    enabled: shouldEmissions,
  });

  const loadZones = useMemo(() => {
    const items = loadState.data?.items ?? [];
    const zones = new Set<string>();
    items.forEach((item) => {
      const zone = getFieldString(item, ["zone", "area", "region", "pnode_name"]);
      if (zone) zones.add(zone);
    });
    return Array.from(zones).sort();
  }, [loadState.data]);

  const loadSeries = useMemo(() => {
    const items = loadState.data?.items ?? [];
    const points: (LoadPoint & { zone?: string })[] = items
      .map((item) => {
        const timestamp = parseRecordTimestamp(item);
        const value = getFieldNumber(item, [
          "instantaneous_load",
          "load_mw",
          "mw",
          "load",
        ]);
        const zone = getFieldString(item, ["zone", "area", "region", "pnode_name"]);
        if (!timestamp || !Number.isFinite(value)) return null;
        return { timestamp, value, zone };
      })
      .filter(Boolean) as (LoadPoint & { zone?: string })[];

    const filtered = points.filter((point) => {
      if (selectedLoadZone !== "RTO" && point.zone && point.zone !== selectedLoadZone) {
        return false;
      }
      return isWithinRange(point.timestamp, timeRange);
    });

    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [loadState.data, timeRange, selectedLoadZone]);

  const forecastSeries = useMemo(() => {
    const items = forecastState.data?.items ?? [];
    const points: LoadPoint[] = items
      .map((item) => {
        const timestamp = parseRecordTimestamp(item);
        const value = getFieldNumber(item, [
          "forecast_load",
          "forecast_load_mw",
          "load_forecast_mw",
          "mw",
        ]);
        if (!timestamp || !Number.isFinite(value)) return null;
        return { timestamp, value };
      })
      .filter(Boolean) as LoadPoint[];

    const filtered = points.filter((point) => isWithinRange(point.timestamp, timeRange));

    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [forecastState.data, timeRange]);

  const loadChartData = useMemo(() => {
    const forecastByTimestamp = new Map<number, number>();
    forecastSeries.forEach((point) => {
      forecastByTimestamp.set(point.timestamp.getTime(), point.value);
    });
    return loadSeries.map((point) => ({
      timestamp: point.timestamp.getTime(),
      label: formatTimeEt(point.timestamp),
      actual: point.value,
      forecast: forecastByTimestamp.get(point.timestamp.getTime()) ?? null,
    }));
  }, [loadSeries, forecastSeries]);

  const currentLoad = loadSeries[loadSeries.length - 1]?.value ?? NaN;
  const currentForecast = forecastSeries[forecastSeries.length - 1]?.value ?? NaN;
  const loadPeak = computePeak(loadSeries);
  const forecastPeak = computePeak(forecastSeries);

  const lmpSeries = useMemo(() => {
    const items = lmpState.data?.items ?? [];
    const points: { node: string; timestamp: Date; value: number }[] = items
      .map((item) => {
        const timestamp = parseRecordTimestamp(item);
        const node = getFieldString(item, [
          "pnode_name",
          "pnode_id",
          "zone",
          "hub",
          "pricing_node",
          "node",
          "name",
        ]);
        const value = getFieldNumber(item, [
          "total_lmp",
          "lmp",
          "total_lmp_rt",
          "rt_lmp",
          "price",
        ]);
        if (!timestamp || !node || !Number.isFinite(value)) return null;
        return { node, timestamp, value };
      })
      .filter(Boolean) as { node: string; timestamp: Date; value: number }[];

    return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [lmpState.data]);

  const lmpNodes = useMemo(() => {
    const set = new Set<string>();
    lmpSeries.forEach((point) => set.add(point.node));
    return Array.from(set).sort();
  }, [lmpSeries]);

  const selectedNode = lmpNodes.includes(selectedPriceNode)
    ? selectedPriceNode
    : lmpNodes[0] ?? "RTO";

  const lmpTrend = lmpSeries.filter((point) => {
    if (selectedNode && point.node !== selectedNode) return false;
    return isWithinRange(point.timestamp, timeRange);
  });

  const lmpLatestByNode = useMemo(() => {
    const latestMap = new Map<string, { value: number; timestamp: Date }>();
    lmpSeries.forEach((point) => {
      const existing = latestMap.get(point.node);
      if (!existing || point.timestamp > existing.timestamp) {
        latestMap.set(point.node, { value: point.value, timestamp: point.timestamp });
      }
    });
    return Array.from(latestMap.entries())
      .map(([node, data]) => ({ node, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [lmpSeries]);

  const lmpValues = lmpLatestByNode.map((row) => row.value);
  const lmpSpread = lmpValues.length ? Math.max(...lmpValues) - Math.min(...lmpValues) : NaN;
  const highestLmp = lmpLatestByNode[0];
  const lowestLmp = lmpLatestByNode[lmpLatestByNode.length - 1];
  const avgLmp = lmpValues.length
    ? lmpValues.reduce((sum, value) => sum + value, 0) / lmpValues.length
    : NaN;

  const fuelMixSeries = useMemo(() => {
    const items = fuelMixState.data?.items ?? [];
    const points = new Map<string, FuelMixPoint>();

    for (const item of items) {
      const timestamp = parseRecordTimestamp(item);
      if (!timestamp) continue;
      if (Date.now() - timestamp.getTime() > 7 * 24 * 60 * 60 * 1000) continue;
      const fuelKey = mapPjmFuelToFuelKey(item.fuel_type as string | undefined);
      const label = prettyFuelLabel(fuelKey);
      const value = getFieldNumber(item, ["mw", "mw_generation", "gen_mw"]);
      if (!Number.isFinite(value)) continue;
      const key = timestamp.toISOString();
      const entry = points.get(key) ?? { timestamp };
      entry[label] = (entry[label] as number | undefined ?? 0) + value;
      points.set(key, entry);
    }

    return Array.from(points.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [fuelMixState.data]);

  const latestFuelMix = fuelMixSeries[fuelMixSeries.length - 1];
  const fuelMixTotals = useMemo(() => {
    if (!latestFuelMix) return [];
    return Object.entries(latestFuelMix)
      .filter(([key, value]) => key !== "timestamp" && typeof value === "number")
      .map(([key, value]) => ({ name: key, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }, [latestFuelMix]);

  const totalFuelMix = fuelMixTotals.reduce((sum, entry) => sum + entry.value, 0);
  const gasShare = fuelMixTotals.find((entry) => entry.name === "Natural Gas");
  const nuclearShare = fuelMixTotals.find((entry) => entry.name === "Nuclear");
  const renewableTotal = fuelMixTotals
    .filter((entry) => ["Wind", "Solar", "Hydro"].includes(entry.name))
    .reduce((sum, entry) => sum + entry.value, 0);

  const constraintRows = useMemo(() => {
    const items = constraintState.data?.items ?? [];
    return items
      .map((item) => {
        const flow = getFieldNumber(item, ["flow", "flow_mw", "mw_flow"]);
        const limit = getFieldNumber(item, ["limit", "limit_mw", "mw_limit"]);
        const marginalValue = getFieldNumber(item, [
          "marginal_value",
          "shadow_price",
          "price",
        ]);
        const name = getFieldString(item, ["constraint_name", "name", "constraint"]);
        const id = getFieldString(item, ["constraint_id", "id"]) || name;
        const timestamp = parseRecordTimestamp(item);
        if (!name) return null;
        const loading = Number.isFinite(flow) && Number.isFinite(limit) && limit !== 0
          ? (flow / limit) * 100
          : NaN;
        return {
          id,
          name,
          flow,
          limit,
          loading,
          marginalValue,
          timestamp,
        } as ConstraintRow;
      })
      .filter(Boolean)
      .filter((row) => Number.isFinite(row.marginalValue)) as ConstraintRow[];
  }, [constraintState.data]);

  const activeConstraints = constraintRows.filter((row) => row.marginalValue !== 0);
  const highestConstraint = [...activeConstraints].sort(
    (a, b) => b.marginalValue - a.marginalValue
  )[0];

  const emissionsSeries = useMemo(() => {
    const items = emissionsState.data?.items ?? [];
    const records = items
      .map((item) => {
        const timestamp = parseRecordTimestamp(item);
        if (!timestamp) return null;
        const value = getFieldNumber(item, [
          pollutant === "co2" ? "co2" : "co2_rate",
          pollutant === "nox" ? "nox" : "nox_rate",
          pollutant === "so2" ? "so2" : "so2_rate",
          `${pollutant}_rate`,
        ]);
        if (!Number.isFinite(value)) return null;
        return { timestamp: timestamp.toISOString(), value };
      })
      .filter(Boolean) as { timestamp: string; value: number }[];

    return aggregateEmissionsMedian(records).filter((point) =>
      isWithinRange(point.timestamp, timeRange)
    );
  }, [emissionsState.data, pollutant, timeRange]);

  const emissionsLatest = emissionsSeries[emissionsSeries.length - 1]?.value ?? NaN;
  const emissionsMinMax = computeMinMax(
    emissionsSeries.filter((point) => Date.now() - point.timestamp.getTime() <= 24 * 60 * 60 * 1000)
  );
  const errorMessage = (
    state: { status: string; error: string | null },
    feedLabel: string
  ) => {
    if (state.status !== "error") return null;
    const message = state.error ?? "";
    if (
      message.includes("not configured") ||
      message.includes("Missing PJM API key") ||
      message.includes("401") ||
      message.includes("403") ||
      message.includes("404")
    ) {
      return `Data source not configured yet. TODO: configure ${feedLabel} feed.`;
    }
    return message;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">PJM Operations</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Real-time operational dashboards for PJM using Data Miner feeds. Track load, prices, fuel
          mix, congestion, and marginal emissions with consistent KPIs and visual patterns.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="text-xs text-muted-foreground">Time range</div>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activePage} onValueChange={setActivePage} className="w-full">
        <TabsList className="w-full overflow-x-auto flex-nowrap whitespace-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="load">Load</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="fuel">Fuel Mix</TabsTrigger>
          <TabsTrigger value="congestion">Congestion</TabsTrigger>
          <TabsTrigger value="emissions">Emissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6" forceMount>
          <PageHeader
            title="Overview"
            description="Snapshot of PJM operations across load, real-time prices, and fuel mix."
            timestamp={loadState.latestTimestamp}
            cadence="5-min / hourly"
            isStale={loadState.isStale || fuelMixState.isStale}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Current load (MW)" value={fmt0(currentLoad)} />
            <KpiCard
              label="Current LMP avg"
              value={fmt2(avgLmp)}
              detail={selectedNode ? `Based on ${lmpLatestByNode.length} zones/hubs` : ""}
            />
            <KpiCard
              label="Fuel mix total (MW)"
              value={fmt0(totalFuelMix)}
              detail={latestFuelMix ? `Hour ending ${formatTimeEt(latestFuelMix.timestamp)}` : ""}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Load trend</h3>
                {loadChartData.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={loadChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="actual" stroke="#2563eb" dot={false} />
                        <Line type="monotone" dataKey="forecast" stroke="#f97316" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    message="Load data not available yet."
                    detail={errorMessage(loadState, "instantaneous load")}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Fuel mix latest hour</h3>
                {fuelMixTotals.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fuelMixTotals}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    message="Fuel mix data not available yet."
                    detail={errorMessage(fuelMixState, "generation by fuel")}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="load" className="space-y-6" forceMount>
          <PageHeader
            title="Load"
            description="Monitor instantaneous PJM load with five-minute forecast overlay."
            timestamp={loadState.latestTimestamp}
            cadence="5-min"
            isStale={loadState.isStale}
          />

          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Current load (MW)" value={fmt0(currentLoad)} />
            <KpiCard
              label="Today peak so far"
              value={fmt0(loadPeak.value)}
              detail={loadPeak.timestamp ? formatTimeEt(loadPeak.timestamp) : ""}
            />
            <KpiCard
              label="Forecast peak"
              value={fmt0(forecastPeak.value)}
              detail={forecastPeak.timestamp ? formatTimeEt(forecastPeak.timestamp) : ""}
            />
            <KpiCard
              label="Delta vs forecast"
              value={fmt0(currentLoad - currentForecast)}
              detail={Number.isFinite(currentForecast) ? formatPercent((currentLoad / currentForecast) * 100 - 100) : ""}
            />
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs text-muted-foreground">Location</div>
                <Select value={selectedLoadZone} onValueChange={setSelectedLoadZone}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RTO">PJM RTO</SelectItem>
                    {loadZones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {loadChartData.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={loadChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="actual" stroke="#2563eb" dot={false} />
                      <Line type="monotone" dataKey="forecast" stroke="#f97316" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  message="Load data not available yet."
                  detail={errorMessage(loadState, "instantaneous load")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prices" className="space-y-6" forceMount>
          <PageHeader
            title="Prices"
            description="Track real-time LMPs by zone/hub and review the last 24 hours for a selected location."
            timestamp={lmpState.latestTimestamp}
            cadence="5-min"
            isStale={lmpState.isStale}
          />

          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="RTO avg LMP" value={fmt2(avgLmp)} />
            <KpiCard
              label="Highest zone/hub"
              value={highestLmp ? `${highestLmp.node}` : "–"}
              detail={highestLmp ? fmt2(highestLmp.value) : ""}
            />
            <KpiCard
              label="Lowest zone/hub"
              value={lowestLmp ? `${lowestLmp.node}` : "–"}
              detail={lowestLmp ? fmt2(lowestLmp.value) : ""}
            />
            <KpiCard label="Spread" value={fmt2(lmpSpread)} />
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs text-muted-foreground">Zone/Hub</div>
                <Select value={selectedNode} onValueChange={setSelectedPriceNode}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lmpNodes.map((node) => (
                      <SelectItem key={node} value={node}>
                        {node}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {lmpTrend.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={lmpTrend.map((point) => ({
                        timestamp: point.timestamp.getTime(),
                        label: formatTimeEt(point.timestamp),
                        value: point.value,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(value) => `$${value}`} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  message="Price trend data not available yet."
                  detail={errorMessage(lmpState, "real-time LMP")}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Current LMPs</h3>
              {lmpLatestByNode.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">Zone/Hub</th>
                        <th className="px-2 py-2 text-right">LMP ($/MWh)</th>
                        <th className="px-2 py-2 text-right">Timestamp (ET)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lmpLatestByNode.map((row, index) => (
                        <tr
                          key={row.node}
                          className={
                            index === 0
                              ? "bg-emerald-50/50"
                              : index === lmpLatestByNode.length - 1
                              ? "bg-rose-50/50"
                              : ""
                          }
                        >
                          <td className="px-2 py-2 font-medium">{row.node}</td>
                          <td className="px-2 py-2 text-right">{fmt2(row.value)}</td>
                          <td className="px-2 py-2 text-right">{formatTimeEt(row.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  message="LMP table data not available yet."
                  detail={errorMessage(lmpState, "real-time LMP")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel" className="space-y-6" forceMount>
          <PageHeader
            title="Fuel Mix"
            description="Hourly generation by fuel type with latest mix and seven-day trend."
            timestamp={fuelMixState.latestTimestamp}
            cadence="hourly"
            isStale={fuelMixState.isStale}
          />

          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Latest total MW" value={fmt0(totalFuelMix)} />
            <KpiCard
              label="Gas share"
              value={
                gasShare && totalFuelMix
                  ? formatPercent((gasShare.value / totalFuelMix) * 100)
                  : "–"
              }
            />
            <KpiCard
              label="Nuclear share"
              value={
                nuclearShare && totalFuelMix
                  ? formatPercent((nuclearShare.value / totalFuelMix) * 100)
                  : "–"
              }
            />
            <KpiCard
              label="Renewables share"
              value={totalFuelMix ? formatPercent((renewableTotal / totalFuelMix) * 100) : "–"}
              detail={latestFuelMix ? `Hour ending ${formatTimeEt(latestFuelMix.timestamp)}` : ""}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Current mix</h3>
                {fuelMixTotals.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fuelMixTotals}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    message="Fuel mix data not available yet."
                    detail={errorMessage(fuelMixState, "generation by fuel")}
                  />
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Last 7 days</h3>
                {fuelMixSeries.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={fuelMixSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" tickFormatter={(value) => formatTimeEt(new Date(value))} />
                        <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                        <RechartsTooltip />
                        <Legend />
                        {fuelMixTotals.map((entry, index) => (
                          <Area
                            key={entry.name}
                            type="monotone"
                            dataKey={entry.name}
                            stackId="1"
                            stroke={`hsl(${index * 45}, 70%, 50%)`}
                            fill={`hsl(${index * 45}, 70%, 60%)`}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    message="Fuel mix history not available yet."
                    detail={errorMessage(fuelMixState, "generation by fuel")}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="congestion" className="space-y-6" forceMount>
          <PageHeader
            title="Congestion"
            description="Active transmission constraints with real-time marginal values."
            timestamp={constraintState.latestTimestamp}
            cadence="5-min"
            isStale={constraintState.isStale}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Active constraints" value={fmt0(activeConstraints.length)} />
            <KpiCard
              label="Highest marginal value"
              value={highestConstraint ? highestConstraint.name : "–"}
              detail={highestConstraint ? fmt2(highestConstraint.marginalValue) : ""}
            />
            <KpiCard label="Price spread proxy" value={fmt2(lmpSpread)} />
          </div>

          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Active constraints</h3>
              {activeConstraints.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">Constraint</th>
                        <th className="px-2 py-2 text-right">Flow</th>
                        <th className="px-2 py-2 text-right">Limit</th>
                        <th className="px-2 py-2 text-right">% Loading</th>
                        <th className="px-2 py-2 text-right">Marginal value ($)</th>
                        <th className="px-2 py-2 text-right">Timestamp (ET)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeConstraints.map((row) => (
                        <tr key={row.id}>
                          <td className="px-2 py-2 font-medium">{row.name}</td>
                          <td className="px-2 py-2 text-right">{fmt0(row.flow)}</td>
                          <td className="px-2 py-2 text-right">{fmt0(row.limit)}</td>
                          <td className="px-2 py-2 text-right">{fmt1(row.loading)}</td>
                          <td className="px-2 py-2 text-right">{fmt2(row.marginalValue)}</td>
                          <td className="px-2 py-2 text-right">
                            {row.timestamp ? formatTimeEt(row.timestamp) : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  message="No active constraints reported."
                  detail={errorMessage(constraintState, "real-time constraints")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emissions" className="space-y-6" forceMount>
          <PageHeader
            title="Emissions"
            description="System marginal emission rates aggregated with a median across nodes per interval."
            timestamp={emissionsState.latestTimestamp}
            cadence="5-min"
            isStale={emissionsState.isStale}
          />

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-xs text-muted-foreground">Pollutant</div>
            <Select value={pollutant} onValueChange={(value) => setPollutant(value as Pollutant)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="co2">CO2</SelectItem>
                <SelectItem value="nox">NOx</SelectItem>
                <SelectItem value="so2">SO2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Current" value={fmt2(emissionsLatest)} />
            <KpiCard label="Today min" value={fmt2(emissionsMinMax.min ?? NaN)} />
            <KpiCard label="Today max" value={fmt2(emissionsMinMax.max ?? NaN)} />
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold">Last 24 hours</h3>
              {emissionsSeries.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={emissionsSeries.map((point) => ({
                        label: formatTimeEt(point.timestamp),
                        value: point.value,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  message="Emissions data not available yet."
                  detail={errorMessage(emissionsState, "marginal emission rates")}
                />
              )}
            </CardContent>
          </Card>
          <Accordion type="single" collapsible>
            <AccordionItem value="definitions">
              <AccordionTrigger>Definitions & limitations</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  <li>
                    System series is the median of node-level marginal rates per interval for stability.
                  </li>
                  <li>Values are PJM preliminary and may be revised after validation.</li>
                  <li>Cadence: updates on the PJM five-minute publishing schedule.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
};
