import { NextRequest, NextResponse } from "next/server";

const ELECTRICITYMAPS_BASE_URL = "https://api.electricitymaps.com/v3";
const DEFAULT_WINDOW = "30d";

export const revalidate = 1800;

export async function GET(request: NextRequest) {
  const token = process.env.ELECTRICITYMAPS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "ELECTRICITYMAPS_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const zoneParam = request.nextUrl.searchParams.get("zone")?.trim().toUpperCase();
  if (!zoneParam) {
    return NextResponse.json({ error: "Missing zone query parameter" }, { status: 400 });
  }

  const url = new URL(`${ELECTRICITYMAPS_BASE_URL}/carbon-intensity/history`);
  url.searchParams.set("zone", zoneParam);
  url.searchParams.set("past", DEFAULT_WINDOW);

  try {
    const response = await fetch(url, {
      headers: {
        "auth-token": token,
      },
      next: { revalidate },
    });

    if (!response.ok) {
      let message = `ElectricityMaps request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.error === "string" && errorBody.error.trim()) {
          message = errorBody.error;
        }
      } catch (error) {
        // Ignore JSON parsing errors and fall back to default message
      }
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const payload = await response.json();
    const history: unknown[] = Array.isArray(payload?.history) ? payload.history : [];
    const values = history
      .map((entry) => {
        if (entry && typeof entry === "object" && "carbonIntensity" in entry) {
          const value = Number((entry as { carbonIntensity: unknown }).carbonIntensity);
          return Number.isFinite(value) ? value : null;
        }
        return null;
      })
      .filter((value): value is number => value != null);

    if (values.length === 0) {
      return NextResponse.json(
        { error: "No carbon intensity data returned for the requested zone" },
        { status: 502 },
      );
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    const average = sum / values.length;

    return NextResponse.json({
      zone: zoneParam,
      carbonIntensity: average,
      unit: "gCO2eq/kWh",
      window: DEFAULT_WINDOW,
      sampleCount: values.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reach ElectricityMaps" },
      { status: 500 },
    );
  }
}
