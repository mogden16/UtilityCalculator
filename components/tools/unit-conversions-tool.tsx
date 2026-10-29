"use client";

import { useEffect, useMemo, useState } from "react";

import { CalculationActions } from "@/components/calculation-actions";
import { ResultSummary } from "@/components/result-summary";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONVERSION_CATEGORY_DEFINITIONS,
  convertMeasurement,
  formatConversionResult,
  getDefaultUnitsForCategory,
  parseConversionInput,
  type ConversionCategoryKey,
} from "@/lib/conversions";

export function UnitConversionsTool() {
  const [category, setCategory] = useState<ConversionCategoryKey>("energy");
  const defaults = getDefaultUnitsForCategory(category);
  const [fromUnit, setFromUnit] = useState(defaults.fromUnit);
  const [toUnit, setToUnit] = useState(defaults.toUnit);
  const [inputValue, setInputValue] = useState("1");

  useEffect(() => {
    const nextDefaults = getDefaultUnitsForCategory(category);
    setFromUnit(nextDefaults.fromUnit);
    setToUnit(nextDefaults.toUnit);
  }, [category]);

  const unitEntries = Object.entries(CONVERSION_CATEGORY_DEFINITIONS[category].units);

  const conversion = useMemo(() => {
    const numericValue = parseConversionInput(inputValue);
    if (!Number.isFinite(numericValue)) {
      return undefined;
    }

    return convertMeasurement({
      category,
      fromUnit,
      toUnit,
      value: numericValue,
    });
  }, [category, fromUnit, inputValue, toUnit]);

  const changeFromUnit = (nextUnit: string) => {
    const numericValue = parseConversionInput(inputValue);
    if (Number.isFinite(numericValue)) {
      const preservedValue = convertMeasurement({ category, fromUnit, toUnit: nextUnit, value: numericValue });
      setInputValue(String(preservedValue));
    }
    setFromUnit(nextUnit);
  };

  const reset = () => {
    setCategory("energy");
    const next = getDefaultUnitsForCategory("energy");
    setFromUnit(next.fromUnit);
    setToUnit(next.toUnit);
    setInputValue("1");
  };

  return (
    <ToolPageShell
      eyebrow="Quick utility"
      title="Unit Conversions"
      description="Focused conversion workspace for energy, power, temperature, flow, and pressure."
    >
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="conversion-category">Conversion category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ConversionCategoryKey)}>
              <SelectTrigger id="conversion-category" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONVERSION_CATEGORY_DEFINITIONS).map(([key, definition]) => (
                  <SelectItem key={key} value={key}>
                    {definition.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="conversion-input">Input value</Label>
                <Input
                  id="conversion-input"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={CONVERSION_CATEGORY_DEFINITIONS[category].placeholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversion-from-unit">From unit</Label>
                <Select value={fromUnit} onValueChange={changeFromUnit}>
                  <SelectTrigger id="conversion-from-unit">
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

            <div className="flex justify-center pb-4 md:pb-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFromUnit(toUnit);
                  setToUnit(fromUnit);
                  if (conversion !== undefined) {
                    setInputValue(String(conversion));
                  }
                }}
              >
                Swap units
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="conversion-output">Output value</Label>
                <Input
                  id="conversion-output"
                  readOnly
                  value={conversion === undefined ? "" : formatConversionResult(conversion)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conversion-to-unit">To unit</Label>
                <Select value={toUnit} onValueChange={setToUnit}>
                  <SelectTrigger id="conversion-to-unit">
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
      <ResultSummary
        label="Converted value"
        value={conversion === undefined ? "—" : formatConversionResult(conversion)}
        unit={unitEntries.find(([key]) => key === toUnit)?.[1].label}
        detail={`${inputValue || "—"} ${unitEntries.find(([key]) => key === fromUnit)?.[1].label} equals the displayed result.`}
        actions={<CalculationActions compact copyText={`${inputValue} ${unitEntries.find(([key]) => key === fromUnit)?.[1].label} = ${conversion === undefined ? "—" : formatConversionResult(conversion)} ${unitEntries.find(([key]) => key === toUnit)?.[1].label}`} onReset={reset} />}
      />
    </ToolPageShell>
  );
}
