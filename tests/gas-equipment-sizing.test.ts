import { describe, expect, it } from "vitest";

import {
  convertDemandToCfh,
  lookupMeters,
  lookupConnectionGuideline,
  lookupMixedPlasticService,
  lookupRegulators,
  lookupServiceCapacity,
} from "@/lib/gas-equipment-sizing";

describe("gas equipment sizing source cases", () => {
  it("Test A: sizes a new low-pressure plastic service", () => {
    const result = lookupServiceCapacity({
      requiredCfh: 310,
      lengthFt: 60,
      pressureClass: "low",
      material: "plastic",
      status: "new",
    });

    expect(result.status).toBe("qualified");
    expect(result.size?.label).toBe('1 1/4" IPS');
    expect(result.capacityCfh).toBe(452);
  });

  it("Test B: sizes an existing low-pressure plastic service", () => {
    const result = lookupServiceCapacity({
      requiredCfh: 310,
      lengthFt: 60,
      pressureClass: "low",
      material: "plastic",
      status: "existing",
    });

    expect(result.status).toBe("qualified");
    expect(result.size?.label).toBe('1 1/4" CTS');
    expect(result.capacityCfh).toBe(410);
  });

  it("Test C: returns the source mixed-service allowance", () => {
    const result = lookupMixedPlasticService({ requiredCfh: 250, lengthFt: 60 });

    expect(result.status).toBe("qualified");
    if (result.status !== "qualified") throw new Error("Expected a mixed-service result");
    expect(result.oneInchCtsFt).toBe(47);
    expect(result.oneAndQuarterInchIpsFt).toBe(13);
  });

  it("Test D: preserves the 45-degree 4-inch turbine limits", () => {
    const result = lookupMeters({
      peakFlowCfh: 18_000,
      minimumOperatingFlowCfh: 1_200,
      deliveryPressureValue: 4.5,
      deliveryPressureUnit: "inWC",
      families: ["turbine"],
      rotorAngles: [45],
    });

    expect(result.status).toBe("results");
    expect(result.groups[0]?.smallest.nominalSize).toBe('4"');
    expect(result.groups[0]?.smallest.minimumFlowCfh).toBe(1_200);
    expect(result.groups[0]?.smallest.maximumFlowCfh).toBe(18_000);
  });
});

describe("service table boundaries", () => {
  it("uses an exact listed length without rounding", () => {
    const result = lookupServiceCapacity({
      requiredCfh: 452,
      lengthFt: 60,
      pressureClass: "low",
      material: "plastic",
      status: "new",
    });
    expect(result.roundedLengthUp).toBe(false);
    expect(result.size?.label).toBe('1 1/4" IPS');
    expect(result.utilizationPercent).toBe(100);
  });

  it("rounds an intermediate length up to the next source row", () => {
    const result = lookupServiceCapacity({
      requiredCfh: 300,
      lengthFt: 61,
      pressureClass: "low",
      material: "plastic",
      status: "new",
    });
    expect(result.tabulatedLengthFt).toBe(65);
    expect(result.roundedLengthUp).toBe(true);
  });

  it("does not extrapolate below or above the table", () => {
    expect(lookupServiceCapacity({ requiredCfh: 100, lengthFt: 4, pressureClass: "low", material: "plastic", status: "new" }).status).toBe("out-of-table");
    expect(lookupServiceCapacity({ requiredCfh: 100, lengthFt: 101, pressureClass: "low", material: "plastic", status: "new" }).status).toBe("out-of-table");
  });

  it("checks a selected existing service without upsizing it", () => {
    const result = lookupServiceCapacity({
      requiredCfh: 310,
      lengthFt: 60,
      pressureClass: "low",
      material: "plastic",
      status: "new",
      mode: "check-existing",
      selectedSizeId: "1-1-4-inch-cts",
    });
    expect(result.status).toBe("not-qualified");
    expect(result.capacityCfh).toBe(279);
    expect(result.remainingCapacityCfh).toBe(-31);
  });
});

