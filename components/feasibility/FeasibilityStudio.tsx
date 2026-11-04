"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileJson2,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { PdfBillImport } from "@/components/feasibility/PdfBillImport";
import { ToolPageShell } from "@/components/tool-page-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  annualUtilityTotals,
  calculateFuelConversion,
  FEASIBILITY_DEFAULTS,
  parseUtilityCsv,
  recordsToCsv,
  UTILITY_CSV_TEMPLATE,
  UTILITY_UNITS,
  validateUtilityRecords,
  type FuelConversionInputs,
  type FuelConversionType,
  type UtilityRecord,
  type UtilityType,
  type UtilityUnit,
} from "@/lib/feasibility";
import {
  createFeasibilityProjectDocument,
  createFeasibilityProvenance,
  FEASIBILITY_ASSUMPTION_REFERENCES,
  type FeasibilityProvenance,
} from "@/lib/feasibility-version";
import { formatCurrency, formatFixed, formatWhole } from "@/lib/format";
import type { PdfBillDraft } from "@/lib/utility-bill-pdf";

const STEPS = ["Project", "Utility data", "Feasibility", "Assumptions", "Results", "Report"] as const;
const UTILITY_LABELS: Record<UtilityType, string> = {
  electricity: "Electricity",
  natural_gas: "Natural gas",
  purchased_steam: "Purchased steam",
  fuel_oil_no2: "No. 2 fuel oil",
};
const SCENARIO_META: Record<FuelConversionType, { label: string; utilityType: UtilityType; unit: "gallon" | "mlb" | "mcf"; existingEfficiency: number; proposedEfficiency: number; existingRate: number }> = {
  oil_to_gas: { label: "No. 2 fuel oil → natural gas", utilityType: "fuel_oil_no2", unit: "gallon", existingEfficiency: 0.78, proposedEfficiency: 0.9, existingRate: 4 },
  steam_to_gas: { label: "Purchased steam → natural gas", utilityType: "purchased_steam", unit: "mlb", existingEfficiency: 0.95, proposedEfficiency: 0.85, existingRate: 28 },
  gas_upgrade: { label: "Natural gas equipment upgrade", utilityType: "natural_gas", unit: "mcf", existingEfficiency: 0.78, proposedEfficiency: 0.94, existingRate: 12 },
};

type EditableInputs = Omit<FuelConversionInputs, "conversionType" | "sourceUnit"> & { conversionType: FuelConversionType; sourceUnit: "gallon" | "mlb" | "mcf" };
type ManualRecord = {
  accountId: string;
  utilityType: UtilityType;
  periodStart: string;
  periodEnd: string;
  usage: string;
  usageUnit: UtilityUnit;
  totalCost: string;
  energyCost: string;
  demandCost: string;
  demandKw: string;
  estimated: boolean;
  tariffName: string;
};

const DEFAULT_MANUAL: ManualRecord = {
  accountId: "",
  utilityType: "electricity",
  periodStart: "",
  periodEnd: "",
  usage: "",
  usageUnit: "kwh",
  totalCost: "",
  energyCost: "",
  demandCost: "",
  demandKw: "",
  estimated: false,
  tariffName: "",
};

