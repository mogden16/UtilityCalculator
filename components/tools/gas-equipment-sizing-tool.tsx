"use client";

import { AlertTriangle, CheckCircle2, Copy, Gauge, Info, Network, Pipette, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolPageShell } from "@/components/tool-page-shell";
import {
  DEMAND_UNIT_OPTIONS,
  GAS_EQUIPMENT_AUDIT_SUMMARY,
  GAS_EQUIPMENT_SOURCE_MANIFEST,
  SERVICE_SOURCE_HEATING_VALUE_BTU_PER_CF,
  WEBSITE_DEFAULT_HEATING_VALUE_BTU_PER_CF,
  convertDemandToCfh,
  formatSourceReference,
  getMeterPressureOptions,
  getOverpressureSetting,
  getRegulatorInletRangeOptions,
  getRegulatorOutletOptions,
  getServiceSizeOptions,
  lookupMeters,
  lookupMixedPlasticService,
  lookupRegulators,
  lookupServiceCapacity,
  lookupConnectionGuideline,
  type DemandUnit,
  type EquipmentMode,
  type InstallationStatus,
  type PipeMaterial,
  type PressureClass,
  type PressureUnit,
  type RegulatorConfiguration,
} from "@/lib/gas-equipment-sizing";

type View = "service" | "meter" | "regulator" | "combined";

function numeric(value: string) {
  if (!value.trim()) return Number.NaN;
  return Number(value);
}

function formatNumber(value: number | undefined, maximumFractionDigits = 0) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function pressureInput(option: ReturnType<typeof getMeterPressureOptions>[number] | undefined) {
  if (!option) return null;
  return "value" in option.pressure
    ? { value: option.pressure.value, unit: option.pressure.unit }
    : { value: option.pressure.minimum, unit: option.pressure.unit };
}

