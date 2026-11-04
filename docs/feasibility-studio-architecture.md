# Feasibility Studio architecture

## Purpose and boundary

Feasibility Studio is a browser-local preliminary engineering workflow at `/feasibility-studio`. It is compatible with the existing Next.js static export and Cloudflare Pages deployment. No server, database, authentication system, external AI service, or customer-data persistence was added.

The current release covers Milestone 1 and the Fuel Conversion MVP from Milestone 2:

- named project and facility context;
- manual and CSV utility intake for electricity, natural gas, purchased steam, and No. 2 fuel oil;
- multiple accounts and billing periods;
- browser-local searchable-PDF text extraction with editable drafts and per-field page/line evidence;
- editable normalized data with source row, confidence, estimated-reading, tariff, energy-charge, demand-charge, and demand fields;
- reconciliation checks for invalid, duplicate, overlapping, missing, estimated, mixed-unit, unusual, tariff-missing, and oil-delivery records;
- oil-to-gas, purchased-steam-to-gas, and gas-equipment-upgrade energy balances;
- expected, conservative, and optimistic financial cases with simple payback and NPV;
- supporting CSV export and a print stylesheet for browser PDF generation.
- independent project-schema, calculation-engine, assumption-set, and report-template version tracks;
- reproducibility fingerprints plus versioned CSV and local project JSON exports.

## Domain boundaries

`lib/feasibility.ts` contains deterministic, framework-independent data types and functions. UI state, file selection, downloads, and print behavior remain in `components/feasibility/FeasibilityStudio.tsx`. The domain engine reuses the shared natural-gas HHV and No. 2 oil heating value from `lib/assumptions.ts`.

The calculation chain is:

1. Purchased source quantity × source heating value or net steam enthalpy = existing input MMBtu.
2. Existing input MMBtu × existing efficiency = useful heat.
3. Useful heat ÷ proposed efficiency = proposed gas MMBtu.
4. Proposed gas MMBtu ÷ gas HHV = proposed MCF.
5. Existing cost − proposed gas cost + maintenance difference = annual net operating savings.
6. Capital including contingency less explicit incentives is used for payback and discounted NPV.

Annual use is never converted into peak capacity. The report explicitly requires a separate design-day load calculation, field survey, gas-service review, tariff analysis, and vendor pricing.

## Privacy and source traceability

CSV and PDF files are parsed with browser APIs. Each CSV row records its file name and row; each PDF-derived field records its file name, page, line, source excerpt, and parser version. Manual entries record their origin. Imported rows begin in `review` confidence and can be marked confirmed. Closing or reloading the page clears the project.

PDF.js `5.5.207` is loaded only when a user selects a PDF. Extraction is limited to 15 MB, 40 pages, and 100,000 text characters per page; JavaScript evaluation is disabled. The browser reads only the embedded text layer and does not render, upload, persist, OCR, or send the bill to an external service. Password-protected and image-only PDFs fall back to manual entry. Native XLSX parsing remains deferred.

## Reporting

The report is semantic HTML with print-specific Letter sizing. “Print / save PDF” invokes the browser print dialog so the user can create a PDF without sending data to a server. Supporting billing data and source locators are separately downloadable as CSV.

Every report and export includes version provenance and a deterministic `UCFS-XXXXXXXX` input checksum. The checksum detects whether two artifacts were generated from the same canonical inputs and version identifiers; it is not a cryptographic signature. See [`feasibility-studio-versioning.md`](feasibility-studio-versioning.md).

## Validation

Vitest covers CSV parsing, deterministic PDF field extraction, missing/unsupported PDF fields, source evidence, utility reconciliation, independent energy-balance benchmarks, invalid inputs, capital/incentive treatment, NPV, and the peak-sizing disclaimer. Playwright covers manual and real browser PDF.js intake paths, the full bill → assumptions → result path, accessibility, and responsive regressions.
