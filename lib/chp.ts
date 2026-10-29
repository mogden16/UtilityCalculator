import { ENGINEERING_ASSUMPTIONS } from "@/lib/assumptions";
import { nonNegative, parseNumberish } from "@/lib/number";

export const CHP_BUILDING_ARCHETYPES = {
  hospital: { label: "Hospital", loadFactor: 0.75, thermalIntensity: 90, hours: 8_500 },
  hotel: { label: "Hotel", loadFactor: 0.65, thermalIntensity: 45, hours: 8_500 },
  multifamily: { label: "Multifamily", loadFactor: 0.55, thermalIntensity: 35, hours: 3_000 },
  university: { label: "University", loadFactor: 0.6, thermalIntensity: 60, hours: 6_500 },
  office: { label: "Office", loadFactor: 0.35, thermalIntensity: 20, hours: 3_000 },
  data_center: { label: "Data center", loadFactor: 0.95, thermalIntensity: 10, hours: 8_500 },
  manufacturing: { label: "Manufacturing", loadFactor: 0.7, thermalIntensity: 65, hours: 6_000 },
  other: { label: "Other", loadFactor: 0.5, thermalIntensity: 40, hours: 5_000 },
} as const;

export type ChpBuildingType = keyof typeof CHP_BUILDING_ARCHETYPES;

export const CHP_TECHNOLOGIES = {
  microturbine: { label: "Microturbine", installedCostPerKw: 3_200, electricalEfficiency: 0.28, thermalEfficiency: 0.44 },
  recip_engine: { label: "Reciprocating engine", installedCostPerKw: 2_500, electricalEfficiency: 0.37, thermalEfficiency: 0.45 },
  turbine: { label: "Combustion turbine", installedCostPerKw: 2_900, electricalEfficiency: 0.34, thermalEfficiency: 0.36 },
  fuel_cell: { label: "Fuel cell", installedCostPerKw: 5_500, electricalEfficiency: 0.47, thermalEfficiency: 0.32 },
  combined_cycle: { label: "Combined cycle", installedCostPerKw: 4_200, electricalEfficiency: 0.5, thermalEfficiency: 0.3 },
} as const;

export type ChpTechnology = keyof typeof CHP_TECHNOLOGIES;

export type ChpInput = {
  annualElectricKwh: number | string;
  annualGasDth: number | string;
  electricRatePerKwh: number | string;
  gasRatePerDth: number | string;
  peakDemandKw: number | string;
  thermalBaseloadMmbtuPerHour: number | string;
  hoursOfOperation: number | string;
  electricalEfficiencyPercent: number | string;
  thermalEfficiencyPercent: number | string;
  heatUtilizationPercent: number | string;
  baselineThermalEfficiencyPercent: number | string;
  maintenancePerKwh: number | string;
  demandRatePerKwMonth: number | string;
  standbyChargesAnnual: number | string;
  installedCostPerKw: number | string;
  incentivePerKw: number | string;
};

export type ChpResult = {
  recommendedKw: number;
  annualGenerationKwh: number;
  chpFuelInputDth: number;
  availableRecoveredHeatMmbtu: number;
  utilizedRecoveredHeatMmbtu: number;
  avoidedBoilerFuelDth: number;
  residualBoilerFuelDth: number;
  netIncrementalGasDth: number;
  avoidedElectricEnergyCost: number;
  avoidedDemandCost: number;
  incrementalGasCost: number;
  maintenanceCost: number;
  standbyCharges: number;
  annualSavings: number;
  grossCapitalCost: number;
  incentiveAmount: number;
  netCapitalCost: number;
  simplePaybackYears: number;
  electricOffsetPercent: number;
  heatUtilizationPercent: number;
};

export function roundChpSize(kw: number) {
  if (kw <= 0) return 0;
  if (kw < 100) return Math.round(kw / 5) * 5;
  if (kw <= 1_000) return Math.round(kw / 25) * 25;
  return Math.round(kw / 50) * 50;
}

function positive(value: number | string, fallback: number) {
  const parsed = nonNegative(parseNumberish(value));
  return parsed > 0 ? parsed : fallback;
}

