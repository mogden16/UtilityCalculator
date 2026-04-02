import type { Metadata } from "next";

import { ConverterTool } from "@/components/tools/converter-tool";

export const metadata: Metadata = {
  title: "Load Converter",
  description: "Convert input fuel, delivered output, and operating totals across common thermal demand units.",
};

export default function LoadConverterPage() {
  return <ConverterTool />;
}