describe("meter screening", () => {
  it("accepts an equivalent pressure unit without interpolating", () => {
    const result = lookupMeters({
      peakFlowCfh: 18_000,
      minimumOperatingFlowCfh: 1_200,
      deliveryPressureValue: 4.5 / 27.68,
      deliveryPressureUnit: "psig",
      families: ["turbine"],
      rotorAngles: [45],
    });
    expect(result.status).toBe("results");
    expect(result.groups[0]?.smallest.maximumFlowCfh).toBe(18_000);
  });

  it("returns out-of-table for a pressure between source rows", () => {
    const result = lookupMeters({
      peakFlowCfh: 1_000,
      minimumOperatingFlowCfh: 100,
      deliveryPressureValue: 8.5,
      deliveryPressureUnit: "inWC",
      families: ["rotary", "turbine"],
    });
    expect(result.status).toBe("out-of-table");
  });

  it("marks missing minimum load as incomplete screening", () => {
    const result = lookupMeters({
      peakFlowCfh: 10_000,
      deliveryPressureValue: 4.5,
      deliveryPressureUnit: "inWC",
      families: ["turbine"],
      rotorAngles: [45],
    });
    expect(result.status).toBe("results");
    expect(result.groups[0]?.smallest.screeningStatus).toBe("incomplete");
  });

  it("keeps diaphragm screening incomplete when the source has no minimum limit", () => {
    const result = lookupMeters({
      peakFlowCfh: 170,
      minimumOperatingFlowCfh: 10,
      deliveryPressureValue: 4.5,
      deliveryPressureUnit: "inWC",
      families: ["diaphragm"],
    });
    expect(result.status).toBe("results");
    expect(result.groups[0]?.smallest.screeningStatus).toBe("incomplete");
  });

  it("rejects a turbine whose minimum flow exceeds the customer minimum", () => {
    const result = lookupMeters({
      peakFlowCfh: 18_000,
      minimumOperatingFlowCfh: 1_199,
      deliveryPressureValue: 4.5,
      deliveryPressureUnit: "inWC",
      families: ["turbine"],
      rotorAngles: [45],
    });
    expect(result.status).toBe("no-qualifying-meter");
  });
});

describe("demand and regulator validation", () => {
  it("uses the explicit website heating value for load conversion", () => {
    expect(convertDemandToCfh(310_000, "BTU/h", 1_000)).toBe(310);
    expect(convertDemandToCfh(310_000, "BTU/h", 1_035)).toBeCloseTo(299.5169, 4);
    expect(convertDemandToCfh(1, "MCFH")).toBe(1_000);
  });

  it("rejects invalid inputs", () => {
    expect(() => convertDemandToCfh(0, "CFH")).toThrow(/greater than zero/i);
    expect(() => lookupServiceCapacity({ requiredCfh: -1, lengthFt: 60, pressureClass: "low", material: "plastic", status: "new" })).toThrow(/greater than zero/i);
  });

  it("requires an explicit regulator range when source categories overlap", () => {
    const result = lookupRegulators({
      requiredCfh: 1_000,
      configuration: "fsd",
      outletPressureValue: 7,
      outletPressureUnit: "inWC",
      inletPressurePsig: 32,
    });
    expect(result.status).toBe("ambiguous-inlet-range");
  });

  it("returns source-qualified threaded guidance for a stated DS14.9 combination", () => {
    const result = lookupConnectionGuideline({
      inletClass: "intermediate",
      inletPressurePsig: 3,
      outletPressureValue: 7,
      outletPressureUnit: "inWC",
      meterSizeInches: 1.5,
    });
    expect(result.status).toBe("source-qualified");
    expect(result.connection).toBe("threaded");
  });

  it("requires review for a DS14.9 rule gap", () => {
    const result = lookupConnectionGuideline({
      inletClass: "high",
      inletPressurePsig: 40,
      outletPressureValue: 10,
      outletPressureUnit: "psig",
      meterSizeInches: 1.5,
    });
    expect(result.status).toBe("engineering-review");
    expect(result.connection).toBeNull();
  });
});
