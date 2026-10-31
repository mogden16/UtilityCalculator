# Feasibility Studio continuation backlog

## Milestone 2 refinement

- Save multiple named alternatives in one in-memory project and add side-by-side comparison.
- Add monthly fuel-cost and consumption charts to the report.
- Add tariff-component inputs so fixed, energy, demand, tax, and rider charges are separately classified as avoidable or non-avoidable.
- Add escalation, financing, replacement, and residual-value options to lifecycle analysis.

## Milestone 3 — Utility Bill Intelligence

- Select a maintained browser PDF parser only after dependency, licensing, bundle-size, worker, and security review.
- Define utility-specific extraction profiles and retain page/coordinate evidence for every extracted value.
- Require human confirmation for extracted values; never infer missing usage, dates, charges, rates, or units.
- Add native XLSX parsing only after the same dependency and formula-safety review. Until then, Excel can save the provided template as CSV UTF-8.
- Add bill-period proration and explicit inventory reconciliation for delivered fuels.

## Milestone 4 — CHP and onsite generation

- Wrap the existing tested `lib/chp.ts` balance in project scenarios rather than duplicating it.
- Add technology/size comparison for reciprocating engines, microturbines/turbines, and fuel cells using versioned, cited performance ranges.
- Add monthly screening dispatch, then interval electric/thermal profile import for advanced dispatch.
- Separate energy, demand, standby, supplemental, export, and non-bypassable tariff effects.
- Recommend a size range only when coincident electric and useful thermal loads are adequately supported.

## Milestone 5 — refinement

- Add project JSON import and explicit schema migrations; versioned local JSON export is implemented.
- Add automated report-page visual regression and PDF metadata.
- Add calculation version, assumption source versions, and reviewer sign-off fields.
- Complete accessibility review with keyboard-only and screen-reader passes.
- Add performance budgets for the Studio route.

## Decisions requiring owner approval

- Any server-side storage, login, collaboration, or bill-upload architecture.
- Any third-party bill extraction, OCR, AI service, paid API, or telemetry.
- Production deployment and Cloudflare configuration changes.
- Professional engineer approval/seal workflow and record-retention policy.
