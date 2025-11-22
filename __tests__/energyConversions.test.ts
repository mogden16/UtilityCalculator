import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HHV_MMBTU_PER_MCF,
  btuhToCFH,
  btuhToMcfPerHour,
  dthToMcf,
  mcfToDth,
  tonsToBtuh,
} from "../lib/energyConversions";

test.describe("energyConversions", () => {
  test.it("converts tons to BTU/hr", () => {
    assert.equal(tonsToBtuh(3000), 36_000_000);
  });

  test.it("converts BTU/hr to CFH and MCF/hr using HHV", () => {
    const hhv = DEFAULT_HHV_MMBTU_PER_MCF;
    const btuh = 36_000_000;
    const cfh = btuhToCFH(btuh, hhv);
    const mcfPerHour = btuhToMcfPerHour(btuh, hhv);

    assert.ok(Math.abs(cfh - 34_782.6) < 5); // ~34,783 CFH within tolerance
    assert.ok(Math.abs(mcfPerHour - 34.8) < 0.5);
  });

  test.it("converts between MCF and Dth with HHV", () => {
    const hhv = 1.035;
    const dthFromMcf = mcfToDth(1, hhv);
    const mcfFromDth = dthToMcf(1.035, hhv);

    assert.ok(Math.abs(dthFromMcf - 1.035) < 0.001);
    assert.ok(Math.abs(mcfFromDth - 1) < 0.001);
  });
});
