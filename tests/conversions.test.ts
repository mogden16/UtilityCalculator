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
});