export function GasEquipmentSizingTool() {
  const [view, setView] = useState<View>("service");
  const [demandValue, setDemandValue] = useState("310");
  const [demandUnit, setDemandUnit] = useState<DemandUnit>("CFH");
  const [heatingValue, setHeatingValue] = useState(String(WEBSITE_DEFAULT_HEATING_VALUE_BTU_PER_CF));

  const [serviceMode, setServiceMode] = useState<EquipmentMode>("find-minimum");
  const [serviceLength, setServiceLength] = useState("60");
  const [pressureClass, setPressureClass] = useState<PressureClass>("low");
  const [material, setMaterial] = useState<PipeMaterial>("plastic");
  const [installationStatus, setInstallationStatus] = useState<InstallationStatus>("new");
  const [selectedSizeId, setSelectedSizeId] = useState("");
  const [showMixedService, setShowMixedService] = useState(false);

  const meterPressureOptions = useMemo(() => getMeterPressureOptions(), []);
  const [meterPressureKey, setMeterPressureKey] = useState("inWC:4.5-8");
  const [minimumOperatingFlow, setMinimumOperatingFlow] = useState("");

  const inletRanges = useMemo(() => getRegulatorInletRangeOptions(), []);
  const [inletRangeLabel, setInletRangeLabel] = useState("1.5-5 PSIG");
  const outletOptions = useMemo(() => getRegulatorOutletOptions(inletRangeLabel), [inletRangeLabel]);
  const [outletKey, setOutletKey] = useState("inWC:7");
  const [regulatorConfiguration, setRegulatorConfiguration] = useState<RegulatorConfiguration>("fsd");
  const [connectionInletClass, setConnectionInletClass] = useState<PressureClass>("intermediate");
  const [connectionInletPressure, setConnectionInletPressure] = useState("3");
  const [connectionMeterSize, setConnectionMeterSize] = useState("1.5");

  const requiredCfh = useMemo(() => {
    try {
      return convertDemandToCfh(numeric(demandValue), demandUnit, numeric(heatingValue));
    } catch {
      return Number.NaN;
    }
  }, [demandUnit, demandValue, heatingValue]);

  const serviceSizes = useMemo(
    () => getServiceSizeOptions({ material, status: installationStatus, pressureClass }),
    [installationStatus, material, pressureClass],
  );
  const effectiveSelectedSize = serviceSizes.some((size) => size.id === selectedSizeId) ? selectedSizeId : serviceSizes[0]?.id ?? "";

  const serviceResult = useMemo(() => {
    if (!Number.isFinite(requiredCfh)) return null;
    try {
      return lookupServiceCapacity({
        requiredCfh,
        lengthFt: numeric(serviceLength),
        pressureClass,
        material,
        status: installationStatus,
        mode: serviceMode,
        selectedSizeId: effectiveSelectedSize,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to calculate service capacity." };
    }
  }, [effectiveSelectedSize, installationStatus, material, pressureClass, requiredCfh, serviceLength, serviceMode]);

  const mixedResult = useMemo(() => {
    if (!showMixedService || !Number.isFinite(requiredCfh)) return null;
    try {
      return lookupMixedPlasticService({ requiredCfh, lengthFt: numeric(serviceLength) });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to calculate the mixed service allowance." };
    }
  }, [requiredCfh, serviceLength, showMixedService]);

  const selectedMeterPressure = meterPressureOptions.find((option) => option.key === meterPressureKey);
  const meterPressure = pressureInput(selectedMeterPressure);
  const meterResult = useMemo(() => {
    if (!Number.isFinite(requiredCfh) || !meterPressure) return null;
    try {
      return lookupMeters({
        peakFlowCfh: requiredCfh,
        minimumOperatingFlowCfh: minimumOperatingFlow.trim() ? numeric(minimumOperatingFlow) : null,
        deliveryPressureValue: meterPressure.value,
        deliveryPressureUnit: meterPressure.unit,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to screen meters." };
    }
  }, [meterPressure, minimumOperatingFlow, requiredCfh]);

  const selectedOutlet = outletOptions.find((option) => `${option.unit}:${option.value}` === outletKey) ?? outletOptions[0];
  const regulatorResult = useMemo(() => {
    if (!Number.isFinite(requiredCfh) || !selectedOutlet) return null;
    try {
      return lookupRegulators({
        requiredCfh,
        configuration: regulatorConfiguration,
        outletPressureValue: selectedOutlet.value,
        outletPressureUnit: selectedOutlet.unit,
        inletRangeLabel,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to screen regulators." };
    }
  }, [inletRangeLabel, regulatorConfiguration, requiredCfh, selectedOutlet]);

  const connectionResult = useMemo(() => {
    if (!selectedOutlet) return null;
    try {
      return lookupConnectionGuideline({
        inletClass: connectionInletClass,
        inletPressurePsig: numeric(connectionInletPressure),
        outletPressureValue: selectedOutlet.value,
        outletPressureUnit: selectedOutlet.unit,
        meterSizeInches: numeric(connectionMeterSize),
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to evaluate connection guidance." };
    }
  }, [connectionInletClass, connectionInletPressure, connectionMeterSize, selectedOutlet]);

  const reset = () => {
    setDemandValue("310");
    setDemandUnit("CFH");
    setHeatingValue(String(WEBSITE_DEFAULT_HEATING_VALUE_BTU_PER_CF));
    setServiceMode("find-minimum");
    setServiceLength("60");
    setPressureClass("low");
    setMaterial("plastic");
    setInstallationStatus("new");
    setSelectedSizeId("");
    setShowMixedService(false);
    setMeterPressureKey("inWC:4.5-8");
    setMinimumOperatingFlow("");
    setInletRangeLabel("1.5-5 PSIG");
    setOutletKey("inWC:7");
    setRegulatorConfiguration("fsd");
    setConnectionInletClass("intermediate");
    setConnectionInletPressure("3");
    setConnectionMeterSize("1.5");
  };

  return (
    <ToolPageShell
      eyebrow="Preliminary engineering reference"
      title="Gas Service, Meter & Regulator Sizing"
      description="Screen tabulated service capacity and source-listed meter and regulator options. No interpolation, extrapolation, or technology preference is applied."
    >
      <DemandCard
        demandValue={demandValue}
        demandUnit={demandUnit}
        heatingValue={heatingValue}
        requiredCfh={requiredCfh}
        onDemandValue={setDemandValue}
        onDemandUnit={setDemandUnit}
        onHeatingValue={setHeatingValue}
        onReset={reset}
      />

      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
          <TabsTrigger value="service" className="min-h-10"><Pipette />Service</TabsTrigger>
          <TabsTrigger value="meter" className="min-h-10"><Gauge />Meter</TabsTrigger>
          <TabsTrigger value="regulator" className="min-h-10"><Settings2 />Regulator</TabsTrigger>
          <TabsTrigger value="combined" className="min-h-10"><Network />Combined</TabsTrigger>
        </TabsList>

        <TabsContent value="service">
          <ServiceSection
            {...{ serviceMode, serviceLength, pressureClass, material, installationStatus, effectiveSelectedSize, serviceSizes, serviceResult, mixedResult, showMixedService }}
            onMode={setServiceMode}
            onLength={setServiceLength}
            onPressureClass={setPressureClass}
            onMaterial={setMaterial}
            onStatus={setInstallationStatus}
            onSize={setSelectedSizeId}
            onMixed={setShowMixedService}
          />
        </TabsContent>
        <TabsContent value="meter">
          <MeterSection
            minimumOperatingFlow={minimumOperatingFlow}
            meterPressureKey={meterPressureKey}
            meterPressureOptions={meterPressureOptions}
            meterResult={meterResult}
            onMinimumFlow={setMinimumOperatingFlow}
            onPressure={setMeterPressureKey}
          />
        </TabsContent>
        <TabsContent value="regulator">
          <RegulatorSection
            inletRanges={inletRanges}
            inletRangeLabel={inletRangeLabel}
            outletOptions={outletOptions}
            outletKey={selectedOutlet ? `${selectedOutlet.unit}:${selectedOutlet.value}` : ""}
            configuration={regulatorConfiguration}
            regulatorResult={regulatorResult}
            selectedOutlet={selectedOutlet}
            connectionInletClass={connectionInletClass}
            connectionInletPressure={connectionInletPressure}
            connectionMeterSize={connectionMeterSize}
            connectionResult={connectionResult}
            onInletRange={(value: string) => {
              setInletRangeLabel(value);
              const first = getRegulatorOutletOptions(value)[0];
              if (first) setOutletKey(`${first.unit}:${first.value}`);
            }}
            onOutlet={setOutletKey}
            onConfiguration={setRegulatorConfiguration}
            onConnectionInletClass={setConnectionInletClass}
            onConnectionInletPressure={setConnectionInletPressure}
            onConnectionMeterSize={setConnectionMeterSize}
          />
        </TabsContent>
        <TabsContent value="combined" className="space-y-3">
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">One normalized demand flows through all three source lookups. Open a section to adjust its table-specific choices.</p>
          <Accordion type="multiple" defaultValue={["service", "meter", "regulator"]} className="rounded-xl border bg-card px-4">
            <AccordionItem value="service">
              <AccordionTrigger><span><span className="block font-semibold">1. Service sizing</span><span className="block text-xs font-normal text-muted-foreground">Length, material, pressure class, and installation status</span></span></AccordionTrigger>
              <AccordionContent>
                <ServiceSection compact {...{ serviceMode, serviceLength, pressureClass, material, installationStatus, effectiveSelectedSize, serviceSizes, serviceResult, mixedResult, showMixedService }} onMode={setServiceMode} onLength={setServiceLength} onPressureClass={setPressureClass} onMaterial={setMaterial} onStatus={setInstallationStatus} onSize={setSelectedSizeId} onMixed={setShowMixedService} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="meter">
              <AccordionTrigger><span><span className="block font-semibold">2. Meter selection</span><span className="block text-xs font-normal text-muted-foreground">Delivery pressure and customer minimum load</span></span></AccordionTrigger>
              <AccordionContent>
                <MeterSection compact minimumOperatingFlow={minimumOperatingFlow} meterPressureKey={meterPressureKey} meterPressureOptions={meterPressureOptions} meterResult={meterResult} onMinimumFlow={setMinimumOperatingFlow} onPressure={setMeterPressureKey} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="regulator">
              <AccordionTrigger><span><span className="block font-semibold">3. Regulator selection</span><span className="block text-xs font-normal text-muted-foreground">Exact inlet category, outlet setting, and arrangement</span></span></AccordionTrigger>
              <AccordionContent>
                <RegulatorSection compact inletRanges={inletRanges} inletRangeLabel={inletRangeLabel} outletOptions={outletOptions} outletKey={selectedOutlet ? `${selectedOutlet.unit}:${selectedOutlet.value}` : ""} configuration={regulatorConfiguration} regulatorResult={regulatorResult} selectedOutlet={selectedOutlet} connectionInletClass={connectionInletClass} connectionInletPressure={connectionInletPressure} connectionMeterSize={connectionMeterSize} connectionResult={connectionResult} onInletRange={(value: string) => { setInletRangeLabel(value); const first = getRegulatorOutletOptions(value)[0]; if (first) setOutletKey(`${first.unit}:${first.value}`); }} onOutlet={setOutletKey} onConfiguration={setRegulatorConfiguration} onConnectionInletClass={setConnectionInletClass} onConnectionInletPressure={setConnectionInletPressure} onConnectionMeterSize={setConnectionMeterSize} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>

      <SourceAndLimitations />
    </ToolPageShell>
  );
}

function DemandCard(props: {
  demandValue: string;
  demandUnit: DemandUnit;
  heatingValue: string;
  requiredCfh: number;
  onDemandValue: (value: string) => void;
  onDemandUnit: (value: DemandUnit) => void;
  onHeatingValue: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-3 px-4 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
          <Field label="Peak gas demand" htmlFor="equipment-demand">
            <Input id="equipment-demand" type="number" min="0" inputMode="decimal" value={props.demandValue} onChange={(event) => props.onDemandValue(event.target.value)} />
          </Field>
          <Field label="Demand unit">
            <Select value={props.demandUnit} onValueChange={(value) => props.onDemandUnit(value as DemandUnit)}>
              <SelectTrigger className="w-full" aria-label="Demand unit"><SelectValue /></SelectTrigger>
              <SelectContent>{DEMAND_UNIT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Button type="button" variant="outline" onClick={props.onReset}>Reset</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Normalized peak flow</span>
          <strong className="font-mono text-base">{Number.isFinite(props.requiredCfh) ? formatNumber(props.requiredCfh, 1) : "—"} CFH</strong>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="heating-value">
            <AccordionTrigger className="py-2 text-xs">Heating-value assumption</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <Field label="BTU per cubic foot" htmlFor="equipment-hhv"><Input id="equipment-hhv" type="number" min="1" inputMode="decimal" value={props.heatingValue} onChange={(event) => props.onHeatingValue(event.target.value)} /></Field>
              <p className="text-xs leading-5 text-muted-foreground">The website default is {WEBSITE_DEFAULT_HEATING_VALUE_BTU_PER_CF.toLocaleString()} BTU/CF. The service PDF example uses {SERVICE_SOURCE_HEATING_VALUE_BTU_PER_CF.toLocaleString()} BTU/CF. This assumption affects thermal-unit conversion only; tabulated service and equipment capacities remain in CFH.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ServiceSection(props: any) {
  const result = props.serviceResult;
  const isError = result && "error" in result;
  const mixed = props.mixedResult;
  return (
    <Card className={props.compact ? "border-0 py-1 shadow-none" : "mt-3 gap-4 py-4"}>
      {!props.compact ? <CardHeader className="px-4 sm:px-5"><CardTitle>Service capacity</CardTitle><CardDescription>Find the minimum listed size or check one existing service.</CardDescription></CardHeader> : null}
      <CardContent className="space-y-4 px-4 sm:px-5">
        <Segmented value={props.serviceMode} options={[{ value: "find-minimum", label: "Find minimum size" }, { value: "check-existing", label: "Check existing equipment" }]} onChange={props.onMode} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Service length" htmlFor={`service-length-${props.compact ? "combined" : "single"}`}><div className="relative"><Input id={`service-length-${props.compact ? "combined" : "single"}`} type="number" min="0" inputMode="decimal" value={props.serviceLength} onChange={(event) => props.onLength(event.target.value)} className="pr-10" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-muted-foreground">ft</span></div></Field>
          <SelectField label="Main pressure" value={props.pressureClass} onValueChange={props.onPressureClass} options={[{ value: "low", label: "Low" }, { value: "intermediate", label: "Intermediate" }, { value: "high", label: "High" }]} />
          <SelectField label="Pipe material" value={props.material} onValueChange={props.onMaterial} options={[{ value: "plastic", label: "Plastic" }, { value: "steel", label: "Steel" }]} />
          <SelectField label="Installation" value={props.installationStatus} onValueChange={props.onStatus} options={[{ value: "new", label: "New" }, { value: "existing", label: "Existing" }]} />
        </div>
        {props.serviceMode === "check-existing" ? <SelectField label="Specified pipe size" value={props.effectiveSelectedSize} onValueChange={props.onSize} options={props.serviceSizes.map((size: any) => ({ value: size.id, label: size.label }))} /> : null}
        {props.material === "plastic" && props.installationStatus === "new" && props.pressureClass === "low" ? <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm"><input type="checkbox" checked={props.showMixedService} onChange={(event) => props.onMixed(event.target.checked)} className="h-4 w-4" />Check permitted mixed 1-inch CTS / 1-1/4-inch IPS service</label> : null}
        {isError ? <StatusNotice tone="error" text={result.error} /> : result ? <ServiceResult result={result} /> : <StatusNotice tone="info" text="Enter a valid demand and service length to calculate." />}
        {props.showMixedService && mixed ? "error" in mixed ? <StatusNotice tone="error" text={mixed.error} /> : mixed.status === "qualified" ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Mixed-service allowance</p><p className="mt-1 text-xl font-semibold">{mixed.oneInchCtsFt} ft of 1-inch CTS</p><p className="text-sm text-muted-foreground">Remaining {mixed.oneAndQuarterInchIpsFt} ft uses 1-1/4-inch IPS. Lookup used {mixed.tabulatedLengthFt} ft and {mixed.tabulatedLoadCfh} CFH.</p></div> : <StatusNotice tone="warning" text={mixed.message} /> : null}
      </CardContent>
    </Card>
  );
}

function ServiceResult({ result }: { result: any }) {
  if (result.status === "out-of-table") return <StatusNotice tone="warning" text={result.message} />;
  const qualified = result.status === "qualified";
  const copy = `${qualified ? "Qualified" : "Not qualified"}: ${result.size.label}; ${formatNumber(result.capacityCfh)} CFH at ${result.tabulatedLengthFt} ft; ${formatNumber(result.utilizationPercent, 1)}% utilized; ${formatNumber(result.remainingCapacityCfh, 1)} CFH remaining.`;
  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-4 ${qualified ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{qualified ? "Qualifying service" : "Selected service"}</p><p className="mt-1 text-2xl font-semibold">{result.size.label}</p></div><CopyButton text={copy} /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm"><Metric label="Capacity" value={`${formatNumber(result.capacityCfh)} CFH`} /><Metric label="Utilization" value={`${formatNumber(result.utilizationPercent, 1)}%`} /><Metric label="Remaining" value={`${formatNumber(result.remainingCapacityCfh, 1)} CFH`} /></div>
      </div>
      {result.roundedLengthUp ? <StatusNotice tone="info" text={`Conservative length rule: ${result.requestedLengthFt} ft was rounded up to the ${result.tabulatedLengthFt} ft source row.`} /> : null}
      {result.sourceReviewRequired ? <StatusNotice tone="warning" text="This result uses a source row involved in a documented nonmonotonic sequence. The original value is preserved and requires engineering review." /> : null}
      <Details title={`Alternatives (${result.alternatives?.length ?? 0})`}><div className="grid gap-2 sm:grid-cols-2">{result.alternatives?.map((alternative: any) => <div key={alternative.id} className="rounded-lg border p-3"><strong>{alternative.label}</strong><span className="ml-2 text-muted-foreground">{formatNumber(alternative.capacityCfh)} CFH</span></div>)}</div></Details>
      {result.source ? <SourceLine source={result.source} /> : null}
    </div>
  );
}

function MeterSection(props: any) {
  const result = props.meterResult;
  return (
    <Card className={props.compact ? "border-0 py-1 shadow-none" : "mt-3 gap-4 py-4"}>
      {!props.compact ? <CardHeader className="px-4 sm:px-5"><CardTitle>Meter selection</CardTitle><CardDescription>Screen every family independently. Turbine rotor angles stay separate.</CardDescription></CardHeader> : null}
      <CardContent className="space-y-4 px-4 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Delivery pressure" value={props.meterPressureKey} onValueChange={props.onPressure} options={props.meterPressureOptions.map((option: any) => ({ value: option.key, label: `${option.pressure.label} ${option.pressure.unit === "inWC" ? "W.C." : ""}`.trim() }))} />
          <Field label="Minimum operating flow (optional)" htmlFor={`minimum-flow-${props.compact ? "combined" : "single"}`}><div className="relative"><Input id={`minimum-flow-${props.compact ? "combined" : "single"}`} type="number" min="0" inputMode="decimal" value={props.minimumOperatingFlow} onChange={(event) => props.onMinimumFlow(event.target.value)} className="pr-12" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-muted-foreground">CFH</span></div></Field>
        </div>
        {!result ? <StatusNotice tone="info" text="Enter valid flow and pressure inputs to screen meters." /> : "error" in result ? <StatusNotice tone="error" text={result.error} /> : result.status === "out-of-table" || result.status === "no-qualifying-meter" ? <StatusNotice tone="warning" text={result.message} /> : <div className="space-y-3"><StatusNotice tone="info" text={result.message} /><div className="grid gap-3 lg:grid-cols-2">{result.groups.map((group: any) => <MeterGroup key={group.key} group={group} />)}</div></div>}
      </CardContent>
    </Card>
  );
}

function MeterGroup({ group }: { group: any }) {
  const meter = group.smallest;
  const family = meter.family === "turbine" ? `Turbine · ${meter.configuration.rotorAngleDegrees}° rotor` : meter.family[0].toUpperCase() + meter.family.slice(1);
  const copy = `${family}: ${meter.model}, ${meter.nominalSize ?? "nominal size not stated"}; minimum ${meter.minimumFlowCfh ?? "not published"} CFH; maximum ${meter.maximumFlowCfh} CFH; ${meter.utilizationPercent.toFixed(1)}% utilized; ${meter.screeningStatus}.`;
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{family}</p><h3 className="mt-1 text-lg font-semibold">{meter.model}</h3><p className="text-sm text-muted-foreground">Smallest qualifying option in this family</p></div><CopyButton text={copy} /></div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><Metric label="Nominal size" value={meter.nominalSize ?? "Not stated"} /><Metric label="Minimum flow" value={meter.minimumFlowCfh == null ? "Not published" : `${formatNumber(meter.minimumFlowCfh)} CFH`} /><Metric label="Maximum flow" value={`${formatNumber(meter.maximumFlowCfh)} CFH`} /><Metric label="Utilization" value={`${formatNumber(meter.utilizationPercent, 1)}%`} /></dl>
      {meter.screeningStatus === "incomplete" ? <div className="mt-3"><StatusNotice tone="warning" text={`Incomplete screening: ${meter.incompleteReason}`} /></div> : <div className="mt-3"><StatusNotice tone="success" text="Both source minimum-flow and maximum-flow criteria are satisfied." /></div>}
      <SourceLine source={meter.source} />
      {group.alternatives.length ? <Details title={`Other qualifying alternatives (${group.alternatives.length})`}><div className="space-y-2">{group.alternatives.map((alternative: any) => <div key={`${alternative.model}-${alternative.maximumFlowCfh}`} className="rounded-lg bg-muted px-3 py-2"><strong>{alternative.model}</strong><span className="ml-2 text-muted-foreground">{formatNumber(alternative.maximumFlowCfh)} CFH max</span></div>)}</div></Details> : null}
    </div>
  );
}

function RegulatorSection(props: any) {
  const result = props.regulatorResult;
  const overpressure = props.selectedOutlet ? getOverpressureSetting(props.selectedOutlet.value, props.selectedOutlet.unit) : undefined;
  return (
    <Card className={props.compact ? "border-0 py-1 shadow-none" : "mt-3 gap-4 py-4"}>
      {!props.compact ? <CardHeader className="px-4 sm:px-5"><CardTitle>Regulator selection</CardTitle><CardDescription>Select the exact source category where inlet ranges overlap.</CardDescription></CardHeader> : null}
      <CardContent className="space-y-4 px-4 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Inlet-pressure range" value={props.inletRangeLabel} onValueChange={props.onInletRange} options={props.inletRanges.map((range: any) => ({ value: range.label, label: range.label }))} />
          <SelectField label="Required outlet pressure" value={props.outletKey} onValueChange={props.onOutlet} options={props.outletOptions.map((outlet: any) => ({ value: `${outlet.unit}:${outlet.value}`, label: outlet.label }))} />
          <SelectField label="Configuration" value={props.configuration} onValueChange={props.onConfiguration} options={[{ value: "fsd", label: "FSD regulator" }, { value: "pressure-force", label: "Worker / monitor" }]} />
        </div>
        {overpressure ? <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">DS14.9 monitor guidance: recommended {overpressure.recommendedMonitor.value} {overpressure.recommendedMonitor.unit}; maximum {overpressure.maximumMonitor.exclusive ? "less than " : ""}{overpressure.maximumMonitor.value} {overpressure.maximumMonitor.unit}.</p> : null}
        {!result ? <StatusNotice tone="info" text="Enter valid flow and pressure inputs to screen regulators." /> : "error" in result ? <StatusNotice tone="error" text={result.error} /> : result.status !== "results" ? <StatusNotice tone="warning" text={result.message} /> : <RegulatorResults result={result} />}
        <Details title="Threaded / welded connection guidance">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField label="Inlet class" value={props.connectionInletClass} onValueChange={props.onConnectionInletClass} options={[{ value: "low", label: "Low" }, { value: "intermediate", label: "Intermediate" }, { value: "high", label: "High" }]} />
              <Field label="Actual inlet pressure" htmlFor={`connection-inlet-${props.compact ? "combined" : "single"}`}><div className="relative"><Input id={`connection-inlet-${props.compact ? "combined" : "single"}`} type="number" min="0" inputMode="decimal" value={props.connectionInletPressure} onChange={(event) => props.onConnectionInletPressure(event.target.value)} className="pr-12" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-muted-foreground">psig</span></div></Field>
              <Field label="Meter nominal size" htmlFor={`connection-size-${props.compact ? "combined" : "single"}`}><div className="relative"><Input id={`connection-size-${props.compact ? "combined" : "single"}`} type="number" min="0" step="0.25" inputMode="decimal" value={props.connectionMeterSize} onChange={(event) => props.onConnectionMeterSize(event.target.value)} className="pr-10" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-muted-foreground">in</span></div></Field>
            </div>
            {props.connectionResult ? "error" in props.connectionResult ? <StatusNotice tone="error" text={props.connectionResult.error} /> : <StatusNotice tone={props.connectionResult.status === "source-qualified" ? "success" : "warning"} text={props.connectionResult.message} /> : null}
            <p className="text-xs leading-5 text-muted-foreground">DS14.9 rules can overlap or leave gaps. Any conflicting or unstated combination remains an engineering-review case.</p>
          </div>
        </Details>
      </CardContent>
    </Card>
  );
}

function RegulatorResults({ result }: { result: any }) {
  const arrangement = result.smallest;
  const copy = `${arrangement.configuration === "fsd" ? "FSD" : "Worker/monitor"} arrangement; ${formatNumber(arrangement.maximumCapacityCfh)} CFH maximum; ${arrangement.components.map((component: any) => `${component.role}: ${component.model}`).join(", ")}.`;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Smallest source-listed arrangement</p><p className="mt-1 text-2xl font-semibold">{formatNumber(arrangement.maximumCapacityCfh)} CFH</p></div><CopyButton text={copy} /></div>
        {arrangement.monitorSetpoint ? <p className="mt-2 text-sm text-muted-foreground">Monitor setpoint: {arrangement.monitorSetpoint}</p> : null}
        {arrangement.stepdownSetpoint ? <p className="mt-2 text-sm text-muted-foreground">Stepdown setpoint: {arrangement.stepdownSetpoint}</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{arrangement.components.map((component: any, index: number) => <RegulatorComponentCard key={`${component.role}-${index}`} component={component} />)}</div>
        <SourceLine source={arrangement.source} />
      </div>
      <p className="text-xs text-muted-foreground">Public results intentionally omit stock numbers and pricing. Those fields are not present in the client bundle.</p>
      {result.alternatives.length ? <Details title={`Other qualifying arrangements (${result.alternatives.length})`}><div className="grid gap-2 sm:grid-cols-2">{result.alternatives.map((alternative: any) => <div key={alternative.id} className="rounded-lg border p-3"><strong>{formatNumber(alternative.maximumCapacityCfh)} CFH</strong><p className="text-xs text-muted-foreground">{alternative.components.map((component: any) => component.model).join(" / ")}</p></div>)}</div></Details> : null}
    </div>
  );
}

function RegulatorComponentCard({ component }: { component: any }) {
  return <div className="rounded-lg border bg-card p-3 text-sm"><p className="font-semibold">{component.role ?? "Regulator"}: {component.model}</p><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><dt className="text-muted-foreground">Body</dt><dd>{component.bodySize ?? "—"}</dd><dt className="text-muted-foreground">Orifice</dt><dd>{component.orificeSize ?? "—"}</dd><dt className="text-muted-foreground">Diaphragm</dt><dd>{component.diaphragmSize ?? "—"}</dd><dt className="text-muted-foreground">Spring</dt><dd>{component.spring ?? "—"}</dd><dt className="text-muted-foreground">Protection / pilot</dt><dd>{component.protectionOrPilot ?? "—"}</dd><dt className="text-muted-foreground">Relief / pilot spring</dt><dd>{component.reliefOrPilotSpring ?? "—"}</dd></dl></div>;
}

function SourceAndLimitations() {
  return (
    <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
      <AccordionItem value="sources">
        <AccordionTrigger><span><span className="block font-semibold">Sources, assumptions & limitations</span><span className="block text-xs font-normal text-muted-foreground">{GAS_EQUIPMENT_AUDIT_SUMMARY.findingCount} documented source-data findings</span></span></AccordionTrigger>
        <AccordionContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>This application is a preliminary engineering reference. It uses only tabulated values, rounds service length and mixed-service demand up to conservative source rows, and does not interpolate or extrapolate.</p>
          <ul className="list-disc space-y-1 pl-5">
            {GAS_EQUIPMENT_SOURCE_MANIFEST.documents.map((document) => <li key={document.id}><span className="font-medium text-foreground">{document.title}</span>: {document.revision}</li>)}
          </ul>
          <p>Known nonmonotonic service values are preserved and flagged. Diaphragm minimum-flow limits are absent. Overlapping regulator inlet ranges require explicit selection. Pricing, source workbooks, source PDF, and regulator stock numbers are not published.</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function SelectField({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: any) => void; options: Array<{ value: string; label: string }> }) {
  return <Field label={label}><Select value={value} onValueChange={onValueChange}><SelectTrigger className="w-full" aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>;
}

function Segmented({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: any) => void }) {
  return <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="group" aria-label="Lookup mode">{options.map((option) => <Button key={option.value} type="button" variant={value === option.value ? "default" : "ghost"} className="min-h-10 whitespace-normal px-2" onClick={() => onChange(option.value)}>{option.label}</Button>)}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-muted px-2 py-2"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-medium">{value}</dd></div>;
}

function StatusNotice({ tone, text }: { tone: "success" | "warning" | "error" | "info"; text: string }) {
  const styles = tone === "success" ? "border-primary/25 bg-primary/5" : tone === "error" ? "border-destructive/30 bg-destructive/5" : tone === "warning" ? "border-amber-500/30 bg-amber-500/10" : "border-border bg-muted/50";
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  return <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${styles}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{text}</span></div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <Button type="button" variant="outline" size="icon-sm" aria-label="Copy result summary" onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}><Copy />{copied ? <span className="sr-only">Copied</span> : null}</Button>;
}

function Details({ title, children }: { title: string; children: ReactNode }) {
  return <Accordion type="single" collapsible><AccordionItem value="details"><AccordionTrigger className="py-2">{title}</AccordionTrigger><AccordionContent>{children}</AccordionContent></AccordionItem></Accordion>;
}

function SourceLine({ source }: { source: any }) {
  return <p className="mt-3 break-words text-xs leading-5 text-muted-foreground">Source: {formatSourceReference(source)}</p>;
}
