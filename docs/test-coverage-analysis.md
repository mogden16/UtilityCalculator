# Test Coverage Analysis

## Current State

The test suite has **13 passing tests** across 3 test files, all targeting the Python
`utility_calculator` package and cross-checking unit-conversion constants embedded in
`app/page.tsx`. No TypeScript tests exist and several Python modules are completely
untested.

### Files and estimated coverage

| File | Lines | Tests | Est. coverage |
|------|------:|------:|--------------:|
| `utility_calculator/units.py` | 42 | ✅ | ~80 % |
| `utility_calculator/gas.py` | 71 | ✅ (partial) | ~50 % |
| `utility_calculator/hvac.py` | 61 | ✅ (partial) | ~60 % |
| `utility_calculator/constants.py` | 14 | ✅ (indirect) | ~70 % |
| `utility_calculator/cli.py` | 80 | ❌ | 0 % |
| `utility_calculator/__init__.py` | 22 | ❌ | 0 % |
| `lib/emissions.ts` | 161 | ❌ | 0 % |
| `pjm/client.py` | 268 | ❌ | 0 % |
| `pjm/cli.py` | 56 | ❌ | 0 % |
| `app/api/pjm-gen-emissions/route.ts` | 171 | ❌ | 0 % |
| `app/page.tsx` | 2 354 | ❌ | 0 % |

Overall estimated coverage: **~15 %**.

---

## Proposed Improvements

The items below are ordered from highest to lowest priority, based on a combination of
risk (are bugs here likely to go unnoticed?), effort (how hard are the tests to write?),
and value (how much business logic is exercised?).

---

### 1. `lib/emissions.ts` — pure functions, zero tests (HIGH)

This module contains all the emissions-calculation logic used by both the frontend and
the API route. The functions are pure and stateless, making them ideal unit-test
candidates with no mocking required. A Jest/Vitest setup should be added and the
following cases covered.

**`mapPjmFuelToFuelKey(raw)`**

- `undefined` → `"biomass"` (default)
- Various coal strings: `"Coal"`, `"COAL_STEAM"`, `"anthracite coal"`
- Nuclear: `"NUC"`, `"nuclear"`
- Wind, solar, hydro, oil (including `"diesel"`, `"petroleum"`), biomass
- Natural gas: `"GAS"`, `"ng"`, `"NGCC"`
- Completely unknown string → `"biomass"` (fallback)
- Leading/trailing whitespace stripped correctly

**`computeFuelEmissionsRows(rows, tAndDLossFraction)`**

- Empty `rows` array → early-return guard (`totalMw === 0`)
- All rows with `mw = 0` → same early-return path
- Single fuel type: share fraction = 1.0, `sharePercent = 100`
- Mixed grid: verify `shareFraction` and `contributionLbPerMwh` are computed correctly
- T&D loss clamping: negative loss → treated as 0; loss > 0.95 → clamped to 0.95
- Non-finite `mw` values are excluded from `totalMw`
- `totalDeliveredLbPerMwh` equals `totalGenerationLbPerMwh / (1 - safeLoss)`

**`computeGasEmissionsForScenario(scenarioKey)`**

Cover all three leak scenarios and verify numeric outputs against hand-calculated
expected values:

- `"low"` (1 %, GWP 25): spot-check `methaneCo2eLbPerMmbtu`, `totalCo2eLbPerMcf`,
  `totalCo2eLbPerKwh`, `directCo2LbPerKwh`
- `"medium"` (3 %, GWP 82)
- `"high"` (5 %, GWP 100)

Example expected values for the `"low"` scenario:
- `methaneKgPerMmbtu = 19.2 × 0.01 = 0.192`
- `methaneCo2eKgPerMmbtu = 0.192 × 25 = 4.8`
- `methaneCo2eLbPerMmbtu ≈ 4.8 × 2.20462 ≈ 10.582`
- `totalCo2eLbPerMmbtu ≈ 117 + 10.582 ≈ 127.582`

**`prettyFuelLabel(fuelKey)`**

- Known keys return expected display string
- (Optional) unknown key returns the raw key as a fallback

---

### 2. `utility_calculator/cli.py` — CLI entry point, zero tests (HIGH)

The CLI is the primary user-facing interface for the Python package. The `main()`
function has two distinct code paths (simple conversion vs. `tons-to-mcf`) that are
completely untested. Use `subprocess.run` or pytest's `capsys` + monkeypatching of
`sys.argv` to test these.

**`_build_parser()`**

- Parser is created without error
- All 9 subcommands are registered

**Simple conversions via `main()`** — one parametrized test per command:

| Command | Input argv | Expected stdout (approx.) |
|---------|-----------|--------------------------|
| `tons-to-btuh` | `["1.0"]` | `"12000.0"` |
| `btuh-to-tons` | `["12000.0"]` | `"1.0"` |
| `btuh-to-mmbtuh` | `["1000000.0"]` | `"1.0"` |
| `mmbtuh-to-btuh` | `["1.0"]` | `"1000000.0"` |
| `mcf-to-mmbtu` | `["1.0"]` | `"1.035"` |
| `mmbtu-to-mcf` | `["1.035"]` | `"1.0"` |
| `mcf-to-dth` | `["1.0"]` | `"1.035"` |
| `dth-to-mcf` | `["1.035"]` | `"1.0"` |

