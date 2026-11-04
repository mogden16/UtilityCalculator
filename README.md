# Utility Calculator

A mobile-first utility engineering and customer-solutions toolkit for feasibility studies, gas demand, equal-useful-heat cost comparison, CHP screening, facility loads, emissions, and general unit conversion.

The public application is task-oriented. Repository history, architecture, and validation details live here rather than on the homepage. The full route audit is in [`docs/ux-audit-and-route-plan.md`](docs/ux-audit-and-route-plan.md).

## Stack

- Next.js 15
- React 19
- Tailwind CSS 4
- Vitest for domain-unit tests
- Playwright for browser smoke testing
- Cloudflare Pages static export with a Pages Function for the PJM proxy

## Routes

- `/feasibility-studio` provides local-first manual, CSV, and searchable-PDF utility intake; source-traced review; fuel-conversion engineering; financial sensitivity analysis; and print-ready preliminary reports.
- `/load-converter` is the primary gas-demand and load-conversion workflow.
- `/gas-equipment-sizing` performs preliminary source-table service, meter, and regulator screening.
- `/energy-cost-comparison` normalizes unlike energy sources to delivered MMBtu.
- `/chp` screens CHP sizing and economics for onsite generation projects.
- `/emissions` reviews live PJM grid emissions, fuel mix, and electric-versus-gas comparisons.
- `/load-estimator` provides a rule-of-thumb heating and cooling estimate with explicit heuristic language.
- `/gas-flow` is a backward-compatible alias of `/load-converter` and is intentionally omitted from navigation.
- `/unit-conversions` handles general engineering conversions.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

`npm run build` writes the static site to `out/`.

## Cloudflare Pages deployment

- Framework preset: `Next.js (Static HTML Export)`
- Build command: `npm run build`
- Build output directory: `out`
- Server-side PJM proxy: `functions/api/pjm-gen-emissions.ts`

If your Pages project still runs `npx @cloudflare/next-on-pages@1`, change it. This repo is not using that build path.

### Required secret

The live PJM grid route expects `PJM_DATAMINER_API_KEY` to be configured in the Pages project environment.

- `PJM_DATAMINER_API_KEY`

The function still accepts the older aliases `PJM_API_KEY` and `PJM_DATA_MINER_API_KEY` as fallback, but `PJM_DATAMINER_API_KEY` is now the canonical name.

### PJM redistribution gate

PJM Data Miner terms restrict public redistribution without applicable membership or redistribution authorization. The browser therefore does not request or display the PJM feed by default. Only after authorization is documented should the build-time flag below be enabled:

```bash
NEXT_PUBLIC_PJM_REDISTRIBUTION_AUTHORIZED=true
```

Without that flag, the emissions workflow accepts a user-supplied, documented grid-average factor. It does not infer marginal emissions from generation mix.

## Engineering notes

The load estimator is intentionally labeled as heuristic. Use it for early screening, then verify with project-specific calculations before final design decisions.

CHP results are preliminary screening estimates. The model separately calculates CHP fuel, available and utilized recovered heat, avoided boiler fuel, residual boiler fuel, electric energy and demand savings, maintenance, standby charges, capital, explicit incentives, and simple payback. Incentives default to zero and are never assumed eligible automatically.

Shared engineering defaults are centralized in `lib/assumptions.ts`. The UI keeps important defaults editable and stores only the gas HHV assumption in browser-local storage; customer usage and cost inputs are not persisted.

Feasibility Studio project and billing data remain in React state for the current browser tab. The MVP does not upload, persist, or send customer data to an AI service. CSV import retains source row locators; PDF and native XLSX extraction remain gated pending parser, security, and accuracy review. Reports, supporting CSV files, and local project JSON exports carry project-schema, calculation-engine, assumption-set, report-template, application, build, and input-fingerprint provenance. See [`docs/feasibility-studio-architecture.md`](docs/feasibility-studio-architecture.md), [`docs/feasibility-studio-versioning.md`](docs/feasibility-studio-versioning.md), and [`docs/feasibility-studio-backlog.md`](docs/feasibility-studio-backlog.md).

Gas-equipment reference data is generated ahead of time and requires no PDF or Excel parsing in the deployed site. See [`docs/gas-equipment-sizing-architecture.md`](docs/gas-equipment-sizing-architecture.md) for lookup rules and [`docs/gas-equipment-source-audit.md`](docs/gas-equipment-source-audit.md) for source discrepancies and public-data exclusions. The source generator is `scripts/extract_gas_equipment_data.py`; it intentionally excludes pricing and regulator stock numbers.

Regenerate the static reference data only from authorized local copies of the three source documents:

```bash
python scripts/extract_gas_equipment_data.py \
  --service-pdf path/to/maximum-service-capacity.pdf \
  --guidelines-xlsx path/to/meter-regulator-guidelines.xlsx \
  --meter-xlsx path/to/rotary-turbine-final.xlsx \
  --output-dir data/gas-equipment
```
