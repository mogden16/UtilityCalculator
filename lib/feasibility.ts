import { ENGINEERING_ASSUMPTIONS } from "@/lib/assumptions";
import type { FeasibilityProvenance } from "@/lib/feasibility-version";

export type UtilityType = "electricity" | "natural_gas" | "purchased_steam" | "fuel_oil_no2";
export type UtilityUnit = "kwh" | "kw" | "mcf" | "dth" | "therm" | "mlb" | "gallon";
export type SourceConfidence = "confirmed" | "review" | "uncertain";

export type UtilityFieldKey =
  | "accountId"
  | "utilityType"
  | "periodStart"
  | "periodEnd"
  | "usage"
  | "usageUnit"
  | "totalCost"
  | "energyCost"
  | "demandCost"
  | "otherCost"
  | "demandKw"
  | "estimated"
  | "tariffName";

export type UtilityFieldEvidence = {
  page: number;
  line: number;
  locator: string;
  excerpt: string;
};

export type UtilitySource = {
  kind: "manual" | "csv" | "pdf";
  fileName?: string;
  row?: number;
  locator: string;
  confidence: SourceConfidence;
  parserVersion?: string;
  fieldEvidence?: Partial<Record<UtilityFieldKey, UtilityFieldEvidence>>;
};

export type UtilityRecord = {
  id: string;
  accountId: string;
  utilityType: UtilityType;
  periodStart: string;
  periodEnd: string;
  usage: number;
  usageUnit: UtilityUnit;
  totalCost: number;
  energyCost?: number;
  demandCost?: number;
  otherCost?: number;
  demandKw?: number;
  estimated: boolean;
  tariffName?: string;
  notes?: string;
  source: UtilitySource;
};

export type UtilityIssue = {
  code:
    | "invalid_record"
    | "duplicate"
    | "overlap"
    | "gap"
    | "incomplete_year"
    | "estimated"
    | "mixed_units"
    | "unusual_usage"
    | "missing_tariff"
    | "delivery_not_consumption"
    | "uncertain_source";
  severity: "error" | "warning" | "info";
  message: string;
  recordIds: string[];
};

export type CsvImportResult = {
  records: UtilityRecord[];
  errors: Array<{ row: number; message: string }>;
};

export type FuelConversionType = "oil_to_gas" | "steam_to_gas" | "gas_upgrade";

export type FuelConversionInputs = {
  conversionType: FuelConversionType;
  annualSourceQuantity: number;
  sourceUnit: "gallon" | "mlb" | "mcf";
  existingAnnualEnergyCost?: number;
  existingUnitRate: number;
  gasRatePerMcf: number;
  existingEfficiency: number;
  proposedEfficiency: number;
  naturalGasHhvMmbtuPerMcf: number;
  oilHhvMmbtuPerGallon: number;
  steamSupplyEnthalpyBtuPerLb: number;
  steamCondensateEnthalpyBtuPerLb: number;
  existingMaintenanceAnnual: number;
  proposedMaintenanceAnnual: number;
  baseProjectCost: number;
  contingencyPercent: number;
  incentives: number;
  analysisYears: number;
  discountRatePercent: number;
};

export type FinancialCase = {
  name: "Conservative" | "Expected" | "Optimistic";
  annualNetSavings: number;
  netCapitalCost: number;
  simplePaybackYears: number;
  netPresentValue: number;
};

export type FuelConversionResult = {
  existingInputMmbtu: number;
  usefulHeatMmbtu: number;
  proposedGasMmbtu: number;
  proposedGasMcf: number;
  existingAnnualEnergyCost: number;
  proposedAnnualEnergyCost: number;
  annualEnergySavings: number;
  annualMaintenanceSavings: number;
  annualNetSavings: number;
  grossCapitalCost: number;
  netCapitalCost: number;
  simplePaybackYears: number;
  netPresentValue: number;
  sensitivity: FinancialCase[];
  warnings: string[];
};

