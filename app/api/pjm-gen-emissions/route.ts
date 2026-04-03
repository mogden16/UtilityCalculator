import { NextResponse } from "next/server";

import {
  EMISSION_FACTORS_LB_PER_MWH,
  type FuelKey,
  mapPjmFuelToFuelKey,
  prettyFuelLabel,
} from "@/lib/emissions";

const PJM_GEN_BY_FUEL_URL = "https://api.pjm.com/api/v1/gen_by_fuel";

type PjmRecord = {
  datetime_beginning_utc?: string;
  datetime_ending_utc?: string;
  fuel_type?: string;
  mw?: number | string;
  MW?: number | string;
};

type PjmPayload = {
  items?: PjmRecord[];
  data?: PjmRecord[];
  results?: PjmRecord[];
  emissions?: PjmRecord[];
};

function readApiKey() {
  return (
    process.env.PJM_API_KEY ??
    process.env.PJM_DATA_MINER_API_KEY ??
    process.env.PJM_DATAMINER_API_KEY ??
    null
  );
}

function getUtcTimestamp(record: PjmRecord) {
  return record.datetime_beginning_utc ?? record.datetime_ending_utc ?? null;
}

export async function GET() {
  try {
    const apiKey = readApiKey();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing PJM API key on the server. Configure PJM_API_KEY, PJM_DATA_MINER_API_KEY, or PJM_DATAMINER_API_KEY in Cloudflare.",
        },
        { status: 500 },
      );
    }

    const params = new URLSearchParams({
      fields: "datetime_beginning_utc,fuel_type,is_renewable,mw",
      sort: "datetime_beginning_utc",
      order: "Desc",
      startRow: "1",
      rowCount: "200",
    });

    const response = await fetch(`${PJM_GEN_BY_FUEL_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || `PJM request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as PjmPayload;
    const records = payload.items ?? payload.data ?? payload.results ?? payload.emissions ?? [];

    if (!records.length) {
      return NextResponse.json({ error: "No data returned from PJM gen_by_fuel." }, { status: 502 });
    }

    const now = new Date();
    let latestUtc: string | null = null;

    for (const record of records) {
      const timestamp = getUtcTimestamp(record);
      if (!timestamp) continue;
      const parsed = new Date(timestamp);
      if (Number.isNaN(parsed.getTime()) || parsed > now) continue;
      if (!latestUtc || parsed > new Date(latestUtc)) {
        latestUtc = timestamp;
      }
    }

    if (!latestUtc) {
      return NextResponse.json(
        { error: "Could not determine the latest timestamp from PJM data." },
        { status: 502 },
      );
    }

    const latestRecords = records.filter((record) => getUtcTimestamp(record) === latestUtc);

    if (!latestRecords.length) {
      return NextResponse.json({ error: "No records found for the latest PJM interval." }, { status: 502 });
    }

    const timestampIso = new Date(latestUtc.endsWith("Z") ? latestUtc : `${latestUtc}Z`).toISOString();
    const mwByFuel = new Map<FuelKey, number>();
    let totalMw = 0;

    for (const record of latestRecords) {
      const fuelKey = mapPjmFuelToFuelKey(record.fuel_type);
      const mw = Number(record.mw ?? record.MW ?? 0);
      if (!Number.isFinite(mw)) continue;
      totalMw += mw;
      mwByFuel.set(fuelKey, (mwByFuel.get(fuelKey) ?? 0) + mw);
    }

    if (totalMw <= 0) {
      return NextResponse.json({ error: "Total MW from PJM data is zero or invalid." }, { status: 502 });
    }

    const gridMix = Array.from(mwByFuel.entries()).map(([fuelKey, mw]) => ({
      label: prettyFuelLabel(fuelKey),
      value: (mw / totalMw) * 100,
      mw,
    }));

    const carbonIntensity =
      Array.from(mwByFuel.entries()).reduce((sum, [fuelKey, mw]) => {
        return sum + (EMISSION_FACTORS_LB_PER_MWH[fuelKey] ?? 0) * mw;
      }, 0) / totalMw;

    return NextResponse.json(
      {
        carbonIntensity,
        carbonIntensityUnits: "lbs CO2e/MWh",
        gridMix,
        totalMw,
        timestamp: timestampIso,
        source: "PJM gen_by_fuel",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reach PJM Data Miner. Please try again later.",
      },
      { status: 502 },
    );
  }
}
