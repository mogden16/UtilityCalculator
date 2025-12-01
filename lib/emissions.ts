export type FuelKey =
  | "coal"
  | "ngcc"
  | "ngsc"
  | "oil"
  | "nuclear"
  | "wind"
  | "solar"
  | "hydro"
  | "biomass";

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
};

export const DEFAULT_T_AND_D_LOSS_FRACTION = 0.05; // 5 percent

export const FUEL_DISPLAY_LABELS: Record<FuelKey, string> = {
  coal: "Coal",
  ngcc: "Natural Gas (CC)",
  ngsc: "Natural Gas (SC)",
  oil: "Oil",
  nuclear: "Nuclear",
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
  biomass: "Biomass",
};

const LB_PER_KG = 2.20462;
export const GAS_ENERGY_CONTENT_MMBTU_PER_MCF = 1.035;
export const DIRECT_CO2_LB_PER_MMBTU = 117;
export const KWH_PER_MMBTU = 293.1;
export const METHANE_KG_PER_MMBTU = 19.2; // approximate methane mass energy density per MMBtu

export function mapPjmFuelToFuelKey(raw: string | undefined): FuelKey {
  if (!raw) return "biomass";
  const candidate = raw.trim().toLowerCase();

  if (candidate.includes("coal")) return "coal";
  if (candidate.includes("nuc")) return "nuclear";
  if (candidate.includes("wind")) return "wind";
  if (candidate.includes("solar")) return "solar";
  if (candidate.includes("hyd")) return "hydro";
  if (candidate.includes("oil") || candidate.includes("diesel") || candidate.includes("pet")) return "oil";
  if (candidate.includes("bio")) return "biomass";
  if (candidate.includes("gas") || candidate.includes("ng")) return "ngcc";

  return "biomass";
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
} {
  const safeLoss = Math.min(Math.max(tAndDLossFraction, 0), 0.95);
  const totalMw = rows.reduce((sum, row) => (Number.isFinite(row.mw) ? sum + row.mw : sum), 0);

  if (totalMw <= 0) {
    return { rows: [], totalMw: 0, totalGenerationLbPerMwh: 0, totalDeliveredLbPerMwh: 0 };
  }

  const enrichedRows: FuelEmissionsRow[] = rows.map((row) => {
    const shareFraction = row.mw / totalMw;
    const emissionFactorLbPerMwh = EMISSION_FACTORS_LB_PER_MWH[row.fuelKey] ?? 0;
    const contributionLbPerMwh = shareFraction * emissionFactorLbPerMwh;
    return {
      ...row,
      shareFraction,
      sharePercent: shareFraction * 100,
      emissionFactorLbPerMwh,
      contributionLbPerMwh,
    };
  });

  const totalGenerationLbPerMwh = enrichedRows.reduce(
    (sum, row) => sum + row.contributionLbPerMwh,
    0,
  );

  const totalDeliveredLbPerMwh = totalGenerationLbPerMwh / (1 - safeLoss || 1);

  return { rows: enrichedRows, totalMw, totalGenerationLbPerMwh, totalDeliveredLbPerMwh };
}

export type LeakScenarioKey = "low" | "medium" | "high";

export interface LeakScenarioConfig {
  label: string;
  leakFraction: number;
  gwp: number;
}

export const LEAK_SCENARIOS: Record<LeakScenarioKey, LeakScenarioConfig> = {
  low: { label: "Low (1 percent, GWP 25)", leakFraction: 0.01, gwp: 25 },
  medium: { label: "Medium (3 percent, GWP 82)", leakFraction: 0.03, gwp: 82 },
  high: { label: "High (5 percent, GWP 100)", leakFraction: 0.05, gwp: 100 },
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