export const FEASIBILITY_DEFAULTS: FuelConversionInputs = {
  conversionType: "oil_to_gas",
  annualSourceQuantity: 0,
  sourceUnit: "gallon",
  existingUnitRate: 4,
  gasRatePerMcf: 12,
  existingEfficiency: 0.78,
  proposedEfficiency: 0.9,
  naturalGasHhvMmbtuPerMcf: ENGINEERING_ASSUMPTIONS.naturalGasHhvMmbtuPerMcf,
  oilHhvMmbtuPerGallon: ENGINEERING_ASSUMPTIONS.btuPerGallonNo2Oil / 1_000_000,
  steamSupplyEnthalpyBtuPerLb: 1_195,
  steamCondensateEnthalpyBtuPerLb: 180,
  existingMaintenanceAnnual: 5_000,
  proposedMaintenanceAnnual: 3_000,
  baseProjectCost: 250_000,
  contingencyPercent: 20,
  incentives: 0,
  analysisYears: 15,
  discountRatePercent: 7,
};

export const UTILITY_UNITS: Record<UtilityType, UtilityUnit[]> = {
  electricity: ["kwh"],
  natural_gas: ["mcf", "dth", "therm"],
  purchased_steam: ["mlb"],
  fuel_oil_no2: ["gallon"],
};

const REQUIRED_CSV_COLUMNS = [
  "account_id",
  "utility_type",
  "period_start",
  "period_end",
  "usage",
  "unit",
  "total_cost",
] as const;

export const UTILITY_CSV_TEMPLATE = [
  "account_id,utility_type,period_start,period_end,usage,unit,total_cost,energy_cost,demand_cost,other_cost,demand_kw,estimated,tariff_name,notes",
  "Main electric,electricity,2025-01-01,2025-01-31,120000,kwh,18500,12000,5000,1500,420,false,GS-2,Example row - replace before import",
].join("\n");

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

export function parseUtilityCsv(text: string, fileName = "utility-data.csv"): CsvImportResult {
  const rows = splitCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return { records: [], errors: [{ row: 1, message: "The file is empty." }] };
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const missing = REQUIRED_CSV_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) {
    return { records: [], errors: [{ row: 1, message: `Missing required columns: ${missing.join(", ")}.` }] };
  }
  const valueAt = (values: string[], name: string) => values[headers.indexOf(name)] ?? "";
  const records: UtilityRecord[] = [];
  const errors: CsvImportResult["errors"] = [];

  rows.slice(1).forEach((values, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const utilityType = valueAt(values, "utility_type").toLowerCase() as UtilityType;
    const usageUnit = valueAt(values, "unit").toLowerCase() as UtilityUnit;
    const usage = parseOptionalNumber(valueAt(values, "usage"));
    const totalCost = parseOptionalNumber(valueAt(values, "total_cost"));
    const periodStart = valueAt(values, "period_start");
    const periodEnd = valueAt(values, "period_end");
    if (!(utilityType in UTILITY_UNITS)) {
      errors.push({ row: rowNumber, message: `Unsupported utility_type “${utilityType}”.` });
      return;
    }
    if (!UTILITY_UNITS[utilityType].includes(usageUnit)) {
      errors.push({ row: rowNumber, message: `Unit “${usageUnit}” is not supported for ${utilityType}.` });
      return;
    }
    if (!isIsoDate(periodStart) || !isIsoDate(periodEnd) || periodStart > periodEnd) {
      errors.push({ row: rowNumber, message: "Billing dates must be valid YYYY-MM-DD values with start before end." });
      return;
    }
    if (usage === undefined || usage < 0 || totalCost === undefined || totalCost < 0) {
      errors.push({ row: rowNumber, message: "Usage and total_cost must be nonnegative numbers." });
      return;
    }
    const energyCost = parseOptionalNumber(valueAt(values, "energy_cost"));
    const demandCost = parseOptionalNumber(valueAt(values, "demand_cost"));
    const otherCost = parseOptionalNumber(valueAt(values, "other_cost"));
    const demandKw = parseOptionalNumber(valueAt(values, "demand_kw"));
    records.push({
      id: `csv-${Date.now()}-${rowNumber}-${records.length}`,
      accountId: valueAt(values, "account_id") || "Unspecified account",
      utilityType,
      periodStart,
      periodEnd,
      usage,
      usageUnit,
      totalCost,
      energyCost,
      demandCost,
      otherCost,
      demandKw,
      estimated: /^(true|yes|y|1)$/i.test(valueAt(values, "estimated")),
      tariffName: valueAt(values, "tariff_name") || undefined,
      notes: valueAt(values, "notes") || undefined,
      source: { kind: "csv", fileName, row: rowNumber, locator: `${fileName}, row ${rowNumber}`, confidence: "review" },
    });
  });
  return { records, errors };
}

