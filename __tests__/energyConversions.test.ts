import { describe, expect, it } from "vitest";
import {
  DEFAULT_HHV_MMBTU_PER_MCF,
  btuhToCFH,
  btuhToMcfPerHour,
  dthToMcf,
  mcfToDth,
  tonsToBtuh,
} from "../lib/energyConversions";

describe("energyConversions", () => {
  it("converts tons to BTU/hr", () => {
    expect(tonsToBtuh(3000)).toBe(36_000_000);
  });

  it("converts BTU/hr to CFH and MCF/hr using HHV", () => {
    const hhv = DEFAULT_HHV_MMBTU_PER_MCF;
    const btuh = 36_000_000;
    const cfh = btuhToCFH(btuh, hhv);
    const mcfPerHour = btuhToMcfPerHour(btuh, hhv);

    expect(cfh).toBeCloseTo(34_782.6, 1); // ~34,783 CFH
    expect(mcfPerHour).toBeCloseTo(34.8, 1);
  });

  it("converts between MCF and Dth with HHV", () => {
    const hhv = 1.035;
    const dthFromMcf = mcfToDth(1, hhv);
    const mcfFromDth = dthToMcf(1.035, hhv);

    expect(dthFromMcf).toBeCloseTo(1.035, 3);
    expect(mcfFromDth).toBeCloseTo(1, 3);
  });
});
