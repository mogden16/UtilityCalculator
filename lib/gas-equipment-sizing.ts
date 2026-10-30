import auditData from "@/data/gas-equipment/audit-report.json";
import connectionData from "@/data/gas-equipment/connection-guidelines.json";
import meterData from "@/data/gas-equipment/meters.json";
import regulatorData from "@/data/gas-equipment/regulators-public.json";
import serviceData from "@/data/gas-equipment/service-capacity.json";
import sourceManifest from "@/data/gas-equipment/source-manifest.json";

export type DemandUnit = "CFH" | "BTU/h" | "MBH" | "MMBtu/h" | "MCFH";
export type PressureUnit = "inWC" | "psig";
export type PressureClass = "low" | "intermediate" | "high";
export type PipeMaterial = "plastic" | "steel";
export type InstallationStatus = "new" | "existing";
export type EquipmentMode = "find-minimum" | "check-existing";
export type MeterFamily = "diaphragm" | "rotary" | "turbine";
export type RegulatorConfiguration = "fsd" | "pressure-force";

type SourceReference = {
  document: string;
  page?: number;
  worksheet?: string;
  table?: string;
  rowLabel?: string;
  pressureCell?: string;
  minimumFlowCell?: string;
  maximumFlowCell?: string;
  capacityCell?: string;
  sectionCell?: string;
};

type ServiceSize = { id: string; label: string; sourceColumn: string };
type ServiceRow = {
  lengthFt: number;
  capacitiesCfh: Record<string, number>;
  source: SourceReference;
};
type ServiceTable = {
  id: string;
  material: PipeMaterial;
  status: InstallationStatus;
  pressureClass: PressureClass;
  sizes: ServiceSize[];
  rows: ServiceRow[];
  assumptions: Record<string, unknown>;
  source: SourceReference;
};

type PressureDefinition =
  | { label: string; unit: PressureUnit; value: number }
  | { label: string; unit: PressureUnit; minimum: number; maximum: number };

type MeterRecord = {
  family: MeterFamily;
  configuration: { rotorAngleDegrees: 30 | 45 } | null;
  model: string;
  nominalSize: string | null;
  pressure: PressureDefinition;
  pressureKey: string;
  minimumFlowCfh: number | null;
  maximumFlowCfh: number;
  source: SourceReference;
};

type RegulatorComponent = {
  role: string | null;
  model: string | null;
  bodySize: string | null;
  orificeSize: string | null;
  diaphragmSize: string | null;
  spring: string | null;
  protectionOrPilot: string | null;
  reliefOrPilotSpring: string | null;
};

type RegulatorRecord = {
  id: string;
  inletRange: { label: string; minimumPsig: number; maximumPsig: number };
  outletPressure: { label: string; value: number; unit: PressureUnit };
  configuration: RegulatorConfiguration;
  maximumCapacityCfh: number;
  monitorSetpoint: string | null;
  stepdownSetpoint: string | null;
  components: RegulatorComponent[];
  source: SourceReference;
  restrictedFieldsOmitted: string[];
};

const SERVICE_TABLES = serviceData.tables as ServiceTable[];
const METER_RECORDS = meterData.records as MeterRecord[];
const REGULATOR_RECORDS = regulatorData.records as RegulatorRecord[];

export const GAS_EQUIPMENT_SOURCE_MANIFEST = sourceManifest;
export const GAS_EQUIPMENT_AUDIT_SUMMARY = auditData.summary;
export const WEBSITE_DEFAULT_HEATING_VALUE_BTU_PER_CF = sourceManifest.websiteDemandHeatingValueBtuPerCf;
export const SERVICE_SOURCE_HEATING_VALUE_BTU_PER_CF = sourceManifest.servicePdfExampleHeatingValueBtuPerCf;

export const DEMAND_UNIT_OPTIONS: Array<{ value: DemandUnit; label: string }> = [
  { value: "CFH", label: "CFH" },
  { value: "BTU/h", label: "BTU/h" },
  { value: "MBH", label: "MBH" },
  { value: "MMBtu/h", label: "MMBtu/h" },
  { value: "MCFH", label: "MCFH" },
];

