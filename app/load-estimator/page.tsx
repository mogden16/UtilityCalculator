import type { Metadata } from "next";

import { LoadEstimatorTool } from "@/components/tools/load-estimator-tool";

export const metadata: Metadata = {
  title: "Load Estimator",
  description: "Estimate heating and cooling loads using rule-of-thumb multipliers and visible assumptions.",
};

export default function LoadEstimatorPage() {
  return <LoadEstimatorTool />;
}
