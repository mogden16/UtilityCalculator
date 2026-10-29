# UtilityCalc UX and engineering audit

## Baseline findings

- The eight public routes work, but the calculators use different interaction patterns and expose too many equal-weight cards before the answer.
- The previous homepage described the repository refactor instead of the user’s engineering task.
- Desktop navigation wrapped into a long row; mobile navigation required opening a menu. Several controls were shorter than the preferred 44 px touch target.
- Load Converter and Gas Flow duplicated the same domain calculation and most of the same inputs.
- CHP calculations lived in a JSX component. Baseline gas was subtracted from CHP fuel without calculating useful heat, avoided boiler fuel, or residual boiler consumption. Maintenance, standby charges, and demand savings were omitted, and a tax-credit fraction was applied by default.
- Energy comparison correctly used equal useful heat, but propane gallons were absent and one field mixed combustion efficiency with heat-pump COP terminology.
- Unknown PJM fuel labels fell through to zero-emission biomass. The UI compared electricity and gas per thermal kWh without equipment efficiency/COP and did not distinguish redistribution authorization, stale data, or unavailable data.
- Facility reference content and wide result tables created long mobile pages. Copy, reset, print, and reusable assumptions were inconsistent or absent.

## Design system

- Compact 64 px application header, persistent five-item mobile bottom navigation, task-oriented dashboard, and 44 px controls.
- Input → key result → supporting metrics → collapsed detail on every workflow.
- Blue primary result band, neutral input cards, monospace numbers, plain-language labels, and amber limitations.
- No customer inputs are persisted. Only the non-confidential gas HHV assumption is reused in browser-local storage.

## Route checklist

- `/`: five one-action workflow shortcuts; developer status content moved to README.
- `/load-converter`: unified gas-demand workflow, live CFH result, validation, reusable HHV, copy/reset/print, collapsed detail.
- `/gas-flow`: same unified workflow with gas-flow emphasis; URL retained.
- `/energy-cost-comparison`: equal-useful-heat basis retained; MCF, Dth, therm, oil gallon, propane gallon, and kWh; efficiency/COP labels; capital and payback.
- `/chp`: typed domain model and tests; useful heat utilization, avoided/residual boiler fuel, incremental gas, maintenance, demand, standby, capital, explicit incentives, and screening warning.
- `/emissions`: unknown fuel is not zero; direct/upstream/grid-average separated; equal-delivered-heat comparison; COP and efficiency; stale/unavailable/licensing states; no marginal claim.
- `/load-estimator`: answer promoted; copy/reset/print; heuristic warning retained.
- `/unit-conversions`: lightweight result; unit switching preserves the physical value; copy/reset/print.

## Deferred follow-up

- Tariff-specific demand ratchets and standby schedules.
- Hourly CHP dispatch/load-profile import and thermal storage.
- Authorized PJM marginal-emissions data source, if licensing and methodology are approved.
- User-named local scenarios after a privacy review; no account or cloud persistence is planned.