export function convertDemandToCfh(value: number, unit: DemandUnit, heatingValueBtuPerCf = WEBSITE_DEFAULT_HEATING_VALUE_BTU_PER_CF) {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Gas demand must be greater than zero.");
  if (!Number.isFinite(heatingValueBtuPerCf) || heatingValueBtuPerCf <= 0) throw new Error("Heating value must be greater than zero.");
  if (unit === "CFH") return value;
  if (unit === "MCFH") return value * 1_000;
  if (unit === "BTU/h") return value / heatingValueBtuPerCf;
  if (unit === "MBH") return (value * 1_000) / heatingValueBtuPerCf;
  return (value * 1_000_000) / heatingValueBtuPerCf;
}

function sourceRevision(documentId: string) {
  return sourceManifest.documents.find((document) => document.id === documentId)?.revision ?? "Revision not stated";
}

export function formatSourceReference(source: SourceReference) {
  const parts = [sourceManifest.documents.find((document) => document.id === source.document)?.title ?? source.document];
  if (source.page) parts.push(`page ${source.page}`);
  if (source.worksheet) parts.push(`worksheet ${source.worksheet}`);
  if (source.table) parts.push(source.table);
  if (source.rowLabel) parts.push(source.rowLabel);
  const cells = [source.capacityCell, source.maximumFlowCell, source.minimumFlowCell, source.pressureCell].filter(Boolean);
  if (cells.length) parts.push(`cells ${cells.join(", ")}`);
  return `${parts.join(" · ")} · ${sourceRevision(source.document)}`;
}

function findServiceTable(input: { material: PipeMaterial; status: InstallationStatus; pressureClass: PressureClass }) {
  return SERVICE_TABLES.find(
    (table) => table.material === input.material && table.status === input.status && table.pressureClass === input.pressureClass,
  );
}

function serviceFindingApplies(tableId: string, lengthFt: number, sizeLabel: string) {
  return auditData.findings.some((finding) => {
    if (finding.type !== "nonmonotonic-length-capacity" || !("table" in finding) || finding.table !== tableId) return false;
    if (!("size" in finding) || finding.size !== sizeLabel) return false;
    if (!("previous" in finding) || !("current" in finding)) return false;
    return finding.previous?.lengthFt === lengthFt || finding.current?.lengthFt === lengthFt;
  });
}

export type ServiceLookupResult = {
  status: "qualified" | "not-qualified" | "out-of-table";
  message: string;
  requiredCfh: number;
  requestedLengthFt: number;
  tabulatedLengthFt?: number;
  roundedLengthUp?: boolean;
  size?: ServiceSize;
  capacityCfh?: number;
  utilizationPercent?: number;
  remainingCapacityCfh?: number;
  assumptions?: Record<string, unknown>;
  source?: SourceReference;
  sourceReviewRequired?: boolean;
  alternatives?: Array<ServiceSize & { capacityCfh: number; utilizationPercent: number }>;
};

