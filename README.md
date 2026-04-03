# Utility Calculator

Engineering calculators for thermal load conversion, CHP feasibility, utility cost comparison, gas flow translation, and general unit conversion.

## Stack

- Next.js 15
- React 19
- Tailwind CSS 4
- Vitest for domain-unit tests
- Playwright for browser smoke testing
- Cloudflare Workers via OpenNext for deployment and server routes

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

`npm run preview` runs the app in the Cloudflare Workers runtime through OpenNext.
On Windows, OpenNext preview is unreliable; the Playwright smoke test uses `next start` locally and keeps the Cloudflare preview path in CI.

## Cloudflare deployment

- Runtime: Cloudflare Workers with the OpenNext adapter
- Preview locally: `npm run preview`
- Deploy: `npm run deploy`
- Wrangler config: `wrangler.jsonc`

### Required secret

The live PJM grid route expects one of these server-side secrets to be configured in Cloudflare:

- `PJM_API_KEY`
- `PJM_DATA_MINER_API_KEY`
- `PJM_DATAMINER_API_KEY`

Example:

```bash
npx wrangler secret put PJM_API_KEY
```

## Engineering note

The load estimator is intentionally labeled as heuristic. Use it for early screening, then verify with project-specific calculations before final design decisions.
