import { NextResponse } from "next/server";

export const runtime = "edge";

const FEED_ENDPOINTS: Record<string, string> = {
  instantaneous_load: "https://api.pjm.com/api/v1/instantaneous_load",
  five_min_load_forecast: "https://api.pjm.com/api/v1/five_min_load_forecast",
  rt_lmp_unverified: "https://api.pjm.com/api/v1/rt_lmp_unverified",
  gen_by_fuel: "https://api.pjm.com/api/v1/gen_by_fuel",
  rt_constraints: "https://api.pjm.com/api/v1/rt_constraints",
  transmission_limits: "https://api.pjm.com/api/v1/transmission_limits",
  marginal_emission_rates: "https://api.pjm.com/api/v1/marginal_emission_rates",
};

const resolveLatestTimestamp = (items: Record<string, unknown>[]) => {
  const timestampFields = [
    "datetime_beginning_utc",
    "datetime_ending_utc",
    "datetime_beginning_ept",
    "datetime_ending_ept",
    "datetime_beginning",
    "datetime_ending",
    "interval_start",
    "interval_end",
    "timestamp",
    "market_datetime",
    "market_date",
  ];
  let latest: Date | null = null;
  for (const item of items) {
    for (const field of timestampFields) {
      const value = item[field];
      if (typeof value !== "string") continue;
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) continue;
      if (!latest || date > latest) {
        latest = date;
      }
    }
  }
  return latest ? latest.toISOString() : null;
};

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const feed = searchParams.get("feed") ?? "";
  const endpoint = FEED_ENDPOINTS[feed];

  if (!endpoint) {
    return NextResponse.json(
      { error: `Feed '${feed}' is not configured` },
      { status: 400 }
    );
  }

  const forwardedParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key === "feed") return;
    forwardedParams.append(key, value);
  });

  try {
    const response = await fetch(
      `${endpoint}?${forwardedParams.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Ocp-Apim-Subscription-Key": apiKey,
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const message = errorText || `Request failed with status ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const payload = await response.json();
    const items: Record<string, unknown>[] =
      payload?.items ?? payload?.data ?? payload?.results ?? payload ?? [];

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Unexpected PJM response shape" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      feed,
      items,
      latestTimestamp: resolveLatestTimestamp(items),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to reach PJM Data Miner. Please try again later.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
