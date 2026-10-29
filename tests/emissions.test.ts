import { describe, expect, it } from "vitest";

import {
  DEFAULT_T_AND_D_LOSS_FRACTION,
  computeFuelEmissionsRows,
  computeGasEmissionsForScenario,
  compareHeatingEmissions,
  mapPjmFuelToFuelKey,
} from "@/lib/emissions";

describe("emissions helpers", () => {
  it("maps PJM fuel labels to internal fuel keys", () => {
    expect(mapPjmFuelToFuelKey("Natural Gas")).toBe("ngcc");
    expect(mapPjmFuelToFuelKey("NUCLEAR")).toBe("nuclear");
    expect(mapPjmFuelToFuelKey("Coal")).toBe("coal");
    expect(mapPjmFuelToFuelKey("Other")).toBe("unknown");
  });

  it("does not silently assign zero emissions to an unknown fuel", () => {
    const summary = computeFuelEmissionsRows([{ fuelKey: "unknown", label: "Other", mw: 25 }]);
    expect(summary.isComplete).toBe(false);
    expect(summary.unknownMw).toBe(25);
    expect(summary.rows[0].emissionFactorLbPerMwh).toBeNaN();
  });

  it("compares heating options on equal delivered heat using efficiency and COP", () => {
    const result = compareHeatingEmissions({ deliveredHeatMmbtu: 100, gasEfficiency: 0.9, heatPumpCop: 3, gridLbCo2ePerMwh: 800 });
    expect(result.gasInputMmbtu).toBeCloseTo(111.111, 3);
    expect(result.electricInputKwh).toBeCloseTo(9_770, 0);
    expect(result.directGasLb).toBeGreaterThan(result.gridAverageLb);
  });

  it("computes weighted PJM emissions and delivered emissions", () => {
    const summary = computeFuelEmissionsRows([
      { fuelKey: "coal", label: "Coal", mw: 100 },
      { fuelKey: "ngcc", label: "Natural Gas", mw: 100 },
    ]);

    expect(summary.totalMw).toBe(200);
    expect(summary.totalGenerationLbPerMwh).toBe(1575);
    expect(summary.totalDeliveredLbPerMwh).toBeCloseTo(1575 / (1 - DEFAULT_T_AND_D_LOSS_FRACTION), 6);
  });

  it("adds methane leakage to direct gas combustion emissions", () => {
    const lowLeakage = computeGasEmissionsForScenario("low");
    const highLeakage = computeGasEmissionsForScenario("high");

    expect(lowLeakage.directCo2LbPerMmbtu).toBe(117);
    expect(highLeakage.totalCo2eLbPerMmbtu).toBeGreaterThan(lowLeakage.totalCo2eLbPerMmbtu);
    expect(highLeakage.totalCo2eLbPerKwh).toBeGreaterThan(lowLeakage.directCo2LbPerKwh);
  });
});
