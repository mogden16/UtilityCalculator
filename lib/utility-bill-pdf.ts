import {
  UTILITY_UNITS,
  type UtilityFieldEvidence,
  type UtilityFieldKey,
  type UtilityRecord,
  type UtilityType,
  type UtilityUnit,
} from "@/lib/feasibility";

export const PDF_EXTRACTION_VERSION = "1.0.0";
export const MAX_PDF_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 40;

export type PdfTextLine = {
  page: number;
  line: number;
  text: string;
  x?: number;
  y?: number;
};

export type PdfBillDraft = {
  id: string;
  fileName: string;
  pageCount: number;
  accountId: string;
  utilityType: UtilityType | "";
  periodStart: string;
  periodEnd: string;
  usage: string;
  usageUnit: UtilityUnit | "";
  totalCost: string;
  energyCost: string;
  demandCost: string;
  otherCost: string;
  demandKw: string;
  estimated: boolean;
  tariffName: string;
  evidence: Partial<Record<UtilityFieldKey, UtilityFieldEvidence>>;
  warnings: string[];
};

type Candidate<T> = {
  value: T;
  score: number;
  evidence: UtilityFieldEvidence;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const DATE_TOKEN = "(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2},?\\s+\\d{4})";
const BILLING_PERIOD_PATTERN = new RegExp(`(?:billing|service|meter|statement)\\s*(?:period|dates?)?\\s*[:#-]?\\s*(${DATE_TOKEN})\\s*(?:to|through|thru|-|\\u2013|\\u2014)\\s*(${DATE_TOKEN})`, "i");

function normalizeLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function evidence(fileName: string, line: PdfTextLine): UtilityFieldEvidence {
  return {
    page: line.page,
    line: line.line,
    locator: `${fileName}, page ${line.page}, line ${line.line}`,
    excerpt: normalizeLine(line.text).slice(0, 240),
  };
}

function numberValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isoDate(value: string): string | undefined {
  const numeric = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const year = Number(numeric[3]);
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
    return undefined;
  }
  const named = value.trim().replace(/,/g, "").match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (!named) return undefined;
  const month = MONTHS[named[1].toLowerCase()];
  const day = Number(named[2]);
  const year = Number(named[3]);
  if (!month) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function best<T>(candidates: Candidate<T>[]): Candidate<T> | undefined {
  return [...candidates].sort((first, second) => second.score - first.score || first.evidence.page - second.evidence.page || first.evidence.line - second.evidence.line)[0];
}

function labeledAmount(lines: PdfTextLine[], fileName: string, labels: RegExp, baseScore = 0): Candidate<number> | undefined {
  const candidates: Candidate<number>[] = [];
  for (const line of lines) {
    const text = normalizeLine(line.text);
    if (!labels.test(text)) continue;
    const amounts = [...text.matchAll(/\$\s*([0-9][\d,]*(?:\.\d{1,2})?)\b/g)];
    const fallbackAmounts = amounts.length ? amounts : [...text.matchAll(/\b([0-9][\d,]*\.\d{2})\b/g)];
    const match = fallbackAmounts.at(-1);
    if (!match) continue;
    const value = numberValue(match[1]);
    if (value === undefined) continue;
    candidates.push({ value, score: baseScore + (text.includes("$") ? 2 : 0), evidence: evidence(fileName, line) });
  }
  return best(candidates);
}

function accountCandidate(lines: PdfTextLine[], fileName: string): Candidate<string> | undefined {
  const candidates: Candidate<string>[] = [];
  const pattern = /(?:account\s*(?:number|no\.?|#|id)|customer\s*(?:number|no\.?|#|id))\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,30})\b/i;
  for (const line of lines) {
    const match = normalizeLine(line.text).match(pattern);
    if (match) candidates.push({ value: match[1].trim(), score: 5, evidence: evidence(fileName, line) });
  }
  return best(candidates);
}

function periodCandidates(lines: PdfTextLine[], fileName: string) {
  const candidates: Array<{ start: string; end: string; evidence: UtilityFieldEvidence; score: number }> = [];
  for (const line of lines) {
    const text = normalizeLine(line.text);
    const match = text.match(BILLING_PERIOD_PATTERN);
    if (!match) continue;
    const start = isoDate(match[1]);
    const end = isoDate(match[2]);
    if (start && end && start <= end) candidates.push({ start, end, score: /billing period/i.test(text) ? 6 : 5, evidence: evidence(fileName, line) });
  }
  return candidates.sort((first, second) => second.score - first.score || first.evidence.page - second.evidence.page)[0];
}

const USAGE_PATTERNS: Array<{ utilityType: UtilityType; unit: UtilityUnit; pattern: RegExp }> = [
  { utilityType: "electricity", unit: "kwh", pattern: /\b([0-9][\d,]*(?:\.\d+)?)\s*kwh\b/i },
  { utilityType: "natural_gas", unit: "mcf", pattern: /\b([0-9][\d,]*(?:\.\d+)?)\s*mcf\b/i },
  { utilityType: "natural_gas", unit: "dth", pattern: /\b([0-9][\d,]*(?:\.\d+)?)\s*(?:dth|dekatherms?)\b/i },
  { utilityType: "natural_gas", unit: "therm", pattern: /\b([0-9][\d,]*(?:\.\d+)?)\s*therms?\b/i },
  { utilityType: "purchased_steam", unit: "mlb", pattern: /\b([0-9][\d,]*(?:\.\d+)?)\s*(?:mlb|m\s*lbs?)\b/i },
  { utilityType: "fuel_oil_no2", unit: "gallon", pattern: /\b([0-9][\d,]*(?:\.\d+)?)\s*(?:gallons?|gal)\b/i },
];

function usageCandidates(lines: PdfTextLine[], fileName: string): Candidate<{ usage: number; utilityType: UtilityType; unit: UtilityUnit }>[] {
  const candidates: Candidate<{ usage: number; utilityType: UtilityType; unit: UtilityUnit }>[] = [];
  for (const line of lines) {
    const text = normalizeLine(line.text);
    for (const item of USAGE_PATTERNS) {
      const match = text.match(item.pattern);
      if (!match) continue;
      const usage = numberValue(match[1]);
      if (usage === undefined) continue;
      let score = 1;
      if (/usage|consumption|used|metered|current/i.test(text)) score += 5;
      if (/total/i.test(text)) score += 2;
      if (/rate|price|per\s+(?:kwh|mcf|dth|therm|gallon)|\//i.test(text)) score -= 5;
      if (text.includes("$")) score -= 3;
      candidates.push({ value: { usage, utilityType: item.utilityType, unit: item.unit }, score, evidence: evidence(fileName, line) });
    }
  }
  return candidates.sort((first, second) => second.score - first.score || first.evidence.page - second.evidence.page || first.evidence.line - second.evidence.line);
}

function demandCandidate(lines: PdfTextLine[], fileName: string): Candidate<number> | undefined {
  const candidates: Candidate<number>[] = [];
  for (const line of lines) {
    const text = normalizeLine(line.text);
    if (!/demand/i.test(text) || /demand\s+charge/i.test(text)) continue;
    const match = text.match(/\b([0-9][\d,]*(?:\.\d+)?)\s*(?:kw|kilowatts?)\b/i);
    const value = match ? numberValue(match[1]) : undefined;
    if (value !== undefined) candidates.push({ value, score: /billing|peak|maximum/i.test(text) ? 5 : 3, evidence: evidence(fileName, line) });
  }
  return best(candidates);
}

function tariffCandidate(lines: PdfTextLine[], fileName: string): Candidate<string> | undefined {
  const candidates: Candidate<string>[] = [];
  const pattern = /(?:rate\s*(?:class|schedule)?|tariff|service\s+classification)\s*[:#-]\s*([A-Z0-9][A-Z0-9 .\-/]{1,35})/i;
  for (const line of lines) {
    const match = normalizeLine(line.text).match(pattern);
    if (match) candidates.push({ value: match[1].trim().replace(/[|;].*$/, ""), score: 4, evidence: evidence(fileName, line) });
  }
  return best(candidates);
}

export function parsePdfBillText({ fileName, pageCount, lines, id }: { fileName: string; pageCount: number; lines: PdfTextLine[]; id: string }): PdfBillDraft {
  const normalized = lines.map((line) => ({ ...line, text: normalizeLine(line.text) })).filter((line) => line.text.length > 0);
  const draft: PdfBillDraft = {
    id,
    fileName,
    pageCount,
    accountId: "",
    utilityType: "",
    periodStart: "",
    periodEnd: "",
    usage: "",
    usageUnit: "",
    totalCost: "",
    energyCost: "",
    demandCost: "",
    otherCost: "",
    demandKw: "",
    estimated: false,
    tariffName: "",
    evidence: {},
    warnings: [],
  };

  if (!normalized.length) {
    draft.warnings.push("No searchable text was found. This may be a scanned bill; OCR is not enabled, so enter the values manually.");
    return draft;
  }

  const account = accountCandidate(normalized, fileName);
  if (account) {
    draft.accountId = account.value;
    draft.evidence.accountId = account.evidence;
  }

  const period = periodCandidates(normalized, fileName);
  if (period) {
    draft.periodStart = period.start;
    draft.periodEnd = period.end;
    draft.evidence.periodStart = period.evidence;
    draft.evidence.periodEnd = period.evidence;
  }

  const usage = usageCandidates(normalized, fileName);
  if (usage[0]) {
    draft.usage = String(usage[0].value.usage);
    draft.utilityType = usage[0].value.utilityType;
    draft.usageUnit = usage[0].value.unit;
    draft.evidence.usage = usage[0].evidence;
    draft.evidence.utilityType = usage[0].evidence;
    draft.evidence.usageUnit = usage[0].evidence;
    const materiallyDifferent = usage.find((candidate) => candidate.value.unit !== usage[0].value.unit || candidate.value.usage !== usage[0].value.usage);
    if (materiallyDifferent && materiallyDifferent.score === usage[0].score) draft.warnings.push("Multiple equally likely usage values were found. Confirm the selected usage and unit against the bill.");
  }

  const total = labeledAmount(normalized, fileName, /total\s+(?:amount\s+due|current\s+charges|charges)|amount\s+due|current\s+amount\s+due/i, 6);
  if (total) {
    draft.totalCost = String(total.value);
    draft.evidence.totalCost = total.evidence;
  }
  const energy = labeledAmount(normalized, fileName, /energy\s+charges?|usage\s+charges?|commodity\s+charges?|generation\s+charges?|gas\s+charges?/i, 4);
  if (energy) {
    draft.energyCost = String(energy.value);
    draft.evidence.energyCost = energy.evidence;
  }
  const demandCost = labeledAmount(normalized, fileName, /demand\s+charges?/i, 4);
  if (demandCost) {
    draft.demandCost = String(demandCost.value);
    draft.evidence.demandCost = demandCost.evidence;
  }
  const demand = demandCandidate(normalized, fileName);
  if (demand) {
    draft.demandKw = String(demand.value);
    draft.evidence.demandKw = demand.evidence;
  }
  const tariff = tariffCandidate(normalized, fileName);
  if (tariff) {
    draft.tariffName = tariff.value;
    draft.evidence.tariffName = tariff.evidence;
  }
  const estimatedLine = normalized.find((line) => /estimated\s+(?:reading|meter)|(?:reading|meter)\s+estimated|estimate(?:d)?\s+usage/i.test(line.text));
  if (estimatedLine) {
    draft.estimated = true;
    draft.evidence.estimated = evidence(fileName, estimatedLine);
  }
  if (normalized.some((line) => /\b(?:ccf|cubic\s+feet|lbs?|pounds?)\b/i.test(line.text)) && !draft.usageUnit) {
    draft.warnings.push("A utility quantity was found in an unsupported or ambiguous unit. No conversion was applied; select the correct standardized unit and enter the bill quantity.");
  }

  const missing = [
    ["account number", draft.accountId],
    ["billing period", draft.periodStart && draft.periodEnd],
    ["usage and unit", draft.usage && draft.usageUnit],
    ["total charges", draft.totalCost],
  ].filter(([, value]) => !value).map(([label]) => label);
  if (missing.length) draft.warnings.push(`Not extracted: ${missing.join(", ")}. Enter these values from the bill before adding the record.`);
  draft.warnings.push("PDF text extraction is a screening aid. Compare every value with the displayed bill before marking the utility record verified.");
  return draft;
}

export function validatePdfBillDraft(draft: PdfBillDraft): string[] {
  const errors: string[] = [];
  const usage = numberValue(draft.usage);
  const totalCost = numberValue(draft.totalCost);
  if (!draft.accountId.trim()) errors.push("Enter the account name or account ID.");
  if (!draft.utilityType) errors.push("Select the utility type.");
  if (!draft.periodStart || !draft.periodEnd || draft.periodStart > draft.periodEnd) errors.push("Enter a valid billing start and end date.");
  if (usage === undefined || usage < 0) errors.push("Enter a nonnegative usage value.");
  if (!draft.usageUnit) errors.push("Select the usage unit.");
  if (draft.utilityType && draft.usageUnit && !UTILITY_UNITS[draft.utilityType].includes(draft.usageUnit)) errors.push("The selected usage unit is not valid for this utility type.");
  if (totalCost === undefined || totalCost < 0) errors.push("Enter nonnegative total charges.");
  for (const [label, value] of [["Energy charges", draft.energyCost], ["Demand charges", draft.demandCost], ["Other charges", draft.otherCost], ["Billing demand", draft.demandKw]] as const) {
    const parsed = value === "" ? undefined : numberValue(value);
    if (value !== "" && (parsed === undefined || parsed < 0)) errors.push(`${label} must be a nonnegative number when provided.`);
  }
  return errors;
}

export function pdfDraftToUtilityRecord(draft: PdfBillDraft, recordId: string): { record?: UtilityRecord; errors: string[] } {
  const errors = validatePdfBillDraft(draft);
  if (errors.length || !draft.utilityType || !draft.usageUnit) return { errors };
  const optional = (value: string) => value === "" ? undefined : numberValue(value);
  const referencedPages = [...new Set(Object.values(draft.evidence).map((item) => item?.page).filter((page): page is number => page !== undefined))].sort((first, second) => first - second);
  const pageDescription = referencedPages.length ? `page${referencedPages.length === 1 ? "" : "s"} ${referencedPages.join(", ")}` : `${draft.pageCount} page PDF`;
  return {
    errors: [],
    record: {
      id: recordId,
      accountId: draft.accountId.trim(),
      utilityType: draft.utilityType,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      usage: numberValue(draft.usage) ?? 0,
      usageUnit: draft.usageUnit,
      totalCost: numberValue(draft.totalCost) ?? 0,
      energyCost: optional(draft.energyCost),
      demandCost: optional(draft.demandCost),
      otherCost: optional(draft.otherCost),
      demandKw: optional(draft.demandKw),
      estimated: draft.estimated,
      tariffName: draft.tariffName.trim() || undefined,
      notes: "Browser-local PDF text extraction; verify all fields against the original bill.",
      source: {
        kind: "pdf",
        fileName: draft.fileName,
        locator: `${draft.fileName}, ${pageDescription}`,
        confidence: "review",
        parserVersion: PDF_EXTRACTION_VERSION,
        fieldEvidence: draft.evidence,
      },
    },
  };
}
