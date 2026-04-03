import { describe, expect, it } from "vitest";

import {
  DEFAULT_T_AND_D_LOSS_FRACTION,
  computeFuelEmissionsRows,
  computeGasEmissionsForScenario,
  mapPjmFuelToFuelKey,
} from "@/lib/emissions";

describe("emissions helpers", () => {
  it("maps PJM fuel labels to internal fuel keys", () => {
    expect(mapPjmFuelToFuelKey("Natural Gas")).toBe("ngcc");
    expect(mapPjmFuelToFuelKey("NUCLEAR")).toBe("nuclear");
    expect(mapPjmFuelToFuelKey("Coal")).toBe("coal");
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
