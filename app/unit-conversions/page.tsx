import type { Metadata } from "next";

import { UnitConversionsTool } from "@/components/tools/unit-conversions-tool";

export const metadata: Metadata = {
  title: "Unit Conversions",
  description: "Convert common energy, power, temperature, flow, and pressure units in one place.",
};

export default function UnitConversionsPage() {
  return <UnitConversionsTool />;
}
