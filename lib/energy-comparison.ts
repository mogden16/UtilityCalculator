import { BTU_PER_GALLON_OIL_NO2, BTU_PER_GALLON_PROPANE, BTU_PER_KW, DEFAULT_HHV_MMBTU_PER_MCF } from "@/lib/energy";
import { nonNegative, parseNumberish } from "@/lib/number";

export type EnergyContext = {
  hhv: number;
};

export const LABEL_OPTIONS = [
  "Natural Gas Furnace",
  "Propane Furnace",
  "Electric Resistance",
  "Air-Source Heat Pump",
  "Ground-Source Heat Pump",
  "Fuel Oil Boiler",
  "Steam Boiler",
  "District Steam",
] as const;

export const PRESET_SOURCE_METADATA: Record<string, { defaultEfficiency: number; defaultRateUnit: EnergyUnit }> = {
  "Natural Gas Furnace": { defaultEfficiency: 0.9, defaultRateUnit: "mcf" },
  "Propane Furnace": { defaultEfficiency: 0.9, defaultRateUnit: "propane_gallon" },
  "Electric Resistance": { defaultEfficiency: 1, defaultRateUnit: "kwh" },
  "Air-Source Heat Pump": { defaultEfficiency: 2.8, defaultRateUnit: "kwh" },
  "Ground-Source Heat Pump": { defaultEfficiency: 3.5, defaultRateUnit: "kwh" },
  "Fuel Oil Boiler": { defaultEfficiency: 0.87, defaultRateUnit: "oil_gallon" },
  "Steam Boiler": { defaultEfficiency: 0.8, defaultRateUnit: "mlb" },
  "District Steam": { defaultEfficiency: 0.82, defaultRateUnit: "mlb" },
};

export const ENERGY_UNITS = {
  mcf: {
    label: "MCF",
    rateLabel: "$/MCF",
    description: "Thousand cubic feet of natural gas",
    toMMBtu: (value: number, ctx: EnergyContext) => value * ctx.hhv,
    fromMMBtu: (value: number, ctx: EnergyContext) => value / ctx.hhv,
  },
  therm: {
    label: "Therm",
    rateLabel: "$/Therm",
    description: "Therms of natural gas",
    toMMBtu: (value: number) => value * 0.1,
    fromMMBtu: (value: number) => value / 0.1,
  },
  dth: {
    label: "Dth",
    rateLabel: "$/Dth",
    description: "Dekatherms",
    toMMBtu: (value: number) => value,
    fromMMBtu: (value: number) => value,
  },
  mlb: {
    label: "MLB",
    rateLabel: "$/MLB",
    description: "Thousand pounds of steam",
    toMMBtu: (value: number) => value,
    fromMMBtu: (value: number) => value,
  },
  kwh: {
    label: "kWh",
    rateLabel: "$/kWh",
    description: "Kilowatt-hours of electricity",
    toMMBtu: (value: number) => (value * BTU_PER_KW) / 1_000_000,
    fromMMBtu: (value: number) => (value * 1_000_000) / BTU_PER_KW,
  },
  oil_gallon: {
    label: "No. 2 oil gal",
    rateLabel: "$/gal #2 oil",
    description: "Gallons of No. 2 heating oil",
    toMMBtu: (value: number) => (value * BTU_PER_GALLON_OIL_NO2) / 1_000_000,
    fromMMBtu: (value: number) => (value * 1_000_000) / BTU_PER_GALLON_OIL_NO2,
  },
  propane_gallon: {
    label: "Propane gal",
    rateLabel: "$/gal propane",
    description: "Gallons of propane",
    toMMBtu: (value: number) => (value * BTU_PER_GALLON_PROPANE) / 1_000_000,
    fromMMBtu: (value: number) => (value * 1_000_000) / BTU_PER_GALLON_PROPANE,
  },
} as const;

export type EnergyUnit = keyof typeof ENERGY_UNITS;
export const ENERGY_UNIT_ENTRIES = Object.entries(ENERGY_UNITS) as Array<[EnergyUnit, (typeof ENERGY_UNITS)[EnergyUnit]]>;

export type RateSourceInput = {
  name: string;
  rate: number | string;
  rateUnit: EnergyUnit;
  efficiency: number | string;
};

export type EnergySummary = {
  name: string;
  ratePerMMBtu: number;
  inputMMBtu: number;
  deliveredMMBtu: number;
  totalCost: number;
  efficiency: number;
  costPerDelivered: number;
  equivalentUsage: number;
  equivalentUsageUnit: EnergyUnit;
};

export type EnergyComparisonResult = {
  primary: EnergySummary;
  comparison: EnergySummary;
};

export function formatEfficiency(value: number): string {
  return value.toFixed(2);
}

