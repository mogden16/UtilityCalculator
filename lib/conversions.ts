import { parseFiniteOrNaN } from "@/lib/number";
import {
  BTU_PER_GALLON_OIL_NO2,
  BTU_PER_KW,
  BTU_PER_MLB,
  DEFAULT_HHV_MMBTU_PER_MCF,
} from "@/lib/energy";

const TEMPERATURE_OFFSETS = {
  freezingFahrenheit: 32,
  kelvinOffset: 273.15,
};

type UnitDefinition = {
  label: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
};

type CategoryDefinition = {
  label: string;
  placeholder: string;
  units: Record<string, UnitDefinition>;
};

export type ConversionCategoryKey = "energy" | "power" | "temperature" | "flow" | "pressure";

export const CONVERSION_CATEGORY_DEFINITIONS: Record<ConversionCategoryKey, CategoryDefinition> = {
  energy: {
    label: "Energy",
    placeholder: "Enter energy value",
    units: {
      btu: { label: "BTU", toBase: (value) => value, fromBase: (value) => value },
      therm: { label: "Therm", toBase: (value) => value * 100000, fromBase: (value) => value / 100000 },
      dth: { label: "Dth", toBase: (value) => value * 1000000, fromBase: (value) => value / 1000000 },
      mlb: { label: "MLB", toBase: (value) => value * BTU_PER_MLB, fromBase: (value) => value / BTU_PER_MLB },
      mmbtu: { label: "MMBtu", toBase: (value) => value * 1000000, fromBase: (value) => value / 1000000 },
      mcf: {
        label: "MCF",
        toBase: (value) => value * DEFAULT_HHV_MMBTU_PER_MCF * 1000000,
        fromBase: (value) => value / DEFAULT_HHV_MMBTU_PER_MCF / 1000000,
      },
      bcf: {
        label: "BCF",
        toBase: (value) => value * DEFAULT_HHV_MMBTU_PER_MCF * 1000000000000,
        fromBase: (value) => value / DEFAULT_HHV_MMBTU_PER_MCF / 1000000000000,
      },
      ccf: {
        label: "CCF",
        toBase: (value) => value * DEFAULT_HHV_MMBTU_PER_MCF * 100000,
        fromBase: (value) => value / DEFAULT_HHV_MMBTU_PER_MCF / 100000,
      },
      kwh: { label: "kWh", toBase: (value) => value * BTU_PER_KW, fromBase: (value) => value / BTU_PER_KW },
      oilno2: {
        label: "No. 2 Oil (gal)",
        toBase: (value) => value * BTU_PER_GALLON_OIL_NO2,
        fromBase: (value) => value / BTU_PER_GALLON_OIL_NO2,
      },
    },
  },
  power: {
    label: "Power",
    placeholder: "Enter power value",
    units: {
      btuperhour: { label: "BTU/hr", toBase: (value) => value, fromBase: (value) => value },
      kw: { label: "kW", toBase: (value) => value * BTU_PER_KW, fromBase: (value) => value / BTU_PER_KW },
      mw: { label: "MW", toBase: (value) => value * BTU_PER_KW * 1000, fromBase: (value) => value / BTU_PER_KW / 1000 },
      ton: { label: "Ton", toBase: (value) => value * 12000, fromBase: (value) => value / 12000 },
      hp: { label: "HP", toBase: (value) => value * 2544, fromBase: (value) => value / 2544 },
    },
  },
  temperature: {
    label: "Temperature",
    placeholder: "Enter temperature",
    units: {
      fahrenheit: { label: "deg F", toBase: (value) => value, fromBase: (value) => value },
      celsius: {
        label: "deg C",
        toBase: (value) => (value * 9) / 5 + TEMPERATURE_OFFSETS.freezingFahrenheit,
        fromBase: (value) => ((value - TEMPERATURE_OFFSETS.freezingFahrenheit) * 5) / 9,
      },
      kelvin: {
        label: "K",
        toBase: (value) => ((value - TEMPERATURE_OFFSETS.kelvinOffset) * 9) / 5 + TEMPERATURE_OFFSETS.freezingFahrenheit,
        fromBase: (value) => ((value - TEMPERATURE_OFFSETS.freezingFahrenheit) * 5) / 9 + TEMPERATURE_OFFSETS.kelvinOffset,
      },
    },
  },
  flow: {
    label: "Flow",
    placeholder: "Enter flow value",
    units: {
      cfh: { label: "CFH", toBase: (value) => value, fromBase: (value) => value },
      mcfh: { label: "MCFH", toBase: (value) => value * 1000, fromBase: (value) => value / 1000 },
      scfh: { label: "SCFH", toBase: (value) => value, fromBase: (value) => value },
      mmbtuhr: { label: "MMBtu/hr", toBase: (value) => (value * 1000) / 1.035, fromBase: (value) => (value * 1.035) / 1000 },
    },
  },
  pressure: {
    label: "Pressure",
    placeholder: "Enter pressure value",
    units: {
      psig: { label: "psig", toBase: (value) => value, fromBase: (value) => value },
      psia: { label: "psia", toBase: (value) => value - 14.7, fromBase: (value) => value + 14.7 },
      inwc: { label: "inWC", toBase: (value) => value / 27.68, fromBase: (value) => value * 27.68 },
      kpa: { label: "kPa", toBase: (value) => value / 6.89476, fromBase: (value) => value * 6.89476 },
      bar: { label: "bar", toBase: (value) => value / 0.0689476, fromBase: (value) => value * 0.0689476 },
    },
  },
};

export function getDefaultUnitsForCategory(category: ConversionCategoryKey) {
  const keys = Object.keys(CONVERSION_CATEGORY_DEFINITIONS[category].units);
  return {
    fromUnit: keys[0] ?? "",
    toUnit: keys[1] ?? keys[0] ?? "",
  };
}

export function parseConversionInput(value: string) {
  return parseFiniteOrNaN(value);
}

export function convertMeasurement(input: {
  category: ConversionCategoryKey;
  fromUnit: string;
  toUnit: string;
  value: number;
}) {
  const category = CONVERSION_CATEGORY_DEFINITIONS[input.category];
  const from = category.units[input.fromUnit];
  const to = category.units[input.toUnit];

  if (!from || !to) {
    return Number.NaN;
  }

  return to.fromBase(from.toBase(input.value));
}

export function formatConversionResult(value: number) {
  if (!Number.isFinite(value)) return "";
  const absolute = Math.abs(value);
  return value.toLocaleString(undefined, absolute > 0 && absolute < 0.01
    ? { minimumFractionDigits: 0, maximumFractionDigits: 8 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
