import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PJM_GEN_BY_FUEL_URL = "https://api.pjm.com/api/v1/gen_by_fuel";

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

    const response = await fetch(PJM_GEN_BY_FUEL_URL, {
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      next: { revalidate: 0 },
    });

    const text = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      // first 2000 chars so it doesn’t explode the page
      raw: text.slice(0, 2000),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}