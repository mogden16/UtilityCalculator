import type { Metadata } from "next";

import { CHPGridEmissionsPanel } from "@/components/calculators/CHPGridEmissionsPanel";
import { ToolPageShell } from "@/components/tool-page-shell";

export const metadata: Metadata = {
  title: "Emissions & Grid Analysis",
  description: "Review live PJM grid emissions, generation mix, and compare delivered electricity with natural gas scenarios.",
};

export default function EmissionsPage() {
  return (
    <ToolPageShell
      eyebrow="Grid & emissions"
      title="Emissions & Grid Analysis"
      description="Compare heating options on equal delivered heat and clearly separate direct combustion, upstream assumptions, and grid-average emissions."
    >
      <CHPGridEmissionsPanel />
    </ToolPageShell>
  );
}
