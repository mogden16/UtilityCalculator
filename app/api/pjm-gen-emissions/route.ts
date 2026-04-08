import { PJMDataMinerClient, type FuelCategory, type PJMGenByFuelRecord } from "@/lib/pjm-data-miner";

export const runtime = "edge";

const EMISSION_FACTORS: Record<FuelCategory, number> = {
  coal: 1000,
  oil: 800,
  gas: 400,
  nuclear: 15,
  hydro: 15,
  wind: 15,
  solar: 40,
  other: 500,
};

export type GridEmissionsResponse = {
  carbonIntensity_g_per_kwh: number | null;
  datetime: string | null;
  zone: "PJM";
  mix: Array<{
    fuel_type: string;
    category: FuelCategory;
    mw: number;
    percentage: number;
    factor_g_per_kwh: number;
  }>;
};

const CATEGORY_ORDER: FuelCategory[] = [
  "coal",
  "gas",
  "oil",
  "nuclear",
  "hydro",
  "wind",
  "solar",
  "other",
];

export async function GET(): Promise<Response> {
  const token = process.env.PJM_DATAMINER_API_KEY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const client = new PJMDataMinerClient({ token });
    const records = await client.getGenByFuelLatest(controller.signal);

    const categoryTotals = aggregateByCategory(records);
    const totalMw = Object.values(categoryTotals).reduce((sum, value) => sum + value, 0);

    const mix = CATEGORY_ORDER.map((category) => {
      const mw = categoryTotals[category] ?? 0;
      const percentage = totalMw > 0 ? (mw / totalMw) * 100 : 0;
      return {
        fuel_type: category,
        category,
        mw,
        percentage,
        factor_g_per_kwh: EMISSION_FACTORS[category],
      };
    }).filter((item) => item.mw > 0 || totalMw === 0);

    const carbonIntensity_g_per_kwh =
      totalMw > 0
        ? mix.reduce((sum, item) => sum + item.factor_g_per_kwh * (item.mw / totalMw), 0)
        : null;

    const datetime = mostRecentTimestamp(records);

    const payload: GridEmissionsResponse = {
      carbonIntensity_g_per_kwh,
      datetime,
      zone: "PJM",
      mix,
    };

    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const payload: GridEmissionsResponse = {
      carbonIntensity_g_per_kwh: null,
      datetime: null,
      zone: "PJM",
      mix: [],
    };

    const status = error instanceof Error && error.message.includes("status") ? 502 : 500;

    return new Response(JSON.stringify({ ...payload, error: toErrorMessage(error) }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function aggregateByCategory(records: PJMGenByFuelRecord[]): Record<FuelCategory, number> {
  const totals: Record<FuelCategory, number> = {
    coal: 0,
    gas: 0,
    oil: 0,
    nuclear: 0,
    hydro: 0,
    wind: 0,
    solar: 0,
    other: 0,
  };

  for (const record of records) {
    const category = categorizeFuel(record.fueltype);
    if (Number.isFinite(record.mw)) {
      totals[category] += record.mw;
    }
  }

  return totals;
}

function categorizeFuel(fueltype: string): FuelCategory {
  const normalized = fueltype.trim().toLowerCase();

  if (normalized.includes("coal")) return "coal";
  if (normalized.includes("gas")) return "gas";
  if (normalized.includes("oil") || normalized.includes("diesel") || normalized.includes("petroleum")) return "oil";
  if (normalized.includes("nuclear")) return "nuclear";
  if (normalized.includes("hydro") || normalized.includes("water")) return "hydro";
  if (normalized.includes("wind")) return "wind";
  if (normalized.includes("solar") || normalized.includes("pv") || normalized.includes("photovoltaic")) return "solar";
  return "other";
}

function mostRecentTimestamp(records: PJMGenByFuelRecord[]): string | null {
  const timestamps = records
    .map((record) => new Date(record.timestamp))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  const latest = timestamps.at(0);
  return latest ? latest.toISOString() : null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch (serializationError) {
    return String(serializationError);
  }
}
