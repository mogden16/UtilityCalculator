import { describe, expect, it } from "vitest";

import { calculateChp, deriveSimpleChpInputs } from "@/lib/chp";

const baseline = {
  annualElectricKwh: 12_000_000,
  annualGasDth: 85_000,
  electricRatePerKwh: 0.12,
  gasRatePerDth: 11,
  peakDemandKw: 1_800,
  thermalBaseloadMmbtuPerHour: 8,
  hoursOfOperation: 7_000,
  electricalEfficiencyPercent: 37,
  thermalEfficiencyPercent: 45,
  heatUtilizationPercent: 80,
  baselineThermalEfficiencyPercent: 82,
  maintenancePerKwh: 0.018,
  demandRatePerKwMonth: 0,
  standbyChargesAnnual: 0,
  installedCostPerKw: 2_500,
  incentivePerKw: 0,
};

describe("calculateChp", () => {
  it("derives a useful thermal baseload from baseline fuel and equipment efficiency", () => {
    const result = deriveSimpleChpInputs({ buildingType: "hospital", annualElectricKwh: 12_000_000, annualGasDth: 85_000, baselineThermalEfficiencyPercent: 82 });
    expect(result.thermalBaseloadMmbtuPerHour).toBeCloseTo((85_000 * 0.82) / 8_500, 6);
  });
  it("credits only utilized recovered heat against boiler fuel", () => {
    const result = calculateChp(baseline);
    expect(result.utilizedRecoveredHeatMmbtu).toBeLessThan(result.availableRecoveredHeatMmbtu);
    expect(result.avoidedBoilerFuelDth).toBeCloseTo(
      result.utilizedRecoveredHeatMmbtu / 0.82,
      6,
    );
    expect(result.residualBoilerFuelDth).toBeCloseTo(85_000 - result.avoidedBoilerFuelDth, 6);
  });

  it("does not allow recovered heat to displace more useful heat than the baseline load", () => {
    const result = calculateChp({
      ...baseline,
      annualGasDth: 1_000,
      thermalBaseloadMmbtuPerHour: 100,
      heatUtilizationPercent: 100,
    });
    expect(result.utilizedRecoveredHeatMmbtu).toBeLessThanOrEqual(820);
    expect(result.avoidedBoilerFuelDth).toBeLessThanOrEqual(1_000);
    expect(result.residualBoilerFuelDth).toBeGreaterThanOrEqual(0);
  });

  it("includes maintenance, standby, demand charges, and explicit incentives", () => {
    const noExtras = calculateChp(baseline);
    const withExtras = calculateChp({
      ...baseline,
      demandRatePerKwMonth: 10,
      standbyChargesAnnual: 50_000,
      incentivePerKw: 200,
    });
    expect(withExtras.avoidedDemandCost).toBeGreaterThan(0);
    expect(withExtras.standbyCharges).toBe(50_000);
    expect(withExtras.netCapitalCost).toBeLessThan(noExtras.netCapitalCost);
  });
});
