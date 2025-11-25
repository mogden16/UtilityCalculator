import { NextResponse } from "next/server";

export const runtime = "edge";

const SAMPLE_RESPONSE = {
  carbonIntensity: 0,
  carbonIntensityUnits: "lbs CO₂/MWh",
  gridMix: [],
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json(SAMPLE_RESPONSE);
}
