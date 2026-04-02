import { describe, expect, it } from "vitest";

import { calculateLoadEstimate } from "@/lib/load-estimator";

describe("calculateLoadEstimate", () => {
  it("uses default scenario factors when overrides are empty", () => {
    const estimate = calculateLoadEstimate({
      sqft: "2000",
      scenario: "average",
      heatingOverride: "",
      coolingOverride: "",
    });

    expect(estimate.heatBtuh).toBe(60000);
    expect(estimate.coolBtuh).toBe(40000);
    expect(estimate.coolTons).toBeCloseTo(3.3333, 3);
  });

  it("uses overrides when provided", () => {
    const estimate = calculateLoadEstimate({
      sqft: "2000",
      scenario: "average",
      heatingOverride: "35",
      coolingOverride: "24",
    });

    expect(estimate.heatBtuh).toBe(70000);
    expect(estimate.coolBtuh).toBe(48000);
  });
});
