import type { Metadata } from "next";

import { ConverterTool } from "@/components/tools/converter-tool";

export const metadata: Metadata = {
  title: "Load Converter",
  description: "Legacy URL for the unified load converter.",
  alternates: { canonical: "/load-converter" },
};

export default function GasFlowPage() {
  return <ConverterTool />;
}
