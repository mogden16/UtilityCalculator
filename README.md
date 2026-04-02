# Utility Calculator

Static engineering calculators for thermal load conversion, utility cost comparison, gas flow translation, and general unit conversion.

## Stack

- Next.js 15 static export
- React 19
- Tailwind CSS 4
- Vitest for domain-unit tests
- Playwright for browser smoke testing

## Routes

- `/load-converter/` converts between input fuel, delivered output, and common thermal demand units.
- `/energy-cost-comparison/` normalizes unlike energy sources to delivered MMBtu.
- `/load-estimator/` provides a rule-of-thumb heating and cooling estimate with explicit heuristic language.
- `/gas-flow/` translates demand into CFH, MCFH, therm per hour, and Dth per hour.
- `/unit-conversions/` handles general engineering conversions.

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

## Cloudflare Pages

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `out`

The app is configured for static export in `next.config.ts`.

## Engineering note

The load estimator is intentionally labeled as heuristic. Use it for early screening, then verify with project-specific calculations before final design decisions.