**`tons-to-mcf` subcommand**

- Default efficiency and heating value: `tons-to-mcf 3000` → `≈34.783`
- Custom efficiency: `tons-to-mcf 3000 --eff 0.8`
- Custom heating value: `tons-to-mcf 1.0 --hv 1.0`
- Invalid efficiency (≤ 0) propagates a `ValueError` / non-zero exit

---

### 3. Gas module — custom heating-value paths untested (MEDIUM)

The existing tests only exercise the default `hv_mmbtu_per_mcf = 1.035` case. All four
functions accept an overridable heating value, but that parameter is never tested.

**`mcf_to_mmbtu` / `mmbtu_to_mcf` with custom `hv_mmbtu_per_mcf`**

- `mcf_to_mmbtu(2.0, hv_mmbtu_per_mcf=1.0)` → `2.0`
- Round-trip: `mmbtu_to_mcf(mcf_to_mmbtu(x, hv), hv) ≈ x` for several `hv` values

**`mcf_to_dth` / `dth_to_mcf` with custom `hv_mmbtu_per_mcf`**

- Same round-trip test using non-default heating values (e.g. 1.020, 1.050)

**Zero inputs**

- `mcf_to_mmbtu(0.0)` → `0.0`
- `mmbtu_to_mcf(0.0)` → `0.0`

---

### 4. HVAC module — efficiency and heating-value paths undertested (MEDIUM)

The existing parametrized test for `tons_to_btuh` covers only 1 ton and 3 000 tons.
`tons_to_mcf_per_hr` is only tested at 100 % efficiency with the default heating value.

**`tons_to_mcf_per_hr` with non-default efficiency**

- `tons_to_mcf_per_hr(1.0, eff=0.8)` — verify the result is `tons_to_mcf_per_hr(1.0) / 0.8`
- `tons_to_mcf_per_hr(1.0, eff=0.5)` — 50 % efficiency doubles gas consumption

**`tons_to_mcf_per_hr` with custom heating value**

- `tons_to_mcf_per_hr(1.0, hv_mmbtu_per_mcf=1.0)` — simpler arithmetic to verify

**Negative efficiency**

- `eff = -1.0` should raise `ValueError` (currently the guard only catches `eff <= 0`,
  so negative values are caught, but no test confirms this)

**`btuh_to_tons` as a standalone test**

- Currently only tested via round-trip. Add a direct test:
  `btuh_to_tons(36_000_000.0) == 3_000.0`

---

### 5. `pjm/client.py` — external HTTP client, zero tests (MEDIUM)

`PJMDataMinerClient` contains retry logic, CSV/JSON parsing, and column normalisation.
These can all be tested with `unittest.mock.patch` or `pytest-responses`/`responses`
to avoid real network calls.

**Key cases to cover**

- Successful JSON fetch: mock `requests.get` to return a fixture; verify returned
  DataFrame columns and row count
- Successful CSV fetch: same with a CSV fixture
- Column normalisation to snake_case (e.g. `"Fuel Type"` → `"fuel_type"`)
- Retry on HTTP 5xx: mock first call returning 500, second returning 200; confirm
  exactly two calls are made
- `PJMDataFetchError` raised after all retries exhausted
- `start`/`end` timestamp parameters are included in the query string

---

### 6. `app/api/pjm-gen-emissions/route.ts` — API route, zero tests (LOW–MEDIUM)

The route fetches PJM data, filters by timestamp, aggregates MW by fuel key, and
computes a weighted carbon-intensity figure. It can be tested with a mocked
`PJMDataMinerClient`.

**Suggested cases**

- Happy path: mock client returns a valid fuel-mix DataFrame; assert the response JSON
  contains `gridMix`, `totalMw`, and `weightedCarbonIntensityLbPerMwh`
- Empty result from client → appropriate error response or zero values
- Missing `NEXT_PUBLIC_PJM_SUBSCRIPTION_KEY` env var → error response

---

### 7. TypeScript test infrastructure (prerequisite for items 1 and 6)

Before writing any TypeScript tests, a test runner must be configured. The recommended
approach:

1. Add `vitest` (or `jest` with `ts-jest`) as a dev dependency
2. Create `vitest.config.ts` pointing at `lib/**` and `app/api/**`
3. Optionally add `@testing-library/react` for eventual component tests

The pure-function modules (`lib/emissions.ts`) need no DOM environment, so Vitest with
`environment: "node"` is sufficient for items 1 and 6.

---

## Summary Table

| Priority | Area | New tests est. | Complexity |
|----------|------|:--------------:|:----------:|
| HIGH | `lib/emissions.ts` pure functions | ~20 | Low (pure functions, no mocks) |
| HIGH | `utility_calculator/cli.py` | ~12 | Low (subprocess/monkeypatch) |
| MEDIUM | Gas module custom heating values | ~8 | Low |
| MEDIUM | HVAC module efficiency/HV paths | ~6 | Low |
| MEDIUM | `pjm/client.py` with mocks | ~8 | Medium (HTTP mocking) |
| LOW–MED | API route `pjm-gen-emissions` | ~5 | Medium (env + mock client) |
| PREREQUISITE | TypeScript test infrastructure | — | Low–Medium |
