import {
  BTU_PER_DTH,
  BTU_PER_HP,
  BTU_PER_KW,
  BTU_PER_MLB,
  BTU_PER_THERM,
  BTU_PER_TON,
  COMMERCIAL_THRESHOLD_BTUH,
  DEFAULT_HHV_MMBTU_PER_MCF,
  RESIDENTIAL_THRESHOLD_BTUH,
} from "@/lib/energy";
import { nonNegative, parseNumberish } from "@/lib/number";

export const CONVERTER_UNIT_OPTIONS = [
  { value: "BTU/hr", label: "BTU/hr (demand)" },
  { value: "kW", label: "kW (demand)" },
  { value: "Ton", label: "Ton (cooling demand)" },
  { value: "HP", label: "HP (mechanical)" },
  { value: "Therm/hr", label: "Therm/hr (energy rate)" },
  { value: "DTH/hr", label: "Dth/hr (energy rate)" },
  { value: "Steam MLB/hr", label: "Steam MLB/hr" },
  { value: "MBtu/hr", label: "MBtu/hr" },
  { value: "MMBtu/hr", label: "MMBtu/hr" },
  { value: "CFH", label: "CFH" },
] as const;

export type ConverterUnit = (typeof CONVERTER_UNIT_OPTIONS)[number]["value"];
export type EnergyReference = "input" | "output";
export type LoadCategory = "Residential" | "Commercial" | "Industrial";

export type ConverterInput = {
  value: number | string;
  unit: ConverterUnit;
  energyReference: EnergyReference;
  efficiencyPercent?: number | string;
  hhv?: number | string;
  hours?: number | string;
};

export type ConverterResult = {
  category: LoadCategory;
  efficiencyPercent: number;
  hhv: number;
  hours: number;
  inputBtuh: number;
  outputBtuh: number;
  inputMbtuPerHour: number;
  kw: number;
  tons: number;
  hp: number;
  mlbPerHour: number;
  thermsPerHour: number;
  dthPerHour: number;
  cfh: number;
  mcfh: number;
  totalInputBtus: number;
  totalOutputBtus: number;
  totalInputMbtu: number;
  totalMcf: number;
  totalTherms: number;
  totalDth: number;
  totalKwh: number;
  totalTonHours: number;
  totalMlb: number;
};

function convertToBtuh(value: number, unit: ConverterUnit, hhv: number): number {
  switch (unit) {
    case "kW":
      return value * BTU_PER_KW;
    case "Ton":
      return value * BTU_PER_TON;
    case "HP":
      return value * BTU_PER_HP;
    case "Therm/hr":
      return value * BTU_PER_THERM;
    case "DTH/hr":
      return value * BTU_PER_DTH;
    case "Steam MLB/hr":
      return value * BTU_PER_MLB;
    case "MBtu/hr":
      return value * 1_000;
    case "MMBtu/hr":
      return value * 1_000_000;
    case "CFH":
      return value * hhv * 1_000;
    case "BTU/hr":
    default:
      return value;
  }
}

function resolveCategory(outputBtuh: number): LoadCategory {
  if (outputBtuh < RESIDENTIAL_THRESHOLD_BTUH) {
    return "Residential";
  }

  if (outputBtuh < COMMERCIAL_THRESHOLD_BTUH) {
    return "Commercial";
  }

  return "Industrial";
}

export function calculateConverter(input: ConverterInput): ConverterResult {
  const value = nonNegative(parseNumberish(input.value));
  const hhv = parseNumberish(input.hhv ?? DEFAULT_HHV_MMBTU_PER_MCF) || DEFAULT_HHV_MMBTU_PER_MCF;
  const hours = nonNegative(parseNumberish(input.hours ?? 0));
  const efficiencyPercent = nonNegative(parseNumberish(input.efficiencyPercent ?? 90)) || 90;
  const efficiencyDecimal = efficiencyPercent / 100;
  const baseBtuh = convertToBtuh(value, input.unit, hhv);

  const inputBtuh = input.energyReference === "input" ? baseBtuh : baseBtuh / Math.max(efficiencyDecimal, 0.000001);
  const outputBtuh = input.energyReference === "input" ? baseBtuh * efficiencyDecimal : baseBtuh;
  const kw = outputBtuh / BTU_PER_KW;
  const tons = outputBtuh / BTU_PER_TON;
  const hp = outputBtuh / BTU_PER_HP;
  const mlbPerHour = outputBtuh / BTU_PER_MLB;
  const thermsPerHour = inputBtuh / BTU_PER_THERM;
  const dthPerHour = inputBtuh / BTU_PER_DTH;
  const inputMbtuPerHour = inputBtuh / 1_000;
  const cfh = inputBtuh / (hhv * 1_000);

  return {
    category: resolveCategory(outputBtuh),
    efficiencyPercent,
    hhv,
    hours,
    inputBtuh,
    outputBtuh,
    inputMbtuPerHour,
    kw,
    tons,
    hp,
    mlbPerHour,
    thermsPerHour,
    dthPerHour,
    cfh,
    mcfh: cfh / 1_000,
    totalInputBtus: inputBtuh * hours,
    totalOutputBtus: outputBtuh * hours,
    totalInputMbtu: inputMbtuPerHour * hours,
    totalMcf: (cfh * hours) / 1_000,
    totalTherms: thermsPerHour * hours,
    totalDth: dthPerHour * hours,
    totalKwh: kw * hours,
    totalTonHours: tons * hours,
    totalMlb: mlbPerHour * hours,
  };
}
