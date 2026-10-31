"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UTILITY_UNITS, type UtilityFieldKey, type UtilityRecord, type UtilityType, type UtilityUnit } from "@/lib/feasibility";
import { extractPdfTextInBrowser } from "@/lib/pdf-browser";
import { parsePdfBillText, pdfDraftToUtilityRecord, validatePdfBillDraft, type PdfBillDraft } from "@/lib/utility-bill-pdf";

const UTILITY_LABELS: Record<UtilityType, string> = {
  electricity: "Electricity",
  natural_gas: "Natural gas",
  purchased_steam: "Purchased steam",
  fuel_oil_no2: "No. 2 fuel oil",
};

const EVIDENCE_LABELS: Partial<Record<UtilityFieldKey, string>> = {
  accountId: "Account",
  utilityType: "Utility",
  periodStart: "Period start",
  periodEnd: "Period end",
  usage: "Usage",
  usageUnit: "Usage unit",
  totalCost: "Total charges",
  energyCost: "Energy charges",
  demandCost: "Demand charges",
  demandKw: "Billing demand",
  estimated: "Estimated flag",
  tariffName: "Tariff",
};

const ALL_UNITS = [...new Set(Object.values(UTILITY_UNITS).flat())];

export function PdfBillImport({ drafts, setDrafts, onAddRecord, onMessages }: {
  drafts: PdfBillDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<PdfBillDraft[]>>;
  onAddRecord: (record: UtilityRecord) => void;
  onMessages: (messages: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  async function importFiles(files: FileList) {
    const selected = Array.from(files).slice(0, 12);
    const imported: PdfBillDraft[] = [];
    const messages: string[] = [];
    setProcessing(true);
    for (const [index, file] of selected.entries()) {
      try {
        const extracted = await extractPdfTextInBrowser(file);
        const draft = parsePdfBillText({
          fileName: file.name,
          pageCount: extracted.pageCount,
          lines: extracted.lines,
          id: `pdf-draft-${Date.now()}-${index}`,
        });
        draft.warnings = [...extracted.warnings, ...draft.warnings];
        imported.push(draft);
        messages.push(`Read ${file.name} locally (${extracted.pageCount} page${extracted.pageCount === 1 ? "" : "s"}). Review every extracted value before adding it.`);
      } catch (error) {
        messages.push(`${file.name}: ${error instanceof Error ? error.message : "The PDF could not be read."}`);
      }
    }
    if (files.length > selected.length) messages.push(`Only the first ${selected.length} selected PDFs were processed.`);
    if (imported.length) setDrafts((current) => [...current, ...imported]);
    onMessages(messages);
    setProcessing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateDraft(id: string, patch: Partial<PdfBillDraft>) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  }

  function changeUtility(draft: PdfBillDraft, utilityType: UtilityType) {
    const validCurrentUnit = draft.usageUnit && UTILITY_UNITS[utilityType].includes(draft.usageUnit);
    updateDraft(draft.id, { utilityType, usageUnit: validCurrentUnit ? draft.usageUnit : UTILITY_UNITS[utilityType][0] });
  }

  function addDraft(draft: PdfBillDraft) {
    const result = pdfDraftToUtilityRecord(draft, `pdf-${Date.now()}`);
    if (!result.record) {
      onMessages(result.errors);
      return;
    }
    onAddRecord(result.record);
    setDrafts((current) => current.filter((item) => item.id !== draft.id));
    onMessages([`Added ${draft.fileName} as a review-required utility record. Mark it verified only after comparing every value with the original bill.`]);
  }

  return <>
    <Card><CardContent className="space-y-3 p-4">
      <div className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /><h2 className="font-semibold">PDF bills</h2></div>
      <p className="text-sm leading-6 text-muted-foreground">Extract searchable bill text in this browser. Files are not uploaded to UtilityCalc, Cloudflare, an AI service, or a database.</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        disabled={processing}
        aria-label="Upload PDF utility bills"
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground disabled:opacity-60"
        onChange={(event) => { if (event.target.files?.length) void importFiles(event.target.files); }}
      />
      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs leading-5 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>{processing ? "Reading PDF text locally..." : "Searchable PDFs only. Scanned/image-only or password-protected bills require manual entry."}</span></div>
    </CardContent></Card>

    {drafts.map((draft) => {
      const validationErrors = validatePdfBillDraft(draft);
      const units = draft.utilityType ? UTILITY_UNITS[draft.utilityType] : ALL_UNITS;
      return <Card key={draft.id} className="lg:col-span-3">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div><CardTitle>Review PDF extraction</CardTitle><p className="mt-1 break-all text-sm text-muted-foreground">{draft.fileName} · {draft.pageCount} page{draft.pageCount === 1 ? "" : "s"}</p></div>
          <Button type="button" size="icon" variant="ghost" aria-label={`Remove PDF draft ${draft.fileName}`} onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}><Trash2 className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.warnings.length ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><ul className="space-y-1">{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DraftField id={`${draft.id}-account`} label="Account name / ID" value={draft.accountId} onChange={(accountId) => updateDraft(draft.id, { accountId })} />
            <DraftSelect id={`${draft.id}-utility`} label="Utility" value={draft.utilityType} placeholder="Select utility" options={Object.entries(UTILITY_LABELS)} onChange={(value) => changeUtility(draft, value as UtilityType)} />
            <DraftField id={`${draft.id}-start`} label="Period start" type="date" value={draft.periodStart} onChange={(periodStart) => updateDraft(draft.id, { periodStart })} />
            <DraftField id={`${draft.id}-end`} label="Period end" type="date" value={draft.periodEnd} onChange={(periodEnd) => updateDraft(draft.id, { periodEnd })} />
            <DraftField id={`${draft.id}-usage`} label="Usage" type="number" value={draft.usage} onChange={(usage) => updateDraft(draft.id, { usage })} />
            <DraftSelect id={`${draft.id}-unit`} label="Usage unit" value={draft.usageUnit} placeholder="Select unit" options={units.map((unit) => [unit, unit.toUpperCase()])} onChange={(usageUnit) => updateDraft(draft.id, { usageUnit: usageUnit as UtilityUnit })} />
            <DraftField id={`${draft.id}-total`} label="Total charges" type="number" value={draft.totalCost} onChange={(totalCost) => updateDraft(draft.id, { totalCost })} />
            <DraftField id={`${draft.id}-energy`} label="Energy charges (optional)" type="number" value={draft.energyCost} onChange={(energyCost) => updateDraft(draft.id, { energyCost })} />
            <DraftField id={`${draft.id}-demand-cost`} label="Demand charges (optional)" type="number" value={draft.demandCost} onChange={(demandCost) => updateDraft(draft.id, { demandCost })} />
            <DraftField id={`${draft.id}-other-cost`} label="Other charges (optional)" type="number" value={draft.otherCost} onChange={(otherCost) => updateDraft(draft.id, { otherCost })} />
            <DraftField id={`${draft.id}-demand`} label="Billing demand (optional)" type="number" value={draft.demandKw} onChange={(demandKw) => updateDraft(draft.id, { demandKw })} />
            <DraftField id={`${draft.id}-tariff`} label="Tariff / rate class" value={draft.tariffName} onChange={(tariffName) => updateDraft(draft.id, { tariffName })} />
            <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border px-3 text-sm"><input type="checkbox" checked={draft.estimated} onChange={(event) => updateDraft(draft.id, { estimated: event.target.checked })} /> Estimated reading</label>
          </div>

          {Object.keys(draft.evidence).length ? <details className="rounded-xl border bg-muted/30 p-3"><summary className="cursor-pointer text-sm font-medium">Source evidence for extracted values</summary><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{Object.entries(draft.evidence).map(([field, item]) => item ? <div key={field} className="rounded-lg bg-background p-2"><dt className="font-medium">{EVIDENCE_LABELS[field as UtilityFieldKey] ?? field}</dt><dd className="mt-1 text-muted-foreground">{item.locator}: “{item.excerpt}”</dd></div> : null)}</dl></details> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => addDraft(draft)}><CheckCircle2 className="h-4 w-4" /> Add reviewed bill</Button>
            <span className={`text-sm ${validationErrors.length ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{validationErrors.length ? `${validationErrors.length} required correction${validationErrors.length === 1 ? "" : "s"} remain.` : "Required fields are complete; compare them with the bill before adding."}</span>
          </div>
        </CardContent>
      </Card>;
    })}
  </>;
}

function DraftField({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date" }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function DraftSelect({ id, label, value, placeholder, options, onChange }: { id: string; label: string; value: string; placeholder: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">{placeholder}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}
