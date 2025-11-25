import { NextResponse } from "next/server";

const BASE_URL = "https://dataminer2.pjm.com/feed";
const FEED_NAME = "instantaneous_emissions";

const toCamelCase = (value: string): string =>
  value
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, chr: string) => (chr ? chr.toUpperCase() : ""))
    .replace(/^[A-Z]/, (match) => match.toLowerCase());

const extractRecords = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>;
  }

  if (payload && typeof payload === "object") {
    const values = Object.values(payload);
    const firstList = values.find((value) => Array.isArray(value)) as Array<Record<string, unknown>> | undefined;
    if (firstList) return firstList;
  }

  return [];
};

const normalizeRecord = (record: Record<string, unknown>) => {
  const camelCased = Object.entries(record).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[toCamelCase(key)] = value;
    return acc;
  }, {});

  const carbonIntensityRaw =
    camelCased.carbonIntensity ??
    camelCased.co2Intensity ??
    camelCased.co2LbsPerMwh ??
    camelCased.co2 ??
    camelCased.carbon ??
    camelCased.carbonIntensityLbsPerMwh;

  const gridMix =
    camelCased.gridMix ??
    camelCased.mix ??
    camelCased.fuelMix ??
    camelCased.fuels ??
    camelCased.sources ??
    camelCased.fuelType ??
    camelCased.fuel;

  const timestamp =
    camelCased.updatedAt ??
    camelCased.timestamp ??
    camelCased.datetimeBeginningUtc ??
    camelCased.datetimeBeginningEpt ??
    camelCased.publishDate ??
    camelCased.evaluationTime ??
    camelCased.time;

  const carbonIntensity = typeof carbonIntensityRaw === "number" ? carbonIntensityRaw : Number(carbonIntensityRaw);

  return {
    carbonIntensity: Number.isFinite(carbonIntensity) ? carbonIntensity : undefined,
    carbonIntensityUnits:
      camelCased.carbonIntensityUnits ??
      camelCased.carbonIntensityUnit ??
      camelCased.co2Units ??
      camelCased.units ??
      "lbs CO₂/MWh",
    gridMix,
    updatedAt: timestamp ? new Date(String(timestamp)).toISOString() : undefined,
  };
};

export async function GET() {
  try {
    const url = new URL(`${BASE_URL}/${FEED_NAME}`);
    url.searchParams.set("rowCount", "1");

    const upstream = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      // Cache for a minute to limit upstream requests while keeping data fresh.
      next: { revalidate: 60 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream PJM request failed with status ${upstream.status}` },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }

    const payload = await upstream.json();
    const records = extractRecords(payload);

    if (!records.length) {
      return NextResponse.json({ error: "No emissions data returned from PJM" }, { status: 502 });
    }

    const normalized = normalizeRecord(records[0]);

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Failed to fetch PJM emissions data", error);
    return NextResponse.json({ error: "Failed to load PJM emissions data" }, { status: 500 });
  }
}