export function lookupServiceCapacity(input: {
  requiredCfh: number;
  lengthFt: number;
  pressureClass: PressureClass;
  material: PipeMaterial;
  status: InstallationStatus;
  mode?: EquipmentMode;
  selectedSizeId?: string;
}): ServiceLookupResult {
  if (!Number.isFinite(input.requiredCfh) || input.requiredCfh <= 0) throw new Error("Required CFH must be greater than zero.");
  if (!Number.isFinite(input.lengthFt) || input.lengthFt <= 0) throw new Error("Service length must be greater than zero.");
  const table = findServiceTable(input);
  if (!table) throw new Error("No source table matches the selected service conditions.");
  const firstLength = table.rows[0]?.lengthFt;
  const lastLength = table.rows.at(-1)?.lengthFt;
  if (firstLength === undefined || lastLength === undefined || input.lengthFt < firstLength || input.lengthFt > lastLength) {
    return {
      status: "out-of-table",
      message: `The source table covers ${firstLength ?? "?"}-${lastLength ?? "?"} ft. No extrapolation was applied.`,
      requiredCfh: input.requiredCfh,
      requestedLengthFt: input.lengthFt,
    };
  }
  const row = table.rows.find((candidate) => candidate.lengthFt >= input.lengthFt);
  if (!row) {
    return { status: "out-of-table", message: "No conservative table length is available.", requiredCfh: input.requiredCfh, requestedLengthFt: input.lengthFt };
  }
  const mode = input.mode ?? "find-minimum";
  const candidates = table.sizes.map((size) => ({
    ...size,
    capacityCfh: row.capacitiesCfh[size.id],
    utilizationPercent: (input.requiredCfh / row.capacitiesCfh[size.id]) * 100,
  }));
  const selected = mode === "check-existing"
    ? candidates.find((candidate) => candidate.id === input.selectedSizeId)
    : candidates.find((candidate) => candidate.capacityCfh >= input.requiredCfh);
  if (mode === "check-existing" && !selected) throw new Error("Select a pipe size listed in the source table.");
  if (!selected) {
    return {
      status: "out-of-table",
      message: "The required flow exceeds every tabulated size for these conditions. Engineering review is required.",
      requiredCfh: input.requiredCfh,
      requestedLengthFt: input.lengthFt,
      tabulatedLengthFt: row.lengthFt,
      roundedLengthUp: row.lengthFt !== input.lengthFt,
      assumptions: table.assumptions,
      source: row.source,
    };
  }
  const qualified = selected.capacityCfh >= input.requiredCfh;
  return {
    status: qualified ? "qualified" : "not-qualified",
    message: qualified ? "Capacity meets or exceeds the required flow." : "The selected service does not meet the required flow.",
    requiredCfh: input.requiredCfh,
    requestedLengthFt: input.lengthFt,
    tabulatedLengthFt: row.lengthFt,
    roundedLengthUp: row.lengthFt !== input.lengthFt,
    size: selected,
    capacityCfh: selected.capacityCfh,
    utilizationPercent: selected.utilizationPercent,
    remainingCapacityCfh: selected.capacityCfh - input.requiredCfh,
    assumptions: table.assumptions,
    source: row.source,
    sourceReviewRequired: serviceFindingApplies(table.id, row.lengthFt, selected.label),
    alternatives: candidates.filter((candidate) => candidate.capacityCfh >= input.requiredCfh),
  };
}

export function getServiceSizeOptions(input: { material: PipeMaterial; status: InstallationStatus; pressureClass: PressureClass }) {
  return findServiceTable(input)?.sizes ?? [];
}

export function lookupMixedPlasticService(input: { requiredCfh: number; lengthFt: number }) {
  const table = serviceData.mixedPlastic;
  if (!Number.isFinite(input.requiredCfh) || input.requiredCfh <= 0) throw new Error("Required CFH must be greater than zero.");
  if (!Number.isFinite(input.lengthFt) || input.lengthFt <= 0) throw new Error("Service length must be greater than zero.");
  const firstLength = table.rows[0]?.lengthFt;
  const lastLength = table.rows.at(-1)?.lengthFt;
  const firstLoad = table.loadColumnsCfh[0];
  const lastLoad = table.loadColumnsCfh.at(-1);
  if (input.lengthFt < firstLength || input.lengthFt > (lastLength ?? 0) || input.requiredCfh < firstLoad || input.requiredCfh > (lastLoad ?? 0)) {
    return {
      status: "out-of-table" as const,
      message: `The mixed-service source table covers ${firstLength}-${lastLength} ft and ${firstLoad}-${lastLoad} CFH. No extrapolation was applied.`,
    };
  }
  const row = table.rows.find((candidate) => candidate.lengthFt >= input.lengthFt);
  const loadColumn = table.loadColumnsCfh.find((candidate) => candidate >= input.requiredCfh);
  if (!row || loadColumn === undefined) return { status: "out-of-table" as const, message: "No conservative mixed-service table cell is available." };
  const oneInchCtsFt = (row.allowedOneInchCtsFtByLoadCfh as Record<string, number>)[String(loadColumn)];
  return {
    status: "qualified" as const,
    requestedLengthFt: input.lengthFt,
    requestedCfh: input.requiredCfh,
    tabulatedLengthFt: row.lengthFt,
    tabulatedLoadCfh: loadColumn,
    oneInchCtsFt,
    oneAndQuarterInchIpsFt: row.lengthFt - oneInchCtsFt,
    roundedLengthUp: row.lengthFt !== input.lengthFt,
    roundedLoadUp: loadColumn !== input.requiredCfh,
    assumptions: table.assumptions,
    source: row.source as SourceReference,
  };
}

