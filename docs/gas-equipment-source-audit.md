# Gas equipment source-data audit

Generated from the three supplied references. Original values remain unchanged in the normalized data.

## Inventory

| Source | Coverage used | Revision evidence | Public handling |
| --- | --- | --- | --- |
| Maximum Service Capacity Table (5913_0) | 12 plastic/steel tables, 1,760 capacity cells, and the mixed-plastic table | PDF states `LAST UPDATED 3/22/2022` | Source PDF is not published |
| Meter & Regulator Selection Guidelines | Diaphragm, comparison rotary/turbine tables, 150 regulator arrangements, DS14.9 connection rules, and overpressure settings | Workbook modified 2025-03-26; worksheet identifiers DS14.11 and DS14.9 | Stock numbers and source workbook are not published |
| Rotary & Turbine Meter Capacity Table (Final Revision) | 665 total normalized meter records when combined with the diaphragm source | Workbook modified 2022-11-09 | Pricing worksheet and source workbook are not published |

## Data-quality findings

### Literal nonmonotonic service values

The following values increase as service length increases. They are preserved exactly and flagged when a lookup lands on either affected row.

| Table | Size | Previous row | Current row |
| --- | --- | ---: | ---: |
| Existing plastic, low pressure | 1-inch CTS | 95 ft: 194 CFH | 100 ft: 198 CFH |
| Existing plastic, low pressure | 1-1/4-inch IPS | 40 ft: 708 CFH | 45 ft: 746 CFH |
| New plastic, intermediate pressure | 2-inch IPS | 50 ft: 8,030 CFH | 55 ft: 8,037 CFH |
| Existing steel, low pressure | 3-inch IPS | 85 ft: 3,949 CFH | 90 ft: 3,998 CFH |

Engineering approval is required before correcting any of these source values.

### Duplicate and conflicting tables

- `Diaphragm (2021)` and `Full version` contain the same numeric capacities but use slightly different model labels. `Diaphragm (2021)` is the selected source.
- The earlier `FSD Rotary` and `FSD Turbine` worksheets use rounded pressure factors. Their calculated values differ slightly from the later workbook titled `Final Revision`, which retains higher-precision factors. The final-revision workbook is the selected public rotary/turbine source.
- No values from duplicate sources are averaged, merged, or silently substituted.

### Missing or ambiguous information

- Diaphragm meter minimum-flow limits are not published. Diaphragm results are maximum-capacity screening only.
- Regulator inlet categories overlap at 30-35 psig and at 60 psig. The lookup requires an explicit source-category selection.
- The regulator workbook does not state one workbook-wide revision. The data records DS14.11/DS14.9 identifiers and the file-modified timestamp.
- The DS14.9 connection image leaves some meter-size and pressure boundary combinations unstated. It also contains general and specific rules that can overlap. Conflicting or absent matches return `Engineering review`.

## Public-data exclusions

- The complete PDF and Excel source files are not copied to `public/`.
- The turbine pricing worksheet is not present in generated JSON.
- Regulator stock-number cells are not present in generated JSON.
- A future internal view must use authenticated server-side authorization. Client-side hiding is not sufficient.

## Lookup safeguards

- Service lengths use the next longer source row. Lengths outside the table are rejected.
- The mixed-service lookup uses the next longer length row and next greater-or-equal CFH column. It does not interpolate.
- Meter and regulator pressures must match a source row or stated pressure band. They do not interpolate between pressure rows.
- The service PDF's 1,000 BTU/CF example remains distinct from the website's 1,035 BTU/CF default.
