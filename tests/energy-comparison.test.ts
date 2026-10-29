import { describe, expect, it } from "vitest";

import { computeEnergyComparison, computeEnergySummary } from "@/lib/energy-comparison";

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
    expect(summary.inputMMBtu).toBeCloseTo(120, 6);
    expect(summary.deliveredMMBtu).toBeCloseTo(108, 6);
    expect(summary.totalCost).toBeCloseTo(1440, 0);
  });

  it("converts known MCF gas use to equivalent No. 2 oil gallons on equal useful heat", () => {
    const result = computeEnergyComparison(
      {
        name: "Natural Gas Furnace",
        rate: "12",
        rateUnit: "mcf",
        efficiency: "90",
      },
      {
        name: "Fuel Oil Boiler",
        rate: "4",
        rateUnit: "oil_gallon",
        efficiency: "87",
      },
      "10",
      "mcf",
      "1.035",
    );

    expect(result.primary.inputMMBtu).toBeCloseTo(10.35, 6);
    expect(result.primary.deliveredMMBtu).toBeCloseTo(9.315, 6);
    expect(result.comparison.inputMMBtu).toBeCloseTo(10.7069, 4);
    expect(result.comparison.equivalentUsage).toBeCloseTo(77.306, 3);
    expect(result.comparison.totalCost).toBeCloseTo(309.22, 2);
  });

  it("treats heat-pump COP as output divided by electric input, not as percent efficiency", () => {
    const result = computeEnergyComparison(
      { name: "Natural Gas Furnace", rate: 12, rateUnit: "mcf", efficiency: 0.9 },
      { name: "Air-Source Heat Pump", rate: 0.15, rateUnit: "kwh", efficiency: 3 },
      100,
      "mcf",
      1.035,
    );
    expect(result.comparison.efficiency).toBe(3);
    expect(result.comparison.inputMMBtu).toBeCloseTo(result.primary.deliveredMMBtu / 3, 6);
  });

  it("supports propane gallons on the equal-useful-heat basis", () => {
    const result = computeEnergyComparison(
      { name: "Natural Gas Furnace", rate: 12, rateUnit: "mcf", efficiency: 0.9 },
      { name: "Propane Furnace", rate: 3, rateUnit: "propane_gallon", efficiency: 0.9 },
      1,
      "mcf",
      1.035,
    );
    expect(result.comparison.equivalentUsage).toBeCloseTo(1.035 / 0.091452, 6);
  });
});