function convertPressure(value: number, from: PressureUnit, to: PressureUnit) {
  if (from === to) return value;
  return from === "psig" ? value * 27.68 : value / 27.68;
}

function pressureMatches(source: PressureDefinition, inputValue: number, inputUnit: PressureUnit) {
  const normalized = convertPressure(inputValue, inputUnit, source.unit);
  if ("value" in source) return Math.abs(normalized - source.value) < 0.002;
  return normalized >= source.minimum - 0.002 && normalized <= source.maximum + 0.002;
}

export function getMeterPressureOptions() {
  const options = new Map<string, PressureDefinition>();
  for (const record of METER_RECORDS) options.set(record.pressureKey, record.pressure);
  return [...options.entries()].map(([key, pressure]) => ({ key, pressure }));
}

export type MeterCandidate = MeterRecord & {
  utilizationPercent: number;
  screeningStatus: "qualified" | "incomplete";
  incompleteReason?: string;
};

export function lookupMeters(input: {
  peakFlowCfh: number;
  minimumOperatingFlowCfh?: number | null;
  deliveryPressureValue: number;
  deliveryPressureUnit: PressureUnit;
  families?: MeterFamily[];
  rotorAngles?: Array<30 | 45>;
}) {
  if (!Number.isFinite(input.peakFlowCfh) || input.peakFlowCfh <= 0) throw new Error("Peak flow must be greater than zero.");
  if (!Number.isFinite(input.deliveryPressureValue) || input.deliveryPressureValue < 0) throw new Error("Delivery pressure must be zero or greater.");
  if (input.minimumOperatingFlowCfh != null && (!Number.isFinite(input.minimumOperatingFlowCfh) || input.minimumOperatingFlowCfh < 0)) {
    throw new Error("Minimum operating flow must be zero or greater.");
  }
  const families = input.families ?? ["diaphragm", "rotary", "turbine"];
  const matchingPressure = METER_RECORDS.filter((record) =>
    families.includes(record.family)
    && pressureMatches(record.pressure, input.deliveryPressureValue, input.deliveryPressureUnit)
    && (record.family !== "turbine" || !input.rotorAngles?.length || input.rotorAngles.includes(record.configuration!.rotorAngleDegrees)),
  );
  if (!matchingPressure.length) {
    return { status: "out-of-table" as const, message: "The delivery pressure does not match a source table row. No interpolation was applied.", groups: [] };
  }
  const candidates: MeterCandidate[] = [];
  for (const record of matchingPressure) {
    if (record.maximumFlowCfh < input.peakFlowCfh) continue;
    if (input.minimumOperatingFlowCfh != null && record.minimumFlowCfh != null && input.minimumOperatingFlowCfh < record.minimumFlowCfh) continue;
    const incompleteReason = input.minimumOperatingFlowCfh == null
      ? "Customer minimum load was not provided."
      : record.minimumFlowCfh == null
        ? "The source does not provide a minimum-flow limit for this meter family."
        : undefined;
    candidates.push({
      ...record,
      utilizationPercent: (input.peakFlowCfh / record.maximumFlowCfh) * 100,
      screeningStatus: incompleteReason ? "incomplete" : "qualified",
      ...(incompleteReason ? { incompleteReason } : {}),
    });
  }
  const groupKey = (record: MeterRecord) => record.family === "turbine" ? `turbine-${record.configuration?.rotorAngleDegrees}` : record.family;
  const grouped = new Map<string, MeterCandidate[]>();
  for (const candidate of candidates) {
    const key = groupKey(candidate);
    const group = grouped.get(key) ?? [];
    group.push(candidate);
    grouped.set(key, group);
  }
  const groups = [...grouped.entries()].map(([key, values]) => {
    values.sort((left, right) => left.maximumFlowCfh - right.maximumFlowCfh || (left.minimumFlowCfh ?? 0) - (right.minimumFlowCfh ?? 0));
    return { key, smallest: values[0], alternatives: values.slice(1) };
  });
  return {
    status: groups.length ? "results" as const : "no-qualifying-meter" as const,
    message: groups.length ? "Qualifying options are grouped by meter family; no technology preference is implied." : "No source-listed meter meets the supplied minimum and maximum flow criteria.",
    groups,
  };
}

