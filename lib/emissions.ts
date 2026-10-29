export type FuelKey =
  | "coal"
  | "ngcc"
  | "ngsc"
  | "oil"
  | "nuclear"
  | "wind"
  | "solar"
  | "hydro"
  | "biomass"
  | "unknown";

export const EMISSION_FACTORS_LB_PER_MWH: Record<FuelKey, number> = {
  coal: 2250,
  ngcc: 900,
  ngsc: 1150,
  oil: 2000,
  nuclear: 0,
  wind: 0,
  solar: 0,
  hydro: 0,
  biomass: 0, // treat biogenic CO2 as net zero for now
  unknown: Number.NaN,
};

export const DEFAULT_T_AND_D_LOSS_FRACTION = 0.05; // 5 percent

export const FUEL_DISPLAY_LABELS: Record<FuelKey, string> = {
  coal: "Coal",
  ngcc: "Natural Gas (Combined Cycle)",
  ngsc: "Natural Gas (Simple Cycle)",
  oil: "Oil",
  nuclear: "Nuclear",
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
  biomass: "Biomass",
  unknown: "Unknown / unclassified",
};

const LB_PER_KG = 2.20462;
export const GAS_ENERGY_CONTENT_MMBTU_PER_MCF = 1.035;
export const DIRECT_CO2_LB_PER_MMBTU = 117;
export const KWH_PER_MMBTU = 293.1;
export const METHANE_KG_PER_MMBTU = 19.2; // approximate methane mass energy density per MMBtu

export function mapPjmFuelToFuelKey(raw: string | undefined): FuelKey {
  if (!raw) return "unknown";
  const candidate = raw.trim().toLowerCase();

  if (candidate.includes("coal")) return "coal";
  if (candidate.includes("nuc")) return "nuclear";
  if (candidate.includes("wind")) return "wind";
  if (candidate.includes("solar")) return "solar";
  if (candidate.includes("hyd")) return "hydro";
  if (candidate.includes("oil") || candidate.includes("diesel") || candidate.includes("pet")) return "oil";
  if (candidate.includes("bio")) return "biomass";
  if (candidate.includes("gas") || candidate.includes("ng")) return "ngcc";

  return "unknown";
}

export interface FuelMixRow {
  fuelKey: FuelKey;
  label: string;
  mw: number;
}

export interface FuelEmissionsRow extends FuelMixRow {
  shareFraction: number;
  sharePercent: number;
  emissionFactorLbPerMwh: number;
  contributionLbPerMwh: number;
}

export function computeFuelEmissionsRows(
  rows: FuelMixRow[],
  tAndDLossFraction: number = DEFAULT_T_AND_D_LOSS_FRACTION,
): {
  rows: FuelEmissionsRow[];
  totalMw: number;
  totalGenerationLbPerMwh: number;
  totalDeliveredLbPerMwh: number;
  unknownMw: number;
  isComplete: boolean;
} {
  const safeLoss = Math.min(Math.max(tAndDLossFraction, 0), 0.95);
  const totalMw = rows.reduce((sum, row) => (Number.isFinite(row.mw) ? sum + row.mw : sum), 0);

  if (totalMw <= 0) {
    return { rows: [], totalMw: 0, totalGenerationLbPerMwh: 0, totalDeliveredLbPerMwh: 0, unknownMw: 0, isComplete: true };
  }

  const enrichedRows: FuelEmissionsRow[] = rows.map((row) => {
    const shareFraction = row.mw / totalMw;
    const emissionFactorLbPerMwh = EMISSION_FACTORS_LB_PER_MWH[row.fuelKey];
    const contributionLbPerMwh = Number.isFinite(emissionFactorLbPerMwh)
      ? shareFraction * emissionFactorLbPerMwh
      : Number.NaN;
    return {
      ...row,
      shareFraction,
      sharePercent: shareFraction * 100,
      emissionFactorLbPerMwh,
      contributionLbPerMwh,
    };
  });

  const totalGenerationLbPerMwh = enrichedRows.reduce(
    (sum, row) => Number.isFinite(row.contributionLbPerMwh) ? sum + row.contributionLbPerMwh : sum,
    0,
  );

  const totalDeliveredLbPerMwh = totalGenerationLbPerMwh / (1 - safeLoss || 1);

  const unknownMw = enrichedRows.reduce((sum, row) => Number.isFinite(row.emissionFactorLbPerMwh) ? sum : sum + row.mw, 0);
  return { rows: enrichedRows, totalMw, totalGenerationLbPerMwh, totalDeliveredLbPerMwh, unknownMw, isComplete: unknownMw === 0 };
}

