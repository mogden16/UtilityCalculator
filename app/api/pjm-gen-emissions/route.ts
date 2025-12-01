import { NextResponse } from "next/server";
import {
  EMISSION_FACTORS_LB_PER_MWH,
  FuelKey,
  mapPjmFuelToFuelKey,
  prettyFuelLabel,
} from "@/lib/emissions";

export const runtime = "edge";

const PJM_GEN_BY_FUEL_URL = "https://api.pjm.com/api/v1/gen_by_fuel";

export async function GET() {
  try {
    const apiKey =
      process.env.PJM_API_KEY ??
      process.env.PJM_DATA_MINER_API_KEY ??
      process.env.PJM_DATAMINER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing PJM API key on server" },
        { status: 500 }
      );
    }

    // Ask PJM for the most recent records, sorted by time descending.
    const params = new URLSearchParams({
      fields: "datetime_beginning_utc,fuel_type,is_renewable,mw",
      sort: "datetime_beginning_utc",
      order: "Desc",
      startRow: "1",
      rowCount: "200", // a few hours of data max
    });

    const response = await fetch(`${PJM_GEN_BY_FUEL_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      // Edge runtime understands this
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message =
        errorText || `Request failed with status ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const payload = await response.json();

    // DataMiner JSON uses "items" like in PJM’s examples and the gridstatus library
    const records: any[] =
      payload?.items ??
      payload?.data ??
      payload?.results ??
      payload?.emissions ??
      [];

    if (!records.length) {
      return NextResponse.json(
        { error: "No data returned from PJM gen_by_fuel" },
        { status: 502 }
      );
    }

    const getUtcTs = (r: any) =>
      r.datetime_beginning_utc ??
      r.datetime_ending_utc ??
      null;

    // Find the most recent timestamp (not in the future) using UTC
    const nowUtc = new Date();
    let latestUtc: string | null = null;
    for (const r of records) {
      const tsUtc = getUtcTs(r);
      if (!tsUtc) continue;
      const tsUtcDate = new Date(tsUtc);
      if (tsUtcDate > nowUtc) continue;
      if (!latestUtc || tsUtcDate > new Date(latestUtc)) {
        latestUtc = tsUtc;
      }
    }

    if (!latestUtc) {
      return NextResponse.json(
        { error: "Could not determine latest timestamp from PJM data" },
        { status: 502 }
      );
    }

    // Keep only records for that latest timestamp
    const latestRecords = records.filter((r) => getUtcTs(r) === latestUtc);

    if (!latestRecords.length) {
      return NextResponse.json(
        { error: "No records found for latest timestamp" },
        { status: 502 }
      );
    }

    const latestTsUtc = getUtcTs(latestRecords[0]);

    if (!latestTsUtc) {
      return NextResponse.json(
        { error: "Could not determine UTC timestamp for latest records" },
        { status: 502 }
      );
    }

    const latestUtcDate = latestTsUtc
      ? new Date(latestTsUtc.endsWith("Z") ? latestTsUtc : latestTsUtc + "Z")
      : null;

    const timestampIso = latestUtcDate ? latestUtcDate.toISOString() : null;

    // Aggregate MW by normalized fuel type
    const mwByFuel = new Map<FuelKey, number>();
    let totalMw = 0;

    for (const r of latestRecords) {
      const fuel = mapPjmFuelToFuelKey(r.fuel_type as string | undefined);
      const mw = Number(r.mw ?? r.MW ?? 0);
      if (!Number.isFinite(mw)) continue;

      totalMw += mw;
      mwByFuel.set(fuel, (mwByFuel.get(fuel) ?? 0) + mw);
    }

    if (totalMw <= 0) {
      return NextResponse.json(
        { error: "Total MW is zero or invalid in PJM data" },
        { status: 502 }
      );
    }

    // Build grid mix as % of total MW
    const gridMix = Array.from(mwByFuel.entries()).map(([fuel, mw]) => ({
      label: prettyFuelLabel(fuel),
      value: (mw / totalMw) * 100,
      mw,
    }));

    // Compute weighted-average carbon intensity
    let weightedSum = 0;
    for (const [fuel, mw] of mwByFuel.entries()) {
      const factor = EMISSION_FACTORS_LB_PER_MWH[fuel] ?? 0;
      weightedSum += factor * mw;
    }

    const carbonIntensity = weightedSum / totalMw;

    return NextResponse.json({
      carbonIntensity,
      carbonIntensityUnits: "lbs/MWh",
      gridMix,
      totalMw,
      timestamp: timestampIso,
      source: "PJM gen_by_fuel",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to reach PJM Data Miner. Please try again later.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
