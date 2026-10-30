# Gas equipment sizing architecture

## Scope and route

The feature will use the existing Next.js App Router and shared tool-page components. The public route is `/gas-equipment-sizing/`, linked from the homepage and desktop/mobile navigation.

The page has four compact views:

1. Service sizing
2. Meter selection
3. Regulator selection
4. Combined screening

Each lookup remains independently usable. The combined view carries one normalized peak demand in CFH through the same service, meter, and regulator functions rather than duplicating calculations.

## Data architecture

Source files are parsed only during data preparation. The deployed application imports static JSON and does not parse PDF or Excel files at runtime.

- `data/gas-equipment/service-capacity.json`: plastic and steel service tables plus the mixed 1-inch CTS / 1-1/4-inch IPS table.
- `data/gas-equipment/meters.json`: diaphragm, rotary, and 30-degree / 45-degree turbine records.
- `data/gas-equipment/regulators-public.json`: public engineering configuration fields only.
- `data/gas-equipment/connection-guidelines.json`: threaded/welded and overpressure-setting rules transcribed from the embedded DS14.9 images.
- `data/gas-equipment/source-manifest.json`: document titles, revisions or file-modified dates, worksheet/page references, assumptions, and exclusions.

Every lookup record carries a source document ID and page, worksheet, row, or cell reference where the source format provides one. Source files are not copied into `public/`.

Pricing and stock-number values are excluded from the public data bundle. A future internal view must retrieve those fields from an authenticated server-side data source; client-side hiding is not an acceptable control.

## Typed lookup layer

`lib/gas-equipment-sizing.ts` owns input validation, unit normalization, exact table-row selection, qualification rules, source references, and review statuses. UI components do not implement engineering decisions.

Lookup rules:

- Service length rounds up to the next tabulated length.
- No service lookup extrapolates below or above the source table.
- Minimum-size mode returns the first qualifying tabulated size in source order.
- Existing-equipment mode evaluates only the selected size.
- Mixed-service lookup uses the next longer listed service length and the next greater-or-equal listed CFH column. It returns the permitted 1-inch CTS length and the remaining 1-1/4-inch IPS length without interpolation.
- Meter delivery pressure must match a source pressure row or the explicit 4.5-8 inch W.C. band. No pressure interpolation is used.
- Rotary and turbine qualification checks both minimum operating flow and maximum peak flow. Turbine rotor angles remain separate families.
- A missing customer minimum load produces an incomplete-screening result. A source family without a published minimum-flow limit also remains incomplete for minimum-flow qualification.
- Regulator inlet range and outlet setting are exact source categories. Overlapping inlet ranges require the user to choose the intended category explicitly.
- Connection-guideline rules can return threaded, welded, or engineering review when the source rules overlap or leave a gap.

## Demand conversion

The website default remains 1,035 BTU per cubic foot. BTU/h, MBH, and MMBtu/h inputs convert to CFH with that explicit value. CFH and MCFH inputs do not use a heating-value conversion.

The service PDF's example uses 1,000 BTU per cubic foot. Results disclose both values and never silently substitute the PDF assumption for the website default. The user can change the heating value in an advanced input when project-specific gas quality requires it.

## UI structure

The UI reuses cards, tabs, selects, inputs, buttons, accordions, result summaries, and existing responsive spacing. Finite table choices use dropdowns. Primary results stay above expandable alternative tables and source details. Tables become stacked result cards on narrow screens so the page has no horizontal overflow.

Every result includes:

- qualification or review status;
- capacity, utilization, and remaining capacity where applicable;
- exact or conservatively rounded table row;
- governing pressure and engineering assumptions;
- source revision and locator;
- a copyable plain-text summary.

## Source ambiguities identified before implementation

1. The service PDF contains literal nonmonotonic entries. Examples include existing plastic low-pressure 1-1/4-inch IPS at 40-50 feet and existing plastic low-pressure 1-inch CTS at 95-100 feet. These values will be preserved and flagged in the audit report.
2. The meter guideline workbook and the later workbook contain duplicate rotary/turbine tables with small differences caused by rounded versus full-precision pressure factors. The workbook titled “Final Revision” is the primary rotary/turbine source; the earlier tables are retained as comparison evidence.
3. The two diaphragm worksheets contain the same numeric table with different model-label formatting. `Diaphragm (2021)` is the public source, while `Full version` is treated as a duplicate for audit purposes.
4. The final meter workbook includes a pricing worksheet. It is intentionally excluded from all generated public data.
5. Stock numbers are present in the industrial regulator worksheet. They are intentionally excluded from the public bundle.
6. The regulator workbook states DS14.11 and DS14.9 identifiers but does not provide one clear workbook-wide revision date. The manifest will retain the worksheet identifier and workbook modified timestamp instead of inventing a revision.
7. The threaded/welded guideline leaves some boundary combinations without an explicit rule and can produce overlapping matches at certain meter sizes. Those cases require engineering review.
8. Diaphragm meter minimum-flow limits are not provided. Diaphragm results can screen maximum capacity but cannot be labeled fully qualified against a minimum customer load.

## Verification

Unit tests cover the four supplied source-reference cases, exact boundaries, conservative length rounding, pressure units, missing minimum load, invalid inputs, unsupported pressure rows, and out-of-table service lengths. Type checking and the production build verify that static data can be bundled without runtime source-file access. Playwright coverage checks the route, mobile overflow, and the main result flows.