function dayDifference(first: string, second: string): number {
  return Math.round((Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function validateUtilityRecords(records: UtilityRecord[]): UtilityIssue[] {
  const issues: UtilityIssue[] = [];
  const validRecords = records.filter((record) => {
    const valid = isIsoDate(record.periodStart)
      && isIsoDate(record.periodEnd)
      && record.periodStart <= record.periodEnd
      && record.accountId.trim().length > 0
      && Number.isFinite(record.usage)
      && record.usage >= 0
      && Number.isFinite(record.totalCost)
      && record.totalCost >= 0
      && UTILITY_UNITS[record.utilityType]?.includes(record.usageUnit);
    if (!valid) issues.push({ code: "invalid_record", severity: "error", message: "A billing row has invalid dates, units, usage, cost, or account information.", recordIds: [record.id] });
    return valid;
  });

  const groups = new Map<string, UtilityRecord[]>();
  validRecords.forEach((record) => {
    const key = `${record.accountId.toLowerCase()}|${record.utilityType}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
    if (record.estimated) issues.push({ code: "estimated", severity: "warning", message: `${record.accountId}: ${record.periodStart}–${record.periodEnd} is marked as an estimated reading.`, recordIds: [record.id] });
    if (!record.tariffName && (record.utilityType === "electricity" || record.utilityType === "natural_gas")) issues.push({ code: "missing_tariff", severity: "info", message: `${record.accountId}: tariff information is missing, so avoidable charges cannot be confirmed.`, recordIds: [record.id] });
    if (record.utilityType === "fuel_oil_no2") issues.push({ code: "delivery_not_consumption", severity: "info", message: `${record.accountId}: oil delivery volume may differ from actual consumption because tank inventory is not known.`, recordIds: [record.id] });
    if (record.source.confidence !== "confirmed") issues.push({ code: "uncertain_source", severity: "info", message: `${record.source.locator} requires review before it is treated as confirmed.`, recordIds: [record.id] });
  });

  groups.forEach((group) => {
    const sorted = [...group].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const units = new Set(sorted.map((record) => record.usageUnit));
    if (units.size > 1) issues.push({ code: "mixed_units", severity: "warning", message: `${sorted[0].accountId} uses inconsistent billing units (${[...units].join(", ")}). Normalize before annual analysis.`, recordIds: sorted.map((record) => record.id) });
    const coverageDays = dayDifference(sorted[0].periodStart, sorted[sorted.length - 1].periodEnd) + 1;
    if (coverageDays < 330) issues.push({ code: "incomplete_year", severity: "warning", message: `${sorted[0].accountId} covers only ${coverageDays} days; do not treat these bills as a complete annual baseline.`, recordIds: sorted.map((record) => record.id) });
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      const duplicate = sorted.slice(0, index).find((candidate) => candidate.periodStart === current.periodStart && candidate.periodEnd === current.periodEnd);
      if (duplicate) issues.push({ code: "duplicate", severity: "error", message: `${current.accountId} has duplicate billing periods ${current.periodStart}–${current.periodEnd}.`, recordIds: [duplicate.id, current.id] });
      const previous = sorted[index - 1];
      if (!previous) continue;
      if (current.periodStart <= previous.periodEnd && !(current.periodStart === previous.periodStart && current.periodEnd === previous.periodEnd)) {
        issues.push({ code: "overlap", severity: "error", message: `${current.accountId} has overlapping billing periods.`, recordIds: [previous.id, current.id] });
      } else if (dayDifference(previous.periodEnd, current.periodStart) > 45) {
        issues.push({ code: "gap", severity: "warning", message: `${current.accountId} has a possible missing billing period between ${previous.periodEnd} and ${current.periodStart}.`, recordIds: [previous.id, current.id] });
      }
    }
    if (sorted.length >= 4 && units.size === 1) {
      const typical = median(sorted.map((record) => record.usage));
      if (typical > 0) sorted.forEach((record) => {
        if (record.usage > typical * 3 || record.usage < typical * 0.25) {
          issues.push({ code: "unusual_usage", severity: "warning", message: `${record.accountId}: ${record.usage.toLocaleString()} ${record.usageUnit} is unusual relative to other bills and should be checked.`, recordIds: [record.id] });
        }
      });
    }
  });
  return issues;
}

export function annualUtilityTotals(records: UtilityRecord[], utilityType?: UtilityType) {
  const filtered = utilityType ? records.filter((record) => record.utilityType === utilityType) : records;
  return {
    usage: filtered.reduce((sum, record) => sum + record.usage, 0),
    totalCost: filtered.reduce((sum, record) => sum + record.totalCost, 0),
    energyCost: filtered.reduce((sum, record) => sum + (record.energyCost ?? 0), 0),
    demandCost: filtered.reduce((sum, record) => sum + (record.demandCost ?? 0), 0),
    otherCost: filtered.reduce((sum, record) => sum + (record.otherCost ?? 0), 0),
  };
}

function npv(netCapitalCost: number, annualSavings: number, years: number, discountRate: number): number {
  let value = -netCapitalCost;
  for (let year = 1; year <= years; year += 1) value += annualSavings / ((1 + discountRate) ** year);
  return value;
}

function financialCase(name: FinancialCase["name"], annualSavings: number, netCapitalCost: number, years: number, discountRate: number): FinancialCase {
  return {
    name,
    annualNetSavings: annualSavings,
    netCapitalCost,
    simplePaybackYears: annualSavings > 0 ? netCapitalCost / annualSavings : Number.POSITIVE_INFINITY,
    netPresentValue: npv(netCapitalCost, annualSavings, years, discountRate),
  };
}

export function calculateFuelConversion(inputs: FuelConversionInputs): FuelConversionResult {
  const finiteValues = Object.entries(inputs).filter(([, value]) => typeof value === "number" && !Number.isFinite(value));
  if (finiteValues.length) throw new Error(`Invalid numeric inputs: ${finiteValues.map(([key]) => key).join(", ")}.`);
  if (inputs.annualSourceQuantity < 0 || inputs.existingUnitRate < 0 || inputs.gasRatePerMcf < 0) throw new Error("Consumption and rates must be nonnegative.");
  if (inputs.existingEfficiency <= 0 || inputs.existingEfficiency > 1 || inputs.proposedEfficiency <= 0 || inputs.proposedEfficiency > 1) throw new Error("Equipment efficiencies must be greater than zero and no more than one.");
  if (inputs.naturalGasHhvMmbtuPerMcf <= 0 || inputs.oilHhvMmbtuPerGallon <= 0) throw new Error("Fuel heating values must be greater than zero.");
  if (inputs.steamSupplyEnthalpyBtuPerLb <= inputs.steamCondensateEnthalpyBtuPerLb) throw new Error("Steam supply enthalpy must exceed condensate return enthalpy.");
  if (inputs.contingencyPercent < 0 || inputs.analysisYears < 1 || inputs.discountRatePercent < 0) throw new Error("Financial assumptions must be nonnegative and the analysis period must be at least one year.");

  let existingInputMmbtu: number;
  if (inputs.conversionType === "oil_to_gas") existingInputMmbtu = inputs.annualSourceQuantity * inputs.oilHhvMmbtuPerGallon;
  else if (inputs.conversionType === "steam_to_gas") existingInputMmbtu = inputs.annualSourceQuantity * (inputs.steamSupplyEnthalpyBtuPerLb - inputs.steamCondensateEnthalpyBtuPerLb) / 1_000;
  else existingInputMmbtu = inputs.annualSourceQuantity * inputs.naturalGasHhvMmbtuPerMcf;

  const usefulHeatMmbtu = existingInputMmbtu * inputs.existingEfficiency;
  const proposedGasMmbtu = usefulHeatMmbtu / inputs.proposedEfficiency;
  const proposedGasMcf = proposedGasMmbtu / inputs.naturalGasHhvMmbtuPerMcf;
  const existingAnnualEnergyCost = inputs.existingAnnualEnergyCost ?? inputs.annualSourceQuantity * inputs.existingUnitRate;
  const proposedAnnualEnergyCost = proposedGasMcf * inputs.gasRatePerMcf;
  const annualEnergySavings = existingAnnualEnergyCost - proposedAnnualEnergyCost;
  const annualMaintenanceSavings = inputs.existingMaintenanceAnnual - inputs.proposedMaintenanceAnnual;
  const annualNetSavings = annualEnergySavings + annualMaintenanceSavings;
  const grossCapitalCost = inputs.baseProjectCost * (1 + inputs.contingencyPercent / 100);
  const netCapitalCost = Math.max(0, grossCapitalCost - inputs.incentives);
  const discountRate = inputs.discountRatePercent / 100;
  const expected = financialCase("Expected", annualNetSavings, netCapitalCost, inputs.analysisYears, discountRate);
  const sensitivity = [
    financialCase("Conservative", annualNetSavings * 0.8, netCapitalCost * 1.15, inputs.analysisYears, discountRate),
    expected,
    financialCase("Optimistic", annualNetSavings * 1.2, netCapitalCost * 0.9, inputs.analysisYears, discountRate),
  ];
  return {
    existingInputMmbtu,
    usefulHeatMmbtu,
    proposedGasMmbtu,
    proposedGasMcf,
    existingAnnualEnergyCost,
    proposedAnnualEnergyCost,
    annualEnergySavings,
    annualMaintenanceSavings,
    annualNetSavings,
    grossCapitalCost,
    netCapitalCost,
    simplePaybackYears: expected.simplePaybackYears,
    netPresentValue: expected.netPresentValue,
    sensitivity,
    warnings: [
      "Annual energy use supports a screening energy balance, not peak equipment or gas-service sizing.",
      "Gas tariff, interruptible-service terms, taxes, demand charges, and service-capacity availability have not been verified.",
      "Capital cost is a planning allowance until supported by site investigation and vendor quotations.",
      ...(inputs.conversionType === "steam_to_gas" ? ["Steam results depend on editable supply and condensate enthalpy assumptions; verify pressure, quality, condensate return, and distribution losses."] : []),
    ],
  };
}

export function recordsToCsv(records: UtilityRecord[], provenance?: FeasibilityProvenance): string {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const versionHeaders = provenance
    ? ",project_schema_version,calculation_engine_version,assumption_set_version,report_template_version,application_version,build_commit,input_fingerprint,calculation_mode,generated_at"
    : "";
  const header = `account_id,utility_type,period_start,period_end,usage,unit,total_cost,energy_cost,demand_cost,other_cost,demand_kw,estimated,tariff_name,notes,source,source_kind,source_confidence,source_details${versionHeaders}`;
  return [header, ...records.map((record) => [
    record.accountId,
    record.utilityType,
    record.periodStart,
    record.periodEnd,
    record.usage,
    record.usageUnit,
    record.totalCost,
    record.energyCost,
    record.demandCost,
    record.otherCost,
    record.demandKw,
    record.estimated,
    record.tariffName,
    record.notes,
    record.source.locator,
    record.source.kind,
    record.source.confidence,
    record.source.fieldEvidence ? JSON.stringify({ parserVersion: record.source.parserVersion, fields: record.source.fieldEvidence }) : "",
    ...(provenance ? [
      provenance.projectSchemaVersion,
      provenance.calculationEngineVersion,
      provenance.assumptionSetVersion,
      provenance.reportTemplateVersion,
      provenance.applicationVersion,
      provenance.buildCommit,
      provenance.inputFingerprint,
      provenance.calculationMode,
      provenance.generatedAt,
    ] : []),
  ].map(escape).join(","))].join("\n");
}
