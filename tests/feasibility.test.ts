import { describe, expect, it } from "vitest";

import {
  calculateFuelConversion,
  FEASIBILITY_DEFAULTS,
  parseUtilityCsv,
  recordsToCsv,
  validateUtilityRecords,
  type UtilityRecord,
} from "@/lib/feasibility";
import {
  createFeasibilityProjectDocument,
  createFeasibilityProvenance,
  FEASIBILITY_ASSUMPTION_REFERENCES,
  FEASIBILITY_VERSIONS,
} from "@/lib/feasibility-version";

function record(overrides: Partial<UtilityRecord> = {}): UtilityRecord {
  return {
    id: "bill-1",
    accountId: "Main gas",
    utilityType: "natural_gas",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
    usage: 100,
    usageUnit: "mcf",
    totalCost: 1_200,
    estimated: false,
    tariffName: "Firm service",
    source: { kind: "manual", locator: "Manual entry", confidence: "confirmed" },
    ...overrides,
  };
}

describe("utility intake and reconciliation", () => {
  it("imports a traceable CSV row without transmitting or inventing fields", () => {
    const parsed = parseUtilityCsv([
      "account_id,utility_type,period_start,period_end,usage,unit,total_cost,energy_cost,demand_cost,other_cost,demand_kw,estimated,tariff_name,notes",
      '"Main, Building",electricity,2025-01-01,2025-01-31,120000,kwh,18500,12000,5000,1500,420,false,GS-2,"Verified bill"',
    ].join("\n"), "bills.csv");
    expect(parsed.errors).toEqual([]);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({ accountId: "Main, Building", usage: 120_000, demandKw: 420, tariffName: "GS-2" });
    expect(parsed.records[0].source).toMatchObject({ kind: "csv", fileName: "bills.csv", row: 2, confidence: "review" });
  });

  it("rejects unsupported units and missing required columns", () => {
    const missing = parseUtilityCsv("account_id,usage\nA,10");
    expect(missing.records).toEqual([]);
    expect(missing.errors[0].message).toContain("Missing required columns");
    const unsupported = parseUtilityCsv("account_id,utility_type,period_start,period_end,usage,unit,total_cost\nA,natural_gas,2025-01-01,2025-01-31,10,kwh,100");
    expect(unsupported.errors[0].message).toContain("not supported");
  });

  it("identifies duplicate, overlapping, missing, and estimated periods", () => {
    const records = [
      record(),
      record({ id: "bill-2" }),
      record({ id: "bill-3", periodStart: "2025-01-15", periodEnd: "2025-02-15" }),
      record({ id: "bill-4", periodStart: "2025-04-15", periodEnd: "2025-05-15", estimated: true }),
    ];
    const codes = validateUtilityRecords(records).map((issue) => issue.code);
    expect(codes).toContain("duplicate");
    expect(codes).toContain("overlap");
    expect(codes).toContain("gap");
    expect(codes).toContain("incomplete_year");
    expect(codes).toContain("estimated");
  });

  it("flags inconsistent units, unusual usage, missing tariffs, and oil inventory uncertainty", () => {
    const records = [
      record({ tariffName: undefined }),
      record({ id: "bill-2", periodStart: "2025-02-01", periodEnd: "2025-02-28", usage: 110 }),
      record({ id: "bill-3", periodStart: "2025-03-01", periodEnd: "2025-03-31", usage: 105 }),
      record({ id: "bill-4", periodStart: "2025-04-01", periodEnd: "2025-04-30", usage: 1_000 }),
      record({ id: "bill-5", periodStart: "2025-05-01", periodEnd: "2025-05-31", usage: 10, usageUnit: "dth" }),
      record({ id: "oil", accountId: "Oil tank", utilityType: "fuel_oil_no2", usageUnit: "gallon", periodStart: "2025-01-01", periodEnd: "2025-01-31" }),
    ];
    const codes = validateUtilityRecords(records).map((issue) => issue.code);
    expect(codes).toContain("mixed_units");
    expect(codes).toContain("missing_tariff");
    expect(codes).toContain("delivery_not_consumption");
  });
});

