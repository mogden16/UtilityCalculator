import { NextResponse } from "next/server";

export const runtime = "edge";

const ZONE_ID = "US-MIDA-PJM";
const CARBON_INTENSITY_URL = `https://api.electricitymaps.com/v3/carbon-intensity/latest?zone=${ZONE_ID}`;
const ELECTRICITY_MIX_URL = `https://api.electricitymaps.com/v3/electricity-mix/latest?zone=${ZONE_ID}`;

type MixEntry = { source: string; percentage: number };

type ElectricityMapsMixValue = number | { value?: number; percentage?: number } | null;

function normalizeMix(raw: unknown): MixEntry[] {
  const mixData: unknown =
    typeof raw === "object" && raw !== null && "mix" in raw ? (raw as Record<string, unknown>).mix : raw;

  const entries: { source: string; value: number }[] = [];

  if (Array.isArray(mixData)) {
    for (const item of mixData) {
      const source =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>).source ?? (item as Record<string, unknown>).fuel ??
            (item as Record<string, unknown>).type
          : null;
      const value =
        typeof item === "object" && item !== null
          ? (item as Record<string, ElectricityMapsMixValue>).value ??
            (item as Record<string, ElectricityMapsMixValue>).percentage
          : null;
      if (typeof source === "string" && typeof value === "number" && Number.isFinite(value)) {
        entries.push({ source, value: value });
      }
    }
  } else if (mixData && typeof mixData === "object") {
    for (const [source, value] of Object.entries(mixData as Record<string, ElectricityMapsMixValue>)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        entries.push({ source, value });
      } else if (value && typeof value === "object") {
        const numericValue = (value as { value?: number }).value ?? (value as { percentage?: number }).percentage;
        if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
          entries.push({ source, value: numericValue });
        }
      }
    }
  }

  const total = entries.reduce((sum, item) => sum + (Number.isFinite(item.value) ? Math.max(item.value, 0) : 0), 0);

  const percentages = entries.map(({ source, value }) => {
    const pct = total > 0 ? (Math.max(value, 0) / total) * 100 : Number.isFinite(value) ? value : 0;
    return { source, percentage: Math.round(pct * 10) / 10 };
  });

  return percentages.sort((a, b) => b.percentage - a.percentage);
}

export async function GET() {
  try {
    const token = process.env.ELECTRICITYMAPS_API_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "Missing ELECTRICITYMAPS_API_TOKEN" }, { status: 500 });
    }

    const headers = { "auth-token": token };

    const [carbonRes, mixRes] = await Promise.all([
      fetch(CARBON_INTENSITY_URL, { headers }),
      fetch(ELECTRICITY_MIX_URL, { headers }),
    ]);

    if (!carbonRes.ok || !mixRes.ok) {
      console.error("Failed to fetch Electricity Maps data", {
        carbonStatus: carbonRes.status,
        mixStatus: mixRes.status,
      });
      return NextResponse.json(
        {
          error: "Failed to fetch from Electricity Maps",
          status: !carbonRes.ok ? carbonRes.status : mixRes.status,
        },
        { status: 502 },
      );
    }

    const [carbonJson, mixJson] = await Promise.all([carbonRes.json(), mixRes.json()]);

    const carbonIntensity =
      typeof carbonJson?.carbonIntensity === "number" && Number.isFinite(carbonJson.carbonIntensity)
        ? carbonJson.carbonIntensity
        : null;
    const datetime =
      typeof carbonJson?.datetime === "string"
        ? carbonJson.datetime
        : typeof carbonJson?.updatedAt === "string"
          ? carbonJson.updatedAt
          : null;
    const zone = typeof carbonJson?.zone === "string" ? carbonJson.zone : null;

    const mix = normalizeMix(mixJson);

    return NextResponse.json({
      carbonIntensity_g_per_kwh: carbonIntensity,
      datetime,
      zone,
      mix,
    });
  } catch (error) {
    console.error("Failed to fetch grid emissions data", error);
    return NextResponse.json({ error: "Failed to fetch grid emissions data" }, { status: 500 });
  }
}
