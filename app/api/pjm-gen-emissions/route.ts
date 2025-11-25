export const runtime = "edge";

export type FuelCategory =
  | "coal"
  | "gas"
  | "oil"
  | "nuclear"
  | "hydro"
  | "wind"
  | "solar"
  | "other";

export type GridMixEntry = {
  fuel_type: string;
  category: FuelCategory;
  mw: number;
  percentage: number;
  factor_g_per_kwh: number;
};

export type GridEmissionsResponse = {
  carbonIntensity_g_per_kwh: number | null;
  datetime: string | null;
  zone: string;
  mix: GridMixEntry[];
};

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

const CATEGORY_LABELS: Record<FuelCategory, string> = {
  coal: "Coal",
  gas: "Natural Gas",
  oil: "Oil",
  nuclear: "Nuclear",
  hydro: "Hydro",
  wind: "Wind",
  solar: "Solar",
  other: "Other",
};

const timestampKeys = [
  "datetime_beginning_utc",
  "datetime_beginning_ept",
  "timestamp",
  "datetime",
  "rundate",
];
const fuelKeys = ["fueltype", "fuel_type", "fuel", "primary_fuel"];
const mwKeys = ["mw", "value", "mw_value"];

const ROW_COUNT = "200";
const FEED_URL = "https://dataminer2.pjm.com/feed/gen_by_fuel";
const FETCH_TIMEOUT_MS = 15_000;

type ParsedRecord = {
  timestamp?: string;
  fuel?: string;
  mw?: number;
};

type AggregatedFuel = {
  category: FuelCategory;
  label: string;
  mw: number;
  factor: number;
};

function normalizeFuelCategory(rawFuel: string): AggregatedFuel {
  const cleaned = rawFuel.trim().toLowerCase();

  if (cleaned.includes("coal")) {
    return { category: "coal", label: CATEGORY_LABELS.coal, mw: 0, factor: EMISSION_FACTORS.coal };
  }
  if (cleaned.includes("gas") || cleaned.includes("combined cycle")) {
    return { category: "gas", label: CATEGORY_LABELS.gas, mw: 0, factor: EMISSION_FACTORS.gas };
  }
  if (cleaned.includes("oil")) {
    return { category: "oil", label: CATEGORY_LABELS.oil, mw: 0, factor: EMISSION_FACTORS.oil };
  }
  if (cleaned.includes("nuclear")) {
    return { category: "nuclear", label: CATEGORY_LABELS.nuclear, mw: 0, factor: EMISSION_FACTORS.nuclear };
  }
  if (cleaned.includes("hydro") || cleaned.includes("water")) {
    return { category: "hydro", label: CATEGORY_LABELS.hydro, mw: 0, factor: EMISSION_FACTORS.hydro };
  }
  if (cleaned.includes("wind")) {
    return { category: "wind", label: CATEGORY_LABELS.wind, mw: 0, factor: EMISSION_FACTORS.wind };
  }
  if (cleaned.includes("solar")) {
    return { category: "solar", label: CATEGORY_LABELS.solar, mw: 0, factor: EMISSION_FACTORS.solar };
  }

  return { category: "other", label: CATEGORY_LABELS.other, mw: 0, factor: EMISSION_FACTORS.other };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] ?? "";
    });
    records.push(record);
  }

  return records;
}

function extractRecords(data: Array<Record<string, any>>): ParsedRecord[] {
  return data.map((record) => {
    const entries = Object.entries(record).reduce<Record<string, any>>((acc, [key, value]) => {
      acc[key.toString().toLowerCase()] = value;
      return acc;
    }, {});

    const timestampKey = timestampKeys.find((key) => entries[key] !== undefined);
    const fuelKey = fuelKeys.find((key) => entries[key] !== undefined);
    const mwKey = mwKeys.find((key) => entries[key] !== undefined);

    const mwValue = mwKey ? Number(entries[mwKey]) : NaN;

    return {
      timestamp: timestampKey ? String(entries[timestampKey]) : undefined,
      fuel: fuelKey ? String(entries[fuelKey]) : undefined,
      mw: Number.isFinite(mwValue) ? mwValue : undefined,
    };
  });
}