describe("fuel conversion engineering", () => {
  it("balances No. 2 oil useful heat against proposed natural gas input", () => {
    const result = calculateFuelConversion({
      ...FEASIBILITY_DEFAULTS,
      annualSourceQuantity: 10_000,
      existingAnnualEnergyCost: 40_000,
    });
    expect(result.existingInputMmbtu).toBeCloseTo(1_385, 6);
    expect(result.usefulHeatMmbtu).toBeCloseTo(1_080.3, 6);
    expect(result.proposedGasMmbtu).toBeCloseTo(1_200.333333, 5);
    expect(result.proposedGasMcf).toBeCloseTo(1_159.742351, 5);
    expect(result.annualNetSavings).toBeCloseTo(28_083.091787, 5);
  });

  it("uses steam supply minus condensate enthalpy for purchased-steam conversion", () => {
    const result = calculateFuelConversion({
      ...FEASIBILITY_DEFAULTS,
      conversionType: "steam_to_gas",
      sourceUnit: "mlb",
      annualSourceQuantity: 1_000,
      existingEfficiency: 0.95,
      proposedEfficiency: 0.85,
    });
    expect(result.existingInputMmbtu).toBeCloseTo(1_015, 6);
    expect(result.usefulHeatMmbtu).toBeCloseTo(964.25, 6);
    expect(result.proposedGasMcf).toBeCloseTo((964.25 / 0.85) / 1.035, 6);
    expect(result.warnings.join(" ")).toContain("enthalpy");
  });

  it("models a gas equipment upgrade without changing the fuel heating-value basis", () => {
    const result = calculateFuelConversion({
      ...FEASIBILITY_DEFAULTS,
      conversionType: "gas_upgrade",
      sourceUnit: "mcf",
      annualSourceQuantity: 10_000,
      existingEfficiency: 0.8,
      proposedEfficiency: 0.95,
    });
    expect(result.existingInputMmbtu).toBeCloseTo(10_350, 6);
    expect(result.proposedGasMcf).toBeCloseTo(10_000 * 0.8 / 0.95, 6);
  });

  it("keeps incentives explicit, applies contingency, and calculates discounted NPV", () => {
    const result = calculateFuelConversion({
      ...FEASIBILITY_DEFAULTS,
      annualSourceQuantity: 10_000,
      existingAnnualEnergyCost: 40_000,
      baseProjectCost: 100_000,
      contingencyPercent: 20,
      incentives: 10_000,
      analysisYears: 2,
      discountRatePercent: 10,
    });
    expect(result.grossCapitalCost).toBe(120_000);
    expect(result.netCapitalCost).toBe(110_000);
    expect(result.netPresentValue).toBeCloseTo(-110_000 + result.annualNetSavings / 1.1 + result.annualNetSavings / 1.21, 6);
    expect(result.sensitivity.map((item) => item.name)).toEqual(["Conservative", "Expected", "Optimistic"]);
  });

  it("does not imply that annual consumption establishes equipment capacity", () => {
    const result = calculateFuelConversion({ ...FEASIBILITY_DEFAULTS, annualSourceQuantity: 1_000 });
    expect(result.warnings.join(" ")).toContain("not peak equipment");
  });

  it("rejects impossible efficiencies and steam enthalpy assumptions", () => {
    expect(() => calculateFuelConversion({ ...FEASIBILITY_DEFAULTS, proposedEfficiency: 0 })).toThrow(/efficiencies/);
    expect(() => calculateFuelConversion({ ...FEASIBILITY_DEFAULTS, conversionType: "steam_to_gas", sourceUnit: "mlb", steamSupplyEnthalpyBtuPerLb: 100 })).toThrow(/enthalpy/);
  });
});

describe("feasibility versioning and provenance", () => {
  const project = { name: "Conversion study", facility: "Synthetic facility", location: "Test city", description: "Synthetic benchmark" };
  const inputs = { ...FEASIBILITY_DEFAULTS, annualSourceQuantity: 10_000 };
  const recommendation = "Continue to detailed engineering.";

  it("creates a stable fingerprint independent of transient record IDs and row order", () => {
    const firstRecords = [
      record({ id: "transient-a", accountId: "A", source: { kind: "manual", locator: "A row", confidence: "confirmed" } }),
      record({ id: "transient-b", accountId: "B", source: { kind: "manual", locator: "B row", confidence: "confirmed" } }),
    ];
    const secondRecords = [
      { ...firstRecords[1], id: "different-b" },
      { ...firstRecords[0], id: "different-a" },
    ];
    const first = createFeasibilityProvenance({ project, records: firstRecords, inputs, recommendation, generatedAt: "2026-10-30T12:00:00.000Z" });
    const second = createFeasibilityProvenance({ project, records: secondRecords, inputs, recommendation, generatedAt: "2027-01-01T00:00:00.000Z" });
    expect(first.inputFingerprint).toMatch(/^UCFS-[0-9A-F]{8}$/);
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
  });

  it("changes the fingerprint when an engineering input changes", () => {
    const baseline = createFeasibilityProvenance({ project, records: [record()], inputs, recommendation, generatedAt: "2026-10-30T12:00:00.000Z" });
    const revised = createFeasibilityProvenance({ project, records: [record()], inputs: { ...inputs, proposedEfficiency: 0.91 }, recommendation, generatedAt: "2026-10-30T12:00:00.000Z" });
    expect(revised.inputFingerprint).not.toBe(baseline.inputFingerprint);
  });

  it("embeds version provenance in CSV and project JSON exports", () => {
    const records = [record()];
    const provenance = createFeasibilityProvenance({ project, records, inputs, recommendation, generatedAt: "2026-10-30T12:00:00.000Z" });
    const csv = recordsToCsv(records, provenance);
    expect(csv).toContain("calculation_engine_version");
    expect(csv).toContain(`"${FEASIBILITY_VERSIONS.calculationEngineVersion}"`);
    expect(csv).toContain(`"${provenance.inputFingerprint}"`);

    const document = createFeasibilityProjectDocument({ project, records, inputs, recommendation, provenance });
    expect(document.documentType).toBe("utilitycalc-feasibility-project");
    expect(document.schemaVersion).toBe(FEASIBILITY_VERSIONS.projectSchemaVersion);
    expect(document.provenance.inputFingerprint).toBe(provenance.inputFingerprint);
    expect(document.assumptionReferences.length).toBeGreaterThan(3);
  });

  it("keeps versioned fuel defaults synchronized with the calculation defaults", () => {
    const references = Object.fromEntries(FEASIBILITY_ASSUMPTION_REFERENCES.map((item) => [item.id, item.defaultValue]));
    expect(references["natural-gas-hhv"]).toBe(FEASIBILITY_DEFAULTS.naturalGasHhvMmbtuPerMcf);
    expect(references["no2-oil-hhv"]).toBe(FEASIBILITY_DEFAULTS.oilHhvMmbtuPerGallon);
    expect(references["steam-supply-enthalpy"]).toBe(FEASIBILITY_DEFAULTS.steamSupplyEnthalpyBtuPerLb);
    expect(references["steam-condensate-enthalpy"]).toBe(FEASIBILITY_DEFAULTS.steamCondensateEnthalpyBtuPerLb);
  });
});
