import type { Metadata } from "next";

import FeasibilityStudio from "@/components/feasibility/FeasibilityStudio";

export const metadata: Metadata = {
  title: "Feasibility Studio | UtilityCalc",
  description: "Local-first utility bill review, fuel-conversion engineering, financial analysis, and preliminary feasibility reporting.",
};

export default function FeasibilityStudioPage() {
  return <FeasibilityStudio />;
}