function downloadText(fileName: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function money(value: number) {
  return Number.isFinite(value) ? formatCurrency(value) : "Not available";
}

function payback(value: number) {
  return Number.isFinite(value) ? `${formatFixed(value, 1)} years` : "No simple payback";
}

export default function FeasibilityStudio() {
  const [step, setStep] = useState(0);
  const [project, setProject] = useState({ name: "", facility: "", location: "", description: "" });
  const [records, setRecords] = useState<UtilityRecord[]>([]);
  const [manual, setManual] = useState<ManualRecord>(DEFAULT_MANUAL);
  const [importMessages, setImportMessages] = useState<string[]>([]);
  const [pdfDrafts, setPdfDrafts] = useState<PdfBillDraft[]>([]);
  const [inputs, setInputs] = useState<EditableInputs>({ ...FEASIBILITY_DEFAULTS });
  const [recommendation, setRecommendation] = useState("Proceed to tariff review, site survey, load analysis, and budgetary vendor pricing before making an investment decision.");
  const [reportGeneratedAt, setReportGeneratedAt] = useState(() => new Date().toISOString());
  const fileInput = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => validateUtilityRecords(records), [records]);
  const scenarioMeta = SCENARIO_META[inputs.conversionType];
  const scenarioRecords = records.filter((record) => record.utilityType === scenarioMeta.utilityType && record.usageUnit === scenarioMeta.unit);
  const billTotals = annualUtilityTotals(scenarioRecords);
  const calculationInputs = { ...inputs, existingAnnualEnergyCost: billTotals.totalCost > 0 ? billTotals.totalCost : undefined };
  const result = useMemo(() => {
    try {
      return { value: calculateFuelConversion(calculationInputs), error: "" };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : "Unable to calculate this scenario." };
    }
  }, [calculationInputs]);
  const blockingIssues = issues.filter((issue) => issue.severity === "error").length;

  function provenanceAt(generatedAt: string) {
    return createFeasibilityProvenance({
      project,
      records,
      inputs: calculationInputs,
      recommendation,
      generatedAt,
    });
  }

  const reportProvenance = provenanceAt(reportGeneratedAt);

  function goToStep(nextStep: number) {
    const bounded = Math.max(0, Math.min(STEPS.length - 1, nextStep));
    if (bounded === 5) setReportGeneratedAt(new Date().toISOString());
    setStep(bounded);
  }

  function exportReviewedData() {
    const provenance = provenanceAt(new Date().toISOString());
    downloadText("utilitycalc-reviewed-utility-data.csv", recordsToCsv(records, provenance));
  }

  function updateInput<K extends keyof EditableInputs>(key: K, value: EditableInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function updateNumber(key: keyof EditableInputs, value: string) {
    updateInput(key, Number(value) as never);
  }

  function selectScenario(conversionType: FuelConversionType) {
    const meta = SCENARIO_META[conversionType];
    const matching = records.filter((record) => record.utilityType === meta.utilityType && record.usageUnit === meta.unit);
    const totals = annualUtilityTotals(matching);
    setInputs((current) => ({
      ...current,
      conversionType,
      sourceUnit: meta.unit,
      annualSourceQuantity: totals.usage,
      existingEfficiency: meta.existingEfficiency,
      proposedEfficiency: meta.proposedEfficiency,
      existingUnitRate: totals.usage > 0 ? totals.totalCost / totals.usage : meta.existingRate,
    }));
  }

  function addManualRecord() {
    const usage = Number(manual.usage);
    const totalCost = Number(manual.totalCost);
    if (!manual.accountId.trim() || !manual.periodStart || !manual.periodEnd || !Number.isFinite(usage) || usage < 0 || !Number.isFinite(totalCost) || totalCost < 0) {
      setImportMessages(["Complete the account, dates, nonnegative usage, and nonnegative total cost before adding the bill."]);
      return;
    }
    const record: UtilityRecord = {
      id: `manual-${Date.now()}`,
      accountId: manual.accountId.trim(),
      utilityType: manual.utilityType,
      periodStart: manual.periodStart,
      periodEnd: manual.periodEnd,
      usage,
      usageUnit: manual.usageUnit,
      totalCost,
      energyCost: manual.energyCost === "" ? undefined : Number(manual.energyCost),
      demandCost: manual.demandCost === "" ? undefined : Number(manual.demandCost),
      demandKw: manual.demandKw === "" ? undefined : Number(manual.demandKw),
      estimated: manual.estimated,
      tariffName: manual.tariffName || undefined,
      source: { kind: "manual", locator: "Manual entry", confidence: "confirmed" },
    };
    setRecords((current) => [...current, record]);
    setManual((current) => ({ ...DEFAULT_MANUAL, accountId: current.accountId, utilityType: current.utilityType, usageUnit: current.usageUnit }));
    setImportMessages([]);
  }

  async function importCsv(file: File) {
    const parsed = parseUtilityCsv(await file.text(), file.name);
    if (parsed.records.length) setRecords((current) => [...current, ...parsed.records]);
    setImportMessages([
      ...(parsed.records.length ? [`Imported ${parsed.records.length} row${parsed.records.length === 1 ? "" : "s"} from ${file.name}. Review and confirm each value.`] : []),
      ...parsed.errors.map((error) => `Row ${error.row}: ${error.message}`),
    ]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function updateRecord(id: string, patch: Partial<UtilityRecord>) {
    setRecords((current) => current.map((record) => record.id === id ? { ...record, ...patch } : record));
  }

  function useBillTotals() {
    setInputs((current) => ({
      ...current,
      annualSourceQuantity: billTotals.usage,
      existingUnitRate: billTotals.usage > 0 ? billTotals.totalCost / billTotals.usage : current.existingUnitRate,
    }));
  }

  const canContinue = step !== 0 || Boolean(project.name.trim() && project.facility.trim());
  const reportReady = Boolean(result.value && inputs.annualSourceQuantity > 0 && blockingIssues === 0);

  return (
    <ToolPageShell
      eyebrow="Engineering feasibility"
      title="Feasibility Studio"
      description="Build a traceable utility baseline, screen fuel-conversion alternatives, and prepare a preliminary engineering feasibility report without sending customer data off the device."
      hideHeaderWhenPrinting
    >
      <div className="no-print rounded-xl border bg-card p-1" aria-label="Feasibility workflow">
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(index)}
              aria-current={step === index ? "step" : undefined}
              className={`min-h-12 rounded-lg px-2 text-xs font-medium transition sm:text-sm ${step === index ? "bg-primary text-primary-foreground" : index < step ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            >
              <span className="mr-1 font-mono">{index + 1}</span> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="no-print flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
        <ShieldCheck className="h-5 w-5 shrink-0" />
        <p>Project and bill data stays in this browser tab. PDF text extraction runs locally; there is no account database, cloud bill upload, analytics payload, OCR, or external AI extraction.</p>
      </div>

      {step === 0 ? <ProjectStep project={project} setProject={setProject} /> : null}
      {step === 1 ? (
        <UtilityDataStep
          manual={manual}
          setManual={setManual}
          records={records}
          pdfDrafts={pdfDrafts}
          setPdfDrafts={setPdfDrafts}
          issues={issues}
          messages={importMessages}
          fileInput={fileInput}
          onAdd={addManualRecord}
          onImport={importCsv}
          onAddPdfRecord={(record) => setRecords((current) => [...current, record])}
          onPdfMessages={setImportMessages}
          onUpdate={updateRecord}
          onDelete={(id) => setRecords((current) => current.filter((record) => record.id !== id))}
          onExport={exportReviewedData}
        />
      ) : null}
      {step === 2 ? <ScenarioStep selected={inputs.conversionType} onSelect={selectScenario} records={records} /> : null}
      {step === 3 ? (
        <AssumptionsStep
          inputs={inputs}
          billTotals={billTotals}
          matchingCount={scenarioRecords.length}
          onNumber={updateNumber}
          onUseBillTotals={useBillTotals}
        />
      ) : null}
      {step === 4 ? <ResultsStep result={result} records={records} inputs={inputs} issues={issues} /> : null}
      {step === 5 ? (
        <ReportStep
          project={project}
          records={records}
          inputs={calculationInputs}
          result={result.value}
          issues={issues}
          recommendation={recommendation}
          setRecommendation={setRecommendation}
          ready={reportReady}
          provenance={reportProvenance}
        />
      ) : null}

      <div className="no-print flex items-center justify-between gap-3">
        <Button variant="outline" disabled={step === 0} onClick={() => goToStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button disabled={step === STEPS.length - 1 || !canContinue} onClick={() => goToStep(step + 1)}>Continue <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </ToolPageShell>
  );
}

function ProjectStep({ project, setProject }: { project: { name: string; facility: string; location: string; description: string }; setProject: React.Dispatch<React.SetStateAction<{ name: string; facility: string; location: string; description: string }>> }) {
  const field = (key: keyof typeof project, value: string) => setProject((current) => ({ ...current, [key]: value }));
  return (
    <Card className="no-print"><CardHeader><CardTitle>Create project</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <Field id="project-name" label="Project name" value={project.name} onChange={(value) => field("name", value)} placeholder="Central plant fuel conversion" required />
      <Field id="facility-name" label="Facility name" value={project.facility} onChange={(value) => field("facility", value)} placeholder="Example Medical Center" required />
      <Field id="facility-location" label="Facility location" value={project.location} onChange={(value) => field("location", value)} placeholder="City, State" />
      <Field id="facility-description" label="Facility description" value={project.description} onChange={(value) => field("description", value)} placeholder="Use, occupancy, operating schedule" />
      <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">Required fields are used only in this tab and the generated report. Nothing is stored after the tab is closed.</p>
    </CardContent></Card>
  );
}

function UtilityDataStep({ manual, setManual, records, pdfDrafts, setPdfDrafts, issues, messages, fileInput, onAdd, onImport, onAddPdfRecord, onPdfMessages, onUpdate, onDelete, onExport }: {
  manual: ManualRecord;
  setManual: React.Dispatch<React.SetStateAction<ManualRecord>>;
  records: UtilityRecord[];
  pdfDrafts: PdfBillDraft[];
  setPdfDrafts: React.Dispatch<React.SetStateAction<PdfBillDraft[]>>;
  issues: ReturnType<typeof validateUtilityRecords>;
  messages: string[];
  fileInput: React.RefObject<HTMLInputElement | null>;
  onAdd: () => void;
  onImport: (file: File) => void;
  onAddPdfRecord: (record: UtilityRecord) => void;
  onPdfMessages: (messages: string[]) => void;
  onUpdate: (id: string, patch: Partial<UtilityRecord>) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
}) {
  const update = <K extends keyof ManualRecord>(key: K, value: ManualRecord[K]) => setManual((current) => ({ ...current, [key]: value }));
  function changeUtility(value: UtilityType) {
    setManual((current) => ({ ...current, utilityType: value, usageUnit: UTILITY_UNITS[value][0] }));
  }
  return <div className="no-print space-y-4">
    <div className="grid gap-3 lg:grid-cols-3">
      <Card><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /><h2 className="font-semibold">CSV import</h2></div><p className="text-sm text-muted-foreground">Import multiple accounts and utility types with source-row traceability.</p><input ref={fileInput} type="file" accept=".csv,text/csv" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImport(file); }} /><Button type="button" variant="outline" className="w-full" onClick={() => downloadText("utilitycalc-feasibility-template.csv", UTILITY_CSV_TEMPLATE)}><Download className="h-4 w-4" /> Download template</Button></CardContent></Card>
      <Card><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="font-semibold">Excel workflow</h2></div><p className="text-sm leading-6 text-muted-foreground">Use the CSV template in Excel, then save as CSV UTF-8 before import. Native XLSX parsing is intentionally deferred to avoid adding an unreviewed client dependency.</p><span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">CSV bridge available</span></CardContent></Card>
      <PdfBillImport drafts={pdfDrafts} setDrafts={setPdfDrafts} onAddRecord={onAddPdfRecord} onMessages={onPdfMessages} />
    </div>

    <Card><CardHeader><CardTitle>Manual bill entry</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field id="manual-account" label="Account name / ID" value={manual.accountId} onChange={(value) => update("accountId", value)} placeholder="Main gas" />
      <SelectField id="manual-type" label="Utility" value={manual.utilityType} onChange={(value) => changeUtility(value as UtilityType)} options={Object.entries(UTILITY_LABELS)} />
      <Field id="manual-start" label="Period start" type="date" value={manual.periodStart} onChange={(value) => update("periodStart", value)} />
      <Field id="manual-end" label="Period end" type="date" value={manual.periodEnd} onChange={(value) => update("periodEnd", value)} />
      <Field id="manual-usage" label="Usage" type="number" value={manual.usage} onChange={(value) => update("usage", value)} />
      <SelectField id="manual-unit" label="Usage unit" value={manual.usageUnit} onChange={(value) => update("usageUnit", value as UtilityUnit)} options={UTILITY_UNITS[manual.utilityType].map((unit) => [unit, unit.toUpperCase()])} />
      <Field id="manual-total" label="Total charges" type="number" value={manual.totalCost} onChange={(value) => update("totalCost", value)} prefix="$" />
      <Field id="manual-energy-cost" label="Energy charges (optional)" type="number" value={manual.energyCost} onChange={(value) => update("energyCost", value)} prefix="$" />
      {manual.utilityType === "electricity" ? <><Field id="manual-demand-cost" label="Demand charges (optional)" type="number" value={manual.demandCost} onChange={(value) => update("demandCost", value)} prefix="$" /><Field id="manual-demand" label="Billing demand (optional)" type="number" value={manual.demandKw} onChange={(value) => update("demandKw", value)} suffix="kW" /></> : null}
      <Field id="manual-tariff" label="Tariff / rate class" value={manual.tariffName} onChange={(value) => update("tariffName", value)} placeholder="If known" />
      <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border px-3 text-sm"><input type="checkbox" checked={manual.estimated} onChange={(event) => update("estimated", event.target.checked)} /> Estimated reading</label>
      <div className="flex items-end"><Button type="button" onClick={onAdd} className="w-full"><Plus className="h-4 w-4" /> Add billing period</Button></div>
    </CardContent></Card>

    {messages.length ? <div className="rounded-xl border bg-muted/40 p-3 text-sm"><ul className="space-y-1">{messages.map((message) => <li key={message}>{message}</li>)}</ul></div> : null}
    <UtilityReviewTable records={records} issues={issues} onUpdate={onUpdate} onDelete={onDelete} onExport={onExport} />
  </div>;
}

function UtilityReviewTable({ records, issues, onUpdate, onDelete, onExport }: { records: UtilityRecord[]; issues: ReturnType<typeof validateUtilityRecords>; onUpdate: (id: string, patch: Partial<UtilityRecord>) => void; onDelete: (id: string) => void; onExport: () => void }) {
  return <Card className="min-w-0">
    <CardHeader className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div><CardTitle>Review standardized utility data</CardTitle><p className="mt-1 text-sm text-muted-foreground">{records.length} billing period{records.length === 1 ? "" : "s"} · {issues.length} review flag{issues.length === 1 ? "" : "s"}</p></div>
      {records.length ? <Button variant="outline" onClick={onExport}><Download className="h-4 w-4" /> Export versioned CSV</Button> : null}
    </CardHeader>
    <CardContent className="min-w-0 space-y-4">
      {records.length ? <>
        <div className="space-y-3 md:hidden">
          {records.map((record) => <div key={record.id} className="min-w-0 space-y-3 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{UTILITY_LABELS[record.utilityType]}</p><p className="text-xs text-muted-foreground">{record.periodStart} to {record.periodEnd}</p></div><Button variant="ghost" size="icon" aria-label={`Delete ${record.source.locator}`} onClick={() => onDelete(record.id)}><Trash2 className="h-4 w-4" /></Button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor={`mobile-account-${record.id}`}>Account</Label><Input id={`mobile-account-${record.id}`} aria-label={`Account for ${record.source.locator}`} value={record.accountId} onChange={(event) => onUpdate(record.id, { accountId: event.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor={`mobile-usage-${record.id}`}>Usage ({record.usageUnit.toUpperCase()})</Label><Input id={`mobile-usage-${record.id}`} aria-label={`Usage for ${record.source.locator}`} type="number" value={record.usage} onChange={(event) => onUpdate(record.id, { usage: Number(event.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor={`mobile-cost-${record.id}`}>Total charges</Label><Input id={`mobile-cost-${record.id}`} aria-label={`Total cost for ${record.source.locator}`} type="number" value={record.totalCost} onChange={(event) => onUpdate(record.id, { totalCost: Number(event.target.value) })} /></div>
              <div className="space-y-1"><Label htmlFor={`mobile-tariff-${record.id}`}>Tariff / rate class</Label><Input id={`mobile-tariff-${record.id}`} aria-label={`Tariff for ${record.source.locator}`} value={record.tariffName ?? ""} onChange={(event) => onUpdate(record.id, { tariffName: event.target.value })} /></div>
            </div>
            <p className="break-all text-xs text-muted-foreground">{record.source.locator}</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={record.source.confidence === "confirmed"} onChange={(event) => onUpdate(record.id, { source: { ...record.source, confidence: event.target.checked ? "confirmed" : "review" } })} /> Verified against source</label>
          </div>)}
        </div>
        <div className="hidden max-w-full overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-2">Account</th><th className="p-2">Utility</th><th className="p-2">Period</th><th className="p-2">Usage</th><th className="p-2">Total</th><th className="p-2">Tariff</th><th className="p-2">Source</th><th className="p-2">Confirm</th><th className="p-2"><span className="sr-only">Actions</span></th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b align-top"><td className="p-2"><Input aria-label={`Account for ${record.source.locator}`} value={record.accountId} onChange={(event) => onUpdate(record.id, { accountId: event.target.value })} className="min-w-36" /></td><td className="p-2">{UTILITY_LABELS[record.utilityType]}</td><td className="p-2"><div className="whitespace-nowrap">{record.periodStart}</div><div className="whitespace-nowrap text-muted-foreground">to {record.periodEnd}</div></td><td className="p-2"><Input aria-label={`Usage for ${record.source.locator}`} type="number" value={record.usage} onChange={(event) => onUpdate(record.id, { usage: Number(event.target.value) })} className="w-28" /><span className="mt-1 block text-xs uppercase text-muted-foreground">{record.usageUnit}</span></td><td className="p-2"><Input aria-label={`Total cost for ${record.source.locator}`} type="number" value={record.totalCost} onChange={(event) => onUpdate(record.id, { totalCost: Number(event.target.value) })} className="w-28" /></td><td className="p-2"><Input aria-label={`Tariff for ${record.source.locator}`} value={record.tariffName ?? ""} onChange={(event) => onUpdate(record.id, { tariffName: event.target.value })} className="w-28" /></td><td className="p-2 text-xs text-muted-foreground">{record.source.locator}</td><td className="p-2"><label className="flex items-center gap-2"><input type="checkbox" checked={record.source.confidence === "confirmed"} onChange={(event) => onUpdate(record.id, { source: { ...record.source, confidence: event.target.checked ? "confirmed" : "review" } })} /> <span className="text-xs">Verified</span></label></td><td className="p-2"><Button variant="ghost" size="icon" aria-label={`Delete ${record.source.locator}`} onClick={() => onDelete(record.id)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>
      </> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Add a bill manually or import the CSV template. No sample customer data is inserted automatically.</div>}
      {issues.length ? <div className="grid gap-2 sm:grid-cols-2">{issues.slice(0, 12).map((issue, index) => <div key={`${issue.code}-${index}`} className={`rounded-lg border p-3 text-sm ${issue.severity === "error" ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100" : issue.severity === "warning" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" : "bg-muted/40 text-muted-foreground"}`}>{issue.message}</div>)}</div> : records.length ? <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> No reconciliation flags found in the current rows.</div> : null}
    </CardContent>
  </Card>;
}

function ScenarioStep({ selected, onSelect, records }: { selected: FuelConversionType; onSelect: (value: FuelConversionType) => void; records: UtilityRecord[] }) {
  return <div className="no-print grid gap-3 md:grid-cols-3">{Object.entries(SCENARIO_META).map(([key, meta]) => { const count = records.filter((record) => record.utilityType === meta.utilityType).length; return <button type="button" key={key} onClick={() => onSelect(key as FuelConversionType)} className={`rounded-2xl border p-5 text-left transition ${selected === key ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "bg-card hover:border-primary/40"}`}><span className="text-xs font-semibold uppercase tracking-wide text-primary">Fuel conversion</span><h2 className="mt-2 text-lg font-semibold">{meta.label}</h2><p className="mt-2 text-sm text-muted-foreground">{count ? `${count} matching billing period${count === 1 ? "" : "s"} available.` : `No ${UTILITY_LABELS[meta.utilityType].toLowerCase()} bills entered yet; assumptions can be entered manually.`}</p></button>; })}</div>;
}

function AssumptionsStep({ inputs, billTotals, matchingCount, onNumber, onUseBillTotals }: { inputs: EditableInputs; billTotals: ReturnType<typeof annualUtilityTotals>; matchingCount: number; onNumber: (key: keyof EditableInputs, value: string) => void; onUseBillTotals: () => void }) {
  return <div className="no-print space-y-4"><Card><CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle>Energy and cost assumptions</CardTitle><p className="mt-1 text-sm text-muted-foreground">{SCENARIO_META[inputs.conversionType].label}</p></div>{matchingCount ? <Button variant="outline" onClick={onUseBillTotals}>Use {matchingCount} bill{matchingCount === 1 ? "" : "s"}</Button> : null}</CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <NumberField id="annual-source" label="Annual source quantity" value={inputs.annualSourceQuantity} onChange={(value) => onNumber("annualSourceQuantity", value)} suffix={inputs.sourceUnit.toUpperCase()} />
    <NumberField id="existing-rate" label="Existing unit cost" value={inputs.existingUnitRate} onChange={(value) => onNumber("existingUnitRate", value)} prefix="$" suffix={`/${inputs.sourceUnit}`} />
    <NumberField id="gas-rate" label="Natural gas rate" value={inputs.gasRatePerMcf} onChange={(value) => onNumber("gasRatePerMcf", value)} prefix="$" suffix="/MCF" />
    <NumberField id="gas-hhv" label="Natural gas HHV" value={inputs.naturalGasHhvMmbtuPerMcf} onChange={(value) => onNumber("naturalGasHhvMmbtuPerMcf", value)} suffix="MMBtu/MCF" />
    <NumberField id="existing-eff" label="Existing efficiency" value={inputs.existingEfficiency * 100} onChange={(value) => onNumber("existingEfficiency", String(Number(value) / 100))} suffix="%" />
    <NumberField id="proposed-eff" label="Proposed efficiency" value={inputs.proposedEfficiency * 100} onChange={(value) => onNumber("proposedEfficiency", String(Number(value) / 100))} suffix="%" />
    <NumberField id="existing-maint" label="Existing maintenance" value={inputs.existingMaintenanceAnnual} onChange={(value) => onNumber("existingMaintenanceAnnual", value)} prefix="$" suffix="/yr" />
    <NumberField id="proposed-maint" label="Proposed maintenance" value={inputs.proposedMaintenanceAnnual} onChange={(value) => onNumber("proposedMaintenanceAnnual", value)} prefix="$" suffix="/yr" />
    {matchingCount ? <p className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-4">Matching bills total {formatWhole(billTotals.usage)} {inputs.sourceUnit.toUpperCase()} and {formatCurrency(billTotals.totalCost)}. Total charges are used as the existing annual cost when matching bills are present; confirm that included fixed and non-fuel charges are appropriate.</p> : null}
  </CardContent></Card>
  <Card><CardContent className="p-0"><Accordion type="multiple" defaultValue={["capital"]}><AccordionItem value="capital"><AccordionTrigger className="px-5">Capital and financial assumptions</AccordionTrigger><AccordionContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4"><NumberField id="base-cost" label="Equipment and installation" value={inputs.baseProjectCost} onChange={(value) => onNumber("baseProjectCost", value)} prefix="$" /><NumberField id="contingency" label="Project contingency" value={inputs.contingencyPercent} onChange={(value) => onNumber("contingencyPercent", value)} suffix="%" /><NumberField id="incentives" label="Verified incentives" value={inputs.incentives} onChange={(value) => onNumber("incentives", value)} prefix="$" /><NumberField id="analysis-years" label="Analysis period" value={inputs.analysisYears} onChange={(value) => onNumber("analysisYears", value)} suffix="years" /><NumberField id="discount-rate" label="Discount rate" value={inputs.discountRatePercent} onChange={(value) => onNumber("discountRatePercent", value)} suffix="%" /><p className="self-end text-xs leading-5 text-muted-foreground sm:col-span-2">Incentives default to zero. Enter only documented project-eligible incentives.</p></AccordionContent></AccordionItem><AccordionItem value="thermal"><AccordionTrigger className="px-5">Fuel and steam properties</AccordionTrigger><AccordionContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3"><NumberField id="oil-hhv" label="No. 2 oil HHV" value={inputs.oilHhvMmbtuPerGallon} onChange={(value) => onNumber("oilHhvMmbtuPerGallon", value)} suffix="MMBtu/gal" /><NumberField id="steam-supply" label="Steam supply enthalpy" value={inputs.steamSupplyEnthalpyBtuPerLb} onChange={(value) => onNumber("steamSupplyEnthalpyBtuPerLb", value)} suffix="Btu/lb" /><NumberField id="steam-return" label="Condensate enthalpy" value={inputs.steamCondensateEnthalpyBtuPerLb} onChange={(value) => onNumber("steamCondensateEnthalpyBtuPerLb", value)} suffix="Btu/lb" /></AccordionContent></AccordionItem></Accordion></CardContent></Card>
  </div>;
}

function ResultsStep({ result, records, inputs, issues }: { result: { value: ReturnType<typeof calculateFuelConversion> | null; error: string }; records: UtilityRecord[]; inputs: EditableInputs; issues: ReturnType<typeof validateUtilityRecords> }) {
  if (!result.value) return <div className="no-print rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"><strong>Calculation requires attention.</strong> {result.error}</div>;
  const value = result.value;
  const maxCost = Math.max(value.existingAnnualEnergyCost, value.proposedAnnualEnergyCost, 1);
  return <div className="no-print space-y-4">
    <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm"><p className="text-sm opacity-80">Expected annual net operating savings</p><p className="mt-1 font-mono text-3xl font-semibold sm:text-4xl">{money(value.annualNetSavings)}</p><p className="mt-2 text-sm opacity-80">{payback(value.simplePaybackYears)} · preliminary energy screening</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Proposed natural gas" value={`${formatWhole(value.proposedGasMcf)} MCF/yr`} /><Metric label="Net project cost" value={money(value.netCapitalCost)} /><Metric label={`${inputs.analysisYears}-year NPV`} value={money(value.netPresentValue)} /><Metric label="Useful annual heat" value={`${formatWhole(value.usefulHeatMmbtu)} MMBtu`} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Annual energy-cost comparison</CardTitle></CardHeader><CardContent className="space-y-4"><Bar label="Existing" value={value.existingAnnualEnergyCost} max={maxCost} /><Bar label="Proposed gas" value={value.proposedAnnualEnergyCost} max={maxCost} /><Line label="Energy savings" value={money(value.annualEnergySavings)} /><Line label="Maintenance difference" value={money(value.annualMaintenanceSavings)} /></CardContent></Card><Card><CardHeader><CardTitle>Sensitivity analysis</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Case</th><th>Net savings</th><th>Capital</th><th>Payback</th><th>NPV</th></tr></thead><tbody>{value.sensitivity.map((item) => <tr key={item.name} className="border-b"><td className="py-3 font-medium">{item.name}</td><td>{money(item.annualNetSavings)}</td><td>{money(item.netCapitalCost)}</td><td>{payback(item.simplePaybackYears)}</td><td>{money(item.netPresentValue)}</td></tr>)}</tbody></table></CardContent></Card></div>
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Preliminary screening only.</strong><ul className="mt-2 list-disc space-y-1 pl-5">{value.warnings.map((warning) => <li key={warning}>{warning}</li>)}{records.length === 0 ? <li>No utility bills support the entered annual quantity or cost.</li> : null}{issues.length ? <li>{issues.length} utility-data flag{issues.length === 1 ? "" : "s"} remain; resolve material flags before relying on results.</li> : null}<li>Blended rates are not assumed fully avoidable; enter tariff-supported costs during detailed analysis.</li></ul></div></div></div>
    <p className="text-xs text-muted-foreground">Energy balance: {formatWhole(value.existingInputMmbtu)} MMBtu purchased × {formatFixed(inputs.existingEfficiency * 100, 1)}% = {formatWhole(value.usefulHeatMmbtu)} MMBtu useful = {formatWhole(value.proposedGasMmbtu)} MMBtu gas × {formatFixed(inputs.proposedEfficiency * 100, 1)}%.</p>
  </div>;
}

function ReportStep({ project, records, inputs, result, issues, recommendation, setRecommendation, ready, provenance }: { project: { name: string; facility: string; location: string; description: string }; records: UtilityRecord[]; inputs: FuelConversionInputs; result: ReturnType<typeof calculateFuelConversion> | null; issues: ReturnType<typeof validateUtilityRecords>; recommendation: string; setRecommendation: (value: string) => void; ready: boolean; provenance: FeasibilityProvenance }) {
  const projectDocument = createFeasibilityProjectDocument({ project, records, inputs, recommendation, provenance });
  return <div className="space-y-4"><div className="no-print flex flex-wrap items-center gap-2"><Button disabled={!ready} onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / save PDF</Button><Button variant="outline" disabled={!records.length} onClick={() => downloadText("utilitycalc-feasibility-supporting-data.csv", recordsToCsv(records, provenance))}><Download className="h-4 w-4" /> Supporting CSV</Button><Button variant="outline" onClick={() => downloadText("utilitycalc-feasibility-project.json", JSON.stringify(projectDocument, null, 2), "application/json;charset=utf-8")}><FileJson2 className="h-4 w-4" /> Versioned project JSON</Button>{!ready ? <span className="text-sm text-muted-foreground">Add a positive annual source quantity and resolve duplicate/overlap errors to issue the report.</span> : null}</div><div className="no-print space-y-1"><Label htmlFor="report-recommendation">Engineering recommendation draft</Label><textarea id="report-recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value)} className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm" /></div>
    <article id="feasibility-report" className="report-sheet space-y-7 rounded-2xl border bg-white p-6 text-slate-950 shadow-sm sm:p-10">
      <header className="border-b border-slate-300 pb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">UtilityCalc Feasibility Studio</p><h2 className="mt-2 text-3xl font-semibold">Preliminary Engineering Feasibility Report</h2><dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2"><ReportItem label="Project" value={project.name || "Not provided"} /><ReportItem label="Facility" value={project.facility || "Not provided"} /><ReportItem label="Location" value={project.location || "Not provided"} /><ReportItem label="Study basis" value="Monthly utility-bill screening" /><ReportItem label="Generated" value={new Date(provenance.generatedAt).toLocaleString()} /><ReportItem label="Input fingerprint" value={provenance.inputFingerprint} /></dl></header>
      <ReportSection number="1" title="Executive summary"><p>This preliminary screening evaluates {SCENARIO_META[inputs.conversionType].label.toLowerCase()} on an equal-useful-heat basis. {result ? `The expected case estimates ${money(result.annualNetSavings)} in annual net operating savings, ${money(result.netCapitalCost)} net capital cost, and ${payback(result.simplePaybackYears)}.` : "Complete the engineering assumptions before relying on financial results."}</p><p className="font-medium">This is a feasibility screen, not design engineering, a tariff determination, or a construction estimate.</p></ReportSection>
      <ReportSection number="2" title="Facility description"><p>{project.description || "No facility description was provided. Document occupancy, operating schedule, heating systems, distribution temperatures, redundancy, and planned changes during the site survey."}</p></ReportSection>
      <ReportSection number="3" title="Existing utility consumption"><p>{records.length ? `${records.length} billing periods across ${new Set(records.map((record) => record.accountId)).size} account(s) were reviewed.` : "No supporting utility bills were entered; annual use is an unsupported owner-entered assumption."}</p><ReportTable rows={Object.entries(UTILITY_LABELS).map(([type, label]) => { const utilityRecords = records.filter((record) => record.utilityType === type); const totals = annualUtilityTotals(utilityRecords); return [label, String(utilityRecords.length), utilityRecords.length ? `${formatWhole(totals.usage)} ${utilityRecords[0].usageUnit.toUpperCase()}` : "—", money(totals.totalCost)]; })} /></ReportSection>
      <ReportSection number="4" title="Existing annual energy expenditures"><p>{result ? `Modeled existing annual energy cost is ${money(result.existingAnnualEnergyCost)}. Where matching bills are available, total bill charges are used and may include fixed or non-avoidable components.` : "Not calculated."}</p></ReportSection>
      <ReportSection number="5" title="Proposed technology or conversion"><p>{SCENARIO_META[inputs.conversionType].label}. Proposed equipment is modeled at {formatFixed(inputs.proposedEfficiency * 100, 1)}% efficiency. Equipment type, quantity, redundancy, gas pressure, and final capacity remain to be selected.</p></ReportSection>
      <ReportSection number="6" title="Engineering assumptions"><ReportTable headings={["Assumption", "Value", "Status"]} rows={[["Annual source quantity", `${formatWhole(inputs.annualSourceQuantity)} ${inputs.sourceUnit.toUpperCase()}`, records.length ? "Bill-supported where matched" : "Owner input"], ["Existing efficiency", `${formatFixed(inputs.existingEfficiency * 100, 1)}%`, "Verify by equipment condition/test"], ["Proposed efficiency", `${formatFixed(inputs.proposedEfficiency * 100, 1)}%`, "Vendor data required"], ["Natural gas HHV", `${inputs.naturalGasHhvMmbtuPerMcf} MMBtu/MCF`, "Editable billing assumption"], ["Natural gas rate", `${money(inputs.gasRatePerMcf)}/MCF`, "Tariff verification required"], ["Contingency", `${inputs.contingencyPercent}%`, "Screening allowance"]]} /></ReportSection>
      <ReportSection number="7" title="Monthly and annual energy analysis"><p>{result ? `${formatWhole(result.existingInputMmbtu)} MMBtu of existing purchased energy produces ${formatWhole(result.usefulHeatMmbtu)} MMBtu of modeled useful heat. The proposed system requires ${formatWhole(result.proposedGasMcf)} MCF/year at the stated HHV and efficiency.` : "Not calculated."}</p></ReportSection>
      <ReportSection number="8" title="Financial comparison">{result ? <ReportTable headings={["Metric", "Existing", "Proposed / result"]} rows={[["Annual energy cost", money(result.existingAnnualEnergyCost), money(result.proposedAnnualEnergyCost)], ["Annual energy savings", "—", money(result.annualEnergySavings)], ["Annual net operating savings", "—", money(result.annualNetSavings)], ["Net capital cost", "—", money(result.netCapitalCost)], ["Simple payback", "—", payback(result.simplePaybackYears)], ["Net present value", "—", money(result.netPresentValue)]]} /> : <p>Not calculated.</p>}</ReportSection>
      <ReportSection number="9" title="Estimated savings and payback"><p>{result ? `Expected annual net operating savings are ${money(result.annualNetSavings)} and simple payback is ${payback(result.simplePaybackYears)}. Savings exclude unverified tariff effects, financing, taxes, escalation, and production impacts.` : "Not calculated."}</p></ReportSection>
      <ReportSection number="10" title="Sensitivity analysis">{result ? <ReportTable headings={["Case", "Annual net savings", "Net capital", "Payback", "NPV"]} rows={result.sensitivity.map((item) => [item.name, money(item.annualNetSavings), money(item.netCapitalCost), payback(item.simplePaybackYears), money(item.netPresentValue)])} /> : <p>Not calculated.</p>}</ReportSection>
      <ReportSection number="11" title="Technical constraints and project risks"><ul className="list-disc space-y-1 pl-5"><li>Annual consumption does not establish peak heating capacity or gas-service capacity.</li><li>Gas availability, pressure, meter/regulator capacity, interruption terms, and utility approval are unverified.</li><li>Existing equipment condition, distribution temperatures, ventilation, combustion air, venting, controls, and redundancy require field verification.</li><li>Project cost requires site-specific scope and vendor quotations.</li></ul></ReportSection>
      <ReportSection number="12" title="Missing information and field verification"><ul className="list-disc space-y-1 pl-5">{issues.length ? issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>) : <li>No automated billing-period flags remain; tariff and field verification are still required.</li>}<li>Obtain interval or daily load data where capacity, demand reduction, or operating schedule matters.</li><li>Reconcile fuel oil delivery volumes to tank inventory and consumption where applicable.</li></ul></ReportSection>
      <ReportSection number="13" title="Engineering recommendation"><p>{recommendation}</p></ReportSection>
      <ReportSection number="14" title="Recommended next steps"><ol className="list-decimal space-y-1 pl-5"><li>Complete twelve or more consecutive months of bill and tariff review.</li><li>Perform a site survey and equipment inventory.</li><li>Develop a design-day load calculation independent of annual fuel use.</li><li>Confirm gas service, permitting, emissions, and utility requirements.</li><li>Obtain budgetary vendor proposals and update lifecycle economics.</li></ol></ReportSection>
      <ReportSection number="15" title="Calculation methodology and supporting data"><p>Existing purchased energy is converted to MMBtu and multiplied by existing efficiency to estimate useful heat. Proposed gas input equals useful heat divided by proposed efficiency; MCF equals gas MMBtu divided by the editable HHV. Net savings include energy and maintenance differences. NPV discounts constant annual savings over {inputs.analysisYears} years at {inputs.discountRatePercent}% and subtracts net capital cost. Conservative and optimistic cases apply ±20% savings and +15%/−10% capital sensitivity.</p><p>Supporting billing rows and source locators are available in the companion versioned CSV and project JSON exports.</p><h4 className="font-semibold">Version provenance</h4><ReportTable headings={["Version track", "Identifier", "Purpose"]} rows={[["Application", provenance.applicationVersion, "UtilityCalc release"], ["Project schema", provenance.projectSchemaVersion, "Saved project structure"], ["Calculation engine", provenance.calculationEngineVersion, "Equations and financial behavior"], ["Assumption set", provenance.assumptionSetVersion, "Default engineering values and references"], ["Report template", provenance.reportTemplateVersion, "Report structure and disclosures"], ["Build commit", provenance.buildCommit, "Deployed source revision when available"]]} /><h4 className="font-semibold">Default assumption references</h4><ReportTable headings={["Assumption ID", "Default", "Reference / applicability"]} rows={FEASIBILITY_ASSUMPTION_REFERENCES.map((assumption) => [assumption.id, `${assumption.defaultValue} ${assumption.unit}`, `${assumption.sourceTitle}; ${assumption.sourceRevision}. ${assumption.applicability}`])} /><p>The input fingerprint is a deterministic reproducibility checksum of project context, utility records, calculation inputs, recommendation, and version identifiers. It is not a cryptographic signature or tamper-evidence control.</p></ReportSection>
      <footer className="border-t border-slate-300 pt-4 text-xs text-slate-600">Prepared with UtilityCalc Feasibility Studio {provenance.applicationVersion} · Engine {provenance.calculationEngineVersion} · {provenance.inputFingerprint} · Preliminary screening for review by a qualified engineer · No professional seal or design certification is implied.</footer>
    </article></div>;
}

function Field({ id, label, value, onChange, placeholder, type = "text", prefix, suffix, required }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; prefix?: string; suffix?: string; required?: boolean }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}{required ? " *" : ""}</Label><div className="relative">{prefix ? <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">{prefix}</span> : null}<Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-16" : ""}`} />{suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span> : null}</div></div>;
}

function NumberField({ id, label, value, onChange, prefix, suffix }: { id: string; label: string; value: number; onChange: (value: string) => void; prefix?: string; suffix?: string }) {
  return <Field id={id} label={label} type="number" value={String(value)} onChange={onChange} prefix={prefix} suffix={suffix} />;
}

function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<readonly [string, string]> }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-semibold">{value}</p></div>; }
function Line({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm"><span className="text-muted-foreground">{label}</span><strong className="font-mono">{value}</strong></div>; }
function Bar({ label, value, max }: { label: string; value: number; max: number }) { return <div><div className="mb-1 flex justify-between text-sm"><span>{label}</span><strong className="font-mono">{money(value)}</strong></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, value / max * 100)}%` }} /></div></div>; }
function ReportItem({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>; }
function ReportSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section className="break-inside-avoid space-y-3 text-sm leading-6"><h3 className="border-b border-slate-200 pb-1 text-lg font-semibold"><span className="mr-2 text-blue-700">{number}.</span>{title}</h3>{children}</section>; }
function ReportTable({ headings = ["Utility", "Periods", "Annual usage", "Total charges"], rows }: { headings?: string[]; rows: string[][] }) { return <div className="overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-xs"><thead><tr className="bg-slate-100">{headings.map((heading) => <th key={heading} className="border border-slate-300 p-2">{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="border border-slate-300 p-2">{cell}</td>)}</tr>)}</tbody></table></div>; }