function aggregateByFuel(records: ParsedRecord[]) {
  const totals = new Map<FuelCategory, AggregatedFuel>();
  let latestTimestamp: string | null = null;

  records.forEach(({ fuel, mw, timestamp }) => {
    if (!fuel || mw === undefined || Number.isNaN(mw)) return;

    const normalized = normalizeFuelCategory(fuel);
    const existing = totals.get(normalized.category) ?? {
      ...normalized,
      mw: 0,
      factor: normalized.factor,
    };

    existing.mw += mw;
    totals.set(normalized.category, existing);

    if (timestamp) {
      const ts = new Date(timestamp);
      if (!Number.isNaN(ts.valueOf())) {
        if (!latestTimestamp || ts > new Date(latestTimestamp)) {
          latestTimestamp = ts.toISOString();
        }
      }
    }
  });

  return { totals, latestTimestamp } as const;
}

function buildResponsePayload(totals: Map<FuelCategory, AggregatedFuel>, timestamp: string | null): GridEmissionsResponse {
  const mix: GridMixEntry[] = Array.from(totals.values()).map((entry) => ({
    fuel_type: entry.label,
    category: entry.category,
    mw: entry.mw,
    percentage: 0,
    factor_g_per_kwh: entry.factor,
  }));

  const totalMw = mix.reduce((sum, row) => sum + (Number.isFinite(row.mw) ? row.mw : 0), 0);

  mix.forEach((row) => {
    const share = totalMw > 0 ? row.mw / totalMw : 0;
    row.percentage = Math.round(share * 1000) / 10;
  });

  const carbonIntensity = mix.reduce((sum, row) => {
    const share = totalMw > 0 ? row.mw / totalMw : 0;
    return sum + share * row.factor_g_per_kwh;
  }, 0);

  return {
    carbonIntensity_g_per_kwh: totalMw > 0 ? Math.round(carbonIntensity * 10) / 10 : null,
    // Fallback to current time if the feed does not include a timestamp.
    datetime: timestamp ?? new Date().toISOString(),
    zone: "PJM",
    mix: mix.sort((a, b) => b.percentage - a.percentage),
  };
}

export async function GET(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = new URL(request.url);
    if (url.searchParams.has("test")) {
      return new Response(
        JSON.stringify({ ok: true, source: "pjm-gen-emissions-test" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const feedUrl = new URL(FEED_URL);
    feedUrl.searchParams.set("rowCount", ROW_COUNT);

    const response = await fetch(feedUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json,text/csv" },
      cache: "no-store",
    });

    if (!response.ok) {
      const preview = await response.text().catch(() => "<unavailable>");
      console.error("pjm-gen-emissions fetch failed", {
        status: response.status,
        statusText: response.statusText,
        preview: preview.slice(0, 500),
      });

      return new Response(
        JSON.stringify({ error: "Failed to fetch PJM gen_by_fuel", status: response.status }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const text = await response.text();

    let rawRecords: Array<Record<string, any>> = [];
    if (contentType.includes("json")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          rawRecords = parsed as Array<Record<string, any>>;
        } else if (parsed && typeof parsed === "object") {
          const listLike = Object.values(parsed).find((value) => Array.isArray(value));
          if (Array.isArray(listLike)) {
            rawRecords = listLike as Array<Record<string, any>>;
          }
        }
      } catch (err) {
        console.error("pjm-gen-emissions JSON parse failed", err);
      }
    }

    if (!rawRecords.length) {
      rawRecords = parseCsv(text);
    }

    const parsedRecords = extractRecords(rawRecords);
    const { totals, latestTimestamp } = aggregateByFuel(parsedRecords);
    const payload = buildResponsePayload(totals, latestTimestamp);

    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("pjm-gen-emissions route error", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch PJM gen_by_fuel", status: 502 }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
