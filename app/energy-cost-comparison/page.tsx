import type { Metadata } from "next";

import { EnergyCostComparisonTool } from "@/components/tools/energy-cost-comparison-tool";

export const metadata: Metadata = {
  title: "Customer Energy Comparison",
  description: "Normalize utility rates to delivered MMBtu and compare competing heating options.",
};

export default function EnergyCostComparisonPage() {
  return <EnergyCostComparisonTool />;
}