export function getRegulatorInletRangeOptions() {
  const options = new Map<string, RegulatorRecord["inletRange"]>();
  for (const record of REGULATOR_RECORDS) options.set(record.inletRange.label, record.inletRange);
  return [...options.values()];
}

export function getRegulatorOutletOptions(inletRangeLabel: string) {
  const options = new Map<string, RegulatorRecord["outletPressure"]>();
  for (const record of REGULATOR_RECORDS) {
    if (record.inletRange.label === inletRangeLabel) options.set(`${record.outletPressure.unit}:${record.outletPressure.value}`, record.outletPressure);
  }
  return [...options.values()];
}

export function lookupRegulators(input: {
  requiredCfh: number;
  configuration: RegulatorConfiguration;
  outletPressureValue: number;
  outletPressureUnit: PressureUnit;
  inletRangeLabel?: string;
  inletPressurePsig?: number;
}) {
  if (!Number.isFinite(input.requiredCfh) || input.requiredCfh <= 0) throw new Error("Required CFH must be greater than zero.");
  let inletLabels: string[];
  if (input.inletRangeLabel) {
    inletLabels = [input.inletRangeLabel];
  } else if (input.inletPressurePsig != null && Number.isFinite(input.inletPressurePsig)) {
    inletLabels = getRegulatorInletRangeOptions()
      .filter((range) => input.inletPressurePsig! >= range.minimumPsig && input.inletPressurePsig! <= range.maximumPsig)
      .map((range) => range.label);
    if (inletLabels.length > 1) {
      return { status: "ambiguous-inlet-range" as const, message: `The inlet pressure appears in ${inletLabels.length} source categories. Select the intended inlet-pressure range.`, inletLabels, results: [] };
    }
  } else {
    throw new Error("Select a source inlet-pressure range.");
  }
  const matchedCategory = REGULATOR_RECORDS.filter((record) =>
    inletLabels.includes(record.inletRange.label)
    && record.configuration === input.configuration
    && Math.abs(convertPressure(input.outletPressureValue, input.outletPressureUnit, record.outletPressure.unit) - record.outletPressure.value) < 0.002,
  );
  if (!matchedCategory.length) {
    return { status: "out-of-table" as const, message: "No source category matches the selected inlet range, outlet pressure, and configuration. No pressure interpolation was applied.", results: [] };
  }
  const results = matchedCategory.filter((record) => record.maximumCapacityCfh >= input.requiredCfh).sort((a, b) => a.maximumCapacityCfh - b.maximumCapacityCfh);
  return {
    status: results.length ? "results" as const : "no-qualifying-regulator" as const,
    message: results.length ? "Source-listed arrangements meeting the required maximum flow." : "No source-listed arrangement meets the required maximum flow in this exact category.",
    smallest: results[0],
    alternatives: results.slice(1),
    results,
  };
}

