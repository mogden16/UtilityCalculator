import { calculateConverter, type EnergyReference } from "@/lib/converter";

export const GAS_FLOW_UNIT_OPTIONS = [
  { value: "BTU/hr", label: "BTU/hr" },
  { value: "MBH", label: "MBH" },
  { value: "MMBtu/hr", label: "MMBtu/hr" },
  { value: "kW", label: "kW" },
  { value: "Therm/hr", label: "Therm/hr" },
  { value: "CFH", label: "CFH" },
] as const;

export type GasFlowUnit = (typeof GAS_FLOW_UNIT_OPTIONS)[number]["value"];

export type GasFlowInput = {
  value: number | string;
  unit: GasFlowUnit;
  energyReference: EnergyReference;
  efficiencyPercent?: number | string;
  hhv?: number | string;
  hours?: number | string;
};

function toConverterUnit(unit: GasFlowUnit) {
  if (unit === "MBH") {
    return "MBtu/hr" as const;
  }

  return unit;
}

export function calculateGasFlow(input: GasFlowInput) {
  const result = calculateConverter({
    value: input.value,
    unit: toConverterUnit(input.unit),
    energyReference: input.energyReference,
    efficiencyPercent: input.efficiencyPercent,
    hhv: input.hhv,
    hours: input.hours,
  });

  return {
    ...result,
    totalInputMmbtu: result.totalInputBtus / 1_000_000,
  };
}
