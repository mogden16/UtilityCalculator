"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TEMPERATURE_OFFSETS = {
  freezingFahrenheit: 32,
  kelvinOffset: 273.15,
};

type CategoryKey = "energy" | "power" | "temperature" | "flow" | "pressure";

type UnitDefinition = {
  label: string;
  description?: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
};

type CategoryDefinition = {
  label: string;
  units: Record<string, UnitDefinition>;
  placeholder?: string;
};

const CATEGORY_DEFINITIONS: Record<CategoryKey, CategoryDefinition> = {
  energy: {
    label: "Energy",
    placeholder: "Enter energy value",
    units: {
      btu: {
        label: "BTU",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      therm: {
        label: "Therm",
        toBase: (value) => value * 100_000,
        fromBase: (value) => value / 100_000,
      },
      dth: {
        label: "Dth",
        toBase: (value) => value * 1_000_000,
        fromBase: (value) => value / 1_000_000,
      },
      mmbtu: {
        label: "MMBTU",
        toBase: (value) => value * 1_000_000,
        fromBase: (value) => value / 1_000_000,
      },
      kwh: {
        label: "kWh",
        toBase: (value) => value * 3_412,
        fromBase: (value) => value / 3_412,
      },
    },
  },
  power: {
    label: "Power",
    placeholder: "Enter power value",
    units: {
      btuperhour: {
        label: "BTU/hr",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      kw: {
        label: "kW",
        toBase: (value) => value * 3_412,
        fromBase: (value) => value / 3_412,
      },
      ton: {
        label: "Ton",
        toBase: (value) => value * 12_000,
        fromBase: (value) => value / 12_000,
      },
      hp: {
        label: "HP",
        toBase: (value) => value * 2_544,
        fromBase: (value) => value / 2_544,
      },
    },
  },
  temperature: {
    label: "Temperature",
    placeholder: "Enter temperature",
    units: {
      fahrenheit: {
        label: "°F",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      celsius: {
        label: "°C",
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
    placeholder: "Enter flow rate",
    units: {
      cfh: {
        label: "CFH",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      mcfh: {
        label: "MCFH",
        toBase: (value) => value * 1_000,
        fromBase: (value) => value / 1_000,
      },
      scfh: {
        label: "SCFH",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      mmbtuhr: {
        label: "MMBTU/hr",
        toBase: (value) => (value * 1_000) / 1.035,
        fromBase: (value) => (value * 1.035) / 1_000,
      },
    },
  },
  pressure: {
    label: "Pressure",
    placeholder: "Enter pressure",
    units: {
      psig: {
        label: "psig",
        toBase: (value) => value,
        fromBase: (value) => value,
      },
      psia: {
        label: "psia",
        toBase: (value) => value - 14.7,
        fromBase: (value) => value + 14.7,
      },
      inwc: {
        label: "inWC",
        toBase: (value) => value / 27.68,
        fromBase: (value) => value * 27.68,
      },
      kpa: {
        label: "kPa",
        toBase: (value) => value / 6.89476,
        fromBase: (value) => value * 6.89476,
      },
      bar: {
        label: "bar",
        toBase: (value) => value / 0.0689476,
        fromBase: (value) => value * 0.0689476,
      },
    },
  },
};

const parseNumericInput = (value: string) => {
  const sanitized = value.replace(/,/g, "").trim();
  if (!sanitized) return Number.NaN;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatResult = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

export default function ConversionPage() {
  const [category, setCategory] = useState<CategoryKey>("energy");
  const [fromUnit, setFromUnit] = useState<string>("btu");
  const [toUnit, setToUnit] = useState<string>("therm");
  const [inputValue, setInputValue] = useState<string>("1");

  const unitsForCategory = CATEGORY_DEFINITIONS[category].units;
  const unitEntries = useMemo(() => Object.entries(unitsForCategory), [unitsForCategory]);

  useEffect(() => {
    const unitKeys = unitEntries.map(([key]) => key);
    if (!unitKeys.includes(fromUnit) || !unitKeys.includes(toUnit)) {
      setFromUnit(unitKeys[0] ?? "");
      setToUnit(unitKeys[1] ?? unitKeys[0] ?? "");
    }
  }, [unitEntries, fromUnit, toUnit]);

  const conversion = useMemo(() => {
    const fromDefinition = unitsForCategory[fromUnit];
    const toDefinition = unitsForCategory[toUnit];
    if (!fromDefinition || !toDefinition) {
      return { formatted: "", numeric: undefined };
    }

    const numericValue = parseNumericInput(inputValue);
    if (!Number.isFinite(numericValue)) {
      return { formatted: "", numeric: undefined };
    }

    const baseValue = fromDefinition.toBase(numericValue);
    const converted = toDefinition.fromBase(baseValue);

    return {
      numeric: converted,
      formatted: formatResult(converted),
    };
  }, [inputValue, fromUnit, toUnit, unitsForCategory]);

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    if (conversion.numeric !== undefined && Number.isFinite(conversion.numeric)) {
      setInputValue(String(conversion.numeric));
    }
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto max-w-4xl space-y-8 py-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Universal Unit Converter</h1>
          <p className="text-muted-foreground">
            Quickly convert between common energy, power, temperature, flow, and pressure units.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Conversion Category</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select value={category} onValueChange={(value) => setCategory(value as CategoryKey)}>
                    <SelectTrigger id="category" className="w-full md:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_DEFINITIONS).map(([key, definition]) => (
                        <SelectItem key={key} value={key}>
                          {definition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
                <TooltipContent>
                  Choose the measurement family to update the available units.
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="input-value">Input Value</Label>
                  <Input
                    id="input-value"
                    inputMode="decimal"
                    placeholder={CATEGORY_DEFINITIONS[category].placeholder}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-unit">From Unit</Label>
                  <Select value={fromUnit} onValueChange={setFromUnit}>
                    <SelectTrigger id="from-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitEntries.map(([key, definition]) => (
                        <SelectItem key={key} value={key}>
                          {definition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-center pb-4 md:pb-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" onClick={handleSwap}>
                      Swap Units 🔄
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reverse the conversion direction.</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="output-value">Output Value</Label>
                  <Input id="output-value" readOnly value={conversion.formatted} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to-unit">To Unit</Label>
                  <Select value={toUnit} onValueChange={setToUnit}>
                    <SelectTrigger id="to-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitEntries.map(([key, definition]) => (
                        <SelectItem key={key} value={key}>
                          {definition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
