"use client";

import { useEffect, useMemo, useState } from "react";

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

  return (
    <ToolPageShell
      eyebrow="Primary Tool"
      title="Unit Conversions"
      description="Focused conversion workspace for energy, power, temperature, flow, and pressure."
    >
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label>Conversion category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ConversionCategoryKey)}>
              <SelectTrigger className="max-w-xs">
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
                <Label>Input value</Label>
                <Input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={CONVERSION_CATEGORY_DEFINITIONS[category].placeholder}
                />
              </div>
              <div className="space-y-2">
                <Label>From unit</Label>
                <Select value={fromUnit} onValueChange={setFromUnit}>
                  <SelectTrigger>
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
                <Label>Output value</Label>
                <Input
                  readOnly
                  value={conversion === undefined ? "" : formatConversionResult(conversion)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>To unit</Label>
                <Select value={toUnit} onValueChange={setToUnit}>
                  <SelectTrigger>
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
    </ToolPageShell>
  );
}
