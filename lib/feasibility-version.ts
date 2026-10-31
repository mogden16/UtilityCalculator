import type { FuelConversionInputs, UtilityRecord } from "@/lib/feasibility";

export type FeasibilityProjectIdentity = {
  name: string;
  facility: string;
  location: string;
  description: string;
};

export type FeasibilityVersionSet = {
  applicationVersion: string;
  projectSchemaVersion: string;
  calculationEngineVersion: string;
  assumptionSetVersion: string;
  reportTemplateVersion: string;
  buildCommit: string;
};

export type FeasibilityProvenance = FeasibilityVersionSet & {
  generatedAt: string;
  inputFingerprint: string;
  calculationMode: "monthly_utility_screening";
  sourceRecordCount: number;
  confirmedSourceRecordCount: number;
};

export type FeasibilityAssumptionReference = {
  id: string;
  label: string;
  defaultValue: number | string;
  unit: string;
  sourceTitle: string;
  sourceRevision: string;
  applicability: string;
  userEditable: boolean;
};

export type FeasibilityProjectDocument = {
  documentType: "utilitycalc-feasibility-project";
  schemaVersion: string;
  provenance: FeasibilityProvenance;
  project: FeasibilityProjectIdentity;
  utilityRecords: UtilityRecord[];
  scenarioInputs: FuelConversionInputs;
  recommendation: string;
  assumptionReferences: FeasibilityAssumptionReference[];
};

const applicationVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
const buildCommit = process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA || "local-build";

export const FEASIBILITY_VERSIONS: FeasibilityVersionSet = Object.freeze({
  applicationVersion,
  projectSchemaVersion: "1.0.0",
  calculationEngineVersion: "1.0.0",
  assumptionSetVersion: "2026.10.0",
  reportTemplateVersion: "1.0.0",
  buildCommit,
});

export const FEASIBILITY_ASSUMPTION_REFERENCES: FeasibilityAssumptionReference[] = [
  {
    id: "natural-gas-hhv",
    label: "Natural gas higher heating value",
    defaultValue: 1.035,
    unit: "MMBtu/MCF",
    sourceTitle: "U.S. EIA, Energy Units and Calculators Explained",
    sourceRevision: "accessed 2026-10",
    applicability: "Initial billing and fuel-conversion screening default; replace with utility billing data when available.",
    userEditable: true,
  },
  {
    id: "no2-oil-hhv",
    label: "No. 2 fuel oil higher heating value",
    defaultValue: 0.1385,
    unit: "MMBtu/gallon",
    sourceTitle: "U.S. EIA, Energy Units and Calculators Explained",
    sourceRevision: "accessed 2026-10",
    applicability: "Screening default; verify delivered fuel specification when material.",
    userEditable: true,
  },
  {
    id: "steam-supply-enthalpy",
    label: "Purchased steam supply enthalpy",
    defaultValue: 1_195,
    unit: "Btu/lb",
    sourceTitle: "Screening steam-state assumption; project steam tables required",
    sourceRevision: "assumption set 2026.10.0",
    applicability: "Preliminary purchased-steam screening only; verify pressure, quality, and superheat.",
    userEditable: true,
  },
  {
    id: "steam-condensate-enthalpy",
    label: "Condensate return enthalpy",
    defaultValue: 180,
    unit: "Btu/lb",
    sourceTitle: "Screening condensate-state assumption; project measurements required",
    sourceRevision: "assumption set 2026.10.0",
    applicability: "Preliminary purchased-steam screening only; verify return temperature and condensate disposition.",
    userEditable: true,
  },
  {
    id: "financial-sensitivity",
    label: "Conservative / optimistic sensitivity",
    defaultValue: "Savings -20%/+20%; capital +15%/-10%",
    unit: "scenario multipliers",
    sourceTitle: "UtilityCalc preliminary screening convention",
    sourceRevision: "calculation engine 1.0.0",
    applicability: "Illustrative sensitivity only; not a probabilistic risk model.",
    userEditable: false,
  },
];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function canonicalRecords(records: UtilityRecord[]) {
  return records
    .map(({ id: _id, ...record }) => record)
    .sort((first, second) => [first.accountId, first.utilityType, first.periodStart, first.periodEnd, first.source.locator].join("|")
      .localeCompare([second.accountId, second.utilityType, second.periodStart, second.periodEnd, second.source.locator].join("|")));
}

/** Stable FNV-1a checksum for reproducibility checks; not a security or tamper-evidence control. */
export function createInputFingerprint(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `UCFS-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export function createFeasibilityProvenance({
  project,
  records,
  inputs,
  recommendation,
  generatedAt,
}: {
  project: FeasibilityProjectIdentity;
  records: UtilityRecord[];
  inputs: FuelConversionInputs;
  recommendation: string;
  generatedAt: string;
}): FeasibilityProvenance {
  return {
    ...FEASIBILITY_VERSIONS,
    generatedAt,
    inputFingerprint: createInputFingerprint({
      project,
      utilityRecords: canonicalRecords(records),
      scenarioInputs: inputs,
      recommendation,
      versions: {
        projectSchemaVersion: FEASIBILITY_VERSIONS.projectSchemaVersion,
        calculationEngineVersion: FEASIBILITY_VERSIONS.calculationEngineVersion,
        assumptionSetVersion: FEASIBILITY_VERSIONS.assumptionSetVersion,
        reportTemplateVersion: FEASIBILITY_VERSIONS.reportTemplateVersion,
      },
    }),
    calculationMode: "monthly_utility_screening",
    sourceRecordCount: records.length,
    confirmedSourceRecordCount: records.filter((record) => record.source.confidence === "confirmed").length,
  };
}

export function createFeasibilityProjectDocument({
  project,
  records,
  inputs,
  recommendation,
  provenance,
}: {
  project: FeasibilityProjectIdentity;
  records: UtilityRecord[];
  inputs: FuelConversionInputs;
  recommendation: string;
  provenance: FeasibilityProvenance;
}): FeasibilityProjectDocument {
  return {
    documentType: "utilitycalc-feasibility-project",
    schemaVersion: FEASIBILITY_VERSIONS.projectSchemaVersion,
    provenance,
    project,
    utilityRecords: records,
    scenarioInputs: inputs,
    recommendation,
    assumptionReferences: FEASIBILITY_ASSUMPTION_REFERENCES,
  };
}
