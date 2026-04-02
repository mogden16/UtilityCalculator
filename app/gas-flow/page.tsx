import type { Metadata } from "next";

import { GasFlowTool } from "@/components/tools/gas-flow-tool";

export const metadata: Metadata = {
  title: "Gas Flow",
  description: "Translate thermal demand into CFH, MCFH, therm per hour, and Dth per hour for gas planning.",
};

export default function GasFlowPage() {
  return <GasFlowTool />;
}
