import { describe, expect, it } from "vitest";

import { calculateConverter } from "@/lib/converter";

describe("calculateConverter", () => {
  it("converts delivered output to input fuel with efficiency and HHV", () => {
    const result = calculateConverter({
      value: "120000",
      unit: "BTU/hr",
      energyReference: "output",
      efficiencyPercent: "80",
      hhv: "1.0",
      hours: "10",
    });

    expect(result.inputBtuh).toBeCloseTo(150000, 6);
    expect(result.cfh).toBeCloseTo(150, 6);
    expect(result.totalTherms).toBeCloseTo(15, 6);
  });

  it("converts cooling tons to thermal kW", () => {
    const result = calculateConverter({
      value: "5",
      unit: "Ton",
      energyReference: "output",
      efficiencyPercent: "100",
      hours: "1",
    });

    expect(result.outputBtuh).toBeCloseTo(60000, 6);
    expect(result.kw).toBeCloseTo(17.584, 3);
  });
});
