import { describe, expect, it } from "vitest";

import { computeEnergySummary } from "@/lib/energy-comparison";

describe("computeEnergySummary", () => {
  it("normalizes gas rates to delivered cost", () => {
    const summary = computeEnergySummary(
      {
        name: "Gas Furnace",
        rate: "1.20",
        rateUnit: "therm",
        efficiency: "90",
      },
      "1200",
      "therm",
      "1.035",
    );

    expect(summary.ratePerMMBtu).toBeCloseTo(12, 6);
    expect(summary.deliveredMMBtu).toBeCloseTo(120, 6);
    expect(summary.inputMMBtu).toBeCloseTo(133.3333, 3);
    expect(summary.totalCost).toBeCloseTo(1600, 0);
  });
});
