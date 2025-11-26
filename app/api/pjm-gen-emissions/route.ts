import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PJM_GEN_BY_FUEL_URL = "https://api.pjm.com/api/v1/gen_by_fuel";

// Simple emission factors in lbs CO2 per MWh by fuel type.
// These are approximate and you can tune them.
const EMISSION_FACTORS_LBS_PER_MWH: Record<string, number> = {
  COAL: 2249,
  "COAL SYN": 2249,
  NG: 978,
  GAS: 978,
  OIL: 1672,
  DIESEL: 1672,
  PETROLEUM: 1672,
  NUCLEAR: 0,
  NUC: 0,
  HYDRO: 0,
  HYD: 0,
  SOLAR: 0,
  WIND: 0,
  OTHER: 0,
};

function normalizeFuelType(raw: string | undefined): string {
  if (!raw) return "OTHER";
  const f = raw.toUpperCase().trim();
  if (f.includes("COAL")) return "COAL";
  if (f.includes("NUC")) return "NUCLEAR";
  if (f.includes("NG") || f.includes("GAS")) return "NG";
  if (f.includes("OIL") || f.includes("DIESEL") || f.includes("PET")) return "OIL";
  if (f.includes("HYD")) return "HYDRO";
  if (f.includes("SOLAR")) return "SOLAR";
  if (f.includes("WIND")) return "WIND";
  return "OTHER";
}

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

    // Ask PJM for the latest few records, sorted descending by time.
    const params = new URLSearchParams({
      fields: "datetime_beginning_utc,fuel_type,is_renewable,mw",
      sort: "datetime_beginning_utc",
      order: "Desc",
      rowCount: "200",
    });

    const response = await fetch(`${PJM_GEN_BY_FUEL_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      next: { revalidate: 60 }, // ok to cache for a minute
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = errorText || `Request failed with status ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const payload = await response.json();

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

    // Determine the latest timestamp we have
    const getTs = (r: any) =>
      r.datetime_beginning_utc ??
      r.datetime_beginning_ept ??
      r.datetime_ending_utc ??
      r.datetime_ending_ept ??
      null;

    let latestTs: string | null = null;
    for (const r of records) {
      const ts = getTs(r);
      if (!ts) continue;
      if (!latestTs || new Date(ts) > new Date(latestTs)) {
        latestTs = ts;
      }
    }

    if (!latestTs) {
      return NextResponse.json(
        { error: "Could not determine latest timestamp from PJM data" },
        { status: 502 }
      );
    }

    // Keep only records for the latest timestamp
    const latestRecords = records.filter((r) => getTs(r) === latestTs);

    if (!latestRecords.length) {
      return NextResponse.json(
        { error: "No records found for latest timestamp" },
        { status: 502 }
      );
    }

    // Aggregate MW by fuel type
    const mwByFuel = new Map<string, number>();
    let totalMw = 0;

    for (const r of latestRecords) {
      const rawFuel = r.fuel_type as string | undefined;
      const fuel = normalizeFuelType(rawFuel);
      const mw = Number(r.mw ?? r.MW ?? 0);
      if (!Number.isFinite(mw)) continue;

      totalMw += mw;
      mwByFuel.set(fuel, (mwByFuel.get(fuel) ?? 0) + mw);
    }

    // Build grid mix as percentages
    const gridMix = Array.from(mwByFuel.entries()).map(([fuel, mw]) => ({
      label: fuel,
      value: totalMw > 0 ? (mw / totalMw) * 100 : 0,
    }));

    // Compute carbon intensity as weighted average of factors
    let weightedSum = 0;
    for (const [fuel, mw] of mwByFuel.entries()) {
      const factor =
        EMISSION_FACTORS_LBS_PER_MWH[fuel] ??
        EMISSION_FACTORS_LBS_PER_MWH["OTHER"];
      weightedSum += factor * mw;
    }

    const carbonIntensity =
      totalMw > 0 ? weightedSum / totalMw : null;

    return NextResponse.json({
      carbonIntensity,
      carbonIntensityUnits: "lbs/MWh",
      gridMix,
      timestamp: latestTs,
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