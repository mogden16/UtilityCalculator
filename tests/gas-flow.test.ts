import { describe, expect, it } from "vitest";

import { calculateGasFlow } from "@/lib/gas-flow";

describe("calculateGasFlow", () => {
  it("maps MBH input to gas flow", () => {
    const result = calculateGasFlow({
      value: "100",
      unit: "MBH",
      energyReference: "input",
      hhv: "1.0",
      hours: "5",
    });

    expect(result.inputBtuh).toBe(100000);
    expect(result.cfh).toBeCloseTo(100, 6);
    expect(result.totalMcf).toBeCloseTo(0.5, 6);
  });
});
