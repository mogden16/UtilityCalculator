import { NextResponse } from "next/server";

export const runtime = "edge";

const PJM_EMISSIONS_URL = "https://api.pjm.com/api/v1/emissions-mix";

const parseCarbonIntensity = (record: any) => {
  const rawIntensity =
    record?.carbonIntensity ??
    record?.co2_lbs_per_mwh ??
    record?.co2e_lbs_per_mwh ??
    record?.co2_lbs_mwh ??
    record?.co2e_lbs_mwh ??
    record?.co2 ??
    record?.intensity;

  const intensity = rawIntensity !== undefined ? Number(rawIntensity) : null;

  return Number.isFinite(intensity) ? intensity : null;
};

const parseTimestamp = (record: any) =>
  record?.timestamp ??
  record?.datetime_beginning_ept ??
  record?.datetime_beginning_utc ??
  record?.datetime_ending_ept ??
  record?.datetime ??
  record?.time ??
  null;

const parseGridMix = (record: any) => {
  const mixSources =
    record?.fuel_mix ??
    record?.mix ??
    record?.fuel ??
    record?.sources ??
    record?.gridMix ??
    record?.emissions ??
    [];

  if (!Array.isArray(mixSources)) return [];

  return mixSources
    .map((entry: any, index: number) => {
      const label =
        entry?.fuel ?? entry?.fuel_type ?? entry?.fuelType ?? entry?.type ?? entry?.name ?? `Source ${index + 1}`;
      const value = Number(
        entry?.percentage ??
          entry?.percent ??
          entry?.value ??
          entry?.share ??
          entry?.mix ??
          entry?.megawatts ??
          entry?.mw ??
          0
      );

      return { label, value };
    })
    .filter((entry) => Number.isFinite(entry.value));
};

const coerceRecords = (payload: any) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.emissions)) return payload.emissions;
  return [];
};

export async function GET() {
  try {
    const apiKey = process.env.PJM_API_KEY ?? process.env.PJM_DATA_MINER_API_KEY;

    const response = await fetch(PJM_EMISSIONS_URL, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { "Ocp-Apim-Subscription-Key": apiKey } : {}),
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = errorText || `Request failed with status ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const payload = await response.json();
    const records = coerceRecords(payload);
    const latest = records[0] ?? payload;

    const carbonIntensity = parseCarbonIntensity(latest);
    const gridMix = parseGridMix(latest);
    const timestamp = parseTimestamp(latest);

    return NextResponse.json({
      carbonIntensity,
      carbonIntensityUnits: "lbs/MWh",
      gridMix,
      timestamp,
      source: "PJM Data Miner",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach PJM Data Miner. Please try again later.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