export function calculateChp(input: ChpInput): ChpResult {
  const annualElectricKwh = nonNegative(parseNumberish(input.annualElectricKwh));
  const annualGasDth = nonNegative(parseNumberish(input.annualGasDth));
  const peakDemandKw = nonNegative(parseNumberish(input.peakDemandKw));
  const thermalBaseload = nonNegative(parseNumberish(input.thermalBaseloadMmbtuPerHour));
  const hours = Math.min(8_760, positive(input.hoursOfOperation, 1));
  const electricalEfficiency = Math.min(1, positive(input.electricalEfficiencyPercent, 1) / 100);
  const thermalEfficiency = Math.min(1, nonNegative(parseNumberish(input.thermalEfficiencyPercent)) / 100);
  const requestedHeatUtilization = Math.min(1, nonNegative(parseNumberish(input.heatUtilizationPercent)) / 100);
  const baselineThermalEfficiency = Math.min(
    1,
    positive(input.baselineThermalEfficiencyPercent, ENGINEERING_ASSUMPTIONS.defaultBoilerEfficiency * 100) / 100,
  );
  const heatRateBtuPerKwh = ENGINEERING_ASSUMPTIONS.btuPerKwh / electricalEfficiency;
  const recoverableMmbtuPerKwHour = (heatRateBtuPerKwh * thermalEfficiency) / 1_000_000;
  const averageElectricLoadKw = annualElectricKwh / hours;
  const thermalLimitedKw = recoverableMmbtuPerKwHour > 0
    ? thermalBaseload / recoverableMmbtuPerKwHour
    : 0;
  const recommendedKw = roundChpSize(
    Math.max(0, Math.min(averageElectricLoadKw, peakDemandKw * 0.8, thermalLimitedKw)),
  );
  const annualGenerationKwh = Math.min(annualElectricKwh, recommendedKw * hours);
  const chpFuelInputDth = (annualGenerationKwh * heatRateBtuPerKwh) / 1_000_000;
  const availableRecoveredHeatMmbtu = chpFuelInputDth * thermalEfficiency;
  const usefulHeatLimitMmbtu = Math.min(
    thermalBaseload * hours,
    annualGasDth * baselineThermalEfficiency,
  );
  const utilizedRecoveredHeatMmbtu = Math.min(
    availableRecoveredHeatMmbtu * requestedHeatUtilization,
    usefulHeatLimitMmbtu,
  );
  const avoidedBoilerFuelDth = Math.min(
    annualGasDth,
    utilizedRecoveredHeatMmbtu / baselineThermalEfficiency,
  );
  const residualBoilerFuelDth = Math.max(0, annualGasDth - avoidedBoilerFuelDth);
  const netIncrementalGasDth = chpFuelInputDth + residualBoilerFuelDth - annualGasDth;
  const avoidedElectricEnergyCost = annualGenerationKwh * nonNegative(parseNumberish(input.electricRatePerKwh));
  const avoidedDemandCost = Math.min(recommendedKw, peakDemandKw) * nonNegative(parseNumberish(input.demandRatePerKwMonth)) * 12;
  const incrementalGasCost = netIncrementalGasDth * nonNegative(parseNumberish(input.gasRatePerDth));
  const maintenanceCost = annualGenerationKwh * nonNegative(parseNumberish(input.maintenancePerKwh));
  const standbyCharges = nonNegative(parseNumberish(input.standbyChargesAnnual));
  const annualSavings = avoidedElectricEnergyCost + avoidedDemandCost - incrementalGasCost - maintenanceCost - standbyCharges;
  const grossCapitalCost = recommendedKw * nonNegative(parseNumberish(input.installedCostPerKw));
  const incentiveAmount = Math.min(grossCapitalCost, recommendedKw * nonNegative(parseNumberish(input.incentivePerKw)));
  const netCapitalCost = grossCapitalCost - incentiveAmount;
  const simplePaybackYears = annualSavings > 0 ? netCapitalCost / annualSavings : Number.POSITIVE_INFINITY;

  return {
    recommendedKw,
    annualGenerationKwh,
    chpFuelInputDth,
    availableRecoveredHeatMmbtu,
    utilizedRecoveredHeatMmbtu,
    avoidedBoilerFuelDth,
    residualBoilerFuelDth,
    netIncrementalGasDth,
    avoidedElectricEnergyCost,
    avoidedDemandCost,
    incrementalGasCost,
    maintenanceCost,
    standbyCharges,
    annualSavings,
    grossCapitalCost,
    incentiveAmount,
    netCapitalCost,
    simplePaybackYears,
    electricOffsetPercent: annualElectricKwh > 0 ? (annualGenerationKwh / annualElectricKwh) * 100 : 0,
    heatUtilizationPercent: availableRecoveredHeatMmbtu > 0
      ? (utilizedRecoveredHeatMmbtu / availableRecoveredHeatMmbtu) * 100
      : 0,
  };
}

export function deriveSimpleChpInputs(input: {
  buildingType: ChpBuildingType;
  annualElectricKwh: number | string;
  annualGasDth: number | string;
  baselineThermalEfficiencyPercent?: number | string;
}) {
  const archetype = CHP_BUILDING_ARCHETYPES[input.buildingType] ?? CHP_BUILDING_ARCHETYPES.other;
  const annualElectric = nonNegative(parseNumberish(input.annualElectricKwh));
  const annualGas = nonNegative(parseNumberish(input.annualGasDth));
  const baselineEfficiency = Math.min(
    1,
    positive(input.baselineThermalEfficiencyPercent ?? 82, 82) / 100,
  );
  return {
    peakDemandKw: annualElectric / (8_760 * archetype.loadFactor),
    thermalBaseloadMmbtuPerHour: (annualGas * baselineEfficiency) / archetype.hours,
    hoursOfOperation: archetype.hours,
  };
}
