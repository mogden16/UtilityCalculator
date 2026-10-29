"use client";

import { Check, Copy, Printer, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CalculationActions({
  copyText,
  onReset,
  compact = false,
}: {
  copyText: string;
  onReset: () => void;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <div className="no-print flex flex-wrap gap-2" aria-label="Calculation actions">
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={() => void copy()}>
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy result"}
      </Button>
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={onReset}>
        <RotateCcw /> Reset
      </Button>
      <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={() => window.print()}>
        <Printer /> Print summary
      </Button>
    </div>
  );
}