type ConnectionRule = (typeof connectionData.connectionRules)[number];

function rulePressureMatches(rule: ConnectionRule, input: { inletPressurePsig: number; outletPressureValue: number; outletPressureUnit: PressureUnit }) {
  if ("minimumInletPsig" in rule && typeof rule.minimumInletPsig === "number") {
    const passes = "minimumInletExclusive" in rule && rule.minimumInletExclusive
      ? input.inletPressurePsig > rule.minimumInletPsig
      : input.inletPressurePsig >= rule.minimumInletPsig;
    if (!passes) return false;
  }
  const outletPsig = convertPressure(input.outletPressureValue, input.outletPressureUnit, "psig");
  if ("maximumOutlet" in rule && rule.maximumOutlet) {
    const maximumPsig = convertPressure(rule.maximumOutlet.value, rule.maximumOutlet.unit as PressureUnit, "psig");
    if (rule.maximumOutlet.inclusive ? outletPsig > maximumPsig + 0.002 : outletPsig >= maximumPsig - 0.002) return false;
  }
  if ("minimumOutlet" in rule && rule.minimumOutlet) {
    const minimumPsig = convertPressure(rule.minimumOutlet.value, rule.minimumOutlet.unit as PressureUnit, "psig");
    if (rule.minimumOutlet.exclusive ? outletPsig <= minimumPsig + 0.002 : outletPsig < minimumPsig - 0.002) return false;
  }
  return true;
}

export function lookupConnectionGuideline(input: {
  inletClass: PressureClass;
  inletPressurePsig: number;
  outletPressureValue: number;
  outletPressureUnit: PressureUnit;
  meterSizeInches: number;
}) {
  if (!Number.isFinite(input.inletPressurePsig) || input.inletPressurePsig < 0) throw new Error("Inlet pressure must be zero or greater.");
  if (!Number.isFinite(input.outletPressureValue) || input.outletPressureValue < 0) throw new Error("Outlet pressure must be zero or greater.");
  if (!Number.isFinite(input.meterSizeInches) || input.meterSizeInches <= 0) throw new Error("Meter size must be greater than zero.");
  const matches = connectionData.connectionRules.filter((rule) => {
    if ("inletClasses" in rule && rule.inletClasses && !rule.inletClasses.includes(input.inletClass)) return false;
    if ("minimumMeterSizeInches" in rule && typeof rule.minimumMeterSizeInches === "number" && input.meterSizeInches < rule.minimumMeterSizeInches) return false;
    if ("maximumMeterSizeInches" in rule && typeof rule.maximumMeterSizeInches === "number" && input.meterSizeInches > rule.maximumMeterSizeInches) return false;
    return rulePressureMatches(rule, input);
  });
  const connectionTypes = [...new Set(matches.map((rule) => rule.connection))];
  return {
    status: connectionTypes.length === 1 ? "source-qualified" as const : "engineering-review" as const,
    connection: connectionTypes.length === 1 ? connectionTypes[0] : null,
    message: connectionTypes.length === 1
      ? `The source guideline indicates a ${connectionTypes[0]} connection.`
      : matches.length
        ? "Source rules overlap with conflicting connection types. Engineering review is required."
        : "The source guideline does not state a rule for this combination. Engineering review is required.",
    matches,
    source: connectionData.source,
  };
}

export function getOverpressureSetting(outletPressureValue: number, outletPressureUnit: PressureUnit) {
  return connectionData.overpressureSettings.find((setting) =>
    Math.abs(convertPressure(outletPressureValue, outletPressureUnit, setting.customerDelivery.unit as PressureUnit) - setting.customerDelivery.value) < 0.002,
  );
}

export function parseNominalSizeInches(label: string | null | undefined) {
  if (!label) return null;
  const mixed = label.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = label.match(/(\d+)\/(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const numeric = label.match(/\d+(?:\.\d+)?/);
  return numeric ? Number(numeric[0]) : null;
}
