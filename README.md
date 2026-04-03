# Utility Calculator

Engineering calculators for thermal load conversion, CHP feasibility, utility cost comparison, gas flow translation, and general unit conversion.

## Stack

- Next.js 15
- React 19
- Tailwind CSS 4
- Vitest for domain-unit tests
- Playwright for browser smoke testing
- Cloudflare Pages static export with a Pages Function for the PJM proxy

## Routes

- `/load-converter` converts between input fuel, delivered output, and common thermal demand units.
- `/energy-cost-comparison` normalizes unlike energy sources to delivered MMBtu.
- `/chp` screens CHP sizing/economics and compares against live PJM generation emissions.
- `/load-estimator` provides a rule-of-thumb heating and cooling estimate with explicit heuristic language.
- `/gas-flow` translates demand into CFH, MCFH, therm per hour, and Dth per hour.
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

The live PJM grid route expects one of these server-side secrets to be configured in the Pages project environment:

- `PJM_API_KEY`
- `PJM_DATA_MINER_API_KEY`
- `PJM_DATAMINER_API_KEY`

## Engineering note

The load estimator is intentionally labeled as heuristic. Use it for early screening, then verify with project-specific calculations before final design decisions.
