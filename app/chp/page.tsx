import type { Metadata } from "next";

import CHPCalculator from "@/components/calculators/CHPCalculator";

export const metadata: Metadata = {
  title: "CHP Feasibility",
  description: "Screen combined heat and power sizing, economics, and compare against live PJM generation emissions.",
};

export default function CHPPage() {
  return <CHPCalculator />;
}
