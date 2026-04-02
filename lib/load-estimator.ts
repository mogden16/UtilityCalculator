import { BTU_PER_TON } from "@/lib/energy";
import { nonNegative, parseNumberish } from "@/lib/number";

export const LOAD_SCENARIOS = [
  { key: "tight", label: "Tight / New" },
  { key: "average", label: "Average (2000s)" },
  { key: "leaky", label: "Older / Leaky" },
] as const;

export type LoadScenarioKey = (typeof LOAD_SCENARIOS)[number]["key"];

export const LOAD_FACTORS: Record<LoadScenarioKey, { heat: number; cool: number }> = {
  tight: { heat: 25, cool: 15 },
  average: { heat: 30, cool: 20 },
  leaky: { heat: 40, cool: 28 },
};

export const APPLIANCE_ARCHETYPES = [
  { key: "res_furnace", name: "Residential furnace", range: [40000, 120000] as const, note: "Typical AFUE residential furnace input range." },
  { key: "unit_heater", name: "Unit heater", range: [30000, 400000] as const, note: "Warehouse and garage suspended unit heater range." },
  { key: "res_boiler", name: "Residential boiler", range: [60000, 200000] as const, note: "Hydronic boiler input range." },
  { key: "res_storage_wh", name: "Storage water heater", range: [30000, 75000] as const, note: "Residential tank-style water heater." },
  { key: "tankless_wh", name: "Tankless water heater", range: [150000, 199000] as const, note: "Typical condensing tankless unit." },
  { key: "comm_water_heater", name: "Commercial water heater", range: [199000, 1500000] as const, note: "Restaurant and multi-use commercial service." },
  { key: "rtu_gas_heat", name: "Commercial RTU gas heat", range: [100000, 1200000] as const, note: "Gas heat section within packaged HVAC units." },
  { key: "comm_boiler_small", name: "Commercial boiler (small)", range: [500000, 2000000] as const, note: "Schools and small commercial buildings." },
  { key: "comm_boiler_med", name: "Commercial boiler (medium)", range: [2000000, 10000000] as const, note: "Hospitals and larger institutional plants." },
  { key: "paint_booth", name: "Paint booth makeup air", range: [1000000, 5000000] as const, note: "Representative paint booth makeup air heater range." },
  { key: "industrial_proc", name: "Industrial process heater", range: [10000000, 100000000] as const, note: "Heavy industrial thermal process equipment." },
  { key: "range_6_burner", name: "Six-burner range", range: [60000, 210000] as const, note: "Foodservice range, rough burner aggregation." },
  { key: "griddle_comm", name: "Commercial griddle", range: [60000, 160000] as const, note: "Plate size and duty cycle drive the exact number." },
  { key: "fryer_comm", name: "Commercial fryer", range: [80000, 200000] as const, note: "Representative single-vat fryer range." },
  { key: "pizza_oven", name: "Pizza oven", range: [80000, 200000] as const, note: "Deck or stone oven depending on size." },
  { key: "chp_engine", name: "CHP engine/turbine", range: [1000000, 10000000] as const, note: "Thermal output band for packaged CHP systems." },
  { key: "fuel_cell", name: "Fuel cell CHP", range: [300000, 6000000] as const, note: "Thermal band for fuel-cell-based CHP systems." },
] as const;

export function formatArchetypeRange([min, max]: readonly [number, number]): string {
  return `${Math.round(min).toLocaleString()} - ${Math.round(max).toLocaleString()} BTU/hr`;
}

export function calculateLoadEstimate(input: {
  sqft: number | string;
  scenario: LoadScenarioKey;
  heatingOverride?: number | string;
  coolingOverride?: number | string;
}) {
  const defaults = LOAD_FACTORS[input.scenario] ?? LOAD_FACTORS.average;
  const area = nonNegative(parseNumberish(input.sqft));
  const defaultHeatingFactor = defaults.heat;
  const defaultCoolingFactor = defaults.cool;
  const heatingFactor =
    input.heatingOverride === "" || input.heatingOverride === undefined
      ? defaultHeatingFactor
      : nonNegative(parseNumberish(input.heatingOverride));
  const coolingFactor =
    input.coolingOverride === "" || input.coolingOverride === undefined
      ? defaultCoolingFactor
      : nonNegative(parseNumberish(input.coolingOverride));

  const heatBtuh = area * heatingFactor;
  const coolBtuh = area * coolingFactor;

  return {
    area,
    defaultHeatingFactor,
    defaultCoolingFactor,
    heatingFactor,
    coolingFactor,
    heatBtuh,
    coolBtuh,
    heatMbh: heatBtuh / 1_000,
    coolTons: coolBtuh / BTU_PER_TON,
  };
}

export function buildLoadScenarioChart(area: number, selectedScenario: LoadScenarioKey, selectedHeatingFactor: number, selectedCoolingFactor: number) {
  return LOAD_SCENARIOS.map((scenario) => {
    const defaults = LOAD_FACTORS[scenario.key];
    const heatingFactor = scenario.key === selectedScenario ? selectedHeatingFactor : defaults.heat;
    const coolingFactor = scenario.key === selectedScenario ? selectedCoolingFactor : defaults.cool;

    return {
      name: scenario.label,
      heating: area * heatingFactor,
      cooling: area * coolingFactor,
    };
  });
}
