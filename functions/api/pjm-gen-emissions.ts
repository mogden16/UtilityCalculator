interface FunctionEnv {
  PJM_API_KEY?: string;
  PJM_DATA_MINER_API_KEY?: string;
  PJM_DATAMINER_API_KEY?: string;
}

type PjmRecord = {
  datetime_beginning_utc?: string;
  datetime_ending_utc?: string;
  fuel_type?: string;
  mw?: number | string;
  MW?: number | string;
};

type FunctionContext = {
  env: FunctionEnv;
};

const PJM_GEN_BY_FUEL_URL = "https://api.pjm.com/api/v1/gen_by_fuel";

const EMISSION_FACTORS_LB_PER_MWH: Record<string, number> = {
  coal: 2250,
  ngcc: 900,
  ngsc: 1150,
  oil: 2000,
  nuclear: 0,
  wind: 0,
  solar: 0,
  hydro: 0,
  biomass: 0,
};

function mapPjmFuelToFuelKey(raw?: string) {
  if (!raw) return "biomass";
  const candidate = raw.trim().toLowerCase();

  if (candidate.includes("coal")) return "coal";
  if (candidate.includes("nuc")) return "nuclear";
  if (candidate.includes("wind")) return "wind";
  if (candidate.includes("solar")) return "solar";
  if (candidate.includes("hyd")) return "hydro";
  if (candidate.includes("oil") || candidate.includes("diesel") || candidate.includes("pet")) return "oil";
  if (candidate.includes("bio")) return "biomass";
  if (candidate.includes("gas") || candidate.includes("ng")) return "ngcc";

  return "biomass";
}

function prettyFuelLabel(fuelKey: string) {
  const labels: Record<string, string> = {
    coal: "Coal",
    ngcc: "Natural Gas (Combined Cycle)",
    ngsc: "Natural Gas (Simple Cycle)",
    oil: "Oil",
    nuclear: "Nuclear",
    wind: "Wind",
    solar: "Solar",
    hydro: "Hydro",
    biomass: "Biomass",
  };

  return labels[fuelKey] ?? fuelKey;
}

function getApiKey(env: FunctionEnv) {
  return env.PJM_API_KEY ?? env.PJM_DATA_MINER_API_KEY ?? env.PJM_DATAMINER_API_KEY ?? null;
}

function getUtcTimestamp(record: PjmRecord) {
  return record.datetime_beginning_utc ?? record.datetime_ending_utc ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function onRequestGet(context: FunctionContext) {
  try {
    const apiKey = getApiKey(context.env);

    if (!apiKey) {
      return json(
        {
          error:
            "Missing PJM API key on the server. Configure PJM_API_KEY, PJM_DATA_MINER_API_KEY, or PJM_DATAMINER_API_KEY in Cloudflare Pages.",
        },
        500,
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      return json({ error: errorText || `PJM request failed with status ${response.status}` }, response.status);
    }

    const payload = (await response.json()) as {
      items?: PjmRecord[];
      data?: PjmRecord[];
      results?: PjmRecord[];
      emissions?: PjmRecord[];
    };
    const records = payload.items ?? payload.data ?? payload.results ?? payload.emissions ?? [];

    if (!records.length) {
      return json({ error: "No data returned from PJM gen_by_fuel." }, 502);
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
      return json({ error: "Could not determine the latest timestamp from PJM data." }, 502);
    }

    const latestRecords = records.filter((record) => getUtcTimestamp(record) === latestUtc);

    if (!latestRecords.length) {
      return json({ error: "No records found for the latest PJM interval." }, 502);
    }

    const timestampIso = new Date(latestUtc.endsWith("Z") ? latestUtc : `${latestUtc}Z`).toISOString();
    const mwByFuel = new Map<string, number>();
    let totalMw = 0;

    for (const record of latestRecords) {
      const fuelKey = mapPjmFuelToFuelKey(record.fuel_type);
      const mw = Number(record.mw ?? record.MW ?? 0);
      if (!Number.isFinite(mw)) continue;
      totalMw += mw;
      mwByFuel.set(fuelKey, (mwByFuel.get(fuelKey) ?? 0) + mw);
    }

    if (totalMw <= 0) {
      return json({ error: "Total MW from PJM data is zero or invalid." }, 502);
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

    return json({
      carbonIntensity,
      carbonIntensityUnits: "lbs CO2e/MWh",
      gridMix,
      totalMw,
      timestamp: timestampIso,
      source: "PJM gen_by_fuel",
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reach PJM Data Miner. Please try again later.",
      },
      502,
    );
  }
}
