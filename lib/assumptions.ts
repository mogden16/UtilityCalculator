/**
 * Shared screening assumptions. Values are intentionally conservative and
 * editable in the UI; they are not utility tariffs or project guarantees.
 */
export const ENGINEERING_ASSUMPTIONS = {
  naturalGasHhvMmbtuPerMcf: 1.035,
  btuPerKwh: 3_412.142,
  btuPerTherm: 100_000,
  btuPerDth: 1_000_000,
  btuPerGallonNo2Oil: 138_500,
  btuPerGallonPropane: 91_452,
  defaultBoilerEfficiency: 0.82,
  defaultFurnaceEfficiency: 0.9,
  defaultChpHeatUtilization: 0.8,
  defaultTransmissionLossFraction: 0.05,
} as const;

export const ASSUMPTION_SOURCES = {
  fuelEnergy:
    "U.S. EIA, Energy Units and Calculators Explained (accessed October 2026); natural-gas HHV remains a user-overridable billing assumption.",
  combustionCo2:
    "U.S. EPA 2025 GHG Emission Factors Hub, stationary combustion; verify the current factor and fuel composition for reporting.",
  chp:
    "Technology performance and cost defaults are preliminary screening values and must be replaced with vendor and site data.",
} as const;
