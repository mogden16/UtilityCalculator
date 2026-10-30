import type { Metadata } from "next";

import { GasEquipmentSizingTool } from "@/components/tools/gas-equipment-sizing-tool";

export const metadata: Metadata = {
  title: "Gas Service, Meter & Regulator Sizing",
  description: "Preliminary source-table lookup for gas service capacity, meter selection, and industrial regulator arrangements.",
};

export default function GasEquipmentSizingPage() {
  return <GasEquipmentSizingTool />;
}