function resolveContext(hhv: number | string): EnergyContext {
  const parsed = parseNumberish(hhv);
  return { hhv: parsed > 0 ? parsed : DEFAULT_HHV_MMBTU_PER_MCF };
}

function normalizeEfficiency(value: number | string): number {
  const raw = nonNegative(parseNumberish(value));
  if (raw > 10) {
    return raw / 100;
  }

  return raw > 0 ? raw : 1;
}

function buildEnergySummary(
  source: RateSourceInput,
  inputMMBtu: number,
  deliveredMMBtu: number,
  context: EnergyContext,
): EnergySummary {
  const rateValue = nonNegative(parseNumberish(source.rate));
  const unitRate = ENERGY_UNITS[source.rateUnit];
  const rateUnitMMBtu = unitRate.toMMBtu(1, context);
  const ratePerMMBtu = rateUnitMMBtu > 0 ? rateValue / rateUnitMMBtu : 0;
  const efficiency = normalizeEfficiency(source.efficiency);
  const totalCost = ratePerMMBtu * inputMMBtu;

  return {
    name: source.name.trim() || "Source",
    ratePerMMBtu,
    inputMMBtu,
    deliveredMMBtu,
    totalCost,
    efficiency,
    costPerDelivered: deliveredMMBtu > 0 ? totalCost / deliveredMMBtu : 0,
    equivalentUsage: unitRate.fromMMBtu(inputMMBtu, context),
    equivalentUsageUnit: source.rateUnit,
  };
}

export function computeEnergyComparison(
  primarySource: RateSourceInput,
  comparisonSource: RateSourceInput,
  usageValue: number | string,
  usageUnit: EnergyUnit,
  hhv: number | string,
): EnergyComparisonResult {
  const context = resolveContext(hhv);
  const usageAmount = nonNegative(parseNumberish(usageValue));
  const primaryInputMMBtu = ENERGY_UNITS[usageUnit].toMMBtu(usageAmount, context);
  const primaryEfficiency = normalizeEfficiency(primarySource.efficiency);
  const deliveredMMBtu = primaryInputMMBtu * primaryEfficiency;
  const comparisonEfficiency = normalizeEfficiency(comparisonSource.efficiency);
  const comparisonInputMMBtu = deliveredMMBtu / Math.max(comparisonEfficiency, 0.000001);

  return {
    primary: buildEnergySummary(primarySource, primaryInputMMBtu, deliveredMMBtu, context),
    comparison: buildEnergySummary(comparisonSource, comparisonInputMMBtu, deliveredMMBtu, context),
  };
}

export function computeEnergySummary(
  source: RateSourceInput,
  usageValue: number | string,
  usageUnit: EnergyUnit,
  hhv: number | string,
): EnergySummary {
  const result = computeEnergyComparison(source, source, usageValue, usageUnit, hhv);
  return result.primary;
}

export function getComparisonMetrics(summaryA: EnergySummary, summaryB: EnergySummary) {
  const deliveredLoad = Math.max(summaryA.deliveredMMBtu, summaryB.deliveredMMBtu);
  const relativeCostMultiplier = summaryA.costPerDelivered > 0 ? summaryB.costPerDelivered / summaryA.costPerDelivered : Number.NaN;
  const normalizedCostA = summaryA.costPerDelivered * deliveredLoad;
  const normalizedCostB = summaryB.costPerDelivered * deliveredLoad;
  const savings = normalizedCostB - normalizedCostA;

  return {
    deliveredLoad,
    relativeCostMultiplier,
    normalizedCostA,
    normalizedCostB,
    savings,
  };
}

export function buildComparisonNarrative(summaryA: EnergySummary, summaryB: EnergySummary, comparison: ReturnType<typeof getComparisonMetrics>) {
  if (!Number.isFinite(comparison.savings) || comparison.deliveredLoad <= 0) {
    return {
      headline: "Enter a positive load to compare delivered cost.",
      detail: "The table updates once both sources have a load basis and a rate.",
    };
  }

  if (Math.abs(comparison.savings) < 1e-6) {
    return {
      headline: "Both options are effectively cost-equivalent for the modeled load.",
      detail: "Small differences may still appear once you add demand charges, standby losses, or maintenance.",
    };
  }

  if (comparison.savings > 0) {
    return {
      headline: `${summaryA.name} is the lower delivered-cost option.`,
      detail: `${summaryA.name} saves $${comparison.savings.toFixed(2)} compared with ${summaryB.name} across ${comparison.deliveredLoad.toFixed(2)} delivered MMBtu.`,
    };
  }

  return {
    headline: `${summaryB.name} is the lower delivered-cost option.`,
    detail: `${summaryB.name} saves $${Math.abs(comparison.savings).toFixed(2)} compared with ${summaryA.name} across ${comparison.deliveredLoad.toFixed(2)} delivered MMBtu.`,
  };
}