export function compareHeatingEmissions(input: {
  deliveredHeatMmbtu: number;
  gasEfficiency: number;
  heatPumpCop: number;
  gridLbCo2ePerMwh: number;
  upstreamGasLbCo2ePerMmbtu?: number;
}) {
  const deliveredHeatMmbtu = Math.max(0, input.deliveredHeatMmbtu);
  const gasEfficiency = Math.max(0.01, input.gasEfficiency);
  const heatPumpCop = Math.max(0.01, input.heatPumpCop);
  const gasInputMmbtu = deliveredHeatMmbtu / gasEfficiency;
  const directGasLb = gasInputMmbtu * DIRECT_CO2_LB_PER_MMBTU;
  const upstreamGasLb = gasInputMmbtu * Math.max(0, input.upstreamGasLbCo2ePerMmbtu ?? 0);
  const electricInputKwh = (deliveredHeatMmbtu * KWH_PER_MMBTU) / heatPumpCop;
  const gridAverageLb = (electricInputKwh / 1_000) * Math.max(0, input.gridLbCo2ePerMwh);
  return { deliveredHeatMmbtu, gasInputMmbtu, directGasLb, upstreamGasLb, totalGasLb: directGasLb + upstreamGasLb, electricInputKwh, gridAverageLb };
}

export type LeakScenarioKey = "low" | "medium" | "high";

export interface LeakScenarioConfig {
  label: string;
  leakFraction: number;
  gwp: number;
}

export const LEAK_SCENARIOS: Record<LeakScenarioKey, LeakScenarioConfig> = {
  low: { label: "Low leakage (1% leaked, 100-yr warming impact)", leakFraction: 0.01, gwp: 25 },
  medium: { label: "Medium leakage (3% leaked, 20-yr warming impact)", leakFraction: 0.03, gwp: 82 },
  high: { label: "High leakage (5% leaked, worst-case warming)", leakFraction: 0.05, gwp: 100 },
};

export interface GasEmissionsBreakdown {
  scenarioKey: LeakScenarioKey;
  directCo2LbPerMmbtu: number;
  methaneCo2eLbPerMmbtu: number;
  totalCo2eLbPerMmbtu: number;
  totalCo2eLbPerMcf: number;
  totalCo2eLbPerKwh: number;
  directCo2LbPerKwh: number;
}

export function computeGasEmissionsForScenario(scenarioKey: LeakScenarioKey): GasEmissionsBreakdown {
  const scenario = LEAK_SCENARIOS[scenarioKey];
  const directCo2LbPerMmbtu = DIRECT_CO2_LB_PER_MMBTU;
  const methaneKgPerMmbtu = METHANE_KG_PER_MMBTU * scenario.leakFraction;
  const methaneCo2eKgPerMmbtu = methaneKgPerMmbtu * scenario.gwp;
  const methaneCo2eLbPerMmbtu = methaneCo2eKgPerMmbtu * LB_PER_KG;
  const totalCo2eLbPerMmbtu = directCo2LbPerMmbtu + methaneCo2eLbPerMmbtu;
  const totalCo2eLbPerMcf = totalCo2eLbPerMmbtu * GAS_ENERGY_CONTENT_MMBTU_PER_MCF;
  const totalCo2eLbPerKwh = totalCo2eLbPerMmbtu / KWH_PER_MMBTU;
  const directCo2LbPerKwh = directCo2LbPerMmbtu / KWH_PER_MMBTU;

  return {
    scenarioKey,
    directCo2LbPerMmbtu,
    methaneCo2eLbPerMmbtu,
    totalCo2eLbPerMmbtu,
    totalCo2eLbPerMcf,
    totalCo2eLbPerKwh,
    directCo2LbPerKwh,
  };
}

export function prettyFuelLabel(fuelKey: FuelKey): string {
  return FUEL_DISPLAY_LABELS[fuelKey] ?? fuelKey;
}
