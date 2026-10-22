import { describe, expect, it } from "vitest";

import { convertMeasurement } from "@/lib/conversions";

describe("convertMeasurement", () => {
  it("converts therms to BTU", () => {
    expect(
      convertMeasurement({
        category: "energy",
        fromUnit: "therm",
        toUnit: "btu",
        value: 2,
      }),
    ).toBe(200000);
  });

  it("converts psig to inWC", () => {
    expect(
      convertMeasurement({
        category: "pressure",
        fromUnit: "psig",
        toUnit: "inwc",
        value: 1,
      }),
    ).toBeCloseTo(27.68, 6);
  });

  it("preserves the expanded engineering conversion set", () => {
    expect(convertMeasurement({ category: "energy", fromUnit: "mlb", toUnit: "mmbtu", value: 1 })).toBe(1);
    expect(convertMeasurement({ category: "energy", fromUnit: "bcf", toUnit: "mcf", value: 0.5 })).toBeCloseTo(500000, 6);
    expect(convertMeasurement({ category: "power", fromUnit: "mw", toUnit: "kw", value: 1 })).toBeCloseTo(1000, 6);
    expect(convertMeasurement({ category: "flow", fromUnit: "mcfh", toUnit: "cfh", value: 1 })).toBe(1000);
  });

  it("converts MCF energy content to No. 2 oil gallons", () => {
    expect(convertMeasurement({ category: "energy", fromUnit: "mcf", toUnit: "oilno2", value: 10 })).toBeCloseTo(
      74.7292418773,
      8,
    );
  });
});
