import type { Metadata } from "next";

import { CHPGridEmissionsPanel } from "@/components/calculators/CHPGridEmissionsPanel";
import { ToolPageShell } from "@/components/tool-page-shell";

export const metadata: Metadata = {
  title: "Emissions",
  description: "Review live PJM grid emissions, generation mix, and compare delivered electricity with natural gas scenarios.",
};

export default function EmissionsPage() {
  return (
    <ToolPageShell
      eyebrow="Primary Tool"
      title="Emissions"
      description="Track live PJM generation mix, delivered grid carbon intensity, and compare electricity against onsite natural gas emissions assumptions."
    >
      <CHPGridEmissionsPanel />
    </ToolPageShell>
  );
}
